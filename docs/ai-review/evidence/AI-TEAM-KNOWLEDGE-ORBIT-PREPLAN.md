# MarginCook AI 팀·채팅·지식 궤도 방향성 결정 패킷

> 상태: `DRAFT_FOR_FABLE_REVIEW`
>
> 이 문서는 여섯 번째 공식 기획안이 아니다. 기존 다섯 기획안을 고치기 전에 사람과 Fable이
> 방향을 결정하기 위한 선행 패킷이다. 확정된 내용은 책임 소유 문서에 나눠 반영하고 이 패킷은
> 결정 증거로만 보존한다.

## 0. 검토 목적

MarginCook은 여러 채팅과 AI 역할이 동시에 작업하더라도 다음을 잃지 않는 운영 구조가 필요하다.

1. 현재 채팅의 작업 능률
2. 새 채팅으로 넘어갈 때의 작업·결정·증거 연속성
3. 여러 팀과 여러 채팅 사이의 동일한 현재 상태
4. 과거 작업을 필요한 순간에만 빠르게 되살리는 기억 구조
5. 토큰과 외부 검수 비용을 줄이되 필수 근거를 생략하지 않는 통제
6. 사람의 정책·운영 승인과 독립 품질 판정 보존

이 패킷은 이를 `Knowledge Orbit Graph`라는 운영 모델로 구체화하고, 정식 기획안 개정 전에
과설계·권위 중복·누락·실행 불가능성을 검토한다.

## 1. 변하지 않는 전제

- 채팅은 작업 공간이지 공식 기억의 최종 권위가 아니다.
- 공식 기억은 권위 저장소의 코드·문서·Task·Decision·시험·배포 증거에 남는다.
- 같은 사실을 여러 채팅이나 팀 README에 복사하지 않는다.
- 한 Task는 한 시점에 한 편집 소유자만 가진다.
- 제작 역할과 독립 검증 역할은 같은 컨텍스트로 합치지 않는다.
- 토큰 절감은 필수 시험·감사·사람 승인을 생략하는 근거가 아니다.
- 운영 배포·복구와 미해결 위험 수용은 사람이 결정한다.
- 채팅 자동 생성은 제품 도구가 허용하고 사람이 승인한 범위에서만 수행한다. 초기에는 신호와
  준비 패킷까지만 자동화하고 실제 생성은 사람이 승인한다.

## 2. Knowledge Orbit Graph

### 2.1 입체 모델

```text
                         [Quality 관측 위성]
                                  │
    [Product 팀 구] ───── [MarginCook 권위 중심] ───── [Data 팀 구]
          │                       │                         │
      [Task 위성]          [마스터 오케스트레이션]       [Task 위성]
                                  │
 [Knowledge 팀 구] ─────── [공유 지식 궤도] ───── [Server · Supabase · Operations 팀 구]
          │                                                 │
 [Context & Token 위성]                            [배포·복구 위성]
```

그림의 구와 위성은 별도 공식본을 뜻하지 않는다. 각 구는 역할별 활성 컨텍스트를, 중심은 저장소의
단일 권위를, 궤도는 필요한 순간에 문서 노드와 관계를 따라 컨텍스트를 조립하는 경로를 뜻한다.

### 2.2 구의 계층

| 계층 | 목적 | 보존 범위 |
|---|---|---|
| 권위 중심 | 코드·정책·현재 Task·결정·검증 증거 | 공식 저장소 |
| 마스터 구 | 사람 요청 해석·전체 우선순위·팀 배정 | 통합 상태와 결정 링크 |
| 팀 구 | 도메인별 조정·전문 지식·열린 차단 문제 | 팀 책임과 활성 Task 링크 |
| Task 구 | 실제 한 작업의 실행 | 목표·상태·증거·HANDOFF |
| 관측 위성 | 품질·토큰·운영 상태를 횡단 관찰 | 판정·측정·경보만 |

관측 위성은 관찰 대상의 제품 정책이나 검수 결과를 임의로 바꾸지 않는다.

## 3. 채팅 공간 제안

### 3.1 MarginCook · 마스터 작업

1. `00 마스터 오케스트레이션`
2. `01 부 오케스트레이션 · 토큰/컨텍스트 관리`
3. `02 통합 작업큐 · 사람 결정`
4. `03 개발·스테이징 배포 검증`
5. `04 운영 배포 · 복구 게이트`

### 3.2 MarginCook · 부서 그룹

1. `00 모든 팀 상황실`
2. `01 Product · Mobile`
3. `02 Data · Backend`
4. `03 Server · Supabase · Operations`
5. `04 Quality · Review`
6. `05 Knowledge · Orchestration`

`04 Quality · Review`는 검수 일정·차단·결과 링크의 조정 전용 채팅이다. Fable·Codex의 실제 독립
검증은 팀 구성안 §1.1이 요구하는 회차별 전용·클린 컨텍스트에서 수행하며, 이 조정 채팅의 제작 측
대화를 독립 검증 입력으로 사용하지 않는다.

### 3.3 채팅 종류별 쓰기 책임

| 채팅 | 주 용도 | 금지 |
|---|---|---|
| 마스터 오케스트레이션 | 요청 해석·Task 정의·팀 배정 | 구현 세부 누적 |
| 부 오케스트레이션 | 컨텍스트·토큰·HANDOFF 통제 | 정책 확정·검수 판정 변경 |
| 통합 작업큐·사람 결정 | 차단 관계와 사람 결정 | 팀별 원문 복제 |
| 개발·스테이징 | 배포 후보 검증 | 운영 반영 승인 |
| 운영 배포·복구 | 승인된 운영 실행과 증거 | 승인 없는 apply |
| 모든 팀 상황실 | 공지·출시 상태·교차 팀 차단 | 장시간 구현·논쟁 원문 |
| 부서 조정실 | 도메인 분해·Task 라우팅 | 여러 Task의 직접 구현 혼합 |
| Task 채팅 | 한 Task의 실제 실행 | 범위 밖 새 업무 흡수 |

`00 모든 팀 상황실`은 읽기 중심의 저소음 채널이다. 새 공지는 공식 Task·Decision·Release 상태의
링크를 가져야 하며, 상황실 메시지만으로 정책이나 작업 상태를 바꾸지 않는다.

## 4. 역할 경계

### 4.1 팀

| 팀 | 소유 |
|---|---|
| Product · Mobile | 앱·UX·화면·접근성·클라이언트 계약 |
| Data · Backend | DB 스키마·RPC·RLS·원장·계산·migration·DB 시험 |
| Server · Supabase · Operations | 조직·프로젝트·환경·Auth·Cron·Edge·배포·모니터링·백업·리전 |
| Quality · Review | 독립 시험·경합·회귀·보안·Fable·출시 게이트 증거와 판정 보고. Go/No-Go·운영 승인은 팀 구성안 §1.1대로 사람이 소유 |
| Knowledge · Orchestration | 권위 문서망·작업큐·Decision·Learning·HANDOFF·컨텍스트 조립 |

Data는 제품 데이터의 의미와 계산을 소유하고, Server · Supabase · Operations는 그 데이터가
동작하는 호스팅·보안·운영 환경을 소유한다. Server · Supabase · Operations는 세금·손익·원장
공식을 바꾸지 않고, Data는 운영 자격증명·백업 정책·
프로젝트 과금을 단독 결정하지 않는다.

### 4.1.1 기존 역할표와 팀 그룹 대응

팀 그룹은 기존 엔진·역할을 대체하는 새 승인 단위가 아니라 관련 역할을 묶는 조정 경계다.

| 팀 그룹 | 팀 구성안 §1.1 기존 역할·컨텍스트 | 유지해야 할 독립성 |
|---|---|---|
| Product · Mobile | PO·도메인 정책, Mobile 개발, UX·접근성, Android·iOS 현장 QA | 제작과 플랫폼별 QA 분리 |
| Data · Backend | 아키텍처·데이터 무결성, DB/RPC 개발, Core 개발, 기능·데이터 신뢰성 QA | DB 권위 구현과 Codex 기능 QA 분리 |
| Server · Supabase · Operations | Integration, 배포·운영·복구 역할, 보안·권한 감사 | 운영 실행과 Fable 보안 감사 분리 |
| Quality · Review | Codex 기능 QA·현장 QA, Fable 보안 감사·독립 종합 감사, 승인된 Opus 연속성 | 상설 조정 채팅과 회차별 클린 검수 분리 |
| Knowledge · Orchestration | 사람 주 오케스트레이터, AI 부 오케스트레이터·문서 관리자, 정기 운영 감사 | 정책 결정·문서 편집·감사 판정 분리 |

확정 시 팀 구성안 §1.1·§3에 이 대응과 팀별 입력·산출·중단 조건을 반영한다. 정식 팀 이름은
`Server · Supabase · Operations`로 통일한다. 디렉터리 slug가 필요하면
`server-supabase-operations`를 사용하고 `Platform`·`platform-operations`를 별도 팀 이름으로 쓰지
않는다.

### 4.2 AI 부 오케스트레이터

- 사용자 요청을 온톨로지 §6.3이 소유하는 단일 enum
  `ADD | SUPERSEDE_PROPOSAL | NEW_TASK | STATUS_ONLY`로 판정한다.
  `SUPERSEDE_PROPOSAL`은 제안일 뿐 사람 승인 전에는 적용하지 않으며, 이 패킷과 후속 개정은
  판정 enum에 새 값이나 다른 이름을 정의하지 않는다.
- Task 목표·비목표·완료 조건·담당 팀·필요 권위 입력 정규화
- 팀 간 의존성과 편집 소유권 조정
- Context & Token Steward의 전환 신호 검토
- 사람 결정이 필요한 범위를 중단하고 결정 패킷 생성

금지: 사람 결정 대체, 미해결 위험 수용, 독립 품질 판정 수정, 운영 apply 승인.

### 4.3 Context & Token Steward

기본 거점은 `05 Knowledge · Orchestration`이지만 모든 팀과 Task의 컨텍스트 상태를 관찰한다.

이 역할은 현재 팀 구성안 §1.1 역할표에 없는 신설 제안이다. 확정 시 팀 구성안 개정으로 소속
컨텍스트·독립성·감사 주체를 지정한다. 오케스트레이션 §2의 상태 복원기·컨텍스트 조립기는 AI 부
오케스트레이터가 계속 소유하고, Steward는 압력 측정·입력 예산·HANDOFF 완결성의 관측과 신호만
담당한다. Steward 운영 자체는 Quality 또는 Fable의 정기 표본 감사를 받는다.

허용:

- 역할별 최소 입력 선정
- 컨텍스트 압력 측정과 체크포인트 요청
- 불필요한 원문·중복 문서 제외
- 외부 검수 상한·실사용·잔여량 표시
- HANDOFF 완결성 검사
- 후속 Task 채팅 생성 요청

금지:

- 제품 정책·공식 수치 변경
- 필수 증거·감사·시험 제외
- Quality verdict 변경
- 채팅 원문을 공식 결정으로 승격
- 사람 승인 없는 예산 상향 또는 새 외부 호출

## 5. 현재 Task 채팅의 작업 능률

### 5.1 활성 작업 메모리

모든 Task 채팅은 다음 작은 상태만 상시 유지한다.

```yaml
task_id:
goal:
non_goals: []
workflow_state:
edit_owner:
current_step:
next_actions: []
open_decisions: []
open_risks: []
authority_refs: []
artifact_refs: []
evidence_refs: []
dependency_task_ids: []
last_verified_sha:
context_pressure:
external_review_budget:
```

긴 과거 설명은 넣지 않는다. 필요한 세부 내용은 ID와 링크를 따라 찾는다.

### 5.2 작업 중 갱신 사건

- 사용자 범위 추가·대체
- 중요한 결정 생성
- 파일·DB 계약 변경
- 시험 성공·실패
- 외부 검수 Finding
- 차단 발생·해소
- 커밋·배포 후보 생성
- 컨텍스트 압력 단계 변경

각 사건은 Task ID와 정확한 SHA 또는 명시적 `null` 사유를 가진다. 사건 원문 전체를 모든 팀 채팅에
복사하지 않고, 통합 인덱스에는 상태 변화와 권위 링크만 반영한다.

## 6. 컨텍스트 압력과 새 채팅 전환

### 6.1 상태 기계

```text
ACTIVE
  → PRESSURE_WARNING
  → CHECKPOINT_REQUIRED
  → HANDOFF_READY
  → SUCCESSOR_ACTIVE
  → PREDECESSOR_READ_ONLY
```

실패 시 `HANDOFF_BLOCKED`로 가며, 필수 상태가 복구되기 전 새 채팅을 작업 권위로 사용하지 않는다.

### 6.2 초기 전환 신호

정확한 토큰 수를 제공받으면 아래 비율을 사용하고, 제공받지 못하면 동일 목적의 관측 신호를 쓴다.

| 단계 | 토큰 지표 초기안 | 대체 관측 신호 |
|---|---:|---|
| PRESSURE_WARNING | 추정 60% 이상 | 같은 사실 재탐색·긴 요약 반복 시작 |
| CHECKPOINT_REQUIRED | 추정 75% 이상 | 범위 2개 이상 혼합·결정 누락 위험 |
| HANDOFF_READY 진입 | 추정 85% 이상 | 자동 compaction·명백한 맥락 손실·새 대형 범위 등장 |

이 수치는 첫 실제 Task 3개에서 측정한 뒤 조정한다. 비율만으로 강제 전환하지 않고 다음 하드 신호가
하나라도 있으면 즉시 CHECKPOINT를 요구한다.

- 현재 채팅이 이전 결정을 서로 다르게 설명함
- 사용자 요청의 별도 Task 여부를 구분하지 못함
- 진행 중 두 Task가 같은 파일 또는 DB 계약을 동시에 편집함
- 마지막 검증 SHA·사용자 소유 변경·열린 위험을 복원하지 못함
- 운영·보안·비용 결정이 채팅에만 있고 사람 Decision이 없음

### 6.3 전환 권한

Steward는 `CONTEXT_ROLLOVER_REQUIRED` 신호와 준비 패킷을 낸다. AI 부 오케스트레이터는 진행 중
원자 작업, 외부 검수, 배포·복구 세션을 중간에서 끊어도 안전한지 확인한다. 초기 운영에서는 사람이
새 Task 채팅 생성을 승인한다. 자동 생성은 별도 도구·권한·회귀시험이 생긴 뒤에만 검토한다.
`CONTEXT_ROLLOVER_REQUIRED`는 상태가 아니라 `CHECKPOINT_REQUIRED` 또는 `HANDOFF_READY` 전이를
요청하는 신호다. 기존 edit lease 계약의 오류 코드 `HANDOFF_REQUIRED`와 이름·의미를 공유하지 않는다.

## 7. HANDOFF와 기억 보존

### 7.1 체크포인트 필수 필드

새 채팅 필수 복원 필드 집합의 단일 권위는 팀 구성안 §11이고, 오케스트레이션 §4.3 재개 패킷은
그 표현이다. 아래 HANDOFF는 그 필드를 운반하는 snapshot이지 경쟁 스키마가 아니다. 기존 초안
이름은 다음처럼 권위 필드로 정규화한다.

| 초안 표현 | 권위 필드·처리 |
|---|---|
| `goal` | `objective` |
| `non_goals` | `out_of_scope` |
| `completed` | `current_state`의 근거와 `evidence_paths`로 분리 |
| `next_actions` | `next_safe_action` |
| `decisions` | `fixed_decisions` |
| `dependencies` | `depends_on` |
| `artifacts` | `artifact_paths` |
| `tests_and_results` | `evidence_paths` |
| `git_branch` | `active_branch` |
| `head_sha` | `last_verified_sha` |
| `working_tree_ownership` | `worktree_state`·`user_owned_changes`·`untracked_in_scope_paths` |

HANDOFF는 팀 구성안 §11 필드를 생략하지 않고 다음처럼 보존한다.

```yaml
handoff_id:
task_id:
predecessor_conversation_ref:
successor_conversation_ref:
objective:
current_state:
in_scope: []
out_of_scope: []
acceptance_criteria: []
roles: []
depends_on: []
conversation_refs: []
last_verified_sha:
agents_md_blob_sha:
fixed_decisions: []
open_decisions: []
risk_level:
risk_basis:
assumptions: []
open_findings: []
request_dispositions: []
artifact_paths: []
reference_paths: []
evidence_paths: []
excluded_paths: []
next_safe_action:
stop_conditions: []
user_owned_changes: []
edit_owner:
owner_session_ref:
lease_expires_at:
active_branch:
worktree_state:
untracked_in_scope_paths: []
external_review_usage:
learning_candidates: []
created_at:
created_by:
```

`conversation_ref`는 비식별 참조이며 채팅 원문을 공식 저장소에 복사하지 않는다. 비밀·개인정보·
운영 자격증명을 HANDOFF에 넣지 않는다.

### 7.2 전환 사후조건

- predecessor Task 상태와 successor의 시작 상태가 같다.
- 마지막 SHA와 사용자 소유 변경이 보존된다.
- 모든 열린 Decision·Finding·차단 Task가 연결된다.
- 실행하지 않은 시험을 통과로 표현하지 않는다.
- predecessor는 successor가 복원에 성공한 뒤 읽기 전용으로 전환된다.
- successor가 실패하면 predecessor를 자동 수정하지 않고 `HANDOFF_BLOCKED`로 보고한다.

## 8. 기억 캡슐과 신경 검색

### 8.1 노드 대응

노드 어휘의 단일 권위는 온톨로지 §3이다. 이 패킷은 아래 대응과 신규 후보만 제안한다.

| 패킷 개념 | 온톨로지 권위 어휘 | 처리 |
|---|---|---|
| 요청 | `REQUEST_INPUT`·`NORMALIZED_REQUEST` | 원시·정규화 단계를 합치지 않음 |
| Task | `TASK` | 동일 |
| 결정 | `DECISION` | 동일 |
| 산출물 | `PLAN`·`DOMAIN_GUIDE`·`SOURCE` | 포괄 `ARTIFACT` 노드를 만들지 않고 실제 종류 사용 |
| 시험 | `TEST` | 동일 |
| Finding | `FINDING` | 동일 |
| 배포 증거 | `DEPLOYMENT_EVIDENCE` | 동일 |
| 사고 | `INCIDENT` | 동일 |
| 학습 | `LEARNING` | 동일 |
| HANDOFF snapshot | 없음 | 온톨로지 개정이 필요한 신규 후보 |
| 역할 컨텍스트 | 없음 | `ROLE_CONTEXTS.md`와 함께 온톨로지 개정 후보 |
| Release 상태 | 없음 | `RELEASE_GATE.md`와의 관계를 먼저 정한 뒤 신규 여부 결정 |

### 8.2 관계 대응

| 패킷에서 필요한 뜻 | 온톨로지 권위 관계 | 처리 |
|---|---|---|
| 요청을 Task에 배치 | `ROUTES_TO` | 동일 |
| 선행·차단 | `DEPENDS_ON` | `BLOCKS`를 별도 권위로 만들지 않고 역방향 상태로 파생 |
| 구현·접촉 범위 | `IMPLEMENTS`·`POINTS_TO` | `TOUCHES` 신규 필요 여부를 온톨로지 개정에서 결정 |
| 결정 의존 | `DEPENDS_ON` | `DECIDED_BY` 신규 관계를 만들지 않음 |
| 증거·검증 | `EVIDENCED_BY`·`VERIFIED_BY` | 동일 |
| 대체 | `SUPERSEDES` | 동일 |
| 인계 | 없음 | `HANDOFF_TO` 신규 후보 |
| 학습 근거·적용 | `LEARNED_FROM`·`APPLIES_TO` | 동일 |
| 권위 소유 | `OWNS` | 역방향 `OWNED_BY`를 만들지 않음 |
| 공지 탐색 | `POINTS_TO` | `ANNOUNCED_IN` 신규 관계를 만들지 않음 |

`HANDOFF`, 역할 컨텍스트, Release, `TOUCHES`, `HANDOFF_TO`가 실제로 필요하면 온톨로지 기획안
개정으로만 추가한다. 이 패킷의 목록은 어휘 권위가 아니며 기존 `CONFLICTS_WITH`·`EXCLUDES`·
`POINTS_TO`를 대체하지 않는다. 검사기의 허용 어휘 목록도 온톨로지 단일 출처에서 생성한다.

### 8.3 기억 캡슐

새 Task는 전체 과거를 읽지 않고 다음 순서로 필요한 기억을 조립한다.

새 채팅 상태 복원 절차의 단일 권위는 온톨로지 §6.4다. 아래 L0~L4는 그 절차 안에서 읽을 지식의
조립 우선순위이며 §6.4의 lease·사용자 변경·증거 SHA 확인 단계를 대체하지 않는다. 온톨로지 개정
Task는 두 순서를 하나의 복원·조립 계약으로 통합한다.

1. L0 — `AGENTS.md`와 절대 원칙
2. L1 — 현재 Task·최근 HANDOFF·마지막 검증 SHA
3. L2 — 관련 권위 문서·Decision·열린 Finding
4. L3 — 1-hop 의존 Task와 직접 관련 시험·배포 증거
5. L4 — 충돌이나 근거 부족이 있을 때만 원시 감사·과거 대화 참조

정확한 Task ID, 화면 ID, RPC, migration, 파일 경로, Decision ID가 있으면 먼저 exact match를 한다.
그 뒤 허용된 관계만 따라가고, 의미 유사도 검색은 후보를 찾는 보조 수단으로만 사용한다. 검색 결과는
권위 종류·상태·SHA·출처를 표시하며 자동으로 공식 사실이 되지 않는다.

## 9. 여러 채팅 동기화

### 9.1 단일 작성자 원칙

| 사실 | 단일 소유자 |
|---|---|
| 제품·계산 계약 | 권위 아키텍처·기획안 |
| 현재 Task 상태 | 통합 작업큐의 해당 Task |
| 사람 결정 | Decision 기록 |
| 시험 결과 | 실행 증거 |
| 배포 상태 | Release 상태·배포 증거 |
| 팀 책임 | 팀 구성안과 가까운 README |
| Learning 상태 | TEAM_LEARNING 권위 |

다른 채팅은 이 사실을 복사하지 않고 ID·상태·링크만 게시한다.

### 9.2 상태 전파

```text
Task 상태 변화
→ 권위 노드 갱신
→ 통합 인덱스의 상태 포인터 갱신
→ 영향을 받는 팀 구에 짧은 알림
→ 전체 공지가 필요한 경우만 모든 팀 상황실에 게시
```

채팅 메시지를 읽었다는 사실만으로 상태 전파 완료로 보지 않는다. 권위 노드와 역링크가 갱신돼야 한다.

## 10. 제안하는 최소 문서 제어면

정식 기획안 승인 뒤 다음 구조를 검토한다. 이 패킷 단계에서는 실제 생성하지 않는다.

팀 구성안 §11이 이미 소유하는 권위 구조는 다음과 같다.

```text
docs/team/
├─ DECISIONS.md
├─ RISKS.md
├─ RELEASE_GATE.md
├─ ROLE_CONTEXTS.md
├─ TEAM_LEARNING.md
└─ roles/
```

새 `_shared` 권위 파일군을 추가하지 않는다. 필요한 통합 화면은 다음 기존 권위에서 다시 만드는
생성 view 후보로만 검토한다.

| view 후보 | 원본 권위 | 초기 처리 |
|---|---|---|
| current state·task index | `docs/작업큐.md` | 생성 view 후보, 손작성 금지 |
| decision index | `docs/team/DECISIONS.md` | 생성 view 후보, 손작성 금지 |
| release state | `docs/team/RELEASE_GATE.md` | 생성 view 후보, 손작성 금지 |
| context budget | Task manifest·검수 run·향후 관측 사건 | 기존 소유자 확정 전 미도입 |
| 팀 책임 탐색 | `docs/team/roles/` | 기존 역할 문서 확장 또는 생성 view 후보 |

팀 그룹별 가까운 README가 필요하다면 `product-mobile`, `data-backend`,
`server-supabase-operations`, `quality-review`, `knowledge-orchestration` 후보를 디렉터리 기획안의
생성 기준으로 검토한다. 역할별 추적 문서는 새로 만들지 않는다. 최종 디렉터리 구조는 팀 구성안
§11과 디렉터리·문서 신경망 기획안의 개정 Task가 소유한다.

주의:

- 생성 view는 기존 `docs/작업큐.md`, Architecture, 팀 구성안 §11, 배포 기획안을 대체하지 않는다.
- 초기 구현 시 기존 권위 문서를 옮기지 않고 생성 view의 필요성부터 파일럿으로 확인한다.
- 같은 현재 상태를 Markdown 여러 파일에 손으로 이중 기록하지 않는다.
- 팀 README는 책임·진입점·의존 규칙·검증·관련 권위 링크만 소유한다.

## 11. 작업 승격 흐름

```text
사람 요청
→ 마스터 오케스트레이션의 Task 정의
→ 부 오케스트레이션의 팀·컨텍스트 배정
→ 도메인 Task 구현
→ Quality 독립 검증
→ 개발·스테이징 배포 검증
→ 통합 작업큐·사람 결정
→ 사람의 운영 승인
→ 운영 배포·복구 게이트
→ 모든 팀 상황실 결과 공지
→ 검증된 Learning 후보 평가
```

Quality는 구현팀이나 Steward의 비용 판단 때문에 필수 Finding을 낮추지 않는다. 개발·스테이징 통과는
운영 배포 승인이 아니다.

## 12. 측정과 학습

아래 임계는 파일럿용 후보이며 §16의 사람 결정으로 확정한다.

지표 이름·계산 정의의 단일 권위는 평가 기획안 §5다. `handoff recovery success`는 §5.3
`resume success`의 개명 후보이고 `duplicate work`·`handoff loss`는 §5.3의 동일 지표다.
`repeated discovery`·`stale fact reuse`·`retrieval provenance failure`·`context relevance ratio`·
`token per completed task unit` 등 신규 지표는 평가 기획안 개정으로만 추가한다. 개정 Task는 아래
표와 §5.1~§5.4 기존 지표의 동일·개명·신규 대응표를 포함하며 이 표를 별도 지표 권위로 사용하지
않는다. `escaped defect`는 §5.2 `review escape` 중 핵심 불변식·보안·데이터 손실 결함 부분집합의
개명 후보이고 `cross-team blocker latency`는 §5.4 신규 후보다. 대응표는 아래 표의 모든 지표를
빠짐없이 분류한다.

| 지표 | 수집 위치·계산 | 초기 실패 후보 |
|---|---|---|
| handoff recovery success | HANDOFF와 successor 최초 상태에서 사용자 재설명 없이 `next_safe_action`을 복원한 비율 | 3건 중 1건이라도 복원 실패 |
| context relevance ratio | Task manifest의 입력 중 결과·Finding·수정 근거에 실제 인용된 권위 입력 비율 | 60% 미만이면서 품질 개선 근거 없음 |
| repeated discovery | Task 사건 장부에서 이미 연결된 동일 사실을 다시 조사한 횟수 | Task당 1회 초과 |
| stale fact reuse | Decision·Learning 상태와 실제 사용 입력 대조 | 1건 이상 |
| token per completed task unit | run 사용량 ÷ 완료된 acceptance criterion, 같은 유형 baseline과 비교 | 품질 개선 없이 baseline 대비 20% 초과 |
| cross-team blocker latency | 작업큐의 차단 등록부터 해소까지 wall-clock | 파일럿 3건으로 baseline만 수집, 즉시 게이트에 사용하지 않음 |
| duplicate work | 같은 artifact·결과 hash를 만든 서로 다른 활성 Task | 1건 이상 |
| handoff loss | predecessor에는 있었으나 successor에 없는 Decision·Finding·사용자 변경 | 1건 이상 |
| retrieval provenance failure | 기억 캡슐 항목 중 출처·상태·SHA 또는 null 사유가 없는 항목 | 1건 이상 |
| escaped defect | Quality 이후 발견된 필수 불변식·보안·데이터 손실 결함 | 핵심 결함 1건 이상 |

Learning은 반복 관측만으로 자동 승격하지 않는다. `CANDIDATE → 독립 검증 → VERIFIED → 제한 적용 →
재평가 → 유지/RETIRED` 수명주기를 따른다.

## 13. 단계별 도입 후보

1. 방향성 결정 — 본 패킷 Fable 검수와 사람 승인
2. 기존 다섯 기획안의 책임 절에 계약 분산 반영
3. 온톨로지 node·edge·HANDOFF·context pressure schema 확정
4. 문서 그래프·역링크·고아 노드·컨텍스트 압력 상태·HANDOFF 필수 필드 정적 검사기 작성
5. 한 부서와 실제 Task 1개로 채팅 전환 파일럿
6. 실제 Task 3개에서 검색·토큰·복원 지표 측정
7. 기준 보정 후 나머지 팀으로 확장
8. Codex 프로젝트·채팅 구조 실제 생성

실제 채팅·디렉터리를 먼저 만들지 않는다. 스키마·검사기·파일럿이 준비된 뒤 생성한다.

## 14. 주요 위험과 실패 폐쇄

| 위험 | 실패 폐쇄 |
|---|---|
| MD 파일 폭증 | 초기 최소 집합·생성 view 우선 |
| 상태 복제와 불일치 | 한 사실 한 소유자·역링크 검사 |
| 토큰 관리자의 과권한 | 비용·컨텍스트 권한과 정책·판정 권한 분리 |
| 상황실 소음 | 쓰기 조건·메시지 크기·Task 링크 강제 |
| HANDOFF가 새 공식본이 됨 | 상태 복원용 snapshot으로만 사용, 권위 링크 필수 |
| 의미 검색의 환각 연결 | exact ID 우선·출처·SHA·상태 표시 |
| 낡은 Learning 주입 | route 필터·유효기간·RETIRED |
| 채팅 자동 생성 남용 | 초기 사람 승인, 실제 도구 계약 전 자동화 금지 |
| 독립 검수 오염 | 제작 컨텍스트와 Quality/Fable 컨텍스트 분리 |
| 운영 승인 우회 | 별도 운영 게이트와 사람 승인 필수 |

## 15. Fable 집중 검토 질문

1. 이 모델이 기존 다섯 기획안의 책임을 침범하거나 여섯 번째 경쟁 공식본을 만드는가?
2. 마스터 5개·부서 6개 채팅이 지나치게 많거나 빠진 역할이 있는가?
3. 모든 팀 상황실과 생성 view 후보가 중복 권위나 쓰기 경합을 만드는가?
4. `CONTEXT_ROLLOVER_REQUIRED`와 HANDOFF 상태 기계가 실제 다중 채팅에서 안전한가?
5. 기억 캡슐 L0~L4와 typed edge가 과거 맥락을 빠르게 복원하면서 토큰을 줄일 수 있는가?
6. Context & Token Steward의 권한·금지선·사람 승인 경계가 충분한가?
7. Data와 Server · Supabase · Operations, 구현과 Quality, 개발·스테이징과 운영의 경계가 충돌 없이 실행 가능한가?
8. 초기 최소 문서 제어면이 과설계인지, 반대로 누락된 핵심 노드가 있는가?
9. 먼저 확정해야 할 사람 결정과 파일럿에서 측정해야 할 실패 조건은 무엇인가?

## 16. Fable 후 사람 결정 후보

- 두 Codex 프로젝트와 11개 조정 채팅의 최종 이름·개수
- `00 모든 팀 상황실` 작성 가능 역할과 공지 조건
- Context pressure 초기 임계값과 전환 강제 수준
- 새 Task 채팅 생성의 사람 승인 유지 기간
- HANDOFF의 공식 저장 위치와 보존 기간
- 통합 상태 생성 view를 실제로 만들지와 생성 위치
- 기억 검색 1-hop 범위와 의미 검색 허용 범위
- 첫 파일럿 부서·Task와 성공 기준
- §12 지표의 수집 위치·계산식·초기 실패 임계값

이 항목은 Fable 검토 결과를 본 뒤 사람이 확정한다.

## 17. 사람 승인 뒤 다섯 공식 기획안에 반영할 변경 설계

이 절은 새 공식 정책이 아니다. Fable 지적을 반영한 방향을 기존 다섯 공식 기획안의 각 소유
범위에 분산하기 위한 변경 설계다. 실제 정책은 각 기획안의 개정 Task와 사람 승인 뒤에만 바뀐다.

| 공식 기획안 | 반영할 계약 | 반영하지 않을 것 | 검증 연결 |
|---|---|---|---|
| `팀구성_상세기획안.md` | 5개 팀 그룹과 기존 역할의 대응, `Server · Supabase · Operations` 명칭, Context & Token Steward 후보 역할의 관측·신호 권한, AI 부 지휘자의 상태 복원 책임, Quality와 사람 Go/No-Go의 분리 | Steward의 정책·품질 판정권, 채팅별 경쟁 공식 문서 | 역할 책임 중복 검사, Steward 과권한 시뮬레이션 |
| `AI-지식-온톨로지-기획안.md` | 기존 node·edge 재사용 표, HANDOFF·ROLE_CONTEXT·Release 및 `TOUCHES`·`HANDOFF_TO`의 후보 상태, 출처·SHA·상태를 가진 기억 캡슐 L0~L4 | 검증 전 새 canonical node·edge, 일반 명사 기반 중복 온톨로지 | node/edge registry 대조, 고아·역링크·상태 검증 |
| `AI-오케스트레이션-상세기획안.md` | master/department/Task 채팅 책임, 온톨로지 §6.3 요청 판정 enum의 사용, `HANDOFF_READY` 전이, `CONTEXT_ROLLOVER_REQUIRED` 신호, canonical HANDOFF 필드, predecessor/successor 복원 절차, 작업 중 현재 맥락 조립 | 채팅을 공식 기억 저장소로 취급, 요청 판정 enum 재정의, 컨텍스트 압력만으로 자동 정책 변경 | 요청 판정 허용값의 온톨로지 단일 출처 검사, 동일·낮은 판본 handoff 거부, successor 복원 시뮬레이션 |
| `디렉터리-문서신경망-재설계-기획안.md` | 팀 그룹별 가까운 README 후보, 기존 `docs/team/*` 권위 재사용, current/task/decision/release 생성 view 후보, 문서 그래프·context pressure·HANDOFF 필드 검사기 | 새 `_shared` 권위군, 현재 상태의 손작성 복제, 역할별 별도 공식본 | 생성 view 원본 대조, 문서 그래프·단일 소유권 검사 |
| `AI-품질-학습-자율성-평가기획안.md` | §12와 기존 §5 지표의 동일·개명·신규 대응표, 출처·계산식·초기 실패 후보, handoff 복원·중복 조사·낡은 사실·토큰 효율·escaped defect 평가, 독립 Quality/Fable 컨텍스트, Learning 승격 수명주기 | 별도 지표 어휘 권위, Quality의 운영 승인, 비용 절감을 이유로 한 필수 Finding 하향 | 지표 이름·계산 정의 유일성 검사, 실제 Task 3건 측정, 실패 임계 사보타주, 사람 최종 판정 |

### 17.1 공통 상호작용 계약

1. 사람 요청은 오케스트레이션 기획안의 Task 정의로 시작하고, 팀 구성안의 책임 매핑으로 담당 팀을
   정한다.
2. 온톨로지는 Task가 참조할 권위·Decision·Finding·Learning의 식별자와 관계만 제공한다. 현재 상태를
   대신 소유하지 않는다.
3. 디렉터리 기획안은 해당 권위를 가까운 진입점과 생성 view로 탐색하게 하지만 같은 사실을 다시
   손으로 저장하지 않는다.
4. 컨텍스트 압력 신호가 발생하면 오케스트레이션이 HANDOFF를 만들고, Steward는 예산·중복·누락을
   관측해 신호만 낸다. successor 상태 복원은 AI 부 지휘자가 책임진다.
5. Quality는 독립 컨텍스트에서 증거와 판정을 만들고 품질 기획안의 지표로 파일럿을 평가한다. 운영
   Go/No-Go는 사람이 결정한다.
6. 검증된 결과만 `TEAM_LEARNING.md`의 후보 수명주기를 거쳐 다음 Task의 제한된 입력이 된다.

### 17.2 구현 전 실패 폐쇄 조건

- 다섯 기획안 중 하나라도 같은 사실의 소유자가 둘이면 개정을 시작하지 않는다.
- HANDOFF 필드가 팀 구성안 §11의 canonical schema와 다르면 파일럿을 시작하지 않는다.
- 새 node·edge가 기존 온톨로지 용어와 중복되면 registry 승인 전 생성하지 않는다.
- 생성 view가 원본 권위와 달라질 수 있는 손작성 파일이면 만들지 않는다.
- Quality가 만든 verdict와 사람의 운영 승인이 같은 필드·상태로 합쳐지면 배포 자동화를 연결하지 않는다.
- 측정 출처가 없는 효율 지표나 실패 임계가 없는 성공 선언은 파일럿 증거로 인정하지 않는다.

### 17.3 승인 뒤 실제 작업 순서

1. 다섯 기획안의 책임 절을 위 표에 따라 같은 Task에서 개정한다.
2. 문서 간 ID·anchor·소유권·역링크를 정적 검사한다.
3. HANDOFF와 컨텍스트 압력 schema를 시뮬레이션 fixture로 먼저 검증한다.
4. 한 팀·한 실제 Task만 파일럿하고 §12 지표를 수집한다.
5. 파일럿 결과를 독립 Quality/Fable이 검토하고 사람이 확장 여부를 결정한다.
6. 통과한 뒤에만 실제 Codex 프로젝트·채팅·팀 README·생성 view를 만든다.
