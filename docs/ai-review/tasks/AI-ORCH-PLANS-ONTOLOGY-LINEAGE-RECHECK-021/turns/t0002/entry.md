
## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `FAB-ARCH-019-HANDOFF-LOCATION-001`
- decision_id: `DEC-AI-FABLE-ONTOLOGY-LINEAGE-RECHECK-BUDGET-022`
- task_budget_usd_approved: `4.00`
- soft_budget_overrun_risk_accepted: `r001@4.00`
- 결정: 사용자의 상시 예산 재량 위임에 따라 AI 부 오케스트레이터가 COMMIT successor 재검수의 soft cap을 USD 4.00으로 선택한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 4.00을 넘을 수 있다.
- 허용 범위: predecessor Finding registry와 수정 target commit의 온톨로지 문서에 대한 읽기 전용 재검수 1회.
- 금지: 동일 회차 중복 호출과 동시 Opus 호출.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_RECHECK`
