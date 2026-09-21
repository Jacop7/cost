
## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-c001`
- finding_ids: `[]`
- decision_id: `DEC-AI-FABLE-COMPACT-AUTONOMY-010`
- review_budget_envelope_approved: `16.00`
- review_budget_used_before_this_task: `13.70059`
- task_budget_usd_approved: `2.00`
- soft_budget_overrun_risk_accepted: `r001@2.00`
- 결정: 사용자는 이전 초과 사용과 무판정 종료를 고지받은 뒤 알아서 진행하도록 위임했다. AI 부 오케스트레이터는 추가 호출을 이 compact 회차 한 번으로 제한한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 2.00을 넘을 수 있다.
- 허용 범위: task.json의 exact 핵심 산출물에 대한 읽기 전용 Fable single-pass 1회.
- 금지: 자동 재시도, 추가 증액, 동시 Opus 호출, 원격 mutation.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`
