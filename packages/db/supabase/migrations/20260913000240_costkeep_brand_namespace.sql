-- 0240 — Costkeep 브랜드 네임스페이스 전환
-- 이미 적용된 migration과 원장은 쓰지 않고, 현재 실행 계약만 OID·데이터를 보존한 채 앞으로 옮긴다.

begin;

-- 일반 적용은 role rename으로 OID를 그대로 보존한다. 같은 클러스터의 fresh DB에서
-- 새 role이 이미 있는 경우에만 현재 DB의 ACL·정책·소유권을 합친 뒤 옛 role을 제거한다.
do $merge_roles$
declare
  v_old_oid oid;
  v_priv record;
  v_policy record;
begin
  if not exists(select 1 from pg_roles where rolname = 'margincook_rpc_executor')
     or not exists(select 1 from pg_roles where rolname = 'costkeep_rpc_executor') then
    return;
  end if;

  select oid into v_old_oid from pg_roles where rolname = 'margincook_rpc_executor';

  for v_priv in
    select n.nspname as object_name, x.privilege_type, x.is_grantable
      from pg_namespace n
      cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) x
     where x.grantee = v_old_oid
  loop
    execute format('grant %s on schema %I to costkeep_rpc_executor%s',
      v_priv.privilege_type, v_priv.object_name,
      case when v_priv.is_grantable then ' with grant option' else '' end);
  end loop;

  for v_priv in
    select c.oid::regclass::text as object_name, c.relkind,
           x.privilege_type, x.is_grantable
      from pg_class c
      cross join lateral aclexplode(coalesce(c.relacl,
        acldefault(case when c.relkind = 'S' then 's'::"char" else 'r'::"char" end, c.relowner))) x
     where x.grantee = v_old_oid
       and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
  loop
    execute format('grant %s on %s %s to costkeep_rpc_executor%s',
      v_priv.privilege_type,
      case when v_priv.relkind = 'S' then 'sequence' else 'table' end,
      v_priv.object_name,
      case when v_priv.is_grantable then ' with grant option' else '' end);
  end loop;

  for v_priv in
    select p.oid::regprocedure::text as object_name,
           x.privilege_type, x.is_grantable
      from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
     where x.grantee = v_old_oid
  loop
    execute format('grant %s on function %s to costkeep_rpc_executor%s',
      v_priv.privilege_type, v_priv.object_name,
      case when v_priv.is_grantable then ' with grant option' else '' end);
  end loop;

  for v_policy in
    select p.polname, p.polrelid::regclass::text as relation_name,
           string_agg(distinct case when role_oid = 0 then 'public'
             when role_oid = v_old_oid then 'costkeep_rpc_executor'
             else quote_ident(r.rolname) end, ', ' order by
             case when role_oid = 0 then 'public'
               when role_oid = v_old_oid then 'costkeep_rpc_executor'
               else quote_ident(r.rolname) end) as role_names
      from pg_policy p
      cross join lateral unnest(p.polroles) role_oid
      left join pg_roles r on r.oid = role_oid
     where v_old_oid = any(p.polroles)
     group by p.polname, p.polrelid
  loop
    execute format('alter policy %I on %s to %s',
      v_policy.polname, v_policy.relation_name, v_policy.role_names);
  end loop;

  grant create on schema public to costkeep_rpc_executor;
  reassign owned by margincook_rpc_executor to costkeep_rpc_executor;
  revoke create on schema public from costkeep_rpc_executor;
  drop owned by margincook_rpc_executor;
  revoke authenticated from margincook_rpc_executor;
  revoke margincook_rpc_executor from postgres;
  grant authenticated to costkeep_rpc_executor;
  grant costkeep_rpc_executor to postgres;
  drop role margincook_rpc_executor;
end;
$merge_roles$;

do $$
declare
  v_old_exists boolean := exists(select 1 from pg_roles where rolname = 'margincook_rpc_executor');
  v_new_exists boolean := exists(select 1 from pg_roles where rolname = 'costkeep_rpc_executor');
begin
  if v_old_exists and v_new_exists then
    raise exception '0240: 이전·새 RPC 실행 role 병합이 완료되지 않았습니다';
  elsif v_old_exists then
    alter role margincook_rpc_executor rename to costkeep_rpc_executor;
  elsif not v_new_exists then
    raise exception '0240: 이름을 바꿀 RPC 실행 role이 없습니다';
  end if;
end;
$$;

-- 현재 함수 본문에 남은 세션 GUC와 앱 버전 헤더를 새 계약으로 전환한다.
do $rewrite_runtime_contracts$
declare
  v_fn record;
  v_definition text;
  v_rewritten text;
begin
  for v_fn in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
  loop
    v_definition := pg_get_functiondef(v_fn.oid);
    v_rewritten := replace(
      replace(v_definition, 'margincook.', 'costkeep.'),
      'x-margincook-app-version', 'x-costkeep-app-version');
    if v_rewritten is distinct from v_definition then
      execute v_rewritten;
    end if;
  end loop;
end;
$rewrite_runtime_contracts$;

-- pg_cron은 jobname rename API를 제공하지 않고 cron.job 직접 UPDATE를 금지한다.
-- 기존 run detail은 삭제하지 않고, 같은 schedule·command·DB·user·active 상태로 재등록한다.
do $rename_cron_jobs$
declare
  v_pair record;
  v_old_count integer;
  v_new_count integer;
  v_job_id bigint;
  v_new_job_id bigint;
  v_schedule text;
  v_command text;
  v_database text;
  v_username text;
  v_active boolean;
begin
  if to_regclass('cron.job') is null
     or current_setting('cron.database_name', true) is distinct from current_database() then
    return;
  end if;

  for v_pair in
    select * from (values
      ('margincook-close-due', 'costkeep-close-due'),
      ('margincook-apply-breaks', 'costkeep-apply-breaks'),
      ('margincook-purge-changes', 'costkeep-purge-changes')
    ) as names(old_name, new_name)
  loop
    select count(*), max(jobid) into v_old_count, v_job_id
      from cron.job where jobname = v_pair.old_name;
    select count(*) into v_new_count
      from cron.job where jobname = v_pair.new_name;
    if v_old_count > 1 or v_new_count > 1 or (v_old_count = 1 and v_new_count = 1) then
      raise exception '0240: Cron 작업명 충돌 — % → %', v_pair.old_name, v_pair.new_name;
    elsif v_old_count = 1 then
      execute 'select schedule, command, database, username, active from cron.job where jobid = $1'
        into v_schedule, v_command, v_database, v_username, v_active using v_job_id;
      if v_database is distinct from current_database()
         or v_username is distinct from current_user then
        raise exception '0240: 다른 DB/user의 Cron 작업은 자동 전환하지 않습니다 — %',
          v_pair.old_name;
      end if;
      perform cron.unschedule(v_job_id);
      v_new_job_id := cron.schedule(v_pair.new_name, v_schedule, v_command);
      perform cron.alter_job(v_new_job_id, active => v_active);
    end if;
  end loop;
end;
$rename_cron_jobs$;

-- 로컬 개발용 시드 계정은 UUID·암호·매장 소유권을 바꾸지 않고 이메일만 옮긴다.
do $rename_local_demo$
declare
  v_user uuid;
begin
  if exists(select 1 from auth.users where email = 'demo@margincook.local')
     and exists(select 1 from auth.users where email = 'demo@costkeep.local') then
    raise exception '0240: 로컬 시드 계정 이메일이 충돌합니다';
  end if;

  select id into v_user from auth.users where email = 'demo@margincook.local';
  if v_user is not null then
    update auth.users
       set email = 'demo@costkeep.local', updated_at = now()
     where id = v_user;
    update auth.identities
       set identity_data = jsonb_set(identity_data, '{email}', to_jsonb('demo@costkeep.local'::text), true),
           updated_at = now()
     where user_id = v_user and provider = 'email';
  end if;
end;
$rename_local_demo$;

comment on function public.reject_store_direct_delete() is
  'Costkeep 보존·승인 절차 밖의 매장 물리 삭제를 거부한다.';
comment on function public.purge_archived_store(uuid, text) is
  '승인·보존 기간·백업 근거를 확인한 뒤 Costkeep 매장을 물리 삭제한다.';
comment on function public.current_client_app_version() is
  'PostgREST request.headers의 x-costkeep-app-version을 읽는 내부 경계. 형식이 없거나 틀리면 null이다.';

do $assert_costkeep_contract$
declare
  v_fn record;
  v_definition text;
  v_can_login boolean;
  v_bypass_rls boolean;
  v_old_cron_exists boolean;
begin
  select rolcanlogin, rolbypassrls into v_can_login, v_bypass_rls
    from pg_roles where rolname = 'costkeep_rpc_executor';
  if not found or v_can_login or v_bypass_rls then
    raise exception '0240: Costkeep RPC 실행 role 계약이 맞지 않습니다';
  end if;
  if exists(select 1 from pg_roles where rolname = 'margincook_rpc_executor') then
    raise exception '0240: 이전 RPC 실행 role이 남았습니다';
  end if;

  for v_fn in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
  loop
    v_definition := pg_get_functiondef(v_fn.oid);
    if position('margincook.' in v_definition) > 0
       or position('x-margincook-app-version' in v_definition) > 0 then
      raise exception '0240: 이전 런타임 계약이 함수 %에 남았습니다', v_fn.oid::regprocedure;
    end if;
  end loop;

  if to_regclass('cron.job') is not null
     and current_setting('cron.database_name', true) is not distinct from current_database() then
    execute 'select exists(select 1 from cron.job where jobname like ''margincook-%'')'
      into v_old_cron_exists;
    if v_old_cron_exists then
      raise exception '0240: 이전 Cron 작업명이 남았습니다';
    end if;
  end if;
end;
$assert_costkeep_contract$;

commit;
