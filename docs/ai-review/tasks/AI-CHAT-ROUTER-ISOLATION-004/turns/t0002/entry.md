
## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-TEAM-ROUTER-ACTIVATE-NON-PROD-001`
- task_budget_usd_approved: `4.00`
- soft_budget_overrun_risk_accepted: `r001@4.00`
- 결정: 자동 라우팅 승인은 유지하지만 envelope 밖 과거 문맥 재개는 허용하지 않는다.
- 허용 범위·기한: 격리 delta Fable 검수 1회.
- 금지: unrelated route, DB·Supabase·git·배포 mutation.
- 승인자·시각: `HUMAN-CHIEF · 2026-09-04 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`
