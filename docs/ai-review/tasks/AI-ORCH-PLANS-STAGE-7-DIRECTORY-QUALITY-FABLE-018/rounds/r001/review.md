# AI-ORCH-PLANS-STAGE-7-DIRECTORY-QUALITY-FABLE-018 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `4e1d23cf31b34483f5f66ee3d7dfeaea5d315019`

## 요약

단계 7 구조 종합 감사(INITIAL, 현재 bytes)를 완료했다. 확인된 정합: (1) 권위 DAG(team→ontology→orchestration→directory→quality)는 기계 판독 블록에서 비순환·단일 소유이고 두 문서 frontmatter depends_on과 정확히 일치한다. (2) §6 관계 표는 정방향만 허용하고 탐색 링크가 DAG에 의존성을 더하지 않으며 DELEGATED_PENDING→AUTHORITY_REF 전환 계약이 방향 의미를 보존한다. (3) Finding·Learning·자율성 승격/강등은 사람 Decision·지정 독립 검증자·독립검수 게이트를 우회하지 않고, Opus advisory가 Fable 게이트를 대체하지 못하며 실패 폐쇄가 유지된다(AGENTS:fable-required-review, AI-QUALITY:human-autonomy-gate 충족). (4) 네 DRAFT 문서의 ACTIVE 승격은 사람 승인 뒤 단일 activation commit으로 제한되고 부분 ACTIVE는 거부된다. (5) 단계 6 누적 상호참조 증거(71/71 PASS)와 현재 bytes 사이에 구조 모순은 없다. 다만 두 문서 결합부에서 Minor 필수 결함 2건이 남았다. 첫째, 평가 기획안 §8이 `docs/team/DECISIONS.md`를 자율성 승격·강등 승인 이력의 단독 소유자로 지정하지만, 디렉터리 기획안의 §4.2 목표 트리, §5.1 중앙 권위 표, 단계 2 materialization preflight 생성 집합 어디에도 이 경로가 등재되지 않아 물리 경로·단일 소유권 매핑이 결손된다(ROLE_CONTEXTS.md도 §5.1 표에 권위 행이 없다). 둘째, 평가 기획안은 ACTIVE 전 기존 route 전수 등록(§8)과 TEAM_LEARNING schema 이관(§6.1)을 요구하는데, 디렉터리 기획안 단계 2는 사람 activation decision 전 docs/team/ 권위 장부 생성을 금지하므로 두 의무의 실행 창이 미정의다. 문자 그대로 실행하면 단계 8 승인 전 물질화(AI-DIRECTORY:materialization-after-approval 위반) 또는 'ACTIVE 전' 전제조건 불충족이 발생한다. 두 결함 모두 문장 단위 수정으로 해소 가능하며 proposed_edits 4건을 제안한다. verdict=CHANGES_REQUIRED이고, 본 검수는 로컬 판정일 뿐 gate_state=OPEN은 유지된다.

## Findings

### FAB-ARCH-018-TEAM-DECISIONS-PATH-001 — Minor / OPEN

- 범주: ARCHITECTURE
- 영향: 단계 8 승인 뒤 materialization preflight가 디렉터리 기획안 트리대로 실행되면 사람 자율성 게이트의 승격·강등 승인 이력 장부가 생성 집합·중앙 권위 표에 없어, 승인 이력의 물리적 단일 소유 경로가 미정의가 되거나 단일 소유권·경로 존재 검사가 평가 기획안의 참조를 매핑하지 못한다. 두 문서의 물리 경로 결합 요구(requirement 1)를 충족하지 못한다.
- 근거: docs/AI-품질-학습-자율성-평가기획안.md:412, docs/디렉터리-문서신경망-재설계-기획안.md:116, docs/디렉터리-문서신경망-재설계-기획안.md:151, docs/디렉터리-문서신경망-재설계-기획안.md:403
- 완료 조건: 디렉터리 기획안 §4.2 docs/team/ 트리에 DECISIONS.md가 등재된다. / §5.1 중앙 권위 표에 자율성 현재 단계 장부(docs/team/ROLE_CONTEXTS.md)와 승격·강등 승인 이력(docs/team/DECISIONS.md) 행이 추가되어 평가 기획안 §8의 경로·소유권 주장과 일치한다. / 단계 2 materialization preflight 생성 집합에 두 장부가 포함됨이 문서상 확인된다.
- 필요한 테스트: 문서 그래프 검사기: 평가 기획안이 참조하는 docs/team/* 권위 경로가 디렉터리 기획안 목표 트리와 §5.1 표에 모두 존재하는지 교차 검사 / 사보타주: 트리 또는 §5.1 표에서 DECISIONS.md 행을 제거하면 경로 교차 검사가 실패해야 함

### FAB-ARCH-018-PRE-ACTIVE-ORDER-002 — Minor / OPEN

- 범주: ARCHITECTURE
- 영향: ACTIVE 전 의무(route 전수 등록, TEAM_LEARNING schema 이관)의 실행 창이 두 문서 어디에도 고정되지 않아, 문자 그대로 수행하면 사람 단계 8 승인 전 docs/team/ 장부 물질화로 materialization-after-approval을 위반하거나, 반대로 materialization과 activation이 동시라면 'ACTIVE되기 전 전수 등록' 전제조건이 충족 불가능해진다. 등록되지 않은 자동화의 A0 강등 판정 시점도 함께 흔들려 수명주기 결합 요구(requirement 1·4)를 해친다.
- 근거: docs/AI-품질-학습-자율성-평가기획안.md:412, docs/AI-품질-학습-자율성-평가기획안.md:338, docs/디렉터리-문서신경망-재설계-기획안.md:403, docs/디렉터리-문서신경망-재설계-기획안.md:429
- 완료 조건: 두 문서가 route 전수 등록과 §6.1 schema 이관을 '사람 activation decision 이후, activation commit 이전'의 materialization preflight 창으로 동일하게 고정한다. / 사람의 단계 8 승인 전 docs/team/ 장부 신규 생성 금지가 두 문서에서 모순 없이 유지된다. / 이미 존재하는 TEAM_LEARNING.md schema 이관 Task의 실행 시점이 같은 창의 봉인된 별도 Task로 명시된다.
- 필요한 테스트: 사보타주: 사람 activation decision 기록 없이 ROLE_CONTEXTS.md 또는 DECISIONS.md를 생성하면 preflight/물질화 검사가 실패해야 함 / 사보타주: activation commit 시점에 route 전수 등록이 비어 있으면 부분 ACTIVE 거부 검사가 실패로 잡아야 함

## 공동 편집 제안

### EDIT-018-DIR-TREE-DECISIONS-001 — ADD

- 대상: `docs/디렉터리-문서신경망-재설계-기획안.md`
- 위치: │  ├─ ROLE_CONTEXTS.md                활성 역할 컨텍스트 판본·hash 장부
- 연결 Finding: FAB-ARCH-018-TEAM-DECISIONS-PATH-001
- 이유: 평가 기획안 §8이 단독 소유자로 지정한 docs/team/DECISIONS.md를 디렉터리 기획안 목표 트리에 등재해 materialization 집합의 결손을 제거한다.

    │  ├─ DECISIONS.md                    자율성 승격·강등 승인 이력 장부(평가 기획안 §8)

### EDIT-018-DIR-AUTHORITY-TABLE-002 — ADD

- 대상: `docs/디렉터리-문서신경망-재설계-기획안.md`
- 위치: | Learning 인스턴스 단일 장부 | `docs/team/TEAM_LEARNING.md` |
- 연결 Finding: FAB-ARCH-018-TEAM-DECISIONS-PATH-001
- 이유: §5.1 중앙 권위 표에 두 장부의 단일 소유권 행을 추가해 평가 기획안 §8의 권위 주장과 경로 매핑을 일치시킨다.

    | 자율성 현재 단계 장부 | `docs/team/ROLE_CONTEXTS.md` |
    | 자율성 승격·강등 승인 이력 | `docs/team/DECISIONS.md` |

### EDIT-018-DIR-PREFLIGHT-WINDOW-003 — ADD

- 대상: `docs/디렉터리-문서신경망-재설계-기획안.md`
- 위치:   않는다. 누적 외부 교차검수와 사람 activation decision 뒤 materialization preflight가 한 번에 만든다.
- 연결 Finding: FAB-ARCH-018-PRE-ACTIVE-ORDER-002, FAB-ARCH-018-TEAM-DECISIONS-PATH-001
- 이유: ACTIVE 전 의무의 실행 창을 preflight(사람 결정 이후, activation commit 이전)로 고정해 승인 전 물질화 위반과 'ACTIVE 전' 조건 불충족의 모순을 동시에 해소한다.

    - materialization preflight는 사람 activation decision 이후·네 문서 activation commit 이전 창에서만 실행하며, 평가 기획안 §6.1의 TEAM_LEARNING schema 이관 완료 확인과 §8의 기존 route 전수 등록(ROLE_CONTEXTS·DECISIONS 초기 장부 생성 포함)을 같은 preflight 산출로 처리한다. 이 의무를 이유로 사람의 단계 8 승인 전에 `docs/team/` 권위 장부를 만들지 않는다.

### EDIT-018-QUALITY-PREACTIVE-WINDOW-004 — ADD

- 대상: `docs/AI-품질-학습-자율성-평가기획안.md`
- 위치: 자동화는 A0으로 강등한다.
- 연결 Finding: FAB-ARCH-018-PRE-ACTIVE-ORDER-002
- 이유: 평가 기획안 쪽에서도 동일한 실행 창을 명시해 두 문서의 수명주기 계약을 대칭으로 고정한다.

    기존 route 전수 등록과 §6.1의 schema 이관은 디렉터리 기획안 단계 2의 materialization preflight 창(사람 activation decision 이후, 네 문서 activation commit 이전)에서 수행한다. 이 등록·이관을 이유로 사람의 단계 8 승인 전에 `docs/team/` 장부를 새로 만들지 않으며, 이미 존재하는 장부의 schema 이관도 같은 창의 봉인된 별도 Task로 실행한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: FAB-ARCH-018-TEAM-DECISIONS-PATH-001, FAB-ARCH-018-PRE-ACTIVE-ORDER-002

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
