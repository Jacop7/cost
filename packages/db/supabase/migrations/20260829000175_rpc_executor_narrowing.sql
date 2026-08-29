-- ============================================================================
-- 0175 · RPC 실행 역할에서 전 매장 유지보수 문을 닫는다
--
-- 0174는 기존 invoker facade를 깨지 않기 위해 현재 public 함수 전체에
-- EXECUTE를 준 뒤 앱 문만 64개로 줄였다. 그 결과 executor 소유 facade가
-- 전 매장 자료를 지우거나 스위프하는 postgres SECURITY DEFINER까지 부를 수 있었다.
-- authenticated에 열린 공식 facade는 남기고, 앱에 열리지 않은 postgres definer는
-- executor에서 모두 회수한다. 미래 함수도 자동 개방하지 않고, 새 facade의 실제
-- 호출 그래프를 검토한 migration이 필요한 도우미만 명시적으로 grant한다.
-- ============================================================================

alter default privileges for role postgres in schema public
  revoke execute on functions from sikjae_rpc_executor;

do $revoke_maintenance$
declare
  r record;
begin
  for r in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_roles owner_role on owner_role.oid = p.proowner
     where n.nspname = 'public'
       and p.prokind in ('f', 'p')
       and p.prosecdef
       and owner_role.rolname = 'postgres'
       and has_function_privilege('sikjae_rpc_executor', p.oid, 'execute')
       and not has_function_privilege('authenticated', p.oid, 'execute')
  loop
    execute format('revoke execute on function %s from sikjae_rpc_executor', r.oid::regprocedure);
  end loop;
end
$revoke_maintenance$;

do $verify$
declare
  v_bad integer;
begin
  select count(*) into v_bad
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles owner_role on owner_role.oid = p.proowner
   where n.nspname = 'public'
     and p.prokind in ('f', 'p')
     and p.prosecdef
     and owner_role.rolname = 'postgres'
     and has_function_privilege('sikjae_rpc_executor', p.oid, 'execute')
     and not has_function_privilege('authenticated', p.oid, 'execute');
  if v_bad <> 0 then
    raise exception '0175: RPC 실행 역할에 유지보수 definer가 %개 남았습니다', v_bad;
  end if;

  if has_function_privilege('sikjae_rpc_executor',
       'public.purge_archived_store(uuid,text)', 'execute')
     or has_function_privilege('sikjae_rpc_executor',
       'public.schedule_store_purge(uuid,timestamp with time zone,text,text,text)', 'execute')
     or has_function_privilege('sikjae_rpc_executor',
       'public.purge_entity_changes()', 'execute')
     or has_function_privilege('sikjae_rpc_executor',
       'public.close_due_business_days()', 'execute') then
    raise exception '0175: 매장 파괴·전역 스위프 함수가 RPC 실행 역할에 열려 있습니다';
  end if;
end
$verify$;

-- 새 함수는 앱·executor 모두에 자동 공개되지 않고 service_role만 받는다.
create function public.zz_rpc_grant_probe_0175() returns integer language sql as 'select 1';
do $probe$
begin
  if has_function_privilege('authenticated', 'public.zz_rpc_grant_probe_0175()', 'execute')
     or has_function_privilege('sikjae_rpc_executor', 'public.zz_rpc_grant_probe_0175()', 'execute') then
    raise exception '0175: 새 함수가 앱 또는 RPC 실행 역할에 자동 공개됩니다';
  end if;
  if not has_function_privilege('service_role', 'public.zz_rpc_grant_probe_0175()', 'execute') then
    raise exception '0175: 새 함수의 service_role 기본 권한이 빠졌습니다';
  end if;
end
$probe$;
drop function public.zz_rpc_grant_probe_0175();
