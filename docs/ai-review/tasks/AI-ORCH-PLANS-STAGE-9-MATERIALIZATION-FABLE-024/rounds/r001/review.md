# AI-ORCH-PLANS-STAGE-9-MATERIALIZATION-FABLE-024 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `d14ce2a838e003a57983c3772fb8b3a5b730fc0a`

## 요약

단계 9 실행기획안 초회 검수 결과 CHANGES_REQUIRED. 전반 구조(checker→preflight→원자 ACTIVE→구현→chat 순서, 사용자 소유 변경 제외, 11개 A0 shell 비권위, 세 전역 플러그인 독립 결합, Fable 독립성·운영 Go/No-Go 보존, 단계 10 verify 연결 분리)는 다섯 기획안 계약과 대체로 일치한다. 필수 Finding 3건: (1) Major — RELEASE_GATE·역할/팀 manifest·handoffs 골격을 activation 이후 9.5 구현 commit으로 미룬 분할이 디렉터리 기획안 §11 단계 2의 "materialization preflight가 한 번에 만든다"(사람 activation Decision 이후·activation commit 이전 창) 계약과 §5.1 필수 중앙 노드 요구를 재정의하며, activation commit SHA에서 §10 "필수 manifest 누락 0" 검사와 자기모순을 만든다. (2) Major — 9.6의 Codex 앱 외부 상태(두 sidebar section·11개 채팅 shell) 생성이 봉인 model plan 단계 9 책임("팀별 디렉터리와 MD 파일 생성·내용 삽입") 밖이고, §3.1 Decision 기록 스펙과 S9-G01 통과 기준이 다섯 문서 hash만 결속해 공동 장부가 명시한 "sidebar 외부 상태 생성은 사람의 승인 범위·정확한 Decision 기록에 결속" 조건이 계획에 구현되지 않았다. (3) Minor — `docs/team/RISKS.md`는 디렉터리 기획안 §4.2 트리·§5.1 중앙 노드·§11 단계 2 preflight 산출 어디에도 열거되지 않은 새 경로 계약이며 §2 투영 표에 공식 소유 절 인용이 없다. 개선 1건: 단계 10 소유인 verify 연결 지점(단계 ③)의 사전 확정을 완화하고 §10 검사에 플러그인 상태·판정 복제 0과 새 통합 플러그인·공용 hook 0 항목을 추가할 것. Mission Relay 단일 successor·Study Gate와 상설 A0 shell의 충돌은 없다(§7이 실제 변경을 Task Packet·edit lease·Study Gate 충족 임시 채팅으로 한정하고 다중 successor를 금지). ROLE_CONTEXTS·TEAM_LEARNING 이력 보존과 유실 시 원본 유지·별도 migration 분리(§11), 사용자 소유 변경 제외(S9-G05·§9·§10), Fable 실패 합성 금지도 적절하다. proposed_edits 8건 반영 뒤 재검수에서 해소 가능하다. 이 판정은 단계 9 실행 승인이 아니며 외부 게이트를 닫지 않는다.

## Findings

### FAB-ARCH-024-PREFLIGHT-MANIFEST-WINDOW-001 — Major / OPEN

- 범주: ARCHITECTURE
- 영향: activation commit SHA에서 ACTIVE가 된 디렉터리 기획안이 요구하는 필수 중앙 노드(역할/팀 manifest·RELEASE_GATE·handoffs)가 존재하지 않는 중간 상태가 생기고, §11 단계 2의 preflight '한 번에 생성' 계약을 실행기획안이 재정의한다. 이는 '기존 계약을 실행 순서로만 투영한다'는 본 Task 요구를 위반하며, §10의 '필수 manifest 누락 0' 검사와 자기모순이라 activation 직후 checker가 실패하거나 검사를 느슨하게 해석할 위험을 만든다.
- 근거: docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md:57, docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md:239, docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md:257, docs/디렉터리-문서신경망-재설계-기획안.md:409, docs/디렉터리-문서신경망-재설계-기획안.md:152, docs/디렉터리-문서신경망-재설계-기획안.md:434
- 완료 조건: 역할/팀 manifest·RELEASE_GATE·handoffs 골격의 생성 시점이 디렉터리 기획안 §11 단계 2의 preflight 창(사람 activation Decision 이후·activation commit 이전)과 일치하도록 §2·§5·§9가 수정되거나, 분할을 허용하는 공식 문서 개정과 사람 Decision이 exact 절 인용과 함께 계획에 기록된다. / activation commit SHA에서 §10 '필수 manifest 누락 0'·'ROLE_CONTEXT version/hash 존재' 검사와 실제 산출물 존재 상태가 모순되지 않음을 계획이 명시한다.
- 필요한 테스트: planned tree와 activation commit SHA 각각에서 standalone graph checker가 통과하는 stage 9 증거 제출 / 필수 manifest 부재 상태의 activation SHA에서 checker가 실패하는 사보타주 케이스

### FAB-ARCH-024-CHAT-SHELL-DECISION-SCOPE-002 — Major / OPEN

- 범주: POLICY
- 영향: 단계 8 Decision이 다섯 문서 hash만 결속하면, Codex 앱 sidebar section·11개 채팅 shell이라는 저장소 밖의 되돌리기 어려운 외부 상태가 사람 승인 범위의 명시 없이 생성될 수 있다. 봉인 model plan 단계 9 범위가 저장소 내부 물질화에 한정돼 있어 외부 상태 생성 근거가 이 계획 문서에만 존재하며, 사람 Decision 우회 금지 요구와 공동 장부의 결속 조건이 게이트로 강제되지 않는다.
- 근거: docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md:66, docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md:87, docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md:195, .codex/mission-relay/model-plan.json:569, COLLABORATION_LOG:0
- 완료 조건: §3.1 Decision 기록 스펙과 S9-G01(또는 신설 게이트) 통과 기준에 두 sidebar section·11개 A0 shell 등 Codex 앱 외부 상태 생성 허용 범위가 명시된다. / 봉인 model plan 단계 9 범위와 채팅 물질화의 관계(같은 단계에 포함되는 공식 근거 또는 별도 사람 승인 필요)가 계획에 기록되고, 범위 미기재 시 9.6을 실행하지 않는 중단 규칙이 추가된다.
- 필요한 테스트: Decision 기록에 외부 상태 범위 문구가 없을 때 9.6이 중단되는 게이트 동작을 stage 9 증거로 제출

### FAB-ARCH-024-RISKS-PATH-OWNER-003 — Minor / OPEN

- 범주: POLICY
- 영향: `docs/team/RISKS.md`는 검수 입력으로 제공된 공식 문서 어디에도 파일 경로로 정의되지 않은 새 경로 계약이며, preflight 산출 열거 범위도 초과한다. '기존 다섯 기획안의 경로 계약을 새로 정의하지 않는다'는 본 Task 요구와 충돌하고, 소유 절 인용 없이 물질화되면 권위 중복·고아 노드 위험이 생긴다.
- 근거: docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md:103, docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md:127, docs/디렉터리-문서신경망-재설계-기획안.md:116, docs/디렉터리-문서신경망-재설계-기획안.md:411
- 완료 조건: RISKS.md의 공식 소유 문서·절(예: 팀 구성안 또는 품질 기획안의 해당 절)이 §2 투영 표에 정확히 인용되거나, RISKS.md가 stage 9 preflight 산출물에서 제외되고 소유 문서의 별도 Task로 이관된다.
- 필요한 테스트: standalone checker의 중앙 권위 목록에서 RISKS.md 소유 근거 존재를 확인하는 검사

### FAB-ARCH-024-STAGE10-STEP-PIN-004 — Improvement / OPEN

- 범주: ARCHITECTURE
- 영향: 단계 9 문서가 단계 10 소유인 verify 연결 지점(단계 ③)을 사전 확정해 경계가 흐려지고, §10 검사 목록에 플러그인 복제 0·통합 플러그인 0 검사가 빠져 §8 금지 계약의 탐지 근거가 수동 확인에만 의존한다. 비차단 개선 사항.
- 근거: docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md:290, .codex/mission-relay/model-plan.json:585, docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md:253
- 완료 조건: §12에서 verify 연결의 정확한 하위 단계 선택을 단계 10 Task 소유로 표기하고 6단계 분모 불변만 계약으로 남긴다. / §10 검사 목록에 'role/team manifest의 플러그인 상태·판정 알고리즘 복제 0'과 '새 통합 플러그인·공용 실행 hook 0' 항목을 추가한다.
- 필요한 테스트: 없음

## 공동 편집 제안

### E024-01-PREFLIGHT-PARAGRAPH — REPLACE

- 대상: `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md`
- 위치: `ROLE_CONTEXTS.md`와 `TEAM_LEARNING.md`는 이미 존재하므로 activation 전에는 파일의 새 권위를
- 연결 Finding: FAB-ARCH-024-PREFLIGHT-MANIFEST-WINDOW-001
- 이유: manifest·RELEASE_GATE·handoffs 생성 시점을 디렉터리 기획안 §11 단계 2 preflight 계약과 일치시키고 activation SHA에서의 필수 노드 부재를 제거한다.

    `ROLE_CONTEXTS.md`와 `TEAM_LEARNING.md`는 이미 존재하므로 activation 전에는 파일의 새 권위를 발행하는 대신 schema 이관·과거 항목 보존·기존 route A0 등록만 수행한다. 디렉터리 기획안 §11 단계 2의 preflight 계약에 따라 `docs/team/README.md`·`RELEASE_GATE.md`·역할/팀 manifest·`handoffs/README.md`도 같은 materialization preflight 창(사람 activation Decision 이후·activation commit 이전)에서 한 번에 만들어, activation commit SHA에서 디렉터리 기획안 §5.1 필수 중앙 노드가 모두 존재하게 한다. 첫 일반 HANDOFF 원본만 단계 11 파일럿 Task에서 생성한다. 단계 10은 9단계에서 독립 실행으로 사용한 checker를 `pnpm verify`에 연결하는 작업만 소유한다.

### E024-02-ORDER-ROW-9-2 — REPLACE

- 대상: `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md`
- 위치: | 9.2 | 기존 장부 schema 이관·Decision/Risk 초기화·route A0 등록 | preflight commit |
- 연결 Finding: FAB-ARCH-024-PREFLIGHT-MANIFEST-WINDOW-001
- 이유: preflight commit이 디렉터리 기획안 §11 단계 2가 '한 번에' 요구하는 산출물 전부를 포함하도록 실행 순서 표를 정합화한다.

    | 9.2 | 기존 장부 schema 이관·route A0 등록·`docs/team` README/RELEASE_GATE·역할/팀 manifest·handoffs 골격 생성 | preflight commit |

### E024-03-ORDER-ROW-9-5 — REPLACE

- 대상: `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md`
- 위치: | 9.5 | README·Release·role/team manifest·operations 최소 문서 생성 | implementation commit |
- 연결 Finding: FAB-ARCH-024-PREFLIGHT-MANIFEST-WINDOW-001
- 이유: activation 이후 commit의 범위를 §5.1 필수 중앙 노드가 아닌 항목으로 좁혀 9.2와의 책임 중복·모순을 제거한다.

    | 9.5 | `docs/operations` 최소 문서 생성과 preflight 산출물의 잔여 링크 보정 | implementation commit |

### E024-04-DECISION-SCOPE-BULLET — REPLACE

- 대상: `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md`
- 위치: - 단계 8 사람 activation Decision의 exact SHA·다섯 문서 hash·시각 기록
- 연결 Finding: FAB-ARCH-024-CHAT-SHELL-DECISION-SCOPE-002
- 이유: 공동 장부가 요구한 '외부 상태 생성의 사람 승인 범위·Decision 결속'을 Decision 기록 스펙에 구현한다.

    - 단계 8 사람 activation Decision의 exact SHA·다섯 문서 hash·시각과, 두 sidebar section·11개 A0 채팅 shell 등 Codex 앱 외부 상태 생성 허용 범위의 명시 기록

### E024-05-CHAT-GATE-INTRO — REPLACE

- 대상: `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md`
- 위치: 두 Codex 사이드바 section을 만들고 아래 shell을 정확한 제목으로 생성한다.
- 연결 Finding: FAB-ARCH-024-CHAT-SHELL-DECISION-SCOPE-002
- 이유: 외부 상태 생성을 Decision 범위 명시에 결속해 사람 승인 우회 가능성을 게이트로 차단한다.

    9.0에서 기록된 activation Decision이 sidebar 외부 상태(두 section·11개 shell) 생성 범위를 명시한 경우에만 두 Codex 사이드바 section을 만들고 아래 shell을 정확한 제목으로 생성한다. 이 범위가 Decision에 없으면 9.6을 실행하지 않고 사람 결정을 요청한다.

### E024-06-RISKS-OWNER-ROW — REPLACE

- 대상: `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md`
- 위치: | `docs/team/RISKS.md` | 미해결 위험·소유자·재검토 조건 초기화 | 위험 인스턴스만 소유 |
- 연결 Finding: FAB-ARCH-024-RISKS-PATH-OWNER-003
- 이유: 다섯 기획안에 정의되지 않은 새 경로 계약이 소유 근거 없이 물질화되는 것을 막는다.

    | `docs/team/RISKS.md` | 공식 소유 절(팀 구성안 또는 품질 기획안)의 정확한 인용을 §2 표에 추가한 뒤에만 미해결 위험·소유자·재검토 조건 초기화; 인용을 확정하지 못하면 preflight 산출에서 제외하고 소유 문서의 별도 Task로 이관 | 위험 인스턴스만 소유 |

### E024-07-STAGE10-NEXT-ACTION — REPLACE

- 대상: `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md`
- 위치: - 단계 10의 단일 다음 행동: checker를 기존 `pnpm verify` 단계 ③에 연결하고 분모를 바꾸지 않기
- 연결 Finding: FAB-ARCH-024-STAGE10-STEP-PIN-004
- 이유: 봉인 model plan이 단계 10에 부여한 verify 연결 소유권을 침범하지 않도록 하위 단계 사전 확정을 완화한다.

    - 단계 10의 단일 다음 행동: checker를 기존 `pnpm verify`에 연결하되 6단계 분모를 바꾸지 않기; 정확한 연결 단계 선택은 단계 10 Task가 소유

### E024-08-PLUGIN-CHECK-BULLET — ADD

- 대상: `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md`
- 위치: - `RELEASE_GATE`와 deployment evidence 내용 복제 0
- 연결 Finding: FAB-ARCH-024-STAGE10-STEP-PIN-004
- 이유: §8 플러그인 결합 금지 계약을 §10의 기계 검증 항목으로 추가해 적용 누락을 탐지 가능하게 한다.

    - role/team manifest의 플러그인 상태·판정 알고리즘 복제 0과 새 통합 플러그인·공용 실행 hook 0

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: FAB-ARCH-024-PREFLIGHT-MANIFEST-WINDOW-001, FAB-ARCH-024-CHAT-SHELL-DECISION-SCOPE-002, FAB-ARCH-024-RISKS-PATH-OWNER-003

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
