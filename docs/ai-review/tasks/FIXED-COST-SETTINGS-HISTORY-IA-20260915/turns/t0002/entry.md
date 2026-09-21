
## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- 명령: `corepack pnpm fable:check`
- 연결 결과: 종료 코드 0. Claude Code 2.1.260, 로그인됨. 계정 식별정보는 출력하지 않았다.
- 검수 명령: `corepack pnpm fable:review -- --task FIXED-COST-SETTINGS-HISTORY-IA-20260915 --round 1 --single-pass --max-budget-usd 1.00`
- 실행 결과: runner 종료 코드 64, pnpm 종료 코드 1. `PROVIDER_HARD_CAP_UNAVAILABLE`로 외부 모델 프로세스 시작 전에 중단됐다. 이번 호출의 Fable 비용이나 verdict는 발생하지 않았다.
- 차단 근거: `docs/ai-review/README.md` §8 및 `scripts/fable-review.mjs`의 `assertExternalBudgetEnforcement`. CLI max-budget-usd는 결제 하드캡이 아니며, 정확한 회차별 HUMAN_DECISION의 soft cap 초과 위험 수용 없이는 외부 호출을 하지 않는다. 이번 사용자 요청에서 그러한 수용은 확인되지 않았다.
- 기존 기록: `PILOT-FIXED-BASIS-20260914`도 동일한 가드로 미실행이며 실제 Fable review.json/review.md가 없다. 보존된 review.md에서 고정 지출 설정 유지/삭제 또는 configuration history 소속을 직접 판정한 결과는 확인하지 못했다.
- 범위 보존: 제품 코드와 기존 기록은 수정하지 않았다. 이번 Task의 요청·실행 근거만 append했다. 자동 예산 증액, --allow-soft-budget, Opus 우회는 사용하지 않았다.
- next_review_request: `FABLE_REVIEW`
