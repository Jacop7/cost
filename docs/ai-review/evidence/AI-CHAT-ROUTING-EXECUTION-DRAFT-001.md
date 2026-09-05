# AI 채팅 라우팅 실행 기획안 v0.6

> 상태: `REBINDING_REQUIRED · CANONICAL_ROOT_RECEIVER_PROTOCOL`
>
> 범위: `01 통합 작업큐 · 사람 결정 → 02 마스터 오케스트레이션 → 03 부 오케스트레이션 → 부서 그룹 → 03 → 02 → 01`
>
> 이 문서는 공식 오케스트레이션 정책의 대체본이 아니다. `DEC-TEAM-ROUTER-DISPATCH-001`의 사람
> 승인, 공식 정책·manifest 반영, 구현·시험 및 정식 독립검수를 통과한 비운영 메시지만 발송한다.

## 1. 결정 경계와 기본 모드

현재 폴더·11개 chat manifest·Mission Relay 등록·Project Orchestrator 봉인 계획은 존재하지만,
사람 요청을 다음 채팅으로 자동 전달하는 실행 권한이나 백그라운드 서비스는 없다.
`docs/team/MODEL-ACCESS.md`는 Fable·Opus 사용 범위만 정하며 채팅 간 자동 메시지 권한을 만들지 않는다.

Router는 다음 세 모드만 가진다.

| 모드 | 허용 | 진입 조건 |
| --- | --- | --- |
| `SIMULATION_ONLY` | envelope·ledger·검증 결과 생성, 실제 발송 금지 | 기본값 |
| `HUMAN_RELAY` | 사람이 봉인 패킷과 ACK 영수증만 두 채팅 사이에 운반 | 공유 runtime 검증 실패 또는 메시지 API 부재, 그리고 route별 사람 확인 |
| `ACTIVE_DISPATCH` | 활성 출발 채팅의 Codex 에이전트가 허용 edge로 한 건씩 명시 발송 | 사람 Decision·capability evidence·manifest v2·시험·검수 모두 통과 |

`DEC-TEAM-ROUTER-DISPATCH-001`이 없으면 `ACTIVE_DISPATCH`는 생성하거나 선택할 수 없다. 이 Decision은
자동 승인, 새 채팅 자동 생성, 제품·DB·배포 mutation 권한을 포함하지 않는다. 모드는 route 생성 시
고정하고 실행기가 자동 승격하지 않는다. `SIMULATION_ONLY` 결과를 실제 전송하려면 새 `route_id`가
필요하다. `HUMAN_RELAY`는 route마다 사람이 `relay_approved=true`인 확인 영수증을 붙여야 선택할 수 있다.

## 2. 플랫폼 capability spike

2026-09-04 읽기 전용 spike에서 Codex 앱의 마스터 폴더 5개와 부서 폴더 6개가 조회됐고 연결 불가
surface는 없었다. 현재 에이전트에는 작업 목록·읽기·메시지 전송·새 작업 생성 기능이 제공되지만,
다음 한계가 있다.

- 메시지는 **출발 채팅의 활성 Codex 에이전트가 명시적으로** 호출한다.
- Router 훅이 백그라운드에서 채팅을 깨우거나 항상 실행되는 서비스라는 증거는 없다.
- 새 작업 생성은 비동기이며 준비 중 ID를 즉시 발송 endpoint로 사용할 수 없다.
- 메시지 기능이 없거나 대상 작업이 비활성이면 자동 발송하지 않는다. route별 사람 확인 뒤
  `HUMAN_RELAY`를 쓰거나, 확인이 없으면 `SIMULATION_ONLY`로 끝낸다.

모든 실제 전달 전 preflight는 source와 target이 같은 호스트의 같은 plugin runtime을 읽고 쓸 수 있는지
다음 증거를 남긴다.

```yaml
runtime_instance_id: <plugin-generated opaque id>
shared_runtime_root_ref: RUNTIME-HMAC-SHA256:<hmac>
same_host_verified: true | false
route_lock_probe: PASS | FAIL
dedupe_store_probe: PASS | FAIL
checked_at: <ISO 8601 UTC>
```

`ACTIVE_DISPATCH`는 네 검사가 모두 성공해야 한다. 실패 시 자동으로 모드를 바꾸지 않고
`HUMAN_RELAY` 후보를 만들며 사람의 route별 확인을 기다린다. 이 spike는 공유 runtime 접근 가능성만
판정하며 백그라운드 서비스 존재를 뜻하지 않는다.

provider thread ID는 런타임의 endpoint mapping에만 보관하며 ledger·Task·검수·Git 산출물에는 쓰지
않는다. spike 증거에는 5+6의 개수와 capability 이름만 남긴다.

### 2.1 canonical root 수신 계약

각 active envelope는 `canonical_project_root` 절대 경로를 포함한다. 수신자는 이 발신 제공 값을 그대로
신뢰하지 않고 shared runtime의 `data/<project_id>/canonical-root.json`에 사람 Decision으로 등록된 root와
byte-exact 대조한다. 일치할 때만 현재 worktree가 아닌 그 root에서 `authority_paths`,
`.codex/team-router`, `.codex/mission-relay/model-plan.json`을 검증한다. 미등록·불일치·기록 손상 또는
경로/hash 검증 실패는 계약을 더 읽지 않고 같은 delivery token으로 `ROUTE_REJECTED`만 반환한다. 등록 root
변경은 Decision pointer를 남기는 전진 정정만 허용한다.
Router는 이를 `SENT_UNCONFIRMED → REJECTED` terminal event로 append하고 inbound scope도 `REJECTED`로
닫는다. 거절은 ACK·DELIVERED·재시도로 바꿀 수 없으며, 수정된 계약으로만 새 route를 준비한다.

각 채팅의 1.7 경제성은 해당 `session_id`에 대해서만 독립 계산한다. 임계치를 넘지 않은 다른 10개
채팅의 endpoint나 감시 상태는 바꾸지 않는다. 임계치 도달 자체가 새 채팅 연결 완료를 뜻하지 않으며,
Mission Relay가 봉인한 한 개 successor와 아래 §8 연결 상태 기계를 통과해야 한다.

## 3. 전역 논리 chat ID와 허용 edge

표시 번호 `04`처럼 중복 가능한 제목 조각은 routing key로 사용하지 않는다. 다음 전역 유일 논리 ID만
사용하며 `DEPARTMENT-*` 같은 와일드카드 일치는 금지한다.

| 논리 chat ID | 표시 이름 | accepts_from | sends_to |
| --- | --- | --- | --- |
| `MASTER-01-HUMAN-DECISIONS` | 01 통합 작업큐 · 사람 결정 | `MASTER-02-ORCHESTRATION`, `MASTER-04-DEVELOPMENT-STAGING`, `MASTER-05-PRODUCTION-RECOVERY`, 사람 | `MASTER-02-ORCHESTRATION` |
| `MASTER-02-ORCHESTRATION` | 02 마스터 오케스트레이션 | `MASTER-01-HUMAN-DECISIONS`, `MASTER-03-DEPUTY-CONTEXT`, `MASTER-04-DEVELOPMENT-STAGING`, `MASTER-05-PRODUCTION-RECOVERY` | `MASTER-01-HUMAN-DECISIONS`, `MASTER-03-DEPUTY-CONTEXT`, `MASTER-04-DEVELOPMENT-STAGING`, `MASTER-05-PRODUCTION-RECOVERY`, `DEPARTMENT-00-ALL-TEAMS-ROOM` |
| `MASTER-03-DEPUTY-CONTEXT` | 03 부 오케스트레이션 | `MASTER-02-ORCHESTRATION`, `DEPARTMENT-01-PRODUCT-MOBILE`, `DEPARTMENT-02-DATA-BACKEND`, `DEPARTMENT-03-SERVER-OPERATIONS`, `DEPARTMENT-04-QUALITY-REVIEW`, `DEPARTMENT-05-KNOWLEDGE-ORCHESTRATION` | `MASTER-02-ORCHESTRATION`, `DEPARTMENT-01-PRODUCT-MOBILE`, `DEPARTMENT-02-DATA-BACKEND`, `DEPARTMENT-03-SERVER-OPERATIONS`, `DEPARTMENT-04-QUALITY-REVIEW`, `DEPARTMENT-05-KNOWLEDGE-ORCHESTRATION` |
| `MASTER-04-DEVELOPMENT-STAGING` | 04 개발·스테이징 배포 검증 | `MASTER-02-ORCHESTRATION`, 사람 | `MASTER-02-ORCHESTRATION`, `MASTER-01-HUMAN-DECISIONS` |
| `MASTER-05-PRODUCTION-RECOVERY` | 05 운영 배포 · 복구 게이트 | `MASTER-02-ORCHESTRATION`, 사람 | `MASTER-02-ORCHESTRATION`, `MASTER-01-HUMAN-DECISIONS` |
| `DEPARTMENT-00-ALL-TEAMS-ROOM` | 00 모든 팀 상황실 | `MASTER-02-ORCHESTRATION` | 없음 |
| `DEPARTMENT-01-PRODUCT-MOBILE` | 01 Product · Mobile | `MASTER-03-DEPUTY-CONTEXT` | `MASTER-03-DEPUTY-CONTEXT` |
| `DEPARTMENT-02-DATA-BACKEND` | 02 Data · Backend | `MASTER-03-DEPUTY-CONTEXT` | `MASTER-03-DEPUTY-CONTEXT` |
| `DEPARTMENT-03-SERVER-OPERATIONS` | 03 Server · Supabase · Operations | `MASTER-03-DEPUTY-CONTEXT` | `MASTER-03-DEPUTY-CONTEXT` |
| `DEPARTMENT-04-QUALITY-REVIEW` | 04 Quality · Review | `MASTER-03-DEPUTY-CONTEXT` | `MASTER-03-DEPUTY-CONTEXT` |
| `DEPARTMENT-05-KNOWLEDGE-ORCHESTRATION` | 05 Knowledge · Orchestration | `MASTER-03-DEPUTY-CONTEXT` | `MASTER-03-DEPUTY-CONTEXT` |

manifest v2와 실행기에는 항상 표의 전체 논리 ID를 열거한다. 각 edge는 `source`, `target`,
`allowed_message_kinds`의 정확한 튜플이며 source와 target만 맞아도 kind가 허용되지 않으면 차단한다.
전체 허용 message kind는 다음으로 고정한다.

```text
REQUEST | CONFIRMED_ROUTE | TASK_DISPATCH | TASK_RESULT | REVIEW_REQUEST |
REVIEW_RESULT | STAGING_GATE_REQUEST | STAGING_GATE_RESULT |
PRODUCTION_GATE_REQUEST | DECISION_POINTER | VERIFIED_STATUS | AGGREGATE_RESULT
```

edge별 허용 kind는 다음과 같고 여기에 없는 조합은 거부한다.

| source → target | allowed_message_kinds |
| --- | --- |
| `MASTER-01-HUMAN-DECISIONS` → `MASTER-02-ORCHESTRATION` | `REQUEST`, `DECISION_POINTER` |
| `MASTER-02-ORCHESTRATION` → `MASTER-01-HUMAN-DECISIONS` | `AGGREGATE_RESULT`, `VERIFIED_STATUS`, `DECISION_POINTER` |
| `MASTER-02-ORCHESTRATION` → `MASTER-03-DEPUTY-CONTEXT` | `CONFIRMED_ROUTE`, `TASK_DISPATCH` |
| `MASTER-03-DEPUTY-CONTEXT` → `MASTER-02-ORCHESTRATION` | `TASK_RESULT`, `REVIEW_RESULT`, `AGGREGATE_RESULT`, `VERIFIED_STATUS`, `DECISION_POINTER` |
| `MASTER-02-ORCHESTRATION` → `MASTER-04-DEVELOPMENT-STAGING` | `STAGING_GATE_REQUEST` |
| `MASTER-04-DEVELOPMENT-STAGING` → `MASTER-02-ORCHESTRATION` | `STAGING_GATE_RESULT`, `DECISION_POINTER` |
| `MASTER-04-DEVELOPMENT-STAGING` → `MASTER-01-HUMAN-DECISIONS` | `DECISION_POINTER` |
| `MASTER-02-ORCHESTRATION` → `MASTER-05-PRODUCTION-RECOVERY` | `PRODUCTION_GATE_REQUEST` |
| `MASTER-05-PRODUCTION-RECOVERY` → `MASTER-02-ORCHESTRATION` | `DECISION_POINTER`, `VERIFIED_STATUS` |
| `MASTER-05-PRODUCTION-RECOVERY` → `MASTER-01-HUMAN-DECISIONS` | `DECISION_POINTER` |
| `MASTER-02-ORCHESTRATION` → `DEPARTMENT-00-ALL-TEAMS-ROOM` | `VERIFIED_STATUS` |
| `MASTER-03-DEPUTY-CONTEXT` → `DEPARTMENT-01-PRODUCT-MOBILE` | `TASK_DISPATCH` |
| `DEPARTMENT-01-PRODUCT-MOBILE` → `MASTER-03-DEPUTY-CONTEXT` | `TASK_RESULT` |
| `MASTER-03-DEPUTY-CONTEXT` → `DEPARTMENT-02-DATA-BACKEND` | `TASK_DISPATCH` |
| `DEPARTMENT-02-DATA-BACKEND` → `MASTER-03-DEPUTY-CONTEXT` | `TASK_RESULT` |
| `MASTER-03-DEPUTY-CONTEXT` → `DEPARTMENT-03-SERVER-OPERATIONS` | `TASK_DISPATCH` |
| `DEPARTMENT-03-SERVER-OPERATIONS` → `MASTER-03-DEPUTY-CONTEXT` | `TASK_RESULT` |
| `MASTER-03-DEPUTY-CONTEXT` → `DEPARTMENT-04-QUALITY-REVIEW` | `REVIEW_REQUEST`, `TASK_DISPATCH` |
| `DEPARTMENT-04-QUALITY-REVIEW` → `MASTER-03-DEPUTY-CONTEXT` | `REVIEW_RESULT`, `TASK_RESULT` |
| `MASTER-03-DEPUTY-CONTEXT` → `DEPARTMENT-05-KNOWLEDGE-ORCHESTRATION` | `TASK_DISPATCH` |
| `DEPARTMENT-05-KNOWLEDGE-ORCHESTRATION` → `MASTER-03-DEPUTY-CONTEXT` | `TASK_RESULT` |

`04`·`05`에서 사람이 직접 내린 결정은 원문을 복제하지 않고 기존 `DecisionPointer`로 01과 02가
참조한다. 01은 모든 결정 발화의 독점 채팅이 아니다. `DEPLOYMENT_DISPATCH`라는 미정 특권 타입은
사용하지 않는다. 운영 게이트 결과도 새 특권 타입을 만들지 않고 `DECISION_POINTER`로만 전달한다.
요청·결과·검수처럼 왕복하는 각 leg는 별도 `route_id`를 쓰고 같은 `correlation_id`와 직전
`parent_route_id`로 연결한다.

## 4. envelope와 비식별 포인터

모든 발송 후보는 다음 필드를 가진다.

```yaml
route_id: ROUTE-<uuid>
parent_route_id: ROUTE-<uuid> | null
correlation_id: CORRELATION-<uuid>
mission_id: <Mission Relay mission ID>
request_id: REQUEST-<uuid>
task_id: <confirmed Task ID>
message_kind: <허용 message kind>
logical_source_chat_id: <전역 논리 ID>
logical_target_chat_id: <전역 논리 ID>
source_pointer: TASK:<task_id>#TURN:<opaque-sequence>
normalized_request_id: NORMALIZED-<uuid>
decision_required: true | false
decision_pointer: <canonical Decision pointer | null>
model_plan_sha256: <sealed plan SHA>
canonical_project_root: <권위 프로젝트 루트 절대 경로 · byte-exact>
authority_paths: [<repo-relative canonical paths>]
payload: <최소 정규화 데이터>
payload_sha256: <canonical payload hash>
delivery_token: DELIVERY-<uuid>
scope_isolation:
  only_this_envelope: true
  resume_prior_context: false
  child_routes_allowed: true | false
```

`source_pointer`에는 provider thread ID, 계정 식별자, 원시 대화, 이메일, 토큰, 쿠키를 넣지 않는다.
논리 source·target, Task, message kind, authority paths 또는 payload가 바뀌면 새 `route_id`가 필요하다.
Mission Relay successor로 물리 endpoint만 바뀌는 것은 논리 target 변경이 아니다.

수신 작업은 현재 envelope의 `task_id`와 `payload`만 처리하며 이전 대화의 미완료 요청·승인·백로그를
재개하지 않는다. `payload.expected_response=TEAM_ROUTER_ACK`이면 동일 `delivery_token`의 ACK만 반환한다.
`child_routes_allowed=false`인 발송은 shared runtime에 수신 scope lock을 먼저 만들고, ACK receipt로
lock이 닫히기 전 수신 logical chat의 새 `prepare-dispatch`를 허용 edge라도 `BLOCKED_POLICY` event와
함께 거부한다. 명시적 다음 leg가 필요한 요청만 source가 `child_routes_allowed=true`로 봉인한다.

scope lock에는 logical chat ID·route ID·delivery token·허용 boolean·`state`(`ACTIVE → ACKED | REJECTED`)만
저장하고 provider endpoint ID나 원시 대화는 넣지 않는다. 기본 경로는 다음이다.

```text
C:\Codex-AI-Operations\Codex-Team-Router\data\<project_id>\scopes\<logical_chat_id>\<delivery_token>.json
```

## 5. 단일 event chain과 canonicalization

route state와 dispatch receipt를 별도 원장으로 나누지 않고 route별 JSONL event chain 하나에 append한다.
기본 런타임 경로는 다음이며 Git·OneDrive·제품 저장소 밖의 로컬 plugin state다.

```text
C:\Codex-AI-Operations\Codex-Team-Router\data\<project_id>\routes\<route_id>.jsonl
```

각 event의 최소 필드는 다음과 같다.

```yaml
entry_id: ENTRY-<uuid>
route_id: ROUTE-<uuid>
sequence: <0부터 시작하는 단조 증가 정수>
event_type: ROUTE_STATE | DISPATCH_INTENT | DELIVERY_RECEIPT | ACK | ROUTE_REJECTED | POLICY_BLOCK |
  HUMAN_RELAY_INTENT | HUMAN_RELAY_ACCEPTED | ENDPOINT_MOVED | RETRY_EXHAUSTED
state: <§6 상태>
actor_logical_chat_id: <전역 논리 ID>
logical_target_chat_id: <전역 논리 ID | null>
resolved_endpoint_ref: ENDPOINT-HMAC-SHA256:<hmac> | null
resolved_endpoint_generation: <0 이상의 정수 | null>
delivery_token: DELIVERY-<uuid> | null
attempt: <0 이상의 정수>
payload_sha256: <envelope payload hash>
created_at: <ISO 8601 UTC>
evidence_pointer: <canonical pointer | null>
previous_entry_sha256: <64-hex>
entry_sha256: <64-hex>
```

canonical bytes는 `UTF-8`, 문자열 Unicode NFC, 객체 키 Unicode code point 오름차순, 불필요한 공백 없음,
개행 `LF`, 숫자 필드는 정수 또는 명시적 decimal string, 누락과 `null`을 구분한 JSON으로 고정한다.
`payload_sha256`은 정규화한 `payload` 본문만 덮으며 `entry_id`, `sequence`, `attempt`, `created_at`,
`resolved_endpoint_ref`, receipt metadata는 제외한다. `entry_sha256`은 자기 `entry_sha256` 필드를 제외한
event 전체 canonical bytes를 덮는다. sequence 0의 `previous_entry_sha256`은 64개의 `0`이다.

event 삭제·재배열·중간 삽입은 chain 검증 실패다. endpoint reference는 project-local runtime key로
HMAC-SHA256하고 key 자체는 ledger·Git·Task evidence에 남기지 않는다. 따라서 알려진 provider ID를
평문 SHA 사전으로 역추적할 수 없다. ledger에는 원시 대화와 실제 endpoint ID를 넣지 않는다.

## 6. 상태 기계

정상 전이는 다음과 같다.

```text
RECEIVED → PLANNED → CONFIRMED → DISPATCH_READY
  → SIMULATED
  → SENT_UNCONFIRMED → DELIVERED → IN_PROGRESS → COMPLETED
  → SENT_UNCONFIRMED → REJECTED
  → HUMAN_RELAY_READY → HUMAN_RELAY_ACCEPTED → DELIVERED → IN_PROGRESS → COMPLETED
```

`SIMULATED`는 `SIMULATION_ONLY`의 종결 분기이며 실제 전달 계열로 이어지지 않는다. 나중에 보내려면
새 route를 만들어 원래 route를 `parent_route_id`로 연결한다. `HUMAN_RELAY_READY`는 source가
`HUMAN_RELAY_INTENT`와 봉인 패킷을 만들었을 뿐이며 전달 완료가 아니다. target이 같은
`delivery_token`·payload hash·edge·plan SHA·lease를 확인하고 `HUMAN_RELAY_ACCEPTED` ACK 영수증을
반환한 뒤 source가 이를 검증해 canonical chain에 import해야만 `DELIVERED`가 된다.

보조 상태:

- `HELD_ROLLOVER`: 봉인 HANDOFF, successor 복원 또는 Study Gate를 기다림. 정책 실패가 아니다.
- `FAILED_TRANSIENT`: 활성 작업 부재, 일시 전달 실패, CAS 경쟁, 유효한 타 소유자 lease의 일시 경합.
  동일 payload 재시도만 가능하다.
- `BLOCKED_POLICY`: Decision·allowlist·plan SHA·필수 lease 부재/무효·운영 게이트 불일치. 같은 route
  자동 재시도 금지다.
- `REJECTED`: 수신자가 canonical root 또는 계약을 검증하지 못해 같은 delivery token과 rejection pointer로
  기록한 불가역 종결 상태다. ACK·`DELIVERED`·재시도로 재해석할 수 없다.
- `CANCELLED`: 사람 취소 Decision이 연결된 종결 상태다.

허용 복귀 전이는 `FAILED_TRANSIENT → DISPATCH_READY`와 `HELD_ROLLOVER → DISPATCH_READY`뿐이다.
전자는 동일 payload의 재시도 조건과 상한을 만족해야 하고, 후자는 verified successor 또는 기존
endpoint 유지 판정이 있고 실행 재개에 필요한 Study Gate까지 통과해야 한다. `BLOCKED_POLICY`,
`REJECTED`, `CANCELLED`, `SIMULATED`, `COMPLETED`는 같은 route에서 되돌리지 않는다.

helper 전이는 다음으로 닫는다. `DISPATCH_READY → HELD_ROLLOVER`, `SENT_UNCONFIRMED → REJECTED`, `SENT_UNCONFIRMED →
FAILED_TRANSIENT`, `HUMAN_RELAY_READY → FAILED_TRANSIENT`, `FAILED_TRANSIENT → DISPATCH_READY`,
`HELD_ROLLOVER → DISPATCH_READY`만 허용한다. 재시도 상한 소진 시 `RETRY_EXHAUSTED` event를 남기고
`FAILED_TRANSIENT`를 종결한다. 정책 위반은 직전 비종결 상태에서 `BLOCKED_POLICY`, 사람 취소는
직전 비종결 상태에서 `CANCELLED`로만 이동한다.

`SENT_UNCONFIRMED`는 도구 호출 성공일 뿐 전달 증명이 아니다. `DELIVERED`는 수신 채팅의
`delivery_token` ACK와 `evidence_pointer`가 모두 있을 때만 기록한다. `SIMULATED`는 실제 발송이나
전달로 집계하지 않는다. `COMPLETED`는 대상 Task 결과와 검증 증거가 있고 03이 결과를 수집했을 때만
기록한다. 불가능한 상태 전이와 상태·event 조합은 실행기가 거부한다.

## 7. 원자성·idempotency·재시도

모든 write는 plugin CLI의 route별 단일 OS lock 아래에서 수행한다. append 호출자는 자신이 읽은
`previous_entry_sha256`과 다음 `sequence`를 compare-and-append(CAS) 입력으로 전달한다. 실행기는 lock을
획득한 뒤 tail을 다시 검증하고, 일치할 때만 한 JSONL event를 append·flush·fsync한다. 불일치하면
발송하지 않고 caller가 최신 tail을 다시 읽도록 한다.

non-delivery event의 `attempt`는 0이고 최초 `DISPATCH_INTENT`는 1이다. crash 복구를 위해 append 전
동일 파일시스템의 prepared entry를 fsync하고, lock 안에서 tail과 prepared hash를 검증한 뒤 ledger에
추가한다. 재시작 시 prepared entry가 이미 tail이면 완료 처리하고, tail과 충돌하면 자동 합류하지 않고
격리한다. checkpoint마다 최종 tail hash를 Task evidence에 export해 runtime 파일 전체 재작성만으로
공식 완료 증거를 위조할 수 없게 한다.

실제 발송 전 `DISPATCH_INTENT`를 먼저 append하며 고정 `delivery_token`을 만든다. 수신자는
`route_id + payload_sha256 + delivery_token`을 dedupe key로 사용한다. 동일 token의 재수신은 Task를
다시 실행하지 않고 기존 ACK를 반환한다.

공유 runtime의 수신 dedupe record는 다음 정확한 경로에 prepared-write와 atomic rename으로 보존한다.

```text
C:\Codex-AI-Operations\Codex-Team-Router\data\<project_id>\dedupe\<logical_target_chat_id>\<delivery_token>.json
```

record는 `route_id`, `payload_sha256`, `delivery_token`, `logical_source_chat_id`, `first_ack_sha256`,
`accepted_at`만 가지며 실제 endpoint는 넣지 않는다. target별 OS lock 아래에서 기존 record와 payload
hash가 같으면 기존 ACK를 반환하고, 다르면 변조로 `BLOCKED_POLICY` 처리한다. preflight에서 이 store의
read/write/rename probe가 실패하면 `ACTIVE_DISPATCH`를 금지한다.

- 재시도는 동일 `route_id`·`payload_sha256`·`delivery_token`에서만 허용한다.
- `attempt` 증가는 같은 lock 안에서 정확히 1씩 수행한다.
- `FAILED_TRANSIENT` 자동 재시도 상한은 최초 시도 뒤 2회다.
- `BLOCKED_POLICY`, `CANCELLED`, payload 변경은 자동 재시도하지 않는다.
- 상한 소진 뒤에는 02로 `DecisionPointer` 요청만 반환한다.

### HUMAN_RELAY 전달 계약

공유 runtime을 쓸 수 없는 경우 source가 canonical chain의 유일 writer로 남는다. source는
`HUMAN_RELAY_INTENT`를 append하고 envelope, 현재 tail hash, `delivery_token`, 만료시각을 담은 봉인
relay packet을 export한다. 사람은 이 패킷만 target 채팅에 복사한다. target의 활성 에이전트는 edge,
kind, payload hash, model-plan SHA, lease와 token 중복을 검증하고 `HUMAN_RELAY_ACCEPTED` ACK packet을
사람에게 돌려준다. source가 ACK의 packet hash·token·target·만료시각을 검증해 canonical chain에
import해야 `DELIVERED`를 append한다. 사람의 복사 행위나 target 화면 표시만으로는 전달 완료가 아니다.

target에 공유 dedupe store가 없으면 ACK packet 자체를 target-local 영수증으로 보관하고, source는
import한 ACK hash를 canonical chain에 기록한다. target-local 영수증의 고정 경로는
`C:\Codex-AI-Operations\Codex-Team-Router\data\<project_id>\relay-dedupe\<logical_target_chat_id>\<delivery_token>.json`이며
같은 token 재입력에는 기존 ACK packet만 반환한다.
relay packet과 ACK에는 원시 대화·provider ID·계정 식별자를 넣지 않는다. 모드 변경은 자동화하지 않으며
route별 사람 확인 없이는 `HUMAN_RELAY_INTENT`도 만들지 않는다.

## 8. Mission Relay·Project Orchestrator·edit lease

Router는 Mission Relay의 rollover를 시작·중단·우회하지 않는다. `logical_target_chat_id`는 같은 mission
lineage에서 불변이고, 물리 endpoint는 매 attempt 직전에 Mission Relay의 봉인 HANDOFF와 Study Gate
영수증으로 해석한다. Router가 별도의 1.7 계산이나 successor 생성 규칙을 구현하지 않는다.

### successor 연결 상태 기계

```text
CURRENT_ENDPOINT
  → HANDOFF_SEALED
  → PENDING_SUCCESSOR
  → RESTORE_VERIFIED
  → STUDY_GATE_PASSED
  → ACTIVE_SUCCESSOR
  → PREDECESSOR_SUPERSEDED
```

- `HANDOFF_SEALED`: Mission Relay의 handoff SHA-256이 확정된 상태다. endpoint는 아직 기존 채팅이다.
- `PENDING_SUCCESSOR`: 정확히 한 successor thread가 해당 handoff hash에 `link-successor`로 연결된
  상태다. 새 채팅 생성만으로는 여기에 진입하지 않는다. 이 단계의 새 채팅은 predecessor 인계 채택,
  복원 검증, Study Gate만 수행하며 새 요청이나 별도 mission을 실행하지 않는다.
- `RESTORE_VERIFIED`: successor가 `adopt-handoff`로 mission ID, 저장소, branch, HEAD, dirty paths,
  active step과 증거를 검증한 상태다. 아직 Task mutation이나 route 실행은 금지한다.
- `STUDY_GATE_PASSED`: Mission Relay의 Opus 1회 독립검수와 Codex↔Opus 교차검수 2회 이상을 포함한
  Study Gate 영수증이 유효한 상태다.
- `ACTIVE_SUCCESSOR`: route별 endpoint lock 아래에서 mapping generation을 1 올리고 successor를
  활성 endpoint로 CAS 교체한 상태다.
- `PREDECESSOR_SUPERSEDED`: predecessor는 새 Task를 받거나 실행하지 않는다. 늦게 도착한 기존 ACK와
  감사 receipt만 기록할 수 있다. 전환 전에 발송됐지만 아직 시작하지 않은 Task가 도착하면 실행하지
  않고 `ENDPOINT_MOVED` receipt를 반환해 source가 route를 `FAILED_TRANSIENT`로 기록하고 동일 token으로
  active successor에 재시도하게 한다.

endpoint mapping의 런타임 경로는 다음으로 고정한다.

```text
C:\Codex-AI-Operations\Codex-Team-Router\data\<project_id>\endpoints\<logical_chat_id>.json
```

최소 필드는 `logical_chat_id`, `mission_id`, `generation`, `active_endpoint_id`,
`active_endpoint_hmac`, `predecessor_endpoint_hmac`, `handoff_sha256`, `restore_receipt_sha256`,
`study_gate_receipt_sha256`, `state`, `updated_at`이다. 실제 provider endpoint ID는 이 runtime 파일에만
두며 ledger·Git 산출물에는 HMAC만 남긴다. mapping 변경은 logical chat별 OS lock과 expected
generation CAS로 수행한다.

모든 send와 receive 직전에 실행 중인 물리 endpoint가 mapping의 `active_endpoint_id`·`generation`과
일치하는지 확인한다. source가 rollover 중이어도 같은 검사를 적용하며, 일치하지 않으면 신규 route를
만들거나 Task를 실행하지 않고 `HELD_ROLLOVER` 또는 `MOVED`로 처리한다. mapping JSON의 atomic replace가
활성화 권위이고, audit event 기록 전에 crash가 나면 재시작 시 mapping generation으로 event를 보충한다.

- verified successor가 없으면 기존 endpoint를 유지한다.
- handoff가 봉인되거나 successor가 연결됐지만 `STUDY_GATE_PASSED` 전이면 신규 route와 retry를
  `HELD_ROLLOVER`로 보류한다.
- `ACTIVE_SUCCESSOR` 전환 뒤 다음 attempt의 `resolved_endpoint_ref`와
  `resolved_endpoint_generation`만 바꾼다. `route_id`, logical target, payload hash,
  `delivery_token`, attempt 계보는 유지한다.
- target별 dedupe store는 logical chat ID 기준이므로 endpoint generation이 바뀌어도 중복 실행을
  막는다. successor는 실행 전 기존 token record를 조회해 기존 ACK를 반환한다.
- 잘못된 successor는 Mission Relay의 `reset-successor` 증거 없이는 교체하지 않는다. 동일 handoff
  hash에 두 successor가 보이면 `BLOCKED_POLICY`다.
- 복원 실패·사용자 취소·생성 도구 부재로 rollover를 abort하면 pending mapping을 활성화하지 않고
  기존 endpoint를 유지한다. 전환 중 route는 기존 endpoint 유지 판정 또는 새 인계 절차 전까지 held다.
- 다른 논리 채팅이나 다른 mission을 위해 열린 새 채팅은 자동 연결하지 않는다. 11개 채팅 각각이
  자기 session·mission lineage·generation을 독립 관리한다.

Project Orchestrator의 model-plan SHA가 envelope와 다르면 `BLOCKED_POLICY`다. 계정 전환은 Account
Continuity 판정을 따르며 route 재발급·재스터디·재검수 사유가 아니다.

`authority_paths`는 저장소 상대 경로로 정규화한다. 디렉터리와 그 하위 경로는 충돌하며, glob은 Task
Packet을 봉인하기 전에 실제 경로 목록으로 확장한다. 저장소 밖·symlink·junction 경로는 거부한다.
서로 겹치는 경로의 병렬 Task는 금지하고, dispatch 직전과 수신 ACK 직전에 edit lease를 두 번 확인한다.

## 9. 실제 메시지 흐름

1. 01은 사람 요청을 정규화하고 `RECEIVED` event를 만든다. 승인이 없으면 `decision_required=true`다.
2. 02는 Task graph·담당 팀·검수·운영 게이트를 확정하고 `CONFIRMED_ROUTE`를 만든다.
3. 03은 plan SHA, 정확한 edge와 message kind, Task, Decision, edit lease, Mission Relay 상태,
   shared-runtime preflight와 kill-switch를 검사한다.
   target이 rollover 중이면 `STUDY_GATE_PASSED`와 endpoint generation CAS 전까지 `HELD_ROLLOVER`다.
4. `SIMULATION_ONLY`에서는 `SIMULATED`만 기록한다. `ACTIVE_DISPATCH`에서는 허용된 부서 하나 이상에
   고정 delivery token으로 발송한다. 병렬 부서는 authority path가 겹치지 않을 때만 허용한다.
   `HUMAN_RELAY`에서는 source가 `HUMAN_RELAY_READY`까지만 만들고 사람 운반·target ACK·source import가
   모두 끝나야 `DELIVERED`로 진행한다.
5. 부서는 ACK 뒤 Task를 수행하고 `TASK_RESULT`를 03에 반환한다. 독립검수가 필요하면 03은
   `DEPARTMENT-04-QUALITY-REVIEW`에 `REVIEW_REQUEST`를 보낸다.
6. 03은 결과를 변경하지 않고 새 return route의 `AGGREGATE_RESULT`를 02에 보낸다. 02가 결과를 통합해
   또 다른 return route로 01에 전달한다. 세 route는 같은 `correlation_id`로 묶는다.
7. 04/05의 사람 결정은 `DECISION_POINTER`로 01·02에 연결할 뿐 원문이나 승인 권한을 복제하지 않는다.

`DEPARTMENT-00-ALL-TEAMS-ROOM`에는 02가 검증된 상태만 보낼 수 있고 이 채팅은 dispatch를 반환하지 않는다.

## 10. dispatch 정책·kill-switch·rollback

프로젝트 정책 파일의 고정 경로와 최소 형식은 다음으로 정한다.

```text
.codex/team-router/policy.json
```

```json
{
  "schemaVersion": 1,
  "dispatchEnabled": false,
  "humanRelayEnabled": false,
  "decisionId": null,
  "retryLimit": 2,
  "allowedMessageKinds": []
}
```

파일 부재·schema 오류·`dispatchEnabled=false`·Decision 불일치는 active dispatch에 대해 모두
fail-closed다. `humanRelayEnabled=true`도 route별 사람 확인을 대체하지 않는다. 사람 Decision과
exact policy commit이 생긴 뒤에만 `dispatchEnabled=true`를 반영한다. kill-switch는 이를 `false`로
내려 신규 send와 retry를 즉시 중단한다. 이미 도착한 ACK·결과 receipt append는 허용해 감사 흔적을
완결하지만 새 Task 실행은 시작하지 않는다.

rollback은 ledger를 지우거나 되감지 않는다. manifest v2 edge와 policy 변경은 새 commit으로 전진
정정하고, runtime endpoint mapping은 마지막 검증 판본으로 복원한다. 운영·배포 route는 사람 승인,
exact SHA, 보호 CI, 스테이징 증거, 복구 계획이 없으면 항상 `BLOCKED_POLICY`다.

## 11. 별도 플러그인 범위

별도 `Codex-Team-Router` 플러그인은 다음만 포함한다.

- route/envelope/event schema와 검증 skill
- route별 append lock·CAS·hash-chain·dedupe CLI
- 논리 chat ID↔runtime endpoint mapping과 capability preflight
- Mission Relay의 봉인 handoff·복원·Study Gate 영수증을 소비하는 successor binding adapter
- simulation·human relay·active dispatch adapter
- kill-switch·audit export·sabotage self-test

플러그인은 Mission Relay, Project Orchestrator, Account Continuity의 상태를 읽기만 하며 수정하지 않는다.
백그라운드 서비스, 자체 DB, 원시 transcript 저장, 계정 선택, 자동 새 채팅 생성, git commit/push,
제품·DB·Supabase·배포 mutation 기능을 포함하지 않는다.

## 12. 구현 순서

1. 이 설계와 Fable delta 재검수 Finding을 정리한다.
2. `DEC-TEAM-ROUTER-DISPATCH-001` 전에는 읽기 전용 capability spike와 무발송 simulation만 수행한다.
3. 사람 Decision 후보에 정확한 edge 표, manifest v2 schema delta, policy 기본값을 제출한다.
4. Decision 뒤 docs graph checker와 11개 manifest를 같은 schema version으로 갱신한다.
5. 별도 플러그인의 schema·ledger·lock·CAS·simulation을 구현한다.
6. 정상·부정·경합·변조 sabotage test를 통과한다.
7. 01→02→03→Quality→03→02→01 무발송 파일럿을 수행한다.
8. 정식 Fable 독립검수와 사람 활성화 승인 뒤 비운영 Task 한 건만 실제 dispatch한다.
9. 운영·배포 edge는 별도 사람 게이트 파일럿 전까지 열지 않는다.

manifest를 먼저 수정하지 않는다. capability·schema·Decision이 고정된 뒤 정확한 11개 delta를 적용한다.

## 13. 필수 시험

- 정상 흐름과 모든 허용 edge
- manifest edge별 허용·금지 message kind
- 같은 delivery token 중복 수신·기존 ACK 반환
- payload 변경 시 새 route 강제
- 미승인 Decision·plan SHA 불일치·unknown/wildcard target 차단
- 마스터 04와 부서 04 오라우팅 차단
- 겹치는 authority path와 edit lease 경쟁 차단
- 두 writer CAS 충돌·attempt 중복 방지
- event 삭제·재배열·중간 삽입·payload canonicalization 변조 탐지
- HANDOFF pending의 `HELD_ROLLOVER`와 verified successor endpoint 교체
- 같은 handoff hash의 successor 2개 연결 차단과 잘못된 successor reset 증거 검증
- 생성만 된 successor의 조기 활성화 차단, RESTORE·Study Gate 뒤 generation CAS 전환
- endpoint 전환 전후 동일 route·payload·delivery token 유지와 logical-chat dedupe 재사용
- 한 채팅 rollover가 나머지 10개 endpoint·monitoring state에 영향을 주지 않음
- predecessor superseded 뒤 새 Task 실행 차단과 늦은 기존 ACK 기록 허용
- `SENT_UNCONFIRMED`를 `DELIVERED`로 위장하는 receipt 거부
- canonical root 불일치·미등록·기록 손상의 `ROUTE_REJECTED`, scope 폐쇄와 ACK/재시도 재해석 차단
- kill-switch 중 신규 send/retry 차단과 기존 ACK 기록 보존
- retry 2회 상한, inactive destination, capability 부재의 `HUMAN_RELAY`
- shared-runtime lock·dedupe probe 실패 시 active dispatch 차단과 사람 확인 없는 relay 차단
- relay packet만 복사한 상태를 DELIVERED로 위장하는 시도와 ACK 재사용·만료·target 변조 차단
- `SIMULATED`가 실제 전달·완료 지표에 포함되지 않음
- `SIMULATED` route의 실제 전송 전환 차단과 새 child route 강제
- 00 상황실 outbound dispatch와 운영 게이트 우회 차단

## 14. 완료 조건

- 실제 발송 전 사람 Decision, capability evidence, manifest v2, plan SHA, policy SHA가 모두 결속된다.
- route별 chain과 수신 dedupe로 at-least-once 전송에서도 Task가 한 번만 실행된다.
- 모든 정상·실패·retry·rollover가 단조 증가 event chain으로 재생된다.
- 논리 chat ID와 물리 endpoint가 분리되고 provider 식별자가 공식 산출물에 남지 않는다.
- 1.7 rollover successor는 같은 logical chat ID와 mission lineage를 이어받고, Study Gate 뒤에만
  endpoint generation이 원자적으로 교체된다.
- 부서 결과는 03→02→01로만 통합되며 00·04·05의 권한이 상승하지 않는다.
- shared runtime을 검증하지 못하면 active dispatch가 불가능하고, human relay는 동일 token의 양방향
  봉인 영수증과 route별 사람 확인으로만 완료된다.
- Fable 정식 독립검수의 필수 미해결 Finding이 0이고 사람이 실제 dispatch 활성화를 승인한다.

## 15. R1·R2 Finding 반영표

| Finding | 반영 위치 |
| --- | --- |
| F1 자동 발송 권한 | §1, §10, §12 |
| F2 endpoint 계약 | §3, §12 |
| F3 ledger 원자성 | §7 |
| F4 hash·canonicalization | §5, §13 |
| F5 rollover retry | §4, §8 |
| F6 플랫폼 API 가정 | §2, §12 |
| F7 04/05 Decision | §3, §9 |
| A1 target/reply 부족 | §3, §9 |
| A2 04 식별자 충돌 | §3, §13 |
| A3 원시 thread ID | §2, §4, §8 |
| A4 상태 전이 | §6 |
| A5 전달 증명 | §6, §7 |
| A6 승인·병렬성 | §4, §8 |
| N1 02→01 return edge | §3, §9 |
| N2 HUMAN_RELAY 의미·승격 | §1, §6, §7, §9, §10 |
| N3 shared runtime·수신 dedupe | §2, §7, §13 |
| N4 1.7 successor 연결 | §2, §6, §8, §9, §11, §13, §14 |

## 16. 구현 판본과 잔여 위험

2026-09-04 `DEC-TEAM-ROUTER-ACTIVATE-NON-PROD-001`로 비운영 dispatch가 활성화됐다. manifest v2,
문서 그래프 검사, 별도 Team Router 플러그인, 봉인 Decision/receipt, Windows 사용자 전용 ACL,
정식 Fable PASS를 결속한다. 사람 relay·자동 새 채팅 생성·운영/DB/배포 mutation은 승인되지 않았다.
프로젝트 policy 구현 schema는 §10의 최소 예시를 다음 필드로 전진 확장한다.

```text
schemaVersion, mode, implementationDecisionId, decisionStatus, activationDecisionId,
dispatchEnabled, humanRelayEnabled, retryLimit, expectedChatCount, designPath,
designSha256, allowedMessageKinds
```

`designPath`는 저장소 상대 일반 파일이어야 하고 `designSha256`은 현재 bytes와 일치해야 한다. 기본은
`SIMULATION_ONLY`, `dispatchEnabled=false`, `humanRelayEnabled=false`다. 실제 활성화에는 별도
`ACTIVE_NON_PRODUCTION_DISPATCH` Decision과 activation Decision ID가 필요하다.

- Codex 앱 capability는 제품 공개 API 안정성 계약이 아니라 현재 활성 에이전트의 관측 결과다.
- 정식 Fable runner는 설치된 Claude Code `2.1.259` 허용 여부가 검증되기 전까지 실행 전 차단된다.
- 직접 Fable 검수는 advisory이며 공식 protocol PASS나 외부 gate 종결을 대체하지 않는다.
- HMAC runtime key는 Windows ACL 격리 또는 DPAPI 보호 전까지 실제 dispatch를 활성화하지 않는다.
- active send는 비운영 allowlist에 한해 열렸고 human relay와 운영 gate kind는 별도 Decision 전까지 닫아 둔다.
