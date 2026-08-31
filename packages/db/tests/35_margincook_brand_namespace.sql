-- ═══════════════════════════════════════════════════════════════
-- 35 · 활성 DB 실행 객체는 MarginCook 네임스페이스만 사용한다
-- ═══════════════════════════════════════════════════════════════

reset role;

select pg_temp.ok('MarginCook RPC 실행 역할이 비로그인·RLS 적용 역할이다', exists(
  select 1 from pg_roles where rolname = 'margincook_rpc_executor' and not rolcanlogin and not rolbypassrls
));

select pg_temp.ok('이전 RPC 실행 역할은 남지 않는다', not exists(
  select 1 from pg_roles where rolname = 'sikjae_rpc_executor'
));

select pg_temp.ok('MarginCook 실행 역할은 authenticated 권한을 상속한다',
  pg_has_role('margincook_rpc_executor', 'authenticated', 'member'));

select pg_temp.ok('authenticated 사용자가 내부 실행 역할 권한을 상속하지 않는다',
  not pg_has_role('authenticated', 'margincook_rpc_executor', 'member'));

select pg_temp.ok('직접 삭제 가드는 MarginCook 내부 키만 쓴다',
  position('margincook.store_purge_id' in pg_get_functiondef('public.reject_store_direct_delete()'::regprocedure)) > 0
  and position('sikjae.store_purge_id' in pg_get_functiondef('public.reject_store_direct_delete()'::regprocedure)) = 0);

select pg_temp.ok('승인 삭제 함수는 MarginCook 내부 키만 쓴다',
  position('margincook.store_purge_id' in pg_get_functiondef('public.purge_archived_store(uuid,text)'::regprocedure)) > 0
  and position('sikjae.store_purge_id' in pg_get_functiondef('public.purge_archived_store(uuid,text)'::regprocedure)) = 0);

select pg_temp.ok('활성 public 함수의 사용자 정의 GUC에 이전 브랜드 접두사가 없다', not exists(
  select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.prokind='f'
     and position('sikjae.' in lower(pg_get_functiondef(p.oid))) > 0
));

do $test$
declare
  v_named_old integer := 0;
  v_prefixed_old integer := 0;
begin
  if to_regclass('cron.job') is not null then
    execute 'select count(*) from cron.job where jobname in
      (''sikjae-close-due'', ''sikjae-apply-breaks'', ''sikjae-purge-changes'')'
      into v_named_old;
    execute 'select count(*) from cron.job where jobname like ''sikjae-%'''
      into v_prefixed_old;
  end if;
  perform pg_temp.ok('이전 Cron 작업명은 남지 않는다', v_named_old = 0);
  perform pg_temp.ok('현재 DB의 Cron 네임스페이스에 이전 브랜드 접두사가 없다',
    current_setting('cron.database_name', true) is distinct from current_database()
    or v_prefixed_old = 0);
end;
$test$;
