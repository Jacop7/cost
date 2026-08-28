# TEAM-CONFIG-GROWTH-001 공동 작업 장부

> 이 장부는 페이블 소진 시 Opus 연속성 감사와 팀 성장형 학습 루프를 정의한 관련 공식 문서의
> append-only 검수 기록이다. 직접 편집은 이 최초 패킷 작성까지만 허용하며 이후 턴은
> `corepack pnpm fable:append` 또는 검수 실행기로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `d6dcdfb04af4bc0c579e07edc36d6104755e2f3c`
- artifact_hashes: `[{ path: docs/팀구성_상세기획안.md, sha256: 28f46a12a91814e49f328c29e20750fda79543c56950a55aa7da662e5eb91bec, change_type: MODIFIED }, { path: docs/ai-review/README.md, sha256: 2138451a2a67e6ac89f73ff05cf6b305194078c2925448d7fde54a5ca7b2eb9a, change_type: MODIFIED }, { path: docs/작업큐.md, sha256: 588de231884b45b51d1962958b5029a61516737379ff43df0c43fa8ff5cbabd1, change_type: MODIFIED }]`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/ai-review/README.md`, `docs/작업큐.md`
- 충족해야 할 요구사항·불변식: `TEAM-CONFIG-1..8`, `AGENTS:single-canonical-artifact`, `AI-REVIEW:successor-handoff`, `TEAM-PLAN:evidence-based-learning-loop`
- 이번에 바꾼 내용: 페이블 모델 소진 때만 Opus가 같은 읽기 전용 독립 감사 역할을 successor Task로 승계하는 규칙과, 증거 기반 팀 학습을 단일 장부에서 검증·재주입·폐기하는 성장 루프를 구성안 v1.1에 추가했다. 실제 runner와 학습 장부 구현은 각각 `AI-REVIEW-2`, `TEAM-LEARNING-1` 완료 전에는 지원됨으로 보고하지 않는다.
- 집중 검토 질문: 소진과 일반 실패가 충분히 분리되는가? Opus 전환이 hash·Finding·권한·예산·독립성 검사를 우회할 수 있는가? 팀 학습이 채팅 기억·경쟁 공식 문서·낡은 정책으로 변질될 수 있는가? 다음 작업에 학습을 주입하고 효과를 측정·폐기하는 루프가 실제 구현 가능한가? 읽기 전용 기준인 AGENTS.md를 포함한 관련 문서 사이에 상태·우선순위·권위 모순이 있는가?
- 실행한 테스트·현재 증거: `corepack pnpm fable:check` 연결 정상, `corepack pnpm fable:self-test` 31개 묶음 통과, 네 문서 `git diff --check` 통과. 제품 코드 변경은 없고 전체 `pnpm verify`는 직전 P1-1 commit `c0b832d`에서 6/6 통과했다.
- 사람 결정이 필요한 항목: Opus 모델의 정확한 allowlist ID·작업 전체 기본 사용 상한은 `AI-REVIEW-2` 구현 시 공식 CLI에서 확인해 고정한다. 정책·위험·프로덕션 종결 권한은 대체하지 않는다.
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=6fd215c6967c9f4a2bc6de56db77aaa64c55f6e3acd8e9c55275602429be7fe4 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `6fd215c6967c9f4a2bc6de56db77aaa64c55f6e3acd8e9c55275602429be7fe4`
- target_commit_sha: `d6dcdfb04af4bc0c579e07edc36d6104755e2f3c`
- input_files_sha256: `72dc0b3896234d8471d1f8057fcc1d584fe7d098d3e8824e5ee5cbbe77323687`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: TCG-001-SUCCESSOR-CONTRACT-GAP, TCG-001-EXHAUSTION-ALLOWLIST-AMBIGUITY, TCG-001-ENGINE-IDENTITY-SCHEMA, TCG-001-LEARNING-PACKET-PROTOCOL, TCG-001-LEARNING-AUDIT-LANE-VERIFIER
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

네 문서(AGENTS.md·팀구성_상세기획안 v1.1·ai-review/README §8·작업큐 AI-REVIEW-2/TEAM-LEARNING-1)는 "Opus 승계와 학습 루프는 정책이며 runner 구현은 AI-REVIEW-2·TEAM-LEARNING-1 완료 전 미지원"이라는 상태 구분을 일관되게 유지하고, 소진 allowlist·비승계 denylist·불변 실패 run·실제 엔진 기록·클린룸 예외 원칙도 서로 모순 없이 기술한다. 그러나 구현 계약으로 쓰기에는 네 가지 구조적 공백이 있다. (1) 현재 유일한 successor 계약인 `predecessor_review`는 README §6과 runner가 FABLE-FINAL/FINAL_INDEPENDENT·predecessor 최신 성공 회차·baseline=predecessor target으로 고정하는데, 소진 승계는 모든 역할·동일 target·실패 run 기반이어야 하므로 두 계약이 충돌하며 어느 문서도 이를 조정하지 않는다. (2) 소진 allowlist의 "회차 예산 소진"이 runner 자체의 `--max-budget-usd` 회차 상한(`budget_exhausted` 안전 종료)과 모델 제공자 한도를 구분하지 않고, "CLI에서 일시적으로 제공되지 않음"이라는 네 번째 사유가 3값 enum에 없다. (3) 결과 스키마·runner에 엔진/모델 필드가 없고, 역할 동일성(Opus가 같은 role ID로 페이블 Finding을 VERIFIED할 수 있는지, 복구된 페이블이 Opus Finding을 검증할 수 있는지)이 정의되지 않았다. (4) §5.2 작업 패킷의 Learning ID 필드는 protocol 1.1이 거부하는 미지 필드인데 TEAM-LEARNING-1의 touches에 runner·schema가 없고, INDEPENDENT-AUDIT 레인 학습의 반대 역할 검증자와 FABLE-SEC·RECHECK 회차에 대한 학습 주입 규칙이 비어 있다. 모두 문서 수준 수정으로 해결 가능하며 proposed_edits로 구체 문구를 제시한다.

### 공동 편집 제안 색인

- TCG-001-E1-README-FALLBACK-SUCCESSOR: ADD `docs/ai-review/README.md` · 이 절은 `AI-REVIEW-2`의 구현 계약이다. runner·schema·task template·사보타주 시험이 함께 반영되기 · 원문은 review.md 참조
- TCG-001-E2-PLAN-EXHAUSTION-REASONS: REPLACE `docs/팀구성_상세기획안.md` · - 페이블 모델의 회차 예산 소진 · 원문은 review.md 참조
- TCG-001-E3-PLAN-CLI-UNAVAILABLE: REPLACE `docs/팀구성_상세기획안.md` · - 페이블 모델이 공식 CLI에서 일시적으로 제공되지 않음 · 원문은 review.md 참조
- TCG-001-E4-README-ENGINE-FIELDS: ADD `docs/ai-review/README.md` · `primary_reviewer_engine`, `reviewer_engine`, 정확한 model ID와 CLI·runner hash를 기록한다. · 원문은 review.md 참조
- TCG-001-E5-QUEUE-AI-REVIEW-2-CRITERIA: ADD `docs/작업큐.md` · - `corepack pnpm fable:check`, `fable:self-test`, `corepack pnpm verify`가 모두 통과한다. · 원문은 review.md 참조
- TCG-001-E6-PLAN-LEARNING-FIELDS-NOTE: ADD `docs/팀구성_상세기획안.md` · - Excluded / RETIRED Learning IDs and reason: · 원문은 review.md 참조
- TCG-001-E7-QUEUE-TEAM-LEARNING-TOUCHES: REPLACE `docs/작업큐.md` · touches: [docs/team/TEAM_LEARNING.md, docs/team/ROLE_CONTEXTS.md, docs/작업큐.md, docs/ai-review/templates/, docs/팀구성_상세기획안.md] · 원문은 review.md 참조
- TCG-001-E8-QUEUE-TEAM-LEARNING-CRITERIA: REPLACE `docs/작업큐.md` · - 독립 종합 감사 최초 회차에는 팀 결론 요약을 넣지 않아 클린룸 독립성을 유지한다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `6fd215c6967c9f4a2bc6de56db77aaa64c55f6e3acd8e9c55275602429be7fe4`
- target_commit_sha: `4a7b9fde198d944a9b0e9e593bc7a573a84cb52d`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/ai-review/README.md`, `docs/작업큐.md`
- resulting_input_files_sha256: `새 COMMIT Task의 manifest에서 실행기가 봉인·검증 예정`
- artifact_hashes: `[{ path: docs/팀구성_상세기획안.md, sha256: 21962f492c6c7ee22e7205529583477b6b492e87ea304adb82dbf67ea06b8a87, change_type: MODIFIED }, { path: docs/ai-review/README.md, sha256: 3429a8e9432a0449ff824f80d15eba1c8ccb258f023b5306681385ca26f409dc, change_type: MODIFIED }, { path: docs/작업큐.md, sha256: 63fe6ab8ff8cbbada9f09cd0a08a80c4097cef8dff9945c4fdde0ce432466b7f, change_type: MODIFIED }]`

### TCG-001-SUCCESSOR-CONTRACT-GAP

- disposition: `APPLIED`
- 적용 위치: `docs/ai-review/README.md` §6·§8, `docs/팀구성_상세기획안.md` §3.10.1, `docs/작업큐.md` AI-REVIEW-2
- 적용 내용: 소진 승계를 기존 FABLE-FINAL commit 변경 successor와 분리하고 모든 reviewer role·동일 baseline/target·RUN_FAILED 기점의 별도 handoff로 정의했다. 성공 회차 유무에 따른 RECHECK/INITIAL, 실패 run 실제 사용액 차감, protocol 1.2 예정 상태를 명시했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: `git diff --check`, `corepack pnpm fable:self-test`
- 필요한 재검수: 새 commit에서 계약 분리와 완료 조건의 일치 여부

### TCG-001-EXHAUSTION-ALLOWLIST-AMBIGUITY

- disposition: `APPLIED`
- 적용 위치: `docs/ai-review/README.md` §8, `docs/팀구성_상세기획안.md` §3.10.1, `docs/작업큐.md` AI-REVIEW-2
- 적용 내용: MODEL_BUDGET_EXHAUSTED를 제공자·구독의 구조화된 한도 오류로 한정하고 runner `budget_exhausted`, 자유 텍스트, CLI allowlist·모델 설정 오류를 승계에서 제외했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: 문서 상호 대조, `git diff --check`
- 필요한 재검수: allowlist/denylist가 세 문서에서 같은 의미인지 확인

### TCG-001-ENGINE-IDENTITY-SCHEMA

- disposition: `APPLIED`
- 적용 위치: `docs/ai-review/README.md` §8, `docs/팀구성_상세기획안.md` §3.10.1·§5.5, `docs/작업큐.md` AI-REVIEW-2
- 적용 내용: review/run/status/장부에 실제 엔진·모델·CLI/runner 출처를 필수 기록하고 OPUS-FALLBACK을 컨텍스트 ID로 한정했다. 검증 권한은 원 reviewer role 기준이며 고위험 Opus 검증은 페이블 표본 재감사 전 게이트 종결에 쓰지 않도록 했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: 문서 상호 대조, `corepack pnpm fable:self-test`
- 필요한 재검수: 엔진 출처와 검증 권한 규칙의 완결성

### TCG-001-LEARNING-PACKET-PROTOCOL

- disposition: `APPLIED`
- 적용 위치: `docs/ai-review/README.md` §6, `docs/팀구성_상세기획안.md` §5.2, `docs/작업큐.md` TEAM-LEARNING-1
- 적용 내용: Learning ID는 TEAM-LEARNING-1 전 task.json 계약이 아니며 SOLAR_REQUEST 본문에만 기록한다고 명시했다. protocol 1.2 후보와 1.1 보존 규칙, runner/schema touches, 미검증·폐기 ID 및 최초 클린룸 회차 차단 조건을 추가했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: `corepack pnpm fable:self-test` 31개 묶음 통과
- 필요한 재검수: 지원 상태 구분과 차기 구현 범위가 충분한지 확인

### TCG-001-LEARNING-AUDIT-LANE-VERIFIER

- disposition: `APPLIED`
- 적용 위치: `docs/팀구성_상세기획안.md` §5.6, `docs/작업큐.md` TEAM-LEARNING-1
- 적용 내용: INDEPENDENT-AUDIT 후보는 페이블 review.json 원본을 AI 부 O가 전사하고 Codex 실행 증거 또는 사람만 검증하도록 했다. FABLE-SEC 최초 회차에도 클린룸을 적용하고 RECHECK에는 VERIFIED Learning ID 목록만 허용했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: 문서 상호 대조, `git diff --check`
- 필요한 재검수: 감사 레인 검증 독립성과 주입 경계 확인

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `4a7b9fde198d944a9b0e9e593bc7a573a84cb52d`
- verified_input_files_sha256: `새 COMMIT Task의 manifest에서 실행기가 봉인·검증 예정`
- artifact_hashes: `[{ path: docs/팀구성_상세기획안.md, sha256: 21962f492c6c7ee22e7205529583477b6b492e87ea304adb82dbf67ea06b8a87, change_type: MODIFIED }, { path: docs/ai-review/README.md, sha256: 3429a8e9432a0449ff824f80d15eba1c8ccb258f023b5306681385ca26f409dc, change_type: MODIFIED }, { path: docs/작업큐.md, sha256: 63fe6ab8ff8cbbada9f09cd0a08a80c4097cef8dff9945c4fdde0ce432466b7f, change_type: MODIFIED }]`
- finding_ids: `TCG-001-SUCCESSOR-CONTRACT-GAP`, `TCG-001-EXHAUSTION-ALLOWLIST-AMBIGUITY`, `TCG-001-ENGINE-IDENTITY-SCHEMA`, `TCG-001-LEARNING-PACKET-PROTOCOL`, `TCG-001-LEARNING-AUDIT-LANE-VERIFIER`
- 실행 명령: `git diff --check`; `corepack pnpm fable:check`; `corepack pnpm fable:self-test`; 정확한 commit·파일 SHA-256 재계산
- 종료 코드·결과: 전부 0; Claude Code 2.1.250 연결·로그인 정상; wrapper self-test 31개 묶음 통과; 수정 범위는 세 공식 문서뿐인 commit `4a7b9fd`
- 증거 파일·로그 위치: `docs/ai-review/tasks/TEAM-CONFIG-GROWTH-001/rounds/r001/review.json`; 수정 공식본 commit `4a7b9fde198d944a9b0e9e593bc7a573a84cb52d`
- 미실행 항목과 이유: 제품 코드·DB 변경이 없는 문서 검수 응답이므로 `corepack pnpm verify`는 재실행하지 않았다. 직전 P1-1 commit `c0b832d`에서 6/6 통과했으며 새 문서가 요구하는 AI-REVIEW-2·TEAM-LEARNING-1 구현 게이트는 각 후속 작업에서 실행한다. protocol 1.1은 COMMIT Task의 target 변경을 허용하지 않으므로 원 Task r002를 허위 재검수하지 않고 새 COMMIT Task로 수정판을 독립 검수한다.
- next_review_request: `FABLE_RECHECK`
