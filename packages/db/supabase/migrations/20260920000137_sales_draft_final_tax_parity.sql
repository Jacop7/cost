-- APP-215 · 매출 초안과 확정 원장의 채널별 세금 반올림 기준을 통일한다.
--
-- 메뉴 1개 세액을 먼저 반올림한 뒤 수량을 곱하면, 확정 원장이 사용하는
-- `채널별 판매 총액 -> 구성 세금별 반올림`과 통화 최소단위 차이가 날 수 있다.
-- 초안도 봉인된 메뉴 세금 quote의 반올림 전 구성값을 채널 총액 기준으로 계산한다.

begin;

create or replace function public.sales_draft_menu_tax_quote(p_draft uuid)
returns jsonb
language plpgsql
stable security invoker
set search_path=public,pg_temp
as $fn$
declare
  v_manifest jsonb;
  v_line record;
  v_channel record;
  v_item jsonb;
  v_unit_quote jsonb;
  v_component jsonb;
  v_channel_tax numeric;
  v_channel_listed numeric;
  v_listed numeric:=0;
  v_net numeric:=0;
  v_customer numeric:=0;
  v_tax numeric:=0;
  v_lines jsonb:='[]'::jsonb;
begin
  select b.manifest into v_manifest
    from public.sales_day_drafts d
    join public.sales_basis_versions b on b.id=d.basis_version_id
   where d.id=p_draft;
  if v_manifest is null then
    raise exception '매출 초안을 찾을 수 없어요'
      using errcode='22000',detail='SALES_DRAFT_NOT_FOUND';
  end if;

  for v_line in
    select l.* from public.sales_draft_menu_lines l
     where l.draft_id=p_draft and not l.deleted
     order by l.sort_order,l.id
  loop
    v_item:=v_manifest#>array['recipes',v_line.recipe_id::text];
    v_unit_quote:=v_item->'tax_quote';
    -- 국제 세금 활성 전 기준에는 quote가 없다. 이 경우 기존 봉인 단가 계산으로 폴백한다.
    if v_unit_quote is null
       or jsonb_typeof(v_unit_quote->'components') is distinct from 'array' then
      return jsonb_build_object('applied',false,'reason','legacy_basis');
    end if;

    for v_channel in
      select * from public.sales_draft_line_channel_rows(v_line.id)
       where quantity<>0 order by sort_order,sales_channel_id
    loop
      v_channel_listed:=coalesce((v_item->>'price')::numeric,0)*v_channel.quantity;
      v_channel_tax:=0;
      for v_component in
        select value from jsonb_array_elements(v_unit_quote->'components')
      loop
        -- 확정 원장과 같이 채널 총액의 구성 세금별 값을 통화 최소단위로 반올림한다.
        -- quote의 rounded_amount numeric scale은 해당 통화의 minor unit을 보존한다.
        v_channel_tax:=v_channel_tax+round(
          (v_component->>'unrounded_amount')::numeric*v_channel.quantity,
          scale((v_component->>'rounded_amount')::numeric));
      end loop;
      v_listed:=v_listed+v_channel_listed;
      v_tax:=v_tax+v_channel_tax;
      if (v_unit_quote->>'customer_total')::numeric
           >(v_unit_quote->>'listed_total')::numeric then
        v_net:=v_net+v_channel_listed;
        v_customer:=v_customer+v_channel_listed+v_channel_tax;
      else
        v_net:=v_net+v_channel_listed-v_channel_tax;
        v_customer:=v_customer+v_channel_listed;
      end if;
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'recipe_id',v_line.recipe_id,'sales_channel_id',v_channel.sales_channel_id,
        'channel_code',v_channel.channel_code,'channel_name',v_channel.channel_name,
        'quantity',v_channel.quantity,'tax_total',v_channel_tax));
    end loop;
  end loop;

  return jsonb_build_object(
    'applied',true,'basis_source','frozen_recipe_tax_quote',
    'listed_total',v_listed,'net_sales',v_net,
    'customer_total',v_customer,'tax_total',v_tax,'lines',v_lines);
end
$fn$;

do $patch$
declare d text; a text; z text;
begin
  d:=replace(pg_get_functiondef('public.sales_draft_payload(uuid)'::regprocedure),chr(13),'');
  a:='  v_fixed_rate numeric; v_etc_tax_rate numeric:=0; v_etc_quote jsonb;';
  z:='  v_fixed_rate numeric; v_etc_tax_rate numeric:=0; v_etc_quote jsonb; v_menu_quote jsonb;';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
    raise exception '0137 sales_draft_payload declaration anchor';
  end if;
  d:=replace(d,a,z);

  a:='  into v_items,v_menu_revenue,v_qty,v_menu_net,v_material,v_extra_material,v_waste from line_values;';
  z:=a||chr(10)||chr(10)||
    '  v_menu_quote:=public.sales_draft_menu_tax_quote(p_draft);'||chr(10)||
    '  if coalesce((v_menu_quote->>''applied'')::boolean,false) then'||chr(10)||
    '    v_menu_revenue:=coalesce((v_menu_quote->>''customer_total'')::numeric,0);'||chr(10)||
    '    v_menu_net:=coalesce((v_menu_quote->>''net_sales'')::numeric,0);'||chr(10)||
    '  end if;';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
    raise exception '0137 sales_draft_payload menu quote anchor';
  end if;
  d:=replace(d,a,z);
  execute d;
end
$patch$;

alter function public.sales_draft_menu_tax_quote(uuid) owner to postgres;
alter function public.sales_draft_payload(uuid) owner to costkeep_rpc_executor;

revoke all on function public.sales_draft_menu_tax_quote(uuid) from public,anon,authenticated;
grant execute on function public.sales_draft_menu_tax_quote(uuid) to costkeep_rpc_executor,service_role;

commit;
