-- ═══════════════════════════════════════════════════════════════
-- 47 · INTL-1F 제품 활성 capability·매장 경계·구 앱 차단
-- ═══════════════════════════════════════════════════════════════

select pg_temp.clear_international_tax_fixture();

reset role;

do $capability$
declare v jsonb:=public.app_capabilities();v_market uuid;v_tax uuid;v_date date;
begin
  perform pg_temp.ok('국제 세금 읽기·쓰기와 최소 앱 판본을 한 번에 연다',
    v#>>'{minimum_supported_app_version}'='0.2.0'
    and (v#>>'{international_tax,read_enabled}')::boolean
    and (v#>>'{international_tax,write_enabled}')::boolean
    and v#>>'{international_tax,minimum_write_app_version}'='0.2.0');

  v_date:=public.next_unopened_business_date(pg_temp.store());
  insert into public.store_market_profiles(
    store_id,country_code,currency_code,business_locale_code,price_basis,effective_from)
  values(pg_temp.store(),'KR','KRW','ko-KR','tax_inclusive',v_date)
  returning id into v_market;
  insert into public.store_tax_profiles(store_id,market_profile_id,default_treatment,effective_from)
  values(pg_temp.store(),v_market,'taxable',v_date) returning id into v_tax;
  perform pg_temp.ok('활성 뒤 새 세금 프로필은 다음 미개장 영업일 경계를 자동 생성한다',
    exists(select 1 from public.international_tax_activation_boundaries b
      where b.store_id=pg_temp.store() and b.activation_date=v_date
        and b.minimum_app_version='0.2.0' and b.reason='profile_created_after_cutover'));

  perform set_config('request.headers','{"x-margincook-app-version":"0.1.0"}',true);
  perform pg_temp.raises('구 앱은 판매 저장 문을 통과하지 못한다',format(
    'select public.save_sale(%L::uuid,%L::date,''[]''::jsonb,null,null,null,false,null)',
    pg_temp.store(),pg_temp.today()),'45016');
  perform set_config('request.headers','{"x-margincook-app-version":"0.2.0"}',true);
  perform pg_temp.raises('새 앱도 옛 세금 설정 문으로 돌아가지 못한다',format(
    'select public.save_store_tax(%L::uuid,''included''::public.tax_mode,''[]''::jsonb,1)',
    pg_temp.store()),'45017');
  perform set_config('request.headers','',true);
end
$capability$;

do $structure$
declare v_fn text;
begin
  foreach v_fn in array array['save_sale','amend_ended_business_day','save_store_tax'] loop
    perform pg_temp.ok(v_fn||'가 앱 판본 문을 실제로 호출한다',position('assert_write_app_version' in
      lower((select pg_get_functiondef(p.oid) from pg_proc p
       where p.pronamespace='public'::regnamespace and p.proname=v_fn limit 1)))>0);
  end loop;
  perform pg_temp.ok('세금 상세 응답에 메뉴와 기타매출 배열이 모두 있다',
    position('''lines''' in lower(pg_get_functiondef(
      'public.sales_tax_app_detail(uuid,date,date)'::regprocedure)))>0
    and position('''etc_lines''' in lower(pg_get_functiondef(
      'public.sales_tax_app_detail(uuid,date,date)'::regprocedure)))>0);
end
$structure$;

set local role margincook_rpc_executor;
