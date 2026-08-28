# AI-REVIEW-2-FALLBACK-CONTINUITY-001 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `SECURITY`
- 스냅샷: `COMMIT`
- 대상 SHA: `4eadc9a185204ae8bf27a69cd9c40f25e0ed05ba`

## 요약

protocol 1.2 Fable→Opus 소진 fallback 경로를 보안 관점에서 검수했다. 강점: 승계 사유 allowlist가 구조화 코드만 받고 회차 상한 `budget_exhausted`는 TASK_CAP_APPROVAL_REQUIRED로 분리되며(protocol-v12.mjs 33-41), successor는 실패 run hash·fallback_eligible·target/입력/산출물 hash·registry hash·장부 bytes/hash·handoff turn/entry/run hash·handoff-only source commit·실사용액을 모두 대조하고(fable-review.mjs 2584-2716), Opus 실패는 FALLBACK_UNAVAILABLE로 폐쇄되며(4985-5001) closure 계약은 검증 후 실행을 중단한다(4563-4574). 결과 엔진 필드는 manifest·review·run·status에 결합된다. 그러나 다음 결함이 남는다. (1) successor가 `task_budget_usd`를 4.00보다 크게 선언하면 잔여액 산식이 successor의 상한을 기준으로 통과하고 predecessor 상한·사람 승인과 대조되지 않아 AI-REVIEW-2-3의 "사람 승인 없는 상한 초과 fallback 금지"가 우회된다. (2) `verified_by_engine`은 Opus 결과의 VERIFIED에만 강제되어 Fable 결과가 Opus 검증으로 위장하거나 비-VERIFIED Finding에 임의 엔진을 붙일 수 있어 AI-REVIEW-2-4의 실제 엔진 기록이 깨진다. (3) required_evidence가 주장한 handoff hash·closure 중단·FALLBACK_UNAVAILABLE 부정 시험이 실행기 자체시험에 없고 `loadPinnedFallbackReview`는 어떤 시험에서도 호출되지 않는다. (4) `fable:append`는 AI_DEPUTY_FALLBACK_HANDOFF를 형식만 검사해 실제 소진 실패 run이 없어도 handoff 턴이 장부에 남을 수 있다. 판정은 CHANGES_REQUIRED이며 protocol 1.1 호환성 파괴는 발견하지 못했다.

## Findings

### SEC-FB-001-TASK-CAP-RAISE-UNCHECKED — Major / OPEN

- 범주: SECURITY
- 영향: gate owner가 successor task.json의 task_budget_usd만 올리면 사람 승인 없이 작업 전체 상한을 넘겨 Opus를 실행할 수 있어 예산 통제와 AI-REVIEW-2-3이 무력화된다.
- 근거: scripts/fable-review/protocol-v12.mjs:79, scripts/fable-review.mjs:2599, scripts/fable-review.mjs:2676, docs/팀구성_상세기획안.md:613
- 완료 조건: loadPinnedFallbackReview가 sourceTask.task_budget_usd !== task.task_budget_usd이면 STALE(75)로 거부한다. / task_budget_usd가 DEFAULT_TASK_CAP_USD를 넘는 protocol 1.2 Task는 장부의 HUMAN_DECISION 턴에 machine-readable 상한 승인 pin(예: `- task_budget_usd_approved: `X.XX``)이 있어야 실행되고 없으면 TASK_CAP_APPROVAL_REQUIRED로 실패한다. / README §페이블 소진에 상한 상향 절차와 successor 상한 동일성 규칙을 명시한다.
- 필요한 테스트: successor task_budget_usd를 10.00으로 올린 fallback Task가 exit 75로 거부되는 부정 시험 / 승인 pin 없는 4.01 이상 Task가 exit 64 TASK_CAP_APPROVAL_REQUIRED로 실패하는 부정 시험

### SEC-FB-002-VERIFIED-BY-ENGINE-MISATTRIBUTION — Major / OPEN

- 범주: DATA_INTEGRITY
- 영향: Finding registry와 장부에 실제 실행 엔진과 다른 검증 엔진이 기록될 수 있어 Opus 검증 표본 재감사 요건(FABLE-SEC/FINAL)을 회피하거나 반대로 Fable 검증을 Opus로 위장할 수 있다.
- 근거: scripts/fable-review/protocol-v12.mjs:150, scripts/fable-review.mjs:2857, scripts/fable-review.mjs:3028, docs/ai-review/README.md:391
- 완료 조건: 모든 엔진에서 review_state===VERIFIED이면 verified_by_engine이 정확히 expected.engine과 같아야 한다. / review_state가 VERIFIED가 아니면 verified_by_engine은 null이어야 한다(승계된 과거 VERIFIED를 재기록하는 경우는 registry의 기존 값과 동일해야 함). / 위반 시 RESULT_BINDING_MISMATCH 또는 별도 failure code로 exit 76.
- 필요한 테스트: Fable 결과의 VERIFIED Finding에 OPUS_FALLBACK을 적으면 거부 / OPEN Finding에 verified_by_engine 비-null이면 거부 / Opus 결과의 VERIFIED Finding에 FABLE을 적으면 거부(기존)

### SEC-FB-003-FALLBACK-RUNNER-NEGATIVE-TESTS-MISSING — Major / OPEN

- 범주: TEST_GAP
- 영향: AI-REVIEW-2-2의 핵심인 '하나라도 바꾸면 successor가 통과하지 않는다'가 회귀해도 fable:self-test가 감지하지 못하고, 장부의 시험 증거 주장이 실제 코드와 불일치한다.
- 근거: scripts/fable-review.mjs:7214, scripts/fable-review.mjs:2584, scripts/fable-review.mjs:4563, scripts/fable-review/protocol-v12.test.mjs:31, COLLABORATION_LOG:0
- 완료 조건: pinned-successor 통합 시험과 동형으로 실제 git clone·RUN_FAILED run.json·AI_DEPUTY_FALLBACK_HANDOFF 턴을 만든 뒤 loadPinnedFallbackReview 성공 경로 1건과 from_run_sha256·handoff_entry_sha256·spent_usd·reason·source commit 오염 각각의 거부 시험을 추가한다. / closure_review가 있는 Task 실행이 exit 65 메시지 'P0-2 보호 원격 validator'로 중단되는 시험을 추가한다. / Opus 엔진 실패 run이 fallback_eligible=false·fallback_reason=FALLBACK_UNAVAILABLE로 기록되는 시험을 추가한다. / 장부 SOLAR 턴의 증거 주장을 실제 시험 이름과 함께 갱신한다.
- 필요한 테스트: fallback-successor-import-rejects-any-tampered-pin / closure-successor-halts-before-p0-2 / opus-failure-is-fallback-unavailable

### SEC-FB-004-HANDOFF-APPEND-UNBOUND — Minor / OPEN

- 범주: SECURITY
- 영향: 소진이 아닌 실패나 존재하지 않는 run에 대한 handoff가 장부에 기록될 수 있어 감사 이력이 오염되고, 잘못된 handoff 이후 정상 승계 재시도 경로가 불명확하다.
- 근거: scripts/fable-review.mjs:3298, scripts/fable-review.mjs:2662
- 완료 조건: append 경로에서 AI_DEPUTY_FALLBACK_HANDOFF는 rounds 최신 공개 회차가 run_state=RUN_FAILED·fallback_eligible=true·fallback_reason=reason이고 from_run_sha256·target_commit_sha·input_files_sha256·artifact_set_sha256·finding_registry_sha256·spent_usd가 실제 기록과 일치할 때만 수용한다. / handoff 턴 이후 같은 Task에 새 Fable 회차를 시작하면 거부하거나, 재시도를 허용하는 규칙을 README에 명시한다.
- 필요한 테스트: 소진 실패 run이 없는 Task에 fallback handoff append 시 exit 65 / spent_usd가 실제 total_cost_usd 합과 다른 handoff append 시 exit 65

### SEC-FB-005-SPENT-ROUNDING-NULL-COST — Improvement / OPEN

- 범주: CODE
- 영향: 실사용액 대조가 반올림 경계에서 false negative를 내거나 envelope 없는 실패의 비용이 상한 차감에서 빠질 수 있다.
- 근거: scripts/fable-review.mjs:2695, scripts/fable-review.mjs:3843
- 완료 조건: 센트 단위 정수 합산으로 비교하고 README에 반올림 규칙을 명시한다. / total_cost_usd가 null인 회차가 있으면 spent 대조를 보수적으로 처리(예: 해당 회차의 max_budget_usd를 가산)하거나 사람 확인을 요구한다.
- 필요한 테스트: 1.005+1.005 합산 경계 시험 / total_cost_usd null 회차 포함 시 잔여액 계산 시험

## 공동 편집 제안

### EDIT-SEC-FB-001-CAP-PARITY — ADD

- 대상: `scripts/fable-review.mjs`
- 위치:       || sourceTask.snapshot_mode !== task.snapshot_mode
- 연결 Finding: SEC-FB-001-TASK-CAP-RAISE-UNCHECKED
- 이유: fallback successor가 predecessor와 다른 작업 전체 상한을 선언하지 못하게 해 사람 승인 없는 상한 상향을 막는다.

          || sourceTask.task_budget_usd !== task.task_budget_usd

### EDIT-SEC-FB-002-ENGINE-ATTRIBUTION — REPLACE

- 대상: `scripts/fable-review/protocol-v12.mjs`
- 위치:   if (expected.engine === FALLBACK_REVIEWER_ENGINE) {
- 연결 Finding: SEC-FB-002-VERIFIED-BY-ENGINE-MISATTRIBUTION
- 이유: 모든 엔진에서 Finding의 검증 엔진이 실제 실행 엔진과 일치하도록 강제해 위장을 차단한다. 기존 Opus 전용 블록은 새 루프가 포괄하므로 통합 시 제거한다.

      for (const finding of result.findings ?? []) {
        const verified = finding.review_state === 'VERIFIED';
        if (verified && finding.verified_by_engine !== expected.engine) {
          throw new Error(`VERIFIED Finding의 verified_by_engine은 실제 엔진(${expected.engine})이어야 합니다.`);
        }
        if (!verified && finding.verified_by_engine !== null) {
          throw new Error('VERIFIED가 아닌 Finding에는 verified_by_engine을 기록할 수 없습니다.');
        }
      }
      if (false) {

### EDIT-SEC-FB-001-README-CAP-RULE — ADD

- 대상: `docs/ai-review/README.md`
- 위치: - Opus의 정확한 model ID와 작업 전체 사용 상한의 남은 범위
- 연결 Finding: SEC-FB-001-TASK-CAP-RAISE-UNCHECKED
- 이유: 코드 변경과 같은 규칙을 공식 문서에 명시한다.

    - successor `task_budget_usd`는 predecessor와 동일해야 하며, 기본 상한 `4.00`을 넘는 값은 predecessor 장부의 `HUMAN_DECISION` 턴에 machine-readable 승인 pin이 있을 때만 허용한다

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: SEC-FB-001-TASK-CAP-RAISE-UNCHECKED, SEC-FB-002-VERIFIED-BY-ENGINE-MISATTRIBUTION, SEC-FB-003-FALLBACK-RUNNER-NEGATIVE-TESTS-MISSING, SEC-FB-004-HANDOFF-APPEND-UNBOUND

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
