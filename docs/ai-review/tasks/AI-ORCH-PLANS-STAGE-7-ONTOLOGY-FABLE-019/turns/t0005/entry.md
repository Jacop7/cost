
## HUMAN_DECISION · turn-h002 · r002

- role: `HUMAN`
- reply_to_turn_id: `turn-c001`
- finding_ids: `FAB-ARCH-019-HANDOFF-LOCATION-001`, `FAB-ARCH-019-AUTHORITY-VOCAB-002`, `FAB-ARCH-019-LIFECYCLE-DIAGRAM-003`
- decision_id: `DEC-AI-FABLE-STAGE-7-ONTOLOGY-RECHECK-BUDGET-020`
- soft_budget_overrun_risk_accepted: `r002@1.25`
- 결정: 사용자의 상시 예산 재량 위임에 따라 AI 부 오케스트레이터가 같은 Task의 남은 상한 안에서 도구 기반 축소 재검수 soft cap을 USD 1.25로 선택한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 1.25를 넘을 수 있다.
- 허용 범위: 세 Finding과 변경된 온톨로지 현재 bytes의 읽기 전용 재검수 1회.
- 금지: 동일 회차 중복 호출과 동시 Opus 호출.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_RECHECK`
