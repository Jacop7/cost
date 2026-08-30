
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
