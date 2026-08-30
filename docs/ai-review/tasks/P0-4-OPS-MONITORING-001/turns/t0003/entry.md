
## HUMAN_DECISION · turn-h001

- role: `HUMAN`
- reply_to_turn_id: `turn-c001`
- finding_ids: `P0-4-OPS-SEC-001`, `P0-4-OPS-SEC-002`, `P0-4-OPS-SEC-003`, `P0-4-OPS-SEC-004`, `P0-4-OPS-SEC-005`
- decision_id: `P0-4-OPS-FABLE-ADDITIONAL-BUDGET-20260831`
- task_budget_additional_usd_approved: `2.00`
- 결정: 기존 Task의 불변 4.00 USD 상한과 모든 실패·검수 기록은 수정하지 않는다. 최종 구현 commit을 대상으로 별도 FABLE-SEC 보안 검수 Task를 만들고, 앞선 다섯 Finding의 수정 결과와 전체 범위를 다시 검토하는 외부 호출 한 번에 최대 2.00 USD 상당 사용량을 승인한다.
- 허용 범위·기한: 현재 Claude Code Max 로그인 세션의 읽기 전용 검수만 허용한다. 별도 API 결제·Opus 대체·제품 파일 직접 수정·production 배포는 허용하지 않는다.
- 근거: 사용자가 2026-08-31 대화에서 추가 2.00 USD 상당 실행 상한을 명시적으로 승인했다.
- 승인자·시각: `HUMAN · 2026-08-31T01:04:00+09:00`
- next_review_request: `FABLE_SECURITY_REVIEW_ON_EXACT_COMMIT`
