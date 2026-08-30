# P0-4-OPS-MONITORING-COMMIT-003 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `SECURITY`
- 스냅샷: `COMMIT`
- 대상 SHA: `53e6799ac3ad968b93d7b76c23551770db9b3186`

## 요약

최종 commit 53e6799의 운영 관측 경계를 보안 관점에서 다시 검수했다. 선행 r002의 다섯 지적은 모두 실제 코드와 행동 시험으로 제거됐다. SEC-001: 0176이 'NOCODE'/'BADCODE'로 정렬됐고(84·100행) 앱 기본값(rpcMonitoring.ts 26행)과 일치하며, 시험 36(35~49행)이 null·공백·형태 불일치 코드의 실제 저장 행을 확인하고 업그레이드 ⑫(559·567행)도 코드 없는 보고를 포함해 2건을 센다. SEC-002: 실패 집계가 status='failed'만 사용하고(186행) starting 행 양성 시험(98~122행)이 있다. SEC-003: 앱이 전송 전 code·details를 정규식으로 검사해 원문을 보내지 않으며(26~31행) 한글 사용자값 비전송·동기/비동기 실패 격리 시험이 있다. SEC-004: 열린 이슈를 updated 최신순으로 조회하고(28행) 계약 시험이 URL을 고정한다. SEC-005: checkout·setup-node가 전체 commit SHA로 고정되고 태그 회귀를 시험이 막는다. 그 밖의 경계도 견고하다: ops 스키마·표·ops_health_status는 service_role 전용이고 migration 자체 검증·시험 34/36·ACL 감사가 고정한다. Edge 함수는 토큰 미설정·불일치 401, 하위 실패는 모두 503 'unavailable'로 접어 secret/service 키와 내부 오류를 노출하지 않는다. 워크플로는 issues:write만 갖고 continue-on-error 뒤 별도 단계로 최종 실패시키며 production secret이 없다. 문서는 오류율이 아닌 client-reported 건수로 한정한다. 그러나 새 결함 하나가 PASS를 막는다. ops_health_status의 healthy 식은 last_success_at이 NULL이고 last_failure_at만 있을 때 SQL 3값 논리로 NULL이 되고, bool_and는 NULL을 무시하므로 다른 두 작업이 정상이면 cron.healthy=true·status=ok가 된다. 즉 배포 직후 유예 기간(1분 Cron 5분, 일 Cron 최대 30시간) 동안 매 실행 실패만 하는 작업이 초록으로 위장된다. 이는 P0-4-OPS-1·5의 '실패 판정·거짓 초록 금지'를 어기며 시험 36에는 실패만 있는 경로가 없다. 추가로 인증된 임의 계정(enable_signup=true)이 15분마다 직접 호출 한 번으로 status를 degraded에 고정해 GitHub 장애 이슈와 실패 run을 무한 유지할 수 있는 점을 Minor로, Edge 비밀 비노출 계약 시험 공백을 Improvement로 남긴다. Major·Minor 수정과 회귀시험 뒤 RECHECK가 필요하다. production 적용은 범위 밖이다.

## Findings

### P0-4-OPS-SEC-006 — Major / OPEN

- 범주: DATA_INTEGRITY
- 영향: 배포 직후 또는 이력이 초기화된 뒤 매 실행 실패만 하는 Cron 작업(특히 일 1회 purge)이 최대 30시간 동안 cron.healthy=true·status=ok로 보고돼 GitHub 정기 작업이 초록을 유지한다. P0-4-OPS-1의 실패 판정과 P0-4-OPS-5의 '실패를 성공으로 위장하지 않는다' 계약이 깨진다.
- 근거: packages/db/supabase/migrations/20260830000176_operations_monitoring.sql:190, packages/db/supabase/migrations/20260830000176_operations_monitoring.sql:167, packages/db/supabase/migrations/20260830000176_operations_monitoring.sql:231, scripts/check-ops-health.mjs:17, packages/db/tests/36_operations_monitoring.sql:124
- 완료 조건: healthy 식이 NULL을 만들지 않는다: last_success_at이 NULL이고 last_failure_at이 있으면 false로 평가한다. / 전체 판정이 bool_and(coalesce(healthy,false))처럼 NULL 무시에 기대지 않고, 작업 하나라도 healthy가 아니면 cron.healthy=false·status=degraded다. / 응답 jobs 배열의 healthy 값이 항상 boolean이다.
- 필요한 테스트: 36_operations_monitoring.sql: 유예 기간 안에서 성공 이력 없이 status='failed' 행만 삽입한 뒤 해당 작업 healthy=false, cron.healthy=false, status='degraded'를 확인하는 케이스 추가 / 36_operations_monitoring.sql: 응답 jobs 배열의 모든 healthy가 jsonb_typeof='boolean'인지 확인

### P0-4-OPS-SEC-007 — Minor / OPEN

- 범주: SECURITY
- 영향: 임의의 자가 가입 계정이 15분마다 PostgREST로 report_client_rpc_error('XX001','INTERNAL_FAILURE','web')을 한 번 호출하면 스테이징(향후 운영) 헬스가 무기한 degraded·503으로 고정되고 GitHub 장애 이슈가 계속 갱신된다. 알림 피로로 실제 Cron 장애 신호가 묻히며 P0-4-OPS-5의 알림 신뢰가 훼손된다.
- 근거: packages/db/supabase/migrations/20260830000176_operations_monitoring.sql:112, packages/db/supabase/migrations/20260830000176_operations_monitoring.sql:232, packages/db/supabase/config.toml:23, .github/workflows/operations-health.yml:36
- 완료 조건: status 판정에서 Cron 장애와 client-reported RPC 신호를 분리한다(예: rpc는 별도 'warning' 필드로 두고 status는 Cron이 결정하거나, 영향 사용자 수·건수 임계값을 넘을 때만 degraded). / GitHub 이슈 본문 또는 제목에서 Cron 장애와 RPC 경고를 구분해 운영자가 실제 장애를 식별할 수 있다. / 문서(cron-rpc-alerting.md)가 새 임계값과 판정 기준을 기술한다.
- 필요한 테스트: 36_operations_monitoring.sql: 사용자 1명·소수 건 보고만으로는 status가 ok(또는 warning)이고 Cron이 정상인지 확인 / ops-monitoring.test.mjs: rpc 경고만 있는 응답과 Cron 장애 응답의 체크·이슈 동작 차이 계약 추가

### P0-4-OPS-SEC-008 — Improvement / OPEN

- 범주: TEST_GAP
- 영향: required_evidence의 'Edge 비밀정보 비노출 계약'이 코드로만 보장되고 회귀시험으로 고정되지 않아 이후 리팩터링 시 내부 오류 본문이 노출돼도 verify가 잡지 못한다.
- 근거: packages/db/supabase/functions/ops-health/index.mjs:32, packages/db/supabase/functions/ops-health/index.mjs:51, scripts/ops-monitoring.test.mjs:18
- 완료 조건: ops-monitoring.test.mjs에 OPS_HEALTH_TOKEN 미설정 401, fetch 예외와 non-OK 응답의 503 본문이 {status:'unavailable'}뿐이며 키·URL·오류 문구를 포함하지 않는 계약을 추가한다.
- 필요한 테스트: ops-monitoring.test.mjs: 토큰 미설정 401 / 하위 500 및 throw → 503 본문 문자열에 'sb_secret'·'eyJ'·Error 메시지가 없음을 확인

## 공동 편집 제안

### P0-4-OPS-SEC-E007 — REPLACE

- 대상: `packages/db/supabase/migrations/20260830000176_operations_monitoring.sql`
- 위치:              and (last_failure_at is null or last_success_at >= last_failure_at) as healthy
- 연결 Finding: P0-4-OPS-SEC-006
- 이유: 성공 이력이 없고 실패만 있을 때 healthy가 NULL이 아니라 false가 되게 해 거짓 초록을 막는다.

                 and (last_failure_at is null
                      or (last_success_at is not null and last_success_at >= last_failure_at)) as healthy

### P0-4-OPS-SEC-E008 — REPLACE

- 대상: `packages/db/supabase/migrations/20260830000176_operations_monitoring.sql`
- 위치:     select coalesce(bool_and(healthy), false),
- 연결 Finding: P0-4-OPS-SEC-006
- 이유: bool_and의 NULL 무시에 기대지 않고 판정 불가 작업을 실패로 취급한다. jobs 배열의 'healthy'도 coalesce(healthy, false)로 내보내 boolean을 보장한다.

        select coalesce(bool_and(coalesce(healthy, false)), false),

### P0-4-OPS-SEC-E009 — ADD

- 대상: `packages/db/tests/36_operations_monitoring.sql`
- 위치: $grace$;
- 연결 Finding: P0-4-OPS-SEC-006
- 이유: 성공 이력 없는 실패 경로가 NULL로 빠져 초록이 되는 회귀를 행동 시험으로 고정한다.

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
                   where j->>'name' = 'margincook-purge-changes' and (j->>'healthy')::boolean is false));
        perform pg_temp.eq_t('실패만 있는 작업이 있으면 전체 Cron도 degraded다', v#>>'{cron,healthy}', 'false');
        delete from cron.job_run_details where runid = v_run_id;
      end if;
    end;
    $failed_only$;

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: P0-4-OPS-SEC-006, P0-4-OPS-SEC-007

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
