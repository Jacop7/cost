---
doc_id: orchestration
doc_type: ai_governance_plan
status: ACTIVE
authority: request_intake_task_routing
owner: AI-MASTER-ORCHESTRATOR
approver: HUMAN-CHIEF
version: 0.7
depends_on: [team, ontology]
supersedes: []
verified_by: [CODEX-QA, FABLE-ARCH, HUMAN-CHIEF]
review_by: 2026-10-01
---

# MarginCook AI 오케스트레이션 상세 기획안

> 버전: 0.7
> 상태: 활성 권위(`ACTIVE`)
> 작성일: 2026-09-01
> 최종 책임자: 사람 주 오케스트레이터
> 활성화 결정: `DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027`
> 승인 대상 SHA-256: `794fab2d3842fa3d74a6f09f2485d19b69f21fc62b12cd371d8cb00b2f02b5da`
> 관계 문서: [`팀구성_상세기획안.md`](./팀구성_상세기획안.md),
> [`AI-지식-온톨로지-기획안.md`](./AI-지식-온톨로지-기획안.md)

## 0. 목적

이 문서는 사람이 여러 채팅에서 자연어로 요청한 목표를 AI 팀이 검증 가능한 업무로 정의하고,
적절한 역할·컨텍스트·증거·게이트에 연결해 안전하게 완료하는 실행 흐름을 정의한다.

오케스트레이터의 핵심 능력은 많은 작업을 동시에 시키는 것이 아니다. 사용자가 실제로 얻으려는
결과를 이해하고, 현재 저장소 상태와 충돌하지 않는 Task 계약으로 바꾸며, 제작자·검증자·승인자를
분리하고, 실패·새 요청·다른 채팅에도 같은 기준으로 이어가는 것이다.

역할과 승인 권한은 `팀구성_상세기획안.md`, 지식 노드·권위·다중 채팅 정규화 필드는
`AI-지식-온톨로지-기획안.md`, Fable/Opus 공식 fallback과 감사 원본은
`docs/ai-review/README.md`가 소유한다. 본 문서는 그 계약을 실행 순서로 연결하며 재정의하지 않는다.

이 문서는 현재 `DRAFT`이며 사람 승인으로 `ACTIVE`가 되고 `AGENTS.md` 책임 목록에 등재되기 전에는
구속력 있는 실행 규칙이 아니다. 전이 기간의 요청 해석·승인·게이트 규칙은
`팀구성_상세기획안.md`가 소유하고, 본 문서는 그 규칙의 구현 후보 흐름만 설명한다.

## 1. 설계 목표와 비목표

### 목표

- 불완전한 자연어 요청을 업무 결과와 완료 조건으로 정규화
- 여러 채팅·AI 세션의 중복·충돌·중단·재개 처리
- 작업별 위험과 능력에 맞는 최소 역할 호출
- 필요한 지식만 조립하는 역할별 컨텍스트
- 사용자 소유 변경과 병렬 편집 충돌 방지
- 제작·기능 QA·독립 감사·승인 분리
- 정확한 SHA와 실행 증거 기반 종결
- 검증된 교훈의 제한적 재사용
- 시간·비용·도구 실패의 보수적 처리

### 비목표

- AI가 제품 정책이나 위험을 최종 승인
- 모든 작업에 모든 역할·모델 호출
- 대화 전체를 영구 기억으로 저장
- 역할별 경쟁 기획안·완성본 생성
- 모델 자기평가만으로 품질 판정
- 프로덕션 배포·복구·데이터 보정의 사람 권한 대체
- 첫 단계부터 별도 멀티에이전트 플랫폼·벡터 DB 도입

## 2. 오케스트레이션 구성요소

| 구성요소 | 책임 | 소유자 |
|---|---|---|
| 요청 해석자 | 원문 요청을 목표·범위·완료 조건으로 정규화 | AI 부 오케스트레이터 |
| 상태 복원기 | 새 채팅에서 Task·SHA·worktree·증거 복원 | AI 부 오케스트레이터 |
| 충돌 판정기 | 추가·대체·별도 작업과 사용자 변경 겹침 판정 | AI 부 O, 대체 승인은 사람 |
| 위험 분류기 | R0~R3와 사람 승인·감사 route 후보 산정 | AI 부 O, 표본 재판정 Codex/사람 |
| 작업 그래프 | 선행 조건·병렬 가능성·파일 소유권과 담당 팀/역할 배정 확정 | AI 마스터 오케스트레이터 |
| 컨텍스트 조립기 | 역할별 최소 권위 입력과 적용 Learning 선택 | AI 부 O, 온톨로지 계약 적용 |
| 라우팅 계획자 | 제작·QA·감사·운영 역할과 실행 순서 확정 | AI 마스터 오케스트레이터 |
| 라우팅 실행기 | 확정된 Task·역할·컨텍스트 경로로 전달하고 HANDOFF 상태 유지 | AI 부 오케스트레이터 |
| 증거 수집기 | 시험·CI·배포·Finding을 exact SHA에 연결 | Codex QA + AI 부 O |
| 게이트 판정기 | 필수 증거 누락·다른 SHA·skip을 차단 | 역할별 판정자, 정책·운영은 사람 |
| 학습 후보기 | 반복 가능한 교훈을 CANDIDATE로 제안 | AI 부 O, 독립 검증 필요 |

하나의 모델이 여러 구성요소를 수행할 수 있어도 같은 컨텍스트에서 제작과 최종 검증을 겸하지 않는다.

### 2.1 채팅 계층과 실행 컨텍스트

채팅 이름과 AI 역할은 서로 다른 개념이다. 채팅은 요청·상태·결정을 라우팅하고, 역할은 Task가
요구하는 책임을 수행한다. 어느 채팅도 그 안의 대화를 공식 기억이나 승인 근거로 사용하지 않는다.
정식 이름과 소속은 팀 구성안 §1.4가 단일 소유하며, 본 문서는 다음 실행 흐름만 소유한다.

마스터 작업의 번호 계약은 `01 통합 작업큐 · 사람 결정`, `02 마스터 오케스트레이션`,
`03 부 오케스트레이션 · 토큰/컨텍스트 관리`, `04 개발·스테이징 배포 검증`,
`05 운영 배포 · 복구 게이트` 순서다.

```text
MarginCook · 마스터 작업
├─ 01 통합 작업큐 · 사람 결정            사람의 승인·반려·보류와 Decision 공식 연결
├─ 02 마스터 오케스트레이션             AI 마스터의 전체 목표·순서·작업 그래프·담당 배정·결정 요청 통합
├─ 03 부 오케스트레이션 · 토큰/컨텍스트 관리
│                                      AI 부 O의 요청 정규화·확정 라우팅 실행·컨텍스트/HANDOFF 관측
├─ 04 개발·스테이징 배포 검증            사람의 진행 결정·비운영 배포 증거·차단 상태
└─ 05 운영 배포 · 복구 게이트            사람의 운영 Go/No-Go·복구 결정·사후 증거

MarginCook · 부서 그룹
├─ 00 모든 팀 상황실                     공식 상태 링크만 공지
├─ 01 Product · Mobile                   제품·앱 업무 발견과 분해
├─ 02 Data · Backend                     DB·RPC·원장·계산 업무 발견과 분해
├─ 03 Server · Supabase · Operations     서버·Supabase·보안·배포 업무 발견과 분해
├─ 04 Quality · Review                   검증·감사 일정과 차단 조정
└─ 05 Knowledge · Orchestration          문서망·작업큐·Learning·컨텍스트 관리
```

부서 채팅은 장시간 구현 공간이 아니다. 한 목표·한 Task ID·한 edit lease를 가진 임시 Task 채팅에서
실제 작업하고, 부서 채팅과 모든 팀 상황실에는 공식 Task·Decision·HANDOFF·Release 링크만 돌려준다.
Context & Token Steward는 `05 Knowledge · Orchestration`에 속하지만 별도
`CONTEXT-STEWARD` 관측 컨텍스트로 모든 채팅의 압력을 본다. 이 역할은 새 채팅 전환을 제안할 뿐
Task 범위·정책·비용 상한·검수 생략을 결정하지 않는다.

`02 마스터 오케스트레이션`은 `AI-MASTER-ORCHESTRATOR` 역할과 `SOLAR-MASTER-ORCH` 전용
컨텍스트가 소유한다. 마스터 AI는 사람이 승인한 목표 안에서 작업 분해·전체 순서·작업 그래프·담당
팀/역할·라우팅 계획을 확정하고 사람 Decision 요청을 통합한다. `03 부 오케스트레이션 · 토큰/컨텍스트
관리`는 `AI-DEPUTY-ORCHESTRATOR` 역할과 `SOLAR-ORCH` 전용 컨텍스트가 소유하며 요청 정규화,
추가·대체·별도 예비 판정, 상태 복원, 확정된 라우팅의 실행, Task/lease/HANDOFF와 토큰·컨텍스트
관측을 담당한다. `Task 라우팅`이라는 말은 이 두 단계 외의 공동 확정 권한을 뜻하지 않는다.

마스터 AI의 실행 조정은 `02 마스터 오케스트레이션`에서 시작한다. 사람 결정이 필요하면
`01 통합 작업큐 · 사람 결정`에 Decision을 올리고, 결정 증거를 받은 뒤 `04 개발·스테이징 배포 검증`과
`05 운영 배포 · 복구 게이트`로 이어 간다. 사람은 `04 개발·스테이징 배포 검증`에서 진행·보류·재시험
결정을 직접 말하며, 이 결정은 `01 통합 작업큐 · 사람 결정`에 자동 연결하되 운영 승인으로 확대하지
않는다. 사람은 `05 운영 배포 · 복구 게이트`에서 운영 Go/No-Go·복구 방향을 명시적으로 결정하며,
이 결정도 `01`에 자동 연결한다. 사람은 같은 결정을 다른 채팅에서 반복 입력하지 않는다.
`01`은 미결·완료 Decision의 통합 보기이고 결정 발화의 독점 채팅이 아니다. `03`은 이 흐름과
모든 팀의 상태·토큰·HANDOFF를 관측하고 마스터가 확정한 경로를 실행해 `02`를 보조하지만 사람
결정, 작업 분해·담당 배정 또는 마스터의 라우팅 계획 확정을 대신하지 않는다.
부서 라우팅은 `00 모든 팀 상황실`에서 `05 Knowledge · Orchestration`까지의 여섯 채팅을 사용한다.
이 이름은 탐색 앵커일 뿐 역할 ID나 승인 권한이 아니다.

## 3. 사용자 요청 수신

### 3.1 요청 유형

요청 해석자는 먼저 요청을 다음 중 하나 이상으로 분류한다.

| 유형 | 기본 행동 |
|---|---|
| 질문·설명 | 읽기 전용 확인 후 근거 있는 답변 |
| 검토·보고 | 변경하지 않고 사실·위험·누락 보고 |
| 진단 | 원인과 영향 확인, 수정은 별도 권한 확인 |
| 변경·구현 | 설계·구현·검증·인계까지 수행 |
| 배포·운영 | 대상·환경·SHA·복구·승인 게이트 적용 |
| 모니터링·대기 | 반복 관측 계약과 종료 조건 적용 |
| 결정 요청 | 선택지·영향·권고안을 사람에게 한 번 제시 |

한 요청이 여러 유형이면 단계로 분리한다. 예를 들어 “검토해서 고쳐 배포해줘”는 검토→구현→검증→
배포 승인 게이트 순서이며, 앞 단계 결과가 뒤 단계 권한을 자동 확대하지 않는다.

### 3.2 요청 해석 계약

요청 해석자는 답을 쓰거나 역할에 지시하기 전에 다음을 확인한다.

1. 사용자가 얻으려는 최종 업무 결과
2. 지금 요청이 기존 Task의 추가·대체·별도 작업인지
3. 저장소에서 확인 가능한 현재 상태와 채팅 주장 차이
4. 명시적 포함·제외·보존 대상
5. 결과를 바꿀 수 있는 미결 결정
6. 안전한 최소 가정과 그 무효화 조건
7. 위험 등급·필요 역할·사람 승인 지점
8. 완료 조건과 필요한 실행 증거
9. 작업을 멈춰야 하는 조건

해석 결과는 온톨로지 §6.2의 필드로 정규화하고 `docs/작업큐.md` Task와 필요한 공식 검수
`task.json`에 각 권위 범위대로 기록한다.

### 3.3 질문할 때와 진행할 때

다음은 질문 없이 합리적인 최소 가정으로 진행할 수 있다.

- 결과 의미를 바꾸지 않는 파일명·표현·정렬
- 읽기 전용 조사로 확인할 수 있는 사실
- 승인된 설계 안의 기계적 구현 세부
- 쉽게 되돌릴 수 있고 사용자 범위 안인 저위험 조치

다음은 사람 결정 전 진행하지 않는다.

- 선택에 따라 도메인 공식·금액·세금·재고 결과가 바뀜
- 권한·RLS·민감정보·운영 데이터 영향
- 파괴적 migration·삭제·복구·운영 배포
- 진행 중 Task의 취소·범위 축소·결과 대체
- 사용자 소유 변경과 같은 경로를 수정해야 함
- 요구가 서로 충돌하고 현재 Decision으로 해소할 수 없음

질문은 이미 저장소에서 확인할 수 있는 내용을 다시 묻지 않고, 결정에 필요한 차이와 권고안을 함께
제시한다. 질문 때문에 안전한 읽기 전용 조사와 비충돌 작업까지 멈추지 않는다.

## 4. 여러 채팅과 작업 연속성

### 4.1 기본 전제

- 각 채팅은 전체 문맥이 아닌 부분 관측이다.
- 모델 기억과 채팅 요약은 현재 상태 증거가 아니다.
- 동일 사용자가 다른 채팅에서 같은 주제를 다룰 수 있다.
- 한 채팅에서 작업 중에도 다른 채팅이 추가 요청·중단·상태 질문을 보낼 수 있다.
- Git worktree는 공유될 수 있어 파일 편집 충돌을 별도로 막아야 한다.

### 4.1.1 다중 채팅 Mission Relay·공통 모델 계획 계약

이 저장소의 장기 채팅은 각각 독립 `mission_id`와 비식별 `session_id`를 가진다. 각 미션은 자기
대화의 model-bound 호출·압축·남은 호출 하한만으로 1.7 경제성 비율을 계산한다. 한 채팅의 토큰,
롤오버 신호, HANDOFF 또는 새 후속 채팅은 다른 채팅의 판정·비용·계보에 합산하거나 전파하지 않는다.
10개는 현재 운영 단위의 수이며, 임의의 전역 상한이나 한 미션의 successor 수 제한이 아니다.

Mission Relay는 미션별 상태 파일과 상태별 lock을 사용한다. 등록된 채팅은 모두 자기 훅 이벤트에서
계측·평가되고, 미등록 또는 `monitoringEnabled: false` 채팅은 조용히 대기한다. `activate`와
`deactivate`는 지정 미션의 감시 상태만 바꾸며 다른 등록 미션의 상태를 바꾸지 않는다. Stop 훅이
롤오버를 막을 때도 해당 미션 하나의 봉인되지 않은 HANDOFF만 막는다. 동일 HANDOFF에는 후속 채팅을
하나만 연결하며, successor가 채택되면 predecessor 감시만 종료한다.

Project Orchestrator는 저장소마다 봉인된 `model-plan.json` 하나를 소유한다. 채팅별로 계획 파일을
복제하지 않는다. 각 Mission Relay 등록은 그 공통 계획의 정확한 SHA를 읽기 전용으로 결속하고,
계획이 바뀌면 새 SHA를 검증한 뒤 자기 상태를 갱신한다. 채팅별로 보존하는 것은 현재 단계, 담당 route,
남은 호출 하한, 검수 상태, 증거와 HANDOFF 계보뿐이다. 단계 완료·역할/모델 route 변경·계획 만료는
공통 계획의 새 판본 봉인 사유이며 계정군 내부 전환은 아니다.

```text
프로젝트 공통 model-plan SHA
  ├─ 채팅 A mission state → A의 1.7 → A HANDOFF → A successor 1개
  ├─ 채팅 B mission state → B의 1.7 → B HANDOFF → B successor 1개
  └─ 채팅 C mission state → C의 1.7 → C HANDOFF → C successor 1개

공통 계획 갱신 → 검증된 새 SHA → 다음 채팅 이벤트에서 각 미션이 독립 재결속
```

1.7은 누적 토큰 수나 채팅 수의 배수가 아니다. 같은 모델/추론 강도 또는 봉인된 가중치 기준으로,
현재 채팅을 자동 압축하며 유지할 비용과 최소 복원 패킷을 쓴 successor의 steady-state 비용 차이를
인계 상한 비용으로 나눈 미션별 경제성 비율이다. 최소 관측 수·양의 근거 있는 남은 호출 하한·유효한
공통 계획이 없으면 해당 미션은 `rollover`가 아니라 보류 상태다.

이 계약은 12단계 v0.5 완료 뒤의 후속 구현 단계에서 적용한다. 12단계의 문서·디렉터리·그래프 검사·
파일럿·스타터 키트 증거를 소급 변경하거나, 다중 채팅 기능을 사람 승인·운영 배포 권한으로 확대하지
않는다.

### 4.2 요청 병합 규칙

판정 enum과 의미의 단일 소유자는 `AI-지식-온톨로지-기획안.md` §6.3이다. 본 문서는 그 네 값을
실행 흐름에 적용하고 `request_dispositions[]`에 판정·근거·확인 시각·승인 필요 여부·Decision ID를
append한다. 기존 판정 이력을 덮어쓰지 않는다.

```text
새 입력
→ 기존 Task ID 후보 검색
→ 목표·산출물·위험·파일 범위 대조
→ ADD | SUPERSEDE_PROPOSAL | NEW_TASK | STATUS_ONLY
→ 충돌·의존성 갱신
→ 필요한 역할과 게이트 재계산
```

- `ADD`: 기존 목표는 유지되고 완료 조건 또는 범위가 추가된다.
- `SUPERSEDE_PROPOSAL`: 기존 결과·취소·범위 축소를 제안한다. 사람 Decision 전에는 적용하지 않는다.
- `NEW_TASK`: 별도 산출물·위험·릴리스 주기를 가진다.
- `STATUS_ONLY`: 진행 상태를 묻거나 설명을 요구하며 범위를 바꾸지 않는다.

### 4.3 재개 패킷

새 채팅은 온톨로지 §6.4의 L0~L4 기억 캡슐을 순서대로 복원하고 다음 최소 상태를 확보한다. 아래
YAML은 별도 권위 스키마가 아니라 팀 구성안 §11의 Task 필드와 온톨로지의 HANDOFF 계약을 한 번에
검사하기 위한 실행 표현이다.

```yaml
task_id: string
objective: string
current_state: string
in_scope: []
out_of_scope: []
acceptance_criteria: []
roles: []
depends_on: []
conversation_refs: []
last_verified_sha: git-sha-or-null
agents_md_blob_sha: git-blob-or-null
fixed_decisions: []
assumptions: []
risk_level: R0 | R1 | R2 | R3
risk_basis: string
active_branch: string
worktree_state: clean | user_changes | task_changes | mixed
user_owned_changes: []
open_findings: []
open_decisions: []
request_dispositions:
  - seq: 1
    kind: STATUS_ONLY
    evidence_conversation_ref: CHAT-LOCAL-001
    observed_at: 2026-09-01T00:00:00+09:00
    requires_human_approval: false
    decision_id: null
    previous_hash: GENESIS
    item_hash: sha256-of-canonical-item
next_safe_action: string-or-null
stop_conditions: []
untracked_in_scope_paths: []
artifact_paths: []
reference_paths: []
evidence_paths: []
excluded_paths: []
edit_owner: null
owner_session_ref: null
lease_expires_at: null
handoff:
  handoff_id: HANDOFF:TASK-ID:0001
  handoff_version: 1
  predecessor_handoff_id: null
  source_commit_sha: git-sha
  task_snapshot_hash: sha256-of-canonical-task-snapshot
  successor_role_context_id: ROLE_CONTEXT:role-id:version
  created_at: 2026-09-01T00:00:00+09:00
```

필수 필드 집합의 단일 권위는 팀 구성안 §11이며 위 YAML은 그 표현이다. 필드가 없거나 Git 상태와
다르면 `환경 미검증`이며 이어서 수정하지 않는다. 읽기 전용 대조로 상태를
복구하고, 정책 충돌 또는 사용자 변경 겹침만 사람에게 올린다.
HANDOFF 검사는 `handoff_version`, `predecessor_handoff_id`, `task_snapshot_hash`, source commit,
successor role context를 모두 대조하며 하나라도 없으면 실행 패킷으로 인정하지 않는다.

### 4.4 동시 작업 잠금

- 한 Task는 한 시점에 하나의 편집 소유 역할만 가진다.
- 같은 파일 또는 같은 DB 계약을 수정하는 Task는 병렬 실행하지 않는다.
- 읽기 전용 QA·감사는 격리 snapshot에서 병렬 가능하다.
- 사용자 소유 변경(추적 변경 + 요청받지 않은 미추적 파일) 경로는 자동으로 제외하고, 겹치면 해당
  Task를 중단한다.
- `collaboration.md` append와 검수 실행은 같은 task lock을 공유한다.
- 작업 중 새 사용자 메시지는 `ADD`, `SUPERSEDE_PROPOSAL`, `STATUS_ONLY`를 판정한 뒤 현재 실행에
  안전하게 반영한다.
- 편집 소유권 획득·갱신·해제와 만료 인계의 단일 계약은 팀 구성안 §11이다. 본 문서는 이를
  재정의하지 않고 재개 때 세 필드와 Task lock 증거를 확인한다.
- 비소유 채팅의 `request_dispositions[]` 전용 append와 새 Task 최초 `edit_owner` 지정도 팀 구성안
  §11만 소유한다. 오케스트레이터는 해당 queue ledger lock 연산의 성공 증거를 확인할 뿐 허용 필드를
  넓히지 않는다.
- 다른 채팅의 lease가 유효하면 새 채팅은 수정하지 않고 상태·인계 요청만 남긴다.
- 전용 lease 명령 구현 전에는 Task에 미리 지정된 한 `edit_owner`만 편집하며, `null`을 자동으로
  차지하거나 만료 lease를 자동 인수하지 않는다.

### 4.5 현재 채팅 체크포인트와 새 채팅 전환

현재 채팅의 효율은 원문을 오래 유지하는 것으로 판단하지 않는다. 다음 중 하나가 관측되면 Context &
Token Steward가 `CONTEXT_ROLLOVER_REQUIRED` 신호를 남긴다.

- 같은 사실·경로·결정을 반복해서 다시 읽는다.
- 요약·도구 출력이 직접 권위보다 커져 현재 목표나 제외 경로를 놓칠 위험이 있다.
- 독립된 다음 Task 또는 위험 단계로 넘어간다.
- 모델·실행기·비용 envelope를 바꾸어야 한다.
- 현재 채팅의 남은 컨텍스트가 다음 검증과 안전한 인계 둘을 모두 담기 어렵다.

이 신호만으로 채팅을 바꾸지 않는다. AI 부 오케스트레이터는 먼저 현재 저장소·Task·lease를 대조하고
`CHECKPOINT_REQUIRED`를 거쳐 다음을 수행한다.

1. 완료된 결과와 미완료 결과를 분리하고 exact SHA·실행 증거를 기록한다.
2. 사용자 소유 변경·미추적 제외 경로를 다시 봉인한다.
3. `request_dispositions[]`, 열린 Finding·Decision, `next_safe_action`, stop condition을 최신화한다.
4. 현재 Task canonical snapshot hash와 source commit SHA를 가진 새 HANDOFF를 append한다.
5. predecessor보다 단조 증가한 `handoff_version`과 successor role context를 검증한다.
6. 새 Task 채팅이 L0~L4를 복원해 같은 다음 행동을 산출한 뒤에만 edit lease를 인계한다.

동일·낮은 HANDOFF 판본, source SHA 불일치, 누락된 제외 경로, 열린 편집 lease가 하나라도 있으면
`HANDOFF_READY`로 전이하지 않는다. 이전 채팅 원문은 감사 원본도 공식 기억도 아니며, 필요한 비식별
conversation reference만 L4 조건부 증거로 남긴다.

## 5. Task Graph

### 5.1 노드

```text
DISCOVER → DEFINE → DESIGN → IMPLEMENT → VERIFY → AUDIT → DECIDE → RELEASE → OBSERVE → LEARN
```

모든 작업이 전 노드를 거칠 필요는 없다. 위험과 요청 유형에 따라 필요한 노드만 사용하되, 생략한
노드와 이유를 기록한다. R2·R3는 팀 구성안의 게이트를 생략하지 않는다.

### 5.2 의존성

- `depends_on`: `TASK ─DEPENDS_ON→ TASK | DECISION`으로 선행 Task 완료 또는 선행 Decision 확정을 요구
- `blocks`: 새 관계가 아니라 `DEPENDS_ON`의 역방향 파생 view. A가 B를 막으면 B가 A에 `DEPENDS_ON`
- `conflicts_with`: 같은 자원·정책·결정을 동시에 바꿈
- `evidences`: 새 관계가 아니라 `TASK ─EVIDENCED_BY→ EVIDENCE`의 표시용 파생 필드
- `supersedes`: 사람 Decision으로 옛 Task 결과를 대체

순환 의존성이 생기면 작업을 시작하지 않고 공통 선행 결정 또는 인터페이스 Task로 분리한다.

### 5.3 크기 조절

작업은 다음 조건을 동시에 만족하는 최소 완전 단위로 자른다.

- 독립적인 업무 결과가 있다.
- 실행 가능한 완료 조건이 있다.
- 한 명시적 편집 소유자가 있다.
- 검증자가 전체 변경을 이해할 수 있다.
- 실패 시 전진 수정 또는 되돌림 경계가 분명하다.
- 분리로 인해 정책·DB·앱 계약이 중간에 불일치하지 않는다.

## 6. 역할 라우팅

### 6.1 능력·위험 매트릭스

| 변경 | 제작 | 실행 검증 | 독립 감사 |
|---|---|---|---|
| 문서 인덱스·링크 | AI 부 O/솔라 | Codex 정적 검사 | Fable 기본·Opus 유효 fallback 계약·링크 누락 검수 |
| 제품 요구·도메인 정책 | SOLAR-PO | Codex 시나리오 | Fable 기본·Opus 유효 fallback 반례 검수 |
| 구조·디렉터리 | SOLAR-ARCH/App | Codex 동등성·경계 시험 | Fable 기본·Opus 유효 fallback 구조 감사 |
| DB/RPC/RLS | SOLAR-DEV-DB | Codex DB·경합·권한 시험 | FABLE-SEC 역할(Fable 기본·Opus 유효 fallback) |
| Core 공식 | SOLAR-DEV-CORE | Codex SQL parity | FABLE-ARCH 역할(Fable 기본·Opus 유효 fallback) |
| Mobile | SOLAR-DEV-APP | Codex UI·Android·iOS | Fable 기본·Opus 유효 fallback 요구사항·접근성·시험 누락 검수 |
| 운영 배포·복구 | SOLAR-OPS + 사람 | Codex smoke·검산 | Fable 기본·Opus 유효 fallback 고위험 감사 + 사람 |

모델 이름은 역할이 아니다. Fable과 Opus의 엔진 출처·승계 조건은 `docs/ai-review/README.md`를 따른다.
독립 감사 칸은 Fable 기본 결과 또는 계약 검증된 `OPUS-FALLBACK` successor 결과로 완료 처리한다.
R0/R1은 Opus fallback으로 로컬 완료할 수 있고, R2/R3·운영 종결은 Fable 복구 표본 재감사 또는 사람의
exact-SHA 잔여 위험 수용을 추가로 요구한다. `OPUS_DIRECT_ADVISORY`는 이 칸을 충족하지 않는다. 실제
엔진 출처를 숨기거나 Opus 결과를 Fable 결과로 표시하지 않는다.

### 6.2 역할 호출 최소화

- 모든 R0~R3 완료 route는 Codex 실행 검증과 Fable 기본 검수 또는 유효한 Opus fallback을 요구한다.
- R0는 한 공식 산출물과 최소 교차계약 투영으로 Fable 입력을 축소한다.
- R1은 영향 경계와 기존 회귀를 중심으로 Fable 검수 깊이를 조절한다.
- R2는 설계 반례와 전문 독립 감사 역할을 추가하고 Fable 재감사 또는 사람 위험 수용을 요구한다.
- R3는 사람 결정과 분리된 보안·아키텍처 감사 및 Fable 재감사 또는 사람 위험 수용을 유지한다.
- 같은 역할을 이름만 바꿔 중복 호출하지 않는다.
- 앞 역할의 자기평가를 다음 독립 역할의 결론으로 주입하지 않는다.

### 6.3 12단계 모델·토큰 운영 계약

이 계약은 `AI-ORCH-PLANS-SIM-1`의 12단계 전환 작업에만 적용하는 실행 profile이다. 일반 Task에
모든 모델을 호출하라는 규칙이 아니며, 역할·승인 권한은 팀 구성안과 이 문서 §6.1이 계속 소유한다.
모델명은 역할명이 아니다. 각 Run은 요청 alias가 아니라 실제 `model_id`, reasoning effort, 입력·출력
사용량, 비용 envelope, terminal reason을 증거에 남긴다. 지정 모델을 사용할 수 없으면 조용히 다른
모델로 낮추지 않고 `MODEL_UNAVAILABLE` 또는 `REVIEW_PENDING`으로 멈춘다.

12단계는 다음 기본 경로로 진행한다.

```text
Terra xhigh가 권위·이전 증거를 복원하고 공식본을 작성·구현
→ Codex 실행 검증과 exact target/diff 증거 생성
→ 묶음 경계에서 Sol high/xhigh가 구조 결정만 제한 검토
→ Fable이 공식 독립검수
→ Fable의 구조화된 소진 조건에서만 Opus가 같은 계약으로 승계
→ 제작자가 Finding을 반영하거나 근거 있는 disposition 기록
→ 필요한 재검증 뒤 단계 판정
```

각 검수 묶음은 정확한 대상 bytes에 결속된 Fable 결과 또는 팀 구성안 §3.10.1을 통과한 Opus fallback
결과가 없으면 `REVIEW_PENDING`으로 멈춘다. Fable과 Opus를 같은 검수 목적으로 동시에 호출하지 않고,
단계별 상한을 반복 증액하지 않는다. 사람은 프로젝트 시작 시 `review_budget_envelope_approved`를 한 번
pin하며 AI 부 오케스트레이터와 토큰 관리자는 그 봉투 안에서 묶음별 배분과 미사용분 이월을 수행한다.
봉투가 없거나 잔액·사용률 기준을 위반하면 외부 검수 Run을 시작하지 않는다.

Sol과 외부 감사 엔진은 Terra 작업을 처음부터 재수행하지 않는다. Sol 입력은 Task 계약, 대상
공식본·diff, 관련 권위, 실행 증거, 미해결 질문만 포함한다. Fable 또는 fallback Opus의 최초 입력은
독립성을 위해 Terra·Sol의 결론과 자기변호를 제외하고 같은 대상 판본·권위·검증 증거만 포함한다.
검수된 대상 bytes가 바뀌면 사유와 무관하게 이전 PASS는 새 판본을 대표하지 않으며 diff 재검수를
받는다. 반대로 동일 bytes·동일 증거는 새 Finding·입력 결함 없이 반복 호출하지 않는다.

호출 하한은 검수 묶음으로 계산한다. 스터디 횟수·실행 검증·외부 모델 호출을 같은 지표로 합산하지
않으며, 조건부 diff 재검수는 기본 하한에 숨기지 않고 별도 계수한다.

| 묶음 | 단계·결과 | Terra xhigh | Sol 구조 검토 | Fable 기본 | Opus 기본 |
|---|---|---:|---:|---:|---:|
| A | 1~5 기획안 확정 | 단계별 1회 · 5 | high 1 | 1 | 0 |
| B | 6~7 상호참조·종합 감사 | 단계별 1회 · 2 | xhigh 1 | 1 | 0 |
| C | 8 사람 최종 승인 | 승인 자료 1 | 없음 | 신규 bytes diff 1 | 0 |
| D | 9~11 생성·검사기·파일럿 | 단계별 1회 · 3 | high 1 | 1 | 0 |
| E | 12 스타터 키트 역반영 | 단계 1 | xhigh 1 | 1 | 0 |
| **기본 하한** |  | **12** | **4** | **5** | **0** |

기본 합계는 21회다. 묶음 C 승인 자료가 묶음 B의 검수 bytes와 hash로 동일하면 C의 Fable 호출을
생략해 Fable 4회·총 20회가 된다. 기존 “Codex 2회·Fable 유효 2회”는 단계별 반복 호출이 아니라
서로 다른 증거 축과 최종 네트워크 closure를 검증하는 최소 유효 회차 계약이다. Finding이나 대상
bytes 변경에 따른 재검수만 조건부로 추가한다.

8단계의 AI 결과는 승인 자료와 권고일 뿐 사람 `HUMAN_DECISION`을 대체하지 않는다. 승인 자료가 새
bytes이면 사람에게 올리기 전에 Fable diff 검수 또는 유효한 Opus fallback을 거친다. Fable 소진
승계는 팀 구성안 §3.10.1을 따르며 R0·R1은 Opus 결과로 로컬 완료할 수 있다. R2·R3·운영은 Fable
복구 표본 재감사 또는 exact SHA 사람 위험 수용이 추가로 필요하다. `OPUS_DIRECT_ADVISORY`는 사람이
별도로 요청한 비게이트 자문일 뿐 이 기본 호출표에 포함되지 않는다.

#### 6.3.1 측정 단위와 상한 제어

- OpenAI Run은 input, cached input, output, reasoning token을 가능한 범위에서 분리하고, Claude Run은
  CLI가 보고한 input/output/cache 사용량과 USD 비용을 별도 기록한다. 서로 다른 공급자의 원시 토큰을
  단순 합산해 모델 우열이나 비용을 판정하지 않는다.
- 프로젝트 검수 봉투는 시작할 때 사람 Decision으로 한 번 고정한다. Task별 기술 상한은 남은 봉투
  안에서 토큰 관리자가 정하며 단계마다 사람에게 증액을 요구하지 않는다. 봉투가 `UNSET`이면 외부
  검수 Run만 차단하고 Terra의 읽기·초안·로컬 검증까지 다시 막지는 않는다.
- 봉투 사용률 80%에서 중복 원문·낡은 증거를 제거하고, 100%에서 새 외부 호출과 동일 입력 재호출을
  중단한다. 더 필요하면 자동 증액하지 않고 남은 결과·대체 경로·잔여 위험을 사람에게 보고한다.
- 비용 절감 순서는 중복 요약 제거 → 역할별 allowlist 축소 → 큰 로그의 hash·판별력 있는 compact
  evidence화 → 출력 verbosity 축소다. 필수 권위, 사람 승인, 실행 검증, 필수 감사 route는 절감 대상이
  아니다.
- Sol은 A·D 묶음에서 `high`, B·E 묶음에서 `xhigh`로 최초 구조 판정 1회만 수행한다. 같은 Sol Finding을
  반영한 판본 또는 권위 계약이 바뀐 경우에만 재호출한다.
- Fable 최초 회차는 묶음별 클린 컨텍스트·읽기 전용·제한 도구로 실행한다. rate limit은 제공자의
  `retry_after`에 따른 최대 1회, capacity 오류는 60초 뒤 최대 1회 재시도한다. 개별 기술 상한 종료는
  입력 축소 재시도 1회 뒤에도 실패하면 Opus로 우회하지 않고 실패로 닫는다.
- Opus fallback은 구조화된 제공자·프로젝트 봉투 소진 또는 위 재시도 기준을 소진한 rate/capacity
  오류에서만 새 클린 컨텍스트로 실행한다. 실패 원본·비용·실제 엔진을 숨기지 않는다.

#### 6.3.2 단계 증거와 재계획

각 단계는 `stage_id`, 대상 commit/tree 또는 working snapshot hash, 입력 manifest hash, 모델·effort,
호출 하한·실사용량, 실행 검증, Finding, 사람 Decision 필요 여부, 검수 봉투 ID·잔액 snapshot과 근거 Decision ID,
`independence_attestation`(앞 모델 결론·자기변호 등 주입 금지 항목과 부재 확인), 다음 안전 행동을
남긴다. 기본 호출 하한 초과, Critical/Major 신규 Finding, 권위 문서 변경, 사용자 범위 변경, 반복
실패가 발생하면 남은 묶음의 호출·effort를 재산정한다. 재산정은 과거 사용량을 지우거나 실패를
0원으로 바꾸지 않으며 외부 검수 봉투를 늘리면 사람 승인을 요구한다.

## 7. 컨텍스트 조립

컨텍스트 조립은 온톨로지 §9의 route 규칙을 적용한다.

### 7.1 공통 입력

- 대상 Task 계약
- 현재 `AGENTS.md` blob/content hash
- 적용 Decision·미해결 Risk
- baseline·target commit
- 사용자 소유 변경·제외 경로
- 역할에 허용된 Learning ID

### 7.2 점진적 공개

```text
1. 책임 경계·Task·변경 요약
2. 영향 파일과 상위 권위
3. 필요한 소스·시험 원문
4. 실패를 이해할 때만 추가 증거
```

긴 문서 전체를 무조건 넣지 않는다. 다만 선택된 권위 문서의 일부만 읽어 결론을 왜곡하지 않도록,
문서 단위 선택 후 전체 파일을 읽거나 명시된 절과 의존 절을 함께 제공한다.

컨텍스트 조립기는 파일 수나 토큰 수 자체를 목표로 삼지 않는다. 각 입력에 `왜 필요한가`, `어떤
권위를 제공하는가`, `어느 완료 조건을 검증하는가`를 연결하고, 같은 사실을 복제한 비권위 요약은
제거한다. Context & Token Steward가 측정값과 rollover 신호를 제공하고 AI 부 오케스트레이터가
Task 결과·위험·독립성에 맞춰 최종 입력 manifest를 정한다.

### 7.3 금지 입력

- 비밀정보·운영 DB dump·고객 개인정보
- OneDrive·다른 저장소·동기화 사본
- Task 범위 밖의 넓은 소스 트리
- 현재 독립 감사의 결론을 유도하는 이전 요약
- 검증되지 않은 Learning
- 사용자 소유 변경 파일의 미승인 내용

이 목록은 온톨로지 §9의 route별 금지 계약의 부분집합이다. `FINAL_INDEPENDENT` 전 회차와 predecessor
registry가 없는 최초 `SECURITY` Task에는 `VERIFIED`를 포함한 Learning 일체를 주입하지 않으며,
서로 `CONFLICTS_WITH`인 Learning을 동시에 적용하지 않는다.

## 8. 제작·검증·감사 루프

### 8.1 기본 루프

```text
정규화된 Task
→ 제작자가 단일 공식 산출물 수정
→ Codex가 실행 가능한 계약 검증
→ 독립 감사자가 구조·보안·정책 반례 검토
→ 제작자가 같은 공식 산출물 보완
→ Codex 재검증
→ 감사자 재검수
→ AI 부 O가 증거 종합
→ 필요한 사람 결정
```

Finding 원본은 수정하지 않고 같은 ID로 해결 증거를 연결한다. 감사자가 제안한 문구는 공식 문서에
반영되기 전까지 정책이 아니다.

### 8.2 핵심 기획안 누적 외부 교차검수

사람 주 오케스트레이터의 2026-09-01 결정에 따라 다음 핵심 기획안을 누적 집합으로 검수한다.
이 advisory 시리즈의 소유 Task ID는 `AI-ORCH-PLANS-1`이다.
이 절의 번호 목록이 현재 누적 교차검수 대상의 단일 소유자다. 다른 문서는 문서 수와 파일 목록을
복제하지 않고 이 절이 정한 현재 집합 전체를 참조한다.

1. 팀 구성 및 운영 상세 기획안
2. AI 지식 온톨로지 기획안
3. AI 오케스트레이션 상세 기획안
4. 디렉터리·문서 신경망 재설계 기획안
5. AI 품질·학습·자율성 평가 기획안

각 새 핵심 기획안이 추가되면 새 문서만 보지 않고 기존 완료 문서 전체와의 책임·입력·출력·상태·
실패·학습 관계를 외부 감사 엔진이 읽기 전용으로 두 번 검수한다. 2026-09-03 사람 결정 이후 Fable이
기본 엔진이며 팀 구성안 §3.10.1의 구조화된 소진·재시도·successor 계약을 통과한 Opus만 같은 독립
역할을 승계한다. 결정 전에 완료한 직접 Opus advisory의 비용·실패·원본은 역사적 증거로 계속 보존하지만
공식 독립검수 gate를 종결하지 않는다.

```text
누적 초안 → 외부 교차검수 r1 → 공식 문서 반영 → 외부 교차검수 r2 → 잔여 필수 Finding 반영
→ 다음 문서 누적 r1에서 직전 수정 재확인
```

- 두 회차는 유효한 구조화 결과가 있어야 하며 timeout·max_turns·인증 실패를 회차로 세지 않는다.
- r2가 새 필수 Finding을 찾으면 수정하고 다음 누적 단계 r1에서 다시 확인한다.
- 마지막 5문서 단계는 잔여 필수 Finding 0건인 유효 재검수를 얻기 전 완료하지 않는다.
- 모델·CLI·세션·사용 상한·보고 사용액·verdict·Finding ID를 증거에 기록한다.
- 공식 fallback handoff가 아닌 직접 Opus 검수는 `OPUS_DIRECT_ADVISORY`로 표시하고 독립검수 gate
  종결 근거로 사용하지 않는다.

최종 활성화는 네 DRAFT 기획안의 상태, 사람 `ACTIVE` Decision, `AGENTS.md` 책임 목록을 하나의
decision commit에서 함께 갱신한다. 일부 문서만 `ACTIVE`인 혼합 상태, 승인자·승인일·대상 hash가
없는 Decision, 책임 목록이 빠진 commit은 활성화 실패다. 검수 `PASS`는 Run/Review 증거일 뿐 문서
권위나 gate `CLOSED`를 자동으로 만들지 않는다.
- 직접 advisory 원본·요약·실패 회차는 `docs/ai-review/evidence/`에 불변 파일로 보존한다. 실패 파일은
  `<STAGE>-OPUS-<ROUND>-FAILED.md`로 명명하고 유효 회차 수에는 포함하지 않으며 삭제·덮어쓰지 않는다.
- 검수 증거, 상태 갱신, 생성 색인은 새 핵심 기획안이 아니므로 자기 자신을 다시 검수하는 재귀를
  촉발하지 않는다.

앞으로 이 목록에 핵심 기획안을 추가하려면 사람 Decision으로 범위를 갱신하고, 추가 직후 전체
누적 집합 2회 검수를 실행한다.

직접 advisory도 프로젝트 단위 `review_budget_envelope_approved` 안에서만 실행한다. 사용량은 CLI
보고값을 센트 단위로 올림해 성공·실패 회차 모두 먼저 합산하며, 비용 envelope가 없으면 회차 기술
상한 전액을 쓴 것으로 본다. 전체 envelope에 도달하면 중단하고 자동 증액하지 않는다. 증액이 필요하면
사람이 별도 `HUMAN_DECISION`으로 프로젝트 envelope 자체를 한 번 갱신해야 하며, Task별·회차별 pin을
누적해 배수 예산을 만들지 않는다. direct advisory는 기본 12단계 route가 아니며 명시 요청 때만 쓴다.

## 9. 실패와 변경 처리

### 9.1 실패 폐쇄

다음은 결과를 합성하지 않고 `RUN_FAILED` 또는 환경 미검증으로 남긴다.

- 모델·CLI 인증·용량·예산·시간 제한 실패
- 구조화 결과 또는 필수 증거 없음
- 입력 hash·대상 SHA 불일치
- 사용자 소유 변경(추적 변경 + 요청받지 않은 미추적 파일)과 미해결 충돌
- 허용되지 않은 도구·경로 접근
- 검증 뒤 worktree 변경
- 다른 채팅이 같은 파일 편집 소유권 보유

### 9.2 사용자 요청 변경

- 상태 질문은 현재 작업을 중단하지 않고 답한 뒤 계속한다.
- 범위 추가는 영향·비용·게이트를 재계산한다.
- 대체 제안은 현재 안전 지점에서 멈추고 사람 Decision을 기다린다.
- 명백한 취소 지시는 진행 작업을 중단하되, 이미 생성된 감사·실행 원본은 삭제하지 않는다.
- 새 요청이 이전 작업과 무관하면 별도 Task로 분리한다.

### 9.3 시간·비용

- 각 외부 검수는 모델·회차 상한과 작업 전체 상한을 가진다.
- 상한 도달은 품질 판정이 아니며 PASS로 변환하지 않는다.
- 큰 누적 문서는 책임 지도와 변경 영향을 먼저 제공해 탐색 회차를 줄인다.
- 동일 실패를 같은 입력으로 무한 재시도하지 않는다.
- 작업 전체 사용량과 실패 사용량도 기록한다.
- 비용 절감을 위해 필수 역할을 생략하지 않고, 불필요한 중복 역할과 무관 컨텍스트를 줄인다.
- 외부 실행 실패 뒤에는 같은 큰 입력으로 상한만 올려 재호출하지 않는다. 먼저 로컬 runner·인증을
  self-test하고, 입력 manifest를 측정한 뒤 의미 축을 분리한다.
- 문서별 의미 축을 나누는 Fable 검수는 해당 공식 문서만 artifact로 두고, 나머지 누적 문서는 target
  commit/tree에 결속된 content hash와 기계 생성된 교차계약 투영(compact evidence)으로 입력할 수 있다.
  이 회차는 해당 문서의 검수일 뿐 최종 네트워크 closure로 세지 않는다.
- 최종 네트워크 Fable 검수는 문서별 유효 review/run/input hash, 전체 문서 content hash, 교차계약
  투영과 그 완전성·사보타주 결과를 함께 결속한다. 투영 생성기가 중앙 권위·관계·상태·Finding 연결을
  누락 없이 추출한다는 parity test가 없으면 축소 입력으로 네트워크 closure를 수행하지 않는다.
- 큰 구현·원시 로그만 hash와 판별력 있는 compact evidence로 대체하며, 감사자가 필요하면 원본을
  요청할 수 있게 경로를 남긴다.
- 외부 비용 envelope의 잔여가 유효 회차 하나를 끝낼 만큼 충분하지 않으면 호출하지 않는다. 실패
  비용도 누적하고, 사람 승인 없는 상한 증액이나 다른 엔진으로의 위장 대체를 하지 않는다.

## 10. 게이트와 종결

### 10.1 기술 검증 완료와 게이트 종결

`기술 검증 완료`는 팀 구성안 §4.4의 `workflow_state=VERIFIED`를 뜻하며, 보호 원격 게이트
전의 로컬 상태다. 다음을 모두 만족한다.

- 요구사항·완료 조건이 실제 구현과 연결됨
- 필수 시험·사보타주가 판별력을 가짐
- 정확한 SHA의 필수 로컬 게이트 성공
- 필수 Finding의 `OPEN`·`DISPUTED`가 0건
- 사용자 소유 변경(추적 변경 + 요청받지 않은 미추적 파일) 미포함
- 문서·코드·시험 경로가 현재 구조와 일치

이는 `CLOSED`와 다르다. `VERIFIED` 후 anchor·decision commit을 만들고, 그 정확한 SHA에
보호 원격 필수 게이트가 성공한 뒤 최초 발견 역할의 closure successor 재검수를 통과해야
팀 구성안 §4.4의 `gate_state=CLOSED`를 선언한다. `VERIFIED` 상태에서 보호 게이트나 successor가
남아 있으면 완료 보고에 반드시 미종결로 표시한다.

### 10.2 사람 결정

다음은 기술 완료와 별도로 사람 주 오케스트레이터가 결정한다.

- 정책·공식·범위 대체
- R2·R3 출시
- 미해결 위험 수용
- 프로덕션 배포·복구·데이터 보정
- 핵심 기획안 `ACTIVE` 승격
- AI 자율성 단계 확대

### 10.3 완료 보고

완료 보고는 다음만 포함한다.

- 사용자가 얻게 된 결과
- 변경한 공식 경로
- 실행한 검증과 정확한 SHA
- `workflow_state`·`gate_state`와 남은 closure successor 재검수
- 미해결 위험·미검증 환경
- 사용자 소유 변경과 요청받지 않은 미추적 파일 보존 여부
- 다음 안전 행동

과정의 모든 도구 호출을 나열하지 않고, 결과를 재현하거나 판단하는 데 필요한 증거만 남긴다.

## 11. 관측과 성장 연결

오케스트레이션은 최소한 다음 사건을 구조화해 평가안으로 보낸다.

- 요청 재해석·재질문 발생
- Task 추가·대체·분리 판정
- 위험 등급 재판정
- 역할 호출과 생략 이유
- 컨텍스트 입력 파일·크기·적용 Learning
- Finding 수·재검수 회차
- 테스트 실패·회귀 유출
- 사람 호출·결정 대기 시간
- 모델·시간·비용 상한과 실패
- 작업 완료 뒤 같은 원인의 재발

원시 사건이 곧 Learning은 아니다. `TEAM_LEARNING.md` 승격 루프를 통과한 재사용 규칙만 다음 Task에
주입한다.

## 12. 단계별 도입

### 단계 1 — 요청·재개 계약

- 작업큐 Task 필드를 현재 계약에 맞춘다.
- 새 채팅 재개 체크를 수동 템플릿으로 검증한다.
- 사용자 소유 변경 겹침과 대체 요청 사보타주를 만든다.

### 단계 2 — 라우팅·컨텍스트

- 위험·파일 영향 기반 역할 라우팅표를 구현한다.
- 역할별 입력 allowlist와 Learning 주입을 검사한다.
- 선택된 권위 파일·hash manifest를 만든다.

### 단계 3 — 문서 그래프·Task Graph

- 온톨로지 검사기와 작업 의존성 검사를 연결한다.
- 같은 파일·DB 계약의 병렬 편집을 차단한다.
- 고아 Task·끊어진 Decision·낡은 SHA를 탐지한다.

### 단계 4 — 평가·권한

- 요청 오해·재작업·회귀·비용 기준선을 잰다.
- 역할·컨텍스트 조합을 champion/challenger로 비교한다.
- 검증된 성과에 따라 제한된 자율성만 단계적으로 확대한다.

### 단계 5 — 실제 채팅·디렉터리와 스타터 키트

- 네 DRAFT 기획안의 유효 누적 외부 교차검수와 사람 `ACTIVE` Decision을 먼저 완료한다.
- 팀별 역할 MD·HANDOFF·Release·Learning 장부와 채팅 그룹은 디렉터리 기획안의 preflight 뒤 한 번에
  materialize한다. 계획 문서가 DRAFT인 동안 빈 권위 파일이나 사이드바 채팅을 미리 만들지 않는다.
- 첫 실제 Task에서 상황실→부서 그룹→임시 Task 채팅→HANDOFF→Release 흐름을 관측한다.
- 검증된 구조를 `AI-TEAM-STARTER-KIT-1`의 v0.1~v1.0 단계에 반영하고, 새 저장소가 제품 고유 경로를
  갖지 않아도 부트스트랩 가능한 fresh-repo fixture로 검증한다.

## 13. 완료 조건

- 여러 채팅의 같은 요청이 하나의 Task와 명시적 상태로 합쳐진다.
- 새 채팅이 대화 기억 없이 저장소 증거로 안전하게 재개한다.
- 마스터 5개 채팅·부서 6개 채팅·임시 Task 채팅이 같은 Task와 권위 링크를 공유하고 경쟁 장부를
  만들지 않는다.
- Context & Token Steward의 전환 신호가 정책·비용·검수 권한으로 확대되지 않는다.
- 새 채팅은 검증된 HANDOFF의 더 높은 판본을 복원한 뒤에만 edit lease를 인수한다.
- 사용자 요청을 담당 역할이 임의로 재정의하지 않는다.
- 중요한 미결 선택은 사람에게 한 번의 결정 패킷으로 올라간다.
- 같은 파일·DB 계약을 여러 역할이 동시에 수정하지 않는다.
- 위험에 맞는 최소 역할과 감사 route가 선택된다.
- 컨텍스트 입력과 Learning 주입이 역할·route 계약을 따른다.
- 외부 모델 실패를 검수 결과로 위장하지 않는다.
- 모든 기술 완료가 정확한 SHA·시험·Finding·게이트 증거에 연결된다.
- 핵심 기획안 추가마다 현재 누적 집합 전체의 외부 교차검수 2회가 실행된다. Fable 기본 회차 또는
  계약 검증된 Opus successor 회차만 완료 회차로 센다. R2/R3·운영 종결에는 Fable 복구 표본 또는
  사람 exact-SHA 잔여 위험 수용을 추가한다.

## 14. 미결 구현 결정

- `docs/작업큐.md` 기존 Task를 새 필드로 일괄 이관할지, 진행 Task부터 적용할지
- 동시 작업 파일 잠금을 Git·로컬 lock·작업큐 중 어떤 조합으로 구현할지
- 저위험 R0·R1 위험 등급 표본 재판정 비율
- 여러 Codex 채팅의 비식별 conversation reference 생성 방식
- 오케스트레이션 사건의 최소 관측 스키마
- 컨텍스트 압력의 기준선과 `CONTEXT_ROLLOVER_REQUIRED` 권고 임계

이 결정은 디렉터리·문서 신경망안과 품질·학습·자율성 평가안을 추가한 누적 검수 뒤 확정한다.
