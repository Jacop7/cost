-- 시스템 role·pg_cron을 검사하는 백색상자 계약이다. 앱 실행 role에는 cron schema 권한을 주지 않는다.
set local role postgres;

select pg_temp.eq(
  'Costkeep RPC 실행 role이 하나 있다',
  (select count(*)::integer from pg_roles where rolname = 'costkeep_rpc_executor'),
  1);
select pg_temp.eq(
  '이전 RPC 실행 role은 남지 않는다',
  (select count(*)::integer from pg_roles where rolname = 'margincook_rpc_executor'),
  0);
select pg_temp.ok(
  'Costkeep 실행 role은 login·bypass RLS 권한이 없다',
  not (select rolcanlogin or rolbypassrls from pg_roles where rolname = 'costkeep_rpc_executor'));
select pg_temp.ok(
  'postgres가 Costkeep 실행 role을 검증에 사용할 수 있다',
  pg_has_role('postgres', 'costkeep_rpc_executor', 'MEMBER'));
select pg_temp.eq(
  '묶음 단위 facade 세 함수가 고정 search_path를 사용한다',
  (select count(*)::integer
     from pg_proc p
    where p.oid in (
      'public.get_bundle_units(uuid)'::regprocedure,
      'public.save_bundle_unit(uuid,uuid,text,integer,integer,text)'::regprocedure,
      'public.delete_bundle_unit(uuid,uuid,integer)'::regprocedure)
      and coalesce(p.proconfig, '{}'::text[])
        @> array['search_path=public, pg_temp']),
  3);
select pg_temp.ok(
  '이전 식재료 목록 facade는 닫고 stock_tracking 포함 v2만 앱에 연다',
  not has_function_privilege('authenticated', 'public.ingredient_list(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.ingredient_list_v2(uuid)', 'EXECUTE'));

select pg_temp.ok(
  '앱 버전 헤더가 Costkeep 계약을 사용한다',
  position('x-costkeep-app-version' in
    pg_get_functiondef('public.current_client_app_version()'::regprocedure)) > 0);
select pg_temp.ok(
  '매장 삭제 가드가 Costkeep GUC를 공유한다',
  position('costkeep.store_purge_id' in
    pg_get_functiondef('public.reject_store_direct_delete()'::regprocedure)) > 0
  and position('costkeep.store_purge_id' in
    pg_get_functiondef('public.purge_archived_store(uuid,text)'::regprocedure)) > 0);
select pg_temp.ok(
  '국제 세금 활성 가드가 Costkeep GUC를 사용한다',
  position('costkeep.international_tax_force' in
    pg_get_functiondef('public.assert_international_tax_write_enabled()'::regprocedure)) > 0);

do $cron_contract$
declare
  v_new_count integer;
  v_old_count integer;
begin
  if to_regclass('cron.job') is null
     or current_setting('cron.database_name', true) is distinct from current_database() then
    perform pg_temp.ok('Cron 미사용 fresh DB는 작업명 검사를 건너뛴다', true);
    perform pg_temp.ok('Cron 미사용 fresh DB에는 이전 작업이 등록되지 않는다', true);
    return;
  end if;
  execute 'select count(*) from cron.job where jobname in
    (''costkeep-close-due'',''costkeep-apply-breaks'',''costkeep-purge-changes'')'
    into v_new_count;
  execute 'select count(*) from cron.job where jobname like ''margincook-%'''
    into v_old_count;
  perform pg_temp.eq('Cron 세 작업이 Costkeep 이름을 사용한다', v_new_count, 3);
  perform pg_temp.eq('이전 Cron 작업명은 남지 않는다', v_old_count, 0);
end;
$cron_contract$;

select pg_temp.eq(
  '로컬 시드 계정이 Costkeep 이메일을 사용한다',
  (select count(*)::integer from auth.users where email = 'demo@costkeep.local'),
  1);
select pg_temp.eq(
  '이전 로컬 시드 이메일은 남지 않는다',
  (select count(*)::integer from auth.users where email = 'demo@margincook.local'),
  0);
select pg_temp.ok(
  '시드 auth identity와 user 이메일이 같다',
  exists(select 1 from auth.identities i join auth.users u on u.id = i.user_id
    where u.email = 'demo@costkeep.local'
      and i.identity_data->>'email' = 'demo@costkeep.local'));
