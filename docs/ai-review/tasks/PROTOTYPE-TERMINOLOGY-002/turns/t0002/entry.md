
## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-PROTOTYPE-TERMINOLOGY-FABLE-001`
- task_budget_usd_approved: `2.00`
- soft_budget_overrun_risk_accepted: `r001@2.00`
- 결정: 사용자는 메뉴/레시피 용어 통일과 글로벌 현지화 기준을 Fable이 읽기 전용으로 검수하도록 지시했고, 001이 모델 호출 전 차단된 뒤 같은 r001 USD 2.00 소프트캡으로 정확한 입력 Task를 재시도하도록 지시했다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 2.00을 넘을 수 있다.
- 허용 범위: task.json에 명시된 프로토타입·참고 문서의 읽기 전용 Fable 검수 1회.
- 금지: 동일 목적 중복 Fable 호출, 동시 Opus 호출, 자동 증액, 제품 파일 수정.
- 승인자·시각: `USER · 2026-09-04 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`
