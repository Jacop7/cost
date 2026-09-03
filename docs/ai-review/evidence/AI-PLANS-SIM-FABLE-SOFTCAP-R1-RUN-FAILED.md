# AI-PLANS-SIM-FABLE-SOFTCAP-R1-RUN-FAILED

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: `RUN_FAILED / NO_VERDICT`
> Fable Task: `AI-ORCH-PLANS-BUNDLE-A-FABLE-SOFTCAP-004/r001`

사용자가 실제 청구 초과 가능성을 확인한 뒤 승인한 soft cap USD 4.00으로 Fable 읽기 전용 검수를
한 번 실행했다. Claude CLI는 USD 4.067675를 집계한 뒤 `budget_exhausted`와
`error_max_budget_usd`로 종료했다. `review.json`, 후보 결과, verdict는 생성되지 않았다.

- run state: `RUN_FAILED`
- verdict: `null`
- max budget: `4.00`
- provider total cost: `4.067675`
- overrun: `0.067675`
- input/cache creation/cache read/output: `18 / 126001 / 609232 / 8073`
- run SHA-256: `1ecb41db050e1950328e618b6a5367964a616c15070010fee7bc0e0b76314db7`
- 자동 재시도·증액·Opus 전환: 없음

앞선 SOFTCAP-003은 provider 시작 전 commit 결속 오류로 종료돼 비용이 없었다. 이번 SOFTCAP-004만
승인된 외부 호출을 소비했다. 이 실패는 Fable PASS나 CHANGES_REQUIRED로 합성하지 않으며 5단계 완료
게이트로 세지 않는다.
