
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
