# TEAM-CONFIG-GROWTH-004 공동 작업 장부

> 앞선 세 검수에서 발견한 필수 Finding 16건을 반영한 세 공식 문서를 해시 고정 작업본으로 검수한다.
> 이후 턴은 `corepack pnpm fable:append` 또는 검수 실행기로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `ad3a7bb926da0dbb0fc1217d5af461f8c8dc6b77`
- artifact_hashes: `[{ path: docs/팀구성_상세기획안.md, sha256: 67a769afa8a1496b844b2a07ab264b1ea2a93ab83d55fadae2fb466b7fd8e5a6, change_type: MODIFIED }, { path: docs/ai-review/README.md, sha256: 67e47290326fc1b7e85950f401ded7d8582ee2a61ed75030fd137fbde7b7c40c, change_type: MODIFIED }, { path: docs/작업큐.md, sha256: 437831bd6d19fc036223b75ca2c27977cec43900b5b6d7e9d850ef23bcc2321d, change_type: MODIFIED }]`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/ai-review/README.md`, `docs/작업큐.md`
- 충족해야 할 요구사항·불변식: 앞선 필수 Finding 16건, 단일 공식본, append-only 검수, 현재 지원 상태와 차기 구현 계약 분리
- 이번에 바꾼 내용: 게이트 CLOSED 순환을 해소하고 route별 successor 입력을 클린룸에 맞게 분리했다. 모델 결과 없는 실패 상태와 protocol 1.2 소유·의존 순서를 고정하고 누락된 사보타주 시험을 작업큐에 추가했다.
- 집중 검토 질문: 앞선 16건이 모두 해소됐는가? 세 문서에 남은 모순·누락·우회 경로가 있는가? 계획을 현재 구현으로 오인할 수 있는가?
- 실행한 테스트·현재 증거: `git diff --check` 통과, `corepack pnpm fable:self-test` 31개 묶음 통과. 제품 코드·DB 변경은 없어 전체 verify는 재실행하지 않았다.
- 사람 결정이 필요한 항목: Opus model ID와 작업 전체 기본 사용 상한은 AI-REVIEW-2 구현 때 고정한다.
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=393ad0d2a11f0d1483c41ccc6b007fa1557a9943631b6b73f95b5916b6ab576b -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `393ad0d2a11f0d1483c41ccc6b007fa1557a9943631b6b73f95b5916b6ab576b`
- target_commit_sha: `ad3a7bb926da0dbb0fc1217d5af461f8c8dc6b77`
- input_files_sha256: `dc03156ac6f5485abb297518bd339a5ca4fbb4b41f9e9030860997d55807289a`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: TCG4-ARCH-001, TCG4-ARCH-002, TCG4-ARCH-003, TCG4-ARCH-004
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

세 공식 문서(팀구성_상세기획안·ai-review/README·작업큐)와 AGENTS.md, schema-v1.json, runner 원본을 대조했다. 소진 사유 allowlist(MODEL_BUDGET_EXHAUSTED/RATE_LIMITED/CAPACITY_UNAVAILABLE)와 runner 회차 상한 budget_exhausted·인증·hash·계약 오류의 비승계 경계, RUN_FAILED+NOT_FALLBACK_ELIGIBLE/FALLBACK_UNAVAILABLE/TASK_CAP_APPROVAL_REQUIRED 구조화 사유, verdict BLOCKED 비합성, 원 reviewer_role 유지·verified_by_engine·SEC/FINAL 표본 재감사, FINAL_INDEPENDENT 클린룸(runner 2274-2276이 FINAL 경로에 장부를 전송하지 않음과 일치), AI_DEPUTY_FALLBACK_HANDOFF의 protocol 1.1 거부(runner 2975 heading 정규식에 없음), AI-REVIEW-2→TEAM-LEARNING-1 의존 순서, FABLE-FINAL 전 회차·FABLE-SEC r001 학습 주입 금지, 회차당 $2.00 상한(runner DEFAULT_MAX_BUDGET_USD)까지 세 문서와 현재 구현이 일치함을 확인했다. 앞선 16건 Finding은 predecessor_review가 null이라 개별 ID로는 대조하지 못했고 패킷 요구사항 11개 기준으로만 검토했다. 남은 문제는 (1) CLOSED 전환을 "decision commit 보호 체크 성공 뒤 최초 발견 역할의 재검수"로 정의했지만 FINAL 외 route에는 다른 commit으로 registry를 잇는 successor 계약이 없고(README §6은 FINAL_INDEPENDENT 전용, §8 소진 승계는 동일 target 전용, WORKING은 HEAD==target 강제) P0-2 완료 조건도 이를 소유하지 않아 CLOSED 경로가 실행 불가능한 정책으로 남는 점(Major), (2) README §4 루프 도식이 CLOSED를 AI 부 O 종결 결정·게이트 검증보다 앞에 두어 §9·기획안 §4.4 순서와 어긋나는 점(Minor), (3) MANDATORY_MUTUAL·CONDITIONAL 소진 successor의 task.review_mode 값이 미규정인 점(Minor), (4) TEAM-LEARNING-1의 CANDIDATE/RETIRED 거부와 AI-REVIEW-2의 미재감사 SEC/FINAL Opus 결과 게이트 사용 차단에 사보타주 시험이 없는 점(Minor)이다. 판정은 CHANGES_REQUIRED이며 gate_state는 OPEN을 유지한다.

### 공동 편집 제안 색인

- TCG4-EDIT-001: ADD `docs/작업큐.md` · - `--no-db` 결과를 전체 6단계 통과로 표시하지 않는다. · 원문은 review.md 참조
- TCG4-EDIT-002: REPLACE `docs/ai-review/README.md` · ↺ 필수 Finding이 `VERIFIED` 또는 P0-2 구축 뒤 `CLOSED`가 될 때까지 반복 · 원문은 review.md 참조
- TCG4-EDIT-003: COMMENT `docs/ai-review/README.md` · 여기서 `INITIAL`·`RECHECK`는 inherited registry 유무에 따른 승계 의미다. `FABLE-SEC`· · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `393ad0d2a11f0d1483c41ccc6b007fa1557a9943631b6b73f95b5916b6ab576b`
- target_commit_sha: `ad3a7bb926da0dbb0fc1217d5af461f8c8dc6b77`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/ai-review/README.md`, `docs/작업큐.md`
- resulting_input_files_sha256: `r002 manifest에서 실행기가 봉인·검증 예정`
- artifact_hashes: `[{ path: docs/팀구성_상세기획안.md, sha256: 1626786d68b8bf4de03cb7a9ee520585bfe6d90e6d77605d65d2b42f24467c97, change_type: MODIFIED }, { path: docs/ai-review/README.md, sha256: b317650ccb67f8314ef6f430ac2a8e33b51246529d50532390b4352049dfa609, change_type: MODIFIED }, { path: docs/작업큐.md, sha256: 6127b3ad608fecda59856ff4231d22428b5db84b17c97deac7599ad735379c6d, change_type: MODIFIED }]`

### TCG4-ARCH-001
- disposition: `APPLIED`
- 적용 위치: README §6·§9, 기획안 §4.4, 작업큐 AI-REVIEW-2·P0-2
- 적용 내용: 모든 reviewer role의 decision-commit closure successor를 별도 계약으로 정의했다. protocol 1.2 schema/runner는 AI-REVIEW-2, 보호 체크·ruleset 결합은 P0-2가 소유하며 정확한 보호 증거 없이는 CLOSED를 거부한다.
- 실행한 테스트: 문서 계약·작업 의존성 상호 대조
- 필요한 재검수: 모든 역할의 CLOSED 경로 실행 가능성과 구현 전 금지 확인

### TCG4-ARCH-002
- disposition: `APPLIED`
- 적용 위치: README §4 두 도식
- 적용 내용: 반복 종료를 VERIFIED로 고정하고 anchor·decision→보호 체크→closure successor CLOSED 순서로 옮겼다.
- 실행한 테스트: README §9·기획안 §4.4 순서 대조
- 필요한 재검수: 종결 순서 단일성 확인

### TCG4-ARCH-003
- disposition: `APPLIED`
- 적용 위치: README §8, 기획안 §3.10.1, 작업큐 AI-REVIEW-2
- 적용 내용: MANDATORY_MUTUAL·CONDITIONAL task.review_mode는 INITIAL을 유지하고 RECHECK는 inherited registry에서 파생하며 직접 RECHECK 선언은 거부하도록 했다.
- 실행한 테스트: 현재 route 기본값과 문서 대조
- 필요한 재검수: task 값·파생 상태 분리 확인

### TCG4-ARCH-004
- disposition: `APPLIED`
- 적용 위치: 작업큐 AI-REVIEW-2·TEAM-LEARNING-1
- 적용 내용: CANDIDATE/RETIRED 및 protocol 1.1 학습 필드 거부, 미재감사 고위험 Opus 결과를 참조한 gate decision 거부 자체시험을 추가했다.
- 실행한 테스트: 완료 조건 누락 대조, `corepack pnpm fable:self-test`
- 필요한 재검수: 사보타주 시험 범위 완결성 확인

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `ad3a7bb926da0dbb0fc1217d5af461f8c8dc6b77`
- verified_input_files_sha256: `r002 manifest에서 실행기가 봉인·검증 예정`
- artifact_hashes: `[{ path: docs/팀구성_상세기획안.md, sha256: 1626786d68b8bf4de03cb7a9ee520585bfe6d90e6d77605d65d2b42f24467c97, change_type: MODIFIED }, { path: docs/ai-review/README.md, sha256: b317650ccb67f8314ef6f430ac2a8e33b51246529d50532390b4352049dfa609, change_type: MODIFIED }, { path: docs/작업큐.md, sha256: 6127b3ad608fecda59856ff4231d22428b5db84b17c97deac7599ad735379c6d, change_type: MODIFIED }]`
- finding_ids: `TCG4-ARCH-001`, `TCG4-ARCH-002`, `TCG4-ARCH-003`, `TCG4-ARCH-004`
- 실행 명령: `git diff --check`; `corepack pnpm fable:self-test`; 문서 route·CLOSED·depends_on 대조; SHA-256 재계산
- 종료 코드·결과: 전부 0; wrapper self-test 31개 묶음 통과; r002가 같은 Finding ID로 수정판을 해시 봉인 예정
- 증거 파일·로그 위치: `docs/ai-review/tasks/TEAM-CONFIG-GROWTH-004/rounds/r001/review.json`; 현재 작업본 세 artifact SHA-256
- 미실행 항목과 이유: 문서만 변경했으며 계획된 protocol 1.2/P0-2 사보타주 시험은 후속 구현 작업의 완료 조건이다. 제품 전체 verify는 재실행하지 않았다.
- next_review_request: `FABLE_RECHECK`

<!-- fable-review:r002 sha256=caed140b0dfe84e5cb710a27ee281efadd3a82d84ac861a2c72996eed1b0b9b6 -->
## FABLE_RECHECK · turn-f002 · r002

- role: `FABLE-ARCH`
- verdict: `PASS`
- review_sha256: `caed140b0dfe84e5cb710a27ee281efadd3a82d84ac861a2c72996eed1b0b9b6`
- target_commit_sha: `ad3a7bb926da0dbb0fc1217d5af461f8c8dc6b77`
- input_files_sha256: `1f4b0da96a1eb4eb954b0f2632f50ad0a5a451641d81a6a482dbb9587ff4bfa6`
- 원본 검수: [r002/review.md](./rounds/r002/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: TCG4-ARCH-005
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

r001의 필수 Finding 4건을 r002 수정판(README b3176…, 기획안 16267…, 작업큐 6127b…)에서 재검수했다. (1) TCG4-ARCH-001: README §6 248-255가 모든 reviewer_role용 closure successor 계약(원 route·역할·범위 유지, predecessor 최신 성공 회차 registry hash 승계, target=보호 체크 성공 decision commit 이상의 COMMIT snapshot, 보호 체크 SHA·check context·보호 ref 증거 봉인 없으면 CLOSED 거부)을 FABLE-FINAL commit 변경 successor·§8 소진 successor와 분리해 정의하고, schema/runner는 AI-REVIEW-2(작업큐 176-178), validator·ruleset 결합과 부정 자체시험은 P0-2(작업큐 352-355, depends_on AI-REVIEW-2)가 소유하며 구현 전 CLOSED 금지를 명시한다. 기획안 §4.4 5항·11항(804·810)이 같은 계약을 참조한다 → VERIFIED. (2) TCG4-ARCH-002: README §4 두 도식(147-150·161-164)이 반복 종료를 VERIFIED로 고정하고 anchor·decision → 보호 게이트 → closure successor CLOSED 순서로 §9 428-429·기획안 795와 일치 → VERIFIED. (3) TCG4-ARCH-003: README §8 369-371·기획안 619-621이 MANDATORY_MUTUAL·CONDITIONAL successor의 task.review_mode를 route 기본값 INITIAL로 고정하고 RECHECK는 inherited registry에서 실행기가 파생, 직접 선언은 거부로 규정하며 작업큐 158-159에 자체시험을 추가했다. task.example.json 4·10과 본 Task 자체(MANDATORY_MUTUAL·INITIAL·파생 RECHECK)가 현재 계약과 일치한다 → VERIFIED. (4) TCG4-ARCH-004: 작업큐 TEAM-LEARNING-1 210-211에 CANDIDATE/RETIRED 주입·protocol 1.1 학습 필드 추가의 실패 폐쇄 자체시험, AI-REVIEW-2 179-180에 표본 재감사 기록 없는 SEC/FINAL Opus 결과를 참조한 AI_DEPUTY_GATE_DECISION 거부 자체시험이 추가됐다 → VERIFIED. Codex 증거(git diff --check, fable:self-test 31묶음, SHA-256 재계산)는 문서 전용 변경에 충분하다. 새 필수 Finding은 없고, README §9가 closure successor 계약을 이름으로 참조하지 않는 점만 Improvement(TCG4-ARCH-005)로 남긴다. 판정 PASS이나 gate_state는 OPEN을 유지하며 CLOSED 전환·closed_finding_ids는 P0-2 보호 체크 전이라 요청하지 않는다.

### 공동 편집 제안 색인

- TCG4-EDIT-004: REPLACE `docs/ai-review/README.md` · 체크 성공 기록이 있는 뒤 최초 발견 역할의 재검수에서만 허용한다. · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r002 -->

## SOLAR_RESPONSE · turn-s003 · r002

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f002`
- reply_to_review_sha256: `caed140b0dfe84e5cb710a27ee281efadd3a82d84ac861a2c72996eed1b0b9b6`
- target_commit_sha: `ad3a7bb926da0dbb0fc1217d5af461f8c8dc6b77`
- changed_artifact_paths: `docs/ai-review/README.md`
- resulting_input_files_sha256: `r003 manifest에서 실행기가 봉인·검증 예정`
- artifact_hashes: `[{ path: docs/ai-review/README.md, sha256: 4d190aebc35b8374cc7a0f8438fe1dee940f4f326ffd80d86111fe6c21779166, change_type: MODIFIED }, { path: docs/팀구성_상세기획안.md, sha256: 1626786d68b8bf4de03cb7a9ee520585bfe6d90e6d77605d65d2b42f24467c97, change_type: UNCHANGED }, { path: docs/작업큐.md, sha256: 6127b3ad608fecda59856ff4231d22428b5db84b17c97deac7599ad735379c6d, change_type: UNCHANGED }]`

### TCG4-ARCH-005
- disposition: `APPLIED`
- 적용 위치: `docs/ai-review/README.md` §9 CLOSED 조건
- 적용 내용: 최초 발견 역할의 재검수를 §6 closure successor의 COMMIT snapshot·registry hash 승계 계약으로 명시적으로 교차참조했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: `git diff --check`, §6·§9 문구 대조
- 필요한 재검수: 같은 Finding ID로 §9 교차참조 확인

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c002 · r002

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s003`
- target_commit_sha: `ad3a7bb926da0dbb0fc1217d5af461f8c8dc6b77`
- verified_input_files_sha256: `r003 manifest에서 실행기가 봉인·검증 예정`
- artifact_hashes: `[{ path: docs/ai-review/README.md, sha256: 4d190aebc35b8374cc7a0f8438fe1dee940f4f326ffd80d86111fe6c21779166, change_type: MODIFIED }]`
- finding_ids: `TCG4-ARCH-005`
- 실행 명령: `git diff --check`; README §6·§9 closure successor 참조 대조; SHA-256 재계산
- 종료 코드·결과: 전부 0; §9가 §6 계약을 이름·snapshot·registry 조건으로 직접 참조함
- 증거 파일·로그 위치: 현재 `docs/ai-review/README.md`; `docs/ai-review/tasks/TEAM-CONFIG-GROWTH-004/rounds/r002/review.json`
- 미실행 항목과 이유: 문구 교차참조만 바뀌어 self-test와 제품 verify는 재실행하지 않았다.
- next_review_request: `FABLE_RECHECK`

<!-- fable-review:r003 sha256=2b91097cf20781d4e8d04acf8b31a3d9e0794f82430fe255278f24ddce02a1fc -->
## FABLE_RECHECK · turn-f003 · r003

- role: `FABLE-ARCH`
- verdict: `PASS`
- review_sha256: `2b91097cf20781d4e8d04acf8b31a3d9e0794f82430fe255278f24ddce02a1fc`
- target_commit_sha: `ad3a7bb926da0dbb0fc1217d5af461f8c8dc6b77`
- input_files_sha256: `54b5ca9a1f904345965e85b4906826ebb4949013928c902080af1f2bc1bb309d`
- 원본 검수: [r003/review.md](./rounds/r003/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

r003 재검수. r002 이후 변경된 artifact는 docs/ai-review/README.md(4d190…)뿐이며 기획안(16267…)·작업큐(6127b…)는 r002와 동일 hash로 UNCHANGED다. (1) TCG4-ARCH-005(Improvement): README §9 428-430이 "CLOSED 전환은 decision commit의 보호 원격 필수 체크 성공 기록이 있는 뒤 최초 발견 역할이 §6의 closure successor(COMMIT, registry hash 승계)로 재검수할 때만 허용한다"로 바뀌어 §6 248-255의 closure successor 계약(모든 reviewer_role, 원 route·역할·범위 유지, predecessor 최신 성공 회차 registry hash 승계, decision commit 이상 COMMIT snapshot, 보호 체크 증거 미봉인 시 CLOSED 거부, AI-REVIEW-2·P0-2 소유)을 이름·snapshot·registry 조건으로 직접 참조한다. §4 두 도식(150·164)·기획안 §4.4 5항(804)·11항(810)·상태 순환(795)과 용어·순서가 일치하며 TCG4-EDIT-004가 그대로 적용됐다 → VERIFIED. (2) 앞서 VERIFIED한 TCG4-ARCH-001~004의 근거 위치(README §6 248-255, §4 147-150·161-164, §8 367-371·387-389; 작업큐 158-159·176-180·210-211·352-355; 기획안 795·804·810)를 현재 판본에서 다시 읽어 변경 없이 유지됨을 확인했다. Codex 증거(git diff --check, §6·§9 대조, SHA-256 재계산)는 문구 교차참조만 바뀐 변경에 충분하고 self-test 미재실행 사유도 타당하다. 새 Finding은 없다. 판정 PASS이나 gate_state는 OPEN을 유지하며, P0-2 보호 체크와 AI-REVIEW-2 closure successor 구현 전이므로 CLOSED 전환·closed_finding_ids는 요청하지 않는다.

### 공동 편집 제안 색인

- 없음


- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r003 -->
