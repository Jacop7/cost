# P0-4-OPS-MONITORING-COMMIT-004 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `RECHECK`
- 스냅샷: `COMMIT`
- 대상 SHA: `d3f25214ad43e06513b16570d223b6f6517e8c66`

## 요약

predecessor COMMIT-003의 SEC-006·007·008을 commit d3f2521의 봉인 입력으로 재검증했다. SEC-006(실패-only Cron 거짓 초록): 시험 36의 $failed_only$ 블록(133~164행)이 성공 이력 없이 failed 행만 넣고 purge 작업 healthy가 boolean false, cron.healthy=false, status=degraded임을 확인하고, $health$ 블록(97~103행)은 jobs 배열의 모든 healthy가 jsonb boolean임을 고정한다. 업그레이드 ⑬(577~649행)은 0176 상태에 실패-only 행과 앱 RPC 보고를 넣은 뒤 0177을 적용해 'false|degraded|true|t' → 실패 행 제거 후 'true|ok|true'를 요구하므로 NULL healthy 회귀가 마이그레이션 경로에서도 잡힌다. Edge(57~61행)와 CLI safeBody(11~16행)는 healthy·warning이 boolean이 아니거나 status와 cron 판정이 어긋나면 503 unavailable로 접어 fail-closed다. SEC-007(RPC 신호 분리): 시험 36(85~90행)이 버킷 20건에도 status는 Cron만 따르고 rpc.warning=true임을 확인하고, Edge는 warning=true에도 cron 정상이면 200, CLI ok=true, GitHub 동기화는 '[ops-health] staging rpc warning' 별도 제목·'Cron 장애나 정확한 오류율이 아닙니다' 본문으로 분리되며 workflow 실패는 health 단계(Cron)만 결정한다. 문서(cron-rpc-alerting.md 9~11·26·39~41행)가 판정 기준을 기술한다. 자가 가입 계정의 반복 보고는 이제 warning 이슈 갱신에 그치고 status·workflow를 바꾸지 못하므로 수용 기준을 충족한다. SEC-008: 계약 시험이 토큰 미설정 401(fetch 미호출), 설정 누락 503, 하위 500 본문에 sb_secret·eyJ가 있어도 503 {status:'unavailable'} deepEqual, throw 메시지에 secret이 있어도 동일 본문임을 고정한다. 세 Finding 모두 VERIFIED다. 한계: 실제 보정 SQL인 20260831000177_operations_health_signal_separation.sql은 artifact_paths·input_files에 없어 봉인 스냅샷에 존재하지 않는다. 판정은 봉인된 행동 시험·업그레이드 ⑬·Edge/CLI 방어와 장부의 4a2cbe2 실행 결과(verify 6/6, DB 36/36, 업그레이드 13/13)에 근거하며 0177 원문의 definer·search_path·grant 하이진은 직접 읽지 못했다(시험 36 7~16행이 ops_health_status의 service_role 전용 권한을 새 DB에서 고정한다). 현재 장부에는 SOLAR 턴만 있고 CODEX-FUNCTION-QA 턴이 없다. 이를 Improvement SEC-009로 남겨 다음 봉인 Task(스테이징 훈련 게이트)에 0177 원문을 포함하도록 요청한다. production 미접근·미적용 기록과 원장 불변(⑬ before/after 비교)은 범위 내 증거와 일치한다. PASS이나 외부 게이트는 열려 있다.

## Findings

### P0-4-OPS-SEC-006 — Major / VERIFIED

- 범주: DATA_INTEGRITY
- 검증 엔진: FABLE
- 영향: 실패만 있는 Cron이 NULL healthy로 초록 위장되던 경로가 행동 시험·업그레이드 경로·Edge/CLI 방어로 고정됐다. 0177 원문은 봉인 입력에 없어 SEC-009로 후속 봉인을 요청한다.
- 근거: packages/db/tests/36_operations_monitoring.sql:133, packages/db/tests/36_operations_monitoring.sql:97, packages/db/scripts/upgrade-check.sh:610, packages/db/supabase/functions/ops-health/index.mjs:55, scripts/check-ops-health.mjs:11
- 완료 조건: healthy 식이 NULL을 만들지 않는다: last_success_at이 NULL이고 last_failure_at이 있으면 false로 평가한다. / 전체 판정이 bool_and(coalesce(healthy,false))처럼 NULL 무시에 기대지 않고, 작업 하나라도 healthy가 아니면 cron.healthy=false·status=degraded다. / 응답 jobs 배열의 healthy 값이 항상 boolean이다.
- 필요한 테스트: 36_operations_monitoring.sql: 유예 기간 안에서 성공 이력 없이 status='failed' 행만 삽입한 뒤 해당 작업 healthy=false, cron.healthy=false, status='degraded'를 확인하는 케이스 추가 / 36_operations_monitoring.sql: 응답 jobs 배열의 모든 healthy가 jsonb_typeof='boolean'인지 확인

### P0-4-OPS-SEC-007 — Minor / VERIFIED

- 범주: SECURITY
- 검증 엔진: FABLE
- 영향: 자가 가입 계정의 report_client_rpc_error 반복 호출은 warning 이슈 갱신에 그치고 status·503·workflow 실패를 만들지 못한다. 알림 피로 잔여 위험은 별도 제목으로 격리됐다.
- 근거: packages/db/tests/36_operations_monitoring.sql:85, packages/db/supabase/functions/ops-health/index.mjs:53, scripts/ops-monitoring.test.mjs:107, scripts/sync-ops-health-issue.mjs:7, scripts/sync-ops-health-issue.mjs:61, scripts/ops-monitoring.test.mjs:131, docs/operations/cron-rpc-alerting.md:9, .github/workflows/operations-health.yml:36
- 완료 조건: status 판정에서 Cron 장애와 client-reported RPC 신호를 분리한다(예: rpc는 별도 'warning' 필드로 두고 status는 Cron이 결정하거나, 영향 사용자 수·건수 임계값을 넘을 때만 degraded). / GitHub 이슈 본문 또는 제목에서 Cron 장애와 RPC 경고를 구분해 운영자가 실제 장애를 식별할 수 있다. / 문서(cron-rpc-alerting.md)가 새 임계값과 판정 기준을 기술한다.
- 필요한 테스트: 36_operations_monitoring.sql: 사용자 1명·소수 건 보고만으로는 status가 ok(또는 warning)이고 Cron이 정상인지 확인 / ops-monitoring.test.mjs: rpc 경고만 있는 응답과 Cron 장애 응답의 체크·이슈 동작 차이 계약 추가

### P0-4-OPS-SEC-008 — Improvement / VERIFIED

- 범주: TEST_GAP
- 검증 엔진: FABLE
- 영향: Edge 비밀정보 비노출 계약이 회귀시험으로 고정됐다.
- 근거: scripts/ops-monitoring.test.mjs:18, scripts/ops-monitoring.test.mjs:34, scripts/ops-monitoring.test.mjs:75, scripts/ops-monitoring.test.mjs:91
- 완료 조건: ops-monitoring.test.mjs에 OPS_HEALTH_TOKEN 미설정 401, fetch 예외와 non-OK 응답의 503 본문이 {status:'unavailable'}뿐이며 키·URL·오류 문구를 포함하지 않는 계약을 추가한다.
- 필요한 테스트: ops-monitoring.test.mjs: 토큰 미설정 401 / 하위 500 및 throw → 503 본문 문자열에 'sb_secret'·'eyJ'·Error 메시지가 없음을 확인

### P0-4-OPS-SEC-009 — Improvement / OPEN

- 범주: OTHER
- 영향: SECURITY DEFINER 함수를 다시 정의하는 0177의 search_path·grant·definer 하이진을 보안 lane이 원문으로 검토하지 못했다. 시험 36(7~16행)이 ops_health_status의 service_role 전용 권한을 새 DB에서 고정하고 ⑬이 행동을 고정하므로 차단 사유는 아니나, 후속 봉인 Task에 원문을 포함해야 한다.
- 근거: packages/db/README.md:8, packages/db/scripts/upgrade-check.sh:578, packages/db/tests/36_operations_monitoring.sql:89, COLLABORATION_LOG:0
- 완료 조건: 스테이징 훈련 게이트 이전의 다음 봉인 Task artifact_paths에 packages/db/supabase/migrations/20260831000177_operations_health_signal_separation.sql을 포함해 FABLE-SEC가 원문(definer·set search_path·revoke/grant·자체 검증 블록)을 확인한다. / 해당 Task 장부에 CODEX-FUNCTION-QA 턴으로 target commit 기준 verify 6/6·DB 36/36·업그레이드 13/13 결과를 기록한다.
- 필요한 테스트: 36_operations_monitoring.sql 또는 34_rpc_least_privilege.sql: public.ops_health_status()·report_client_rpc_error의 prosecdef=true와 proconfig에 search_path가 고정돼 있음을 확인

## 공동 편집 제안

### P0-4-OPS-SEC-E010 — ADD

- 대상: `packages/db/tests/36_operations_monitoring.sql`
- 위치: select pg_temp.ok('청소 함수가 ops 버킷도 30일 뒤 지운다',
- 연결 Finding: P0-4-OPS-SEC-009
- 이유: 0177이 봉인 입력 밖에 있어 definer search_path 하이진을 원문으로 확인하지 못했으므로 새 DB 시험으로 고정한다.

    select pg_temp.ok('운영 상태·보고 문은 definer이며 search_path가 고정돼 있다',
      (select bool_and(p.prosecdef and exists (
         select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%'))
         from pg_proc p
        where p.oid in ('public.ops_health_status()'::regprocedure,
                        'public.report_client_rpc_error(text,text,text)'::regprocedure)));
    

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
