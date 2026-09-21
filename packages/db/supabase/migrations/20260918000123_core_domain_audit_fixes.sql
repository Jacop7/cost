-- 핵심 도메인 독립 검수 후속:
-- 1) 입고 전 신규 재료 판매도 음수 재고를 만든다.
-- 2) 매출 초안의 기타 매출 세금은 확정과 같은 국제 세금 엔진을 쓴다.
-- 3) 작성 중 초안 폐기 + 휴무 전환을 한 트랜잭션으로 묶는다.
-- 4) 판매 중지/삭제 메뉴와 재고 미관리 재료의 초안 경계를 서버에서 고정한다.
-- 5) 채널 손익의 모든 배분값과 순이익을 서버가 확정한다.
begin;

-- ── 재고 행이 아직 없는 신규 재료도 판매 필요량 전량을 차감한다 ──
create or replace function public.consume_stock(
  p_ingredient uuid,p_amount numeric,p_allow_negative boolean default false
) returns numeric language plpgsql as $fn$
declare
  v_before numeric;
  v_take numeric;
begin
  if p_amount is null or p_amount<=0 then return 0; end if;

  select stock_total into v_before
    from public.inventory_states
   where ingredient_id=p_ingredient
   for update;

  if not found then
    if not p_allow_negative then return 0; end if;
    insert into public.inventory_states(ingredient_id,store_id,stock_total)
    select i.id,i.store_id,-p_amount
      from public.ingredients i
     where i.id=p_ingredient and i.active and i.stock_tracking
    on conflict(ingredient_id) do update
      set stock_total=public.inventory_states.stock_total-p_amount,
          updated_at=clock_timestamp()
    returning p_amount into v_take;
    return coalesce(v_take,0);
  end if;

  v_take:=case when p_allow_negative then p_amount
               else greatest(0,least(p_amount,coalesce(v_before,0))) end;
  if v_take=0 then return 0; end if;
  update public.inventory_states
     set stock_total=stock_total-v_take,updated_at=clock_timestamp()
   where ingredient_id=p_ingredient;
  return v_take;
end $fn$;

comment on function public.consume_stock(uuid,numeric,boolean) is
  '재고 차감. 판매/입고취소는 필요량 전량을 차감하며 재고 행이 없어도 음수 행을 만든다. 폐기는 보유량까지만 차감한다.';

-- ── 기타 매출 세금 읽기 전용 견적: 확정 트리거와 같은 프로필/반올림 ──
create or replace function public.sales_etc_tax_quote(
  p_store uuid,p_date date,p_items jsonb
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare
  v_cap jsonb:=public.app_capabilities();
  v_test boolean:=session_user='postgres'
    and current_setting('margincook.international_tax_force',true) is not distinct from 'owner_test'
    and current_setting('margincook.international_tax_activation_test',true) is not distinct from 'on';
  v_boundary date;
  v_market public.store_market_profiles%rowtype;
  v_profile public.store_tax_profiles%rowtype;
  v_item jsonb;
  v_channel public.international_sales_channel_code;
  v_components jsonb;
  v_quote jsonb;
  v_lines jsonb:='[]'::jsonb;
  v_tax numeric:=0;
  v_customer numeric:=0;
  v_net numeric:=0;
  v_price numeric;
  v_qty numeric;
begin
  perform public.assert_my_store(p_store);
  if not (v_cap#>>'{international_tax,write_enabled}')::boolean and not v_test then
    return jsonb_build_object('applied',false,'reason','disabled');
  end if;
  select activation_date into v_boundary
    from public.international_tax_activation_boundaries where store_id=p_store;
  if v_boundary is null or p_date<v_boundary then
    return jsonb_build_object('applied',false,'reason',
      case when v_boundary is null then 'not_activated' else 'before_activation' end);
  end if;
  select * into v_market from public.store_market_profiles m
   where m.store_id=p_store and p_date>=m.effective_from
     and (m.effective_to is null or p_date<=m.effective_to);
  select * into v_profile from public.store_tax_profiles t
   where t.store_id=p_store and t.market_profile_id=v_market.id
     and p_date>=t.effective_from and (t.effective_to is null or p_date<=t.effective_to);
  if v_market.id is null or v_profile.id is null then
    raise exception '기타매출 판매일의 국제 세금 프로필을 찾을 수 없어요'
      using errcode='45013',detail='TAX_PROFILE_NOT_AVAILABLE';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    if coalesce((v_item->>'deleted')::boolean,false) then continue; end if;
    begin
      v_price:=coalesce((v_item->>'price')::numeric,0);
      v_qty:=coalesce((v_item->>'qty')::numeric,1);
      v_channel:=(v_item->>'channel')::public.international_sales_channel_code;
    exception when others then
      raise exception '기타매출 세금 입력이 올바르지 않아요'
        using errcode='22000',detail='INVALID_ETC_TAX_INPUT';
    end;
    if v_channel is null then
      raise exception '국제 세금 적용 뒤 기타매출에는 판매 채널이 필요해요'
        using errcode='22000',detail='ETC_SALES_CHANNEL_REQUIRED';
    end if;
    if v_price<0 or v_qty<0 then
      raise exception '기타매출 금액과 수량은 음수일 수 없어요'
        using errcode='22000',detail='INVALID_ETC_TAX_INPUT';
    end if;
    select jsonb_agg(jsonb_build_object(
      'component_id',c.id,'kind',c.kind,'name',c.name,'rate_pct',c.rate_pct,
      'jurisdiction_level',c.jurisdiction_level,'calculation_basis',c.calculation_basis,
      'applies_to_treatments',to_jsonb(c.applies_to_treatments),
      'remittance_owner',r.remittance_owner) order by c.sort_order,c.id)
      into v_components
      from public.store_tax_components c
      join public.channel_tax_remittance r on r.tax_component_id=c.id
        and r.store_id=c.store_id and r.sales_channel_code=v_channel
     where c.tax_profile_id=v_profile.id;
    if v_components is null then
      raise exception '기타매출 세금 구성 항목이 완결되지 않았어요'
        using errcode='45013',detail='TAX_PROFILE_INCOMPLETE';
    end if;
    v_quote:=public.calculate_international_tax(
      v_market.price_basis,public.international_currency_minor_unit(v_market.currency_code),
      v_profile.default_treatment,v_price*v_qty,v_components);
    v_tax:=v_tax+(v_quote->>'tax_total')::numeric;
    v_customer:=v_customer+(v_quote->>'customer_total')::numeric;
    v_net:=v_net+(v_quote->>'net_sales')::numeric;
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'name',coalesce(v_item->>'name','기타 매출'),'channel',v_channel,
      'price',v_price,'quantity',v_qty,'quote',v_quote));
  end loop;
  return jsonb_build_object('applied',true,'tax_total',v_tax,
    'customer_total',v_customer,'net_sales',v_net,'lines',v_lines);
end $fn$;

-- 초안 미리보기도 위 견적을 사용한다. 국제 세금 적용 전 날짜만 봉인된 단일 세율로 폴백한다.
create or replace function public.sales_draft_payload(p_draft uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare
  v_store uuid; v_manifest jsonb; v_items jsonb; v_etc_items jsonb; v_extra_items jsonb;
  v_business_date date; v_menu_revenue numeric:=0; v_menu_net numeric:=0;
  v_qty numeric:=0; v_material numeric:=0; v_extra_material numeric:=0;
  v_waste numeric:=0; v_etc_revenue numeric:=0; v_etc_tax numeric:=0; v_etc_net numeric:=0;
  v_daily_extra numeric:=0; v_revenue numeric:=0; v_net numeric:=0;
  v_tax numeric:=0; v_fixed numeric:=0; v_expense numeric:=0; v_profit numeric:=0;
  v_fixed_rate numeric:=0; v_etc_tax_rate numeric:=0; v_etc_quote jsonb;
begin
  select d.store_id,b.manifest,d.business_date into v_store,v_manifest,v_business_date
  from public.sales_day_drafts d join public.sales_basis_versions b on b.id=d.basis_version_id
  where d.id=p_draft;
  v_manifest:=coalesce(v_manifest,'{}'::jsonb);
  v_fixed_rate:=coalesce(nullif(v_manifest->>'fixed_rate','')::numeric,0);
  v_etc_tax_rate:=coalesce(nullif(v_manifest->>'etc_tax_rate','')::numeric,0);

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',m.id,'recipe_id',m.recipe_id,'menu_name',m.menu_name,
      'price',coalesce((r.item->>'price')::numeric,0),
      'qty_hall',m.qty_hall,'qty_delivery',m.qty_delivery,
      'qty_takeout',m.qty_takeout,'qty_waste',m.qty_waste,'deleted',m.deleted)
      order by m.sort_order,m.id),'[]'::jsonb),
    coalesce(sum(case when m.deleted then 0 else m.qty_hall+m.qty_delivery+m.qty_takeout end
      *coalesce((r.item->>'customer_total')::numeric,(r.item->>'price')::numeric,0)),0),
    coalesce(sum(case when m.deleted then 0 else m.qty_hall+m.qty_delivery+m.qty_takeout end),0),
    coalesce(sum(case when m.deleted then 0 else m.qty_hall+m.qty_delivery+m.qty_takeout end
      *coalesce((r.item->>'net_sales')::numeric,
        (r.item->>'price')::numeric-coalesce((r.item->>'tax')::numeric,0),(r.item->>'price')::numeric,0)),0),
    coalesce(sum(case when m.deleted then 0 else m.qty_hall+m.qty_delivery+m.qty_takeout end
      *coalesce((r.item->>'material_cost')::numeric,0)),0),
    coalesce(sum(case when m.deleted then 0 else m.qty_hall+m.qty_delivery+m.qty_takeout end
      *coalesce((r.item->>'extra_cost')::numeric,0)),0),
    coalesce(sum(case when m.deleted then 0 else m.qty_waste end
      *coalesce((r.item->>'waste_material_cost')::numeric,(r.item->>'material_cost')::numeric,0)),0)
  into v_items,v_menu_revenue,v_qty,v_menu_net,v_material,v_extra_material,v_waste
  from public.sales_draft_menu_lines m
  cross join lateral (select v_manifest#>array['recipes',m.recipe_id::text] item) r
  where m.draft_id=p_draft;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'name',e.name,'price',e.price,'qty',e.qty,'channel',e.channel,'deleted',e.deleted)
      order by e.sort_order,e.id),'[]'::jsonb),
    coalesce(sum(case when e.deleted then 0 else e.price*e.qty end),0)
  into v_etc_items,v_etc_revenue from public.sales_draft_etc_lines e where e.draft_id=p_draft;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',x.id,'name',x.name,'amount',x.amount,'memo',x.memo,'deleted',x.deleted)
      order by x.sort_order,x.id),'[]'::jsonb),
    coalesce(sum(case when x.deleted then 0 else x.amount end),0)
  into v_extra_items,v_daily_extra from public.sales_draft_expense_lines x where x.draft_id=p_draft;

  v_etc_quote:=public.sales_etc_tax_quote(v_store,v_business_date,v_etc_items);
  if coalesce((v_etc_quote->>'applied')::boolean,false) then
    v_etc_tax:=coalesce((v_etc_quote->>'tax_total')::numeric,0);
    v_etc_net:=coalesce((v_etc_quote->>'net_sales')::numeric,0);
  else
    v_etc_tax:=round(v_etc_revenue*v_etc_tax_rate,2);
    v_etc_net:=v_etc_revenue-v_etc_tax;
  end if;
  v_revenue:=v_menu_revenue+v_etc_revenue;
  v_net:=v_menu_net+v_etc_net;
  v_tax:=v_revenue-v_net;
  v_fixed:=v_revenue*v_fixed_rate;
  v_profit:=v_net-v_material-v_extra_material-v_waste-v_daily_extra-v_fixed;
  v_expense:=v_revenue-v_profit;
  return jsonb_build_object(
    'items',v_items,'etc_items',v_etc_items,'extra_items',v_extra_items,
    'summary',jsonb_build_object('from',v_business_date,'to',v_business_date,'days',1,
      'revenue',v_revenue,'etc_revenue',v_etc_revenue,'qty',v_qty,
      'material_cost',v_material,'extra_material_cost',v_extra_material,'tax',v_tax,
      'waste_loss',v_waste,'waste_ingredient',0,'waste_menu',v_waste,
      'daily_extra',v_daily_extra,'fixed_cost',v_fixed,'fixed_rate',v_fixed_rate,
      'fixed_rate_provisional',nullif(v_manifest->>'fixed_rate','') is null,
      'expense',v_expense,'profit',v_profit,
      'expense_rate',case when v_revenue=0 then 0 else v_expense/v_revenue end,
      'profit_rate',case when v_revenue=0 then 0 else v_profit/v_revenue end));
end $fn$;

-- 판매 중지/삭제 메뉴는 초안을 연 뒤 상태가 바뀌어도 서버 완료 단계에서 막는다.
create or replace function public.assert_sales_draft_sellable(p_store uuid,p_draft uuid)
returns void language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_name text;
begin
  select m.menu_name into v_name
    from public.sales_draft_menu_lines m
    left join public.recipes r on r.id=m.recipe_id and r.store_id=p_store
   where m.draft_id=p_draft and not m.deleted
     and m.qty_hall+m.qty_delivery+m.qty_takeout>0
     and (r.id is null or not coalesce(r.active,false) or r.deleted_at is not null)
   order by m.sort_order,m.id limit 1;
  if found then
    raise exception '%은(는) 판매 중지되었거나 삭제된 메뉴예요. 수량을 0으로 바꿔 주세요',v_name
      using errcode='22000',detail='DRAFT_MENU_NOT_SELLABLE';
  end if;
end $fn$;

do $patch$ declare d text; a text; z text; begin
  d:=replace(pg_get_functiondef('public.save_sales_draft(uuid,uuid,integer,jsonb,jsonb,jsonb)'::regprocedure),chr(13),'');
  a:='  v_payload:=public.sales_draft_payload(p_draft);';
  z:='  perform public.assert_sales_draft_sellable(p_store,p_draft);'||chr(10)||a;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '00123 save draft anchor'; end if;
  execute replace(d,a,z);

  d:=replace(pg_get_functiondef('public.finalize_sales_draft(uuid,uuid,integer,uuid,text,text)'::regprocedure),chr(13),'');
  a:='  select coalesce(jsonb_agg(jsonb_build_object('||chr(10)||
     '    ''recipe_id'',m.recipe_id';
  z:='  perform public.assert_sales_draft_sellable(p_store,p_draft);'||chr(10)||a;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '00123 finalize draft anchor'; end if;
  execute replace(d,a,z);

  d:=replace(pg_get_functiondef('public.sales_draft_inventory_deltas(uuid)'::regprocedure),chr(13),'');
  a:='    where m.draft_id=p_draft';
  z:='    where m.draft_id=p_draft and coalesce((line->>''stock_tracking'')::boolean,true)';
  if (length(d)-length(replace(d,a,'')))/length(a)<>4 then raise exception '00123 stock tracking anchors'; end if;
  execute replace(d,a,z);
end $patch$;

-- 작성 중 초안 폐기와 휴무 전환은 둘 중 하나라도 실패하면 모두 롤백한다.
create or replace function public.close_sales_draft_as_holiday(
  p_store uuid,p_draft uuid,p_draft_revision integer,p_calendar_revision integer,p_reason text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_draft public.sales_day_drafts; v_result jsonb;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_store_write_scope(p_store);
  select * into v_draft from public.sales_day_drafts where id=p_draft for update;
  if not found or v_draft.store_id<>p_store then
    raise exception '매출 초안을 찾을 수 없어요' using errcode='P0002',detail='SALES_DRAFT_NOT_FOUND';
  end if;
  perform public.discard_sales_draft(p_store,p_draft,p_draft_revision);
  v_result:=public.set_sales_calendar_day(p_store,v_draft.business_date,'closed',p_calendar_revision,
    coalesce(nullif(trim(coalesce(p_reason,'')),''),'작성 중 매출을 초기화하고 휴무 확정'));
  return v_result||jsonb_build_object('draft_id',p_draft,'draft_status','discarded');
end $fn$;

-- 기존 기간 상세는 security definer이므로 소유 매장 검사를 반드시 먼저 수행한다.
create or replace function public.sales_authoritative_range_detail(
  p_store uuid,p_from date,p_to date
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_result jsonb; v_menu jsonb;
begin
  perform public.assert_my_store(p_store);
  v_result:=public.sales_authoritative_range_detail_base_0121(p_store,p_from,p_to);
  select coalesce(jsonb_agg(row_value||jsonb_build_object('is_deleted',case
      when nullif(row_value->>'recipe_id','') is null then true
      else coalesce((select r.deleted_at is not null from public.recipes r
        where r.store_id=p_store and r.id=(row_value->>'recipe_id')::uuid),true) end)
      order by ord),'[]'::jsonb)
    into v_menu from jsonb_array_elements(coalesce(v_result->'menu','[]'::jsonb))
      with ordinality rows(row_value,ord);
  return jsonb_set(v_result,'{menu}',v_menu,true);
end $fn$;

-- 채널별 비용 배분과 순이익을 서버에서 계산한다. 미지정 매출 몫은 unallocated로 남긴다.
create or replace function public.sales_authoritative_channel_profit(
  p_store uuid,p_from date,p_to date
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_detail jsonb; v_channels jsonb; v_unassigned numeric:=0;
begin
  perform public.assert_my_store(p_store);
  v_detail:=public.sales_authoritative_range_detail(p_store,p_from,p_to);
  with menu_daily as (
    select ds.sale_date,ch.code,
      coalesce(sum(coalesce(ts.customer_total,it.unit_price*case ch.code
        when 'hall' then it.qty_hall when 'delivery' then it.qty_delivery else it.qty_takeout end)),0) amount
    from public.daily_sales ds cross join public.sales_channels ch
    left join public.daily_sales_items it on it.daily_sales_id=ds.id
    left join public.daily_sales_item_tax_snapshots ts on ts.daily_sales_item_id=it.id
      and ts.sales_channel_code::text=ch.code
    where ds.store_id=p_store and ds.sale_date between p_from and p_to and ch.store_id=p_store
    group by ds.sale_date,ch.code
  ), etc_lines as (
    select ds.sale_date,nullif(x->>'channel','') code,
      case when ds.etc_tax_snapshot is null
        then coalesce((x->>'price')::numeric,0)*coalesce((x->>'qty')::numeric,1)
        else coalesce((x->'quote'->>'customer_total')::numeric,0) end amount
    from public.daily_sales ds cross join lateral jsonb_array_elements(
      case when ds.etc_tax_snapshot is null then coalesce(ds.etc_items,'[]'::jsonb)
           else coalesce(ds.etc_tax_snapshot->'lines','[]'::jsonb) end) x
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
  ), etc_daily as (
    select sale_date,code,sum(amount) amount from etc_lines where code is not null group by sale_date,code
  ), etc_total as (
    select code,sum(amount) amount from etc_lines where code is not null group by code
  ), channel_daily as (
    select m.sale_date,m.code,m.amount+coalesce(e.amount,0) amount
    from menu_daily m left join etc_daily e using(sale_date,code)
  ), version_days as (
    select h.business_date,public.sales_effective_day_summary(p_store,h.business_date) summary
    from public.sales_day_heads h
    where h.store_id=p_store and h.business_date between p_from and p_to
  ), allocations as (
    select c.code,
      coalesce(sum(case when coalesce((v.summary->>'customer_total')::numeric,0)>0
        then coalesce((v.summary->>'extra_material_cost')::numeric,0)*c.amount/(v.summary->>'customer_total')::numeric else 0 end),0) extra_material,
      coalesce(sum(case when coalesce((v.summary->>'customer_total')::numeric,0)>0
        then coalesce((v.summary->>'waste_loss')::numeric,0)*c.amount/(v.summary->>'customer_total')::numeric else 0 end),0) waste,
      coalesce(sum(case when coalesce((v.summary->>'customer_total')::numeric,0)>0
        then coalesce((v.summary->>'daily_extra')::numeric,0)*c.amount/(v.summary->>'customer_total')::numeric else 0 end),0) daily_extra
    from channel_daily c join version_days v on v.business_date=c.sale_date group by c.code
  ), rows as (
    select ord,c,
      coalesce((select amount from etc_total e where e.code=c->>'code'),0) etc_revenue,
      coalesce(a.extra_material,0) extra_material,coalesce(a.waste,0) waste,
      coalesce(a.daily_extra,0) daily_extra
    from jsonb_array_elements(coalesce(v_detail->'channels','[]'::jsonb)) with ordinality x(c,ord)
    left join allocations a on a.code=c->>'code'
  )
  select coalesce(jsonb_agg(c||jsonb_build_object(
      'etc_revenue',etc_revenue,'extra_material_cost',extra_material,
      'waste_loss',waste,'daily_extra',daily_extra,
      'profit',case when jsonb_typeof(c->'fixed_cost')='number' and jsonb_typeof(c->'net_sales')='number'
        then (c->>'net_sales')::numeric-coalesce((c->>'material')::numeric,0)-extra_material-waste
          -(c->>'fixed_cost')::numeric-daily_extra else null end)
      order by ord),'[]'::jsonb)
    into v_channels from rows;

  select coalesce(sum(case when nullif(x->>'channel','') is null then
      case when ds.etc_tax_snapshot is null
        then coalesce((x->>'price')::numeric,0)*coalesce((x->>'qty')::numeric,1)
        else coalesce((x->'quote'->>'customer_total')::numeric,0) end else 0 end),0)
    into v_unassigned
    from public.daily_sales ds cross join lateral jsonb_array_elements(
      case when ds.etc_tax_snapshot is null then coalesce(ds.etc_items,'[]'::jsonb)
           else coalesce(ds.etc_tax_snapshot->'lines','[]'::jsonb) end) x
   where ds.store_id=p_store and ds.sale_date between p_from and p_to;

  return jsonb_build_object('channels',v_channels,'unassigned_revenue',v_unassigned,
    'unallocated_fixed_cost',v_detail->'fixed_cost_unallocated');
end $fn$;

grant create on schema public to costkeep_rpc_executor;
-- 국제 세금 원장은 앱 역할에 직접 SELECT를 열지 않는다. 이 내부 함수만 소유자 권한으로 읽고
-- assert_my_store를 먼저 통과한 매장·기간으로 한정한다.
alter function public.sales_etc_tax_quote(uuid,date,jsonb) owner to postgres;
alter function public.sales_draft_payload(uuid) owner to costkeep_rpc_executor;
alter function public.assert_sales_draft_sellable(uuid,uuid) owner to costkeep_rpc_executor;
alter function public.close_sales_draft_as_holiday(uuid,uuid,integer,integer,text) owner to costkeep_rpc_executor;
alter function public.sales_authoritative_range_detail(uuid,date,date) owner to costkeep_rpc_executor;
alter function public.sales_authoritative_channel_profit(uuid,date,date) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;

revoke all on function public.sales_etc_tax_quote(uuid,date,jsonb),
  public.sales_draft_payload(uuid),public.assert_sales_draft_sellable(uuid,uuid),
  public.close_sales_draft_as_holiday(uuid,uuid,integer,integer,text),
  public.sales_authoritative_range_detail(uuid,date,date),
  public.sales_authoritative_channel_profit(uuid,date,date) from public,anon,service_role;
revoke all on function public.sales_draft_payload(uuid),public.assert_sales_draft_sellable(uuid,uuid)
  from authenticated;
grant execute on function public.sales_etc_tax_quote(uuid,date,jsonb) to costkeep_rpc_executor;
grant execute on function public.close_sales_draft_as_holiday(uuid,uuid,integer,integer,text),
  public.sales_authoritative_range_detail(uuid,date,date),
  public.sales_authoritative_channel_profit(uuid,date,date) to authenticated;

notify pgrst,'reload schema';
commit;
