# AI 채팅 Router 무발송 시뮬레이션 001

> 상태: `SIMULATED · NO_MESSAGE_SENT · NO_RUNTIME_STATE_WRITTEN`
>
> 설계 대상 SHA-256:
> `2e4a22ba69844dfdba1a2e23fb5797ede96e43a6bb3346e7f74bd765eda684a4`

## 시나리오

하나의 사람 요청이 01→02→03→Quality→03→02→01로 왕복하는 도중 03 채팅이 자기 1.7 임계치에
도달해 successor로 넘어가는 경우를 문서상 검산한다. 각 leg는 새 route이며 같은
`CORRELATION-SIM-001`로 연결한다.

| 순서 | source → target | kind | 기대 결과 |
| --- | --- | --- | --- |
| 1 | `MASTER-01-HUMAN-DECISIONS` → `MASTER-02-ORCHESTRATION` | `REQUEST` | `SIMULATED` |
| 2 | `MASTER-02-ORCHESTRATION` → `MASTER-03-DEPUTY-CONTEXT` | `TASK_DISPATCH` | rollover 전까지 `HELD_ROLLOVER` |
| 3 | `MASTER-03-DEPUTY-CONTEXT` → `DEPARTMENT-04-QUALITY-REVIEW` | `REVIEW_REQUEST` | successor 활성 뒤 `SIMULATED` |
| 4 | `DEPARTMENT-04-QUALITY-REVIEW` → `MASTER-03-DEPUTY-CONTEXT` | `REVIEW_RESULT` | `SIMULATED` |
| 5 | `MASTER-03-DEPUTY-CONTEXT` → `MASTER-02-ORCHESTRATION` | `AGGREGATE_RESULT` | `SIMULATED` |
| 6 | `MASTER-02-ORCHESTRATION` → `MASTER-01-HUMAN-DECISIONS` | `AGGREGATE_RESULT` | `SIMULATED` |

## 03 successor 연결 검산

```text
generation 7 predecessor
→ HANDOFF_SEALED
→ successor 하나 link
→ successor adopt-handoff / RESTORE_VERIFIED
→ Opus Study Gate / STUDY_GATE_PASSED
→ logical-chat lock + expected generation 7 CAS
→ generation 8 ACTIVE_SUCCESSOR
→ generation 7 PREDECESSOR_SUPERSEDED
```

불변량:

- leg 2의 `route_id`, logical target, payload hash와 delivery token은 generation 전후 동일하다.
- 실제 endpoint ID는 문서·ledger에 남기지 않는다.
- generation 7에 늦게 도착한 미시작 Task는 실행하지 않고 `ENDPOINT_MOVED` 후보 receipt로 처리한다.
- generation 8은 같은 logical-chat dedupe key를 확인해 Task 중복 실행을 막는다.
- 나머지 10개 채팅의 generation과 Mission Relay monitoring state는 바뀌지 않는다.
- successor는 Study Gate 전 인계·복원·검수 외 업무를 수행하지 않는다.

## 판정

edge와 successor 계약은 문서 수준에서 일관된다. 실제 전송·lock·CAS·dedupe·adapter가 없으므로
implementation 또는 delivery 성공 증거가 아니며 상태는 `SIMULATED`로 종결한다.

