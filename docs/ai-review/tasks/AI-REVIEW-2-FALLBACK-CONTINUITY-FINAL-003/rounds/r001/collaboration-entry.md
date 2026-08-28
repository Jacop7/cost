
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
