-- 0183 · INTL-1E Opus 검토 보완
-- 판매 시점 단가는 snapshot만 읽고, 시장/세금 프로필의 활성 기준을 모든 facade에서 통일한다.

create or replace function public.international_tax_app_state(p_store uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_market public.store_market_profiles%rowtype;
  v_tax public.store_tax_profiles%rowtype;
  v_audit public.international_tax_migration_audits%rowtype;
begin
  perform public.assert_my_store(p_store);
  select * into v_audit from public.international_tax_migration_audits where store_id=p_store;
  select * into v_market from public.store_market_profiles
   where store_id=p_store and effective_to is null order by effective_from desc limit 1;
  if v_market.id is not null then
    select * into v_tax from public.store_tax_profiles
     where store_id=p_store and market_profile_id=v_market.id and effective_to is null
     order by effective_from desc limit 1;
  end if;

  return jsonb_build_object(
    'capabilities',public.app_capabilities(),
    'local_date',public.store_local_date(p_store),
    'onboarding_status',case
      when v_market.id is not null and v_tax.id is not null then 'profile_ready'
      when v_market.id is not null then 'tax_profile_required'
      when v_audit.decision='manual_review_required' then 'manual_review_required'
      else 'country_confirmation_required' end,
    'migration',case when v_audit.id is null then null else jsonb_build_object(
      'decision',v_audit.decision,'reason_codes',v_audit.reason_codes,
      'future_effective_from',v_audit.future_effective_from) end,
    'market_profile',case when v_market.id is null then null else jsonb_build_object(
      'id',v_market.id,'store_id',v_market.store_id,
      'country_code',v_market.country_code,'region_code',v_market.region_code,
      'currency_code',v_market.currency_code,'business_locale_code',v_market.business_locale_code,
      'price_basis',v_market.price_basis,'effective_from',v_market.effective_from,
      'effective_to',v_market.effective_to,'revision',v_market.revision) end,
    'tax_profile',case when v_tax.id is null then null else jsonb_build_object(
      'id',v_tax.id,'store_id',v_tax.store_id,'market_profile_id',v_tax.market_profile_id,
      'default_treatment',v_tax.default_treatment,'effective_from',v_tax.effective_from,
      'effective_to',v_tax.effective_to,'revision',v_tax.revision,
      'components',coalesce((select jsonb_agg(jsonb_build_object(
        'id',c.id,'kind',c.kind,'name',c.name,'rate_pct',c.rate_pct,
        'jurisdiction_level',c.jurisdiction_level,'calculation_basis',c.calculation_basis,
        'applies_to_treatments',c.applies_to_treatments,'sort_order',c.sort_order)
        order by c.sort_order,c.id) from public.store_tax_components c where c.tax_profile_id=v_tax.id),'[]'::jsonb),
      'categories',coalesce((select jsonb_agg(jsonb_build_object(
        'code',c.code,'name',c.name,'treatment',c.treatment,'active',c.active) order by c.code)
        from public.tax_category_catalog c where c.tax_profile_id=v_tax.id),'[]'::jsonb),
      'remittance',coalesce((select jsonb_agg(jsonb_build_object(
        'tax_component_id',r.tax_component_id,'sales_channel_code',r.sales_channel_code,
        'remittance_owner',r.remittance_owner) order by r.tax_component_id,r.sales_channel_code)
        from public.channel_tax_remittance r where r.store_id=p_store
          and exists(select 1 from public.store_tax_components c where c.id=r.tax_component_id and c.tax_profile_id=v_tax.id)),'[]'::jsonb)
    ) end
  );
end
$$;

create or replace function public.recipe_tax_app_state(p_store uuid, p_recipe uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_market uuid;
  v_tax uuid;
  v_override public.menu_tax_overrides%rowtype;
begin
  perform public.assert_my_store(p_store);
  if not exists(select 1 from public.recipes where id=p_recipe and store_id=p_store) then
    raise exception '이 매장의 메뉴가 아니에요' using errcode='42501', detail='STORE_SCOPE_MISMATCH';
  end if;
  select id into v_market from public.store_market_profiles
   where store_id=p_store and effective_to is null order by effective_from desc limit 1;
  if v_market is not null then
    select id into v_tax from public.store_tax_profiles
     where store_id=p_store and market_profile_id=v_market and effective_to is null
     order by effective_from desc limit 1;
  end if;
  if v_tax is not null then
    select * into v_override from public.menu_tax_overrides
     where recipe_id=p_recipe and tax_profile_id=v_tax;
  end if;
  return jsonb_build_object(
    'capabilities',public.app_capabilities(),
    'tax_profile_id',v_tax,
    'tax_category',v_override.tax_category,
    'treatment',v_override.treatment,
    'categories',coalesce((select jsonb_agg(jsonb_build_object(
      'code',c.code,'name',c.name,'treatment',c.treatment) order by c.code)
      from public.tax_category_catalog c where c.tax_profile_id=v_tax and c.active),'[]'::jsonb)
  );
end
$$;

create or replace function public.sales_tax_app_detail(p_store uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.assert_my_store(p_store);
  if p_from is null or p_to is null or p_from > p_to then
    raise exception using errcode='22000', message='판매 세금 조회 기간이 올바르지 않아요', detail='INVALID_DATE_RANGE';
  end if;
  return jsonb_build_object(
    'capabilities',public.app_capabilities(),
    'from',p_from,
    'to',p_to,
    'lines',coalesce((select jsonb_agg(jsonb_build_object(
      'daily_sales_item_id',s.daily_sales_item_id,'recipe_id',i.recipe_id,'menu_name',i.menu_name,
      'sale_date',d.sale_date,
      'unit_price',s.unit_price,
      'sales_channel_code',s.sales_channel_code,'country_code',s.country_code,
      'region_code',s.region_code,'currency_code',s.currency_code,'minor_unit',s.minor_unit,
      'price_basis',s.price_basis,'treatment',s.treatment,'tax_category',s.tax_category,
      'market_profile_id',s.market_profile_id,'market_profile_revision',s.market_profile_revision,
      'tax_profile_id',s.tax_profile_id,'tax_profile_revision',s.tax_profile_revision,
      'calculation_version',s.calculation_version,'final_quantity',s.final_quantity,
      'listed_total',s.listed_total,'net_sales',s.net_sales,'customer_total',s.customer_total,
      'tax_total',s.tax_total,'merchant_tax_liability',s.merchant_tax_liability,
      'marketplace_tax_liability',s.marketplace_tax_liability,
      'components',coalesce((select jsonb_agg(jsonb_build_object(
        'component_id',c.component_id_snapshot,'kind',c.kind,'name',c.name,
        'rate_pct',c.rate_pct,'jurisdiction_level',c.jurisdiction_level,
        'calculation_basis',c.calculation_basis,'applies_to_treatments',c.applies_to_treatments,
        'remittance_owner',c.remittance_owner,'unrounded_amount',c.unrounded_amount,
        'rounded_amount',c.rounded_amount) order by c.id)
        from public.daily_sales_item_tax_component_snapshots c where c.sales_tax_snapshot_id=s.id),'[]'::jsonb)
      ) order by d.sale_date,i.menu_name,s.sales_channel_code)
      from public.daily_sales_item_tax_snapshots s
      join public.daily_sales_items i on i.id=s.daily_sales_item_id and i.store_id=s.store_id
      join public.daily_sales d on d.id=i.daily_sales_id and d.store_id=i.store_id
      where s.store_id=p_store and d.sale_date between p_from and p_to),'[]'::jsonb)
  );
end
$$;

comment on function public.international_tax_app_state(uuid) is
  'INTL-1E 앱 읽기 facade. 활성 시장 프로필은 있지만 세금 프로필이 없으면 tax_profile_required를 반환한다.';
comment on function public.recipe_tax_app_state(uuid,uuid) is
  'INTL-1E 메뉴 읽기 facade. 앱 상태와 같은 활성 시장 프로필에 속한 세금 프로필만 읽는다.';
comment on function public.sales_tax_app_detail(uuid,date,date) is
  'INTL-1E 판매 시점 국제 세금 snapshot 조회. 기간·매장 경계를 검사하고 snapshot 단가와 구성별 확정 세액만 반환한다.';

do $verify$
declare v text;
begin
  v:=lower(pg_get_functiondef('public.sales_tax_app_detail(uuid,date,date)'::regprocedure));
  if position('''unit_price'',s.unit_price' in v)=0 then
    raise exception '0183: 판매 상세가 snapshot 단가를 읽지 않습니다';
  end if;
  v:=lower(pg_get_functiondef('public.recipe_tax_app_state(uuid,uuid)'::regprocedure));
  if position('market_profile_id=v_market' in v)=0 then
    raise exception '0183: 메뉴 과세 facade가 활성 시장 프로필 경계를 확인하지 않습니다';
  end if;
  v:=lower(pg_get_functiondef('public.international_tax_app_state(uuid)'::regprocedure));
  if position('tax_profile_required' in v)=0 then
    raise exception '0183: 세금 프로필 누락 상태가 구분되지 않습니다';
  end if;
end
$verify$;
