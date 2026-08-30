-- 0175 — MarginCook 브랜드 네임스페이스 전환
--
-- 이미 적용된 0137/0138/0139/0157/0173/0174는 배포 이력이므로 수정하지 않는다.
-- 실행 역할·Cron 작업명·내부 삭제 가드 키만 OID와 권한을 보존한 채 새 이름으로 전진한다.

begin;

-- 역할은 DB가 아니라 클러스터 전체 객체다. 같은 클러스터에서 fresh DB를 만들면
-- 주 DB의 새 역할과 fresh DB의 0174가 만든 옛 역할이 잠시 함께 존재할 수 있다.
-- 그 경우 현재 DB의 ACL·정책·소유권을 새 역할로 옮긴 뒤 옛 역할을 제거한다.
do $merge_roles$
declare
  v_old_oid oid;
  v_priv record;
  v_policy record;
begin
  if not exists(select 1 from pg_roles where rolname = 'sikjae_rpc_executor')
     or not exists(select 1 from pg_roles where rolname = 'margincook_rpc_executor') then
    return;
  end if;

  select oid into v_old_oid from pg_roles where rolname = 'sikjae_rpc_executor';

  for v_priv in
    select n.nspname as object_name, x.privilege_type, x.is_grantable
      from pg_namespace n
      cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) x
     where x.grantee = v_old_oid
  loop
    execute format('grant %s on schema %I to margincook_rpc_executor%s',
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
    execute format('grant %s on %s %s to margincook_rpc_executor%s',
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
    execute format('grant %s on function %s to margincook_rpc_executor%s',
      v_priv.privilege_type, v_priv.object_name,
      case when v_priv.is_grantable then ' with grant option' else '' end);
  end loop;

  for v_policy in
    select p.polname, p.polrelid::regclass::text as relation_name,
           string_agg(distinct case when role_oid = 0 then 'public'
             when role_oid = v_old_oid then 'margincook_rpc_executor'
             else quote_ident(r.rolname) end, ', ' order by
             case when role_oid = 0 then 'public'
               when role_oid = v_old_oid then 'margincook_rpc_executor'
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

  grant create on schema public to margincook_rpc_executor;
  reassign owned by sikjae_rpc_executor to margincook_rpc_executor;
  revoke create on schema public from margincook_rpc_executor;
  drop owned by sikjae_rpc_executor;
  revoke authenticated from sikjae_rpc_executor;
  revoke sikjae_rpc_executor from postgres;
  grant authenticated to margincook_rpc_executor;
  grant margincook_rpc_executor to postgres;
  drop role sikjae_rpc_executor;
end;
$merge_roles$;

do $$
declare
  v_old_exists boolean := exists(select 1 from pg_roles where rolname = 'sikjae_rpc_executor');
  v_new_exists boolean := exists(select 1 from pg_roles where rolname = 'margincook_rpc_executor');
begin
  if v_old_exists and v_new_exists then
    raise exception '0175: 이전·새 RPC 실행 역할 병합이 완료되지 않았습니다';
  elsif v_old_exists then
    alter role sikjae_rpc_executor rename to margincook_rpc_executor;
  elsif not v_new_exists then
    raise exception '0175: 이름을 바꿀 RPC 실행 역할이 없습니다';
  end if;
end;
$$;

-- 역할 이름 변경은 OID를 보존하므로 함수 소유권·정책·권한·멤버십도 그대로 따라온다.
do $$
declare
  v_can_login boolean;
  v_bypass_rls boolean;
begin
  select rolcanlogin, rolbypassrls into v_can_login, v_bypass_rls
    from pg_roles where rolname = 'margincook_rpc_executor';
  if not found or v_can_login or v_bypass_rls then
    raise exception '0175: MarginCook RPC 실행 역할 계약이 맞지 않습니다';
  end if;
  if exists(select 1 from pg_roles where rolname = 'sikjae_rpc_executor') then
    raise exception '0175: 이전 RPC 실행 역할이 남았습니다';
  end if;
end;
$$;

-- 물리 삭제 가드가 읽는 트랜잭션 로컬 키도 새 브랜드 네임스페이스로 옮긴다.
create or replace function public.reject_store_direct_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('margincook.store_purge_id', true) is distinct from old.id::text then
    raise exception '매장 물리 삭제는 보존·승인·백업 절차를 통해야 해요'
      using errcode = '42501', detail = 'STORE_PURGE_PROCEDURE_REQUIRED';
  end if;
  return old;
end;
$$;

create or replace function public.purge_archived_store(p_store uuid, p_backup_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.store_purge_schedules%rowtype;
begin
  if coalesce(btrim(p_backup_reference), '') = '' then
    raise exception '복구할 백업 근거가 필요해요'
      using errcode = '22000', detail = 'PURGE_BACKUP_REQUIRED';
  end if;

  select * into v_schedule from public.store_purge_schedules
   where store_id = p_store for update;
  if not found then
    raise exception '승인된 물리 삭제 예정이 없어요'
      using errcode = '42501', detail = 'PURGE_NOT_SCHEDULED';
  end if;
  if v_schedule.purge_after > clock_timestamp() then
    raise exception '원장 보존 기간이 아직 끝나지 않았어요'
      using errcode = '42501', detail = 'RETENTION_PERIOD_ACTIVE';
  end if;

  insert into public.store_lifecycle_events
    (store_id, event_type, actor_user_id, reason, approval_reference, backup_reference, metadata)
  values
    (p_store, 'physical_purge', auth.uid(), v_schedule.reason,
     v_schedule.approval_reference, btrim(p_backup_reference),
     jsonb_build_object('approved_by', v_schedule.approved_by,
                        'purge_after', v_schedule.purge_after,
                        'scheduled_at', v_schedule.scheduled_at));

  perform set_config('margincook.store_purge_id', p_store::text, true);
  delete from public.stores where id = p_store and archived_at is not null;
  if not found then
    raise exception '아카이브된 매장을 찾지 못했어요'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object('purged', true, 'store_id', p_store);
end;
$$;

-- 등록돼 있는 작업만 이름을 바꾼다. Cron을 사용할 수 없는 환경에서 과거 등록이
-- 생략됐을 수 있으므로 없는 작업을 새로 활성화하지 않는다.
do $$
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
      ('sikjae-close-due', 'margincook-close-due'),
      ('sikjae-apply-breaks', 'margincook-apply-breaks'),
      ('sikjae-purge-changes', 'margincook-purge-changes')
    ) as names(old_name, new_name)
  loop
    select count(*), max(jobid) into v_old_count, v_job_id
      from cron.job where jobname = v_pair.old_name;
    select count(*) into v_new_count
      from cron.job where jobname = v_pair.new_name;

    if v_old_count > 1 or v_new_count > 1 or (v_old_count = 1 and v_new_count = 1) then
      raise exception '0175: Cron 작업명 충돌 — % → %', v_pair.old_name, v_pair.new_name;
    elsif v_old_count = 1 then
      execute 'select schedule, command, database, username, active from cron.job where jobid = $1'
        into v_schedule, v_command, v_database, v_username, v_active using v_job_id;
      if v_database is distinct from current_database()
         or v_username is distinct from current_user then
        raise exception '0175: 다른 DB/사용자의 Cron 작업은 자동으로 이름을 바꾸지 않습니다 — %',
          v_pair.old_name;
      end if;
      perform cron.unschedule(v_job_id);
      v_new_job_id := cron.schedule(v_pair.new_name, v_schedule, v_command);
      perform cron.alter_job(v_new_job_id, active => v_active);
    end if;
  end loop;

  if exists(
    select 1 from cron.job
     where jobname in ('sikjae-close-due', 'sikjae-apply-breaks', 'sikjae-purge-changes')
  ) then
    raise exception '0175: 이전 Cron 작업명이 남았습니다';
  end if;
end;
$$;

do $$
declare
  v_delete_guard text := pg_get_functiondef('public.reject_store_direct_delete()'::regprocedure);
  v_purge text := pg_get_functiondef('public.purge_archived_store(uuid,text)'::regprocedure);
begin
  if position('margincook.store_purge_id' in v_delete_guard) = 0
     or position('margincook.store_purge_id' in v_purge) = 0
     or position('sikjae.store_purge_id' in v_delete_guard) > 0
     or position('sikjae.store_purge_id' in v_purge) > 0 then
    raise exception '0175: 매장 삭제 가드 키 전환이 완료되지 않았습니다';
  end if;
end;
$$;

comment on function public.reject_store_direct_delete() is
  'MarginCook 보존·승인 절차 밖의 매장 물리 삭제를 거부한다.';
comment on function public.purge_archived_store(uuid, text) is
  '승인·보존 기간·백업 근거를 확인한 뒤 MarginCook 매장을 물리 삭제한다.';

commit;
