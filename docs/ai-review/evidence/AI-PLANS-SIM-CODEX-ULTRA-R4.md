# AI-PLANS-SIM-CODEX-ULTRA-R4 — 시험 판본·Fable 실패 장부 재결속

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: `VERIFIED`
> 검증 대상: `07fbbbe5915f987a01c316aaafa309aab9ea5228`
> 대상 tree: `5ad0d81bfd84b4e768e9ecb8beb6665aa70bccae`
> 기준 구현: `c1b595f74f2fc7824b480bf8457e3026c0f1d6dc`
> 검증 시각: `2026-09-02T12:10:00+09:00`

## 1. 적대 시험 파일 변경의 범위

R3는 구현 commit `c1b595f`의 시험 파일을 다음 SHA-256으로 고정했다.

- `c1b595f:scripts/ai-plan-network-simulation.test.mjs`:
  `F267D3A66F9981B89AE5C6AFA07A4FBFDFE150B77A11D85D68E8D5D888CA7042`
- `07fbbbe:scripts/ai-plan-network-simulation.test.mjs`:
  `5E5CEF71B73CE48DA108CF4A716A7E5492C9FF90694C051B03F6F070C9A7D673`

두 판본의 유일한 논리 차이는 `last_verified_sha` 사보타주가 작업큐 전체의 첫 일치 행을 바꾸던
하드코딩을 버리고 `mutateLiveSimulationTask(...)` 안에서 대상 Task 블록의 40자리 SHA만 바꾸도록
좁힌 것이다. 작업큐 앞쪽의 다른 Task SHA가 먼저 바뀌어 대상 검증을 한 번도 실행하지 못하던
거짓 양성을 제거했다. 정상 경로, Finding·Decision·Learning·자율성 로직과 나머지 58개 시험은
변경하지 않았다.

## 2. exact commit 실행

원 작업복사본의 사용자 변경을 입력에서 배제하기 위해 별도 로컬 clone을 만들고, 그 clone의
`codex/ai-team-knowledge-orchestration-plans` 브랜치를 exact `07fbbbe`에 고정한 뒤 다음을 실행했다.

```text
node --test scripts/ai-plan-network-simulation.test.mjs
tests 59 · pass 59 · fail 0 · exit 0
```

첫 detached worktree 탐침은 브랜치 이름이 없어 `active_branch` 계약이 거부했고, 첫 clone 탐침은
후보 manifest가 Windows 작업복사본 bytes로 계산돼 Git LF bytes와 달라 실패했다. 이를 성공으로
세지 않았다. `07fbbbe`는 후보 manifest를 Git commit bytes 기준
`e610bef4662ecd854e3b6b5c1c0551cfe029d846b5babc65d604ef6deb8d6b1c`로 바로잡은 뒤 같은 조건에서
59/59를 통과했다. 모든 임시 worktree·clone은 실행 뒤 제거했다.

## 3. Fable 회차·비용 장부

아래 금액은 Claude CLI가 `run.json`에 남긴 `total_cost_usd` 사용량 지표이며 별도 API 청구를
단정하지 않는다. 실패·검증 거부 회차는 verdict가 없고 유효 Fable 회차 수에 포함하지 않는다.

| Task·회차 | 결과 | verdict | 사용량 지표 |
|---|---|---:|---:|
| `FINAL-WORKFLOW-001/r001` | `RESULT_RECEIVED` | `CHANGES_REQUIRED` | `$1.989739` |
| `FINAL-NETWORK-001/r001` | `RUN_FAILED / budget_exhausted` | 없음 | `$2.142066` |
| `FINAL-NETWORK-001/r002` | `RUN_FAILED / budget_exhausted` | 없음 | `$2.157627` |
| `FINAL-WORKFLOW-002` | 잘못된 추정 SHA로 실행 전 거부 | 없음 | `$0` |
| `FINAL-WORKFLOW-003/r001` | `RUN_FAILED / budget_exhausted` | 없음 | `$2.123500` |
| `FINAL-WORKFLOW-004/r001` | `VALIDATION_REJECTED / RESULT_FINDINGS_CONTRACT` | 없음 | `$3.377235` |

기록된 총 사용량 지표는 `$11.790167`이다. `WORKFLOW-004`의 후보 JSON은 이전 세 Finding을
`VERIFIED`로 보고 시험 판본·실패 장부 문제 둘을 추가했지만, 독립 Task가 predecessor registry 없이
`previous_finding_id`를 반환해 결과 계약에서 거부됐다. 해당 후보는 원인 분석 입력일 뿐 PASS,
Finding, 공식 Fable 회차로 승격하지 않는다.

## 4. 결론

시험 파일 변경은 대상 Task를 정확히 변조하게 만든 적대 시험 보정이며 exact `07fbbbe`에서 59/59로
재결속됐다. 모든 Fable 실패와 검증 거부는 원본 `run.json`·`status.json`·후보 파일로 보존한다.
현재 유효 Fable 검수는 `WORKFLOW-001/r001` 한 회뿐이고 판정은 `CHANGES_REQUIRED`다. 따라서 두 번의
유효 Fable 검수·문서 ACTIVE·실제 디렉터리 생성은 아직 완료되지 않았다.
