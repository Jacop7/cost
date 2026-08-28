
<!-- fable-review:r001 sha256=6fd215c6967c9f4a2bc6de56db77aaa64c55f6e3acd8e9c55275602429be7fe4 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `6fd215c6967c9f4a2bc6de56db77aaa64c55f6e3acd8e9c55275602429be7fe4`
- target_commit_sha: `d6dcdfb04af4bc0c579e07edc36d6104755e2f3c`
- input_files_sha256: `72dc0b3896234d8471d1f8057fcc1d584fe7d098d3e8824e5ee5cbbe77323687`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: TCG-001-SUCCESSOR-CONTRACT-GAP, TCG-001-EXHAUSTION-ALLOWLIST-AMBIGUITY, TCG-001-ENGINE-IDENTITY-SCHEMA, TCG-001-LEARNING-PACKET-PROTOCOL, TCG-001-LEARNING-AUDIT-LANE-VERIFIER
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

네 문서(AGENTS.md·팀구성_상세기획안 v1.1·ai-review/README §8·작업큐 AI-REVIEW-2/TEAM-LEARNING-1)는 "Opus 승계와 학습 루프는 정책이며 runner 구현은 AI-REVIEW-2·TEAM-LEARNING-1 완료 전 미지원"이라는 상태 구분을 일관되게 유지하고, 소진 allowlist·비승계 denylist·불변 실패 run·실제 엔진 기록·클린룸 예외 원칙도 서로 모순 없이 기술한다. 그러나 구현 계약으로 쓰기에는 네 가지 구조적 공백이 있다. (1) 현재 유일한 successor 계약인 `predecessor_review`는 README §6과 runner가 FABLE-FINAL/FINAL_INDEPENDENT·predecessor 최신 성공 회차·baseline=predecessor target으로 고정하는데, 소진 승계는 모든 역할·동일 target·실패 run 기반이어야 하므로 두 계약이 충돌하며 어느 문서도 이를 조정하지 않는다. (2) 소진 allowlist의 "회차 예산 소진"이 runner 자체의 `--max-budget-usd` 회차 상한(`budget_exhausted` 안전 종료)과 모델 제공자 한도를 구분하지 않고, "CLI에서 일시적으로 제공되지 않음"이라는 네 번째 사유가 3값 enum에 없다. (3) 결과 스키마·runner에 엔진/모델 필드가 없고, 역할 동일성(Opus가 같은 role ID로 페이블 Finding을 VERIFIED할 수 있는지, 복구된 페이블이 Opus Finding을 검증할 수 있는지)이 정의되지 않았다. (4) §5.2 작업 패킷의 Learning ID 필드는 protocol 1.1이 거부하는 미지 필드인데 TEAM-LEARNING-1의 touches에 runner·schema가 없고, INDEPENDENT-AUDIT 레인 학습의 반대 역할 검증자와 FABLE-SEC·RECHECK 회차에 대한 학습 주입 규칙이 비어 있다. 모두 문서 수준 수정으로 해결 가능하며 proposed_edits로 구체 문구를 제시한다.

### 공동 편집 제안 색인

- TCG-001-E1-README-FALLBACK-SUCCESSOR: ADD `docs/ai-review/README.md` · 이 절은 `AI-REVIEW-2`의 구현 계약이다. runner·schema·task template·사보타주 시험이 함께 반영되기 · 원문은 review.md 참조
- TCG-001-E2-PLAN-EXHAUSTION-REASONS: REPLACE `docs/팀구성_상세기획안.md` · - 페이블 모델의 회차 예산 소진 · 원문은 review.md 참조
- TCG-001-E3-PLAN-CLI-UNAVAILABLE: REPLACE `docs/팀구성_상세기획안.md` · - 페이블 모델이 공식 CLI에서 일시적으로 제공되지 않음 · 원문은 review.md 참조
- TCG-001-E4-README-ENGINE-FIELDS: ADD `docs/ai-review/README.md` · `primary_reviewer_engine`, `reviewer_engine`, 정확한 model ID와 CLI·runner hash를 기록한다. · 원문은 review.md 참조
- TCG-001-E5-QUEUE-AI-REVIEW-2-CRITERIA: ADD `docs/작업큐.md` · - `corepack pnpm fable:check`, `fable:self-test`, `corepack pnpm verify`가 모두 통과한다. · 원문은 review.md 참조
- TCG-001-E6-PLAN-LEARNING-FIELDS-NOTE: ADD `docs/팀구성_상세기획안.md` · - Excluded / RETIRED Learning IDs and reason: · 원문은 review.md 참조
- TCG-001-E7-QUEUE-TEAM-LEARNING-TOUCHES: REPLACE `docs/작업큐.md` · touches: [docs/team/TEAM_LEARNING.md, docs/team/ROLE_CONTEXTS.md, docs/작업큐.md, docs/ai-review/templates/, docs/팀구성_상세기획안.md] · 원문은 review.md 참조
- TCG-001-E8-QUEUE-TEAM-LEARNING-CRITERIA: REPLACE `docs/작업큐.md` · - 독립 종합 감사 최초 회차에는 팀 결론 요약을 넣지 않아 클린룸 독립성을 유지한다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
