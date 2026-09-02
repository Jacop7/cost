# AI 컨텍스트 롤오버·미션 연속성 1차 기획안

> 상태: `REVIEW_CANDIDATE v1` · 비권위 변경 제안서
> 작성일: 2026-09-02
> 목적: Claude/Fable 토론·검수 입력
> 권위 제한: 이 문서는 새 정책 원본이 아니다. 검수 뒤 채택된 내용은 기존 다섯 권위 문서의 소유 절에
> 반영하며, 이 문서와 후속 판본은 검수·결정 이력으로만 보존한다.

## 1. 목표

하나의 장기 미션을 여러 Codex 채팅이 차례로 이어 수행하되 사용자가 과거 내용을 다시 설명하지 않아도
다음 채팅이 직전 실행 지점부터 안전하게 계속하게 한다. 전환은 일회성이 아니라 아래 수명주기를 미션
완료까지 반복한다.

```text
SESSION-A 실행
→ 컨텍스트 위험 감지
→ CHECKPOINT 봉인
→ 최소 컨텍스트 캡슐 조립
→ SESSION-B 생성
→ SESSION-B 복원 검증
→ 실행권·edit lease 인계
→ SESSION-A 봉인
→ SESSION-B 실행
→ 같은 절차 반복
→ 미션 완료·종결
```

성공 기준은 새 채팅 생성 자체가 아니다. 후속 채팅이 사용자 재설명 없이 다음을 모두 재현하고 첫 안전
행동을 수행해야 한다.

- 미션의 원래 목표와 완료 조건
- 현재 Task와 정확한 다음 실행점
- 완료·실패·미결 작업
- 유효한 Decision·Risk·Finding
- 대상 파일·제외 파일·사용자 소유 변경
- 현재 branch·HEAD·검증 증거
- 적용·제외 Learning
- 다음 롤오버를 수행할 동일한 제어 계약

## 2. 기존 권위와 반영 경계

새 주제 권위 문서를 만들지 않는다. 채택 시 책임은 다음 기존 문서에 나눠 반영한다.

| 주제 | 단일 소유 문서 |
|---|---|
| 역할·권한·사람 승인·전환 권한 | `docs/팀구성_상세기획안.md` |
| 기억 노드·관계·HANDOFF·검색 순서 | `docs/AI-지식-온톨로지-기획안.md` |
| 감지→체크포인트→생성→검증→인계 실행 흐름 | `docs/AI-오케스트레이션-상세기획안.md` |
| HANDOFF·색인·가까운 README의 물리 위치 | `docs/디렉터리-문서신경망-재설계-기획안.md` |
| 임계·재개 성공·손실·학습 품질 평가 | `docs/AI-품질-학습-자율성-평가기획안.md` |

현재 확정 정책에서 Context & Token Steward는 관측·신호 전용이다. 실제 채팅 생성과 검증은 별도
`ROLLOVER-ORCHESTRATOR` 실행 책임으로 분리한다. Steward가 생성·승인·lease 인수 권한을 얻지는 않는다.

## 3. 용어

| 용어 | 뜻 |
|---|---|
| Mission | 여러 Task와 여러 채팅에 걸쳐 달성해야 하는 장기 목표 |
| Session | 미션을 일정 컨텍스트 범위 안에서 수행하는 한 채팅 |
| Rollover | 현재 Session의 실행권을 새 Session으로 안전하게 넘기는 전환 |
| Checkpoint | 전환 직전의 Task·Git·결정·증거 상태를 봉인한 기록 |
| Context Capsule | 후속 Session이 복원에 필요한 최소 입력 묶음 |
| Restore Receipt | 후속 Session이 실제 상태를 다시 읽고 제출하는 복원 결과 |
| Activation Receipt | 비교 검증 통과 뒤 후속 Session에 실행권이 생겼다는 결과 |
| Session Chain | 같은 Mission에 속한 predecessor/successor Session의 append-only 계보 |

## 4. 핵심 불변식

1. 채팅 원문과 모델 메모리는 공식 권위가 아니다.
2. 모든 Session은 하나의 `mission_id`와 현재 `task_id`를 가진다.
3. 같은 Task의 `handoff_version`은 1부터 단조 증가한다.
4. 같은 predecessor·handoff_version으로 둘 이상의 활성 successor를 만들지 않는다.
5. 후속 Session은 복원 검증 전 파일 수정·외부 변경·lease 인수를 하지 않는다.
6. 이전 Session은 후속 Session의 Activation Receipt 전 실행권을 해제하지 않는다.
7. 전환 중에는 최대 하나의 쓰기 소유자만 존재한다.
8. 완료된 미션은 새 Session을 만들지 않는다.
9. 생성·검증 실패는 현재 Session을 가능한 범위에서 유지하고 PASS나 인계 완료로 합성하지 않는다.
10. 최소 컨텍스트는 작은 요약이 아니라 필수 사실의 완전성이 검증된 패킷이다.
11. 검색 결과·임베딩·메모리·대화 요약은 후보 탐색만 하며 Task·Git·Decision을 덮어쓰지 않는다.
12. successor는 동일한 롤오버 계약을 상속해 다시 successor를 만들 수 있어야 한다.

## 5. 컨텍스트 위험 감지

### 5.1 단일 토큰 임계의 한계

컨텍스트 전환은 추정 토큰 비율 하나로 결정하지 않는다. 제품이 정확한 잔여 컨텍스트를 제공하지 않을
수 있고, 같은 토큰 양이라도 미결 결정·대형 도구 출력·압축 횟수에 따라 손실 위험이 다르다.

### 5.2 관측 신호

Steward는 다음을 읽기 전용으로 관측한다.

- 제공되는 실제 token budget·사용량·잔량
- 입력·출력과 도구 결과의 추정 토큰
- 자동 compaction 횟수와 마지막 compaction 이후 증가량
- 현재 Task의 열린 Decision·Finding·작업 단계 수
- 아직 저장소에 체크포인트되지 않은 결정·검증 결과의 수
- 모델이 권위 경로·다음 행동·사용자 제외 파일을 재현하는지 확인하는 짧은 probe
- 최근 반복 질문·이미 끝낸 조사 반복·잘못된 파일 인용 같은 맥락 열화 신호

### 5.3 단계

정확한 수치는 평가 기획안의 기준선으로 조정하며 v1에서는 상태 의미만 고정한다.

| 상태 | 의미 | 행동 |
|---|---|---|
| `HEALTHY` | 안전 여유 | 작업 계속 |
| `WATCH` | 압력 상승 | 미저장 사건 정리, 다음 체크포인트 후보 준비 |
| `PREPARE` | 전환 비용보다 손실 위험이 커짐 | 장기 도구 호출 신규 시작 금지, Checkpoint 준비 |
| `ROLLOVER_REQUIRED` | 후속 Session이 필요 | 현재 원자 작업만 닫고 생성 절차 시작 |
| `CRITICAL` | 맥락 손실 임박·이미 관측 | 새 구현 중단, 권위 상태만 봉인하고 복원 우선 |

하드 트리거는 사용 가능한 실제 컨텍스트 잔량, 복원 probe 실패, 미봉인 핵심 결정 증가다. 소프트
트리거는 예상 작업 길이, 대형 시험·검수 직전, 맥락 열화 징후다. 정확한 기본 임계는 실제 표본으로
결정하고 모델별로 분리한다.

## 6. 과거 데이터 수집

### 6.1 네 층

| 층 | 보관 내용 | 권위 | 기본 보존 |
|---|---|---|---|
| Runtime transcript | 로컬 채팅의 원시 turn·tool event | 비권위·민감 | 제품 보존 설정 |
| Mission event ledger | 요청 판정·Decision·Checkpoint·Handoff·Receipt·실패 | 운영 권위/append-only | 미션 수명+감사 기간 |
| Repository evidence | 공식 문서·코드·시험·commit·review | 해당 주제 권위 | Git 정책 |
| Learning registry | 독립 검증된 재사용 규칙과 근거 ID | 제한적 재사용 | review_by·폐기 조건 |

원시 대화 전체를 Git에 복사하지 않는다. 저장소에는 비식별 conversation reference, 필요한 최소 인용,
결정·요구·실패의 구조화 사건과 원본 위치의 hash만 둔다. 비밀·개인정보·운영 DB 원문은 수집하지 않는다.

### 6.2 사건 수집

다음 사건을 발생 시점에 구조화한다.

- 사용자 요청·정정·취소·완료 조건 추가
- `ADD | SUPERSEDE_PROPOSAL | NEW_TASK | STATUS_ONLY` 판정
- 계획·구현 단계 시작·완료·실패
- 파일·schema·API 계약 변경
- Decision·Risk·Finding의 생성·상태 전이
- 실행 명령·결과·환경·SHA
- 사용자 파일 발견과 제외 처리
- 컨텍스트 입력 목록·크기·Learning 목록
- rollover 신호·Checkpoint·생성 시도·복원·인계 결과
- 동일 원인의 재작업·사용자 재설명·회귀

각 사건은 최소 `event_id`, `mission_id`, `task_id`, `session_ref`, `event_type`, `observed_at`,
`source_ref`, `source_sha256`, `authority_ref`, `status`, `previous_event_hash`, `event_hash`를 가진다.

### 6.3 수집과 학습의 분리

사건은 곧 Learning이 아니다. 반복 가능한 패턴만 `CANDIDATE`로 제안하고 원시 근거 연결, 반대 역할의
재현, 다른 Task 또는 회귀시험, 사람 지정 검증자 확인을 거쳐 `VERIFIED`로 승격한다. 관련 Task에는
Learning 본문 전체가 아니라 허용된 ID와 근거 hash만 주입한다. 독립 감사에는 기존 결론을 주입하지
않는다.

## 7. 최소 컨텍스트 캡슐 조립

### 7.1 조립 순서

1. exact ID로 L0 헌법과 정책 hash를 읽는다.
2. L1 Mission·Task·최신 Checkpoint·HANDOFF·다음 행동을 읽는다.
3. L2 Task가 직접 가리키는 권위·Decision·Risk·열린 Finding을 읽는다.
4. L3 직접 의존 Task와 관련 시험·검수·배포 증거만 1-hop으로 읽는다.
5. 충돌·근거 부족 시에만 L4 원시 감사·비식별 과거 대화를 찾는다.
6. exact ID→그래프 관계→키워드→의미 검색 순으로 후보를 찾는다.
7. 각 항목을 `REQUIRED`, `CONDITIONAL`, `OMITTED_WITH_REASON`으로 분류한다.
8. manifest와 content hash를 만든 뒤 완전성 검사를 통과해야 봉인한다.

### 7.2 필수 캡슐 스키마

```yaml
capsule_id: CAPSULE:<mission_id>:<handoff_version>
mission_id: MISSION-...
task_id: TASK-...
handoff_id: HANDOFF:...
handoff_version: 1
predecessor_handoff_id: null
predecessor_session_ref: SESSION-...
intended_successor_role_context: SOLAR-... | CODEX-...
created_at: ISO-8601
source_commit_sha: git-sha
worktree_fingerprint: sha256
task_snapshot_hash: sha256
policy_hashes: []
objective: text
acceptance_criteria: []
completed_steps: []
current_step: text
next_safe_action: text
fixed_decision_ids: []
open_decision_ids: []
open_risk_ids: []
open_finding_ids: []
artifact_paths: []
reference_paths: []
evidence_paths: []
excluded_paths: []
user_owned_changes: []
commands_in_flight: []
last_test_evidence: []
applied_learning_ids: []
excluded_learning_ids: []
rollover_policy_id: POLICY-...
required_items: []
conditional_items: []
omitted_items_with_reason: []
manifest_sha256: sha256
content_sha256: sha256
```

### 7.3 토큰 예산 처리

필수 항목은 토큰을 이유로 제거하지 않는다. 예산을 넘으면 본문 복사 대신 exact 경로·줄·ID·hash와
짧은 사실을 남긴다. 그래도 넘으면 Task를 임의 분할하지 않고 `CAPSULE_TOO_LARGE`로 중단해 사람 또는
오케스트레이터가 범위를 조정한다. 큰 로그는 원본 hash·판별력·재현 명령·결과로 축약한다.

## 8. 새 Session 생성

### 8.1 생성 방식 선택

| 방식 | 사용 조건 | 주의 |
|---|---|---|
| Fresh thread | 토큰 절약이 목적이고 저장소 캡슐로 복원 가능 | 기본 후보 |
| Fork | 특정 완료 turn까지의 원문이 반드시 필요한 예외 | 전체 과거 복사로 절감 효과가 줄 수 있음 |
| Resume | 새 컨텍스트가 아니라 같은 Session 재개 | rollover로 세지 않음 |

제품 표면이 제공하는 공식 thread 생성 도구 또는 Codex App Server의 thread API만 사용한다. GUI 자동
클릭을 권위 경로로 사용하지 않는다. 사람의 사전 정책이 자동 생성을 허용하지 않거나 제품 권한이
없으면 `ROLLOVER_BLOCKED_REQUIRES_USER`로 멈추고 생성 요청만 한다.

### 8.2 생성 요청

```yaml
creation_request_id: CREATE:<mission_id>:<handoff_version>
idempotency_key: <mission_id>:<task_id>:<handoff_version>
project_id: project-id
environment: local | worktree
cwd: canonical-workspace-root
model: inherited-or-explicit
reasoning_effort: inherited-or-explicit
title: <mission short name> · S<handoff_version+1>
initial_prompt:
  - capsule path/content
  - RESTORE_ONLY before activation
  - required receipt schema
  - no writes before RESTORE_VERIFIED
```

같은 idempotency key의 성공 receipt가 있으면 다시 생성하지 않는다. 호출 timeout 뒤에는 목록과
계보를 조회해 성공 여부를 확인하고, 불명확한 상태에서 두 번째 successor를 만들지 않는다.

### 8.3 생성 성공의 정의

도구가 thread ID를 반환한 것만으로 성공이 아니다. 다음 모두가 있어야 `SESSION_CREATED`다.

- 저장된 successor thread 또는 task ID
- 대상 프로젝트·환경·cwd 일치
- predecessor와 handoff_version 계보 연결
- 첫 restore turn 접수 확인
- 중복 successor 없음

실제 thread ID는 민감한 로컬 운영 장부에만 두고 Git에는 비식별 `session_ref`와 hash만 기록한다.

## 9. 복원 검증 handshake

### 9.1 후속 Session의 첫 행동

후속 Session은 `RESTORE_ONLY`로 시작한다. 캡슐의 결론을 그대로 믿지 않고 저장소와 제품 상태를 다시
읽어 아래 Restore Receipt를 반환한다.

```yaml
restore_receipt_id: RESTORE:<mission_id>:<handoff_version>
successor_session_ref: SESSION-...
mission_id: MISSION-...
task_id: TASK-...
handoff_version: 1
loaded_instruction_paths: []
observed_branch: branch
observed_head_sha: git-sha
observed_origin_relation: text
observed_worktree_fingerprint: sha256
observed_task_snapshot_hash: sha256
observed_policy_hashes: []
recovered_objective: text
recovered_next_safe_action: text
recovered_open_ids: []
recovered_user_owned_changes: []
recovered_excluded_paths: []
intended_first_action: text
receipt_sha256: sha256
```

### 9.2 비교자와 합격 조건

롤오버 오케스트레이터가 Capsule과 Restore Receipt를 필드별 비교한다. 비교자는 successor 자신의
자기평가만으로 대체하지 않는다.

- Mission·Task·handoff_version exact match
- instruction·policy hash 일치
- branch·HEAD·worktree 관계 허용 범위 일치
- Task snapshot과 열린 ID 집합 일치
- 사용자 변경·제외 경로 누락 0
- `next_safe_action` 의미와 대상 일치
- predecessor당 활성 successor 정확히 1
- 복원 중 쓰기·외부 변경 0

모두 통과하면 append-only Activation Receipt를 만들고 같은 lock 안에서 edit lease를 successor로
이전한다. 하나라도 실패하면 `RESTORE_REJECTED`로 남기고 누락 원인을 보완한 더 높은 HANDOFF 또는 새
생성 시도를 사용한다. 실패한 Session을 삭제해 이력을 숨기지 않는다.

### 9.3 인계 원자성

```text
PREDECESSOR_ACTIVE
→ CHECKPOINT_SEALED
→ CAPSULE_READY
→ SUCCESSOR_CREATING
→ SUCCESSOR_CREATED
→ RESTORE_VERIFYING
→ RESTORE_VERIFIED
→ LEASE_TRANSFERRED
→ SUCCESSOR_ACTIVE
→ PREDECESSOR_SEALED
```

중간 실패 시 이전 Session은 `ACTIVE` 또는 `ROLLOVER_BLOCKED`로 남는다. `LEASE_TRANSFERRED` 뒤에는
이전 Session이 구현을 재개하지 않고 상태·복구 요청만 남긴다.

## 10. 반복 Session Chain

후속 Session은 Activation Receipt와 함께 같은 rollover policy, 관측 기준선, capsule schema,
idempotency 규칙을 상속한다. 따라서 B→C 전환은 A→B와 같은 절차를 사용한다.

```yaml
mission_id: MISSION-001
sessions:
  - session_ref: SESSION-A
    handoff_version_in: 0
    handoff_version_out: 1
    status: SEALED
  - session_ref: SESSION-B
    handoff_version_in: 1
    handoff_version_out: 2
    status: SEALED
  - session_ref: SESSION-C
    handoff_version_in: 2
    handoff_version_out: null
    status: ACTIVE
latest_active_session_ref: SESSION-C
chain_head_hash: sha256
```

각 전환은 직전 chain head를 포함해 append-only hash chain을 만든다. 전체 채팅 원문을 매번 전달하지
않고 최신 현재 상태와 이를 증명하는 필요한 계보만 전달한다. 과거 원본은 ID로 접근하며 충돌 또는
감사 필요 시에만 읽는다.

## 11. 과거 검색과 현재 미션 연결

검색은 다음 순서로 실행한다.

1. `mission_id`, `task_id`, Decision/Finding/화면/RPC/migration/file exact match
2. 현재 Task에서 `DEPENDS_ON`, `EVIDENCED_BY`, `REVIEWS`, `HANDOFF_TO`, `LEARNED_FROM` 1-hop
3. 시간·상태·역할·경로 필터를 적용한 키워드 검색
4. 의미 검색으로 후보 확장
5. 원 권위의 현재 상태·SHA를 다시 읽어 채택 또는 폐기

검색 결과에는 `source_ref`, `authority`, `status`, `commit_sha`, `content_hash`, `relation_path`,
`retrieval_reason`이 있어야 한다. 출처·상태·SHA가 없는 기억은 실행 컨텍스트에 넣지 않는다.

## 12. 실패와 복구

| 실패 | 처리 |
|---|---|
| Checkpoint 생성 실패 | 구현 중단, 이전 Session 유지, 실패 사건 기록 |
| Capsule 필수 항목 누락 | 생성 금지, `CAPSULE_INVALID` |
| 새 Session 생성 timeout | thread 목록·계보 조회, 불명확하면 중복 생성 금지 |
| 생성 성공·첫 turn 실패 | 동일 Session에 restore turn 재전송, 새 Session 남발 금지 |
| SHA·worktree 불일치 | `RESTORE_REJECTED`, 쓰기 금지 |
| successor 응답 없음 | 이전 lease 유지, 상태 관측 후 사람 호출 |
| 이전 Session이 먼저 종료 | 봉인 Checkpoint로 recovery Session 생성, 사람 Decision 전 lease 인수 금지 |
| 동시 rollover | queue ledger→Task lock과 idempotency key로 하나만 승인 |
| 컨텍스트 임계가 이미 초과 | 새 추론 최소화, 원 권위 경로와 미저장 사실만 emergency capsule로 봉인 |
| 제품이 자동 생성을 허용하지 않음 | 생성 요청과 완성된 Capsule을 사용자에게 제시하고 대기 |

## 13. 개인정보·보안·보존

- Git에는 실제 thread ID, 원시 대화 전문, 비밀, 운영 데이터, 고객 개인정보를 저장하지 않는다.
- 원시 transcript는 제품의 로컬 보호 저장소와 사용자 보존 설정을 따른다.
- Capsule은 필요한 최소 사실만 가지며 민감 필드는 경로·hash·비식별 ID로 바꾼다.
- 생성된 의미 색인과 임베딩은 권위가 아니며 원본 삭제 시 재생성 가능해야 한다.
- 보존 기한이 지난 비권위 검색 색인은 폐기하되 Git 감사·법적 보존 대상은 별도 정책을 따른다.
- 외부 모델 검수 입력은 allowlist와 manifest를 거치며 raw transcript를 기본 포함하지 않는다.

## 14. 구현 구성 후보

본 절은 구현 승인안이 아니라 책임 경계를 검수하기 위한 후보다.

```text
Context Observer
  → Rollover Policy Evaluator
  → Checkpoint Writer
  → Context Capsule Builder
  → Thread Adapter(create/list/read/wait/send)
  → Restore Verifier
  → Lease Transfer Coordinator
  → Session Chain Ledger
  → Event Collector
  → Retrieval Indexer
  → Learning Curator
```

Observer와 Indexer는 권한을 만들지 않는다. Thread Adapter는 공식 제품 API만 호출한다. Restore
Verifier와 Lease Coordinator를 같은 successor 모델의 자기선언으로 합치지 않는다.

## 15. 검증 시나리오

### 15.1 정상 흐름

1. A→B→C 세 Session에서 같은 미션을 이어 완료한다.
2. 각 Session은 사용자 재설명 없이 다음 행동을 복원한다.
3. 각 전환 뒤 활성 writer는 정확히 하나다.
4. 전체 원문 대신 최소 캡슐을 사용해도 필수 사실 손실이 없다.

### 15.2 사보타주

- 필수 Decision 하나를 캡슐에서 제거
- 낡은 Task snapshot·다른 HEAD 제출
- 같은 idempotency key로 successor 두 개 생성
- 생성 receipt만으로 lease 이전
- successor가 복원 전에 파일 수정
- 이전 Session이 lease 이전 뒤 다시 수정
- 같은 predecessor에서 HANDOFF 분기
- B가 rollover policy를 상속하지 않아 C를 만들지 못함
- 검색 상위 의미 유사 문서를 현재 권위로 오인
- CANDIDATE·RETIRED Learning 주입
- 종료된 미션에서 새 Session 생성
- 생성 실패를 성공으로 기록
- 원시 transcript에 있던 비밀을 Capsule에 복사

### 15.3 실제 제품 E2E

인메모리 시뮬레이션만으로 완료하지 않는다. 테스트 전용 프로젝트·저장소에서 실제 Session A를 만들고,
임계 신호 뒤 B를 생성해 Restore Receipt를 받은 다음 B가 C를 생성하는 2회 연속 rollover를 실행한다.
thread 생성 결과, 첫 turn, wait/read 결과, 저장소 SHA, lease 변화를 비식별 증거로 봉인한다.

## 16. 평가 지표

- `restore_success_rate`: 사용자 재설명 없이 합격한 복원 / 전체 복원
- `mission_resume_latency`: 생성 요청부터 successor 첫 안전 행동까지
- `handoff_loss_count`: 이전에 있던 필수 사실 중 후속에서 누락된 수
- `duplicate_successor_count`: 한 predecessor의 중복 활성 successor
- `stale_restore_count`: 낡은 SHA·Task·Decision으로 시작한 수
- `unauthorized_write_count`: 복원 검증 전 또는 lease 없는 쓰기
- `recursive_rollover_success`: A→B와 B→C를 모두 통과한 미션 / 대상 미션
- `unnecessary_rollover_rate`: 계속 가능했는데 전환한 비율
- `late_rollover_rate`: 맥락 손실 뒤 전환한 비율
- `capsule_token_ratio`: Capsule 토큰 / 직전 Session 전체 추정 토큰
- `required_fact_recall`: 봉인된 필수 사실 중 후속이 정확히 복원한 비율
- `learning_reuse_effect`: Learning 적용 전후 재작업·Finding·복원 성공 차이

핵심 불변식 위반은 평균 지표로 상쇄하지 않는다. handoff loss, duplicate successor, stale restore,
unauthorized write는 활성화 전 0건이어야 한다.

## 17. 단계별 도입

1. 문서 계약: 다섯 기존 문서에 소유 절별로 반영하고 중복 정의를 검사한다.
2. 결정적 시뮬레이션: 상태 기계·hash chain·idempotency·사보타주를 구현한다.
3. 로컬 shadow mode: 감지와 Capsule 생성만 하고 실제 새 Session은 만들지 않는다.
4. 승인형 파일럿: 사람이 생성 버튼을 승인하고 A→B→C E2E를 실행한다.
5. 제한 자동화: 사전 승인된 프로젝트·저위험 Task에서만 자동 생성·복원 검증한다.
6. 범용 적용: 프로젝트별 adapter와 보존 정책을 분리해 스타터 키트로 이식한다.

각 단계는 이전 단계의 필수 Finding 0, 사용자 파일 사고 0, 정확한 SHA 증거를 요구한다. 자동 생성은
제품 기능·권한·사람 정책이 모두 허용된 경우에만 활성화한다.

## 18. 1차안의 미결 결정

1. 실제 컨텍스트 사용량을 제공하지 않는 표면에서 추정기와 probe 중 무엇을 주 신호로 쓸지
2. 기본 rollover 임계와 모델별 보정 방식
3. 새 Session을 fresh thread로 만들지 fork할지 선택하는 예외 기준
4. 실제 thread ID·생성 receipt의 로컬 보관 위치와 보존 기간
5. Mission event ledger를 Markdown append-only와 SQLite/JSONL 중 어디에 둘지
6. predecessor가 이미 종료된 경우 복원 비교자를 누가 맡을지
7. 사람의 사전 자동 생성 승인을 프로젝트 단위·미션 단위 중 어디까지 허용할지
8. 제품 도구가 새 Session의 준비 완료를 callback하지 않을 때 polling·timeout 기준
9. Capsule 최대 크기와 `CAPSULE_TOO_LARGE` 처리 책임
10. 실제 E2E가 사용자 사이드바에 만드는 시험 Session의 보존·정리 방식

## 19. Claude/Fable 검수 질문

1. A→B→C 반복에서 미션 손실·중복 writer·중복 successor가 가능한 반례가 남아 있는가?
2. 최소 Context Capsule이 너무 크거나 작아지는 구조적 원인이 있는가?
3. 생성 성공과 복원 성공을 분리한 handshake가 실제 Codex thread API에서 구현 가능한가?
4. predecessor 장애·timeout·부분 성공에서 원자성이 깨지는가?
5. 과거 데이터 수집과 Learning 승격이 개인정보·감사 독립성을 침해하는가?
6. 다섯 기존 권위 문서 중 어느 절에 어떤 계약을 반영해야 중복 권위가 생기지 않는가?
7. v2에서 반드시 고쳐야 할 Critical·Major·명세상 필수 Finding은 무엇인가?
