# AI-REVIEW-2-FALLBACK-CONTINUITY-FINAL-003 공동 작업 장부

> predecessor의 SEC-FB-001~005를 Fable이 같은 ID로 최종 재검증하는 append-only 장부다.
> 기존 검수·수정·제한 재검수 실패 기록은 evidence로 읽고 수정하지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- reply_to_turn_id: `turn-o001`
- target_commit_sha: `f1db6cc4bca7b9f3ca80620098610b09174bb126`
- changed_artifact_paths: `scripts/fable-review.mjs`, `scripts/fable-review/protocol-v12.mjs`, `scripts/fable-review/protocol-v12.test.mjs`, `docs/ai-review/README.md`, `docs/팀구성_상세기획안.md`
- 충족해야 할 요구사항·불변식: predecessor `SEC-FB-001`~`SEC-FB-005`, Fable primary, append-only audit, P0-2 전 CLOSED 금지
- 이번에 바꾼 내용: 상한 parity·사람 승인 pin, 실제 엔진 결합, 최신 소진 run에 묶인 handoff append, 센트 단위 보수적 비용, fallback·closure·Opus 실패 부정 시험을 추가했다. 제한 재검수에서 발견한 실패 status 복구 유실도 고쳤다.
- 집중 검토 질문: 원 5개 Finding이 실제로 해결됐는가? pin·엔진·사용액·장부 중 하나를 변조하면 실패 폐쇄하는가? 실패 회차를 복구해도 status가 실제 Fable 엔진과 종료 사유를 보존하는가?
- 실행한 테스트·현재 증거: Fable wrapper self-test 39개 묶음, protocol 1.2 20/20, `corepack pnpm verify` 6/6. DB 32/32·core 177·mobile 189·ACL·새 DB 경합·locale parity·업그레이드 8/8·웹 번들 포함.
- 사람 결정이 필요한 항목: 사용자가 2026-08-29 Fable 최종 재검수 진행을 승인했다. 이 Task의 실행 상한은 4.00 USD이며 Opus는 사용하지 않는다.
- next_review_request: `FABLE_RECHECK`

<!-- fable-review:r001 sha256=69414da9fceace85cf941d201cb4338d5fadb97202bcf2f6f518c523d4cd5ad7 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `69414da9fceace85cf941d201cb4338d5fadb97202bcf2f6f518c523d4cd5ad7`
- target_commit_sha: `f1db6cc4bca7b9f3ca80620098610b09174bb126`
- input_files_sha256: `102bebec6e6bfa4b8c32f51d15b593fb6903c4eb94b721a08fb968773cd0b6d1`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: SEC-FB-FINAL-001-EVIDENCE-NOT-MATERIALIZED, SEC-FB-FINAL-002-OPUS-FAILURE-REASON-COLLAPSED, SEC-FB-FINAL-003-TAMPERED-PIN-TEST-PARTIAL
- 선택 미종결 Finding: SEC-FB-FINAL-004-COST-ROUNDING-NOT-CEIL
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

SECURITY 모드 초기 검수로 protocol 1.2 fallback 연속성 구현을 읽기 전용 감사했다. 코드 수준에서 SEC-FB-001~005의 핵심 방어는 실제로 존재함을 확인했다: (1) successor import가 predecessor task_budget_usd parity·HUMAN_DECISION 단일 pin·범위 필드 동일성을 검사하고(fable-review.mjs 2604-2636, 2690-2746), 기본 4.00 초과 시 TASK_CAP_APPROVAL_REQUIRED로 중단한다. (2) assertFallbackResultBinding이 결과 검증 경로(2943)에서 VERIFIED↔verified_by_engine 결합과 비-VERIFIED null을 강제한다(protocol-v12.mjs 150-166). (3) handoff append는 기존 handoff 존재 시 거부하고 최신 RUN_FAILED·fallback_eligible·reason·run hash·input/artifact/registry hash·센트 비용 일치를 요구하며(3296-3339), 이후 원 Task Fable 재시작은 4845-4850에서 차단된다. (4) 비용은 usdCents 정수 합산이고 total_cost_usd null은 max_budget_usd 전액 차감한다(2585-2602). (5) closure는 4709에서 실행 전 중단되고 Opus 실패는 재-fallback 없이 종료된다. self-test 39개·protocol 시험 20개 존재는 소스에서 계수로 확인했으나 실행 결과는 packet 진술이며 이 스냅샷에서 재현하지 않았다.

그러나 이 Task는 predecessor_review=null·fallback_review=null인 초기 SECURITY Task이고, 패킷이 지정한 evidence_paths 4건(FALLBACK-CONTINUITY-001 r001 review/run/entry, RECHECK-002 run)이 스냅샷 input_files에 전혀 물질화되지 않았다. 따라서 required_evidence 1항 “SEC-FB-001~005를 같은 finding_id/previous_finding_id로 재검증”은 프로토콜상(규칙 5·6) 이 Task에서 수행할 수 없으며, 모든 Finding은 신규 OPEN으로만 기록한다. 이를 Major로 올리고, Opus 실패 사유 손실(Minor), 변조 pin 부정 시험의 부분 커버리지(Minor), 반올림 방식(Improvement)을 함께 기록한다. 판정은 CHANGES_REQUIRED이며 gate_state는 OPEN을 유지한다.

### 공동 편집 제안 색인

- EDIT-OPUS-FAILURE-REASON-PRESERVE: REPLACE `scripts/fable-review.mjs` · function fallbackFailureDisposition(engine, classification) { · 원문은 review.md 참조
- EDIT-TAMPERED-PIN-COVERAGE: ADD `scripts/fable-review.mjs` ·       rejectsPin({ reason: 'MODEL_CAPACITY_UNAVAILABLE' }, '실패 원본'); · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `69414da9fceace85cf941d201cb4338d5fadb97202bcf2f6f518c523d4cd5ad7`
- target_commit_sha: `bbcb369`
- changed_artifact_paths: `scripts/fable-review.mjs`, `docs/ai-review/README.md`

### SEC-FB-FINAL-001-EVIDENCE-NOT-MATERIALIZED

- disposition: `APPLIED`
- 적용 내용: `docs/ai-review/tasks/**`는 계속 기본 제외하되 Task가 정확히 선언한 `evidence_paths`만 읽기 전용 EVIDENCE로 materialize하고 `input_files_sha256`에 포함한다. 같은 route·review_mode·reviewer의 COMMIT successor가 predecessor registry를 승계하도록 일반화했다.
- 실행한 테스트: `declared-task-evidence-is-materialized`, FINAL·SECURITY 동일 lane 허용 및 교차 reviewer 거부 self-test.
- 필요한 재검수: 실제 SECURITY successor manifest에서 선언한 과거 review/run 파일이 EVIDENCE로 들어가고 같은 Finding registry를 승계하는지 확인.

### SEC-FB-FINAL-002-OPUS-FAILURE-REASON-COLLAPSED

- disposition: `APPLIED`
- 적용 내용: Opus 실패 중 실제 모델 소진만 `FALLBACK_UNAVAILABLE`로 바꾸고 `TASK_CAP_APPROVAL_REQUIRED`·`NOT_FALLBACK_ELIGIBLE` 같은 비승계 사유는 그대로 보존한다. Opus의 `fallback_eligible`은 항상 false다.
- 실행한 테스트: `opus-failure-is-fallback-unavailable`의 두 비승계 사유 보존 케이스.

### SEC-FB-FINAL-003-TAMPERED-PIN-TEST-PARTIAL

- disposition: `APPLIED`
- 적용 내용: handoff run, input/artifact/registry hash, inherited IDs, collaboration bytes/hash, target/base commit, round, turn ID를 포함한 fallback pin 전체를 각각 변조해 75/STALE로 실패 폐쇄되는지 확인한다.
- 실행한 테스트: `fallback-successor-import-rejects-any-tampered-pin`; 각 변조 필드명을 실패 메시지에 남겨 헛단언을 막았다.

### SEC-FB-FINAL-004-COST-ROUNDING-NOT-CEIL

- disposition: `REJECTED_ALREADY_SATISFIED`
- 근거: 실행기는 `usdCents`에서 센트 단위 반올림을 사용하고 README §8은 이미 “각 값을 센트로 반올림해 정수로 합산”이라고 명시한다. 검수 완료 조건이 허용한 두 선택지 중 round 계약이 이미 일치하므로 ceil 변경은 하지 않는다.
- 실행한 테스트: `protocol-v12-task-cap-parity-approval-and-conservative-cost`가 반올림과 null 비용의 전액 차감을 고정한다.

- 전체 검증: Fable wrapper self-test 40개, protocol 1.2 20/20, `corepack pnpm verify` 6/6. DB 32/32·core 177·mobile 189·ACL·새 DB 경합·locale parity·업그레이드 8/8·웹 번들 포함.
- next_review_request: `FABLE_RECHECK`

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `AI-REVIEW-2-FALLBACK-CONTINUITY-FINAL-003`
- predecessor_round: `r001`
- predecessor_task_sha256: `8937b88c3242cdf84a342c58d17b4b2c0dc7e8557dfe9bdce50428cb61e4eef9`
- predecessor_manifest_sha256: `9d43aaefb7ec856aa63583b9110870fbf4eb8964e89035198c7b63578922ddb9`
- predecessor_review_sha256: `69414da9fceace85cf941d201cb4338d5fadb97202bcf2f6f518c523d4cd5ad7`
- predecessor_run_sha256: `4ab2cea192d5bfb53da665788808d38455c70ce071d65907342d87339f283ac0`
- finding_registry_sha256: `fc46b737421436dc1c75de193c69575a33d41168d128bf247a5b0068e822a693`
- successor_task_id: `AI-REVIEW-2-FALLBACK-CONTINUITY-SECURITY-005`
- successor_target_commit_sha: `bbcb3690f60fbbd5da7c9e20ad36b45f6a3b8f74`
- next_review_request: `FABLE_RECHECK`

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o002 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `AI-REVIEW-2-FALLBACK-CONTINUITY-FINAL-003`
- predecessor_round: `r001`
- predecessor_task_sha256: `8937b88c3242cdf84a342c58d17b4b2c0dc7e8557dfe9bdce50428cb61e4eef9`
- predecessor_manifest_sha256: `9d43aaefb7ec856aa63583b9110870fbf4eb8964e89035198c7b63578922ddb9`
- predecessor_review_sha256: `69414da9fceace85cf941d201cb4338d5fadb97202bcf2f6f518c523d4cd5ad7`
- predecessor_run_sha256: `4ab2cea192d5bfb53da665788808d38455c70ce071d65907342d87339f283ac0`
- finding_registry_sha256: `fc46b737421436dc1c75de193c69575a33d41168d128bf247a5b0068e822a693`
- successor_task_id: `AI-REVIEW-2-FALLBACK-CONTINUITY-SECURITY-005`
- successor_target_commit_sha: `293a2d50d4af17d3c5c604b67cc7c746fd6e6296`
- next_review_request: `FABLE_RECHECK`
