-- 0176 · Cron/RPC 운영 관측의 최소 안전망
--
-- 정확한 RPC 오류율은 플랫폼 요청 로그가 있어야 계산할 수 있다. 이 단계는 그 수치를
-- 지어내지 않고, 앱이 보고한 예상 밖 RPC 오류 건수와 pg_cron 실행 지연·실패만 다룬다.
-- 원본 오류 문구와 사용자 입력은 저장하지 않는다.

begin;

create schema if not exists ops;
revoke all on schema ops from public, anon, authenticated, margincook_rpc_executor;
grant usage on schema ops to service_role;

create table ops.rpc_error_buckets (
  bucket_at timestamptz not null,
  user_id uuid not null,
  error_code text not null,
  error_detail text not null,
  client_platform text not null,
  occurrence_count integer not null default 1 check (occurrence_count between 1 and 20),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  primary key (bucket_at, user_id, error_code, error_detail, client_platform),
  constraint rpc_error_code_shape check (error_code ~ '^[A-Z0-9]{3,10}$'),
  constraint rpc_error_detail_shape check (error_detail ~ '^[A-Z0-9_]{1,80}$'),
  constraint rpc_error_platform_shape check (client_platform in ('android', 'ios', 'web', 'unknown'))
);

create table ops.monitoring_config (
  singleton boolean primary key default true check (singleton),
  started_at timestamptz not null
);
insert into ops.monitoring_config(singleton, started_at)
values (true, clock_timestamp());

alter table ops.rpc_error_buckets enable row level security;
alter table ops.monitoring_config enable row level security;
revoke all on table ops.rpc_error_buckets, ops.monitoring_config
  from public, anon, authenticated, margincook_rpc_executor;
grant select, insert, update, delete on table ops.rpc_error_buckets, ops.monitoring_config to service_role;

comment on table ops.rpc_error_buckets is
  '앱이 보고한 예상 밖 RPC 오류를 사용자·5분·오류 지문별로 합친 운영 신호. 정확한 전체 오류율이 아니다.';

create or replace function ops.is_expected_rpc_error(p_code text, p_detail text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select
    coalesce(upper(btrim(p_code)), '') ~ '^450(0[1-9]|1[0-5])$'
    or coalesce(upper(btrim(p_code)), '') = '22000'
    or coalesce(upper(btrim(p_detail)), '') = any (array[
      'ARCHIVE_REASON_REQUIRED', 'BASE_REQUIRED', 'BASIS_NOT_AVAILABLE',
      'BEFORE_OPEN', 'DAY_CLOSED', 'DAY_IS_LIVE', 'EMPTY_PAYLOAD',
      'HOURS_NOT_HERE', 'INVALID_ARCHIVE_REASON', 'INVALID_TRANSITION',
      'INVALID_VALUE', 'LATE_OPEN', 'NO_CHANGES', 'NONEXISTENT_LOCAL_TIME',
      'PURGE_APPROVAL_REQUIRED', 'PURGE_BACKUP_REQUIRED', 'PURGE_NOT_SCHEDULED',
      'RETENTION_PERIOD_ACTIVE', 'REVISION_CONFLICT', 'SALE_DATE_OUT_OF_RANGE',
      'STORE_LIFECYCLE_APPEND_ONLY', 'STORE_NOT_ARCHIVED',
      'STORE_OWNERSHIP_RESTORE_FORBIDDEN', 'STORE_OWNERSHIP_TRANSFER_FORBIDDEN',
      'STORE_PURGE_PROCEDURE_REQUIRED', 'UNKNOWN_KEY'
    ]::text[])
$$;

revoke execute on function ops.is_expected_rpc_error(text, text)
  from public, anon, authenticated, margincook_rpc_executor;
grant execute on function ops.is_expected_rpc_error(text, text) to service_role;

create or replace function public.report_client_rpc_error(
  p_code text,
  p_detail text,
  p_client_platform text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ops
as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_bucket timestamptz;
  v_code text := upper(coalesce(nullif(btrim(p_code), ''), 'NOCODE'));
  v_detail text := upper(coalesce(nullif(btrim(p_detail), ''), 'NONE'));
  v_platform text := lower(coalesce(nullif(btrim(p_client_platform), ''), 'unknown'));
  v_recent integer;
  v_count integer;
begin
  if v_user is null then
    raise exception '로그인이 필요해요' using errcode = '42501', detail = 'AUTH_REQUIRED';
  end if;

  -- 정상 업무 분기·입력 거절은 장애가 아니다. 서버가 다시 판정하므로 호출자가 숨길 수 없다.
  if ops.is_expected_rpc_error(v_code, v_detail) then
    return jsonb_build_object('reported', false, 'reason', 'expected');
  end if;

  if v_code !~ '^[A-Z0-9]{3,10}$' then
    v_code := 'BADCODE';
  end if;
  if v_detail !~ '^[A-Z0-9_]{1,80}$' then
    v_detail := 'UNSTRUCTURED';
  end if;
  if v_platform not in ('android', 'ios', 'web') then
    v_platform := 'unknown';
  end if;

  -- 같은 사용자의 동시 보고도 합계 검사를 함께 통과하지 못하게 직렬화한다.
  perform pg_advisory_xact_lock(hashtext('ops_rpc_error'), hashtext(v_user::text));

  -- 한 계정은 15분 동안 최대 20건만 반영한다. 같은 오류의 반복도 20에서 멈춘다.
  select coalesce(sum(occurrence_count), 0)::integer into v_recent
    from ops.rpc_error_buckets
   where user_id = v_user and bucket_at >= v_now - interval '15 minutes';
  if v_recent >= 20 then
    return jsonb_build_object('reported', false, 'reason', 'rate_limited');
  end if;

  v_bucket := date_trunc('hour', v_now)
    + make_interval(mins => (extract(minute from v_now)::integer / 5) * 5);

  insert into ops.rpc_error_buckets
    (bucket_at, user_id, error_code, error_detail, client_platform,
     occurrence_count, first_seen_at, last_seen_at)
  values
    (v_bucket, v_user, v_code, v_detail, v_platform, 1, v_now, v_now)
  on conflict (bucket_at, user_id, error_code, error_detail, client_platform)
  do update set
    occurrence_count = least(ops.rpc_error_buckets.occurrence_count + 1, 20),
    last_seen_at = excluded.last_seen_at
  returning occurrence_count into v_count;

  return jsonb_build_object('reported', true, 'count', v_count);
end;
$$;

revoke execute on function public.report_client_rpc_error(text, text, text)
  from public, anon, margincook_rpc_executor;
grant execute on function public.report_client_rpc_error(text, text, text)
  to authenticated, service_role;

comment on function public.report_client_rpc_error(text, text, text) is
  '인증 앱이 만난 예상 밖 RPC 오류의 코드·안정 detail·플랫폼만 5분 버킷으로 보고한다. 오류율 분모는 제공하지 않는다.';

create or replace function public.ops_health_status()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ops
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_cron_monitored boolean;
  v_cron_ok boolean := false;
  v_jobs jsonb := '[]'::jsonb;
  v_rpc_count integer := 0;
  v_rpc_users integer := 0;
  v_rpc_fingerprints jsonb := '[]'::jsonb;
  v_started_at timestamptz;
begin
  select started_at into v_started_at from ops.monitoring_config where singleton;
  v_cron_monitored := to_regclass('cron.job') is not null
    and current_setting('cron.database_name', true) = current_database();

  if v_cron_monitored then
    with expected(jobname, schedule, max_age) as (values
      ('margincook-close-due', '* * * * *', interval '5 minutes'),
      ('margincook-apply-breaks', '* * * * *', interval '5 minutes'),
      ('margincook-purge-changes', '17 4 * * *', interval '30 hours')
    ), observed as (
      select e.jobname, e.schedule as expected_schedule, e.max_age,
             j.job_count, j.actual_schedule, j.active,
             r.last_success_at, r.last_failure_at, r.last_status
        from expected e
        left join lateral (
          select count(*)::integer job_count,
                 max(c.schedule) actual_schedule,
                 bool_and(c.active) active,
                 array_agg(c.jobid) job_ids
            from cron.job c where c.jobname = e.jobname
        ) j on true
        left join lateral (
          select max(coalesce(d.end_time, d.start_time)) filter (where d.status = 'succeeded') last_success_at,
                 max(coalesce(d.end_time, d.start_time)) filter
                   (where d.status = 'failed') last_failure_at,
                 (array_agg(d.status order by d.start_time desc, d.runid desc))[1] last_status
            from cron.job_run_details d where d.jobid = any(j.job_ids)
        ) r on true
    ), shaped as (
      select *,
             job_count = 1 and active is true and actual_schedule = expected_schedule
             and (v_now - coalesce(last_success_at, v_started_at) <= max_age)
             and (last_failure_at is null or last_success_at >= last_failure_at) as healthy
        from observed
    )
    select coalesce(bool_and(healthy), false),
           coalesce(jsonb_agg(jsonb_build_object(
             'name', jobname,
             'healthy', healthy,
             'active', coalesce(active, false),
             'schedule', actual_schedule,
             'last_status', last_status,
             'last_success_at', last_success_at,
             'last_failure_at', last_failure_at
           ) order by jobname), '[]'::jsonb)
      into v_cron_ok, v_jobs
      from shaped;
  end if;

  select coalesce(sum(occurrence_count), 0)::integer,
         count(distinct user_id)::integer
    into v_rpc_count, v_rpc_users
    from ops.rpc_error_buckets
   where bucket_at >= v_now - interval '15 minutes';

  select coalesce(jsonb_agg(jsonb_build_object(
           'code', error_code, 'detail', error_detail,
           'platform', client_platform, 'count', n
         ) order by n desc, error_code, error_detail), '[]'::jsonb)
    into v_rpc_fingerprints
    from (
      select error_code, error_detail, client_platform, sum(occurrence_count)::integer n
        from ops.rpc_error_buckets
       where bucket_at >= v_now - interval '15 minutes'
       group by error_code, error_detail, client_platform
       order by n desc, error_code, error_detail
       limit 5
    ) x;

  return jsonb_build_object(
    'status', case when v_cron_ok and v_rpc_count = 0 then 'ok' else 'degraded' end,
    'checked_at', v_now,
    'cron', jsonb_build_object('monitored', v_cron_monitored, 'healthy', v_cron_ok, 'jobs', v_jobs),
    'rpc', jsonb_build_object(
      'source', 'client_reported',
      'window_minutes', 15,
      'unexpected_count', v_rpc_count,
      'affected_users', v_rpc_users,
      'fingerprints', v_rpc_fingerprints
    )
  );
end;
$$;

revoke execute on function public.ops_health_status()
  from public, anon, authenticated, margincook_rpc_executor;
grant execute on function public.ops_health_status() to service_role;

comment on function public.ops_health_status() is
  'service_role 전용 운영 상태. Cron 3종의 최신 성공·실패·지연과 최근 15분 client-reported RPC 오류 건수를 반환한다.';

-- 기존 하루 한 번 청소 문에서 운영 신호도 30일 뒤 제거한다. 계산 원장과 감사 원장은 건드리지 않는다.
create or replace function public.purge_entity_changes()
returns integer
language plpgsql
security definer
set search_path = public, ops, pg_temp
as $$
declare
  v_n integer := 0;
  v_part integer;
begin
  delete from public.entity_change_events
   where occurred_at < clock_timestamp() - interval '30 days';
  get diagnostics v_part = row_count;
  v_n := v_n + v_part;

  delete from ops.rpc_error_buckets
   where bucket_at < clock_timestamp() - interval '30 days';
  get diagnostics v_part = row_count;
  v_n := v_n + v_part;
  return v_n;
end;
$$;

revoke execute on function public.purge_entity_changes()
  from public, anon, authenticated, margincook_rpc_executor;
grant execute on function public.purge_entity_changes() to service_role;

do $verify$
begin
  if has_schema_privilege('authenticated', 'ops', 'usage')
     or has_table_privilege('authenticated', 'ops.rpc_error_buckets', 'select')
     or has_table_privilege('authenticated', 'ops.rpc_error_buckets', 'insert')
     or has_table_privilege('authenticated', 'ops.monitoring_config', 'select') then
    raise exception '0176: 앱 롤에 ops 원본이 열려 있습니다';
  end if;
  if not has_function_privilege('authenticated',
       'public.report_client_rpc_error(text,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.ops_health_status()', 'execute') then
    raise exception '0176: 보고 문과 운영 상태 문의 권한이 맞지 않습니다';
  end if;
  if has_function_privilege('margincook_rpc_executor',
       'public.ops_health_status()', 'execute')
     or has_function_privilege('margincook_rpc_executor',
       'public.purge_entity_changes()', 'execute') then
    raise exception '0176: 앱 내부 실행 역할에 전역 운영 문이 열려 있습니다';
  end if;
end;
$verify$;

commit;
