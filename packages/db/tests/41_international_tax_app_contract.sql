-- ═══════════════════════════════════════════════════════════════
-- 41 · INTL-1E 앱 계약·사용자별 언어·상세 facade
-- ═══════════════════════════════════════════════════════════════

select pg_temp.clear_international_tax_fixture();

do $preferences$
declare v jsonb; v_rev integer; v_stamp timestamptz;
begin
  v := get_user_preferences();
  perform pg_temp.ok('사용자 언어는 매장 설정과 별도 판본으로 응답한다',
    v ? 'app_language' and v ? 'needs_confirmation' and v ? 'source_locale'
    and (v->>'revision')::integer >= 1);
  v_rev := (v->>'revision')::integer;

  v := save_app_language('en',v_rev);
  perform pg_temp.ok('앱 언어 저장은 사용자 판본만 올린다',
    (v->>'changed')::boolean and v->>'app_language'='en'
    and (v->>'revision')::integer=v_rev+1
    and (select locale from settings where store_id=pg_temp.store())='ko');
  v_rev := (v->>'revision')::integer;
  execute 'reset role';
  v_stamp := (select updated_at from user_preferences where user_id=pg_temp.owner());
  execute 'set local role margincook_rpc_executor';
  v := save_app_language('en',v_rev);
  execute 'reset role';
  perform pg_temp.ok('같은 언어 재저장은 판본·시각을 올리지 않는다',
    not (v->>'changed')::boolean and (v->>'revision')::integer=v_rev
    and (select updated_at from user_preferences where user_id=pg_temp.owner())=v_stamp);
  execute 'set local role margincook_rpc_executor';
  perform pg_temp.raises('낡은 사용자 언어 판본은 거부한다',
    format('select save_app_language(''ko'',%s)',v_rev-1),'45009');
  perform pg_temp.raises('지원하지 않는 앱 언어를 조용히 영어로 바꾸지 않는다',
    format('select save_app_language(''ja'',%s)',v_rev),'22000');
end
$preferences$;

do $facades$
declare
  v jsonb; v_recipe uuid:=pg_temp.rcp('제육볶음'); v_other uuid;
  v_market uuid; v_tax uuid; v_primary uuid; v_from date; v_sale_date date; v_item uuid;
begin
  v := international_tax_app_state(pg_temp.store());
  perform pg_temp.ok('앱 상태는 활성 capability와 이관·프로필 계약을 함께 준다',
    v ? 'capabilities' and v ? 'migration' and v ? 'market_profile' and v ? 'tax_profile'
    and (v#>>'{capabilities,international_tax,read_enabled}')::boolean
    and (v#>>'{capabilities,international_tax,write_enabled}')::boolean);
  perform pg_temp.ok('마이그레이션 뒤 신규 매장은 프로필을 지어내지 않고 국가 확인을 요구한다',
    v->>'onboarding_status'='country_confirmation_required'
    and v->'market_profile'='null'::jsonb and v->'tax_profile'='null'::jsonb);

  execute 'reset role';
  select min(sale_date) into v_from from daily_sales where store_id=pg_temp.store();
  insert into store_market_profiles(store_id,country_code,currency_code,business_locale_code,price_basis,effective_from)
  values(pg_temp.store(),'KR','KRW','ko-KR','tax_inclusive',v_from) returning id into v_market;
  execute 'set local role margincook_rpc_executor';
  v := international_tax_app_state(pg_temp.store());
  perform pg_temp.ok('국가가 확정됐지만 세금 프로필이 없으면 국가 재확인이 아니라 세금 설정을 요구한다',
    v->>'onboarding_status'='tax_profile_required'
    and v->'market_profile'<>'null'::jsonb and v->'tax_profile'='null'::jsonb);
  execute 'reset role';
  insert into store_tax_profiles(store_id,market_profile_id,default_treatment,effective_from)
  values(pg_temp.store(),v_market,'taxable',v_from) returning id into v_tax;
  insert into store_tax_components(store_id,tax_profile_id,config_key,kind,name,rate_pct,jurisdiction_level,calculation_basis,applies_to_treatments)
  values(pg_temp.store(),v_tax,'primary','primary','부가세',10,'national','primary_tax_exclusive',array['taxable'::tax_treatment])
  returning id into v_primary;
  insert into tax_category_catalog(store_id,tax_profile_id,code,name,treatment) values
    (pg_temp.store(),v_tax,'standard','일반 과세','taxable'),
    (pg_temp.store(),v_tax,'zero_rated','0% 과세','zero_rated'),
    (pg_temp.store(),v_tax,'exempt','면세','exempt');
  insert into channel_tax_remittance(store_id,tax_component_id,sales_channel_code,remittance_owner) values
    (pg_temp.store(),v_primary,'hall','merchant'),
    (pg_temp.store(),v_primary,'delivery','merchant'),
    (pg_temp.store(),v_primary,'takeout','merchant');
  select i.id,d.sale_date into v_item,v_sale_date
    from daily_sales_items i join daily_sales d on d.id=i.daily_sales_id
   where i.store_id=pg_temp.store() order by d.sale_date,i.id limit 1;
  perform set_config('margincook.international_tax_force','owner_test',true);
  perform apply_international_tax_for_sales_item(v_item,true);
  update daily_sales_items set unit_price=unit_price+777 where id=v_item;
  execute 'set local role margincook_rpc_executor';

  v := international_tax_app_state(pg_temp.store());
  perform pg_temp.ok('프로필 준비 뒤에는 법정 세율 구성과 카테고리를 한 응답으로 읽는다',
    v->>'onboarding_status'='profile_ready'
    and (v#>>'{market_profile,store_id}')::uuid=pg_temp.store()
    and (v#>>'{tax_profile,store_id}')::uuid=pg_temp.store()
    and jsonb_array_length(v#>'{tax_profile,components}')=1
    and jsonb_array_length(v#>'{tax_profile,categories}')=3
    and jsonb_array_length(v#>'{tax_profile,remittance}')=3);

  v := recipe_tax_app_state(pg_temp.store(),v_recipe);
  perform pg_temp.ok('메뉴 과세 화면은 활성 프로필 카테고리를 같은 응답으로 읽는다',
    v ? 'tax_profile_id' and v ? 'tax_category' and v ? 'treatment'
    and jsonb_array_length(v->'categories')=3);

  set constraints all immediate;
  execute 'reset role';
  alter table store_market_profiles disable trigger store_market_profiles_20_children_guard;
  alter table store_market_profiles disable trigger store_market_profiles_90_version_guard;
  update store_market_profiles set effective_to=v_from where id=v_market;
  alter table store_market_profiles enable trigger store_market_profiles_90_version_guard;
  alter table store_market_profiles enable trigger store_market_profiles_20_children_guard;
  execute 'set local role margincook_rpc_executor';
  v := recipe_tax_app_state(pg_temp.store(),v_recipe);
  perform pg_temp.ok('닫힌 시장 프로필의 열린 세금 프로필을 메뉴 화면에 섞지 않는다',
    v->'tax_profile_id'='null'::jsonb and jsonb_array_length(v->'categories')=0);
  execute 'reset role';
  alter table store_market_profiles disable trigger store_market_profiles_20_children_guard;
  alter table store_market_profiles disable trigger store_market_profiles_90_version_guard;
  update store_market_profiles set effective_to=null where id=v_market;
  alter table store_market_profiles enable trigger store_market_profiles_90_version_guard;
  alter table store_market_profiles enable trigger store_market_profiles_20_children_guard;
  set constraints all deferred;
  execute 'set local role margincook_rpc_executor';

  v := sales_tax_app_detail(pg_temp.store(),pg_temp.today(),pg_temp.today());
  perform pg_temp.ok('capability 전에는 legacy 판매를 국제 구성으로 역산하지 않는다',
    v->>'from'=pg_temp.today()::text and v->>'to'=pg_temp.today()::text
    and jsonb_array_length(v->'lines')=0);

  v := sales_tax_app_detail(pg_temp.store(),v_sale_date,v_sale_date);
  perform pg_temp.ok('국제 판매 snapshot은 저장된 단가·프로필 판본·구성 세액을 그대로 준다',
    jsonb_array_length(v->'lines')>0
    and (v#>>'{lines,0,sale_date}')::date=v_sale_date
    and (v#>>'{lines,0,unit_price}')::numeric=(select unit_price from daily_sales_item_tax_snapshots
      where daily_sales_item_id=v_item and sales_channel_code::text=v#>>'{lines,0,sales_channel_code}')
    and (v#>>'{lines,0,unit_price}')::numeric<>(select unit_price from daily_sales_items where id=v_item)
    and (v#>>'{lines,0,tax_profile_revision}')::integer=1
    and jsonb_array_length(v#>'{lines,0,components}')=1);
  perform pg_temp.raises('판매 세금 상세는 뒤집힌 기간을 조용히 빈 결과로 만들지 않는다',
    format('select sales_tax_app_detail(%L::uuid,%L::date,%L::date)',
      pg_temp.store(),v_sale_date+1,v_sale_date),'22000');

  perform pg_temp.eq('미국 51개 1차 관할을 앱 facade가 그대로 읽는다',
    jsonb_array_length(international_tax_regions(pg_temp.store(),'US')),51,0);
  perform pg_temp.eq('캐나다 13개 1차 관할을 앱 facade가 그대로 읽는다',
    jsonb_array_length(international_tax_regions(pg_temp.store(),'CA')),13,0);

  v_other := pg_temp.new_owner();
  perform pg_temp.as_owner(v_other);
  perform pg_temp.raises('다른 사장님은 국제 세금 상태를 읽지 못한다',
    format('select international_tax_app_state(%L::uuid)',pg_temp.store()),'42501');
  perform pg_temp.as_owner(pg_temp.owner());
end
$facades$;

do $acl$
begin
  perform pg_temp.ok('사용자 선호 표는 앱 롤에 직접 열리지 않는다',
    not has_table_privilege('authenticated','public.user_preferences','select')
    and not has_table_privilege('authenticated','public.user_preferences','update'));
  perform pg_temp.ok('국제 앱 facade는 authenticated만 호출한다',
    has_function_privilege('authenticated','public.international_tax_app_state(uuid)','execute')
    and has_function_privilege('authenticated','public.sales_tax_app_detail(uuid,date,date)','execute')
    and not has_function_privilege('anon','public.international_tax_app_state(uuid)','execute'));
end
$acl$;
