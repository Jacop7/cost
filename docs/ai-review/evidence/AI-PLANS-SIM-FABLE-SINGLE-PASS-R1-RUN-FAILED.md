# AI-PLANS-SIM-FABLE-SINGLE-PASS-R1-RUN-FAILED

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: `RUN_FAILED / NO_VERDICT`

`AI-ORCH-PLANS-BUNDLE-A-FABLE-SINGLE-PASS-005/r001`을 승인 soft cap USD 4.00으로 한 번
실행했다. provider는 USD 6.064928을 집계한 뒤 `budget_exhausted`로 종료했다. verdict·review·후보
결과는 없다. 입력은 단일 요청에서 cache creation 152,036, output 57,794 token을 사용했다.

- 승인 soft cap: USD 4.00
- 실제 집계: USD 6.064928
- 초과: USD 2.064928
- run SHA-256: `8e2f506a10340ae75191147ba9db6ce240bd1ea20edd79c96d8719c92ba0d141`
- 자동 재시도·증액·Opus 전환: 없음

CLI soft cap은 단일 API 요청 내부 지출도 차단하지 못하므로 추가 외부 호출을 중지한다.
