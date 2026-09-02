# AI-PLANS-V02-ONTOLOGY-003 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `6cc6c654036cce8b5cb360a33db5ab0df81d6e12`

## 요약

온톨로지 v0.2 원문을 AGENTS.md·축소 증거와 대조한 INITIAL 검수 결과, 요구된 반례 상한(최대 3건) 안에서 Major 3건을 보고한다. (1) §6.4-3·§11-14·§13은 HANDOFF의 "동일·낮은 판본" 복원을 거부하라고 요구하지만 §3 HANDOFF 최소 필드 목록에는 비교 대상인 단조 판본 필드가 없다. 생성 시각은 세션 간 시계 오차로 순서를 보증하지 못하고 직전 HANDOFF ID 체인은 같은 predecessor에서 분기한 두 HANDOFF를 판정하지 못해 AI-ONTOLOGY:handoff-monotonic을 기계적으로 집행할 수 없다. 축소 증거 fixture(53~54행 "동일·낮은 HANDOFF 판본 거부", 37행 "더 높은 HANDOFF 판본")가 전제하는 판본 개념이 문서 계약에 부재한다. (2) §6.4 복원 검사 2는 다른 소유자의 lease가 "유효"할 때만 중단을 요구하고, lease 만료·부재 시 successor의 edit_owner 인수 조건이 없다. §6.3의 팀 구성안 §11 위임은 "새 Task 최초 edit_owner 지정"만 다루므로, 축소 증거 56행이 단언하는 "유효 HANDOFF 복원+사람 인계 Decision 소비 뒤에만 lease 획득" 계약이 온톨로지 원문에 없어 신호·시간 경과만으로 권한을 얻는 lease 탈취 경로가 문서상 열려 있다. (3) HANDOFF 권위 위치가 가변 현재 상태 장부인 docs/작업큐.md의 Task snapshot이고 §14가 물리 저장 형식·보존 기간을 미결로 남겨, 일반 Task HANDOFF에 append-only 보존 계약이 없다. 이 경우 §6.4-3의 "더 최신 HANDOFF 존재" 거부가 변조 가능한 기록 위에서 수행되어 stale 복원 방어와 AI-ONTOLOGY:append-only-authority가 약화된다. 그 외 축(단일 권위 위임 §5, 판정 enum 단일 정의 §6.3, request_dispositions hash 체인, Finding 동일 ID 승계, Learning 충돌 배제 §7·§9, SUPERSEDES의 ACTIVE Decision 근거 §11-11, AGENTS 권위 목록 비추가 §14)은 AGENTS:single-canonical-artifact·AGENTS:fable-required-review와 모순이 없음을 확인했다. 세 건 모두에 대해 §3 handoff_version 정수 추가, §6.4 검사 2의 만료 lease 인수 조건 명시, HANDOFF 기록 append-only 보존 문장 추가를 proposed_edits로 제안한다. 판정: CHANGES_REQUIRED.

## Findings

### ONT-003-HANDOFF-VERSION-GAP — Major / OPEN

- 범주: ARCHITECTURE
- 영향: 생성 시각은 세션·기기 간 시계 오차로 전순서를 보증하지 못하고 직전 HANDOFF ID 체인은 같은 predecessor에서 동시 분기한 두 HANDOFF의 우열을 판정하지 못한다. 그 결과 stale HANDOFF 복원 거부(handoff-monotonic 불변식)를 기계적으로 집행할 수 없고 §11 검사 14가 검사할 대상 필드 자체가 없다.
- 근거: docs/AI-지식-온톨로지-기획안.md:103, docs/AI-지식-온톨로지-기획안.md:302, docs/AI-지식-온톨로지-기획안.md:462, docs/ai-review/evidence/AI-PLANS-V02-FABLE-COMPACT-EVIDENCE.md:37, docs/ai-review/evidence/AI-PLANS-V02-FABLE-COMPACT-EVIDENCE.md:53
- 완료 조건: §3 HANDOFF 최소 필드에 Task별 단조 증가 정수 판본(예: handoff_version)이 추가된다. / §6.4-3과 §11-14의 '동일·낮은 판본' 판정이 생성 시각이 아니라 해당 판본 필드 비교로 정의된다. / 같은 predecessor에서 분기한 동시 HANDOFF의 판정 규칙이 명시되거나 분기 자체가 금지된다.
- 필요한 테스트: docs-graph-check 사보타주 fixture: 판본 필드 누락 HANDOFF 거부 / 시뮬레이션 fixture: 동일 판본·낮은 판본·동시 분기 HANDOFF 복원 거부

### ONT-003-LEASE-TAKEOVER-GAP — Major / OPEN

- 범주: ARCHITECTURE
- 영향: lease_expires_at 경과를 관찰한 세션이 rollover 신호·시간 경과만 근거로 edit_owner를 자체 지정할 수 있는 경로가 문서상 열려 있다. 최신 HANDOFF 복원과 사람 인계 Decision 소비 없이 권한을 얻으면 lease 탈취와 경쟁 편집 권위가 생겨 단일 권위 계약과 충돌한다.
- 근거: docs/AI-지식-온톨로지-기획안.md:300, docs/AI-지식-온톨로지-기획안.md:270, docs/ai-review/evidence/AI-PLANS-V02-FABLE-COMPACT-EVIDENCE.md:56, docs/ai-review/evidence/AI-PLANS-V02-FABLE-COMPACT-EVIDENCE.md:52
- 완료 조건: §6.4에 lease 만료·부재 시에도 신호·경과 시간만으로 소유권을 얻지 못한다는 조항이 추가된다. / successor의 edit_owner 인수 전제(최신 유효 HANDOFF 복원 + 팀 구성안 §11 queue ledger lock 계약 + 사람 인계 Decision 소비)가 명시되거나 해당 계약이 팀 구성안 §11로 명시적으로 위임된다.
- 필요한 테스트: 시뮬레이션 fixture: 만료 lease를 신호만으로 인수 시도 시 거부 / 시뮬레이션 fixture: 인계 Decision 미소비 successor의 lease 획득 거부

### ONT-003-HANDOFF-MUTABLE-STORE — Major / OPEN

- 범주: DATA_INTEGRITY
- 영향: 검수 레인 HANDOFF는 append-only 턴으로 보호되지만 일반 Task HANDOFF는 가변 작업큐 안에 있어, 더 최신 HANDOFF를 편집·삭제한 뒤 stale snapshot을 최신으로 제시해도 §6.4-3 검사가 이를 탐지할 근거가 없다. append-only 감사 불변식이 HANDOFF 노드 종류에서 깨진다.
- 근거: docs/AI-지식-온톨로지-기획안.md:96, docs/AI-지식-온톨로지-기획안.md:83, docs/AI-지식-온톨로지-기획안.md:520, docs/AI-지식-온톨로지-기획안.md:302
- 완료 조건: 물리 저장 형식 확정 전에도 발행된 HANDOFF 기록을 append-only로 보존하고 수정·삭제 대신 더 높은 판본의 새 HANDOFF로만 대체한다는 계약이 §3에 추가된다. / 가변 작업큐 본문에는 최신 HANDOFF 참조·hash만 두고 봉인된 snapshot 원본은 불변 기록 위치에 남긴다는 저장 원칙이 명시된다.
- 필요한 테스트: docs-graph-check fixture: HANDOFF 체인에서 기존 기록 수정·삭제 탐지 / 시뮬레이션 fixture: HANDOFF 발행 후 snapshot 변조 시 복원 거부(기존 55행 fixture의 문서 계약 결속 확인)

## 공동 편집 제안

### EDIT-ONT-HANDOFF-VERSION — REPLACE

- 대상: `docs/AI-지식-온톨로지-기획안.md`
- 위치: `handoff_id`, `task_id`, 비식별 predecessor/successor reference, 생성 시각, source commit SHA,
- 연결 Finding: ONT-003-HANDOFF-VERSION-GAP
- 이유: 동일·낮은 판본 거부(§6.4-3·§11-14)가 비교할 단조 판본 필드를 HANDOFF 최소 계약에 추가한다.

    `handoff_id`, `task_id`, Task별로 1부터 단조 증가하는 정수 `handoff_version`, 비식별 predecessor/successor reference, 생성 시각, source commit SHA,

### EDIT-ONT-HANDOFF-IMMUTABLE — ADD

- 대상: `docs/AI-지식-온톨로지-기획안.md`
- 위치: 확정하지 않으며, successor는 아래 §6.4 순서로 원 권위를 다시 확인한다.
- 연결 Finding: ONT-003-HANDOFF-VERSION-GAP, ONT-003-HANDOFF-MUTABLE-STORE
- 이유: 판본 비교 의미를 확정하고 일반 Task HANDOFF에 append-only 보존·분기 처리 계약을 부여해 stale 복원 검사의 근거 데이터를 불변으로 만든다.

    §6.4·§11의 `동일·낮은 판본` 판정은 생성 시각 비교가 아니라 같은 Task의 `handoff_version` 정수 비교로만 한다. 같은 predecessor에서 두 HANDOFF가 분기하면 더 높은 판본을 발행하기 전에 사람 결정으로 하나만 유효화한다. 발행된 HANDOFF 기록은 물리 저장 형식이 확정되기 전에도 append-only로 보존하며, 수정·삭제 대신 더 높은 `handoff_version`의 새 HANDOFF로만 대체한다. 가변 장부인 `docs/작업큐.md` 본문에는 최신 HANDOFF 참조와 hash만 두고, 봉인된 snapshot 원본은 불변 기록 위치에 남긴다.

### EDIT-ONT-LEASE-TAKEOVER — REPLACE

- 대상: `docs/AI-지식-온톨로지-기획안.md`
- 위치:    유효하면 상태·인계 요청만 남기고 `stop_conditions`를 발동한다.
- 연결 Finding: ONT-003-LEASE-TAKEOVER-GAP
- 이유: 만료 lease 인수 경로를 닫아 신호만으로 권한을 얻는 lease 탈취 반례를 문서 계약 수준에서 차단하고 fixture 단언(증거 52·56행)과 명세를 일치시킨다.

       유효하면 상태·인계 요청만 남기고 `stop_conditions`를 발동한다. lease가 만료됐거나 비어 있어도 rollover
       신호·경과 시간만으로 소유권을 얻지 않는다. successor는 최신 유효 HANDOFF를 복원하고 팀 구성안 §11의
       전역 queue ledger lock 계약에 따라 사람 인계 Decision을 소비한 뒤에만 `edit_owner`·`owner_session_ref`·
       `lease_expires_at`을 인수한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: ONT-003-HANDOFF-VERSION-GAP, ONT-003-LEASE-TAKEOVER-GAP, ONT-003-HANDOFF-MUTABLE-STORE

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
