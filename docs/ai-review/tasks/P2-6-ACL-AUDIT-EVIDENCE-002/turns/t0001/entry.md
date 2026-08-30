
## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `a801e4e7af621c9c16e74cad04284bf658fdfdf51c5d31977280b4efb1313a42`
- target_commit_sha: `c148e3d`
- changed_artifact_paths: `admin-acl-source-scan.mjs`, `admin-acl-source-scan.test.mjs`, `P1-1-ACL-SUPPORT-SOURCE-002.md`
- resulting_input_files_sha256: `successor r001 manifest에서 실행기가 봉인·검증 예정`

### P2-6-SEC-001-RPC-SCAN-LITERAL-KEY-EVASION

- disposition: `APPLIED`
- 적용 위치: `packages/db/scripts/admin-acl-source-scan.mjs`
- 적용 내용: StringLiteralLike `rpc` 구조 분해 속성명과 값 위치의 `rpc` 리터럴을 실패 폐쇄해 `const { 'rpc': call }` 및 `const sb = supabase; const key = 'rpc'; sb[key]()` 우회를 닫았다. 직접 `x['rpc']`와 구조 분해 속성명은 중복 위치 보고에서 제외했다.
- 실행한 테스트: 문자열 속성명 구조 분해와 별칭 계산 키 회귀시험이 각각 실패 경로를 확인하고 전체 스캐너 13/13 통과.
- 필요한 재검수: 두 우회가 실패하고 일반 `handlers[key]()`는 오인하지 않는지 확인.

### P2-6-SEC-002-SOURCE-SCAN-TEST-COVERAGE

- disposition: `APPLIED`
- 적용 위치: `packages/db/scripts/admin-acl-source-scan.test.mjs`
- 적용 내용: bracket 리터럴, `.rpc` 함수 별칭, 비리터럴 첫 인자, spread 인자, 빈 소스 루트와 Finding 001의 두 우회를 추가해 6개에서 13개로 늘렸다.
- 실행한 테스트: `node packages/db/scripts/admin-acl-source-scan.test.mjs` 13/13, verify ③에서 같은 13/13 실행.
- 필요한 재검수: 요구된 다섯 경로와 총계 출력·verify 연결 확인.

### P2-6-SEC-003-EVIDENCE-SQL-HASH-BINDING

- disposition: `APPLIED`
- 적용 위치: `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`
- 적용 내용: Finding 반영 commit `52a32b5`의 네 파일 Git blob OID와 blob bytes 기준 SHA-256을 기록하고 CRLF 작업 트리 해시가 아님을 명시했다. V2 32/87에서 P0-5 뒤 0/0으로 바뀐 근거와 `corepack pnpm verify` 최종 출력 원문, exit 0, fresh DB 0개를 추가했다.
- 실행한 테스트: blob OID·SHA-256을 `git rev-parse`·`git show` bytes로 재계산, 전체 verify 6/6, DB 34/34, 업그레이드 10/10, fresh 0.
- 필요한 재검수: 표의 OID·SHA와 target blob, 원문 블록, P0-5 연결 확인.

- next_review_request: `CODEX_EVIDENCE`
