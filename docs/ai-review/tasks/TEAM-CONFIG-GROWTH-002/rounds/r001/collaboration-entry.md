
<!-- fable-review:r001 sha256=1bb7aa69fc4a9bfea564aee1174d35d79f3c910ec97d10115d8dc9522d785f01 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `1bb7aa69fc4a9bfea564aee1174d35d79f3c910ec97d10115d8dc9522d785f01`
- target_commit_sha: `4a7b9fde198d944a9b0e9e593bc7a573a84cb52d`
- input_files_sha256: `990efaf9b89d5665fac1fc3b47b9f50e9455bcfdb2595a62ab2e911f59715ef7`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: TCG-002-SEC-CLEANROOM-LEARNING-LEAK, TCG-002-FALLBACK-LEDGER-CONTINUITY, TCG-002-REVIEW-MODE-SEMANTICS, TCG-002-HANDOFF-TURN-REGISTRY, TCG-002-QUEUE-ENGINE-AUTHORITY-GAP
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

TEAM-CONFIG-GROWTH-001 r001의 필수 Finding 5건은 세 문서에 대체로 반영됐다. 소진 사유 allowlist(MODEL_BUDGET_EXHAUSTED·MODEL_RATE_LIMITED·MODEL_CAPACITY_UNAVAILABLE)와 runner `budget_exhausted`·인증·설정·hash·계약 오류의 비승계 구분, §6 `predecessor_review`와의 분리, 엔진 출처 기록·원 reviewer role 검증 권한, Learning ID의 protocol 1.2 예정 계약·VERIFIED-only·클린룸 거부, INDEPENDENT-AUDIT 검증자 제한, AI-REVIEW-2 미구현 상태 표기는 README·기획안·작업큐가 서로 모순 없이 일치하며 runner의 TASK_KEYS_V11·SAFE_CLAUDE_TERMINAL_REASONS·FINAL_INDEPENDENT 검사와도 부합한다. 다만 새로 확인한 문제 2건이 Major다. (1) 기획안 §5.2가 TEAM-LEARNING-1 전 Learning ID를 `SOLAR_REQUEST` 본문에 기록하도록 하는데, runner는 FINAL_INDEPENDENT 외 모든 route(SECURITY 포함)에 공동 장부를 전송하므로 FABLE-SEC 최초 회차 클린룸 규칙(§5.6, README §6)과 정면 충돌한다. (2) 소진 승계 successor가 `RECHECK`를 수행하려면 predecessor의 SOLAR_RESPONSE·CODEX_EVIDENCE 장부가 필요한데, 봉인 항목 목록에 predecessor 장부 hash·source commit이 없어 §6 successor 계약과 달리 RECHECK 완결성이 정의되지 않았다. Minor 3건: FABLE-SEC/FABLE-FINAL의 task.review_mode는 runner상 SECURITY/FINAL로 고정되므로 문서의 `INITIAL`/`RECHECK`가 review_mode 값인지 승계 의미인지 명시 필요, README §5·기획안 §5.3 턴 목록에 `AI_DEPUTY_FALLBACK_HANDOFF`(및 기획안의 `AI_DEPUTY_SUCCESSOR_HANDOFF`) 미등재와 기획안의 미정의 토큰 `FABLE_EXHAUSTED`, 작업큐 AI-REVIEW-2 완료 조건에 원 reviewer role 검증 권한·`verified_by_engine`·Opus model ID/작업 전체 기본 상한 사람 결정 항목 누락. PASS는 게이트 종결이 아니며 gate_state는 OPEN을 유지한다.

### 공동 편집 제안 색인

- TCG-002-E1: REPLACE `docs/팀구성_상세기획안.md` · 미지 필드로 거부한다. 그 전까지는 `SOLAR_REQUEST` 턴 본문에만 기록한다. · 원문은 review.md 참조
- TCG-002-E2: ADD `docs/ai-review/README.md` · - 고위험 `FABLE-SEC`·`FABLE-FINAL` 결과의 페이블 복구 후 표본 재감사 조건 · 원문은 review.md 참조
- TCG-002-E3: ADD `docs/ai-review/README.md` · 소진되어 성공 회차가 없으면 inherited Finding 0건인 `INITIAL`로 실행한다. 실패 run의 실제 사용액은 · 원문은 review.md 참조
- TCG-002-E4: ADD `docs/ai-review/README.md` · - `AI_DEPUTY_SUCCESSOR_HANDOFF` — 새 COMMIT Task가 이전 Finding을 재검수하도록 승인하는 기계 판독 턴 · 원문은 review.md 참조
- TCG-002-E5: ADD `docs/작업큐.md` · - 실패 run의 실제 사용액을 작업 전체 상한에서 차감하고, 초과 승계는 사람 승인 없이는 `BLOCKED`다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
