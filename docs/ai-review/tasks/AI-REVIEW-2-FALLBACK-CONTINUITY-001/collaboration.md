# AI-REVIEW-2-FALLBACK-CONTINUITY-001 공동 작업 장부

> 이 장부는 페이블 소진 시 Opus 연속성 경로와 protocol 1.2 감사 계약을 솔라와 페이블이 함께
> 개선하는 append-only 기록이다. 직접 편집은 이 최초 패킷 작성까지만이며 이후 턴은
> `corepack pnpm fable:append` 또는 검수 실행기로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `4eadc9a185204ae8bf27a69cd9c40f25e0ed05ba`
- artifact_hashes: `[{ path: package.json, sha256: 0aee1633e6aec37c59f67eb17ae8d7cb15d9db1529039ab1e6f2c94acf1e440f, change_type: MODIFIED }, { path: scripts/fable-review.mjs, sha256: 1d96769d27726c4be3ccda4efc43d9d900b8a426178e9adf632e843d92c6f2b3, change_type: MODIFIED }, { path: scripts/fable-review/protocol-v12.mjs, sha256: 40a2980f0bdb7c8a84b25e68be6192e1da07f2e57235fcc3978fa8f3bfac20d9, change_type: ADDED }, { path: scripts/fable-review/protocol-v12.test.mjs, sha256: 3976de76a583956fdf566f1a8a607200e4cc391648291b60e705ca63ded7e712, change_type: ADDED }, { path: docs/ai-review/README.md, sha256: ce257243aa8a75870a8baf116e17e0082a8bb8d430b4574a6d068dbcbda04ca4, change_type: MODIFIED }, { path: docs/ai-review/templates/task-v12-primary.example.json, sha256: 300267f35593db039c460017174488b135d7d34d79731db80c64834d402abdcf, change_type: ADDED }, { path: docs/ai-review/templates/task-v12-fallback.example.json, sha256: c784477e8ca3d75a53c1a1078580533887e09d2835f6f0d54e479d6a6920aff8, change_type: ADDED }, { path: docs/팀구성_상세기획안.md, sha256: 8aab0c13ddc0ea5663c9d667112b262960261a79a5c59f0853a7762b605a6789, change_type: MODIFIED }, { path: docs/작업큐.md, sha256: 4a31fdaa137ec6a61095b64e919168356a6cac73c801e01def03c3ec63c7c208, change_type: MODIFIED }]`
- changed_artifact_paths: `package.json`, `scripts/fable-review.mjs`, `scripts/fable-review/protocol-v12.mjs`, `scripts/fable-review/protocol-v12.test.mjs`, `docs/ai-review/README.md`, `docs/ai-review/templates/task-v12-primary.example.json`, `docs/ai-review/templates/task-v12-fallback.example.json`, `docs/팀구성_상세기획안.md`, `docs/작업큐.md`
- 충족해야 할 요구사항·불변식: `AI-REVIEW-2-1..6`, Fable primary, append-only audit, 작업 전체 4.00 USD 상한, P0-2 전 CLOSED 금지
- 이번에 바꾼 내용: protocol 1.2 task/result 계약, Fable→Opus 구조화 소진 fallback, 엔진 출처와 비용 승계, handoff-only source 검증, closure 구조 검증과 P0-2 전 실행 중단을 추가했다.
- 집중 검토 질문: 비승계 오류나 일반 예산 초과가 Opus 전환으로 위장될 수 있는가? 실패 run·장부·Finding registry·산출물·사용액 중 하나를 바꿔도 successor가 통과하는가? Opus 결과가 Fable 또는 CLOSED 근거로 위장될 수 있는가? protocol 1.1 원본 호환성이 깨지는가?
- 실행한 테스트·현재 증거: `fable:self-test` 35개 묶음, protocol 1.2 계약 18/18, `fable:check`, `corepack pnpm verify` 6/6 통과. 전체 verify는 DB 32/32·경합·parity·업그레이드 8/8·웹 번들을 포함한다.
- 사람 결정이 필요한 항목: 없음. 사용자는 기존 Max CLI 세션과 작업 전체 4.00 USD 상한을 승인했고 Opus는 실제 소진 때만 사용한다.
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=56fc8813423b4634c17436c748f7036cccccec05bf2062f04af05b121800d0d0 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `56fc8813423b4634c17436c748f7036cccccec05bf2062f04af05b121800d0d0`
- target_commit_sha: `4eadc9a185204ae8bf27a69cd9c40f25e0ed05ba`
- input_files_sha256: `e149f13a4a17d75e710666ccc6d8bdf242e451adac0569e8287c924d331fc5fb`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: SEC-FB-001-TASK-CAP-RAISE-UNCHECKED, SEC-FB-002-VERIFIED-BY-ENGINE-MISATTRIBUTION, SEC-FB-003-FALLBACK-RUNNER-NEGATIVE-TESTS-MISSING, SEC-FB-004-HANDOFF-APPEND-UNBOUND
- 선택 미종결 Finding: SEC-FB-005-SPENT-ROUNDING-NULL-COST
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

protocol 1.2 Fable→Opus 소진 fallback 경로를 보안 관점에서 검수했다. 강점: 승계 사유 allowlist가 구조화 코드만 받고 회차 상한 `budget_exhausted`는 TASK_CAP_APPROVAL_REQUIRED로 분리되며(protocol-v12.mjs 33-41), successor는 실패 run hash·fallback_eligible·target/입력/산출물 hash·registry hash·장부 bytes/hash·handoff turn/entry/run hash·handoff-only source commit·실사용액을 모두 대조하고(fable-review.mjs 2584-2716), Opus 실패는 FALLBACK_UNAVAILABLE로 폐쇄되며(4985-5001) closure 계약은 검증 후 실행을 중단한다(4563-4574). 결과 엔진 필드는 manifest·review·run·status에 결합된다. 그러나 다음 결함이 남는다. (1) successor가 `task_budget_usd`를 4.00보다 크게 선언하면 잔여액 산식이 successor의 상한을 기준으로 통과하고 predecessor 상한·사람 승인과 대조되지 않아 AI-REVIEW-2-3의 "사람 승인 없는 상한 초과 fallback 금지"가 우회된다. (2) `verified_by_engine`은 Opus 결과의 VERIFIED에만 강제되어 Fable 결과가 Opus 검증으로 위장하거나 비-VERIFIED Finding에 임의 엔진을 붙일 수 있어 AI-REVIEW-2-4의 실제 엔진 기록이 깨진다. (3) required_evidence가 주장한 handoff hash·closure 중단·FALLBACK_UNAVAILABLE 부정 시험이 실행기 자체시험에 없고 `loadPinnedFallbackReview`는 어떤 시험에서도 호출되지 않는다. (4) `fable:append`는 AI_DEPUTY_FALLBACK_HANDOFF를 형식만 검사해 실제 소진 실패 run이 없어도 handoff 턴이 장부에 남을 수 있다. 판정은 CHANGES_REQUIRED이며 protocol 1.1 호환성 파괴는 발견하지 못했다.

### 공동 편집 제안 색인

- EDIT-SEC-FB-001-CAP-PARITY: ADD `scripts/fable-review.mjs` ·       || sourceTask.snapshot_mode !== task.snapshot_mode · 원문은 review.md 참조
- EDIT-SEC-FB-002-ENGINE-ATTRIBUTION: REPLACE `scripts/fable-review/protocol-v12.mjs` ·   if (expected.engine === FALLBACK_REVIEWER_ENGINE) { · 원문은 review.md 참조
- EDIT-SEC-FB-001-README-CAP-RULE: ADD `docs/ai-review/README.md` · - Opus의 정확한 model ID와 작업 전체 사용 상한의 남은 범위 · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `56fc8813423b4634c17436c748f7036cccccec05bf2062f04af05b121800d0d0`
- target_commit_sha: `edd66b7a6eee0abaaedeb447d4b0023946bae60f`
- changed_artifact_paths: `docs/ai-review/README.md`, `docs/팀구성_상세기획안.md`, `scripts/fable-review.mjs`, `scripts/fable-review/protocol-v12.mjs`, `scripts/fable-review/protocol-v12.test.mjs`
- artifact_hashes: `[{ path: docs/ai-review/README.md, sha256: 51c8d434b1ec6e5fd935995ecb6f022c6852f35704d54c1bf9b066a4cc66953e, change_type: MODIFIED }, { path: docs/팀구성_상세기획안.md, sha256: cd9a7e424f6a37c8aaf26022aad1b2cfec6896f3e86f20da3dbefb20606be68d, change_type: MODIFIED }, { path: scripts/fable-review.mjs, sha256: ec55964d6fde910d04e1d41109705b583cac76d41d9921ba2ed16d685f6adc9d, change_type: MODIFIED }, { path: scripts/fable-review/protocol-v12.mjs, sha256: b8ffe61c9635dd9e52786d912f6bb8d8e3b402f1bddb4aa22f5af9feacc8a79b, change_type: MODIFIED }, { path: scripts/fable-review/protocol-v12.test.mjs, sha256: 6ea4076ec8829be160c3b3b916884e921182dd364a13d9c06a1b74fd994a71fe, change_type: MODIFIED }]`

### SEC-FB-001-TASK-CAP-RAISE-UNCHECKED
- disposition: `APPLIED`
- 적용 위치: `scripts/fable-review.mjs`의 `assertFallbackTaskParity`·`assertTaskBudgetApproval`, `docs/ai-review/README.md` §8
- 적용 내용: predecessor와 successor의 작업 전체 상한을 같게 고정했다. 기본 4.00 USD 초과는 같은 Task 장부의 machine-readable `HUMAN_DECISION` 승인 pin이 정확히 하나 있고 금액이 센트 단위로 일치할 때만 허용한다. fallback import도 predecessor의 승인을 다시 검증한다.
- 실행한 테스트: `protocol-v12-task-cap-parity-approval-and-conservative-cost`; 상한 불일치·승인 누락 부정 시험
- 필요한 재검수: 동일 Finding ID로 상한 증액 우회가 닫혔는지 확인

### SEC-FB-002-VERIFIED-BY-ENGINE-MISATTRIBUTION
- disposition: `APPLIED`
- 적용 위치: `scripts/fable-review/protocol-v12.mjs`의 `assertFallbackResultBinding`
- 적용 내용: 모든 실제 엔진에서 `VERIFIED`는 `verified_by_engine`이 그 엔진과 정확히 같아야 하고, 비-`VERIFIED`는 반드시 null이어야 한다.
- 실행한 테스트: protocol 1.2 계약 20/20; Fable 결과의 Opus 위장과 OPEN 결과의 엔진 표기 부정 시험
- 필요한 재검수: 동일 Finding ID로 엔진 출처 계약 확인

### SEC-FB-003-FALLBACK-RUNNER-NEGATIVE-TESTS-MISSING
- disposition: `APPLIED`
- 적용 위치: `scripts/fable-review.mjs` 자체시험
- 적용 내용: 실제 임시 Git 저장소를 만드는 fallback successor import 통합시험을 추가했다. 실패 run·handoff·source commit을 봉인한 정상 경로를 먼저 통과시킨 뒤 run hash, handoff entry hash, 비용, 사유, source commit을 각각 변조해 거부되는지 잰다. closure는 P0-2 전 중단되고 Opus 실패는 재-fallback 없이 `FALLBACK_UNAVAILABLE`가 되는 부정 시험도 추가했다.
- 실행한 테스트: Fable wrapper self-test 39개 묶음; `fallback-successor-import-rejects-any-tampered-pin`, `closure-successor-halts-before-p0-2`, `opus-failure-is-fallback-unavailable`
- 필요한 재검수: 동일 Finding ID로 부정 시험의 판별력 확인

### SEC-FB-004-HANDOFF-APPEND-UNBOUND
- disposition: `APPLIED`
- 적용 위치: `scripts/fable-review.mjs`의 `validateFallbackHandoffForAppend`와 실행 전 봉인 검사
- 적용 내용: append 전에 실제 최신 공개 회차가 allowlist 소진 실패인지, run·target·입력·산출물·registry·센트 단위 비용이 일치하는지 확인한다. handoff는 한 번만 허용하고 이후 원 Task의 Fable 회차 재개를 거부한다.
- 실행한 테스트: 정상 handoff append 검증, 잘못된 사용액·잔여액 거부, successor pin 5종 변조 거부
- 필요한 재검수: 동일 Finding ID로 장부 오염과 재시도 우회가 닫혔는지 확인

### SEC-FB-005-SPENT-ROUNDING-NULL-COST
- disposition: `APPLIED`
- 적용 위치: `scripts/fable-review.mjs`의 `usdCents`·`conservativeRunCostCents`·`totalRoundCostCents`
- 적용 내용: 회차별 비용을 센트로 반올림한 정수로 합산한다. `total_cost_usd`가 null이면 0원이 아니라 그 회차의 `max_budget_usd` 전액을 사용한 것으로 보수적으로 차감한다.
- 실행한 테스트: 1.005 USD 두 회차가 202센트인지, null 비용 회차가 200센트 상한 전액인지 단언
- 필요한 재검수: 동일 Finding ID로 비용 계산의 실패 폐쇄 확인

- 전체 검증: `corepack pnpm fable:self-test` 39개 묶음 + protocol 1.2 20/20, `corepack pnpm fable:check`, `corepack pnpm verify` 6/6. DB 32/32·core 177·mobile 189·ACL·새 DB 경합·locale parity·업그레이드 8/8·웹 번들을 포함한다.
- next_review_request: `FABLE_RECHECK`

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `AI-REVIEW-2-FALLBACK-CONTINUITY-001`
- predecessor_round: `r001`
- predecessor_task_sha256: `a49addd45badfd8c3b476d216a20b2257c62220d111f1f6ce4bde89431acc288`
- predecessor_manifest_sha256: `cffd9ba037b9462f807b7a64a452c4e68cf1a79e0a34e2499fb494a05725b211`
- predecessor_review_sha256: `56fc8813423b4634c17436c748f7036cccccec05bf2062f04af05b121800d0d0`
- predecessor_run_sha256: `2c7d8b7114a19f8a112d2f183378f7b4e234883f268cad8279b9ad7f1c5a2bbb`
- finding_registry_sha256: `b6a9155d3a2d8afdb2017af9a79d51e75a8c0d4917b1fe3b6b0b9483a3998275`
- successor_task_id: `AI-REVIEW-2-FALLBACK-CONTINUITY-FINAL-003`
- successor_target_commit_sha: `f1db6cc4bca7b9f3ca80620098610b09174bb126`
- next_review_request: `FABLE_RECHECK`
