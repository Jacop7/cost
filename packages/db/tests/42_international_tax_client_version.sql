\echo '--- 42 국제 세금 클라이언트 판본 게이트 ---'

reset role;

do $t$
begin
  perform public.assert_write_app_version();
  perform pg_temp.ok('마이그레이션·시드용 postgres 직접 세션은 HTTP 헤더 없이 통과한다',true);

  perform pg_temp.ok('같은 판본을 허용한다', public.app_version_at_least('0.2.0','0.2.0'));
  perform pg_temp.ok('더 높은 major를 허용한다', public.app_version_at_least('1.0.0','0.9.99'));
  perform pg_temp.ok('더 높은 minor를 허용한다', public.app_version_at_least('0.10.0','0.9.99'));
  perform pg_temp.ok('낮은 판본을 거부한다', not public.app_version_at_least('0.1.9','0.2.0'));
  perform pg_temp.ok('부분·선행 0·prerelease 판본을 거부한다',
    not public.app_version_at_least('0.2','0.2.0')
    and not public.app_version_at_least('00.2.0','0.2.0')
    and not public.app_version_at_least('0.2.0-beta','0.2.0'));

  perform set_config('request.headers','{"x-margincook-app-version":"0.2.0"}',true);
  perform pg_temp.eq_t('PostgREST 헤더의 앱 판본을 읽는다', public.current_client_app_version(),'0.2.0');
  perform set_config('request.headers','{"x-margincook-app-version":"bad"}',true);
  perform pg_temp.ok('잘못된 헤더는 null로 실패 폐쇄 준비를 한다', public.current_client_app_version() is null);

  perform pg_temp.raises('제품 활성 뒤 헤더가 없거나 잘못된 HTTP 쓰기는 막힌다',
    'select public.assert_write_app_version()', '45016');
  perform set_config('request.headers','{"x-margincook-app-version":"0.1.0"}',true);
  perform pg_temp.raises('구 앱 쓰기는 45016으로 막힌다',
    'select public.assert_write_app_version()', '45016');
  perform set_config('request.headers','{"x-margincook-app-version":"0.2.0"}',true);
  perform public.assert_write_app_version();
  perform pg_temp.ok('최소 판본 앱 쓰기는 통과한다',true);
  perform set_config('request.headers','',true);

end
$t$;

set local role margincook_rpc_executor;
select pg_temp.ok('판본 내부 함수는 앱 역할에 열리지 않는다',
  not has_function_privilege('anon','public.current_client_app_version()','execute')
  and not has_function_privilege('authenticated','public.current_client_app_version()','execute')
  and not has_function_privilege('service_role','public.assert_write_app_version()','execute'));
