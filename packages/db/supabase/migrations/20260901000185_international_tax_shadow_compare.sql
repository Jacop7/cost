-- 0185 · INTL-1F 국제 세금 shadow read 대조
--
-- 같은 판매 입력을 legacy unit_tax와 국제 세금 공식으로 나란히 읽어 비교한다.
-- 업무 테이블·국제 snapshot·이벤트에는 아무것도 쓰지 않으며, 호출 결과는 배포 증거가 보존한다.

begin;

create or replace function public.international_tax_shadow_compare(p_store uuid, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_sales public.daily_sales%rowtype;
  v_item public.daily_sales_items%rowtype;
  v_market public.store_market_profiles%rowtype;
  v_profile public.store_tax_profiles%rowtype;
  v_override public.menu_tax_overrides%rowtype;
  v_channel public.international_sales_channel_code;
  v_quantity numeric;
  v_treatment public.tax_treatment;
  v_category text;
  v_components jsonb;
  v_quote jsonb;
  v_expected integer;
  v_joined integer;
  v_legacy numeric;
  v_legacy_total numeric := 0;
  v_international_total numeric := 0;
  v_comparable integer := 0;
  v_skipped integer := 0;
  v_lines jsonb := '[]'::jsonb;
begin
  if p_store is null or p_date is null or not exists(select 1 from public.stores where id=p_store) then
    raise exception 'shadow 대조 대상이 올바르지 않아요'
      using errcode='22000', detail='INVALID_SHADOW_TARGET';
  end if;
  select * into v_sales from public.daily_sales where store_id=p_store and sale_date=p_date;
  if v_sales.id is null then
    return jsonb_build_object(
      'store_id',p_store,'sale_date',p_date,'status','no_sales','comparable_lines',0,
      'skipped_lines',0,'legacy_tax_total',0,'international_tax_total',0,'delta',0,'lines',v_lines);
  end if;

  for v_item in select * from public.daily_sales_items where daily_sales_id=v_sales.id order by id loop
    foreach v_channel in array enum_range(null::public.international_sales_channel_code) loop
      v_quantity := case v_channel
        when 'hall' then v_item.qty_hall
        when 'delivery' then v_item.qty_delivery
        when 'takeout' then v_item.qty_takeout end;
      if coalesce(v_quantity,0)=0 then continue; end if;

      select * into v_market from public.store_market_profiles m
       where m.store_id=p_store and p_date>=m.effective_from
         and (m.effective_to is null or p_date<=m.effective_to);
      if v_market.id is null then
        v_skipped:=v_skipped+1;
        v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
          'daily_sales_item_id',v_item.id,'sales_channel_code',v_channel,
          'quantity',v_quantity,'status','market_profile_missing'));
        continue;
      end if;
      select * into v_profile from public.store_tax_profiles t
       where t.store_id=p_store and t.market_profile_id=v_market.id
         and p_date>=t.effective_from and (t.effective_to is null or p_date<=t.effective_to);
      if v_profile.id is null then
        v_skipped:=v_skipped+1;
        v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
          'daily_sales_item_id',v_item.id,'sales_channel_code',v_channel,
          'quantity',v_quantity,'status','tax_profile_missing'));
        continue;
      end if;

      select * into v_override from public.menu_tax_overrides o
       where o.recipe_id=v_item.recipe_id and o.tax_profile_id=v_profile.id;
      v_category:=null;
      if v_override.recipe_id is not null and v_override.tax_category is not null then
        v_category:=v_override.tax_category;
        select c.treatment into v_treatment from public.tax_category_catalog c
         where c.tax_profile_id=v_profile.id and c.code=v_category and c.active;
      elsif v_override.recipe_id is not null then
        v_treatment:=v_override.treatment;
      else
        v_treatment:=v_profile.default_treatment;
      end if;
      if v_treatment is null then
        raise exception 'shadow 대조의 메뉴 과세 상태를 확정할 수 없어요'
          using errcode='45013', detail='TAX_TREATMENT_NOT_AVAILABLE';
      end if;

      select count(*) into v_expected from public.store_tax_components c where c.tax_profile_id=v_profile.id;
      select count(*) into v_joined
        from public.store_tax_components c join public.channel_tax_remittance r
          on r.tax_component_id=c.id and r.store_id=c.store_id and r.sales_channel_code=v_channel
       where c.tax_profile_id=v_profile.id;
      if v_expected=0 or v_expected<>v_joined then
        raise exception 'shadow 대조의 세금 프로필이 완결되지 않았어요'
          using errcode='45013', detail='TAX_PROFILE_INCOMPLETE';
      end if;
      select jsonb_agg(jsonb_build_object(
               'component_id',c.id,'kind',c.kind,'name',c.name,'rate_pct',c.rate_pct,
               'jurisdiction_level',c.jurisdiction_level,'calculation_basis',c.calculation_basis,
               'applies_to_treatments',to_jsonb(c.applies_to_treatments),
               'remittance_owner',r.remittance_owner) order by c.id)
        into v_components
        from public.store_tax_components c join public.channel_tax_remittance r
          on r.tax_component_id=c.id and r.store_id=c.store_id and r.sales_channel_code=v_channel
       where c.tax_profile_id=v_profile.id;
      v_quote:=public.calculate_international_tax(
        v_market.price_basis,public.international_currency_minor_unit(v_market.currency_code),
        v_treatment,v_item.unit_price*v_quantity,v_components);
      v_legacy:=coalesce(v_item.unit_tax,0)*v_quantity;
      v_legacy_total:=v_legacy_total+v_legacy;
      v_international_total:=v_international_total+(v_quote->>'tax_total')::numeric;
      v_comparable:=v_comparable+1;
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'daily_sales_item_id',v_item.id,'recipe_id',v_item.recipe_id,
        'sales_channel_code',v_channel,'quantity',v_quantity,'status','compared',
        'market_profile_id',v_market.id,'tax_profile_id',v_profile.id,
        'legacy_tax_total',v_legacy,'international_tax_total',(v_quote->>'tax_total')::numeric,
        'delta',(v_quote->>'tax_total')::numeric-v_legacy));
    end loop;
  end loop;
  return jsonb_build_object(
    'store_id',p_store,'sale_date',p_date,
    'status',case when v_skipped=0 then 'complete' when v_comparable=0 then 'not_comparable' else 'partial' end,
    'comparable_lines',v_comparable,'skipped_lines',v_skipped,
    'legacy_tax_total',v_legacy_total,'international_tax_total',v_international_total,
    'delta',v_international_total-v_legacy_total,'lines',v_lines);
end
$$;

revoke execute on function public.international_tax_shadow_compare(uuid,date)
  from public, anon, authenticated, margincook_rpc_executor;
grant execute on function public.international_tax_shadow_compare(uuid,date) to service_role;

comment on function public.international_tax_shadow_compare(uuid,date) is
  'INTL-1F 스테이징 shadow read. legacy unit_tax와 국제 공식 결과만 반환하며 업무 테이블·snapshot·이벤트를 쓰지 않는다.';

do $verify$
declare v text;
begin
  if has_function_privilege('anon','public.international_tax_shadow_compare(uuid,date)','execute')
     or has_function_privilege('authenticated','public.international_tax_shadow_compare(uuid,date)','execute')
     or has_function_privilege('margincook_rpc_executor','public.international_tax_shadow_compare(uuid,date)','execute')
     or not has_function_privilege('service_role','public.international_tax_shadow_compare(uuid,date)','execute') then
    raise exception '0185: shadow 대조 함수 권한이 맞지 않습니다';
  end if;
  v:=lower(pg_get_functiondef('public.international_tax_shadow_compare(uuid,date)'::regprocedure));
  if v ~ '\m(insert|update|delete|truncate)\M' then
    raise exception '0185: shadow 대조 함수가 업무 데이터를 쓸 수 있습니다';
  end if;
  if (public.app_capabilities()#>>'{international_tax,write_enabled}')::boolean then
    raise exception '0185: shadow 단계에서 국제 세금 쓰기를 켰습니다';
  end if;
end
$verify$;

commit;
