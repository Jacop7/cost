# TEAM-CONFIG-GROWTH-002 공동 작업 장부

> 이 장부는 TEAM-CONFIG-GROWTH-001 r001의 필수 Finding 5건을 반영한 확정 문서 판본을 새 COMMIT
> Task에서 전체 재검수하는 append-only 기록이다. protocol 1.1의 기존 Task target 불변 규칙을
> 우회하지 않으며 이후 턴은 `corepack pnpm fable:append` 또는 검수 실행기로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `4a7b9fde198d944a9b0e9e593bc7a573a84cb52d`
- artifact_hashes: `[{ path: docs/팀구성_상세기획안.md, sha256: 21962f492c6c7ee22e7205529583477b6b492e87ea304adb82dbf67ea06b8a87, change_type: MODIFIED }, { path: docs/ai-review/README.md, sha256: 3429a8e9432a0449ff824f80d15eba1c8ccb258f023b5306681385ca26f409dc, change_type: MODIFIED }, { path: docs/작업큐.md, sha256: 63fe6ab8ff8cbbada9f09cd0a08a80c4097cef8dff9945c4fdde0ce432466b7f, change_type: MODIFIED }]`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/ai-review/README.md`, `docs/작업큐.md`
- 충족해야 할 요구사항·불변식: `TEAM-CONFIG-1..8`, `TCG-001-SUCCESSOR-CONTRACT-GAP`, `TCG-001-EXHAUSTION-ALLOWLIST-AMBIGUITY`, `TCG-001-ENGINE-IDENTITY-SCHEMA`, `TCG-001-LEARNING-PACKET-PROTOCOL`, `TCG-001-LEARNING-AUDIT-LANE-VERIFIER`
- 이번에 바꾼 내용: provider 구조화 소진만 허용하고 runner 상한·인증·설정 오류를 제외했다. 소진 handoff를 기존 최종감사 successor와 분리하고, 실제 엔진 증명과 원 reviewer role 기반 검증 권한을 정의했다. Learning ID는 protocol 1.2 예정 계약으로 명시하고 감사 레인 검증자·클린룸·RECHECK 주입 경계를 보완했다.
- 집중 검토 질문: 원 r001 필수 Finding 5건의 완료 조건이 세 문서에 모두 반영됐는가? 차기 구현 계획을 현재 기능으로 오인할 문구가 남았는가? Opus·학습 경로가 기존 hash-chain·게이트·독립성 규칙을 약화하는가?
- 실행한 테스트·현재 증거: `git diff --check` 통과, `corepack pnpm fable:check` 연결 정상, `corepack pnpm fable:self-test` 31개 묶음 통과. 제품 코드·DB 변경은 없어 전체 verify는 재실행하지 않았다.
- 사람 결정이 필요한 항목: 정확한 Opus CLI model ID와 작업 전체 기본 사용 상한은 AI-REVIEW-2 구현 시 공식 CLI에서 확인해 고정한다. 정책·위험·프로덕션 종결 권한은 대체하지 않는다.
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=1bb7aa69fc4a9bfea564aee1174d35d79f3c910ec97d10115d8dc9522d785f01 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `1bb7aa69fc4a9bfea564aee1174d35d79f3c910ec97d10115d8dc9522d785f01`
- target_commit_sha: `4a7b9fde198d944a9b0e9e593bc7a573a84cb52d`
- input_files_sha256: `990efaf9b89d5665fac1fc3b47b9f50e9455bcfdb2595a62ab2e911f59715ef7`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: TCG-002-SEC-CLEANROOM-LEARNING-LEAK, TCG-002-FALLBACK-LEDGER-CONTINUITY, TCG-002-REVIEW-MODE-SEMANTICS, TCG-002-HANDOFF-TURN-REGISTRY, TCG-002-QUEUE-ENGINE-AUTHORITY-GAP
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

TEAM-CONFIG-GROWTH-001 r001의 필수 Finding 5건은 세 문서에 대체로 반영됐다. 소진 사유 allowlist(MODEL_BUDGET_EXHAUSTED·MODEL_RATE_LIMITED·MODEL_CAPACITY_UNAVAILABLE)와 runner `budget_exhausted`·인증·설정·hash·계약 오류의 비승계 구분, §6 `predecessor_review`와의 분리, 엔진 출처 기록·원 reviewer role 검증 권한, Learning ID의 protocol 1.2 예정 계약·VERIFIED-only·클린룸 거부, INDEPENDENT-AUDIT 검증자 제한, AI-REVIEW-2 미구현 상태 표기는 README·기획안·작업큐가 서로 모순 없이 일치하며 runner의 TASK_KEYS_V11·SAFE_CLAUDE_TERMINAL_REASONS·FINAL_INDEPENDENT 검사와도 부합한다. 다만 새로 확인한 문제 2건이 Major다. (1) 기획안 §5.2가 TEAM-LEARNING-1 전 Learning ID를 `SOLAR_REQUEST` 본문에 기록하도록 하는데, runner는 FINAL_INDEPENDENT 외 모든 route(SECURITY 포함)에 공동 장부를 전송하므로 FABLE-SEC 최초 회차 클린룸 규칙(§5.6, README §6)과 정면 충돌한다. (2) 소진 승계 successor가 `RECHECK`를 수행하려면 predecessor의 SOLAR_RESPONSE·CODEX_EVIDENCE 장부가 필요한데, 봉인 항목 목록에 predecessor 장부 hash·source commit이 없어 §6 successor 계약과 달리 RECHECK 완결성이 정의되지 않았다. Minor 3건: FABLE-SEC/FABLE-FINAL의 task.review_mode는 runner상 SECURITY/FINAL로 고정되므로 문서의 `INITIAL`/`RECHECK`가 review_mode 값인지 승계 의미인지 명시 필요, README §5·기획안 §5.3 턴 목록에 `AI_DEPUTY_FALLBACK_HANDOFF`(및 기획안의 `AI_DEPUTY_SUCCESSOR_HANDOFF`) 미등재와 기획안의 미정의 토큰 `FABLE_EXHAUSTED`, 작업큐 AI-REVIEW-2 완료 조건에 원 reviewer role 검증 권한·`verified_by_engine`·Opus model ID/작업 전체 기본 상한 사람 결정 항목 누락. PASS는 게이트 종결이 아니며 gate_state는 OPEN을 유지한다.

### 공동 편집 제안 색인

- TCG-002-E1: REPLACE `docs/팀구성_상세기획안.md` · 미지 필드로 거부한다. 그 전까지는 `SOLAR_REQUEST` 턴 본문에만 기록한다. · 원문은 review.md 참조
- TCG-002-E2: ADD `docs/ai-review/README.md` · - 고위험 `FABLE-SEC`·`FABLE-FINAL` 결과의 페이블 복구 후 표본 재감사 조건 · 원문은 review.md 참조
- TCG-002-E3: ADD `docs/ai-review/README.md` · 소진되어 성공 회차가 없으면 inherited Finding 0건인 `INITIAL`로 실행한다. 실패 run의 실제 사용액은 · 원문은 review.md 참조
- TCG-002-E4: ADD `docs/ai-review/README.md` · - `AI_DEPUTY_SUCCESSOR_HANDOFF` — 새 COMMIT Task가 이전 Finding을 재검수하도록 승인하는 기계 판독 턴 · 원문은 review.md 참조
- TCG-002-E5: ADD `docs/작업큐.md` · - 실패 run의 실제 사용액을 작업 전체 상한에서 차감하고, 초과 승계는 사람 승인 없이는 `BLOCKED`다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `1bb7aa69fc4a9bfea564aee1174d35d79f3c910ec97d10115d8dc9522d785f01`
- target_commit_sha: `330df4d0f99d386133d4edec4c79fccc34bc4a5b`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/ai-review/README.md`, `docs/작업큐.md`
- resulting_input_files_sha256: `새 COMMIT Task manifest에서 봉인 예정`
- artifact_hashes: `[{ path: docs/팀구성_상세기획안.md, sha256: c07ebc1feaf7cf2876a9a4781401ef2b562dac360b2d692c9ef20172465d903a, change_type: MODIFIED }, { path: docs/ai-review/README.md, sha256: cb2514d85395f02b541709a95c9104ab677578981b1639e9038f07fdb0697cb8, change_type: MODIFIED }, { path: docs/작업큐.md, sha256: cae75a72a7aae272dcea623f37af51fba25878b00dac246d9ba12146096f5757, change_type: MODIFIED }]`

### TCG-002-SEC-CLEANROOM-LEARNING-LEAK
- disposition: `APPLIED`
- 적용 위치: 기획안 §5.2, README §6, 작업큐 TEAM-LEARNING-1
- 적용 내용: protocol 1.1 과도기도 VERIFIED ID만 허용하고 SECURITY 첫 회차와 FABLE-FINAL SOLAR_REQUEST에는 ID·요약을 금지했다. 구현 전 수동 확인과 구현 후 장부 탐지·거부 시험을 명시했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: 문서 상호 대조, `git diff --check`
- 필요한 재검수: 클린룸 누출 경로 확인

### TCG-002-FALLBACK-LEDGER-CONTINUITY
- disposition: `APPLIED`
- 적용 위치: README §8, 기획안 §3.10.1·§5.5, 작업큐 AI-REVIEW-2
- 적용 내용: predecessor 장부 bytes/hash, fallback handoff turn/entry/run hash와 handoff 전용 source commit을 봉인하고 RECHECK 전체 장부·INITIAL SOLAR_REQUEST 범위를 정의했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: 문서 상호 대조, `corepack pnpm fable:self-test`
- 필요한 재검수: 장부 연속성 계약 확인

### TCG-002-REVIEW-MODE-SEMANTICS
- disposition: `APPLIED`
- 적용 위치: README §8, 기획안 §3.10.1, 작업큐 AI-REVIEW-2
- 적용 내용: INITIAL/RECHECK는 registry 승계 의미이고 SECURITY/FINAL route의 task.review_mode는 그대로 유지하도록 정의하고 잘못된 값 거부 시험을 추가했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: 문서와 runner route 검사 대조
- 필요한 재검수: 용어와 실제 route 계약 일치 확인

### TCG-002-HANDOFF-TURN-REGISTRY
- disposition: `APPLIED`
- 적용 위치: README §5, 기획안 §3.10.1·§5.3
- 적용 내용: 두 handoff 턴을 목록에 넣고 fallback handoff는 protocol 1.2 예약으로 제한했다. 미정의 FABLE_EXHAUSTED 토큰은 allowlist 구조화 소진 사유 표현으로 교체했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: `rg`로 턴·토큰 일치 확인
- 필요한 재검수: 턴 registry 일치 확인

### TCG-002-QUEUE-ENGINE-AUTHORITY-GAP
- disposition: `APPLIED`
- 적용 위치: 작업큐 AI-REVIEW-2
- 적용 내용: 원 reviewer_role 불변, verified_by_engine, 원 role 기반 VERIFIED 권한 시험과 Opus model ID·작업 전체 기본 상한 HUMAN_DECISION 대기를 추가했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: 문서 상호 대조
- 필요한 재검수: 완료 조건 단일 출처 완결성 확인

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `330df4d0f99d386133d4edec4c79fccc34bc4a5b`
- verified_input_files_sha256: `새 COMMIT Task manifest에서 봉인 예정`
- artifact_hashes: `[{ path: docs/팀구성_상세기획안.md, sha256: c07ebc1feaf7cf2876a9a4781401ef2b562dac360b2d692c9ef20172465d903a, change_type: MODIFIED }, { path: docs/ai-review/README.md, sha256: cb2514d85395f02b541709a95c9104ab677578981b1639e9038f07fdb0697cb8, change_type: MODIFIED }, { path: docs/작업큐.md, sha256: cae75a72a7aae272dcea623f37af51fba25878b00dac246d9ba12146096f5757, change_type: MODIFIED }]`
- finding_ids: `TCG-002-SEC-CLEANROOM-LEARNING-LEAK`, `TCG-002-FALLBACK-LEDGER-CONTINUITY`, `TCG-002-REVIEW-MODE-SEMANTICS`, `TCG-002-HANDOFF-TURN-REGISTRY`, `TCG-002-QUEUE-ENGINE-AUTHORITY-GAP`
- 실행 명령: `git diff --check`; `corepack pnpm fable:self-test`; 파일 SHA-256·commit tree 재계산
- 종료 코드·결과: 전부 0; wrapper self-test 31개 묶음 통과; 세 공식 문서만 commit `330df4d`에 반영
- 증거 파일·로그 위치: `docs/ai-review/tasks/TEAM-CONFIG-GROWTH-002/rounds/r001/review.json`; 수정 공식본 commit `330df4d0f99d386133d4edec4c79fccc34bc4a5b`
- 미실행 항목과 이유: 문서 변경만 있어 제품 전체 verify는 재실행하지 않았다. protocol 1.1 COMMIT target 불변 때문에 수정판은 새 COMMIT Task로 검수한다.
- next_review_request: `FABLE_RECHECK`
