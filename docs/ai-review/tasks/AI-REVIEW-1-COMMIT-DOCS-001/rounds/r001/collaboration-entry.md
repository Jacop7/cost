
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
