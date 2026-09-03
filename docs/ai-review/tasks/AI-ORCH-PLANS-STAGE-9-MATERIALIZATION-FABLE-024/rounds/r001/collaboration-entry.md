
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
