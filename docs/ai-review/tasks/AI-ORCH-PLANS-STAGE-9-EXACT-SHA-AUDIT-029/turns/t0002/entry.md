
## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-AI-STAGE-9-EXACT-SHA-AUDIT-BUDGET-029`
- task_budget_usd_approved: `5.00`
- soft_budget_overrun_risk_accepted: `r001@5.00`
- 결정: 사용자의 순차 자동 진행, Fable 필수검수와 예산 재량 위임에 따라 단계 9 exact-SHA 독립 감사 1회를 실행한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 5.00을 넘을 수 있다.
- 허용 범위: target commit 8400457의 단계 9 문서·검사기·비권위 manifest·운영 진입점과 기존 Fable 실패/PASS 계보의 읽기 전용 감사.
- 금지: 동일 목적 Opus 동시 호출, 같은 회차 자동 재호출, 제품·DB·배포·UI·프로토타입 변경, 단계 10 verify 연결.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`
