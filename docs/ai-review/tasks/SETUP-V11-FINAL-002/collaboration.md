# SETUP-V11-FINAL-002 공동 작업 장부

> 최신 검수 실행기의 실제 Claude 왕복과 보존·복구 계약을 확인하는 비권위 스모크 작업이다.
> `SETUP-V11-FINAL-001`의 출력 계약 실패 기록은 보존하고, 수정한 schema·runner는 새 Task에서 검증한다.
> 제품 공동 산출물은 `docs/ai-review/fixtures/shared-coauthoring-smoke.md` 하나이며 과거 턴은 수정하지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- artifact_hashes: `[{ path: docs/ai-review/fixtures/shared-coauthoring-smoke.md, sha256: 64c0b747c04f7e1c0194502268d58cd19e1e50d8e7a27d8deecdcce1f8655e99, change_type: ADDED }]`
- changed_artifact_paths: `docs/ai-review/fixtures/shared-coauthoring-smoke.md`
- 충족해야 할 요구사항·불변식: `FINAL-SMOKE-1..3`
- 이번에 바꾼 내용: anchor 단일행 계약을 schema와 검수 프롬프트에 함께 명시한 최신 실행기로 기존 폐쇄형 공동 작성 스모크 산출물을 다시 검증한다.
- 집중 검토 질문: 단일 공식본, 같은 Finding ID 재검수, PASS와 외부 gate 종결 분리가 현재 문서에서 일관되는가?
- 실행한 테스트·현재 증거: artifact SHA-256과 target commit/tree/AGENTS hash를 고정했고 wrapper self-test 18개 묶음을 통과했다.
- 사람 결정이 필요한 항목: 없음
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=a4476494790c381b371b50b23ee89a2bd3dd52e0298d40821e1324340bf2d562 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- verdict: `PASS`
- review_sha256: `a4476494790c381b371b50b23ee89a2bd3dd52e0298d40821e1324340bf2d562`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- input_files_sha256: `82a8e975aa99233d96f15a50b89690d378d2c233cfed31ebc6e1167822aa0738`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: FINAL-SMOKE-002-IMP-001
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

SMOKE 검수 결과 PASS. 단일 공식 산출물 `docs/ai-review/fixtures/shared-coauthoring-smoke.md`(sha256 64c0b747…, 28줄)를 `AGENTS.md`와 `docs/ai-review/README.md`와 대조했다. (1) FINAL-SMOKE-2 / single-canonical-artifact: 산출물 5행 "역할별 사본을 만들지 않고 이 파일 하나를 반복 개선"은 README 3–5행, 20행, 48–49행의 단일 공식본 규칙과 일치한다. (2) FINAL-SMOKE-1 / closed-loop-recheck: 산출물 9–13행과 26행의 "솔라 반영 → Finding별 응답 → CODEX_EVIDENCE → 최초 검수 역할이 같은 finding_id로 재검수 후에만 CLOSED"는 README 29–36행, 135–141행, 176–177행, 286행, 309행과 일치한다. (3) FINAL-SMOKE-3 / pass-is-not-gate-closure: 산출물 15–19행, 27–28행의 "PASS는 필수 Finding 0건 판정일 뿐, gate_state는 OPEN 유지, 공식 종결은 decision commit 동일 SHA의 보호 원격 필수 체크 성공+보호 ref 반영 또는 사전 승인 외부 attestation"은 README 289–304행과 일치한다. 필수 증거 3번(최신 실행기의 runner/schema source archive, 전체 WORKING input-snapshot, prepared collaboration-entry와 run hash 보존)은 README 64–73행, 80–88행, 111–113행, 180–193행, 312–313행에서 확인했으나 산출물 통과 조건(23행)은 페이블 검수 원본 보존만 언급한다. 이를 보완하고 P0-2 이전에는 VERIFIED까지만 가능하다는 README 303–304행의 현재 제한을 산출물에도 반영하는 Improvement 1건을 남기며, PASS를 막지 않는다. 이 PASS는 필수 Finding이 없다는 검수 판정이며 task/gate의 종결이 아니다.

### 공동 편집 제안 색인

- FINAL-SMOKE-002-EDIT-001: REPLACE `docs/ai-review/fixtures/shared-coauthoring-smoke.md` · - Codex는 수정 판본의 hash와 검증 결과를 공동 장부에 남긴다. · 원문은 review.md 참조
- FINAL-SMOKE-002-EDIT-002: ADD `docs/ai-review/fixtures/shared-coauthoring-smoke.md` · 보호 ref 반영 기록 또는 사전 승인된 외부 서명/attestation으로만 증명한다. · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `a4476494790c381b371b50b23ee89a2bd3dd52e0298d40821e1324340bf2d562`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- changed_artifact_paths: `docs/ai-review/fixtures/shared-coauthoring-smoke.md`
- resulting_input_files_sha256: `r002 manifest에서 실행기가 봉인·검증 예정`
- artifact_hashes: `[{ path: docs/ai-review/fixtures/shared-coauthoring-smoke.md, sha256: ce90ad6580caa352584a90aa6413f4c412d461dad6b164aea6478524aa5de9ff, change_type: ADDED }]`

### FINAL-SMOKE-002-IMP-001

- disposition: `APPLIED`
- 적용 위치: `docs/ai-review/fixtures/shared-coauthoring-smoke.md` 현재 종결 규칙·통과 조건
- 적용 내용: P0-2 이전 VERIFIED 상한을 명시하고 Codex 증거의 명령·종료 결과·검증 SHA·경로 및 runner/schema·WORKING input·prepared entry·run hash 보존 조건을 추가했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: 수정 판본 SHA-256 `ce90ad6580caa352584a90aa6413f4c412d461dad6b164aea6478524aa5de9ff` 확인
- 필요한 재검수: 같은 finding_id로 수정 문구와 r002 봉인 hash를 재검수

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- verified_input_files_sha256: `09896e24fbf7c318dcda8a2134bd0029b8f310d426c1afffc9829e6200ca0aba`
- artifact_hashes: `[{ path: docs/ai-review/fixtures/shared-coauthoring-smoke.md, sha256: ce90ad6580caa352584a90aa6413f4c412d461dad6b164aea6478524aa5de9ff, change_type: ADDED }]`
- finding_ids: `FINAL-SMOKE-002-IMP-001`
- 실행 명령: `node --check scripts/fable-review.mjs`; schema JSON 파싱; `corepack pnpm fable:self-test`; SHA-256·input metadata 재계산
- 종료 코드·결과: 전부 0; wrapper self-test 18개 묶음 통과; 수정 artifact 32줄·2,296바이트·SHA-256 `ce90ad65…e9ff`; 예상 r002 input_files_sha256 `09896e24…0aba`
- 증거 파일·로그 위치: `docs/ai-review/tasks/SETUP-V11-FINAL-002/rounds/r001/{manifest.json,input-snapshot.json,review.json,run.json,runner-source.mjs,schema-source.json}`; `docs/ai-review/tasks/SETUP-V11-FINAL-002/turns/t0001/run.json`
- 미실행 항목과 이유: P0-2 보호 원격 required check·ruleset이 아직 없어 공식 gate 종결은 실행하지 않았고 `gate_state=OPEN`을 유지한다.
- next_review_request: `FABLE_RECHECK`

## CODEX_EVIDENCE · turn-c002 · r002

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-f001`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- verified_input_files_sha256: `09896e24fbf7c318dcda8a2134bd0029b8f310d426c1afffc9829e6200ca0aba`
- artifact_hashes: `[{ path: docs/ai-review/fixtures/shared-coauthoring-smoke.md, sha256: ce90ad6580caa352584a90aa6413f4c412d461dad6b164aea6478524aa5de9ff, change_type: ADDED }]`
- finding_ids: `FINAL-SMOKE-002-IMP-001`
- 실행 명령: `corepack pnpm fable:review -- --task SETUP-V11-FINAL-002 --round 2`
- 종료 코드·결과: 76; 산출물이나 입력 STALE이 아니라 기존 Finding의 `previous_finding_id`가 같은 `FINAL-SMOKE-002-IMP-001`을 유지하지 않은 출력 계약 오류로 `RUN_FAILED` 보존
- 증거 파일·로그 위치: `docs/ai-review/tasks/SETUP-V11-FINAL-002/rounds/r002/run.json`; 저장소 밖 redacted CLI 로그
- 미실행 항목과 이유: r002 결과는 검증되지 않아 review·장부에 합류하지 않았고 Finding 상태도 변경하지 않았다. 다음 RECHECK는 같은 finding_id와 같은 previous_finding_id를 유지해야 한다.
- next_review_request: `FABLE_RECHECK`

<!-- fable-review:r003 sha256=c43007df1b2cbda5d21544118be2bf6bc2d2582f56a29cdec085581c65d89d9f -->
## FABLE_RECHECK · turn-f003 · r003

- role: `FABLE-ARCH`
- verdict: `PASS`
- review_sha256: `c43007df1b2cbda5d21544118be2bf6bc2d2582f56a29cdec085581c65d89d9f`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- input_files_sha256: `09896e24fbf7c318dcda8a2134bd0029b8f310d426c1afffc9829e6200ca0aba`
- 원본 검수: [r003/review.md](./rounds/r003/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: FINAL-SMOKE-002-IMP-001
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

RECHECK 결과 PASS. 단일 공식 산출물 `docs/ai-review/fixtures/shared-coauthoring-smoke.md` 수정 판본(32줄·2,296바이트, sha256 ce90ad65…e9ff)을 r001 검수의 유일한 Finding `FINAL-SMOKE-002-IMP-001`(Improvement) 수용 조건과 대조했다. (1) 통과 조건 28–29행에 회차별 runner/schema 원본·WORKING 전체 입력 원문 snapshot·prepared `collaboration-entry.md`·`run.json` hash-chain 보존이 한 항목으로 추가되어 README 64–73행, 111–113행, 180–193행과 일치한다. (2) 27행의 Codex 증거 항목이 명령·종료 결과·검증 SHA·증거 경로를 명시해 README 176–177행과 일치한다. (3) 종결 규칙 20–21행에 P0-2 GitHub ruleset·필수 체크 구축 전에는 Finding·task 상태를 VERIFIED까지만 올리고 공식 gate CLOSED를 선언하지 않는다는 문장이 추가되어 README 303–304행과 일치한다. 이전 회차가 확인한 FINAL-SMOKE-1..3 근거(5행 단일 공식본, 9–13행·30행 같은 finding_id 재검수 후 CLOSED, 15–19행·31–32행 PASS·부 O 결정·외부 gate 종결 분리)는 변경 없이 유지된다. 요구된 시험(수정 판본 SHA-256의 장부·manifest·input-snapshot 일치)은 공동 장부 turn-s002·turn-c001·turn-c002의 artifact_hashes ce90ad65…e9ff와 verified_input_files_sha256 09896e24…0aba가 이번 회차 input_files metadata의 artifact sha256·input_files_sha256과 동일함을 확인했다. Codex turn-c002가 기록한 r002 RUN_FAILED(previous_finding_id 미유지)는 산출물·입력 STALE이 아니므로 이번 회차는 같은 finding_id와 previous_finding_id=FINAL-SMOKE-002-IMP-001을 유지한다. 산출물 20–21행과 README 303–304행의 현재 상한 규칙에 따라 Finding 상태는 CLOSED가 아닌 VERIFIED로 올리며, closed_finding_ids는 비운다. 새 Finding 없음. 이 PASS는 필수 Finding이 없다는 검수 판정이며 gate_state는 OPEN으로 유지되고 공식 종결은 decision commit에 대한 보호 원격 필수 체크·보호 ref 반영 또는 사전 승인 외부 attestation이 확정한다.

### 공동 편집 제안 색인

- 없음


- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r003 -->
