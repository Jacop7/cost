# AI-REVIEW-2-FALLBACK-CONTINUITY-FINAL-003 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `SECURITY`
- 스냅샷: `COMMIT`
- 대상 SHA: `f1db6cc4bca7b9f3ca80620098610b09174bb126`

## 요약

SECURITY 모드 초기 검수로 protocol 1.2 fallback 연속성 구현을 읽기 전용 감사했다. 코드 수준에서 SEC-FB-001~005의 핵심 방어는 실제로 존재함을 확인했다: (1) successor import가 predecessor task_budget_usd parity·HUMAN_DECISION 단일 pin·범위 필드 동일성을 검사하고(fable-review.mjs 2604-2636, 2690-2746), 기본 4.00 초과 시 TASK_CAP_APPROVAL_REQUIRED로 중단한다. (2) assertFallbackResultBinding이 결과 검증 경로(2943)에서 VERIFIED↔verified_by_engine 결합과 비-VERIFIED null을 강제한다(protocol-v12.mjs 150-166). (3) handoff append는 기존 handoff 존재 시 거부하고 최신 RUN_FAILED·fallback_eligible·reason·run hash·input/artifact/registry hash·센트 비용 일치를 요구하며(3296-3339), 이후 원 Task Fable 재시작은 4845-4850에서 차단된다. (4) 비용은 usdCents 정수 합산이고 total_cost_usd null은 max_budget_usd 전액 차감한다(2585-2602). (5) closure는 4709에서 실행 전 중단되고 Opus 실패는 재-fallback 없이 종료된다. self-test 39개·protocol 시험 20개 존재는 소스에서 계수로 확인했으나 실행 결과는 packet 진술이며 이 스냅샷에서 재현하지 않았다.

그러나 이 Task는 predecessor_review=null·fallback_review=null인 초기 SECURITY Task이고, 패킷이 지정한 evidence_paths 4건(FALLBACK-CONTINUITY-001 r001 review/run/entry, RECHECK-002 run)이 스냅샷 input_files에 전혀 물질화되지 않았다. 따라서 required_evidence 1항 “SEC-FB-001~005를 같은 finding_id/previous_finding_id로 재검증”은 프로토콜상(규칙 5·6) 이 Task에서 수행할 수 없으며, 모든 Finding은 신규 OPEN으로만 기록한다. 이를 Major로 올리고, Opus 실패 사유 손실(Minor), 변조 pin 부정 시험의 부분 커버리지(Minor), 반올림 방식(Improvement)을 함께 기록한다. 판정은 CHANGES_REQUIRED이며 gate_state는 OPEN을 유지한다.

## Findings

### SEC-FB-FINAL-001-EVIDENCE-NOT-MATERIALIZED — Major / OPEN

- 범주: OTHER
- 영향: required_evidence 1항(SEC-FB-001~005 동일 ID 재검증)을 이 Task 구조에서는 프로토콜을 어기지 않고 만족시킬 수 없고, 실패 회차 복구·비용 기록의 실제 증거(run.json)를 읽을 수 없어 ‘fallback_reason·엔진 보존’ 요구를 실물로 확인하지 못했다. 검수 결과가 코드 정적 분석에만 의존한다.
- 근거: COLLABORATION_LOG:0, scripts/fable-review/protocol-v12.mjs:135, scripts/fable-review.mjs:8226
- 완료 조건: evidence_paths에 선언한 파일이 스냅샷 input_files에 EVIDENCE 역할로 실제 물질화된다. / predecessor의 SEC-FB-001~005를 같은 ID로 재검증하려면 predecessor_review 또는 fallback_review 계약으로 registry hash를 봉인한 RECHECK 의미 Task로 발행하거나, required_evidence에서 동일 ID 재검증 요구를 제거한다. / fixture 기반 self-test가 참조하는 파일 집합이 evidence_paths와 일치한다.
- 필요한 테스트: 스냅샷 물질화기가 evidence_paths 누락 시 실행을 거부(또는 input_files_sha256에 반영)하는 부정 시험 / 동일 ID 재검증 요구가 있는 Task는 predecessor/fallback 계약 없이는 validateTask에서 거부되는 시험

### SEC-FB-FINAL-002-OPUS-FAILURE-REASON-COLLAPSED — Minor / OPEN

- 범주: DATA_INTEGRITY
- 영향: Opus successor에서 회차 상한 초과·인증 실패·계약 위반이 발생해도 status.json이 ‘모델 소진’처럼 보고돼 사람이 승인 상한 조정 대신 모델 장애로 오판할 수 있다. 요구사항 ‘fallback_reason 보존’과 README 문서 계약이 어긋난다.
- 근거: scripts/fable-review.mjs:2652, scripts/fable-review.mjs:5592, docs/ai-review/README.md:401
- 완료 조건: Opus 엔진 실패 시 classification.eligible=false인 경우 원 사유(TASK_CAP_APPROVAL_REQUIRED, NOT_FALLBACK_ELIGIBLE)를 유지하고 eligible=true(소진)인 경우에만 FALLBACK_UNAVAILABLE로 변환한다. / fallback_eligible은 Opus에서 항상 false를 유지한다.
- 필요한 테스트: opus-failure-is-fallback-unavailable에 TASK_CAP_APPROVAL_REQUIRED·NOT_FALLBACK_ELIGIBLE 입력 케이스 추가 / status.json 재조정(4425-4444)이 Opus 비승계 사유를 그대로 보존하는 시험

### SEC-FB-FINAL-003-TAMPERED-PIN-TEST-PARTIAL — Minor / OPEN

- 범주: TEST_GAP
- 영향: ‘any tampered pin’ 이름과 달리 17개 pin 중 5개만 회귀 보호된다. 향후 리팩터링에서 미시험 분기가 무력화돼도 self-test 39/39가 통과해 SEC-FB-003의 증거력이 약해진다.
- 근거: scripts/fable-review.mjs:8403, scripts/fable-review.mjs:2713, scripts/fable-review.mjs:2749
- 완료 조건: fallback_review의 모든 sha256·oid·정수·배열 필드 각각에 대해 변조 시 exitCode 75/STALE 거부를 확인한다. / handoff_turn_id 변경·handoff 뒤 추가 턴·from_round 불일치 케이스를 포함한다.
- 필요한 테스트: rejectsPin 확장(handoff_run_sha256, input_files_sha256, artifact_set_sha256, finding_registry_sha256, collaboration_sha256, collaboration_bytes, target_commit_sha, handoff_base_commit_sha, from_round, inherited_finding_ids, handoff_turn_id)

### SEC-FB-FINAL-004-COST-ROUNDING-NOT-CEIL — Improvement / OPEN

- 범주: CODE
- 영향: 회차 수가 많아도 누락은 수 센트 수준이라 실질 위험은 낮지만, 상한 가드의 의미를 ‘올림’으로 통일하면 문서·코드·명명이 일치한다.
- 근거: scripts/fable-review.mjs:2585, docs/ai-review/README.md:372
- 완료 조건: 실사용액은 Math.ceil(센트)로 차감하거나 README에서 ‘보수적’ 표현을 ‘반올림’으로 정정한다.
- 필요한 테스트: 1.004→101센트(ceil) 또는 100센트(round) 중 채택한 규칙을 고정하는 self-test

## 공동 편집 제안

### EDIT-OPUS-FAILURE-REASON-PRESERVE — REPLACE

- 대상: `scripts/fable-review.mjs`
- 위치: function fallbackFailureDisposition(engine, classification) {
- 연결 Finding: SEC-FB-FINAL-002-OPUS-FAILURE-REASON-COLLAPSED
- 이유: Opus 실패에서 TASK_CAP_APPROVAL_REQUIRED·NOT_FALLBACK_ELIGIBLE 사유가 FALLBACK_UNAVAILABLE로 덮이지 않도록 하고 README 401-403 계약과 일치시킨다.

    function fallbackFailureDisposition(engine, classification) {
      if (engine !== FALLBACK_REVIEWER_ENGINE) {
        return { eligible: classification.eligible, reason: classification.reason };
      }
      // Opus는 추가 fallback을 열지 않는다. 소진 사유만 FALLBACK_UNAVAILABLE로 바꾸고
      // 상한·인증·계약 위반 같은 비승계 사유는 status.json에 그대로 보존한다.
      return {
        eligible: false,
        reason: classification.eligible ? 'FALLBACK_UNAVAILABLE' : classification.reason,
      };
    }

### EDIT-TAMPERED-PIN-COVERAGE — ADD

- 대상: `scripts/fable-review.mjs`
- 위치:       rejectsPin({ reason: 'MODEL_CAPACITY_UNAVAILABLE' }, '실패 원본');
- 연결 Finding: SEC-FB-FINAL-003-TAMPERED-PIN-TEST-PARTIAL
- 이유: loadPinnedFallbackReview의 미시험 거부 분기(2713-2737, 2749-2759)에 회귀 보호를 추가해 SEC-FB-003 부정 시험의 커버리지를 pin 전체로 확장한다.

          rejectsPin({ handoff_run_sha256: '0'.repeat(64) }, 'terminal fallback handoff');
          rejectsPin({ input_files_sha256: '0'.repeat(64) }, '대상·입력·산출물 hash');
          rejectsPin({ artifact_set_sha256: '0'.repeat(64) }, '대상·입력·산출물 hash');
          rejectsPin({ finding_registry_sha256: '0'.repeat(64) }, 'registry ID/hash');
          rejectsPin({ inherited_finding_ids: ['GHOST-001'] }, 'registry ID/hash');
          rejectsPin({ collaboration_sha256: '0'.repeat(64) }, '장부 bytes/hash');
          rejectsPin({ collaboration_bytes: collaborationAfter.length + 1 }, '장부 bytes/hash');
          rejectsPin({ handoff_turn_id: 'turn-o002' }, 'terminal fallback handoff');

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: SEC-FB-FINAL-001-EVIDENCE-NOT-MATERIALIZED, SEC-FB-FINAL-002-OPUS-FAILURE-REASON-COLLAPSED, SEC-FB-FINAL-003-TAMPERED-PIN-TEST-PARTIAL

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
