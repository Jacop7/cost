# SETUP-V11-COLLAB-001 공동 작업 장부

> 이 장부는 `docs/ai-review/fixtures/shared-coauthoring-smoke.md` 한 공식 산출물의 솔라↔페이블
> 폐쇄형 왕복을 검증한다. 새 턴은 아래에만 추가하며 과거 턴과 회차 원본은 고치지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- artifact_hashes: `[{ path: docs/ai-review/fixtures/shared-coauthoring-smoke.md, sha256: f95efc28c4347223bfafdd1deff7aa348e0a0118ca135daa3beb7a4dad045807, change_type: ADDED }]`
- changed_artifact_paths: `docs/ai-review/fixtures/shared-coauthoring-smoke.md`
- 충족해야 할 요구사항·불변식: `SMOKE-COAUTHOR-1..3`
- 이번에 바꾼 내용: 왕복 검수용 단일 공식 산출물 초안을 작성했다.
- 집중 검토 질문: 현재 종결 규칙이 폐쇄형 재검수와 PASS/gate 분리 원칙을 위반하는가?
- 실행한 테스트·현재 증거: 초기 판본 SHA-256을 기록했다.
- 사람 결정이 필요한 항목: 없음
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=4e2e048499c9677bb3d47c8467c28007cff95dd1cb33f6da4736a1c193b13ff5 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `4e2e048499c9677bb3d47c8467c28007cff95dd1cb33f6da4736a1c193b13ff5`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- input_files_sha256: `604543433424380f035c764f3ae3361ffb415fe877cc120124b7b110ccb927ad`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: SMOKE-COAUTHOR-CLOSE-RULE-001, SMOKE-COAUTHOR-PASS-GATE-002
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

SMOKE 최초 검수(r001). 공식 산출물 `docs/ai-review/fixtures/shared-coauthoring-smoke.md`의 "현재 종결 규칙"(9행)은 페이블이 필수 Finding을 남겨도 솔라 반영·Codex 실행 증거·페이블 재검수 없이 "즉시 완료 처리"한다고 명시한다. 이는 (1) 필수 Finding을 최초 검수 역할의 재검수로만 닫는 폐쇄형 왕복 규칙(README §1 26–33행, §4 90–97행, §9 222–228행; SMOKE-COAUTHOR-1, AI-REVIEW:closed-loop-recheck)과 (2) 페이블 PASS와 AI 부 오케스트레이터의 task/gate 종결을 분리하는 규칙(README §9 227–237행; SMOKE-COAUTHOR-3, AI-REVIEW:pass-is-not-gate-closure)을 동시에 위반한다. 같은 파일 13–17행의 "통과 조건"은 올바른 절차를 서술하고 있어 문서 내부에서도 자기모순이 있다. 단일 공식 산출물 원칙(SMOKE-COAUTHOR-2)은 위반 없이 충족된다(역할별 사본 없음, artifact 경로 1개). 필수 Finding 2건(Major)을 OPEN으로 남기며, 9행을 통과 조건과 정합하는 종결 규칙으로 교체하는 proposed_edit을 첨부한다. 솔라가 같은 파일에 반영하고 Codex가 새 판본 hash를 검증한 뒤 r002에서 같은 Finding ID로 재검수한다. PASS가 나더라도 gate_state는 AI 부 오케스트레이터의 별도 결정 전까지 OPEN이어야 한다.

### 공동 편집 제안 색인

- SMOKE-EDIT-CLOSE-RULE-001: REPLACE `docs/ai-review/fixtures/shared-coauthoring-smoke.md` · ## 현재 종결 규칙 · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `4e2e048499c9677bb3d47c8467c28007cff95dd1cb33f6da4736a1c193b13ff5`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- changed_artifact_paths: `docs/ai-review/fixtures/shared-coauthoring-smoke.md`
- resulting_input_files_sha256: `5168254703d34bc0859463db0532212c41060f57811ab9cfe55c22df48439b73`
- artifact_hashes: `[{ path: docs/ai-review/fixtures/shared-coauthoring-smoke.md, sha256: 63a996beb4241ced925203ac2eace2d7e065f52ff516fb67a53fda1164c29651, change_type: ADDED }]`

### SMOKE-COAUTHOR-CLOSE-RULE-001

- disposition: `APPLIED`
- 적용 위치: `## 현재 종결 규칙`
- 적용 내용: 같은 공식 파일에 솔라 반영 → 공동 장부 Finding별 응답 → Codex 증거 → 최초 검수 역할의 동일 Finding ID 재검수 순서와 CLOSED 조건을 반영했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: 수정 파일 SHA-256 및 전체 입력 파일 metadata hash 재계산
- 필요한 재검수: 같은 Finding ID의 완료 조건 충족과 CLOSED 전환 확인

### SMOKE-COAUTHOR-PASS-GATE-002

- disposition: `APPLIED`
- 적용 위치: `## 현재 종결 규칙`
- 적용 내용: 페이블 PASS는 검수 판정일 뿐이며 AI 부 오케스트레이터의 별도 gate 결정 전에는 `gate_state=OPEN`이라고 명시했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: r001 뒤 `status.json`의 `gate_state=OPEN` 확인
- 필요한 재검수: r002 PASS 뒤에도 `gate_state=OPEN` 유지 확인

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- verified_input_files_sha256: `5168254703d34bc0859463db0532212c41060f57811ab9cfe55c22df48439b73`
- artifact_hashes: `[{ path: docs/ai-review/fixtures/shared-coauthoring-smoke.md, sha256: 63a996beb4241ced925203ac2eace2d7e065f52ff516fb67a53fda1164c29651, change_type: ADDED }]`
- finding_ids: `SMOKE-COAUTHOR-CLOSE-RULE-001`, `SMOKE-COAUTHOR-PASS-GATE-002`
- 실행 명령: `Get-FileHash -Algorithm SHA256`, manifest metadata 재계산, `corepack pnpm fable:self-test`
- 종료 코드·결과: artifact SHA와 input files SHA 재계산 일치, 실행기 자체 테스트 8개 묶음 통과
- 증거 파일·로그 위치: `rounds/r001/review.json`, `rounds/r001/run.json`; r001 run SHA-256 `7874a1426097868d27a1b722da36ae7df00824a247b53a47d14ede1257b5be0d`
- 미실행 항목과 이유: gate 종결은 이번 WORKING_TREE_HASHED 왕복 검증 범위가 아니며 자동 종결기도 아직 없으므로 실행하지 않음
- next_review_request: `FABLE_RECHECK`

<!-- fable-review:r002 sha256=99fd822cf4057c1e7d67bb4960cb4e757ad6fd54ca5fd9bbc0451464840ed6f5 -->
## FABLE_RECHECK · turn-f002 · r002

- role: `FABLE-ARCH`
- verdict: `PASS`
- review_sha256: `99fd822cf4057c1e7d67bb4960cb4e757ad6fd54ca5fd9bbc0451464840ed6f5`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- input_files_sha256: `5168254703d34bc0859463db0532212c41060f57811ab9cfe55c22df48439b73`
- 원본 검수: [r002/review.md](./rounds/r002/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: 없음
- 닫힌 Finding: SMOKE-COAUTHOR-CLOSE-RULE-001, SMOKE-COAUTHOR-PASS-GATE-002
- 재개방 Finding: 없음

### 요약

RECHECK(r002). r001에서 남긴 필수 Finding 2건을 같은 ID로 재검수했다. 공식 산출물 `docs/ai-review/fixtures/shared-coauthoring-smoke.md`의 "현재 종결 규칙" 절(9–17행)은 r001 proposed_edit SMOKE-EDIT-CLOSE-RULE-001과 동일한 내용으로 교체됐다. 9–13행은 필수 Finding을 솔라 반영 → 장부 Finding별 응답(APPLIED|PARTIAL|REJECTED|NEEDS_HUMAN_DECISION) → Codex CODEX_EVIDENCE → 최초 검수 역할(페이블)의 같은 finding_id 재검수 순서로만 CLOSED 전환한다고 명시해 README §1 26–33행·§4 90–97행·§9 222행과 정합한다(SMOKE-COAUTHOR-1, AI-REVIEW:closed-loop-recheck 충족). 15–17행은 페이블 PASS가 검수 판정일 뿐이며 gate_state는 AI_DEPUTY_GATE_DECISION 턴 기록 시에만 CLOSED, 그 전까지 OPEN이라고 명시해 README §9 227–237행과 정합한다(SMOKE-COAUTHOR-3, AI-REVIEW:pass-is-not-gate-closure 충족). "즉시 완료 처리" 자동 종결 문구는 제거됐고 통과 조건 절(21–25행)과의 자기모순도 해소됐다. 단일 공식 산출물 원칙(SMOKE-COAUTHOR-2)은 snapshot에 artifact 경로 1개만 존재하고 solar-*/fable-*/revised-* 사본이 없어 유지된다. 공동 장부의 SOLAR_RESPONSE(turn-s002)는 Finding별 APPLIED 응답과 artifact SHA 63a996be…를, CODEX_EVIDENCE(turn-c001)는 input_files_sha256 51682547…를 검증했고 이 값은 이번 패킷의 input_files 봉인값과 일치한다. AGENTS.md는 이 fixture와 충돌하는 규칙이 없다. 따라서 SMOKE-COAUTHOR-CLOSE-RULE-001, SMOKE-COAUTHOR-PASS-GATE-002를 CLOSED로 전환하고 PASS를 반환한다. 이 PASS는 필수 Finding 0건이라는 검수 판정이며 task/gate 종결이 아니다. gate_state는 AI 부 오케스트레이터가 별도 AI_DEPUTY_GATE_DECISION 턴을 기록할 때까지 OPEN으로 유지돼야 하며, Codex도 gate 종결을 실행하지 않았다고 장부에 남겼다.

### 공동 편집 제안 색인

- 없음


- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r002 -->

## SOLAR_RESPONSE · turn-s003 · r002

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-f002`
- reply_to_review_sha256: `99fd822cf4057c1e7d67bb4960cb4e757ad6fd54ca5fd9bbc0451464840ed6f5`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- changed_artifact_paths: `docs/ai-review/fixtures/shared-coauthoring-smoke.md`
- resulting_input_files_sha256: `3ee89fec629335681d03a344907fad80ae1c5f5c59ad195d9cd82e402dc32511`
- artifact_hashes: `[{ path: docs/ai-review/fixtures/shared-coauthoring-smoke.md, sha256: 64c0b747c04f7e1c0194502268d58cd19e1e50d8e7a27d8deecdcce1f8655e99, change_type: ADDED }]`
- disposition: r002의 두 Finding은 CLOSED를 유지하되, 후속 독립 감사의 지적에 따라 AI 부 O 결정과 공식 외부 gate 종결을 더 엄격히 분리했다.
- 적용 내용: AI 부 O는 anchor/decision commit으로 종결을 요청하고, 로컬 status는 OPEN을 유지하며, 공식 CLOSED는 동일-SHA 보호 원격 필수 체크와 보호 ref 반영 또는 사전 승인 외부 attestation만 증명하도록 바꿨다.
- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c002 · r002

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s003`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- verified_input_files_sha256: `3ee89fec629335681d03a344907fad80ae1c5f5c59ad195d9cd82e402dc32511`
- artifact_hashes: `[{ path: docs/ai-review/fixtures/shared-coauthoring-smoke.md, sha256: 64c0b747c04f7e1c0194502268d58cd19e1e50d8e7a27d8deecdcce1f8655e99, change_type: ADDED }]`
- finding_ids: `SMOKE-COAUTHOR-CLOSE-RULE-001`, `SMOKE-COAUTHOR-PASS-GATE-002`
- 실행 명령: artifact/README SHA-256과 r003 입력 metadata hash 재계산
- 종료 코드·결과: 계산 성공; r002 run SHA-256 `0568c0533974f490ad0f10c0b6d04ae1ee584f97cdee3f9d533d4d2d7bb11009`
- 미실행 항목과 이유: `P0-2` ruleset·필수 체크가 아직 없으므로 공식 gate 종결은 실행하지 않음
- next_review_request: `FABLE_RECHECK`

## CODEX_EVIDENCE · turn-c003 · r003 정정 및 재시도

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-c002`
- correction_of_turn_id: `turn-c002`
- 정정 사유: r003 manifest를 생성하기 전 수동 metadata 계산에서 기준 commit에 없던 새 README를 `MODIFIED`로 잘못 분류했다. 실행기의 실제 분류는 `ADDED`다.
- corrected_verified_input_files_sha256: `458ef58a54a67d98e604d8b640cc587f63fef2a543fec3249ce4f5c97113ab62`
- artifact_hashes: `[{ path: docs/ai-review/fixtures/shared-coauthoring-smoke.md, sha256: 64c0b747c04f7e1c0194502268d58cd19e1e50d8e7a27d8deecdcce1f8655e99, change_type: ADDED }]`
- reference_hashes: `[{ path: docs/ai-review/README.md, sha256: 7450e2b845131bc01c8856d33f8ec81af3708420c92cc9fe6b311aec20b0d9a2, change_type: ADDED }]`
- r003 결과: Claude 응답은 이미 CLOSED인 두 ID를 `closed_finding_ids`에 다시 넣어 상태 전이 검증에 실패했고 공식 review/장부에 합류하지 않았다.
- r003 run_sha256: `2a46682f5855da519656f4ecd9a49d62809c430adbfcd7d0581d92b33b44f287`
- r004 상태 전이 요청: r002에서 두 Finding은 이미 CLOSED다. 이번 회차에 재개방 후 다시 닫는 전이가 없으면 `closed_finding_ids=[]`, `reopened_finding_ids=[]`로 반환한다. CLOSED finding을 findings에 반복 기재한다면 `review_state=CLOSED`, `previous_finding_id`는 같은 ID를 유지한다.
- next_review_request: `FABLE_RECHECK`

<!-- fable-review:r004 sha256=64285a46a80de8770bd4d167a038ae1ef6926857fb7470c50b7a7a6af74d6907 -->
## FABLE_RECHECK · turn-f004 · r004

- role: `FABLE-ARCH`
- verdict: `PASS`
- review_sha256: `64285a46a80de8770bd4d167a038ae1ef6926857fb7470c50b7a7a6af74d6907`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- input_files_sha256: `458ef58a54a67d98e604d8b640cc587f63fef2a543fec3249ce4f5c97113ab62`
- 원본 검수: [r004/review.md](./rounds/r004/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

RECHECK(r004). r002에서 CLOSED로 전환한 필수 Finding 2건(SMOKE-COAUTHOR-CLOSE-RULE-001, SMOKE-COAUTHOR-PASS-GATE-002)이 솔라의 후속 수정(turn-s003) 뒤에도 CLOSED 상태를 유지하는지 같은 ID로 재확인했다. 이번 회차에는 재개방 후 재종결 전이가 없으므로 Codex turn-c003의 정정 요청대로 closed_finding_ids와 reopened_finding_ids를 빈 배열로 반환하고, 두 Finding은 review_state=CLOSED로만 반복 기재한다. 공식 산출물 `docs/ai-review/fixtures/shared-coauthoring-smoke.md`(SHA 64c0b747…, 28행)의 9–13행은 r002와 동일하게 솔라 반영 → 장부 Finding별 응답 → Codex CODEX_EVIDENCE → 최초 검수 역할의 같은 finding_id 재검수 후에만 CLOSED 전환한다고 규정해 README §1 26–33행·§4 90–97행·§9 229행과 정합한다(SMOKE-COAUTHOR-1, AI-REVIEW:closed-loop-recheck 유지). 15–19행은 turn-s003에서 강화된 부분으로, 페이블 PASS는 검수 판정일 뿐이고 AI 부 오케스트레이터는 AI_DEPUTY_GATE_DECISION 턴을 decision commit으로 발행해 외부 게이트에 종결을 요청하며, 로컬 status.json gate_state는 OPEN을 유지하고, 공식 종결은 동일 SHA 보호 원격 필수 체크 성공·보호 ref 반영 기록 또는 사전 승인된 외부 서명/attestation으로만 증명한다고 명시한다. 이는 README §5 146–153행의 anchor/decision commit 2단계 봉인과 §9 232·234–236·239–247행의 종결 권한 규정과 일치하며, 부 오케스트레이터 결정과 공식 gate CLOSED를 더 엄격히 분리했으므로 SMOKE-COAUTHOR-3·AI-REVIEW:pass-is-not-gate-closure를 후퇴 없이 충족한다. 통과 조건 절(23–28행)도 세 상태(PASS·종결 결정·공식 gate 종결)를 별도로 유지한다고 고쳐져 종결 규칙 절과 모순이 없다. snapshot에는 artifact 경로 1개와 참조 문서 2개, 실행기 manifest만 존재하고 solar-*/fable-*/revised-* 사본이 없어 단일 공식 산출물 원칙(SMOKE-COAUTHOR-2)도 유지된다. 장부의 turn-s003 artifact SHA 64c0b747…와 turn-c003의 정정된 input_files_sha256 458ef58a…는 이번 패킷 봉인값과 정확히 일치하고, README의 change_type=ADDED 분류도 패킷과 같다. AGENTS.md에는 이 fixture와 충돌하는 규칙이 없다. 따라서 PASS를 반환한다. 이 PASS는 필수 Finding 0건이라는 검수 판정이며 task/gate 종결이 아니다. gate_state는 AI 부 오케스트레이터의 AI_DEPUTY_GATE_DECISION과 P0-2 보호 원격 필수 체크가 갖춰지기 전까지 OPEN(최대 VERIFIED)으로 유지돼야 하며, Codex도 공식 gate 종결을 실행하지 않았다고 장부에 남겼다.

### 공동 편집 제안 색인

- 없음


- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r004 -->
