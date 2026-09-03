
## HUMAN_DECISION · turn-h002 · r002

- role: `HUMAN`
- reply_to_turn_id: `turn-s002`
- finding_ids: `ARCH-032-DIR-ACTIVE-SELF-DRAFT`, `ARCH-032-EVIDENCE-COST-LINEAGE-STALE`
- decision_id: `DEC-AI-STAGE9-COMPACT-RECOVERY-RECHECK-BUDGET-033`
- soft_budget_overrun_risk_accepted: `r002@2.40`
- 결정: 사용자의 자동 진행·Fable 필수검수·예산 재량 위임에 따라 Task032 r001 실비 USD 3.568507 뒤 task cap USD 6.00의 남은 범위 안에서 Finding 두 건과 변경 diff만 r002로 재검수한다.
- 위험 고지: USD 2.40은 soft cap이며 실제 결제 하드캡이 아니다.
- 허용 범위: 두 Finding, 변경된 현재 bytes, 실행 증거의 읽기 전용 재검수 1회.
- 금지: 동일 회차 중복 호출, 추가 자동 재시도·증액, 동일 목적 Opus, 제품·DB·배포·UI 변경.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_RECHECK`
