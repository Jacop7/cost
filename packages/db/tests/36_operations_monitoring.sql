-- ═══════════════════════════════════════════════════════════════
-- 36 · Cron 상태와 예상 밖 RPC 오류를 최소 정보로 관측한다
-- ═══════════════════════════════════════════════════════════════

reset role;

select pg_temp.ok('ops 원본 스키마는 앱 롤에 닫혀 있다',
  not has_schema_privilege('authenticated', 'ops', 'usage')
  and not has_table_privilege('authenticated', 'ops.rpc_error_buckets', 'select')
  and not has_table_privilege('authenticated', 'ops.rpc_error_buckets', 'insert')
  and not has_table_privilege('authenticated', 'ops.monitoring_config', 'select'));

select pg_temp.ok('운영 상태 문은 service_role 전용이다',
  has_function_privilege('service_role', 'public.ops_health_status()', 'execute')
  and not has_function_privilege('authenticated', 'public.ops_health_status()', 'execute')
  and not has_function_privilege('margincook_rpc_executor', 'public.ops_health_status()', 'execute'));

set local role authenticated;

select pg_temp.eq_t('업무 분기 45009는 장애로 저장하지 않는다',
  report_client_rpc_error('45009', 'REVISION_CONFLICT', 'web')->>'reason', 'expected');
select pg_temp.eq_t('입력 검증 22000은 장애로 저장하지 않는다',
  report_client_rpc_error('22000', null, 'ios')->>'reason', 'expected');

reset role;
select pg_temp.eq('정상 업무 오류 버킷은 0건이다',
  (select count(*) from ops.rpc_error_buckets), 0);

set local role authenticated;

select pg_temp.eq_t('원시 권한 오류는 예상 밖 신호로 기록한다',
  report_client_rpc_error('42501', null, 'android')->>'reported', 'true');
select pg_temp.eq_t('같은 오류는 같은 버킷에 합친다',
  report_client_rpc_error('42501', null, 'android')->>'count', '2');
select pg_temp.eq_t('코드 없는 전송 실패도 예상 밖 신호로 기록한다',
  report_client_rpc_error(null, null, 'web')->>'reported', 'true');
select pg_temp.eq_t('빈 코드도 코드 없음 대체값으로 기록한다',
  report_client_rpc_error('  ', null, 'web')->>'reported', 'true');
select pg_temp.eq_t('형태가 깨진 코드도 대체값으로 기록한다',
  report_client_rpc_error('bad code!', 'Key (name)=(user)', 'ios')->>'reported', 'true');

reset role;
select pg_temp.eq('같은 오류 버킷은 한 줄이다',
  (select count(*) from ops.rpc_error_buckets where error_code = '42501'), 1);
select pg_temp.eq('같은 오류의 횟수는 2다',
  (select occurrence_count from ops.rpc_error_buckets where error_code = '42501'), 2);
select pg_temp.ok('코드 대체값은 제약과 일치해 실제로 저장된다',
  exists (select 1 from ops.rpc_error_buckets where error_code = 'NOCODE')
  and exists (select 1 from ops.rpc_error_buckets where error_code = 'BADCODE'));

set local role authenticated;

do $rate$
declare
  v_result jsonb;
begin
  for i in 1..25 loop
    v_result := report_client_rpc_error('XX001', 'INTERNAL_FAILURE', 'web');
  end loop;
  perform pg_temp.eq_t('사용자별 15분 상한 뒤에는 더 기록하지 않는다',
    v_result->>'reason', 'rate_limited');
end;
$rate$;

reset role;
select pg_temp.eq('사용자 한 명의 15분 총량은 20에서 멈춘다',
  (select sum(occurrence_count) from ops.rpc_error_buckets), 20);
select pg_temp.ok('동시 보고도 사용자별 상한 앞에서 직렬화한다',
  position('pg_advisory_xact_lock' in
    lower(pg_get_functiondef('public.report_client_rpc_error(text,text,text)'::regprocedure))) > 0);

set local role authenticated;

select pg_temp.raises('앱 롤은 운영 상태를 직접 읽지 못한다',
  'select ops_health_status()', '42501');

reset role;

do $health$
declare
  v jsonb := ops_health_status();
begin
  perform pg_temp.ok('운영 상태 응답은 status·checked_at·cron·rpc를 모두 준다',
    v ?& array['status', 'checked_at', 'cron', 'rpc']);
  perform pg_temp.eq_t('전체 상태는 client-reported 오류가 아니라 Cron 판정만 따른다',
    v->>'status',
    case when (v#>>'{cron,monitored}')::boolean and (v#>>'{cron,healthy}')::boolean
      then 'ok' else 'degraded' end);
  perform pg_temp.eq_t('client-reported 오류는 별도 warning으로 보인다',
    v#>>'{rpc,warning}', 'true');
  perform pg_temp.eq('운영 상태의 RPC 합계는 버킷 합계다',
    (v#>>'{rpc,unexpected_count}')::numeric, 20);
  perform pg_temp.eq('운영 상태는 사용자 ID 대신 영향 사용자 수만 준다',
    (v#>>'{rpc,affected_users}')::numeric, 1);
  perform pg_temp.eq_t('RPC 신호는 정확한 오류율이 아니라 client-reported다',
    v#>>'{rpc,source}', 'client_reported');
  perform pg_temp.ok('Cron 응답은 모니터링 여부·건강·세 작업 배열을 준다',
    (v->'cron') ?& array['monitored', 'healthy', 'jobs']
    and jsonb_typeof(v#>'{cron,jobs}') = 'array'
    and not exists (
      select 1 from jsonb_array_elements(v#>'{cron,jobs}') j
       where jsonb_typeof(j->'healthy') <> 'boolean'
    ));
end;
$health$;

do $starting$
declare
  v_job_id bigint;
  v_run_id bigint;
  v jsonb;
begin
  if current_setting('cron.database_name', true) is distinct from current_database() then
    return;
  end if;
  select jobid into v_job_id from cron.job where jobname = 'margincook-close-due';
  if v_job_id is not null then
    insert into cron.job_run_details
      (jobid, runid, database, username, command, status, start_time)
    select jobid, coalesce((select max(runid) from cron.job_run_details), 0) + 1000000,
           database, username, command, 'starting', clock_timestamp() + interval '1 second'
      from cron.job where jobid = v_job_id
    returning runid into v_run_id;
    v := ops_health_status();
    perform pg_temp.ok('방금 시작한 1분 Cron은 실패로 오인하지 않는다',
      exists (select 1 from jsonb_array_elements(v#>'{cron,jobs}') j
               where j->>'name' = 'margincook-close-due' and (j->>'healthy')::boolean is true));
    delete from cron.job_run_details where runid = v_run_id;
  end if;
end;
$starting$;

do $failed_only$
declare
  v_job_id bigint;
  v_run_id bigint;
  v jsonb;
begin
  if current_setting('cron.database_name', true) is distinct from current_database() then
    return;
  end if;
  select jobid into v_job_id from cron.job where jobname = 'margincook-purge-changes';
  if v_job_id is not null then
    delete from cron.job_run_details where jobid = v_job_id;
    insert into cron.job_run_details
      (jobid, runid, database, username, command, status, start_time, end_time)
    select jobid, coalesce((select max(runid) from cron.job_run_details), 0) + 2000000,
           database, username, command, 'failed', clock_timestamp(), clock_timestamp()
      from cron.job where jobid = v_job_id
    returning runid into v_run_id;
    v := ops_health_status();
    perform pg_temp.ok('유예 중이라도 성공 없이 실패만 있는 Cron은 healthy=false다',
      exists (select 1 from jsonb_array_elements(v#>'{cron,jobs}') j
               where j->>'name' = 'margincook-purge-changes'
                 and jsonb_typeof(j->'healthy') = 'boolean'
                 and (j->>'healthy')::boolean is false));
    perform pg_temp.eq_t('실패만 있는 작업이 있으면 전체 Cron도 degraded다',
      v#>>'{cron,healthy}', 'false');
    perform pg_temp.eq_t('Cron 실패는 전체 상태를 degraded로 만든다',
      v->>'status', 'degraded');
    delete from cron.job_run_details where runid = v_run_id;
  end if;
end;
$failed_only$;

do $grace$
declare
  v_job_id bigint;
  v_old_start timestamptz;
  v jsonb;
begin
  if current_setting('cron.database_name', true) is distinct from current_database() then
    return;
  end if;
  select started_at into v_old_start from ops.monitoring_config where singleton;
  update ops.monitoring_config set started_at = clock_timestamp() - interval '31 hours' where singleton;
  select jobid into v_job_id from cron.job where jobname = 'margincook-purge-changes';
  if v_job_id is not null then
    delete from cron.job_run_details where jobid = v_job_id;
    v := ops_health_status();
    perform pg_temp.ok('첫 실행 유예가 끝난 일 Cron은 이력이 없으면 실패다',
      exists (select 1 from jsonb_array_elements(v#>'{cron,jobs}') j
               where j->>'name' = 'margincook-purge-changes' and (j->>'healthy')::boolean is false));
  end if;
  update ops.monitoring_config set started_at = v_old_start where singleton;
end;
$grace$;

select pg_temp.ok('청소 함수가 ops 버킷도 30일 뒤 지운다',
  position('delete from ops.rpc_error_buckets' in
    lower(pg_get_functiondef('public.purge_entity_changes()'::regprocedure))) > 0);
