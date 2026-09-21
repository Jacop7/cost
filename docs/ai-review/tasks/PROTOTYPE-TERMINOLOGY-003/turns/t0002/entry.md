
## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-PROTOTYPE-TERMINOLOGY-FABLE-002`
- task_budget_usd_approved: `10.00`
- soft_budget_overrun_risk_accepted: `r001@10.00`
- 결정: 사용자는 002가 결과 없이 소프트캡에 도달한 뒤 검수 한도를 올려 진행하도록 지시했다. 따라서 이 정확한 입력 Task의 r001 USD 10.00 소프트캡 단일 패스 읽기 전용 Fable 검수를 승인한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 10.00을 넘을 수 있다.
- 허용 범위: task.json에 명시된 프로토타입·참고 문서의 읽기 전용 Fable 검수 1회.
- 금지: 동일 목적 중복 Fable 호출, 동시 Opus 호출, 추가 자동 증액, 제품 파일 수정.
- 승인자·시각: `USER · 2026-09-04 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`
