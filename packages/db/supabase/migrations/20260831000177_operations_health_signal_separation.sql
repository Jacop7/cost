-- 0177 · Cron 장애와 신뢰 경계가 다른 client-reported RPC 경고를 분리한다.
--
-- 앱 보고는 인증 사용자별 상한이 있어도 외부 가입자가 만들 수 있는 비권위 신호다. 따라서
-- 전체 장애 status와 workflow 실패는 Cron만 결정하고, RPC는 별도 warning으로 운영자에게 보인다.
-- 또한 성공 없이 실패만 있는 Cron이 SQL NULL로 빠져 bool_and에서 무시되지 않게 한다.

begin;

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
  v_cron_monitored := to_regclass('cron.job') is not null;
  if v_cron_monitored then
    v_cron_monitored :=
      current_setting('cron.database_name', true) = current_database()
      or exists (
        select 1
          from cron.job c
         where c.database = current_database()
           and c.jobname in (
             'margincook-close-due',
             'margincook-apply-breaks',
             'margincook-purge-changes'
           )
      );
  end if;

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
      select *, coalesce(
             job_count = 1 and active is true and actual_schedule = expected_schedule
             and (v_now - coalesce(last_success_at, v_started_at) <= max_age)
             and (last_failure_at is null
                  or (last_success_at is not null and last_success_at >= last_failure_at)),
             false) as healthy
        from observed
    )
    select coalesce(bool_and(coalesce(healthy, false)), false),
           coalesce(jsonb_agg(jsonb_build_object(
             'name', jobname,
             'healthy', coalesce(healthy, false),
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
    'status', case when v_cron_ok then 'ok' else 'degraded' end,
    'checked_at', v_now,
    'cron', jsonb_build_object('monitored', v_cron_monitored, 'healthy', v_cron_ok, 'jobs', v_jobs),
    'rpc', jsonb_build_object(
      'source', 'client_reported',
      'warning', v_rpc_count > 0,
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
  'service_role 전용 운영 상태. status는 Cron 3종만 결정하고 최근 15분 client-reported RPC 오류는 별도 warning으로 반환한다.';

do $verify$
declare
  v jsonb := public.ops_health_status();
begin
  if has_function_privilege('authenticated', 'public.ops_health_status()', 'execute')
     or not has_function_privilege('service_role', 'public.ops_health_status()', 'execute') then
    raise exception '0177: 운영 상태 문의 실행 권한이 맞지 않습니다';
  end if;
  if jsonb_typeof(v#>'{cron,healthy}') <> 'boolean'
     or jsonb_typeof(v#>'{rpc,warning}') <> 'boolean'
     or exists (
       select 1 from jsonb_array_elements(v#>'{cron,jobs}') j
        where jsonb_typeof(j->'healthy') <> 'boolean'
     ) then
    raise exception '0177: Cron healthy 또는 RPC warning 응답이 boolean이 아닙니다';
  end if;
end;
$verify$;

commit;
