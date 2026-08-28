
<!-- fable-review:r001 sha256=56fc8813423b4634c17436c748f7036cccccec05bf2062f04af05b121800d0d0 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `56fc8813423b4634c17436c748f7036cccccec05bf2062f04af05b121800d0d0`
- target_commit_sha: `4eadc9a185204ae8bf27a69cd9c40f25e0ed05ba`
- input_files_sha256: `e149f13a4a17d75e710666ccc6d8bdf242e451adac0569e8287c924d331fc5fb`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: SEC-FB-001-TASK-CAP-RAISE-UNCHECKED, SEC-FB-002-VERIFIED-BY-ENGINE-MISATTRIBUTION, SEC-FB-003-FALLBACK-RUNNER-NEGATIVE-TESTS-MISSING, SEC-FB-004-HANDOFF-APPEND-UNBOUND
- 선택 미종결 Finding: SEC-FB-005-SPENT-ROUNDING-NULL-COST
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

protocol 1.2 Fable→Opus 소진 fallback 경로를 보안 관점에서 검수했다. 강점: 승계 사유 allowlist가 구조화 코드만 받고 회차 상한 `budget_exhausted`는 TASK_CAP_APPROVAL_REQUIRED로 분리되며(protocol-v12.mjs 33-41), successor는 실패 run hash·fallback_eligible·target/입력/산출물 hash·registry hash·장부 bytes/hash·handoff turn/entry/run hash·handoff-only source commit·실사용액을 모두 대조하고(fable-review.mjs 2584-2716), Opus 실패는 FALLBACK_UNAVAILABLE로 폐쇄되며(4985-5001) closure 계약은 검증 후 실행을 중단한다(4563-4574). 결과 엔진 필드는 manifest·review·run·status에 결합된다. 그러나 다음 결함이 남는다. (1) successor가 `task_budget_usd`를 4.00보다 크게 선언하면 잔여액 산식이 successor의 상한을 기준으로 통과하고 predecessor 상한·사람 승인과 대조되지 않아 AI-REVIEW-2-3의 "사람 승인 없는 상한 초과 fallback 금지"가 우회된다. (2) `verified_by_engine`은 Opus 결과의 VERIFIED에만 강제되어 Fable 결과가 Opus 검증으로 위장하거나 비-VERIFIED Finding에 임의 엔진을 붙일 수 있어 AI-REVIEW-2-4의 실제 엔진 기록이 깨진다. (3) required_evidence가 주장한 handoff hash·closure 중단·FALLBACK_UNAVAILABLE 부정 시험이 실행기 자체시험에 없고 `loadPinnedFallbackReview`는 어떤 시험에서도 호출되지 않는다. (4) `fable:append`는 AI_DEPUTY_FALLBACK_HANDOFF를 형식만 검사해 실제 소진 실패 run이 없어도 handoff 턴이 장부에 남을 수 있다. 판정은 CHANGES_REQUIRED이며 protocol 1.1 호환성 파괴는 발견하지 못했다.

### 공동 편집 제안 색인

- EDIT-SEC-FB-001-CAP-PARITY: ADD `scripts/fable-review.mjs` ·       || sourceTask.snapshot_mode !== task.snapshot_mode · 원문은 review.md 참조
- EDIT-SEC-FB-002-ENGINE-ATTRIBUTION: REPLACE `scripts/fable-review/protocol-v12.mjs` ·   if (expected.engine === FALLBACK_REVIEWER_ENGINE) { · 원문은 review.md 참조
- EDIT-SEC-FB-001-README-CAP-RULE: ADD `docs/ai-review/README.md` · - Opus의 정확한 model ID와 작업 전체 사용 상한의 남은 범위 · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
