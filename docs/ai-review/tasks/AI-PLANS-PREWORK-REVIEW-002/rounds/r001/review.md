# AI-PLANS-PREWORK-REVIEW-002 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `0517f06900da6c3e7dd0ed472e10fda851978697`

## 요약

선작업 1~11을 산출물 원문 기준으로 독립 판정한 결과 11/11 PASS이며 전체 판정은 PASS다.
[1] 기준선 PASS: BASELINE §1~2가 baseline 022840a·tree 4b1f093·AGENTS blob c32214b·다섯 문서의 Git blob SHA-256을 고정하고 exact-HEAD CI 미확인을 은폐 없이 보존한다(AI-PLANS-PREWORK-BASELINE.md 8~31행).
[2] 경로 3분할 PASS: 검사기가 미분류·중복을 fail-closed로 즉시 실패시키고(scripts/ai-plan-prework-status-check.mjs 126~130행) 실행 결과 USER 57·AI 19·IN_SCOPE 0·미분류 0·중복 0이다(VERIFICATION-V3 17행).
[3] 기존 브랜치 fast-forward PASS: 새 브랜치 없이 cd5d54c→022840a ff, 전후 사용자 dirty fingerprint 차 0(BASELINE 20~21행), 사용자 지시가 DEC-AI-BRANCH-001과 작업큐 human_decisions에 기록됨(DECISIONS 9행, 작업큐 267행).
[4] 사용자 57경로 manifest PASS: USER-STATE.json의 USER_OWNED entry를 직접 계수해 정확히 57개임을 확인했고, path/status/sha256의 exact JSON 비교로 불일치 시 실패한다(스크립트 159~169행).
[5] SIM-1 lease 경계 PASS: PREWORK-1은 별도 CODEX-QA lease(작업큐 335~337행)로 SOLAR lease를 건드리지 않고, lease 변경은 out_of_scope·stop_condition이며 DEC-AI-LEASE-002는 결정 대기다(BASELINE §5).
[6] Fable 실패 원본 보존 PASS: ONTOLOGY-005 RUN_FAILED·verdict 없음의 immutable 보존과 successor 필요 명시(BASELINE 75~88행), REVIEW-001 r001 budget_exhausted를 PASS로 합성하지 않음(VERIFICATION-V3 34~36행, 작업큐 229행).
[7] patch map PASS: RC-01~08 전건이 단일 소유 후보와 CANDIDATE 상태로 매핑되고 자동 채택 금지 문구가 유지된다(PATCH-MAP 30~44행).
[8] 사람 Decision PASS: DEC-001~010 10건 전건에 질문·권고 기본값·시점·HUMAN-CHIEF 승인자·상태가 있고 자동 채택 금지 원칙이 명시된다(DECISIONS 5~18행).
[9] 기계식 완료 조건 PASS: 명령·기대 결과·증거 표(BASELINE §6)와 rename 새 경로 우선 fixture 2건 self-test(스크립트 88~113행)가 존재한다.
[10] 실행 검증 PASS: 시뮬레이션 70/70, verify --no-db는 4/6 선택 범위이며 전체 통과가 아니라는 제한, fable:check는 연결 preflight일 뿐 유효 Fable review가 아니라는 표현이 유지된다(VERIFICATION-V3 18~25행, BASELINE 108행).
[11] exact SHA 봉인 PASS: 실행 commit e96a238/tree 55a97b6과 영수증 seal commit 8d52e81의 2단계 분리 및 작업큐 binding(작업큐 271~276행). target 0517f06·tree 60495bc·AGENTS blob c32214b는 봉인 metadata와 exact 일치한다.
Opus r3(OPUS_DIRECT_ADVISORY, 대상 e96a238)는 참고만 했고 Fable 결과로 합성하지 않았다. 읽기 전용 COMMIT 스냅숏 특성상 git 조상 선형성(aa3c554→e96a238)과 8d52e81 커밋 내용 자체는 명령 재실행으로 확증하지 못했으며 봉인 해시와 작업큐 binding으로 판정했다.
Critical·Major 및 명세 필수 Finding은 0건이라 등록하지 않는다. 비차단 관찰 2건: (a) 검사기 exactInScope(14~28행)에 VERIFICATION-V3·OPUS-R3가 없어 두 파일이 미추적 상태인 워크트리에서는 --compare-user-manifest가 fail-closed로 실패한다. 안전 방향이지만 향후 영수증 개정 시 목록 갱신이 필요해 proposed_edits로 제안한다. (b) BASELINE §3의 `.claude/settings*.json` glob보다 검사기 정규식(43행)이 좁아 그 외 settings 변형은 미분류 실패로 떨어진다(역시 fail-closed). 본 PASS는 로컬 판정이며 외부 gate_state는 OPEN으로 유지되고, 본작업 전 SIM-1 lease 인계와 ONTOLOGY successor 발행은 여전히 HUMAN-CHIEF Decision/HANDOFF 전용이다.

## Findings

없음

## 공동 편집 제안

### EDIT-PREWORK-STATUSCHECK-INSCOPE-V3R3 — ADD

- 대상: `scripts/ai-plan-prework-status-check.mjs`
- 위치:   'docs/ai-review/evidence/AI-PLANS-PREWORK-VERIFICATION-V2.md',
- 연결 Finding: 없음
- 이유: exactInScope에 V3 영수증과 Opus r3 문서가 없어 두 파일이 미추적 상태인 워크트리에서는 --compare-user-manifest가 STATUS_CLASSIFICATION_FAILED로 실패한다. fail-closed라 안전하지만 향후 영수증 개정·재실행 시 기계식 조건이 자기 산출물 때문에 막히므로 IN_SCOPE 목록에 추가한다. 비차단 개선 제안이며 CODEX-QA가 통합 여부를 결정한다.

      'docs/ai-review/evidence/AI-PLANS-PREWORK-VERIFICATION-V3.md',
      'docs/ai-review/evidence/AI-PLANS-PREWORK-OPUS-R3.md',

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
