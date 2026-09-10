-- F4-3: current quote and reserved editing metadata have different time bases.
-- Run under _prelude.sql in a disposable fresh DB. All fixture changes roll back.

do $profile_date_parity$
declare
  v_basis public.tax_price_basis;
  v_date date:=public.store_local_date(pg_temp.store());
  v_effective date;
  v_recipe uuid;
  v_market uuid;
  v_p0 uuid;
  v_p1 uuid;
  v_component uuid;
  v_save jsonb;
  v_baseline jsonb;
  v_state jsonb;
  v_current jsonb;
  v_boundary jsonb;
  v_list record;
  v_before_list record;
  v_tax numeric;
  v_net numeric;
  v_customer numeric;
  v_next_tax numeric;
  v_next_net numeric;
  v_next_customer numeric;
begin
  foreach v_basis in array array['tax_inclusive','tax_exclusive']::public.tax_price_basis[] loop
    perform pg_temp.clear_international_tax_fixture();
    execute 'reset role';
    select id into strict v_recipe from public.recipes
      where store_id=pg_temp.store() and name='제육볶음' and price=12000;
    v_state:=public.recipe_tax_app_state(pg_temp.store(),v_recipe);
    perform pg_temp.ok(v_basis||': 프로필이 없으면 현재 quote를 추정하지 않는다',
      v_state->'quote'='null'::jsonb);

    insert into public.store_market_profiles(
      store_id,country_code,currency_code,business_locale_code,price_basis,effective_from)
    values(pg_temp.store(),'KR','KRW','ko-KR',v_basis,v_date) returning id into v_market;
    insert into public.store_tax_profiles(store_id,market_profile_id,default_treatment,effective_from)
    values(pg_temp.store(),v_market,'taxable',v_date) returning id into v_p0;
    -- 0187 initializes the activation boundary when the first tax profile is inserted.
    perform pg_temp.ok(v_basis||': 서버 현지 날짜에 활성 경계가 초기화된다',
      exists(select 1 from public.international_tax_activation_boundaries
        where store_id=pg_temp.store() and activation_date=v_date));
    insert into public.store_tax_components(
      store_id,tax_profile_id,config_key,kind,name,rate_pct,jurisdiction_level,
      calculation_basis,applies_to_treatments,sort_order)
    values(pg_temp.store(),v_p0,'primary','primary','VAT',10,'national',
      'primary_tax_exclusive',array['taxable'::public.tax_treatment],0) returning id into v_component;
    insert into public.channel_tax_remittance(store_id,tax_component_id,sales_channel_code,remittance_owner)
    values(pg_temp.store(),v_component,'hall','merchant'),
          (pg_temp.store(),v_component,'delivery','merchant'),
          (pg_temp.store(),v_component,'takeout','merchant');
    insert into public.tax_category_catalog(store_id,tax_profile_id,code,name,treatment,active)
    values(pg_temp.store(),v_p0,'standard','현재 분류','taxable',true);

    v_tax:=case when v_basis='tax_inclusive' then 1091 else 1200 end;
    v_net:=case when v_basis='tax_inclusive' then 10909 else 12000 end;
    v_customer:=case when v_basis='tax_inclusive' then 12000 else 13200 end;
    v_next_tax:=case when v_basis='tax_inclusive' then 2000 else 2400 end;
    v_next_net:=case when v_basis='tax_inclusive' then 10000 else 12000 end;
    v_next_customer:=case when v_basis='tax_inclusive' then 12000 else 14400 end;
    v_baseline:=public.current_recipe_tax_quote(v_recipe,v_date);
    v_state:=public.recipe_tax_app_state(pg_temp.store(),v_recipe);
    select * into strict v_before_list from public.recipe_list(pg_temp.store()) where id=v_recipe;
    perform pg_temp.ok(v_basis||': KRW 현재 세금·순매출·고객 결제액과 상세·목록이 일치한다',
      (v_baseline->>'tax_total')::numeric=v_tax and (v_baseline->>'net_sales')::numeric=v_net
      and (v_baseline->>'customer_total')::numeric=v_customer
      and v_state->'quote'=v_baseline and v_before_list.tax=v_tax);

    -- 20% is a synthetic boundary fixture, not a statutory rate change.
    perform set_config('request.headers','{"x-margincook-app-version":"0.2.0"}',true);
    execute 'set local role margincook_rpc_executor';
    v_save:=public.save_store_tax_profile(pg_temp.store(),jsonb_build_object(
      'default_treatment','taxable',
      'components',jsonb_build_array(jsonb_build_object(
        'key','primary','kind','primary','name','VAT','rate_pct',20,
        'jurisdiction_level','national','calculation_basis','primary_tax_exclusive',
        'applies_to_treatments',jsonb_build_array('taxable'),'sort_order',0,
        'remittance',jsonb_build_object('hall','merchant','delivery','merchant','takeout','merchant'))),
      'categories',jsonb_build_array(jsonb_build_object(
        'code','standard','name','예약 분류','treatment','taxable','active',true))),v_p0,1);
    execute 'reset role';
    v_p1:=(v_save->>'profile_id')::uuid;
    v_effective:=(v_save->>'effective_from')::date;
    perform pg_temp.ok(v_basis||': 실제 저장은 같은 시장의 다음 미개장일에 P1을 예약한다',
      (v_save->>'changed')::boolean and v_effective>v_date and v_p1<>v_p0
      and (select effective_to=v_effective-1 and market_profile_id=v_market
        from public.store_tax_profiles where id=v_p0)
      and (select effective_from=v_effective and effective_to is null and market_profile_id=v_market
        from public.store_tax_profiles where id=v_p1));

    v_current:=public.current_recipe_tax_quote(v_recipe,v_date);
    v_state:=public.recipe_tax_app_state(pg_temp.store(),v_recipe);
    select * into strict v_list from public.recipe_list(pg_temp.store()) where id=v_recipe;
    perform pg_temp.ok(v_basis||': 예약 후 오늘 상세 quote는 P0의 내부 quote·목록과 일치한다',
      v_current=v_baseline and v_state->'quote'=v_current
      and v_list.tax=v_before_list.tax and v_list.profit=v_before_list.profit);
    perform pg_temp.ok(v_basis||': F-1은 P0 quote를 보존한다',
      public.recipe_tax_quote_for_price(v_recipe,v_effective-1,12000)=v_baseline);
    v_boundary:=public.recipe_tax_quote_for_price(v_recipe,v_effective,12000);
    perform pg_temp.ok(v_basis||': F부터 P1의 세금·순매출·고객 결제액을 사용한다',
      (v_boundary->>'tax_total')::numeric=v_next_tax
      and (v_boundary->>'net_sales')::numeric=v_next_net
      and (v_boundary->>'customer_total')::numeric=v_next_customer);
    perform pg_temp.ok(v_basis||': 예약 편집 ID·판본·분류와 시장 metadata는 P1을 유지한다',
      (v_state->>'tax_profile_id')::uuid=v_p1
      and (v_state->>'tax_profile_revision')::integer=(v_save->>'revision')::integer
      and v_state->'categories'=jsonb_build_array(jsonb_build_object(
        'code','standard','name','예약 분류','treatment','taxable'))
      and v_state->>'currency_code'='KRW' and (v_state->>'minor_unit')::integer=0
      and v_state->>'price_basis'=v_basis::text);
    execute 'set local role margincook_rpc_executor';
  end loop;
end
$profile_date_parity$;

do $scope_and_acl$
begin
  perform pg_temp.raises('상세 quote도 다른 매장 또는 없는 레시피를 허용하지 않는다',format(
    'select public.recipe_tax_app_state(%L::uuid,%L::uuid)',pg_temp.store(),gen_random_uuid()),'42501');
  perform pg_temp.ok('내부 날짜별 quote의 앱 직접 호출 권한은 열리지 않는다',
    not has_function_privilege('authenticated','public.current_recipe_tax_quote(uuid,date)','execute')
    and not has_function_privilege('authenticated','public.recipe_tax_quote_for_price(uuid,date,numeric)','execute'));
end
$scope_and_acl$;
