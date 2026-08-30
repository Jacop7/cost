# P0-4-OPS-MONITORING-001 Fable 검수 — r002

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `95e521eb33eb9297801df3f724f80394315f6cb0`

## 요약

보안 경계는 대체로 견고하다. ops 스키마·테이블·ops_health_status는 service_role 전용으로 잠겨 있고 migration 자체 검증과 시험 36·ACL 감사가 이를 고정한다. Edge 함수는 토큰 미설정·불일치 시 401, 하위 오류는 모두 503 'unavailable'로 접어 service/secret 키나 내부 오류를 노출하지 않으며, 워크플로는 continue-on-error 뒤 별도 단계로 최종 실패시켜 장애를 성공으로 위장하지 않는다. 문서도 오류율이 아닌 client-reported 건수로 한정한다. 그러나 차단급 결함 1건이 있다. report_client_rpc_error는 코드가 비어 있는 오류를 'NO_CODE'→'BAD_CODE'로 정규화하는데 두 값 모두 밑줄을 포함해 error_code 체크 제약 '^[A-Z0-9]{3,10}$'을 위반한다. 따라서 네트워크·전송 계층 실패처럼 SQLSTATE가 없는 예상 밖 오류(앱이 'NO_CODE'로 보내는 바로 그 부류)는 서버에서 23514 예외로 끝나 한 건도 기록되지 않고, fire-and-forget이라 앱에서도 조용히 사라진다. 시험 36·앱 시험 모두 코드 없는 보고의 서버 반영을 검증하지 않아 놓쳤다. 그 밖에 pg_cron의 과도 상태(starting/sending/connecting)를 실패로 세어 거짓 degraded 이슈가 열릴 수 있는 점, 앱이 원문 details를 형태 검사 없이 전송하는 점, GitHub 이슈 조회가 최근 100건으로 한정돼 장기적으로 회복 종료가 실패할 수 있는 점을 Minor로 남긴다. Major 수정과 시험 추가 뒤 RECHECK가 필요하다.

## Findings

### P0-4-OPS-SEC-001 — Major / OPEN

- 범주: CODE
- 영향: SQLSTATE가 없는 예상 밖 실패(fetch 실패·게이트웨이 오류·비구조 코드)는 서버에서 예외로 끝나 ops.rpc_error_buckets에 한 건도 남지 않는다. 운영 안전망이 가장 필요한 전송 계층 장애가 관측에서 완전히 빠져 거짓 초록을 만들고, 앱은 오류를 삼키므로 아무도 알아채지 못한다.
- 근거: packages/db/supabase/migrations/20260830000176_operations_monitoring.sql:23, packages/db/supabase/migrations/20260830000176_operations_monitoring.sql:84, packages/db/supabase/migrations/20260830000176_operations_monitoring.sql:99, packages/db/supabase/migrations/20260830000176_operations_monitoring.sql:123, apps/mobile/src/lib/rpcMonitoring.ts:27, packages/db/tests/36_operations_monitoring.sql:20, apps/mobile/tests/rpcMonitoring.test.ts:23
- 완료 조건: 코드 없음·형태 불일치 대체값이 error_code 체크 제약과 일치한다(예: 'NOCODE'·'BADCODE' 또는 제약에 '_' 허용). / 앱 기본값(rpcMonitoring.ts)과 서버 기본값이 같은 문자열로 정렬된다. / report_client_rpc_error(null, null, 'web')과 report_client_rpc_error('bad code!', null, 'web')이 reported=true를 반환하고 버킷 1행이 생긴다.
- 필요한 테스트: 36_operations_monitoring.sql에 p_code null·빈 문자열·형태 불일치 입력의 reported=true와 저장된 error_code 값 검증 추가 / rpcMonitoring.test.ts 기본값 문자열을 서버 대체값과 동일하게 갱신 / upgrade-check.sh 12번째 경로에 코드 없는 보고 1건 추가

### P0-4-OPS-SEC-002 — Minor / OPEN

- 범주: OPERATIONS
- 영향: 실제 장애 없이 degraded 503과 GitHub 이슈 생성·재오픈이 반복될 수 있어 알림 신뢰가 떨어지고 진짜 장애 신호가 묻힌다.
- 근거: packages/db/supabase/migrations/20260830000176_operations_monitoring.sql:184, packages/db/supabase/migrations/20260830000176_operations_monitoring.sql:192, .github/workflows/operations-health.yml:3
- 완료 조건: 실패 판정은 status = 'failed'만 사용하거나 과도 상태를 running과 같이 제외한다. / 1분 Cron이 방금 시작된 상태(starting)에서 ops_health_status가 healthy=true를 유지한다.
- 필요한 테스트: 36 시험에 job_run_details에 status='starting' 행을 삽입한 뒤 healthy=true를 확인하는 케이스 추가

### P0-4-OPS-SEC-003 — Minor / OPEN

- 범주: SECURITY
- 영향: 저장은 막히지만 사용자 입력이 섞인 원문 details가 네트워크·게이트웨이·요청 로그를 거친다. 요구사항의 '원문·사용자 입력 비전송' 취지를 앱 경계에서 보장하지 못한다.
- 근거: apps/mobile/src/lib/supabase.ts:124, apps/mobile/src/lib/rpcMonitoring.ts:27, packages/db/supabase/migrations/20260830000176_operations_monitoring.sql:102
- 완료 조건: 앱이 전송 전 details를 '^[A-Z0-9_]{1,80}$'로 검사해 불일치 시 'UNSTRUCTURED'로 대체한다. / 서버 정규화는 방어선으로 유지한다.
- 필요한 테스트: rpcMonitoring.test.ts에 details='Key (name)=(홍길동)' 입력 시 p_detail이 'UNSTRUCTURED'이고 호출 인자에 원문이 없음을 확인

### P0-4-OPS-SEC-004 — Minor / OPEN

- 범주: OPERATIONS
- 영향: 저장소 이슈·PR이 100건을 넘으면 기존 장애 이슈를 놓쳐 중복 이슈가 생기거나 회복 시 닫히지 않은 채 남는다. 요구사항의 '회복 시 닫는다' 계약이 장기적으로 깨진다.
- 근거: scripts/sync-ops-health-issue.mjs:27, scripts/sync-ops-health-issue.mjs:47
- 완료 조건: 전용 라벨(예: ops-health)을 붙여 labels 필터로 조회하거나 open 상태를 우선 조회한다. / 회복 시 열린 대상 이슈를 100건 이후에도 찾아 닫는다.
- 필요한 테스트: ops-monitoring.test.mjs에 조회 URL이 라벨 필터를 포함하는지와 생성 요청에 라벨이 포함되는지 확인

### P0-4-OPS-SEC-005 — Improvement / OPEN

- 범주: SECURITY
- 영향: 태그 참조는 상류 액션 변경에 노출된다. 비밀 토큰을 다루는 정기 워크플로이므로 커밋 SHA 고정이 바람직하다.
- 근거: .github/workflows/operations-health.yml:21
- 완료 조건: 사용 액션을 커밋 SHA로 고정하고 주석에 버전을 남긴다.
- 필요한 테스트: 없음

## 공동 편집 제안

### P0-4-OPS-SEC-E001 — REPLACE

- 대상: `packages/db/supabase/migrations/20260830000176_operations_monitoring.sql`
- 위치:   v_code text := upper(coalesce(nullif(btrim(p_code), ''), 'NO_CODE'));
- 연결 Finding: P0-4-OPS-SEC-001
- 이유: 기본값이 error_code 체크 제약 '^[A-Z0-9]{3,10}$'에 맞아야 코드 없는 오류가 저장된다.

      v_code text := upper(coalesce(nullif(btrim(p_code), ''), 'NOCODE'));

### P0-4-OPS-SEC-E002 — REPLACE

- 대상: `packages/db/supabase/migrations/20260830000176_operations_monitoring.sql`
- 위치:     v_code := 'BAD_CODE';
- 연결 Finding: P0-4-OPS-SEC-001
- 이유: 형태 불일치 대체값도 제약을 통과해야 insert가 23514로 실패하지 않는다.

        v_code := 'BADCODE';

### P0-4-OPS-SEC-E003 — REPLACE

- 대상: `apps/mobile/src/lib/rpcMonitoring.ts`
- 위치:       p_code: error.code ?? 'NO_CODE',
- 연결 Finding: P0-4-OPS-SEC-001, P0-4-OPS-SEC-003
- 이유: 앱 기본값을 서버와 정렬하고, 원문 details를 전송 전에 형태 검사해 사용자 입력이 경계를 넘지 않게 한다. 바로 아래 기존 p_detail 줄은 제거한다.

          p_code: error.code ?? 'NOCODE',
          p_detail: /^[A-Z0-9_]{1,80}$/.test(error.details ?? '') ? (error.details as string) : (error.details ? 'UNSTRUCTURED' : 'NONE'),

### P0-4-OPS-SEC-E004 — ADD

- 대상: `packages/db/tests/36_operations_monitoring.sql`
- 위치: select pg_temp.eq_t('같은 오류는 같은 버킷에 합친다',
- 연결 Finding: P0-4-OPS-SEC-001
- 이유: 코드 없음·형태 불일치 경로가 제약과 충돌하지 않음을 회귀시험으로 고정한다. 뒤따르는 버킷 행 수·합계 기대값은 함께 조정한다.

    select pg_temp.eq_t('코드 없는 전송 실패도 예상 밖 신호로 기록한다',
      report_client_rpc_error(null, null, 'web')->>'reported', 'true');
    select pg_temp.eq_t('형태가 깨진 코드는 대체값으로 기록한다',
      report_client_rpc_error('bad code!', 'Key (name)=(user)', 'ios')->>'reported', 'true');

### P0-4-OPS-SEC-E005 — REPLACE

- 대상: `packages/db/supabase/migrations/20260830000176_operations_monitoring.sql`
- 위치:                    (where d.status not in ('succeeded', 'running')) last_failure_at,
- 연결 Finding: P0-4-OPS-SEC-002
- 이유: pg_cron 과도 상태(starting·sending·connecting)를 실패로 세지 않아 거짓 degraded를 막는다.

                       (where d.status = 'failed') last_failure_at,

### P0-4-OPS-SEC-E006 — REPLACE

- 대상: `scripts/sync-ops-health-issue.mjs`
- 위치:   const issues = await api('/issues?state=all&per_page=100');
- 연결 Finding: P0-4-OPS-SEC-004
- 이유: 전용 라벨로 조회 범위를 좁혀 이슈가 100건을 넘어도 기존 장애 이슈를 찾는다. 생성 body에 labels: ['ops-health']를 함께 추가한다.

      const issues = await api('/issues?state=all&labels=ops-health&per_page=100');

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: P0-4-OPS-SEC-001, P0-4-OPS-SEC-002, P0-4-OPS-SEC-003, P0-4-OPS-SEC-004

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
