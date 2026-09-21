
## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-MODEL-ACCESS-ALL-11-001`
- task_budget_usd_approved: `2.00`
- soft_budget_overrun_risk_accepted: `r001@2.00`
- 결정: 사용자는 Fable과 Opus를 모두 허용하고, 공식 11개 채팅에서도 사용하도록 지시했다. 두 모델의 편집은 확정 Task·edit lease·권위 경로 안에서만 허용하고, 자기 편집물의 독립 PASS는 금지한다.
- 허용 범위·기한: task.json의 artifact/reference/evidence snapshot을 대상으로 하는 Fable 읽기 전용 독립검수 1회. provider soft cap은 결제 하드캡이 아님을 수용한다.
- 금지: 같은 목적의 동시 Opus 호출, 자동 예산 배수 증액, 제품 파일 직접 수정, 사람 승인·운영 게이트 우회.
- 승인자·시각: `USER 명시 지시 · 2026-09-04 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`
