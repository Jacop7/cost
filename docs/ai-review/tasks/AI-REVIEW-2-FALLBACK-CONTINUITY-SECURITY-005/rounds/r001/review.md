# AI-REVIEW-2-FALLBACK-CONTINUITY-SECURITY-005 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `RECHECK`
- 스냅샷: `COMMIT`
- 대상 SHA: `293a2d50d4af17d3c5c604b67cc7c746fd6e6296`

## 요약

FINAL-003의 Finding registry 4건을 같은 ID로 RECHECK했다. (1) SEC-FB-FINAL-001: 이번 스냅샷 manifest에는 패킷 evidence_paths 4건(CONTINUITY-001 r001 review.json/run.json, t0001 entry.md, RECHECK-002 r001 run.json)이 모두 path_role=EVIDENCE로 물질화됐고 input_files_sha256에 포함된다. 실행기는 docs/ai-review/tasks/** 제어 경로를 기본 제외하되 선언한 정확한 경로만 EVIDENCE로 물질화하며(fable-review.mjs 760-782, 812-819, 959-966), self-test declared-task-evidence-is-materialized(7967-7988)와 README 27-30이 이를 고정한다. 동일 SECURITY lane 승계는 samePredecessorReviewLane(1963-1969)과 predecessor_review 계약(2040-2215)으로 registry hash를 봉인해 같은 ID 재검증이 가능해졌다. 증거 실물에서 run.json review_sha256(56fc88…)이 물질화된 review.json sha256과 일치함을 교차 확인했고, RECHECK-002 run.json은 Fable 엔진 실패에서 fallback_eligible=false·TASK_CAP_APPROVAL_REQUIRED가 그대로 보존됨을 보여 준다. (2) SEC-FB-FINAL-002: fallbackFailureDisposition(2660-2668)은 Opus에서 eligible=true 소진만 FALLBACK_UNAVAILABLE로 바꾸고 비승계 사유는 보존하며, 시험(5604-5634)이 TASK_CAP_APPROVAL_REQUIRED·NOT_FALLBACK_ELIGIBLE 두 케이스를 단언한다. status.json 재조정(4437-4439, 4455)은 run.fallback_reason을 항등 매핑한다. (3) SEC-FB-FINAL-003: rejectsPin이 16개 호출로 확장돼 fallback_review 18개 키 중 from_task_id를 제외한 모든 sha256·oid·정수·배열·금액 pin을 75/STALE로 거부하는지 검사한다(8463-8497). (4) SEC-FB-FINAL-004: README 379-381과 팀구성 621-624가 ‘센트 반올림 합산, null 비용만 상한 전액 보수 차감’으로 합의했고 self-test(5583-5593)가 1.005×2=202센트 규칙을 고정한다. 네 건 모두 VERIFIED로 기록한다. 잔여 사항으로 fixture self-test가 읽는 CONTINUITY-001 task.json/manifest.json/runner-source.mjs/schema-source.json이 evidence_paths에 없고, rejectsPin에 from_task_id·handoff 뒤 추가 턴 케이스가 없다는 점을 새 Improvement로 남긴다. self-test 40개·protocol 1.2 시험 20개는 소스 계수로 확인했으나 실행 결과(verify 6/6 포함)는 packet·장부 진술이며 이 스냅샷에서 재현하지 않았고, 장부에 CODEX_EVIDENCE 턴은 아직 없다. 판정은 PASS이며 gate_state는 OPEN을 유지하고 CLOSED 전이는 없다.

## Findings

### SEC-FB-FINAL-001-EVIDENCE-NOT-MATERIALIZED — Major / VERIFIED

- 범주: OTHER
- 검증 엔진: FABLE
- 영향: 완료 조건 1·2 충족: 증거가 실물로 봉인되고 predecessor registry가 같은 ID로 승계됐다. 조건 3(fixture 파일 집합과 evidence_paths 일치)은 부분 충족이며 잔여를 SEC-FB-SEC005-FIXTURE-SET-AND-PIN-RESIDUAL로 분리했다.
- 근거: COLLABORATION_LOG:0, scripts/fable-review.mjs:760, scripts/fable-review.mjs:812, scripts/fable-review.mjs:7967, scripts/fable-review.mjs:1963, docs/ai-review/tasks/AI-REVIEW-2-FALLBACK-CONTINUITY-001/rounds/r001/run.json:22, docs/ai-review/README.md:27
- 완료 조건: evidence_paths에 선언한 파일이 스냅샷 input_files에 EVIDENCE 역할로 실제 물질화된다. / predecessor의 SEC-FB-001~005를 같은 ID로 재검증하려면 predecessor_review 또는 fallback_review 계약으로 registry hash를 봉인한 RECHECK 의미 Task로 발행하거나, required_evidence에서 동일 ID 재검증 요구를 제거한다. / fixture 기반 self-test가 참조하는 파일 집합이 evidence_paths와 일치한다.
- 필요한 테스트: 스냅샷 물질화기가 evidence_paths 누락 시 실행을 거부(또는 input_files_sha256에 반영)하는 부정 시험 / 동일 ID 재검증 요구가 있는 Task는 predecessor/fallback 계약 없이는 validateTask에서 거부되는 시험

### SEC-FB-FINAL-002-OPUS-FAILURE-REASON-COLLAPSED — Minor / VERIFIED

- 범주: DATA_INTEGRITY
- 검증 엔진: FABLE
- 영향: Opus successor의 상한·인증·계약 위반 실패가 모델 소진으로 오보고되는 경로가 닫혔다.
- 근거: scripts/fable-review.mjs:2660, scripts/fable-review.mjs:5604, scripts/fable-review.mjs:4437, docs/ai-review/tasks/AI-REVIEW-2-FALLBACK-CONTINUITY-RECHECK-002/rounds/r001/run.json:7, docs/ai-review/README.md:405
- 완료 조건: Opus 엔진 실패 시 classification.eligible=false인 경우 원 사유(TASK_CAP_APPROVAL_REQUIRED, NOT_FALLBACK_ELIGIBLE)를 유지하고 eligible=true(소진)인 경우에만 FALLBACK_UNAVAILABLE로 변환한다. / fallback_eligible은 Opus에서 항상 false를 유지한다.
- 필요한 테스트: opus-failure-is-fallback-unavailable에 TASK_CAP_APPROVAL_REQUIRED·NOT_FALLBACK_ELIGIBLE 입력 케이스 추가 / status.json 재조정(4425-4444)이 Opus 비승계 사유를 그대로 보존하는 시험

### SEC-FB-FINAL-003-TAMPERED-PIN-TEST-PARTIAL — Minor / VERIFIED

- 범주: TEST_GAP
- 검증 엔진: FABLE
- 영향: ‘any tampered pin’ 부정 시험이 sha256·oid·정수·배열·금액 pin 전체로 확장돼 SEC-FB-003 증거력이 회복됐다.
- 근거: scripts/fable-review.mjs:8463, scripts/fable-review.mjs:2717, scripts/fable-review.mjs:2759, scripts/fable-review/protocol-v12.mjs:54
- 완료 조건: fallback_review의 모든 sha256·oid·정수·배열 필드 각각에 대해 변조 시 exitCode 75/STALE 거부를 확인한다. / handoff_turn_id 변경·handoff 뒤 추가 턴·from_round 불일치 케이스를 포함한다.
- 필요한 테스트: rejectsPin 확장(handoff_run_sha256, input_files_sha256, artifact_set_sha256, finding_registry_sha256, collaboration_sha256, collaboration_bytes, target_commit_sha, handoff_base_commit_sha, from_round, inherited_finding_ids, handoff_turn_id)

### SEC-FB-FINAL-004-COST-ROUNDING-NOT-CEIL — Improvement / VERIFIED

- 범주: CODE
- 검증 엔진: FABLE
- 영향: 문서·코드·시험이 반올림 규칙으로 합의돼 명명 불일치가 해소됐다.
- 근거: scripts/fable-review.mjs:2593, scripts/fable-review.mjs:5583, docs/ai-review/README.md:379, docs/팀구성_상세기획안.md:621
- 완료 조건: 실사용액은 Math.ceil(센트)로 차감하거나 README에서 ‘보수적’ 표현을 ‘반올림’으로 정정한다.
- 필요한 테스트: 1.004→101센트(ceil) 또는 100센트(round) 중 채택한 규칙을 고정하는 self-test

### SEC-FB-SEC005-FIXTURE-SET-AND-PIN-RESIDUAL — Improvement / OPEN

- 범주: TEST_GAP
- 영향: 감사자가 스냅샷만으로 fixture manifest/runner-source 무결성을 확인할 수 없고, from_task_id 변조·handoff 뒤 추가 턴 회귀는 self-test로 보호되지 않는다. 보안 결함이 아니라 감사 가시성·회귀 커버리지 잔여다.
- 근거: scripts/fable-review.mjs:8286, scripts/fable-review.mjs:8479
- 완료 조건: 후속 Task의 evidence_paths에 self-test가 읽는 CONTINUITY-001 task.json·r001 manifest.json·runner-source.mjs·schema-source.json을 포함하거나 fixture 참조 집합을 evidence_paths와 같게 줄인다. / rejectsPin에 from_task_id 변조와 handoff 뒤 manual 턴 하나를 더 commit한 source_commit_sha 케이스를 추가한다.
- 필요한 테스트: rejectsPin({ from_task_id }) 및 handoff 뒤 추가 턴 commit을 source_commit_sha로 지정했을 때 75/STALE 거부 시험

## 공동 편집 제안

### EDIT-SEC005-PIN-RESIDUAL-CASES — COMMENT

- 대상: `scripts/fable-review.mjs`
- 위치:       rejectsPin({ reason: 'MODEL_CAPACITY_UNAVAILABLE' }, '실패 원본');
- 연결 Finding: SEC-FB-SEC005-FIXTURE-SET-AND-PIN-RESIDUAL
- 이유: FALLBACK_KEYS 18개 중 유일하게 미시험인 from_task_id와 ‘handoff 뒤 추가 턴’ 완료 조건을 회귀 보호한다.

    from_task_id 변조 케이스와, handoff 뒤 SOLAR_RESPONSE 같은 manual 턴을 하나 더 append·commit한 뒤 그 commit을 source_commit_sha로 지정하는 케이스를 추가해 '지정 handoff 턴 하나만 추가' 분기를 파일 오염이 아닌 턴 추가로도 검증하도록 제안한다. 거부 메시지는 assertHandoffOnlyDelta/materializeTaskFromCommit의 실제 문자열에 맞춰 확정한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
