# AI-ORCH-PLANS-STAGE-9-MATERIALIZATION-FABLE-024 공동 작업 장부

> 단계 9 실행 전 물질화 순서·산출물·채팅·플러그인 경계를 검수한다. 이 Task는 계획 검수만
> 허용하며 실제 디렉터리·채팅·플러그인 생성은 승인하지 않는다. 이후 턴은 `corepack pnpm
> fable:append` 또는 검수 실행기로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `d14ce2a838e003a57983c3772fb8b3a5b730fc0a`
- changed_artifact_paths: `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md`
- 검토 범위: 단계 9의 진입 게이트, activation 전후 물질화, standalone checker, commit 경계, 11개 A0 채팅 shell, 세 전역 플러그인의 독립 결합
- 집중 검토 질문: checker→preflight→ACTIVE→manifest→chat 순서가 공식 계약과 일치하는가? Mission Relay 단일 successor/Study Gate와 상설 A0 shell이 충돌하는가? 단계 9·10 책임이 명확한가?
- 실행한 테스트·현재 증거: Project Orchestrator `MODEL_PLAN_VERIFIED`; 단계 1~7 Fable·Sol·71/71 증거를 최소 입력으로 제공한다. 실제 stage 9 물질화는 시작하지 않았다.
- 사람 결정이 필요한 항목: 필수 Finding 반영 뒤 단계 9 실행 착수와 sidebar 외부 상태 생성은 사람의 기존 승인 범위 및 정확한 Decision 기록에 결속한다.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-AI-STAGE-9-PLAN-BUDGET-024`
- soft_budget_overrun_risk_accepted: `r001@4.00`
- 결정: 사용자의 Fable 검수 요청과 기존 예산 재량 위임에 따라 단계 9 실행기획안의 1회 집중검수를 진행한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 4.00을 넘을 수 있다.
- 허용 범위: 단일 실행기획안, AGENTS, 디렉터리 기획안과 세 최소 증거의 읽기 전용 검수.
- 금지: 실제 stage 9 물질화, 실행형 플러그인 제작, 동일 회차 중복 호출, 동시 Opus 호출.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=43ef20e4e397f2892326584d88d4685194858a05abb1db1f288f3e71e96fbb28 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `43ef20e4e397f2892326584d88d4685194858a05abb1db1f288f3e71e96fbb28`
- target_commit_sha: `d14ce2a838e003a57983c3772fb8b3a5b730fc0a`
- input_files_sha256: `48bce84b59d3d9cb17578dc62f3320a06717074d69cf8a41f2a4f44f5d5d49fa`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: FAB-ARCH-024-PREFLIGHT-MANIFEST-WINDOW-001, FAB-ARCH-024-CHAT-SHELL-DECISION-SCOPE-002, FAB-ARCH-024-RISKS-PATH-OWNER-003
- 선택 미종결 Finding: FAB-ARCH-024-STAGE10-STEP-PIN-004
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

단계 9 실행기획안 초회 검수 결과 CHANGES_REQUIRED. 전반 구조(checker→preflight→원자 ACTIVE→구현→chat 순서, 사용자 소유 변경 제외, 11개 A0 shell 비권위, 세 전역 플러그인 독립 결합, Fable 독립성·운영 Go/No-Go 보존, 단계 10 verify 연결 분리)는 다섯 기획안 계약과 대체로 일치한다. 필수 Finding 3건: (1) Major — RELEASE_GATE·역할/팀 manifest·handoffs 골격을 activation 이후 9.5 구현 commit으로 미룬 분할이 디렉터리 기획안 §11 단계 2의 "materialization preflight가 한 번에 만든다"(사람 activation Decision 이후·activation commit 이전 창) 계약과 §5.1 필수 중앙 노드 요구를 재정의하며, activation commit SHA에서 §10 "필수 manifest 누락 0" 검사와 자기모순을 만든다. (2) Major — 9.6의 Codex 앱 외부 상태(두 sidebar section·11개 채팅 shell) 생성이 봉인 model plan 단계 9 책임("팀별 디렉터리와 MD 파일 생성·내용 삽입") 밖이고, §3.1 Decision 기록 스펙과 S9-G01 통과 기준이 다섯 문서 hash만 결속해 공동 장부가 명시한 "sidebar 외부 상태 생성은 사람의 승인 범위·정확한 Decision 기록에 결속" 조건이 계획에 구현되지 않았다. (3) Minor — `docs/team/RISKS.md`는 디렉터리 기획안 §4.2 트리·§5.1 중앙 노드·§11 단계 2 preflight 산출 어디에도 열거되지 않은 새 경로 계약이며 §2 투영 표에 공식 소유 절 인용이 없다. 개선 1건: 단계 10 소유인 verify 연결 지점(단계 ③)의 사전 확정을 완화하고 §10 검사에 플러그인 상태·판정 복제 0과 새 통합 플러그인·공용 hook 0 항목을 추가할 것. Mission Relay 단일 successor·Study Gate와 상설 A0 shell의 충돌은 없다(§7이 실제 변경을 Task Packet·edit lease·Study Gate 충족 임시 채팅으로 한정하고 다중 successor를 금지). ROLE_CONTEXTS·TEAM_LEARNING 이력 보존과 유실 시 원본 유지·별도 migration 분리(§11), 사용자 소유 변경 제외(S9-G05·§9·§10), Fable 실패 합성 금지도 적절하다. proposed_edits 8건 반영 뒤 재검수에서 해소 가능하다. 이 판정은 단계 9 실행 승인이 아니며 외부 게이트를 닫지 않는다.

### 공동 편집 제안 색인

- E024-01-PREFLIGHT-PARAGRAPH: REPLACE `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md` · `ROLE_CONTEXTS.md`와 `TEAM_LEARNING.md`는 이미 존재하므로 activation 전에는 파일의 새 권위를 · 원문은 review.md 참조
- E024-02-ORDER-ROW-9-2: REPLACE `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md` · | 9.2 | 기존 장부 schema 이관·Decision/Risk 초기화·route A0 등록 | preflight commit | · 원문은 review.md 참조
- E024-03-ORDER-ROW-9-5: REPLACE `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md` · | 9.5 | README·Release·role/team manifest·operations 최소 문서 생성 | implementation commit | · 원문은 review.md 참조
- E024-04-DECISION-SCOPE-BULLET: REPLACE `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md` · - 단계 8 사람 activation Decision의 exact SHA·다섯 문서 hash·시각 기록 · 원문은 review.md 참조
- E024-05-CHAT-GATE-INTRO: REPLACE `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md` · 두 Codex 사이드바 section을 만들고 아래 shell을 정확한 제목으로 생성한다. · 원문은 review.md 참조
- E024-06-RISKS-OWNER-ROW: REPLACE `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md` · | `docs/team/RISKS.md` | 미해결 위험·소유자·재검토 조건 초기화 | 위험 인스턴스만 소유 | · 원문은 review.md 참조
- E024-07-STAGE10-NEXT-ACTION: REPLACE `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md` · - 단계 10의 단일 다음 행동: checker를 기존 `pnpm verify` 단계 ③에 연결하고 분모를 바꾸지 않기 · 원문은 review.md 참조
- E024-08-PLUGIN-CHECK-BULLET: ADD `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md` · - `RELEASE_GATE`와 deployment evidence 내용 복제 0 · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `43ef20e4e397f2892326584d88d4685194858a05abb1db1f288f3e71e96fbb28`
- target_commit_sha: `d14ce2a838e003a57983c3772fb8b3a5b730fc0a`
- changed_artifact_paths: `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md`
- resulting_input_files_sha256: `PENDING_NEXT_REVIEW_MANIFEST`
- artifact_hashes: `[{"path":"docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md","sha256":"9c41ba4383ab7133d5e25575fc97cec690ae219583de359a1e288c57398a76e3","change_type":"ADDED"}]`

### FAB-ARCH-024-PREFLIGHT-MANIFEST-WINDOW-001

- disposition: `APPLIED`
- 적용 위치: §1, §2, §5.1~§5.3, §9, §10
- 적용 내용: `docs/team` 필수 중앙 노드·역할/팀 manifest·handoffs 골격을 activation 뒤로 미루지 않는다. activation 전 working tree의 단일 preflight 후보로 조립하고 planned tree 검사를 통과한 뒤 네 기획안 ACTIVE 변경과 같은 원자 commit에 포함한다. 별도 preflight commit을 금지해 `DRAFT+권위 파일`과 `ACTIVE+필수 파일 부재` 중간 commit을 모두 제거했다. activation SHA와 필수 manifest 부재 sabotage를 모두 검사 대상으로 추가했다.
- 검증: `git diff --check` 통과, Fable wrapper self-test 52개 묶음 통과
- next_review_request: `FABLE_RECHECK`

### FAB-ARCH-024-CHAT-SHELL-DECISION-SCOPE-002

- disposition: `APPLIED`
- 적용 위치: §3.1, S9-G01, §7, §11
- 적용 내용: 단계 8 Decision에 exact SHA·다섯 문서 hash뿐 아니라 두 sidebar section·11개 A0 shell이라는 Codex 앱 외부 상태 생성 범위를 명시하도록 했다. 범위가 없으면 저장소 물질화와 9.6을 각각 중단하며 자동 확대하지 않는다.
- 검증: 외부 상태 생성은 아직 실행하지 않았고 계획의 fail-closed 조건만 갱신했다.
- next_review_request: `FABLE_RECHECK`

### FAB-ARCH-024-RISKS-PATH-OWNER-003

- disposition: `APPLIED`
- 적용 위치: §2 공식 근거 투영, S9-G08, §5.1
- 적용 내용: `RISKS.md`의 소유 근거를 팀 구성안 §11·온톨로지 §3으로 명시하고, 디렉터리 기획안의 중앙 노드 목록과 같은 activation 후보에서 수렴하지 않으면 파일을 만들지 않고 공식 문서 정합화 Task로 분리하도록 실패 폐쇄했다.
- 검증: 현재 공식 문서의 경로 서술 불일치를 계획 단계에서 숨기지 않고 진입 게이트로 승격했다.
- next_review_request: `FABLE_RECHECK`

### FAB-ARCH-024-STAGE10-STEP-PIN-004

- disposition: `APPLIED`
- 적용 위치: §10, §12
- 적용 내용: checker의 `pnpm verify` 내 정확한 연결 단계는 단계 10 Task가 소유하도록 되돌리고 6단계 분모 불변만 유지했다. 플러그인 상태·판정 로직 복제 0과 새 통합 플러그인·공용 hook 0을 검사 목록에 추가했다.
- 검증: 실행기획안 version 0.2, SHA-256 `9c41ba4383ab7133d5e25575fc97cec690ae219583de359a1e288c57398a76e3`.
- next_review_request: `FABLE_RECHECK`

- 비용 상태: r001 실사용 USD 3.767027 / Task cap USD 4.00. 자동 재검수는 실행하지 않는다.
- 전체 next_review_request: `FABLE_RECHECK`
