
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
