
## HUMAN_DECISION · turn-h002 · r002

- role: `HUMAN`
- reply_to_turn_id: `turn-s002`
- finding_ids: `[]`
- decision_id: `DEC-AI-STAGE-9-EXACT-SHA-AUDIT-RUNNER-CORRECTION-030`
- soft_budget_overrun_risk_accepted: `r002@5.00`
- 결정: 사용자의 자동 진행·예산 재량 위임 범위에서 provider 미실행 r001의 단일 옵션 오류를 수정해 r002를 실행한다.
- 위험 고지: r002의 USD 5.00은 provider soft cap이며 결제 하드캡이 아니다.
- 불변: target commit, 입력 경로, Fable 역할, 금지 범위와 Task 전체 상한을 바꾸지 않는다.
- 금지: r001 삭제·판정 합성, 동일 목적 Opus 동시 호출, 추가 자동 재시도.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY runner correction · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`
