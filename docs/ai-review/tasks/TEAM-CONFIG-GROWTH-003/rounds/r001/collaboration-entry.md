
<!-- fable-review:r001 sha256=7347ff79f0bd4b1cd03ed59db96198bbd2c46fd383137c7c8268aa697c3727f6 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `7347ff79f0bd4b1cd03ed59db96198bbd2c46fd383137c7c8268aa697c3727f6`
- target_commit_sha: `330df4d0f99d386133d4edec4c79fccc34bc4a5b`
- input_files_sha256: `077ee1acc3b0d523dbb6c02c3f880937e4b43691e3f4a69820f693a69a841f22`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: TCG3-ARCH-001, TCG3-ARCH-002, TCG3-ARCH-003, TCG3-ARCH-004, TCG3-ARCH-005, TCG3-ARCH-006
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

세 공식 문서는 소진 allowlist/denylist 경계, 동일 baseline·target 유지, predecessor 장부 bytes/hash·handoff turn/entry/run hash·handoff 전용 source commit 봉인, INITIAL/RECHECK의 registry 승계 의미, 원 reviewer role 기반 검증 권한과 verified_by_engine, TEAM_LEARNING 수명주기와 protocol 1.2 미구현 상태를 대체로 일관되게 기술한다. 실행기(scripts/fable-review.mjs)와 schema에 fallback_*·learning·engine 필드가 실제로 없고 문서도 이를 구현 전 계약으로 표기해 현재 지원 상태와 정책이 분리된 점, CLI allowlist 2.1.248/250이 실행기와 일치하는 점을 확인했다. 그러나 다음 모순·누락이 남아 CHANGES_REQUIRED다. (1) 팀구성 §4.4 규칙 11이 anchor commit 전에 필수 Finding CLOSED를 요구해 README §9의 CLOSED 순서(decision commit 보호 체크 성공 뒤)와 순환 모순. (2) 소진 successor 입력 범위(RECHECK=장부 전체, INITIAL=SOLAR_REQUEST까지)가 route를 구분하지 않아 FABLE-FINAL 클린룸(README §11)과 실행기의 FINAL_INDEPENDENT 장부 미전송 동작과 충돌. (3) 작업큐 AI-REVIEW-2·TEAM-LEARNING-1 완료 조건에 successor 입력 범위 자체시험, protocol 1.1의 AI_DEPUTY_FALLBACK_HANDOFF 거부/1.2 수용 시험, FABLE-FINAL SOLAR_REQUEST Learning ID 실패 폐쇄 시험이 빠짐. (4) SECURITY/FINAL route에 INITIAL·RECHECK를 회차 명칭으로 계속 사용하는 문구와 FABLE-SEC 첫 회차 입력 범위 서술 불일치. (5) Opus 불가·비승계 오류 결과를 BLOCKED로 표기하나 BLOCKED는 모델 verdict이고 run_state 값이 아님. (6) protocol 1.2·결과 schema 승격의 소유 Task와 두 작업 간 순서가 미정의. 모두 문서 수정으로 해소 가능하며 proposed_edits를 첨부한다.

### 공동 편집 제안 색인

- TCG3-EDIT-001: REPLACE `docs/팀구성_상세기획안.md` · 11. AI 부 O는 모든 필수 finding의 `CLOSED`, 정확한 판본의 실행 검증 통과와 미해결 제안의 분리를 확인한 뒤, 마지막 review/run/장부/공식 산출물을 anchor commit에 고정하고 이를 참조하는 `AI_DEPUTY_GATE_DECISION` 턴을 별도 decision commit으로 발행한다. · 원문은 review.md 참조
- TCG3-EDIT-002: REPLACE `docs/ai-review/README.md` · `RECHECK` successor는 봉인된 predecessor 장부 전체를 읽기 전용 입력으로 받고, 성공 회차가 없는 · 원문은 review.md 참조
- TCG3-EDIT-003: ADD `docs/작업큐.md` ·   reviewer role·동일 target·첫 회차 소진 `INITIAL`·성공 회차 뒤 `RECHECK`를 자체시험이 검증한다. · 원문은 review.md 참조
- TCG3-EDIT-004: ADD `docs/작업큐.md` ·   실패 폐쇄함을 자체시험이 검증한다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
