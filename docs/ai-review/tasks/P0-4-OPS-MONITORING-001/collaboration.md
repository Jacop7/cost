# P0-4-OPS-MONITORING-001 공동 작업 장부

> 이 장부는 Cron/RPC 운영 관측, Edge 헬스 엔드포인트와 스테이징 장애 알림의 단일 공식
> 소스·시험·운영 문서를 솔라와 페이블이 함께 개선하는 append-only 기록이다. 직접 편집은 이 최초
> 패킷 작성까지만이며 이후 턴은 `corepack pnpm fable:append` 또는 검수 실행기로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `95e521eb33eb9297801df3f724f80394315f6cb0`
- artifact_hashes: 실행기의 `manifest.json`과 WORKING snapshot이 이번 변경의 정확한 파일별 SHA-256을 봉인한다.
- changed_artifact_paths: `task.json`의 `artifact_paths` 전체
- 충족해야 할 요구사항·불변식: `P0-4-OPS-1..7`, service-role 최소 권한, 오류 원문 비저장, 실패 폐쇄, production 미적용
- 이번에 바꾼 내용: Cron 3종 상태와 client-reported 예상 밖 RPC 오류 건수를 집계하는 0176, 별도 토큰 Edge 헬스 문, GitHub 10분 정기 장애 이슈 생성·회복 종료, 앱 중앙 오류 보고와 회귀시험·운영 문서를 추가했다.
- 집중 검토 질문: definer·ops ACL·오류 필터·동시 상한에 우회가 있는가? Edge 토큰·secret key·오류가 노출되는가? Cron 최초 유예·실패 회복 판정이 거짓 초록/빨강을 내는가? 워크플로가 장애를 성공으로 위장하거나 이슈를 닫지 못하는가? 정확한 오류율로 과장한 문구가 남았는가?
- 실행한 테스트·현재 증거: 관련 DB 16·36, 실DB ACL 계약, 앱 보고 4건, 운영 스크립트 22건, 로컬 Edge 무토큰 401·정상 200·Cron 3종 healthy를 확인했다. 전체 `pnpm verify`는 보안 목록 동기화 뒤 재실행 중이며 스테이징 실훈련은 정확한 SHA CI 뒤에만 수행한다.
- 사람 결정이 필요한 항목: 7일 PITR 추가 결제와 production 적용은 후속 사람 결정으로 남긴다. 이번 승인 범위는 스테이징 관측 배포·장애/복구 훈련까지다.
- next_review_request: `FABLE_REVIEW`


<!-- fable-review:r002 sha256=54a76aceb59d13981136f0d898916b1776612f83bc820b4d3f5152ee65819d04 -->
## FABLE_REVIEW · turn-f002 · r002

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `54a76aceb59d13981136f0d898916b1776612f83bc820b4d3f5152ee65819d04`
- target_commit_sha: `95e521eb33eb9297801df3f724f80394315f6cb0`
- input_files_sha256: `75bfca6033ca2cc2ef8ca8fc9711367e6e99badd2d1f05a5a73e979cb0dc911b`
- 원본 검수: [r002/review.md](./rounds/r002/review.md)
- 필수 미종결 Finding: P0-4-OPS-SEC-001, P0-4-OPS-SEC-002, P0-4-OPS-SEC-003, P0-4-OPS-SEC-004
- 선택 미종결 Finding: P0-4-OPS-SEC-005
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

보안 경계는 대체로 견고하다. ops 스키마·테이블·ops_health_status는 service_role 전용으로 잠겨 있고 migration 자체 검증과 시험 36·ACL 감사가 이를 고정한다. Edge 함수는 토큰 미설정·불일치 시 401, 하위 오류는 모두 503 'unavailable'로 접어 service/secret 키나 내부 오류를 노출하지 않으며, 워크플로는 continue-on-error 뒤 별도 단계로 최종 실패시켜 장애를 성공으로 위장하지 않는다. 문서도 오류율이 아닌 client-reported 건수로 한정한다. 그러나 차단급 결함 1건이 있다. report_client_rpc_error는 코드가 비어 있는 오류를 'NO_CODE'→'BAD_CODE'로 정규화하는데 두 값 모두 밑줄을 포함해 error_code 체크 제약 '^[A-Z0-9]{3,10}$'을 위반한다. 따라서 네트워크·전송 계층 실패처럼 SQLSTATE가 없는 예상 밖 오류(앱이 'NO_CODE'로 보내는 바로 그 부류)는 서버에서 23514 예외로 끝나 한 건도 기록되지 않고, fire-and-forget이라 앱에서도 조용히 사라진다. 시험 36·앱 시험 모두 코드 없는 보고의 서버 반영을 검증하지 않아 놓쳤다. 그 밖에 pg_cron의 과도 상태(starting/sending/connecting)를 실패로 세어 거짓 degraded 이슈가 열릴 수 있는 점, 앱이 원문 details를 형태 검사 없이 전송하는 점, GitHub 이슈 조회가 최근 100건으로 한정돼 장기적으로 회복 종료가 실패할 수 있는 점을 Minor로 남긴다. Major 수정과 시험 추가 뒤 RECHECK가 필요하다.

### 공동 편집 제안 색인

- P0-4-OPS-SEC-E001: REPLACE `packages/db/supabase/migrations/20260830000176_operations_monitoring.sql` ·   v_code text := upper(coalesce(nullif(btrim(p_code), ''), 'NO_CODE')); · 원문은 review.md 참조
- P0-4-OPS-SEC-E002: REPLACE `packages/db/supabase/migrations/20260830000176_operations_monitoring.sql` ·     v_code := 'BAD_CODE'; · 원문은 review.md 참조
- P0-4-OPS-SEC-E003: REPLACE `apps/mobile/src/lib/rpcMonitoring.ts` ·       p_code: error.code ?? 'NO_CODE', · 원문은 review.md 참조
- P0-4-OPS-SEC-E004: ADD `packages/db/tests/36_operations_monitoring.sql` · select pg_temp.eq_t('같은 오류는 같은 버킷에 합친다', · 원문은 review.md 참조
- P0-4-OPS-SEC-E005: REPLACE `packages/db/supabase/migrations/20260830000176_operations_monitoring.sql` ·                    (where d.status not in ('succeeded', 'running')) last_failure_at, · 원문은 review.md 참조
- P0-4-OPS-SEC-E006: REPLACE `scripts/sync-ops-health-issue.mjs` ·   const issues = await api('/issues?state=all&per_page=100'); · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r002 -->

## SOLAR_RESPONSE · turn-s002 · r002

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f002`
- reply_to_review_sha256: `54a76aceb59d13981136f0d898916b1776612f83bc820b4d3f5152ee65819d04`
- target_commit_sha: `95e521eb33eb9297801df3f724f80394315f6cb0`
- changed_artifact_paths: `packages/db/supabase/migrations/20260830000176_operations_monitoring.sql`, `packages/db/tests/36_operations_monitoring.sql`, `packages/db/scripts/upgrade-check.sh`, `apps/mobile/src/lib/rpcMonitoring.ts`, `apps/mobile/tests/rpcMonitoring.test.ts`, `scripts/sync-ops-health-issue.mjs`, `scripts/ops-monitoring.test.mjs`, `.github/workflows/operations-health.yml`
- resulting_input_files_sha256: 다음 RECHECK의 WORKING snapshot과 manifest가 수정된 전체 입력을 새 SHA-256으로 봉인한다.
- artifact_hashes: 다음 RECHECK manifest의 파일별 SHA-256이 권위다.

### P0-4-OPS-SEC-001

- disposition: `APPLIED`
- 적용 위치: 0176, DB 시험 36, 업그레이드 경로 ⑫, 앱 보고 경계
- 적용 내용: 밑줄 없는 `NOCODE`·`BADCODE`로 앱과 서버를 정렬했다. null·형태 불일치 코드가 실제 버킷에 저장되고 0175→0176 업그레이드에서도 코드 없는 오류를 포함해 2건이 집계되는 시험을 추가했다.
- 실행한 테스트: DB 36 단독 통과, 코드 대체값 실제 행 확인.
- 필요한 재검수: 대체값·CHECK·업그레이드 경로 정렬 확인.

### P0-4-OPS-SEC-002

- disposition: `APPLIED`
- 적용 위치: 0176 Cron 실패 집계, DB 시험 36
- 적용 내용: 마지막 실패는 `status='failed'`만 집계한다. `starting` 행을 최신 실행으로 넣어도 1분 Cron이 healthy를 유지하는 행동 시험을 추가했다.
- 실행한 테스트: DB 36 단독 통과, starting 양성 경로 확인.
- 필요한 재검수: 과도 상태가 실패 시각을 만들지 않는지 확인.

### P0-4-OPS-SEC-003

- disposition: `APPLIED`
- 적용 위치: `rpcMonitoring.ts`, `rpcMonitoring.test.ts`
- 적용 내용: 앱이 코드와 detail을 허용 형태로 검사하고, 원문이 구조화되지 않으면 `BADCODE`·`UNSTRUCTURED`만 전송한다. 동기·비동기 보고 실패도 원래 오류 흐름을 막지 않는다.
- 실행한 테스트: 모바일 보고 시험 5/5 통과, 한글 사용자값 비전송 확인.
- 필요한 재검수: 앱 호출 인자에 원문이 남지 않는지 확인.

### P0-4-OPS-SEC-004

- disposition: `APPLIED`
- 적용 위치: `sync-ops-health-issue.mjs`, `ops-monitoring.test.mjs`
- 적용 내용: 장애 중인 이슈는 매 실행 갱신된다는 불변식에 맞춰 열린 이슈를 최신순으로 조회한다. 따라서 전체 이슈가 100건을 넘어도 현재 열린 장애가 회복 종료 대상에서 밀리지 않는다.
- 실행한 테스트: 조회 URL의 `state=open&sort=updated&direction=desc` 계약 통과.
- 필요한 재검수: 새 장애 생성·진행 중 갱신·회복 종료 흐름 확인.

### P0-4-OPS-SEC-005

- disposition: `APPLIED`
- 적용 위치: `.github/workflows/operations-health.yml`, `ops-monitoring.test.mjs`
- 적용 내용: `actions/checkout`과 `actions/setup-node`의 v4 태그가 현재 가리키는 전체 커밋 SHA를 고정하고 주석에 v4를 남겼다. 태그 참조가 다시 들어오면 계약 시험이 실패한다.
- 실행한 테스트: 운영 모니터링 계약 22/22 통과.
- 필요한 재검수: 워크플로 action ref가 전체 SHA인지 확인.

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r002

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `95e521eb33eb9297801df3f724f80394315f6cb0`
- verified_input_files_sha256: 다음 `FABLE_RECHECK`의 WORKING snapshot·manifest가 최종 수정본 전체를 봉인하는 값이 권위다.
- artifact_hashes: `task.json`의 artifact_paths 전체를 최종 작업본으로 검증했으며 다음 RECHECK manifest의 파일별 SHA-256을 권위로 삼는다.
- finding_ids: `P0-4-OPS-SEC-001`, `P0-4-OPS-SEC-002`, `P0-4-OPS-SEC-003`, `P0-4-OPS-SEC-004`, `P0-4-OPS-SEC-005`

### 실행 명령

- `corepack pnpm verify`
- `docker exec supabase_db_margincook psql ...`로 migration 파일/장부 집합·중복·최신 버전 대조
- 로컬 Edge Runtime에서 무토큰 호출과 올바른 토큰 호출
- `git diff --check`

### 종료 코드·결과

- 최종 `corepack pnpm verify`: exit 0, 6/6 전부 통과. 타입 5.6초, 시험 21.2초, CLI·ACL 16.3초, 새 DB 144.6초, 업그레이드 1126.4초, 웹 번들 6.8초.
- DB 36/36, core 176, mobile 212, 운영 모니터링 계약 22/22, 업그레이드 경로 12/12, 2세션 경합·locale parity 통과.
- migration 파일 165개와 개발 장부 165개가 정확히 일치하고 누락·중복 0, 최신 버전은 `20260830000176`이다. 종료 뒤 `fresh_*` DB는 0개다.
- 로컬 Edge Runtime: 무토큰 401, 올바른 토큰 200, Cron 3종 `healthy=true`, 예상 밖 RPC 보고 0건을 확인했다.
- `git diff --check`: 공백 오류 0건. 줄끝 변환 경고만 존재한다.

### Finding별 회귀 증거

- SEC-001: null·빈 문자열·형태 불일치 코드가 `NOCODE`·`BADCODE`로 실제 버킷에 저장되며, 0175→0176 업그레이드 ⑫에서도 코드 없는 오류를 포함해 2건이 집계된다.
- SEC-002: 최신 Cron 실행 상태가 `starting`이어도 실패로 세지 않고 healthy를 유지하며, 실제 `failed`만 마지막 실패로 집계한다.
- SEC-003: 앱은 허용 형태가 아닌 code/detail을 `BADCODE`·`UNSTRUCTURED`로 바꾸고 한글 사용자 원문을 전송하지 않는다. 보고기의 동기·비동기 실패는 원래 RPC 오류 흐름을 막지 않는다.
- SEC-004: GitHub 장애 이슈는 `state=open&per_page=100&sort=updated&direction=desc`로 조회해 생성·갱신·회복 종료 흐름을 유지한다.
- SEC-005: checkout·setup-node는 전체 commit SHA로 고정됐고 태그 참조가 돌아오면 운영 계약 시험이 실패한다.

- 증거 파일·로그 위치: `%TEMP%\margincook-ops-verify-exact-final.log`, `packages/db/tests/36_operations_monitoring.sql`, `packages/db/scripts/upgrade-check.sh`, `apps/mobile/tests/rpcMonitoring.test.ts`, `scripts/ops-monitoring.test.mjs`
- 미실행 항목과 이유: 정확한 commit SHA의 보호 CI와 스테이징 migration·Edge·secret·장애/회복 훈련은 Fable RECHECK와 anchor/decision commit 전이라 의도적으로 실행하지 않았다. production은 승인 범위 밖이다.
- next_review_request: `FABLE_RECHECK`

## HUMAN_DECISION · turn-h001

- role: `HUMAN`
- reply_to_turn_id: `turn-c001`
- finding_ids: `P0-4-OPS-SEC-001`, `P0-4-OPS-SEC-002`, `P0-4-OPS-SEC-003`, `P0-4-OPS-SEC-004`, `P0-4-OPS-SEC-005`
- decision_id: `P0-4-OPS-FABLE-ADDITIONAL-BUDGET-20260831`
- task_budget_additional_usd_approved: `2.00`
- 결정: 기존 Task의 불변 4.00 USD 상한과 모든 실패·검수 기록은 수정하지 않는다. 최종 구현 commit을 대상으로 별도 FABLE-SEC 보안 검수 Task를 만들고, 앞선 다섯 Finding의 수정 결과와 전체 범위를 다시 검토하는 외부 호출 한 번에 최대 2.00 USD 상당 사용량을 승인한다.
- 허용 범위·기한: 현재 Claude Code Max 로그인 세션의 읽기 전용 검수만 허용한다. 별도 API 결제·Opus 대체·제품 파일 직접 수정·production 배포는 허용하지 않는다.
- 근거: 사용자가 2026-08-31 대화에서 추가 2.00 USD 상당 실행 상한을 명시적으로 승인했다.
- 승인자·시각: `HUMAN · 2026-08-31T01:04:00+09:00`
- next_review_request: `FABLE_SECURITY_REVIEW_ON_EXACT_COMMIT`
