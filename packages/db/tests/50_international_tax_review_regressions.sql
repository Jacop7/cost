-- ═══════════════════════════════════════════════════════════════
-- 50 · Opus cutover 검수 회귀 — 미활성 매장·과거 순매출·채널·메뉴 적용일
-- ═══════════════════════════════════════════════════════════════

select pg_temp.clear_international_tax_fixture();

do $unconfigured_store$
declare
  v_recipe uuid:=pg_temp.rcp('제육볶음');
  v_result jsonb;
begin
  execute 'set local role margincook_rpc_executor';
  perform pg_temp.open_today();
  v_result:=public.e10_sale_recorded(pg_temp.store(),pg_temp.today(),v_recipe,1,0,0,0,false);
  execute 'reset role';
  perform pg_temp.ok('국제 프로필을 아직 만들지 않은 신규 매장도 기존 판매를 저장한다',
    v_result is not null
    and exists(select 1 from public.daily_sales d join public.daily_sales_items i
      on i.daily_sales_id=d.id where d.store_id=pg_temp.store()
      and d.sale_date=pg_temp.today() and i.recipe_id=v_recipe and i.qty_hall=1)
    and not exists(select 1 from public.international_tax_activation_boundaries
      where store_id=pg_temp.store())
    and not exists(select 1 from public.daily_sales_item_tax_snapshots
      where store_id=pg_temp.store()));
end
$unconfigured_store$;

do $legacy_snapshot_net$
declare
  v_date date;
  v_recipe uuid;
  v_snap jsonb;
  v_row jsonb;
  v_price numeric;
  v_tax numeric;
  v_material numeric;
  v_extra numeric;
  v_rate numeric;
begin
  execute 'reset role';
  select d.business_date,(x.key)::uuid,d.snapshot
    into v_date,v_recipe,v_snap
    from public.business_days d
    cross join lateral jsonb_each(d.snapshot->'recipes') x
   where d.store_id=pg_temp.store() and x.value ? 'price' and x.value ? 'tax'
   order by d.business_date desc limit 1;
  if v_recipe is null then raise exception '50: 과거 snapshot 픽스처가 없습니다'; end if;
  v_price:=(v_snap#>>array['recipes',v_recipe::text,'price'])::numeric;
  v_tax:=(v_snap#>>array['recipes',v_recipe::text,'tax'])::numeric;
  v_material:=(v_snap#>>array['recipes',v_recipe::text,'material_cost'])::numeric;
  v_extra:=coalesce((v_snap#>>array['recipes',v_recipe::text,'extra_cost'])::numeric,0);
  update public.business_days
     set snapshot=snapshot #- array['recipes',v_recipe::text,'net_sales']
   where store_id=pg_temp.store() and business_date=v_date;
  update public.recipes set price=price+777 where id=v_recipe;
  execute 'set local role margincook_rpc_executor';
  select value into v_row from jsonb_array_elements(
    public.day_menu_basis(pg_temp.store(),v_date))
   where value->>'recipe_id'=v_recipe::text;
  v_rate:=coalesce(public.day_fixed_rate(pg_temp.store(),v_date),0);
  perform pg_temp.eq('0191 이전 snapshot은 그날 가격-그날 세금으로 순매출을 복원한다',
    (v_row->>'profit')::numeric,
    v_price-v_tax-v_material-v_extra-v_rate*v_price,0.000001);
end
$legacy_snapshot_net$;

select pg_temp.clear_international_tax_fixture();

do $legacy_etc_net$
declare
  v_sales uuid;
  v_totals jsonb;
begin
  perform pg_temp.open_today();
  select id into v_sales from public.daily_sales
   where store_id=pg_temp.store() and sale_date=pg_temp.today();
  if v_sales is null then raise exception '50: 기타매출 레거시 픽스처 장부가 없습니다'; end if;
  update public.daily_sales
     set etc_items='[{"name":"옛 기타매출","price":1000,"qty":1}]'::jsonb,
         etc_revenue=1000
   where id=v_sales;
  update public.daily_sales
     set etc_tax=90,etc_tax_snapshot=null,
         etc_tax_calculation_version='legacy_effective_rate_v1'
   where id=v_sales;
  v_totals:=public.daily_sales_etc_accounting_totals(v_sales);
  perform pg_temp.eq('국제 스냅샷 이전 기타매출은 옛 손익의 순매출 1000원을 보존한다',
    (v_totals->>'net_sales')::numeric,1000,0.000001);
  perform pg_temp.eq('옛 기타매출의 저장 세금 표시는 그대로 돌려준다',
    (v_totals->>'tax_total')::numeric,90,0.000001);
end
$legacy_etc_net$;

select pg_temp.clear_international_tax_fixture();

do $active_contract$
declare
  v_date date:=pg_temp.today();
  v_market uuid;
  v_profile uuid;
  v_component uuid;
  v_sales uuid;
  v_recipe uuid:=pg_temp.rcp('제육볶음');
  v_recipe_history uuid:=pg_temp.rcp('김치찌개');
  v_save jsonb;
  v_state jsonb;
  v_today jsonb;
  v_effective date;
  v_effective_quote jsonb;
begin
  execute 'reset role';
  insert into public.store_market_profiles(
    store_id,country_code,currency_code,business_locale_code,price_basis,effective_from)
  values(pg_temp.store(),'KR','KRW','ko-KR','tax_inclusive',v_date)
  returning id into v_market;
  insert into public.store_tax_profiles(store_id,market_profile_id,default_treatment,effective_from)
  values(pg_temp.store(),v_market,'taxable',v_date) returning id into v_profile;
  insert into public.store_tax_components(
    store_id,tax_profile_id,config_key,kind,name,rate_pct,jurisdiction_level,
    calculation_basis,applies_to_treatments)
  values(pg_temp.store(),v_profile,'primary','primary','부가세',10,'national',
    'primary_tax_exclusive',array['taxable'::public.tax_treatment]) returning id into v_component;
  insert into public.channel_tax_remittance(store_id,tax_component_id,sales_channel_code,remittance_owner)
  values(pg_temp.store(),v_component,'hall','merchant'),
        (pg_temp.store(),v_component,'delivery','merchant'),
        (pg_temp.store(),v_component,'takeout','merchant');
  insert into public.international_tax_activation_boundaries(
    store_id,activation_date,minimum_app_version,reason)
  values(pg_temp.store(),v_date,'0.2.0','release_cutover')
  on conflict (store_id) do nothing;
  perform pg_temp.open_today();
  select id into v_sales from public.daily_sales
   where store_id=pg_temp.store() and sale_date=v_date;
  perform pg_temp.raises('활성 경계 뒤 기타매출은 채널을 hall로 추정하지 않는다',format(
    'update public.daily_sales set etc_items=%L::jsonb,etc_revenue=1000 where id=%L::uuid',
    '[{"name":"채널 없음","price":1000,"qty":1}]',v_sales),'22000');

  perform set_config('margincook.international_tax_force','owner_test',true);
  perform set_config('request.headers','{"x-margincook-app-version":"0.2.0"}',true);
  v_today:=public.recipe_tax_quote_for_price(v_recipe,v_date,12000);
  v_save:=public.save_menu_tax_override(
    pg_temp.store(),v_recipe,v_profile,null,'exempt',0);
  v_state:=public.recipe_tax_app_state(pg_temp.store(),v_recipe);
  v_effective:=(v_save->>'effective_from')::date;
  v_effective_quote:=public.recipe_tax_quote_for_price(v_recipe,v_effective,12000);
  -- 별도 메뉴에는 판매일 전의 예외 이력 두 건을 미리 쌓는다. 첫 판매 스냅샷 뒤에는
  -- 프로필 자식이 봉인되므로 두 회귀를 같은 프로필·서로 다른 메뉴로 준비한다.
  insert into public.menu_tax_overrides(
    recipe_id,store_id,tax_profile_id,tax_category,treatment,effective_from,revision)
  values(v_recipe_history,pg_temp.store(),v_profile,null,'exempt',v_date-2,1),
        (v_recipe_history,pg_temp.store(),v_profile,null,'taxable',v_date-1,2);
  perform pg_temp.ok('메뉴 과세 예외는 열린 영업일을 바꾸지 않고 다음 미개장일에 적용한다',
    v_effective>v_date
    and (v_state->>'effective_from')::date=v_effective
    and (v_today->>'tax_total')::numeric>0
    and (public.recipe_tax_quote_for_price(v_recipe,v_date,12000)->>'tax_total')::numeric
      =(v_today->>'tax_total')::numeric
    and (v_effective_quote->>'tax_total')::numeric=0);
  perform public.e10_sale_recorded(pg_temp.store(),v_date,v_recipe,1,0,0,0,false);
  perform pg_temp.ok('미래 적용 메뉴 예외를 저장해도 오늘 판매와 세금 스냅샷을 막지 않는다',
    exists(select 1 from public.daily_sales_item_tax_snapshots s
      join public.daily_sales_items i on i.id=s.daily_sales_item_id
      where i.recipe_id=v_recipe and s.store_id=pg_temp.store()
        and s.treatment='taxable' and s.tax_total>0));
  perform public.e10_sale_recorded(pg_temp.store(),v_date,v_recipe_history,1,0,0,0,false);
  perform pg_temp.ok('메뉴 예외 이력이 둘 이상이어도 판매일의 마지막 행으로 스냅샷을 검증한다',
    exists(select 1 from public.daily_sales_item_tax_snapshots s
      join public.daily_sales_items i on i.id=s.daily_sales_item_id
      where i.recipe_id=v_recipe_history and s.store_id=pg_temp.store()
        and s.treatment='taxable' and s.tax_total>0));
end
$active_contract$;
