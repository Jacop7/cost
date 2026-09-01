-- ═══════════════════════════════════════════════════════════════
-- 48 · INTL-1F 레시피 현재 손익·추이의 국제 세금 단일 권위
-- ═══════════════════════════════════════════════════════════════

select pg_temp.clear_international_tax_fixture();

do $recipe_profit$
declare
  v_date date:=pg_temp.today();
  v_recipe uuid;
  v_market uuid;
  v_tax_profile uuid;
  v_component uuid;
  v_quote jsonb;
  v_list record;
  v_trend record;
begin
  execute 'reset role';
  select id into v_recipe from public.recipes
   where store_id=pg_temp.store() and name='제육볶음';
  if v_recipe is null then raise exception '48: 제육볶음 픽스처가 없습니다'; end if;

  insert into public.store_market_profiles(
    store_id,country_code,currency_code,business_locale_code,price_basis,effective_from)
  values(pg_temp.store(),'KR','KRW','ko-KR','tax_inclusive',v_date)
  returning id into v_market;
  insert into public.international_tax_activation_boundaries(
    store_id,activation_date,minimum_app_version,reason)
  values(pg_temp.store(),v_date,'0.2.0','release_cutover');
  insert into public.store_tax_profiles(
    store_id,market_profile_id,default_treatment,effective_from)
  values(pg_temp.store(),v_market,'taxable',v_date) returning id into v_tax_profile;
  insert into public.store_tax_components(
    store_id,tax_profile_id,config_key,kind,name,rate_pct,jurisdiction_level,
    calculation_basis,applies_to_treatments)
  values(pg_temp.store(),v_tax_profile,'primary','primary','부가세',10,'national',
    'primary_tax_exclusive',array['taxable'::public.tax_treatment]) returning id into v_component;
  insert into public.channel_tax_remittance(
    store_id,tax_component_id,sales_channel_code,remittance_owner)
  values(pg_temp.store(),v_component,'hall','merchant');

  v_quote:=public.current_recipe_tax_quote(v_recipe,v_date);
  perform pg_temp.ok('포함가 12,000원의 법정 세율 10%를 DB가 1,091원으로 반올림한다',
    (v_quote->>'tax_total')::numeric=1091
    and (v_quote->>'net_sales')::numeric=10909);

  select * into v_list from public.recipe_list(pg_temp.store()) where id=v_recipe;
  perform pg_temp.eq('레시피 목록 세금은 국제 quote와 같다',v_list.tax,1091,0.000001);
  perform pg_temp.eq('레시피 목록 순이익은 국제 순매출 기준이다',v_list.profit,4046.60,0.000001);
  perform pg_temp.eq('레시피 목록 순이익률은 판매가 기준 33.72%다',v_list.profit_rate*100,33.7216667,0.0001);

  perform public.recompute_recipe(v_recipe,'tax',v_date,null);
  select * into v_trend from public.profit_trends
   where recipe_id=v_recipe and trend_date=v_date
   order by occurred_at desc,id desc limit 1;
  perform pg_temp.ok('손익 추이도 목록과 같은 국제 세금·순이익을 기록한다',
    v_trend.tax_amount=1091 and v_trend.profit_amount=4046.60
    and v_trend.profit_rate=33.72);

  execute 'set local role margincook_rpc_executor';
end
$recipe_profit$;

do $acl$
begin
  perform pg_temp.ok('현재 레시피 세금 계산 몸통은 앱 역할에 직접 열리지 않는다',
    not has_function_privilege('authenticated',
      'public.current_recipe_tax_quote(uuid,date)','execute'));
end
$acl$;
