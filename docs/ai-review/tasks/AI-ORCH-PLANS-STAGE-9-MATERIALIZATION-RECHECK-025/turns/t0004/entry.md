
## HUMAN_DECISION · turn-h002 · r002

- role: `HUMAN`
- reply_to_turn_id: `turn-s002`
- finding_ids: `[]`
- decision_id: `DEC-AI-FABLE-STAGE-9-MATERIALIZATION-RETRY-BUDGET-026`
- soft_budget_overrun_risk_accepted: `r002@1.65`
- 결정: Task cap USD 4.00에서 r001 보수 정산 USD 2.35를 제외한 잔여 USD 1.65 범위로 결과 계약 보정 재시도 1회를 수행한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 1.65를 넘을 수 있다.
- 허용 범위: 동일 입력·동일 target commit의 결과 형식 보정 재검수 1회.
- 금지: 입력 확대, stage 9 물질화, 동시 Opus 호출.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_RECHECK`
