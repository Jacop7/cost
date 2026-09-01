-- ═════════════════════════════════════════════════════════
-- 49 · 세금 미포함가는 세금을 또 빼지 않고 확정 순매출로 손익을 계산한다
-- ════════════════════════════════════════════════════════

select pg_temp.clear_international_tax_fixture();

do $exclusive_profit$
declare
  v_date date:=pg_temp.today();
  v_day uuid;
  v_recipe uuid:=gen_random_uuid();
  v_market uuid;
  v_profile uuid;
  v_component uuid;
  v_result jsonb;
  v_before jsonb;
  v_after jsonb;
  v_detail jsonb;
  v_range jsonb;
  v_basis jsonb;
  v_audit jsonb;
  v_fixed_rate numeric;
begin
  execute 'reset role';
  insert into public.store_market_profiles(
    store_id,country_code,region_code,currency_code,business_locale_code,price_basis,effective_from)
  values(pg_temp.store(),'US','US-CA','USD','en-US','tax_exclusive',v_date)
  returning id into v_market;
  insert into public.international_tax_activation_boundaries(
    store_id,activation_date,minimum_app_version,reason)
  values(pg_temp.store(),v_date,'0.2.0','release_cutover');
  insert into public.store_tax_profiles(
    store_id,market_profile_id,default_treatment,effective_from)
  values(pg_temp.store(),v_market,'taxable',v_date) returning id into v_profile;
  insert into public.store_tax_components(
    store_id,tax_profile_id,config_key,kind,name,rate_pct,jurisdiction_level,
    calculation_basis,applies_to_treatments)
  values(pg_temp.store(),v_profile,'primary','primary','Sales tax',10,'state',
    'primary_tax_exclusive',array['taxable'::public.tax_treatment]) returning id into v_component;
  insert into public.channel_tax_remittance(
    store_id,tax_component_id,sales_channel_code,remittance_owner)
  values(pg_temp.store(),v_component,'hall','merchant'),
        (pg_temp.store(),v_component,'delivery','merchant'),
        (pg_temp.store(),v_component,'takeout','merchant');

  insert into public.recipes(id,store_id,name,price,base_servings,target_profit_rate,active)
  values(v_recipe,pg_temp.store(),'49 미포함가 메뉴',10,1,30,true);

  execute 'set local role margincook_rpc_executor';
  perform pg_temp.open_today();
  select id into v_day from public.business_days
   where store_id=pg_temp.store() and business_date=v_date;
  -- 이미 열린 영업일에 새 메뉴를 더하는 정식 경로를 탄다.
  v_before:=public.sales_summary(pg_temp.store(),v_date,v_date);
  v_result:=public.e10_sale_recorded(pg_temp.store(),v_date,v_recipe,1,0,0,0,false);
  v_after:=public.sales_summary(pg_temp.store(),v_date,v_date);
  v_detail:=public.day_menu_detail(pg_temp.store(),v_date,v_recipe);
  v_range:=public.range_menu_detail(pg_temp.store(),v_date,v_date,v_recipe);
  select coalesce(public.day_fixed_rate(pg_temp.store(),v_date),0) into v_fixed_rate;
  select value into v_basis from jsonb_array_elements(public.day_menu_basis(pg_temp.store(),v_date))
   where value->>'recipe_id'=v_recipe::text;

  perform pg_temp.eq('세금 미포함 10.00의 확정 세금은 1.00이다',
    (v_result->>'unit_tax')::numeric,1,0.000001);
  perform pg_temp.ok('영업일 snapshot은 listed 10 · net 10 · customer 11을 같이 굳힌다',
    (select (snapshot#>>array['recipes',v_recipe::text,'net_sales'])::numeric=10
       and (snapshot#>>array['recipes',v_recipe::text,'customer_total'])::numeric=11
       and (snapshot#>>array['recipes',v_recipe::text,'tax'])::numeric=1
      from public.business_days where id=v_day));
  perform pg_temp.eq('세금 미포함가 판매는 세금을 중복 차감하지 않는다',
    (v_after->>'profit')::numeric-(v_before->>'profit')::numeric,
    10-v_fixed_rate*10,0.000001);
  perform pg_temp.ok('일 메뉴 상세도 순매출·고객 결제액·세금을 구분한다',
    (v_detail->>'net_sales')::numeric=10
    and (v_detail->>'customer_total')::numeric=11
    and (v_detail->>'tax')::numeric=1
    and (v_detail->>'profit')::numeric=10-v_fixed_rate*10);
  perform pg_temp.ok('기간 메뉴 손익도 확정 순매출을 쓴다',
    (v_range->>'revenue')::numeric=10
    and (v_range->>'tax')::numeric=1
    and (v_range->>'profit')::numeric=10-v_fixed_rate*10);
  perform pg_temp.ok('판매 기준 카드도 미포함가를 순매출로 다시 빼지 않는다',
    (v_basis->>'tax')::numeric=1
    and (v_basis->>'profit')::numeric=10-v_fixed_rate*10);

  perform public.save_recipe(pg_temp.store(),jsonb_build_object(
    'id',v_recipe,'name','49 미포함가 메뉴','price',20,'base_servings',1,
    'target_profit_rate',30,'active',true));
  select x into v_audit
    from public.entity_change_events e
    cross join lateral jsonb_array_elements(e.changes) x
   where e.entity_id=v_recipe and x->>'key'='profit'
   order by e.occurred_at desc,e.id desc limit 1;
  perform pg_temp.eq('레시피 수정 감사도 세금 미포함가에서 세금을 중복 차감하지 않는다',
    (v_audit->>'after')::numeric,20-v_fixed_rate*20,0.000001);
end
$exclusive_profit$;

do $acl$
begin
  perform pg_temp.ok('회계 합계 도우미는 앱 롤에 직접 열리지 않는다',
    not has_function_privilege('authenticated','public.sales_item_accounting_totals(uuid)','execute')
    and not has_function_privilege('authenticated','public.daily_sales_etc_accounting_totals(uuid)','execute'));
  perform pg_temp.ok('입고·취소·고정지출 변경 이력도 국제 순매출 quote를 쓴다',
    position('recipe_tax_quote_for_price' in pg_get_functiondef(
      'public.e1_confirm_inbound(uuid,numeric,text,date)'::regprocedure))>0
    and position('recipe_tax_quote_for_price' in pg_get_functiondef(
      'public.e11_inbound_reverted(uuid,text)'::regprocedure))>0
    and position('current_recipe_tax_quote' in pg_get_functiondef(
      'public.e4_fixed_cost_saved(uuid,text,numeric)'::regprocedure))>0);
end
$acl$;
