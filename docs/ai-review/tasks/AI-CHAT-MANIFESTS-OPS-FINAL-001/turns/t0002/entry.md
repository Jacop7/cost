
## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-AI-FABLE-AUTONOMOUS-BUDGET-009`
- task_budget_usd_approved: `2.00`
- soft_budget_overrun_risk_accepted: `r001@2.00`
- 결정: 사용자는 로컬 구현·QA 뒤 exact 대상 Fable 최종 검수를 진행하도록 지시했고, 기존 예산 위임에 따라 AI 부 오케스트레이터가 잔여 승인 envelope 안에서 이번 단일-pass soft cap을 USD 2.00으로 선택한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 2.00을 넘을 수 있다.
- 허용 범위: task.json의 명시된 현재 작업본과 참조 문서에 대한 읽기 전용 Fable 검수 1회.
- 금지: 동일 목적 중복 Fable 호출, 동시 Opus 호출, 자동 증액.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`
