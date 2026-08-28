# TEAM-CONFIG-GROWTH-003 공동 작업 장부

> 이 장부는 앞선 두 검수의 필수 Finding 10건을 반영한 확정 문서 판본을 전체 재검수하는
> append-only 기록이다. 이후 턴은 `corepack pnpm fable:append` 또는 검수 실행기로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `330df4d0f99d386133d4edec4c79fccc34bc4a5b`
- artifact_hashes: `[{ path: docs/팀구성_상세기획안.md, sha256: c07ebc1feaf7cf2876a9a4781401ef2b562dac360b2d692c9ef20172465d903a, change_type: MODIFIED }, { path: docs/ai-review/README.md, sha256: cb2514d85395f02b541709a95c9104ab677578981b1639e9038f07fdb0697cb8, change_type: MODIFIED }, { path: docs/작업큐.md, sha256: cae75a72a7aae272dcea623f37af51fba25878b00dac246d9ba12146096f5757, change_type: MODIFIED }]`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/ai-review/README.md`, `docs/작업큐.md`
- 충족해야 할 요구사항·불변식: `TEAM-CONFIG-GROWTH-001/002 필수 Finding 10건`, `AGENTS:single-canonical-artifact`, `AI-REVIEW:immutable-rounds`, `TEAM-PLAN:evidence-based-learning-loop`
- 이번에 바꾼 내용: 보안감사 첫 회차 학습 누출을 차단하고, 소진 RECHECK가 사용할 predecessor 장부·handoff·source commit 연속성을 추가했다. INITIAL/RECHECK와 route review_mode를 구분하고 예약 턴 registry, 원 role 검증 권한, 사람 결정 대기를 작업큐까지 동기화했다.
- 집중 검토 질문: 앞선 필수 Finding 10건이 실제로 모두 해소됐는가? 세 문서에 새 모순·누락·우회 경로가 남았는가? 구현 전 정책과 현재 runner 지원 상태가 분명히 구분되는가?
- 실행한 테스트·현재 증거: `git diff --check` 통과, `corepack pnpm fable:self-test` 31개 묶음 통과. 제품 코드·DB 변경은 없어 전체 verify는 재실행하지 않았다.
- 사람 결정이 필요한 항목: Opus 정확한 model ID와 작업 전체 기본 사용 상한은 AI-REVIEW-2 구현 시 공식 CLI 확인 후 HUMAN_DECISION으로 고정한다.
- next_review_request: `FABLE_REVIEW`

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

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `7347ff79f0bd4b1cd03ed59db96198bbd2c46fd383137c7c8268aa697c3727f6`
- target_commit_sha: `ad3a7bb926da0dbb0fc1217d5af461f8c8dc6b77`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/ai-review/README.md`, `docs/작업큐.md`
- resulting_input_files_sha256: `후속 WORKING_TREE_HASHED Task에서 봉인 예정`
- artifact_hashes: `[{ path: docs/팀구성_상세기획안.md, sha256: 67a769afa8a1496b844b2a07ab264b1ea2a93ab83d55fadae2fb466b7fd8e5a6, change_type: MODIFIED }, { path: docs/ai-review/README.md, sha256: 67e47290326fc1b7e85950f401ded7d8582ee2a61ed75030fd137fbde7b7c40c, change_type: MODIFIED }, { path: docs/작업큐.md, sha256: 437831bd6d19fc036223b75ca2c27977cec43900b5b6d7e9d850ef23bcc2321d, change_type: MODIFIED }]`

### TCG3-ARCH-001
- disposition: `APPLIED`
- 적용 위치: 기획안 §4.4
- 적용 내용: anchor 선행 조건을 CLOSED가 아닌 OPEN·DISPUTED 0건(VERIFIED 허용)으로 고치고 보호 체크 뒤 최초 역할 재검수에서만 CLOSED가 되도록 상태 그림·규칙 5·6·11을 정렬했다.
- 실행한 테스트: README §9 순서 상호 대조

### TCG3-ARCH-002
- disposition: `APPLIED`
- 적용 위치: README §8, 기획안 §3.10.1·§5.5
- 적용 내용: FINAL_INDEPENDENT는 모든 successor에서 장부 미전송, 그 밖의 route는 registry 승계 시 전체 장부·미승계 시 SOLAR_REQUEST까지만 전달하도록 분리했다.
- 실행한 테스트: 문서와 runner의 FINAL_INDEPENDENT 장부 미전송 동작 대조

### TCG3-ARCH-003
- disposition: `APPLIED`
- 적용 위치: 작업큐 AI-REVIEW-2·TEAM-LEARNING-1
- 적용 내용: route별 입력, protocol 1.1 fallback handoff 거부/1.2 수용, FINAL 모든 회차 학습 누출 거부 자체시험을 추가했다.
- 실행한 테스트: 완료 조건 상호 대조

### TCG3-ARCH-004
- disposition: `APPLIED`
- 적용 위치: README §6, 기획안 §5.6, 작업큐 TEAM-LEARNING-1
- 적용 내용: r001/후속 회차와 registry 의미 INITIAL/RECHECK를 분리하고 SECURITY 공동 장부와 학습 미주입을 구분했다.
- 실행한 테스트: 용어 검색·상호 대조

### TCG3-ARCH-005
- disposition: `APPLIED`
- 적용 위치: README §8·§9, 기획안 §3.10.1, 작업큐 AI-REVIEW-2
- 적용 내용: 모델 결과 없는 오류는 review/verdict를 합성하지 않고 RUN_FAILED와 구조화된 사유로 남기며 BLOCKED는 모델 verdict에만 사용하도록 통일했다.
- 실행한 테스트: 상태 필드 문서 대조

### TCG3-ARCH-006
- disposition: `APPLIED`
- 적용 위치: README §6, 작업큐 두 작업
- 적용 내용: protocol 1.2와 결과 schema 승격 소유자를 AI-REVIEW-2로 고정하고 TEAM-LEARNING-1 의존성을 추가했다.
- 실행한 테스트: 작업 의존성·소유권 대조

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `ad3a7bb926da0dbb0fc1217d5af461f8c8dc6b77`
- verified_input_files_sha256: `후속 WORKING_TREE_HASHED Task에서 봉인 예정`
- artifact_hashes: `[{ path: docs/팀구성_상세기획안.md, sha256: 67a769afa8a1496b844b2a07ab264b1ea2a93ab83d55fadae2fb466b7fd8e5a6, change_type: MODIFIED }, { path: docs/ai-review/README.md, sha256: 67e47290326fc1b7e85950f401ded7d8582ee2a61ed75030fd137fbde7b7c40c, change_type: MODIFIED }, { path: docs/작업큐.md, sha256: 437831bd6d19fc036223b75ca2c27977cec43900b5b6d7e9d850ef23bcc2321d, change_type: MODIFIED }]`
- finding_ids: `TCG3-ARCH-001`, `TCG3-ARCH-002`, `TCG3-ARCH-003`, `TCG3-ARCH-004`, `TCG3-ARCH-005`, `TCG3-ARCH-006`
- 실행 명령: `git diff --check`; `corepack pnpm fable:self-test`; 문서 상태·route·의존성 검색; SHA-256 재계산
- 종료 코드·결과: 전부 0; wrapper self-test 31개 묶음 통과; 세 공식 문서만 commit `ad3a7bb`
- 증거 파일·로그 위치: `docs/ai-review/tasks/TEAM-CONFIG-GROWTH-003/rounds/r001/review.json`; commit `ad3a7bb926da0dbb0fc1217d5af461f8c8dc6b77`
- 미실행 항목과 이유: 문서 변경만 있어 제품 전체 verify는 재실행하지 않았다. 다음 검수는 수정 왕복이 가능한 WORKING_TREE_HASHED Task에서 수행한다.
- next_review_request: `FABLE_RECHECK`
