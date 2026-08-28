
<!-- fable-review:r001 sha256=c9ce973ae07645965dca14e54c818007d1f9817d27264fb6ecb40de0391e2ce9 -->
## FABLE_RECHECK · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `c9ce973ae07645965dca14e54c818007d1f9817d27264fb6ecb40de0391e2ce9`
- target_commit_sha: `293a2d50d4af17d3c5c604b67cc7c746fd6e6296`
- input_files_sha256: `2fce50fc6afd7a703dd325380dac726b45843c404fc24ca2b79554e1aa808c9b`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: SEC-FB-SEC005-FIXTURE-SET-AND-PIN-RESIDUAL
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

FINAL-003의 Finding registry 4건을 같은 ID로 RECHECK했다. (1) SEC-FB-FINAL-001: 이번 스냅샷 manifest에는 패킷 evidence_paths 4건(CONTINUITY-001 r001 review.json/run.json, t0001 entry.md, RECHECK-002 r001 run.json)이 모두 path_role=EVIDENCE로 물질화됐고 input_files_sha256에 포함된다. 실행기는 docs/ai-review/tasks/** 제어 경로를 기본 제외하되 선언한 정확한 경로만 EVIDENCE로 물질화하며(fable-review.mjs 760-782, 812-819, 959-966), self-test declared-task-evidence-is-materialized(7967-7988)와 README 27-30이 이를 고정한다. 동일 SECURITY lane 승계는 samePredecessorReviewLane(1963-1969)과 predecessor_review 계약(2040-2215)으로 registry hash를 봉인해 같은 ID 재검증이 가능해졌다. 증거 실물에서 run.json review_sha256(56fc88…)이 물질화된 review.json sha256과 일치함을 교차 확인했고, RECHECK-002 run.json은 Fable 엔진 실패에서 fallback_eligible=false·TASK_CAP_APPROVAL_REQUIRED가 그대로 보존됨을 보여 준다. (2) SEC-FB-FINAL-002: fallbackFailureDisposition(2660-2668)은 Opus에서 eligible=true 소진만 FALLBACK_UNAVAILABLE로 바꾸고 비승계 사유는 보존하며, 시험(5604-5634)이 TASK_CAP_APPROVAL_REQUIRED·NOT_FALLBACK_ELIGIBLE 두 케이스를 단언한다. status.json 재조정(4437-4439, 4455)은 run.fallback_reason을 항등 매핑한다. (3) SEC-FB-FINAL-003: rejectsPin이 16개 호출로 확장돼 fallback_review 18개 키 중 from_task_id를 제외한 모든 sha256·oid·정수·배열·금액 pin을 75/STALE로 거부하는지 검사한다(8463-8497). (4) SEC-FB-FINAL-004: README 379-381과 팀구성 621-624가 ‘센트 반올림 합산, null 비용만 상한 전액 보수 차감’으로 합의했고 self-test(5583-5593)가 1.005×2=202센트 규칙을 고정한다. 네 건 모두 VERIFIED로 기록한다. 잔여 사항으로 fixture self-test가 읽는 CONTINUITY-001 task.json/manifest.json/runner-source.mjs/schema-source.json이 evidence_paths에 없고, rejectsPin에 from_task_id·handoff 뒤 추가 턴 케이스가 없다는 점을 새 Improvement로 남긴다. self-test 40개·protocol 1.2 시험 20개는 소스 계수로 확인했으나 실행 결과(verify 6/6 포함)는 packet·장부 진술이며 이 스냅샷에서 재현하지 않았고, 장부에 CODEX_EVIDENCE 턴은 아직 없다. 판정은 PASS이며 gate_state는 OPEN을 유지하고 CLOSED 전이는 없다.

### 공동 편집 제안 색인

- EDIT-SEC005-PIN-RESIDUAL-CASES: COMMENT `scripts/fable-review.mjs` ·       rejectsPin({ reason: 'MODEL_CAPACITY_UNAVAILABLE' }, '실패 원본'); · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
