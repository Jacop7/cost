
## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-AI-REVIEW-BUDGET-A-SOFTCAP-003`
- soft_budget_overrun_risk_accepted: `r001@4.00`
- 결정: 사용자가 승인한 새 Fable 외부 호출 1회의 soft cap USD 4.00과 실제 청구 초과 가능성을 이 정확한 회차에 적용한다.
- 허용 범위·기한: `AI-ORCH-PLANS-BUNDLE-A-FABLE-SOFTCAP-004/r001` 한 회차, 읽기 전용, 2026-09-03 현재 작업까지.
- 정정 근거: SOFTCAP-003은 provider 시작 전 로컬 commit 결속 오류로 끝나 승인된 외부 호출과 비용을 소비하지 않았다.
- 금지: 자동 재시도·증액·동일 목적 Opus 호출·다른 회차 재사용.
- 승인자·시각: `USER · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`
