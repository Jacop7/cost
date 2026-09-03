# AI-PLANS-SIM-HARD-CAP-GUARD

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: `LOCAL_GUARD_VERIFIED / EXTERNAL_REVIEW_NOT_RUN`
> 기준일: `2026-09-03`

## 결론

Claude Code CLI의 `--max-budget-usd`는 실제 사용액이 지정값을 초과한 원본 run이 두 번 보존돼 있어
결제 하드캡으로 사용할 수 없다. 실행기는 기본 경로에서 `PROVIDER_HARD_CAP_UNAVAILABLE`로 종료하며,
Claude 프로세스를 시작하지 않도록 변경했다.

soft cap 예외는 `--allow-soft-budget`만으로 열리지 않는다. 같은 Task의 `HUMAN_DECISION` 장부에
정확한 `rNNN@금액` pin이 한 개 있어야 한다. 회차·금액 불일치, pin 누락, 중복은 외부 호출 전에
`SOFT_BUDGET_RISK_APPROVAL_REQUIRED`로 종료한다. 기존 포괄 실행 승인이나 Task 상한 승인은 이 pin을
대신하지 않는다.

## 근거

- 최초 실행: `AI-ORCH-PLANS-BUNDLE-A-FABLE-001/r001`, soft cap USD 2.00, 실사용 USD 2.118396
- 축소 실행: `AI-ORCH-PLANS-BUNDLE-A-FABLE-COMPACT-002/r001`, soft cap USD 1.50, 실사용 USD 2.609863
- 두 실행 모두 `budget_exhausted`, `RUN_FAILED`, verdict 없음
- 새 외부 Fable·Opus 호출 및 추가 결제: 없음

## 검증

- `node --check scripts/fable-review.mjs`: PASS
- `corepack pnpm fable:review -- --self-test`: 51/51 묶음 PASS
- 새 회귀 묶음:
  - 기본 호출은 `PROVIDER_HARD_CAP_UNAVAILABLE`
  - soft 예외 flag만 있으면 `SOFT_BUDGET_RISK_APPROVAL_REQUIRED`
  - 정확한 회차·정규화 금액의 단일 사람 pin만 통과
  - 다른 회차에서 기존 pin 재사용 거부
- Project Orchestrator validate/budget/seal/verify: `MODEL_PLAN_VERIFIED`
- 봉인 계획 SHA-256: `172cfb34320a57b74b07e4394dfe363b31ddf2b4723cec3f765bd27f4c2e73a2`

이 증거는 Fable 독립검수 PASS가 아니며 5단계 완료 게이트를 충족하지 않는다.
