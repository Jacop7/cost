
## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `FAB-ARCH-006-MASTER-DEPUTY-BOUNDARY-001`, `FAB-ARCH-006-R0R1-DUPLICATE-COND-10-002`
- decision_id: `DEC-AI-FABLE-DIFF-RECHECK-RANGE-008`
- task_budget_usd_approved: `8.00`
- soft_budget_overrun_risk_accepted: `r001@8.00`
- 결정: 사용자는 외부 검수 예산 판단을 최소~중간 범위로 넓히고, 실측상 필요하면 기준을 넘겨 진행하도록 위임했다. AI 부 오케스트레이터는 직전 완료 비용과 실패 비용을 근거로 이 축소 재검수 1회의 soft cap을 USD 8.00으로 선택한다.
- 허용 범위: 변경된 두 공식 문서와 source r001 Finding 두 건의 읽기 전용 재검수 1회.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 8.00을 넘을 수 있다.
- 금지: 자동 재시도·추가 증액·동일 목적 Opus 전환.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`
