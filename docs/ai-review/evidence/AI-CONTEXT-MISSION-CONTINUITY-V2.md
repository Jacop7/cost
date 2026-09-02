# AI 컨텍스트 롤오버·미션 연속성 2차 기획안

> 상태: `REVIEW_CANDIDATE v2` · 비권위 변경 제안서
> 작성일: 2026-09-02
> 선행안: `AI-CONTEXT-MISSION-CONTINUITY-V1.md` (`022840a`)
> 외부 자문: `AI-CONTEXT-MISSION-CONTINUITY-OPUS-R1.md` (`CHANGES_REQUIRED`)
> 권위 제한: 이 문서는 Claude Opus 지적을 반영한 통합 변경 후보이며 아직 `ACTIVE` 정책이 아니다.
> 채택 방식: 사람 승인 뒤 내용을 기존 다섯 권위 문서의 소유 절에 나눠 반영하고 본 문서는
> `SUPERSEDED_BY` 연결이 있는 역사적 검수 증거로 보존한다.

## 0. 2차안의 결론

장기 미션을 여러 채팅이 반복해서 이어 가려면 채팅 안의 모델에게 인계 전부를 맡겨서는 안 된다.
채팅 밖의 **Mission Continuity Controller**가 다음을 결정적으로 수행해야 한다.

```text
과거 데이터 수집·정규화
→ Mission/Task 현재 상태 확정
→ 컨텍스트 위험 관측
→ Checkpoint와 Context Capsule 봉인
→ 새 Session 생성 intent 선기록
→ 실제 Codex Session 생성
→ 새 Session의 Restore Receipt 수신
→ 외부 결정적 검증
→ 기존 lease 회수
→ NO_OWNER 안전 구간
→ successor lease 발급
→ predecessor 봉인
→ successor 미션 실행
→ 같은 절차 반복
```

새 채팅 생성은 전환의 중간 단계일 뿐이다. `Restore Verified + fencing lease granted`까지 완료돼야 같은
미션의 다음 실행 Session이 된다.

## 1. 목표와 완료 정의

### 1.1 목표

- 토큰·맥락 압력이 위험해지기 전에 AI가 전환 필요성을 판단한다.
- 허용된 환경에서는 사람의 반복 지시 없이 후속 Codex Session을 생성한다.
- 후속 Session은 대화 전체를 복사하지 않고 온톨로지로 조립한 최소 Context Capsule을 사용한다.
- 새 Session의 이해와 실제 저장소 상태를 외부 결정적 검증기가 비교한다.
- A→B뿐 아니라 B→C→D가 동일 계약으로 반복된다.
- 과거 작업 사건은 검색 가능한 기록이 되고, 검증된 패턴만 Learning으로 재사용된다.
- 미션이 완료되거나 사람이 중단하면 추가 Session 생성을 멈춘다.

### 1.2 완료 정의

다음이 실제 시험 프로젝트에서 모두 입증돼야 자동 롤오버 기능을 완료로 본다.

1. Session A→B→C 두 번 연속 자동 전환 성공
2. 사용자 재설명 없이 매 successor가 첫 안전 행동 수행
3. 필수 사실 누락 0
4. Mission별 활성 writer 항상 0개 또는 1개
5. 중복·고아 successor가 writer가 된 사례 0
6. 복원 전·lease 없는 쓰기 성공 0
7. 봉인 중 도착한 사용자 지시 손실 0
8. Windows와 Linux의 canonical manifest hash 일치
9. 비밀·개인정보의 Capsule·Git 유출 0
10. 미션 완료 뒤 불필요한 Session 생성 0

## 2. 기존 권위에 대한 단일 소유

이 문서는 최종 권위가 되지 않는다. 채택 시 아래 한 곳에서만 각 계약을 정의한다.

| 계약 | 단일 소유 문서 | 다른 문서의 표현 |
|---|---|---|
| Controller 역할·권한 상한·사전 자동 생성 승인 | 팀 구성안 | 역할 ID 참조만 |
| Mission·Session·Capsule·Receipt·Event·관계 schema | 온톨로지 기획안 | schema anchor 참조만 |
| 상태 기계·생성·복원·lease·실패 복구 | 오케스트레이션 기획안 | 상태·함수 ID 참조만 |
| 로컬 보호 장부·redacted manifest·HANDOFF 물리 위치 | 디렉터리 기획안 | 경로 ID 참조만 |
| 임계·hysteresis·지표·Learning·활성화 게이트 | 품질 평가안 | metric/policy ID 참조만 |

Context & Token Steward는 계속 관측·신호 전용이다. Mission Continuity Controller는 승인된 정책을
집행하지만 목표·범위·위험·배포·비용 정책을 승인하지 않는다.

## 3. 구성요소와 신뢰 경계

```text
┌─────────────────────────────────────────────────────────┐
│ Mission Continuity Controller — 채팅 밖 결정적 제어 평면 │
│                                                         │
│ Context Observer        Event Collector                 │
│ Rollover Policy         Capsule Builder                 │
│ Thread Capability Probe Thread Adapter                  │
│ Restore Verifier        Lease/Fencing Coordinator       │
│ Session Chain Ledger    Retrieval Indexer               │
└─────────────────────────────────────────────────────────┘
            │                         │
            ▼                         ▼
   Codex Session A/B/C          Repository authority
   비권위 추론·실행 주체          Task·Git·Decision·Test
```

### 3.1 Controller

- Mission event를 단일 append 경로로 기록한다.
- create intent를 생성 호출 전에 durable write한다.
- Codex 표면의 실제 능력을 probe한다.
- Capsule과 Receipt를 canonical byte로 비교한다.
- 활성 Session 유일성과 fencing lease를 트랜잭션으로 강제한다.
- 채팅 모델의 “복원했습니다”라는 문장을 합격 근거로 사용하지 않는다.

### 3.2 Codex Session

- 활성화 전에는 `RESTORE_ONLY` 또는 `RECOVERY_ONLY`다.
- 모든 변경 도구 호출 전에 active session과 fencing token을 확인한다.
- 생성자가 배정한 session ref를 선언하지 않고 echo한다.
- 현재 Session이 봉인됐으면 새 지시를 실행하지 않고 활성 successor를 안내한다.
- 활성화 뒤 동일한 rollover policy hash를 상속해 다음 successor를 준비할 수 있다.

### 3.3 저장소

- 공식 목표·Task·Decision·Risk·Finding·코드·시험·SHA의 권위다.
- 실제 thread ID·원시 transcript·비밀은 저장하지 않는다.
- redacted manifest와 검수 가능한 증거만 Git에 남긴다.

## 4. Mission과 Session 상태

### 4.1 Mission 상태

```text
DRAFT → ACTIVE → PAUSED → ACTIVE
                 └──────→ BLOCKED
ACTIVE → COMPLETING → COMPLETE
ACTIVE → CANCEL_PENDING → CANCELLED  # 사람 결정 필요
```

`COMPLETE | CANCELLED`는 terminal이다. terminal Mission에서는 rollover 신호를 무시하고 새 Session을
생성하지 않는다.

### 4.2 Session 상태

```text
CREATION_INTENT_RECORDED
→ CREATING
→ CREATED
→ RESTORE_ONLY
→ RESTORE_VERIFYING
→ RESTORE_VERIFIED
→ WAITING_FOR_LEASE
→ ACTIVE
→ PREPARE_ROLLOVER
→ INTAKE_ONLY
→ CHECKPOINT_SEALED
→ SEALED_SUCCESS
```

실패 terminal:

- `SEALED_REJECTED`: 복원 불일치
- `SEALED_ORPHAN`: 생성됐으나 안전하게 활성화할 수 없음
- `SEALED_STALE`: 더 최신 활성 Session이 있음
- `SEALED_CANCELLED`: 사람이 생성 시도를 취소
- `SEALED_FAILED`: 복구 불가능한 Session 오류

Mission별 계산된 `ACTIVE` Session은 정확히 하나이며 lease 회수와 발급 사이에는 0개일 수 있다. 둘 이상은
DB unique constraint와 쓰기 가드 모두가 거부한다.

## 5. 컨텍스트 위험 판단

### 5.1 입력 신호

우선순위가 높은 객관 신호:

1. 제품이 제공하는 실제 context/token budget과 사용량
2. Goal 또는 thread usage 계측
3. 자동 compaction 발생·횟수·마지막 compaction 이후 증가량
4. 입력·출력·도구 결과의 tokenizer 추정값
5. 아직 Checkpoint되지 않은 Decision·Finding·사용자 변경 수
6. 남은 작업의 예상 컨텍스트 요구량

모델의 자기복원 probe는 보조 신호로만 사용한다. probe 단독으로 `ROLLOVER_REQUIRED`를 만들지 않으며
비용을 usage에 포함한다.

### 5.2 pilot 임계

실제 사용량을 제공하는 표면의 초기 기준이다. 모델·표면별 평가 뒤 변경한다.

| 상태 | 사용률 후보 | 추가 조건 | 행동 |
|---|---:|---|---|
| `HEALTHY` | `<55%` | 열화 없음 | 계속 |
| `WATCH` | `55~69%` | 또는 미봉인 사건 증가 | 사건 정리 |
| `PREPARE` | `70~79%` | 또는 다음 단계가 대형 실행 | Capsule 예상 크기 계산 |
| `ROLLOVER_REQUIRED` | `80~89%` | 또는 compaction 후 핵심 복원 실패 | 현재 원자 단계 닫고 전환 |
| `CRITICAL` | `>=90%` | 또는 필수 권위 재현 실패 | 구현 중단·Emergency Capsule |

정확한 telemetry가 없으면 추정 사용률 하나로 자동 생성하지 않는다. `추정 사용률 + compaction/미봉인
사건/남은 작업량 중 하나`의 결합 조건을 요구한다.

### 5.3 hysteresis와 latch

- `PREPARE` 진입 뒤 같은 Task에서는 Checkpoint 완료 전 `WATCH`로 자동 하강하지 않는다.
- `ROLLOVER_REQUIRED`는 successor 활성화 또는 사람 취소 전 해제하지 않는다.
- 임계 근처 진동을 막기 위해 하강 임계는 상승 임계보다 10%p 낮게 둔다.
- 한 Session의 rollover 생성 시도는 기본 1회이며 재시도는 같은 intent 회수 절차를 먼저 거친다.

### 5.4 전환 손익

`projected_startup_cost = capsule + L0~L3 재독 + restore receipt + 검증 overhead`를 계산한다.

- 일반 Capsule은 `min(새 context window의 15%, 32k tokens)`를 pilot 상한으로 한다.
- 상한을 넘으면 필수 사실을 삭제하지 않고 원문을 경로·ID·hash로 축약한다.
- 그래도 넘으면 `CAPSULE_TOO_LARGE`로 정지하고 Task 범위 분리 또는 사람 결정을 요청한다.
- 이미 `CRITICAL`이면 절감 손익과 무관하게 Emergency Capsule로 안전 복구를 우선한다.

## 6. 미션 시작 전 데이터 수집과 온톨로지 조립

새 미션과 rollover 미션 모두 다음 진입 절차를 쓴다.

```text
사용자 요청 수집
→ 요구·제약·완료 조건 구조화
→ ADD/SUPERSEDE_PROPOSAL/NEW_TASK/STATUS_ONLY 판정
→ Mission/Task ID 결속
→ exact ID 탐색
→ 권위 그래프 1-hop 확장
→ Git·Decision·Finding·사용자 변경 검증
→ 허용 Learning 선택
→ Context Manifest 생성
→ 실행 전 preflight
→ Mission 수행
```

### 6.1 수집할 사건

- 사용자 요청·정정·취소·완료 조건 추가
- 요청 판정과 사람 승인 여부
- Task 상태·의존성·owner·lease
- 계획·구현·검증 단계의 시작·완료·실패
- Decision·Risk·Finding 상태 전이
- 변경 파일·commit·시험·CI·배포 증거
- 사용자 소유 변경과 제외 처리
- 컨텍스트 입력·크기·적용/제외 Learning
- rollover 신호·Checkpoint·create attempt/result
- restore/activation/lease 사건
- 재작업·중복 조사·사용자 재설명·회귀

### 6.2 Mission Event

```yaml
event_id: EVT-...
mission_id: MISSION-...
task_id: TASK-...
session_ref: SESSION-...
event_type: enum
observed_at: ISO-8601
source_ref: protected-local-ref | repository-ref
authority_ref: canonical-ref | null
payload_schema: schema-id
payload_hash: salted-sha256
previous_event_hash: sha256
event_hash: sha256
writer_id: controller-id
```

Event append는 Controller 단일 기록자와 compare-and-append를 사용한다. concurrent writer가 같은
`previous_event_hash` 뒤에 분기할 수 없다.

## 7. 저장 계층

### 7.1 Protected Mission Control Store

Git 밖의 앱 관리 로컬 저장소다. 구현 후보는 transaction·unique constraint·WAL·fsync를 제공하는
SQLite다.

- 실제 thread ID와 비식별 session ref 매핑
- create intent/result와 capability snapshot
- Mission event ledger
- active session unique index
- fencing lease와 heartbeat
- Capsule 원본·Receipt 원본
- 원시 transcript 위치 포인터와 salted hash

thread ID와 transcript를 저장소 파일에 기록하지 않는다. Store 위치·암호화·백업·보존은 OS와 Codex
표면별 adapter 설정이 소유한다.

### 7.2 Repository Authority

- `AGENTS.md`와 단일 권위 문서
- `docs/작업큐.md`의 현재 Task
- 코드·시험·migration·commit
- Decision·Risk·Finding·검수 증거
- 비밀 검사를 통과한 redacted HANDOFF manifest

### 7.3 Retrieval Index

권위에서 재생성 가능한 비권위 색인이다. exact identifier, typed graph edge, keyword, embedding을 가진다.
색인의 결과는 원 권위 상태·SHA를 다시 확인한 뒤에만 Context에 들어간다.

### 7.4 Learning Registry

반복 가능한 패턴만 `CANDIDATE → VERIFIED → RETIRED`로 관리한다. 작업 사건이나 모델의 자기평가는 곧
Learning이 아니다.

## 8. canonical serialization과 worktree drift

### 8.1 직렬화

- UTF-8 without BOM
- Unicode NFC
- LF 줄끝
- 저장소 루트 상대 POSIX 경로
- key lexical sort
- 배열은 schema가 순서를 소유하지 않으면 stable sort
- 시간은 UTC ISO-8601
- hash는 canonical bytes에 SHA-256

Windows·Linux 구현은 동일 fixture로 같은 byte/hash를 만들어야 한다.

### 8.2 Worktree Fingerprint

```yaml
repository_root_id: salted-project-id
branch: branch-name
head_sha: git-sha
upstream_relation: equal | ahead | behind | diverged | none
scoped_files:
  - path: repo/relative/path
    git_blob_oid: oid-or-null
    sha256: sha256
    ownership: task | user | evidence
volatile_paths: []
scoped_digest: sha256
```

범위는 `artifact_paths ∪ user_owned_changes ∪ evidence_paths`다. `.tmp`, build output 등은 Task가
명시한 `volatile_paths`에서만 제외한다.

### 8.3 Drift Policy

| 변화 | 판정 |
|---|---|
| 동일 branch의 허용 fast-forward | `RE_VERIFY` |
| 범위 밖 변경 | `ACCEPT_AND_RECORD` |
| artifact/user/evidence 범위 안 변경 | `REJECT` |
| branch 변경·diverged history | `REJECT` |
| volatile path 변화 | `IGNORE_AND_RECORD` |

`RE_VERIFY`는 변경된 SHA에서 Task·정책·scoped digest를 다시 봉인해야 한다.

## 9. Context Capsule

### 9.1 조립 원칙

1. L0 헌법·정책 hash
2. L1 Mission·Task·최신 Checkpoint·HANDOFF
3. L2 직접 권위·Decision·Risk·Finding
4. L3 직접 의존 Task·시험·검수·배포 증거
5. 충돌 시 L4 원시 증거 포인터

고갈된 predecessor가 L4 대형 탐색을 수행하지 않는다. 충돌을 `RECOVERY_REQUIRED`로 표시하고
`RECOVERY_ONLY` successor가 안전한 새 컨텍스트에서 해결한다.

### 9.2 필수 schema

```yaml
schema_version: "2.0"
capsule_id: CAPSULE:<mission_id>:<handoff_version>
mission_id: MISSION-...
task_id: TASK-...
handoff_id: HANDOFF-...
handoff_version: integer
predecessor_handoff_id: HANDOFF-... | null
predecessor_session_ref: SESSION-...
assigned_successor_session_ref: SESSION-...
chain_ledger_ref: protected-local-ref
chain_head_hash_at_seal: sha256
context_isolation_class: EXECUTION | INDEPENDENT_AUDIT
successor_creation_authorization: AUTONOMOUS | REQUIRES_USER
rollover_policy_id: POLICY-...
rollover_policy_hash: sha256
created_at: ISO-8601
source_commit_sha: git-sha
worktree_fingerprint: object
task_snapshot_hash: sha256
learning_registry_hash: sha256
objective: text
acceptance_criteria: []
completed_step_ids: []
current_step_id: STEP-...
next_safe_action:
  verb: enum
  target_ref: canonical-ref
  precondition_hash: sha256
  expected_postcondition: enum-or-hash
next_safe_action_note: text
fixed_decision_ids: []
open_decision_ids: []
open_risk_ids: []
open_finding_ids: []
artifact_paths: []
reference_paths: []
evidence_paths: []
excluded_paths: []
user_owned_changes: []
pending_user_inputs: []
commands_in_flight:
  - argv_template: []
    environment_reference_names: []
last_test_evidence: []
applied_learning_ids: []
excluded_learning_ids: []
required_items: []
conditional_items: []
omitted_items_with_reason: []
recovery_flags: []
manifest_sha256: sha256
content_sha256: sha256
```

### 9.3 격리 등급

`EXECUTION`은 Task 수행에 필요한 유효 Decision·Finding·Learning ID를 받는다.

`INDEPENDENT_AUDIT`은 기존 감사 결론·Finding 해석·Learning 요약을 받지 않는다. 승인 명세·소스·시험
원본과 허용된 공동 장부만 받으며, 기존 결론 집합은 개수와 봉인 hash만 두고 독립 결론 제출 전 열람을
금지한다. 열람되면 감사 결과를 오염 상태로 표시하고 독립 회차로 세지 않는다.

### 9.4 비밀 검사

Capsule 봉인 전에 secret·개인정보·운영 데이터 패턴 검사를 실행한다. 명령은 값이 치환된 command line이
아니라 argv template과 환경변수 이름만 기록한다. 실패하면 `CAPSULE_REDACTION_FAILED`이고 Session을
생성하지 않는다. Git에는 redacted manifest만 들어간다.

### 9.5 Emergency Capsule

`CRITICAL`에서 정식 Capsule을 만들 수 없을 때 다음만 봉인한다.

- Mission/Task/session/handoff identity
- branch·HEAD·Task snapshot
- 구조화 next action
- 미봉인 사실의 protected store pointer
- 사용자 변경·제외 경로
- 정책 hash

successor는 `RECOVERY_ONLY`로 시작해 쓰기 없이 정식 Capsule을 재구성하고 외부 검증을 받은 뒤에만
일반 복원 절차로 들어간다.

## 10. Thread Capability와 생성 방식

### 10.1 Capability Snapshot

`PREPARE_ROLLOVER` 전에 실제 표면에서 다음을 probe하고 결과·제품 판본·시각을 봉인한다.

```yaml
surface_id: codex-app | codex-app-server | codex-cli | other
create: boolean
list: boolean
read_first_turn: boolean
wait: boolean
send: boolean
archive_or_seal_notice: boolean
token_budget_introspection: boolean
goal_state: boolean
capability_hash: sha256
```

자동 생성은 `create + list + read_first_turn + send`가 모두 true일 때만 가능하다. wait가 없으면 제한된
polling adapter를 쓸 수 있으나 timeout과 backoff를 정책에 명시한다. 회수 능력이 없으면
`ROLLOVER_BLOCKED_REQUIRES_USER`로 강등한다.

### 10.2 Fresh/Fork/Resume

- 기본: fresh Session + 최소 Capsule. 토큰 절감 목적에 맞는다.
- fork: 원시 history가 반드시 필요한 예외이며 새 session ref·handoff_version을 갖는다. 원본은 즉시
  `INTAKE_ONLY`가 되고 fork도 복원 검증을 생략하지 않는다.
- resume: 같은 Session을 다시 여는 것이며 rollover나 새 handoff_version으로 세지 않는다.

## 11. Write-ahead 생성과 고아 회수

### 11.1 생성 전

Controller가 transaction 안에서 다음을 수행한다.

1. Mission이 ACTIVE이고 현재 active Session이 하나인지 확인한다.
2. 다음 `handoff_version`과 `assigned_successor_session_ref`를 발행한다.
3. `idempotency_key = mission_id + task_id + handoff_version`을 만든다.
4. Capsule을 봉인한다.
5. `CREATE_ATTEMPT`를 append하고 durable commit한다.
6. commit 성공 뒤에만 Thread Adapter를 호출한다.

### 11.2 생성 prompt

첫 줄은 기계 식별자다.

```text
MISSION_RESTORE <idempotency_key> <assigned_successor_session_ref> <capsule_hash>
```

그 뒤 `RESTORE_ONLY`, 쓰기 금지, Capsule 위치/내용, Receipt schema를 전달한다.

### 11.3 생성 결과

- thread ID 반환 뒤 protected store에 `CREATE_RESULT`를 append한다.
- list/read로 첫 restore turn에 idempotency key가 존재하는지 확인한다.
- title이나 자연어 요약으로 successor를 식별하지 않는다.
- timeout이면 `ROLLOVER_INDETERMINATE`로 전환해 동일 key를 검색한다.
- 발견하면 기존 Session을 회수하고, 찾지 못해도 사람 판정 전 재생성하지 않는다.
- 발견됐으나 restore turn을 확인할 수 없으면 `SEALED_ORPHAN`이다.

## 12. 봉인 중 사용자 입력

`CHECKPOINT_SEALED` 뒤 predecessor는 `INTAKE_ONLY`다.

- 새 입력을 실행하지 않는다.
- 입력을 `PENDING_INTAKE` 사건으로 append하고 접수 사실을 사용자에게 알린다.
- 상태 질문은 현 Capsule의 `pending_user_inputs`에 추가한다.
- 목표·완료 조건·artifact/excluded path·취소를 바꾸는 입력은 현 Capsule을
  `CAPSULE_SUPERSEDED`로 만들고 `handoff_version+1`로 재봉인한다.
- successor 활성화 뒤 첫 행동은 pending 입력의 분류·사용자 확인이다.
- pending 입력을 처리하기 전에 `next_safe_action`을 실행하지 않는다.
- 같은 전환에서 재봉인이 3회를 넘으면 자동 생성을 멈추고 사람에게 범위를 확정받는다.

## 13. Restore Receipt와 결정적 검증

### 13.1 successor의 Restore Receipt

```yaml
schema_version: "2.0"
restore_receipt_id: RESTORE-...
echo_idempotency_key: string
echo_assigned_successor_session_ref: SESSION-...
echo_capsule_hash: sha256
mission_id: MISSION-...
task_id: TASK-...
handoff_version: integer
loaded_instruction_paths: []
observed_policy_hashes: []
observed_rollover_policy_hash: sha256
observed_branch: branch
observed_head_sha: git-sha
observed_upstream_relation: enum
observed_scoped_files: []
observed_scoped_digest: sha256
observed_task_snapshot_hash: sha256
observed_learning_registry_hash: sha256
recovered_objective_hash: sha256
recovered_acceptance_hash: sha256
recovered_next_safe_action: object
recovered_open_ids: []
recovered_user_owned_changes: []
recovered_excluded_paths: []
recovered_pending_user_inputs: []
write_attempt_count_during_restore: 0
receipt_sha256: sha256
```

### 13.2 Restore Verifier

채팅 밖 순수 함수다.

```text
verify_restore(canonical_capsule, canonical_receipt, live_repository_probe)
→ PASS
| REJECT(mismatch_fields[])
| RE_VERIFY(drift_fields[])
| NEEDS_ADJUDICATION(non_deterministic_fields[])
```

- LLM을 호출하지 않는다.
- free text 의미 비교를 하지 않는다.
- 모든 비교 필드는 exact/hash/enum/set 규칙을 가진다.
- Activation Receipt는 PASS일 때만 Verifier가 만든다.
- predecessor나 successor가 합격을 자기 선언할 수 없다.

### 13.3 Activation Receipt

```yaml
activation_id: ACTIVATE-...
mission_id: MISSION-...
task_id: TASK-...
handoff_version: integer
successor_session_ref: SESSION-...
capsule_hash: sha256
restore_receipt_hash: sha256
verified_by: verifier-binary-id
verifier_version: version
verifier_hash: sha256
granted_fencing_token: integer
inherited_rollover_policy_hash: sha256
chain_head_hash_after: sha256
activated_at: ISO-8601
receipt_sha256: sha256
```

## 14. Lease와 실행권 인계

### 14.1 lease

```yaml
mission_id: MISSION-...
task_id: TASK-...
holder_session_ref: SESSION-... | null
fencing_token: integer
granted_at: ISO-8601 | null
heartbeat_at: ISO-8601 | null
ttl_seconds: integer
lease_state: ACTIVE | REVOKED | NO_OWNER | EXPIRED
```

### 14.2 인계 순서

```text
RESTORE_VERIFIED
→ predecessor lease REVOKE + fencing_token 증가
→ NO_OWNER durable commit
→ successor lease GRANT with latest fencing_token
→ Activation Receipt append
→ successor ACTIVE unique index commit
→ predecessor SEALED_SUCCESS
```

어느 단계에서든 실패하면 자동으로 predecessor에게 lease를 되돌리지 않는다. `NO_OWNER`에서 원인을
봉인하고 명시적 `LEASE_REGRANT` 또는 successor grant를 수행한다.

### 14.3 쓰기 가드

모든 파일 수정·commit·push·외부 변경 도구 전에 다음을 확인한다.

1. ledger의 `latest_active_session_ref == self.session_ref`
2. lease holder 일치
3. local fencing token == ledger latest token
4. heartbeat와 TTL 유효
5. Task artifact scope 안의 행동

하나라도 틀리면 도구 호출 전에 차단하고 `STALE_SESSION_WRITE_BLOCKED`를 append한다.

## 15. 반복 Session Chain

```yaml
mission_id: MISSION-001
rollover_policy_hash: sha256
sessions:
  - session_ref: SESSION-A
    ordinal: 1
    handoff_in: 0
    handoff_out: 1
    status: SEALED_SUCCESS
  - session_ref: SESSION-B
    ordinal: 2
    handoff_in: 1
    handoff_out: 2
    status: SEALED_SUCCESS
  - session_ref: SESSION-C
    ordinal: 3
    handoff_in: 2
    handoff_out: null
    status: ACTIVE
latest_active_session_ref: SESSION-C
latest_fencing_token: 3
chain_head_hash: sha256
```

successor가 다음 Session을 만들 수 있는 조건:

- 자신이 Mission의 유일 ACTIVE Session
- 현재 fencing token 보유
- 상속한 rollover policy hash와 현재 ACTIVE policy hash 일치
- capability snapshot 유효
- 미션 terminal 아님
- 새 Checkpoint와 Capsule 검증 성공

정책 hash가 바뀌면 `POLICY_DRIFT`로 멈추고 새 정책을 자동 수용하지 않는다.

## 16. 거부·고아·옛 Session 처리

- `SEALED_REJECTED | SEALED_ORPHAN | SEALED_STALE`은 terminal이며 다시 활성화하지 않는다.
- Controller는 terminal Session에 종결 안내 turn을 보낸다.
- 안내에는 현재 활성 successor의 사용자 표시 이름만 포함하고 실제 내부 ID는 노출하지 않는다.
- 사용자가 옛 Session에 “계속”이라고 보내면 상태 설명과 현재 Session 이동 안내만 한다.
- 쓰기 가드가 실제 도구 실행을 막으므로 모델 지침 누락만으로 재활성화되지 않는다.
- 시험 Session은 `[ROLLOVER-TEST][SEALED]` 같은 표시 규약과 별도 시험 프로젝트를 사용한다.
- 시험 종료 뒤 archive하되 삭제하지 않으며 증거 보존 기간 뒤 사람 정책으로 정리한다.

## 17. 과거 검색과 현재 미션 연결

```text
exact identifier
→ current Task/Mission
→ typed graph 1-hop
→ path/status/time filtered keyword search
→ bounded semantic candidates
→ canonical source re-read
→ current status/SHA validation
→ Context inclusion decision
```

각 검색 결과는 source, authority, status, SHA/hash, relation path, retrieval reason을 가진다. 의미 검색은
후보 최대 수와 토큰 상한을 적용한다. L4 원시 transcript는 protected pointer와 salted hash가 있는 경우에만
읽고, 권위 충돌을 해소하는 증거가 아니라 사용자 의도를 재확인하는 보조 자료로 쓴다.

## 18. Learning

```text
Mission Event·Finding·Test·Incident
→ 반복 패턴 후보
→ CANDIDATE
→ 원시 근거 결속
→ 독립 역할 재현
→ 다른 Task/hold-out 회귀시험
→ 사람 지정 검증자 Decision
→ VERIFIED
→ 허용 Task에 ID 주입
→ 효과·부작용 관측
→ 재검증 또는 RETIRED
```

- Capsule은 `learning_registry_hash`를 가진다.
- successor 복원 시 각 적용 ID를 현재 registry에서 다시 읽는다.
- `RETIRED`, 기한 만료, 충돌 Learning은 적용에서 제거하고 `LEARNING_STALE`을 기록한다.
- Learning 제거는 Mission 활성화를 막지 않지만 적용하려던 행동은 다시 계획한다.
- 최초 독립 감사에는 Learning·기존 결론을 주입하지 않는다.
- 원시 transcript·비밀·개인정보·단발 성공·모델 자기평가는 Learning으로 승격하지 않는다.

## 19. 실패 폐쇄

| 실패 | 결과 |
|---|---|
| token telemetry 없음 | 결합 추정 신호 또는 사용자 승인형 전환 |
| Capsule 필수 필드 누락 | `CAPSULE_INVALID`, 생성 금지 |
| redaction 실패 | `CAPSULE_REDACTION_FAILED`, 생성 금지 |
| Capsule 과대 | `CAPSULE_TOO_LARGE`, 범위 결정 요청 |
| create intent durable write 실패 | 생성 호출 금지 |
| create timeout | `ROLLOVER_INDETERMINATE`, 회수만 허용 |
| 고아 발견·검증 불가 | `SEALED_ORPHAN` |
| Receipt timeout | predecessor `INTAKE_ONLY`, lease 유지 |
| Restore mismatch | `SEALED_REJECTED`, 더 높은 판본 재조립 |
| 비결정 필드 | `RESTORE_NEEDS_ADJUDICATION` |
| drift 허용 fast-forward | `RE_VERIFY` |
| lease revoke 뒤 grant 실패 | `NO_OWNER`, 자동 rollback 금지 |
| heartbeat 만료 | `LEASE_EXPIRED`, 쓰기 차단·사람/Controller 복구 |
| policy hash 변경 | `POLICY_DRIFT`, 자동 생성 금지 |
| terminal Mission | 생성 금지 |

실패 Session과 생성 시도는 삭제하거나 PASS로 합성하지 않는다.

## 20. 실제 검증

### 20.1 결정적 시험

- canonical serialization Windows/Linux parity
- event compare-and-append 경쟁
- Mission active Session unique constraint
- create write-ahead kill injection
- 고아 회수와 중복 생성 차단
- receipt 필드별 단독 변조
- worktree drift 세 갈래
- revoke→NO_OWNER→grant 각 단계 kill
- stale Session 쓰기 도구 차단
- 봉인 중 사용자 입력 세 유형
- Learning retirement와 감사 격리
- emergency recovery
- terminal Mission 생성 차단

### 20.2 실제 A→B→C E2E

1. 격리된 시험 프로젝트·전용 이름을 만든다.
2. A가 작은 비파괴 Task를 수행한다.
3. 테스트용 정책 신호로 A→B를 실행한다.
4. B의 Restore Receipt와 Activation Receipt를 검증한다.
5. B가 다음 단계를 수행하고 B→C를 실행한다.
6. C가 사용자 재설명 없이 남은 Task를 완료한다.
7. A와 B에 각각 “계속”을 보내 쓰기 차단과 C 안내를 확인한다.
8. create 응답 전 kill, receipt timeout, 범위 변경 입력을 별도 반복한다.
9. thread·event·Git·lease 증거를 비식별 hash로 봉인한다.
10. 시험 Session을 SEALED 표시 후 archive한다.

실제 E2E 전에는 자동화를 운영 프로젝트에 적용하지 않는다.

## 21. 지표

| 지표 | 분모·의미 |
|---|---|
| restore success | 첫 시도 PASS handoff / 전체 handoff |
| restore attempts | handoff별 검증 시도 수 |
| recursive success | A→B와 B→C 모두 PASS한 Mission / 대상 Mission |
| required fact recall | 정확히 복원한 필수 field / 봉인 필수 field |
| handoff loss | predecessor에 있었으나 successor에 없는 필수 사건 |
| duplicate successor | Mission에서 동시에 활성화된 successor |
| stale write blocked | 가드가 실행 전에 막은 stale Session 쓰기 |
| unauthorized write success | 가드를 통과해 실제 발생한 무권한 쓰기; 목표 0 |
| machine resume latency | create intent부터 activation까지의 기계 시간 |
| human wait latency | 사람 결정을 기다린 별도 시간 |
| capsule ratio | Capsule token / predecessor 전체 추정 token |
| startup cost | Capsule+재독+receipt+검증 token/time |
| needless/late rollover | 불필요/지연 전환 비율 |
| learning reuse effect | 적용 전후 재작업·Finding·복원 성공 변화 |

핵심 안전 지표는 평균으로 상쇄하지 않는다. 활성화 표본에서 handoff loss, duplicate active successor,
unauthorized write success, secret leak, stale restore가 모두 0이어야 한다.

## 22. 도입 단계

1. **문서 분산 반영안**: 다섯 권위 문서별 patch map과 중복 권위 검사를 만든다.
2. **결정적 core**: canonical schema, ledger, verifier, fencing, 사보타주를 구현한다.
3. **Shadow mode**: 실제 작업에서 신호·Capsule·예상 검증만 만들고 Session은 생성하지 않는다.
4. **승인형 E2E**: 매 전환 사용자 승인으로 A→B→C를 검증한다.
5. **제한 자동 생성**: 사람의 Mission 단위 사전 승인과 저위험 분류를 충족한 Task만 자동화한다.
6. **반복 운영 평가**: 모델·표면별 임계와 비용을 조정하고 회귀 시 승인형으로 자동 강등한다.
7. **스타터 키트**: Controller core와 프로젝트 adapter/profile을 분리해 빈 저장소에서 재현한다.

제한 자동 생성의 초기 허용 Task는 문서·읽기·비파괴 분석처럼 되돌릴 수 있는 R0/R1이고, DB schema,
migration, 배포, 운영 데이터, 권한, 결제, 사용자 소유 파일 변경은 제외한다.

## 23. 사람 결정이 필요한 항목

1. 자동 생성의 사전 승인을 프로젝트 단위로 할지 Mission 단위로 할지
2. Protected Mission Control Store의 실제 경로·암호화·백업·보존 기간
3. Capsule 원본과 raw transcript pointer의 보존 기간
4. capability가 부족한 표면에서 사용자 승인형 생성 UX
5. 실제 사용 모델별 pilot token 임계 조정
6. `NO_OWNER` 복구에서 Controller 자동 재부여를 허용할 저위험 범위
7. 시험 Session의 자동 archive와 최종 삭제 정책
8. Mission Event 중 법적·감사 보존 대상 분류

이 항목은 자동화 구현 전에 사람 Decision으로 봉인한다. 결정 전에는 shadow mode 또는 승인형 E2E만
허용한다.

## 24. Opus Finding 반영표

| Finding | 반영 위치 | 상태 |
|---|---|---|
| RC-01 외부 결정적 검증자 | §3, §13 | 반영 |
| RC-02 fencing·NO_OWNER | §14 | 반영 |
| RC-03 write-ahead·능력 probe | §10, §11 | 반영 |
| RC-04 Mission 활성 Session 유일성 | §4, §16 | 반영 |
| RC-05 봉인 중 사용자 입력 | §12 | 반영 |
| RC-06 canonical hash·drift | §8 | 반영 |
| RC-07 재귀 권한·Activation Receipt | §9, §13, §15 | 반영 |
| RC-08 격리·redaction·Learning 갱신 | §7, §9, §18 | 반영 |
| M-01 Emergency Capsule | §9.5 | 반영 |
| M-02 hysteresis | §5.3 | 반영 |
| M-03 fork/resume | §10.2 | 반영 |
| M-04 compare-and-append | §6.2, §7.1 | 반영 |
| M-05 startup cost | §5.4, §21 | 반영 |
| M-06 probe 자기참조 | §5.1 | 반영 |
| M-07 L4 탐색 비용 | §9.1, §17 | 반영 |
| M-08 지표 분모 | §21 | 반영 |
| M-09 저위험 분류 | §22 | 반영 |
| M-10 시험 Session 정리 | §16, §20.2 | 반영 |

## 25. 2차안의 남은 게이트

- 기존 다섯 권위 문서 실제 조문과 patch map 대조
- canonical schema·Verifier·fencing의 실행형 시뮬레이션
- Claude Opus 후속 재검수에서 RC-01~08의 동일 ID 확인
- 저장소 규칙상 필요한 공식 Fable 검수는 별도이며 이번 Opus 자문으로 대체하지 않음
- 사람의 자동 생성 권한·보존 정책 Decision
- 승인 전 실제 운영 디렉터리·Controller·자동 Session 생성 기능 미물질화
