# AI-REVIEW-1-COMMIT-DOCS-001 공동 장부

- protocol: `1.1`
- route: `FINAL_INDEPENDENT`
- target: `3637a36b43ddf31d8b991254e36b6f2c4440f142`

최초 독립 감사는 `task.json`의 `independent_request`만 사용한다.


<!-- fable-review:r001 sha256=a314ff8edc74e339ff29460ed45e93859111def72172a7e1c0fc18104389e3ef -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-FINAL`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `a314ff8edc74e339ff29460ed45e93859111def72172a7e1c0fc18104389e3ef`
- target_commit_sha: `3637a36b43ddf31d8b991254e36b6f2c4440f142`
- input_files_sha256: `4f53e8a044b746b89845603d8fb0682d7419cc0f23e523276afc61aca2f75b89`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: FINAL-DOCS-001-STATE-001, FINAL-DOCS-001-STRUCT-002, FINAL-DOCS-001-TEMPLATE-003, FINAL-DOCS-001-CMD-004
- 선택 미종결 Finding: FINAL-DOCS-001-ATTR-005
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

AI-REVIEW-1 공식 문서·명령 계약을 COMMIT 3637a36b 기준으로 독립 대조했다. 일치 확인: package.json의 fable:check/self-test/append/review 스크립트와 README §3·§8 명령, PowerShell wrapper의 동일 실행기 pass-through, AGENTS §검사 실행의 fable:review 명령과 `pnpm verify --no-db` 4/6 범위·Node 20.19.4/24 매트릭스(verify.yml·verify.mjs), FINAL_INDEPENDENT 조합·independent_request null 규칙(task.example.json), 장부 턴 유형·Codex 증거 항목(template·fixture·README §5), PASS≠gate CLOSED·gate_state OPEN 유지(README §9·fixture·template)는 서로 모순 없다. 실제 불일치 4건과 개선 1건: (1) Major — P0-2 이전 `VERIFIED` 상한이 README §9 L304·fixture L20-21에 있는데, README §4 L140·§9 L286/L292·§10 L309와 fixture L13-14/L30은 페이블이 Finding을 `CLOSED`로 전환하는 것을 정상 종결 경로로 서술해 상한과 충돌하고, PASS의 '필수 Finding 없음'에 VERIFIED 필수 Finding이 포함되는지도 정의되지 않았다. (2) Minor — README §2 저장 구조가 공식 artifact인 `fixtures/shared-coauthoring-smoke.md`를 분류하지 않는다. (3) Minor — collaboration 템플릿 헤더가 `pnpm fable:append` 전용 append 규칙을 빠뜨리고 역할을 솔라·페이블·Codex로만 적어 AGENTS L21·README L84-85·L110과 어긋난다. (4) Minor — README L121-125의 `Get-Content -Raw | fable:append` 예시는 Windows PowerShell 5.1에서 UTF-8 전달을 보장하지 않는다. (5) Improvement — .gitattributes가 `candidate-review.md`를 다루지 않는다. 실행기 내부 구현은 범위 밖으로 두었다. WORKING r003 PASS, FINAL-SMOKE-002-IMP-001 VERIFIED, gate OPEN 상태는 그대로이며 이 감사는 공식 CLOSED를 선언하지 않는다.

### 공동 편집 제안 색인

- FINAL-DOCS-001-E001: REPLACE `docs/ai-review/README.md` · 필수 체크가 구축되기 전에는 `VERIFIED`까지만 가능하고 공식 gate `CLOSED`를 선언하지 않는다. · 원문은 review.md 참조
- FINAL-DOCS-001-E002: REPLACE `docs/ai-review/fixtures/shared-coauthoring-smoke.md` · Finding을 `CLOSED`로 전환한다. · 원문은 review.md 참조
- FINAL-DOCS-001-E003: ADD `docs/ai-review/README.md` · │  └─ collaboration.md · 원문은 review.md 참조
- FINAL-DOCS-001-E004: REPLACE `docs/ai-review/templates/collaboration.md` · > 이 파일은 솔라·페이블·Codex가 `task.json`의 `artifact_paths`에 지정된 같은 공식 산출물을 · 원문은 review.md 참조
- FINAL-DOCS-001-E005: REPLACE `docs/ai-review/README.md` · Get-Content -Raw .\turn.md | corepack pnpm fable:append -- --task TASK-ID · 원문은 review.md 참조
- FINAL-DOCS-001-E006: ADD `.gitattributes` · docs/ai-review/tasks/**/review.md -whitespace · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `a314ff8edc74e339ff29460ed45e93859111def72172a7e1c0fc18104389e3ef`
- target_commit_sha: `15dc5f7aef576a58d54b9e9e991e135d51207f75`
- changed_artifact_paths: `.gitattributes`, `docs/ai-review/README.md`, `docs/ai-review/fixtures/shared-coauthoring-smoke.md`, `docs/ai-review/templates/collaboration.md`
- resulting_input_files_sha256: `후속 COMMIT 독립 감사 manifest에서 봉인 예정`
- artifact_hashes: `[{ path: .gitattributes, sha256: f7d7f3c876b6e76895499954db3115ea43d2f0c99c5f677020b98f11789e11d1, change_type: MODIFIED }, { path: docs/ai-review/README.md, sha256: 36ddb7bc9df61873ec86a84c029a8c9fa358376e9272c973ccf2292fde2fb6e9, change_type: MODIFIED }, { path: docs/ai-review/fixtures/shared-coauthoring-smoke.md, sha256: 3f23119f0bded0f04a37bfa103196110fc8ff63b0c018702d4c36113b0fce06b, change_type: MODIFIED }, { path: docs/ai-review/templates/collaboration.md, sha256: 6423036f4eff9986e8fc1c0e05f8193eb4676219b8d9a995ffa7dc84ae8a97fb, change_type: MODIFIED }]`

### FINAL-DOCS-001-STATE-001

- disposition: `APPLIED`
- 적용 위치: `docs/ai-review/README.md`, `docs/ai-review/fixtures/shared-coauthoring-smoke.md`, `scripts/fable-review.mjs`, `scripts/fable-review/schema-v1.json`
- 적용 내용: P0-2 전 `VERIFIED`를 해결 상태로 집계하되 `CLOSED`는 차단하고, 의미 표식이 없는 역사 회차는 당시 규칙으로 byte 단위 재생하도록 분리했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: 현재 의미의 `CLOSED` 거부, markerless 역사 회차 재생, status·장부 의미 회귀 self-test
- 필요한 재검수: 같은 Finding ID를 `VERIFIED`로 확인하고 공식 `CLOSED`는 선언하지 않음

### FINAL-DOCS-001-STRUCT-002

- disposition: `APPLIED`
- 적용 위치: `docs/ai-review/README.md` 저장 구조
- 적용 내용: fixture 경로와 공동 작성 왕복 smoke 고정 입력 역할을 추가했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: 문서 경로 실재·구조 대조
- 필요한 재검수: README 구조와 실제 경로 일치 확인

### FINAL-DOCS-001-TEMPLATE-003

- disposition: `APPLIED`
- 적용 위치: `docs/ai-review/templates/collaboration.md` 머리말
- 적용 내용: 전체 역할 목록, Fable 턴은 실행기 전용, 비-Fable 턴은 `fable:append` 전용, 직접 편집 금지를 명시했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: 공통 append 계약 self-test
- 필요한 재검수: AGENTS·README·template 문구 정합 확인

### FINAL-DOCS-001-CMD-004

- disposition: `APPLIED`
- 적용 위치: `docs/ai-review/README.md` PowerShell append 명령
- 적용 내용: PowerShell 7 권장과 Windows PowerShell 5.1 UTF-8 출력 인코딩 설정을 함께 명시했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: 한글 턴을 PowerShell 7·Windows PowerShell 5.1에서 각각 append해 동일한 UTF-8 entry SHA 확인
- 필요한 재검수: 예시 명령의 셸별 재현성 확인

### FINAL-DOCS-001-ATTR-005

- disposition: `APPLIED`
- 적용 위치: `.gitattributes`
- 적용 내용: byte-addressed task 기록 전체에 checkout 변환과 whitespace 재해석을 금지해 `review.md`와 `candidate-review.md`를 같은 불변 규칙으로 다룬다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: 역사 task blob byte 대조 및 exact replay
- 필요한 재검수: review/candidate-review 규칙 일치 확인

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s001`
- target_commit_sha: `15dc5f7aef576a58d54b9e9e991e135d51207f75`
- verified_input_files_sha256: `후속 COMMIT 독립 감사 manifest에서 봉인 예정`
- artifact_hashes: `[{ path: .gitattributes, sha256: f7d7f3c876b6e76895499954db3115ea43d2f0c99c5f677020b98f11789e11d1, change_type: MODIFIED }, { path: docs/ai-review/README.md, sha256: 36ddb7bc9df61873ec86a84c029a8c9fa358376e9272c973ccf2292fde2fb6e9, change_type: MODIFIED }, { path: docs/ai-review/fixtures/shared-coauthoring-smoke.md, sha256: 3f23119f0bded0f04a37bfa103196110fc8ff63b0c018702d4c36113b0fce06b, change_type: MODIFIED }, { path: docs/ai-review/templates/collaboration.md, sha256: 6423036f4eff9986e8fc1c0e05f8193eb4676219b8d9a995ffa7dc84ae8a97fb, change_type: MODIFIED }]`
- finding_ids: `FINAL-DOCS-001-STATE-001`, `FINAL-DOCS-001-STRUCT-002`, `FINAL-DOCS-001-TEMPLATE-003`, `FINAL-DOCS-001-CMD-004`, `FINAL-DOCS-001-ATTR-005`
- 실행 명령: `node --check scripts/fable-review.mjs`; `corepack pnpm fable:check`; `corepack pnpm fable:self-test`; `corepack pnpm fable:review -- --task SETUP-V11-FINAL-002 --round 3`; PowerShell 7·Windows PowerShell 5.1 UTF-8 append probe; `corepack pnpm verify`; artifact SHA-256·역사 task tree hash 재계산
- 종료 코드·결과: 모두 종료 코드 0. self-test 25/25, 전체 verify 6/6(DB 32/32·core 177·mobile 189·경합·parity·upgrade 8/8·웹 번들), UTF-8 두 셸 entry SHA `a0a8d876c9d95f035a76e0eaa8cd40ba2b2ea4dc0a6f24196d9d0d1efbc69a73`, markerless exact replay 전후 tree SHA `90b4fcb8d9892149fdf0af0921083df1dbf6eb647fc5f09550f1d4d0c34be573`, 종료 뒤 `fresh_*` DB 0개
- 증거 파일·로그 위치: `docs/ai-review/tasks/AI-REVIEW-1-COMMIT-DOCS-001/rounds/r001/review.json`, `docs/ai-review/tasks/AI-REVIEW-1-COMMIT-DOCS-001/rounds/r001/review.md`, `docs/ai-review/tasks/AI-REVIEW-1-COMMIT-DOCS-001/rounds/r001/run.json`; 후속 COMMIT 독립 감사 회차
- 미실행 항목과 이유: `P0-2` 보호 원격 필수 체크가 아직 없으므로 Finding·task의 공식 `CLOSED`와 gate 종결은 실행하지 않고 `gate_state=OPEN`을 유지한다.
- next_review_request: `FABLE_RECHECK`

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `AI-REVIEW-1-COMMIT-DOCS-001`
- predecessor_round: `r001`
- predecessor_task_sha256: `d97ffdaec473ac01549cd8a454e3856bfdbb198dadeba01b59563cc959dc12f2`
- predecessor_manifest_sha256: `d5374bf5148beee2329355ef0537f92fc93f9979f673638afda22120491af6c2`
- predecessor_review_sha256: `a314ff8edc74e339ff29460ed45e93859111def72172a7e1c0fc18104389e3ef`
- predecessor_run_sha256: `91329c122b814522420141368060cb1518dff8ece5ee99ba74ed5a0fc2424fe9`
- finding_registry_sha256: `2ace1e623845174365982c7989ab0a2b2402a0fb08553758c650741858c54b54`
- successor_task_id: `AI-REVIEW-1-COMMIT-DOCS-002`
- successor_target_commit_sha: `023b408d9b46e312c3f9dfa903cdb50e06560089`
- next_review_request: `FABLE_RECHECK`

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o002 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `AI-REVIEW-1-COMMIT-DOCS-001`
- predecessor_round: `r001`
- predecessor_task_sha256: `d97ffdaec473ac01549cd8a454e3856bfdbb198dadeba01b59563cc959dc12f2`
- predecessor_manifest_sha256: `d5374bf5148beee2329355ef0537f92fc93f9979f673638afda22120491af6c2`
- predecessor_review_sha256: `a314ff8edc74e339ff29460ed45e93859111def72172a7e1c0fc18104389e3ef`
- predecessor_run_sha256: `91329c122b814522420141368060cb1518dff8ece5ee99ba74ed5a0fc2424fe9`
- finding_registry_sha256: `2d7e28296542ec836da4b5891bfb34ce8ae299ca40210ee3d3f5a11bb846102c`
- successor_task_id: `AI-REVIEW-1-COMMIT-DOCS-003`
- successor_target_commit_sha: `88785106198f9e9c696cd796f99cb1572e707564`
- next_review_request: `FABLE_RECHECK`
