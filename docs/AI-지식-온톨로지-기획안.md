---
doc_id: ontology
doc_type: ai_governance_plan
status: DRAFT
authority: knowledge_relations_request_normalization
owner: SOLAR-ARCH
approver: HUMAN-CHIEF
version: 0.2
depends_on: [team]
supersedes: []
verified_by: []
review_by: 2026-10-01
---

# MarginCook AI 지식 온톨로지 기획안

> 버전: 0.2
> 상태: 누적 교차검수 대상 초안(`DRAFT`)
> 작성일: 2026-09-01
> 최종 책임자: 사람 주 오케스트레이터
> 관계 문서: [`팀구성_상세기획안.md`](./팀구성_상세기획안.md)

이 문서는 누적 교차검수와 사람 승인 뒤 `ACTIVE`가 될 때까지 권위 위임을 받지 않는다. 전이 기간의
요청 정규화·역할·승인 규칙은 확정된 `팀구성_상세기획안.md`가 소유한다.

## 0. 목적

이 문서는 MarginCook 저장소에 흩어진 정책·요구·설계·소스·시험·결정·위험·감사·배포·학습을
하나의 권위 그래프로 연결하는 방법을 정의한다. 목표는 AI에게 더 많은 텍스트를 주는 것이 아니라,
현재 작업에 필요한 검증된 지식만 정확한 판본으로 조립하는 것이다.

여러 Codex 채팅, Claude/Opus 검수 세션과 사람 대화는 서로 다른 일부 문맥만 가질 수 있다. 채팅은
입력 원본이지만 공식 기억은 아니다. 확정된 상태는 Git으로 추적되는 단일 권위 문서, 코드, 시험,
불변 감사 기록과 정확한 commit SHA의 조합으로 복원한다.

## 1. 범위와 비범위

### 포함

- 문서와 코드의 지식 노드 종류
- 노드 사이의 관계와 권위 우선순위
- 여러 채팅의 요청 정규화와 충돌 처리
- Task별 최소 컨텍스트 조립
- 문서 상태·검토 기한·대체·폐기 수명주기
- 학습 후보와 검증된 학습의 분리
- 끊어진 링크·중복 권위·낡은 참조의 기계 검증

### 포함하지 않음

- 제품 계산 공식의 재정의
- 역할·승인 권한의 재정의
- Fable/Opus 실행 프로토콜의 복사
- 작업 상태를 관리하는 두 번째 작업판
- 채팅 전체 원문의 Git 보관
- 1차 도입을 위한 벡터 DB·그래프 DB·별도 검색 서버

역할·권한은 `팀구성_상세기획안.md`, 현재 제품 불변식은 `AGENTS.md`, 계산과 전파는
`ARCHITECTURE.md`, 작업 상태는 `docs/작업큐.md`, 감사 원본은 `docs/ai-review/README.md`가
소유한다.

## 2. 설계 원칙

1. **권위 원본은 하나다.** 같은 정책을 여러 README에 복사하지 않고 링크한다.
2. **가까운 안내를 제공한다.** 코드를 읽는 위치의 README는 책임·진입점·시험·상위 권위를 안내한다.
3. **채팅 기억보다 저장소 증거가 우선한다.** AI의 요약은 확인 전까지 제안 또는 입력이다.
4. **판본을 고정한다.** Task 컨텍스트는 경로뿐 아니라 commit·blob·hash를 함께 기록한다.
5. **사실·결정·추정을 구분한다.** 추정은 정책이나 완료 근거로 승격하지 않는다.
6. **원시 이력과 현재 기준을 분리한다.** 감사·배포·사고 원본은 보존하고 현재 문서는 현재 사실만 말한다.
7. **검색 가능성보다 재현성을 우선한다.** 모델이 찾았다는 사실보다 같은 입력을 다시 조립할 수 있어야 한다.
8. **최소 컨텍스트를 쓴다.** 작업과 무관한 문서를 넣어 결론 편향과 비용을 키우지 않는다.
9. **민감정보를 지식 그래프에 넣지 않는다.** 비밀·고객 데이터·운영 dump는 참조 대상에서도 제외한다.

## 3. 지식 노드

| 노드 종류 | 권위 위치 | 의미 |
|---|---|---|
| `CONSTITUTION` | `AGENTS.md` | 저장소 전역 불변식과 작업 규칙 |
| `ARCHITECTURE` | `ARCHITECTURE.md` | 현재 계산·원장·전파 구조 |
| `PLAN` | `docs/*기획안.md` | 사람이 승인할 목표·정책·단계 |
| `DOMAIN_GUIDE` | 도메인·패키지 `README.md` | 가까운 책임·진입점·시험 지도 |
| `REQUEST_INPUT` | 채팅 또는 외부 요청 참조 | 아직 정규화되지 않은 입력 |
| `NORMALIZED_REQUEST` | `docs/작업큐.md` Task 항목 | 목표·범위·완료 조건으로 해석된 요청 |
| `TASK` | `docs/작업큐.md` | 현재 상태·의존성·다음 행동의 단일 장부 |
| `DECISION` | `docs/team/DECISIONS.md` | 사람이 승인한 정책·설계 선택 |
| `RISK` | `docs/team/RISKS.md` | 미해결 위험·소유자·처리 기한 |
| `SOURCE` | 앱·패키지·DB 소스 | 실행되는 구현 |
| `TEST` | 자동·수동 시험 | 계약을 판별하는 재현 증거 |
| `REVIEW_ROUND` | `docs/ai-review/tasks/*/rounds/rNNN/` | 불변 manifest·검수 원본·실행 증거 |
| `REVIEW_LEDGER` | `docs/ai-review/tasks/*/collaboration.md` | 전용 명령으로만 늘어나는 append-only 공동 장부 |
| `REVIEW_STATUS` | `docs/ai-review/tasks/*/status.json` | 실행기만 갱신하는 파생 상태 |
| `FINDING` | `docs/ai-review/tasks/*/rounds/rNNN/review.json` | 특정 Task·검수 회차·판본에서 발견해 같은 ID로 승계하며 실행기가 registry hash를 계산하는 결함 |
| `ADVISORY_REVIEW` | `docs/ai-review/evidence/` | 사람 승인 직접 자문의 불변 요약·실패 기록. 공식 Fable 게이트 종결 불가 |
| `DEPLOYMENT_EVIDENCE` | `docs/deployments/` | 정확한 SHA의 환경 적용 증거 |
| `INCIDENT` | `docs/operations/POSTMORTEMS/` | 운영 사고 원본과 재발 방지 |
| `LEARNING` | `docs/team/TEAM_LEARNING.md` | 검증된 재사용 교훈과 폐기 조건 |
| `HANDOFF` | `docs/작업큐.md`의 Task snapshot 또는 검수 `collaboration.md`의 전용 인계 턴 | 새 채팅·역할·검수 successor가 같은 Task를 복원하도록 기존 권위 상태를 봉인한 비권위 snapshot |
| `ROLE_CONTEXT` | `docs/team/ROLE_CONTEXTS.md` | 활성 역할·컨텍스트 ID·판본 hash·자율성 단계의 레지스트리 항목 |
| `RELEASE` | `docs/team/RELEASE_GATE.md` | 대상 SHA·환경·게이트·사람 승인과 실제 `DEPLOYMENT_EVIDENCE`를 연결하는 릴리스 인스턴스 |

노드 종류는 새 문서를 만들라는 뜻이 아니다. 기존 권위 위치가 있으면 그 위치를 사용하고, 주제의
현재 권위가 없을 때만 새 파일을 만든다.

`HANDOFF`는 별도 공식 문서가 아니다. 일반 Task 인계는 `docs/작업큐.md`의 현재 Task에서 팀 구성안
§11 필수 복원 필드 전체를 읽어 만든 snapshot이고, 검수 엔진·commit successor 인계는 팀 구성안
§5.3과 `docs/ai-review/README.md`가 정한 append-only 턴을 사용한다. 두 경우 모두 최소한
`handoff_id`, `task_id`, 비식별 predecessor/successor reference, 생성 시각, source commit SHA,
§11 Task snapshot hash, `next_safe_action`, 미해결 Decision·Finding ID, 사용자 소유 변경·제외 경로,
직전 HANDOFF ID 또는 `null`을 기록한다. snapshot은 작업큐 현재 상태를 덮어쓰거나 정책을 새로
확정하지 않으며, successor는 아래 §6.4 순서로 원 권위를 다시 확인한다.

`ROLE_CONTEXT`는 역할 설명을 복사하지 않고 팀 구성안 §11이 정한 실제 활성 컨텍스트 레지스트리만
표현한다. `RELEASE`도 배포 JSON을 복사하지 않고 대상 SHA와 증거 경로를 잇는다. 두 노드의 실제
파일 물질화는 본 문서가 `ACTIVE`가 된 뒤 별도 구현 Task에서만 한다.

## 4. 관계 모델

| 관계 | 의미 | 예시 |
|---|---|---|
| `OWNS` | 주제의 단일 권위 | `ARCHITECTURE` OWNS 판매 전파 |
| `DEPENDS_ON` | 성립에 필요한 상위 전제 | Task DEPENDS_ON Decision |
| `NORMALIZES` | 원시 요청을 업무 계약으로 변환 | Normalized Request NORMALIZES Chat Input |
| `ROUTES_TO` | 정규화된 요청을 기존 또는 신규 Task에 배치 | Normalized Request ROUTES_TO Task |
| `IMPLEMENTS` | 설계·결정을 코드로 구현 | Migration IMPLEMENTS Decision |
| `VERIFIED_BY` | 판별력 있는 시험·검수 | RPC VERIFIED_BY DB test |
| `EVIDENCED_BY` | 실행 결과를 봉인 | Release Gate EVIDENCED_BY deployment JSON |
| `SUPERSEDES` | 명시적으로 이전 판본을 대체 | Decision B SUPERSEDES Decision A |
| `CONFLICTS_WITH` | 해결되지 않은 충돌 | Chat Request CONFLICTS_WITH Active Decision |
| `LEARNED_FROM` | 학습의 원시 근거 | Learning LEARNED_FROM Finding/Test |
| `APPLIES_TO` | 허용 범위 | Learning APPLIES_TO DB migration |
| `EXCLUDES` | 명시적 비범위 | Task EXCLUDES user-owned files |
| `POINTS_TO` | 권위를 만들지 않는 탐색 링크 | Domain Guide POINTS_TO Source/Test |
| `HANDOFF_TO` | 같은 Task의 predecessor snapshot을 successor Task·역할 컨텍스트로 연결 | Handoff HANDOFF_TO Role Context |

`SUPERSEDES` 없이 나중에 작성됐다는 이유만으로 기존 결정이 폐기되지 않는다. 서로 다른 채팅의
요청이 충돌하면 `CONFLICTS_WITH` 상태로 사람 결정에 올리고, 승인된 대체 결정이 생긴 뒤에만
`SUPERSEDES`를 기록한다.

`TOUCHES`는 추가하지 않는다. 구현 관계는 `IMPLEMENTS`, 탐색·접촉 경로는 `POINTS_TO`, 수정 금지
범위는 `EXCLUDES`와 Task의 경로 필드로 이미 표현되므로 같은 뜻의 두 번째 관계가 된다. `BLOCKS`,
`DECIDED_BY`, `OWNED_BY`, `ANNOUNCED_IN`도 각각 `DEPENDS_ON`, `DEPENDS_ON`, `OWNS`, `POINTS_TO`의
방향 또는 파생 view로 처리한다. 허용 노드·관계 어휘는 이 §3·§4에서만 생성한다.

문서를 찾기 위한 참조 그래프와 권위·의존 그래프는 분리한다. 탐색 참조는 어느 핵심 문서에서
시작해도 필요한 권위로 이동할 수 있도록 순환을 허용하지만, `OWNS`와 `DEPENDS_ON`으로 만든 권위
그래프는 DAG여야 한다. `docs-graph-check`는 참조 도달 가능성과 권위 순환을 서로 다른 단언으로
검사한다.

## 5. 권위와 충돌 적용

권위 우선순위의 단일 소유자는 `팀구성_상세기획안.md` §0이다. 본 문서는 순서를 다시 정의하지 않고
각 입력을 그 단계에 분류한다. 검수 Finding과 `proposed_edits`, 채팅 요약과 AI 설명은 정책의
대체본이 아니며 가장 높은 권위 단계의 현재 사실과 충돌하면 Task 또는 Risk로 등록한다. 코드는
현재 구현 사실을 증명할 수 있지만 승인 정책을 자동 변경하지 않고, 문서는 실행 결과를 자동
증명하지 않는다.

## 6. 다중 채팅 요청 정규화

### 6.1 입력 단위

각 채팅에서 다음만 추출한다.

- 저장소 밖 원문을 재식별할 수 없는 conversation reference와 확인 시각
- 사용자가 원하는 업무 결과
- 명시적 포함·제외·우선순위
- 사람이 직접 확정한 결정
- 변경·중단·재개 지시
- 제공된 파일·화면·환경 범위
- 아직 검증하지 않은 주장과 Task 종결 전 처리 책임자

전체 채팅 원문과 실제 thread ID를 Git에 넣지 않는다. conversation reference는 Task 내부 일련번호나
비식별 hash만 사용한다. 필요한 짧은 인용도 개인정보·비밀정보를 제거하고 결정 근거에 필요한 최소
범위만 기록한다. 고객 문의를 요구사항으로 바꿀 때는 이름·연락처·매장 식별자·원문 로그를 제거한다.
미검증 주장은 Task 종결 전에 검증된 사실·결정·기각으로 치환하고 영구 장부에 남기지 않는다.

### 6.2 정규화 계약

AI 부 오케스트레이터는 실행 전에 다음 필드를 만든다.

```yaml
task_id: TEAM-DIR-1
conversation_refs:
  - conversation_ref: CHAT-LOCAL-001
    observed_at: 2026-09-01T00:00:00+09:00
objective: 사용자가 얻게 될 업무 결과
current_state: 저장소에서 확인한 현재 사실
in_scope: []
out_of_scope: []
fixed_decisions:
  - decision_id: DEC-EXAMPLE-001
    evidence_commit_sha: 0000000000000000000000000000000000000000
assumptions: []
open_decisions: []
open_findings: []
acceptance_criteria: []
depends_on: []
risk_level: R0
risk_basis: 문서 변경만 수행하며 제품·DB·배포는 범위 밖이다.
roles: []
artifact_paths: []
reference_paths: []
evidence_paths: []
excluded_paths: []
user_owned_changes: []
untracked_in_scope_paths: []
last_verified_sha: null
agents_md_blob_sha: null
active_branch: null
worktree_state: null
next_safe_action: null
stop_conditions: []
request_dispositions:
  - seq: 1
    kind: STATUS_ONLY
    evidence_conversation_ref: CHAT-LOCAL-001
    observed_at: 2026-09-01T00:00:00+09:00
    requires_human_approval: false
    decision_id: null
    previous_hash: GENESIS
    item_hash: sha256-of-canonical-item
edit_owner: null
owner_session_ref: null
lease_expires_at: null
```

`fixed_decisions`는 `docs/team/DECISIONS.md`의 `ACTIVE` Decision ID와 근거 commit을 반드시
참조한다. 아직 장부에 없는 채팅 발화는 `open_decisions` 또는 `assumptions`일 뿐 확정 결정이 아니다.

이 YAML을 모든 Task에 별도 파일로 만들라는 뜻은 아니다. 다음 매핑의 소유 위치가 필요한 필드를
보존하며, 다음 단계가 필수 값을 받지 못하면 실행을 거부한다.

| 정규화 의미 | `docs/작업큐.md` | 공식 검수 `task.json`/Task Packet |
|---|---|---|
| 목표·범위·제외 | objective/in_scope/out_of_scope | Goal/In scope/Out of scope |
| 완료 조건 | acceptance_criteria | Required outputs/tests/evidence |
| 역할 | roles | Role ID와 reviewer/verifier/gate owner |
| 의존성 | depends_on | Upstream dependencies |
| 대화 참조 | conversation_refs | Conversation references |
| 기준선 | current_state/last_verified_sha | baseline_commit_sha/target_commit_sha |
| 정책 판본 | agents_md_blob_sha | agents_blob_oid/agents_sha256 |
| 결정 | fixed_decisions/open_decisions | human_decisions/decision IDs/questions |
| 미결 Finding | open_findings | inherited/open Finding IDs와 closure successor 상태 |
| 가정 | assumptions | Assumptions·검증 책임자·무효화 조건 |
| 위험 | risk_level/risk_basis | risk_level/classification evidence |
| 경로 | artifact/reference/evidence/excluded paths | 같은 이름의 경로 배열 |
| 사용자 변경 | user_owned_changes | excluded_paths와 overlap disposition |
| 실행 제어 | next_safe_action/stop_conditions | required outputs/tests와 stop conditions |
| 요청 판정 이력 | request_dispositions[] | Task별 seq·판정·근거 conversation reference·확인 시각·승인·Decision ID·직전/item hash |
| 편집 소유권 | edit_owner/owner_session_ref/lease_expires_at | 발행 시점 lease 스냅샷. 현재 권위는 작업큐 |

작업큐는 팀 구성안 §11이 정의한 현재 상태와 필수 복원 필드의 단일 권위이고, `task.json`은 특정
검수 입력의 불변 판본을 소유한다. 정책·범위·대상 SHA처럼 봉인돼야 하는 의미가 다르면 새 검수를
시작하지 않는다. edit lease와 worktree 같은 가변·파생 필드는 발행 시점 스냅샷으로만 보존하고 현재
값 일치 검사에서 제외한다. 검수 시작은 작업큐 현재 `edit_owner`가 실행 역할과 같고 lease가 유효한지
별도로 확인한다.

### 6.3 추가·대체·별도 작업 판정

판정 enum의 단일 정의는 다음 네 값이다.

| 값 | 의미 |
|---|---|
| `ADD` | 기존 목표를 유지하면서 완료 조건·자료·비범위를 추가 |
| `SUPERSEDE_PROPOSAL` | 기존 목표의 취소·결과 변경 제안. 사람 승인 전에는 적용 금지 |
| `NEW_TASK` | 산출물·위험·배포 주기가 달라 별도 Task로 분리 |
| `STATUS_ONLY` | 상태 질문·설명 요청이며 범위 변경 없음 |

각 판정은 `request_dispositions[]`에 근거 conversation reference, 확인 시각, 사람 승인 필요 여부와
관련 Decision ID를 append한다. 최신 `STATUS_ONLY`가 계류 중인 `SUPERSEDE_PROPOSAL`을 덮어쓰지 않는다.
오케스트레이션 문서는 이 enum을 실행에 적용할 뿐 새 값을 정의하지 않는다.
비소유 채팅의 판정 append와 새 Task 최초 `edit_owner` 지정 방법은 팀 구성안 §11의 전역 queue
ledger lock 계약만 따른다. 이 문서는 허용 필드나 최초 지정 주체를 다시 정의하지 않는다.

- 기존 목표의 완료 조건을 강화하면 `ADD`다.
- 기존 목표를 취소하거나 결과를 바꾸면 `CONFLICTS_WITH`로 등록하는 `SUPERSEDE_PROPOSAL`이다.
  사람 주 오케스트레이터의 `ACTIVE` Decision이 생긴 뒤에만 `SUPERSEDES`로 전환한다.
- 다른 산출물·위험·배포 주기를 가지면 `NEW_TASK`다.
- 단순 상태 질문은 `STATUS_ONLY`다.
- 최신 채팅이라는 이유만으로 진행 중 요청을 취소하지 않는다.
- 범위가 바뀌면 영향받는 담당·시험·검수·일정을 다시 계산한다.

### 6.4 새 채팅 재개

새 세션은 전체 과거를 먼저 읽지 않고 다음 L0~L4 기억 캡슐을 순서대로 조립한다. 이 계층은 읽기
우선순위이며 아래 lease·사용자 변경·증거 SHA 검사를 생략하거나 대체하지 않는다.

1. **L0 — 헌법:** `AGENTS.md`와 절대 원칙을 읽고 blob/content hash를 Task 계약과 대조한다. 이전
   값과 다르면 영향받는 Task Packet을 재발행한다.
2. **L1 — 현재 실행점:** `docs/작업큐.md`의 현재 Task·상태·의존성·`next_safe_action`, 최신 유효
   `HANDOFF`, 마지막 검증 SHA를 exact ID로 읽는다.
3. **L2 — 직접 권위:** Task가 가리키는 현재 `ACTIVE`/`CONFIRMED` 권위 문서·Decision·Risk와 열린
   Finding을 읽는다.
4. **L3 — 1-hop 증거:** `DEPENDS_ON`으로 직접 연결된 Task와 관련 TEST·REVIEW_ROUND·
   DEPLOYMENT_EVIDENCE만 읽는다.
5. **L4 — 조건부 원시 이력:** L0~L3 사이 충돌이나 근거 부족이 있을 때만 원시 감사와 비식별 과거
   conversation reference를 추가한다. 의미 유사도 검색은 후보 탐색에만 쓰고 권위로 승격하지 않는다.

기억 캡슐을 조립한 뒤 다음 복원 검사를 순서대로 수행한다.

1. Git branch·HEAD·origin 관계·worktree와 HANDOFF의 source commit SHA를 확인한다.
2. Task의 `edit_owner`·`owner_session_ref`·`lease_expires_at`을 확인한다. 다른 소유자의 lease가
   유효하면 상태·인계 요청만 남기고 `stop_conditions`를 발동한다.
3. HANDOFF의 Task snapshot hash와 현재 §11 필드 집합을 대조한다. 같은 Task에서 더 최신 HANDOFF가
   있거나 successor가 동일·낮은 판본을 받으면 실행을 거부한다.
4. 사용자 소유 변경과 작업 대상이 겹치는지 확인한다.
5. 마지막 시험·검수·CI·배포 증거의 SHA를 대조한다.
6. 사용자 소유 변경 또는 요청받지 않은 미추적 파일이 대상 경로와 겹치면 해당 경로를
   `excluded_paths`로 봉인하고 `stop_conditions`를 발동한다. 사람 주 오케스트레이터의 명시적 처리
   결정 전에는 수정·스테이징하지 않는다.
7. 채팅 요약·HANDOFF·저장소가 다르면 저장소 권위 상태를 보존하고 사람 주 오케스트레이터에게
   충돌을 알린다.
8. 명시적 결정 또는 검증 가능한 정정 뒤에만 계약을 갱신하고 안전한 다음 행동을 수행한다.

정확한 Task ID, 화면 ID, RPC, migration, 파일 경로, Decision ID가 있으면 exact match를 먼저 하고,
그 뒤 이 §4의 허용 관계만 따라간다. 새 채팅이 성공적으로 복원됐다는 판정은 대화가 자연스럽다는
느낌이 아니라 사용자 재설명 없이 `next_safe_action`·미결 ID·제외 경로를 재현하고 첫 안전 행동을
수행했는지로 평가한다. 지표 이름·계산·임계의 단일 권위는 평가 기획안 §5다.

여기서 `사람 주 오케스트레이터`는 개발 요청자이자 최종 결정자를 뜻하고, 앱의 식당 사장님·셰프
등은 `실사용자`라고 부른다.

## 7. Decision·Risk·Learning 항목 스키마

문서 단위 메타데이터와 별개로 각 장부 항목은 다음 최소 필드를 가진다.

```yaml
id: DEC-EXAMPLE-001 | RISK-EXAMPLE-001 | LRN-EXAMPLE-001
subject: 단일 주제
status: 노드 종류별 허용 상태
owner: role-or-person-id
approver: person-id-or-null
approved_at: iso-8601-or-null
evidence_commit_sha: git-sha
supersedes: []
superseded_by: []
conflicts_with: []
invalidation_condition: text
review_by: date
```

Decision은 `DRAFT | ACTIVE | SUPERSEDED | RETIRED`, Risk는
`OPEN | MITIGATED | ACCEPTED | CLOSED`, Learning은 `CANDIDATE | VERIFIED | RETIRED`를 사용한다.
Decision은 승인자·승인일이 있어야 `ACTIVE`다. Risk의 `ACCEPTED`는 사람 승인자·승인일이 있어야
하며 수용·완화·종결 근거를 별도로 가진다.
Learning은 팀 구성안 §5.6의 추가 필드와 `conflicts_with`·`supersedes` Learning ID를 가진다. 같은
레인과 적용 범위에서 충돌 선언된 `VERIFIED` Learning은 동시에 주입하지 않는다.

## 8. 문서 메타데이터

### 8.1 적용 대상

front matter는 후속 `docs-graph-check` 도입 Task와 같은 commit부터 다음 신규·변경 문서에 적용한다.
그 전에는 현재 인용 블록 머리말을 유효 형식으로 유지하며, 기존 핵심 문서는 같은 Task에서 필드를
손실 없이 변환한다.

- 신규 핵심 기획안
- `docs/team`의 운영 장부
- `docs/operations`의 런북
- 도메인 경계 README

역사적 참고 문서와 생성된 감사 원본을 일괄 변환하지 않는다.

### 8.2 공통 필드

```yaml
---
doc_id: EXAMPLE-DOMAIN-GUIDE
doc_type: ai_governance_plan
authority: PLAN_CANDIDATE
status: DRAFT | REVIEWED | CONFIRMED | ACTIVE | SUPERSEDED | RETIRED | HISTORICAL
owner: AI-DEPUTY-ORCHESTRATOR
approver: HUMAN-CHIEF
version: "0.1"
depends_on: []
supersedes: []
verified_by: []
review_by: 2026-12-01
---
```

필드가 비어 있는데 형식만 채우는 것을 금지한다. Git commit·blob·SHA-256처럼 실행기가 계산해야 하는
값은 사람이 front matter에 복사하지 않고 Task manifest와 배포 증거가 소유한다.
`status`가 `CONFIRMED | ACTIVE`가 아닌 문서는 `authority` 값과 무관하게 현재 권위로
사용하지 않는다. `CONFIRMED`는 사람이 확정한 현재 기준선이지만, 후속 자동화·디렉터리
물질화까지 활성했다는 뜻은 아니다. `ACTIVE`는 해당 계획의 활성화 게이트까지 완료한
상태다.
활성 문서가 아직 DRAFT인 후속 설계에 상세화를 맡기는 전이 링크는 `AUTHORITY_REF`가 아니라
`DELEGATED_PENDING`으로 기록한다. 활성 문서 자체에 최소 안전 게이트와 전이 소유자가 있을 때만
허용하며, 후속 문서가 `ACTIVE`가 된 뒤 `AUTHORITY_REF`로 전환한다.

## 9. 컨텍스트 조립

역할별 입력은 공통 헌법과 작업 관련 노드만 포함한다.

```text
공통: AGENTS + Task 계약 + 적용 Decision/Risk
제작: 승인 요구·설계·관련 소스·기존 시험
기능 QA: 공개 계약·diff·원시 fixture·실행 환경
독립 감사: 승인 명세·소스·시험 원본, 제작자의 결론 요약 제외
운영: 대상 SHA·migration·배포 계획·복구·관측
```

컨텍스트 조립기는 각 입력의 경로·역할·commit 또는 내용 hash를 기록하고 다음을 거부한다.

- Task와 무관한 넓은 디렉터리 전체
- `.env`, 키, 운영 DB dump, 고객·개인정보
- OneDrive 또는 다른 저장소 사본
- 현재 Task의 감사 결과를 같은 독립 최초 감사 입력으로 재주입
- `CANDIDATE`·`RETIRED`·기한이 지난 Learning
- 서로 충돌하는 Learning 동시 적용

감사 route별 학습 입력은 팀 구성안 §5.6과 `docs/ai-review/README.md`가 소유한다.

- `FINAL_INDEPENDENT` 전 회차와 predecessor가 없는 최초 `SECURITY` Task에는 VERIFIED ID를 포함해
  Learning 일체를 넣지 않는다.
- predecessor가 있는 `SECURITY` 후속 Task는 `task.json`에 적용·제외 배열과 제외 사유를 선언한다.
  다만 모델 컨텍스트에는 검증된 ID 목록만 넣고 요약·제외 사유 본문은 주입하지 않는다.
- `MANDATORY_MUTUAL`·`CONDITIONAL`은 실행기가 검증한 적용·제외 집합만 넣는다.
- registry를 승계하는 fallback·successor는 원 Task와 같은 학습 집합·hash를 유지한다.
- `INDEPENDENT-AUDIT` Learning은 그 Learning을 만든 reviewer role과 그 역할을 승계한 fallback·
  successor 입력에서 제외한다. 다른 독립 역할의 제한 사용은 팀 구성안 §5.6의 사람 Decision과
  재감사 계약을 충족해야 한다.

## 10. 수명주기

```text
DRAFT → REVIEWED → ACTIVE → SUPERSEDED → HISTORICAL
           CONFIRMED → ACTIVE
                           └→ RETIRED
```

- 기획안은 사람 승인 전 `DRAFT`다.
- 실행 증거만 필요한 문서는 정해진 기술 게이트 후 `ACTIVE`가 될 수 있다.
- 정책 문서는 승인자와 날짜가 있어야 `ACTIVE`다.
- 새 문서가 생겼다는 이유만으로 옛 문서는 폐기되지 않는다.
- 새 권위 문서는 `supersedes`에 같은 `doc_id`의 이전 `doc_id@version`을 기록한다. 대체된 판본의
  상태는 Git 이력과 사람 Decision에서 `SUPERSEDED`로 보존하며, 현재 파일이 자기 현재 판본이나 다른
  권위 주제를 가리키지 않는다.
- 감사·배포·사고 원본은 상태를 고치지 않고 후속 기록으로 정정한다.
- `review_by`가 지난 문서는 즉시 무효가 아니라 재검토 대기다. 다만 보안·운영 절차는 게이트에 쓰기
  전에 재확인한다.

## 11. 검증 장치

후속 구현에서 `scripts/docs-graph-check.mjs`를 추가해 최소한 다음을 검사한다.

1. 필수 문서와 선언된 상대 링크가 존재한다.
2. `doc_id`가 중복되지 않는다.
3. 상태·문서 종류·권위 값이 허용 목록에 속한다.
4. `depends_on`, `supersedes`, `verified_by` 대상이 존재한다.
5. 핵심 권위 문서 사이 순환이 없다.
6. 하나의 주제에 둘 이상의 `ACTIVE` 소유자가 없다.
7. 폐기 문서를 현재 권위로 가리키지 않는다.
8. 코드 경로·시험 경로·화면 ID 참조가 실제로 존재한다.
9. 역할별 복제 공식 문서와 옛 경로 재수출 안내가 없다.
10. Decision·Risk·Learning 항목의 상태·승인·supersedes·conflicts_with 관계가 유효하다.
11. 모든 `SUPERSEDES`가 `ACTIVE` Decision ID를 근거로 하며 미해결 `CONFLICTS_WITH` 주제는 게이트
    종결 입력에서 제외된다.
12. 사람 결정 뒤 `AGENTS.md` 검사 실행 절과 팀 구성안 G3를 함께 갱신하고, 문서 그래프 검사를
    기존 `pnpm verify`의 Docker 없는 한 단계 안에 편입한다. 6단계 분모는 임의로 바꾸지 않는다.
13. §3·§4 허용 어휘 밖 node·edge, `TOUCHES` 같은 중복 후보와 출처·SHA·상태가 없는 기억 캡슐을
    거부한다.
14. HANDOFF의 predecessor/successor 연결, source commit·Task snapshot hash·직전 HANDOFF ID를
    검사하고 동일·낮은 판본 복원을 거부한다.

검사기는 문서 내용을 자동 승인하지 않는다. 구조적 연결과 기계적으로 판별 가능한 계약만 확인한다.

## 12. 도입 순서

### 단계 1 — 권위 지도

- 현재 핵심 문서와 소유 주제를 목록화한다.
- 필요하면 `docs/README.md`를 생성하되 `AGENTS.md`의 문서 책임을 복사하지 않는 탐색용 색인으로만 쓴다.
- 중복 정책과 고아 문서를 분류한다.

### 단계 2 — 팀 운영 노드

- 기존 주제 소유 문서가 없는지 먼저 확인한 뒤에만 `docs/team/DECISIONS.md`, `RISKS.md`,
  `RELEASE_GATE.md`를 실제 장부로 만든다.
- `ROLE_CONTEXTS.md`를 활성 컨텍스트 ID·판본 레지스트리로 보강한다.
- 기존 `TEAM_LEARNING.md`와 원시 증거 관계를 검사한다.

### 단계 3 — 가까운 도메인 안내

- 실제 경계가 있는 앱 feature와 package에만 README를 둔다.
- 책임·금지 의존성·진입점·시험·상위 권위를 짧게 기록한다.
- 내용 없는 형식적 README는 만들지 않는다.

### 단계 4 — 자동 검사

- front matter와 링크 검사기를 추가한다.
- 사보타주 fixture로 중복 ID·끊어진 링크·권위 충돌을 확인한다.
- 사람 결정으로 검사 위치를 확정한 뒤 `AGENTS.md`·팀 구성안 G3와 같은 commit에서 `pnpm verify`와
  보호 원격 exact-SHA 게이트에 연결한다.

### 단계 5 — 컨텍스트 조립

- Task와 역할별 최소 입력을 계산한다.
- 적용·제외 Learning과 근거 hash를 봉인한다.
- 입력 크기·무관 문서 비율·누락으로 인한 재작업을 측정한다.

## 13. 완료 조건

- 여러 채팅의 요청을 하나의 Task와 명시적 결정 관계로 복원할 수 있다.
- 새 채팅에서 대화 기억 없이 권위 문서와 SHA만으로 안전하게 작업을 재개할 수 있다.
- L0~L4 기억 캡슐로 필요한 맥락만 조립하고 HANDOFF의 동일·낮은 판본을 거부할 수 있다.
- 모든 핵심 주제는 단일 `ACTIVE` 권위 소유자를 가진다.
- 역할별 경쟁 공식 문서가 없다.
- 문서 링크·ID·상태·검증 경로가 자동 검사된다.
- 검증되지 않은 채팅 요약과 Learning이 작업 컨텍스트에 자동 주입되지 않는다.
- 문서가 늘어나도 작업 상태·결정·위험·학습의 소유 위치가 갈리지 않는다.
- 오케스트레이션 §8.2가 정한 누적 외부 교차검수에서 팀 구성안의 역할·승인 계약과 본 문서의 지식
  관계가 모순 없이 연결된다.

## 14. 미결 구현 결정

- front matter를 적용할 첫 도메인 README 범위
- `docs-graph-check`가 관리할 문서 ID 형식과 §3·§4 어휘를 코드로 생성하는 형식
- `docs-graph-check`를 현행 verify ③에 넣을지 다른 기존 단계에 넣을지
- Codex 여러 채팅의 thread 참조를 자동 수집할 수 없는 환경에서 쓸 비식별 수동 참조 형식
- 일반 Task HANDOFF snapshot의 물리 저장 형식과 보존 기간
- 문서 검토 기한 알림을 CI 경고로 둘지 작업큐 생성으로 둘지
- 컨텍스트 크기·관련성의 초기 기준선

이 결정은 이후 오케스트레이션·디렉터리·평가 기획안과 누적 교차검수한 뒤 확정한다. 최종 누적
검수와 사람 승인 전에는 이 문서를 `AGENTS.md`의 권위 책임 목록에 추가하지 않는다.
