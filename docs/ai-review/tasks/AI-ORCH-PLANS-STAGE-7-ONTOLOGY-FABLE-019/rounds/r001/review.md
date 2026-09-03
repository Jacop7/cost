# AI-ORCH-PLANS-STAGE-7-ONTOLOGY-FABLE-019 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `4e1d23cf31b34483f5f66ee3d7dfeaea5d315019`

## 요약

단계 7 온톨로지 문서(sha256 d6b82bef…, 551줄)를 노드·관계·권위·HANDOFF 축으로 감사했다. (1) 권위 계층: §5(169–173행)가 우선순위 재정의 없이 팀 구성안 §0에 위임하고, §11 항목 12(482–483행)가 verify 6단계 분모와 보호 원격 게이트 계약을 보존하며, ADVISORY_REVIEW(92행)가 공식 Fable 게이트 종결 불가로 명시돼 AGENTS 계약과 모순이 없다. (2) NORMALIZES(정규화→원시 입력)·ROUTES_TO(정규화→Task)·HANDOFF_TO의 방향과 REQUEST_INPUT·NORMALIZED_REQUEST·TASK·DECISION·FINDING의 단일 소유 위치는 명확하다. 다만 HANDOFF는 §3 표(96행)가 docs/작업큐.md의 Task snapshot을 권위 위치로 적는 반면, 본문(118–122행)은 물질화 뒤 봉인 원본의 단일 위치를 docs/team/handoffs/<TASK-ID>/*.md로 규정하고 작업큐를 pointer 전용 가변 장부로 정의해 이중 서술이며, 물질화 전 append-only 봉인 원본의 보존 위치가 미지정이라 §11 항목 14·15의 content hash·계보 검사 대상이 결정되지 않는다(Minor FAB-ARCH-019-HANDOFF-LOCATION-001, OPEN). (3) 162–165행이 탐색 참조의 순환 허용과 OWNS·DEPENDS_ON 권위 DAG 비순환을 서로 다른 단언으로 분리해 혼동이 없다. (4) 112–116행이 같은 predecessor 분기의 발행 거부와 사람 Decision 계보 선택 뒤 상위 판본 재발행을, §6.4 복원 검사 2·3단계(319–326행)가 rollover 신호·경과 시간만의 소유권 획득 거부와 동일·낮은 handoff_version 실행 거부(Task별 정수 비교, 생성 시각 배제)를 명시한다. (5) front matter DRAFT(4행), 권위 미위임 선언(23–24행), ACTIVE 이후에만 물질화(124–126행), 승인 전 AGENTS 권위 목록 등재 금지(550–551행)로 사람 단계 8 승인 전 DRAFT·물질화 금지 경계가 보존된다. 비차단 개선 2건: authority 허용 값 목록 미정의와 자체 front matter(5행)·§8.2 예시(391행)의 형식 불일치, §10 수명주기 다이어그램(449–453행)의 CONFIRMED 진입 경로 부재와 '승인 전 DRAFT' 문구(455행)·REVIEWED 상태(392행)의 긴장. Minor 1건이 미해결이므로 verdict는 CHANGES_REQUIRED이며 표 정정·물질화 전 보존 위치 규정·§14 등재의 proposed_edits를 제공했다. 이 판정은 로컬 검수이며 외부 게이트 종결이 아니다.

## Findings

### FAB-ARCH-019-HANDOFF-LOCATION-001 — Minor / OPEN

- 범주: ARCHITECTURE
- 영향: 동일 노드 종류(일반 Task HANDOFF)의 봉인 원본 소유 위치가 §3 표와 본문에서 다르게 읽혀 단일 소유권 요구를 훼손하고, 물질화 전 구간에는 append-only 원본의 위치 자체가 미지정이라 §11 항목 14·15의 content hash·계보 검사와 §6.4 3단계의 동일·낮은 판본 거부를 기계적으로 적용할 대상이 결정되지 않는다.
- 근거: docs/AI-지식-온톨로지-기획안.md:96, docs/AI-지식-온톨로지-기획안.md:118, docs/AI-지식-온톨로지-기획안.md:486
- 완료 조건: §3 HANDOFF 표의 권위 위치가 본문의 '물질화 뒤 단일 위치 docs/team/handoffs/<TASK-ID>/*.md, 작업큐는 pointer 전용' 규정과 일치한다. / 물질화 전 일반 Task HANDOFF 봉인 원본의 append-only 보존 위치를 단일하게 지정하거나 §14 미결 구현 결정에 명시적으로 등재하고, 가변 장부인 docs/작업큐.md 본문을 봉인 원본 위치로 쓰지 않음을 명시한다. / 수정 후에도 검수 successor HANDOFF의 collaboration.md 전용 append 계약이 그대로 유지된다.
- 필요한 테스트: docs-graph-check 사보타주 fixture: HANDOFF 원본 위치가 표·본문에서 갈리거나 가변 장부를 봉인 원본 위치로 선언한 문서를 거부 / 물질화 전·후 HANDOFF 원본의 content hash·append-only 계보 검사가 단일 위치를 해석해 동일·낮은 판본과 기존 판본 수정·삭제를 거부하는 시험

### FAB-ARCH-019-AUTHORITY-VOCAB-002 — Improvement / OPEN

- 범주: ARCHITECTURE
- 영향: §11 항목 3의 기계 검사가 요구하는 authority 허용 목록이 정의되지 않았고 본 문서 자신과 예시의 값 형식이 달라 docs-graph-check 구현 시 기준이 모호하다. 다만 405행이 DRAFT 문서를 authority 값과 무관하게 권위에서 배제하므로 현재 권위 위험은 낮아 비차단 개선으로 분류한다.
- 근거: docs/AI-지식-온톨로지-기획안.md:5, docs/AI-지식-온톨로지-기획안.md:391, docs/AI-지식-온톨로지-기획안.md:472
- 완료 조건: authority 허용 값 목록의 정의 위치를 지정하거나 §14 미결 구현 결정에 등재한다. / 본 문서 front matter와 §8.2 예시의 authority 값이 같은 형식 규칙을 따른다.
- 필요한 테스트: docs-graph-check fixture: 허용 목록 밖 authority 값을 가진 front matter를 거부

### FAB-ARCH-019-LIFECYCLE-DIAGRAM-003 — Improvement / OPEN

- 범주: ARCHITECTURE
- 영향: 수명주기 해석이 갈릴 수 있으나 사람 승인 없이는 CONFIRMED·ACTIVE가 될 수 없다는 핵심 경계(405–408행, 457행)는 유지되므로 비차단 개선이다.
- 근거: docs/AI-지식-온톨로지-기획안.md:449, docs/AI-지식-온톨로지-기획안.md:455
- 완료 조건: 다이어그램에 CONFIRMED 진입 경로를 명시한다. / 승인 전 허용 상태(DRAFT·REVIEWED)와 CONFIRMED 진입 조건을 한 문장으로 정리해 455행 문구와 §8.2 enum의 긴장을 해소한다.
- 필요한 테스트: 없음

## 공동 편집 제안

### EDIT-019-001 — REPLACE

- 대상: `docs/AI-지식-온톨로지-기획안.md`
- 위치: | `HANDOFF` | `docs/작업큐.md`의 Task snapshot 또는 검수 `collaboration.md`의 전용 인계 턴 | 새 채팅·역할·검수 successor가 같은 Task를 복원하도록 기존 권위 상태를 봉인한 비권위 snapshot |
- 연결 Finding: FAB-ARCH-019-HANDOFF-LOCATION-001
- 이유: §3 표의 HANDOFF 소유 위치를 본문 118–122행의 물질화 뒤 단일 위치·작업큐 pointer 전용 규정과 일치시켜 이중 서술을 제거한다.

    | `HANDOFF` | 일반 Task 인계는 봉인 원본(물질화 뒤 단일 위치 `docs/team/handoffs/<TASK-ID>/*.md`, `docs/작업큐.md`는 최신 판본 pointer만 보유) · 검수 successor 인계는 검수 `collaboration.md`의 전용 인계 턴 | 새 채팅·역할·검수 successor가 같은 Task를 복원하도록 기존 권위 상태를 봉인한 비권위 snapshot |

### EDIT-019-002 — ADD

- 대상: `docs/AI-지식-온톨로지-기획안.md`
- 위치: `collaboration.md`의 전용 append 명령을 사용한다.
- 연결 Finding: FAB-ARCH-019-HANDOFF-LOCATION-001
- 이유: 물질화 전 구간의 append-only 원본 보존 위치를 규정해 §11 항목 14·15의 content hash·계보 검사 대상을 결정 가능하게 만든다.

    물질화 전에 발행되는 일반 Task HANDOFF 봉인 원본도 append-only가 보장되는 단일 보존 위치를 가져야 하며, 가변 장부인 `docs/작업큐.md` 본문은 봉인 원본 위치로 쓰지 않는다. 그 임시 보존 위치의 확정은 §14 미결 구현 결정으로 등재해 사람 승인과 함께 결정한다.

### EDIT-019-003 — ADD

- 대상: `docs/AI-지식-온톨로지-기획안.md`
- 위치: - `docs-graph-check`가 관리할 문서 ID 형식과 §3·§4 어휘를 코드로 생성하는 형식
- 연결 Finding: FAB-ARCH-019-HANDOFF-LOCATION-001, FAB-ARCH-019-AUTHORITY-VOCAB-002
- 이유: 물질화 전 HANDOFF 보존 위치와 authority 허용 목록을 §14 미결 구현 결정에 명시해 후속 확정 경로를 만든다.

    - 물질화 전 일반 Task HANDOFF 봉인 원본의 단일 임시 보존 위치
    - front matter `authority` 값의 허용 목록과 정의 위치(§11 항목 3의 검사 근거)

### EDIT-019-004 — REPLACE

- 대상: `docs/AI-지식-온톨로지-기획안.md`
- 위치: - 기획안은 사람 승인 전 `DRAFT`다.
- 연결 Finding: FAB-ARCH-019-LIFECYCLE-DIAGRAM-003
- 이유: §10 문구와 §8.2 상태 enum의 긴장을 해소하고 CONFIRMED 진입 경로를 명시한다.

    - 기획안은 사람 승인 전 `DRAFT`에서 시작하며, 교차검수를 통과하면 승인 전이라도 `REVIEWED`가 될 수 있다. `CONFIRMED`는 `REVIEWED`에서 사람 확정으로만 진입한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: FAB-ARCH-019-HANDOFF-LOCATION-001

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
