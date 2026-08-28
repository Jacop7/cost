# AI-REVIEW-2-FALLBACK-CONTINUITY-SECURITY-005 공동 작업 장부

> `AI-REVIEW-2-FALLBACK-CONTINUITY-FINAL-003`의 전체 Finding registry를 승계해 수정 commit을
> Fable SECURITY 역할이 같은 ID로 재검증하는 append-only 장부다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- reply_to_turn_id: `turn-o002`
- target_commit_sha: `293a2d50d4af17d3c5c604b67cc7c746fd6e6296`
- changed_artifact_paths: `scripts/fable-review.mjs`, `docs/ai-review/README.md`
- 충족해야 할 요구사항·불변식: predecessor의 `SEC-FB-FINAL-001`~`004`, append-only audit, Fable primary, P0-2 전 CLOSED 금지
- 이번에 바꾼 내용: 선언한 task 증거만 EVIDENCE로 materialize하고 동일 SECURITY lane의 predecessor registry 승계를 허용했다. Opus 비승계 실패 사유를 보존하고 fallback pin 변조 시험을 전체 필드로 확장했다. 비용은 기존 센트 반올림 계약을 유지한다.
- 집중 검토 질문: manifest에 task evidence 4건이 실제로 들어왔는가? 네 Finding의 완료 조건이 충족됐는가? 비승계 Opus 실패와 모든 fallback pin 변조가 정확한 사유로 실패 폐쇄되는가?
- 실행한 테스트·현재 증거: Fable wrapper self-test 40개, protocol 1.2 20/20, `corepack pnpm verify` 6/6. DB 32/32·core 177·mobile 189·ACL·새 DB 경합·locale parity·업그레이드 8/8·웹 번들 포함.
- 사람 결정이 필요한 항목: 사용자는 Fable 재검수를 승인했고 Opus는 사용하지 않는다. 실행은 별도 Max CLI 비용 상한을 소비한다.
- next_review_request: `FABLE_RECHECK`

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

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-f001`
- finding_ids: `SEC-FB-FINAL-001-EVIDENCE-NOT-MATERIALIZED`, `SEC-FB-FINAL-002-OPUS-FAILURE-REASON-COLLAPSED`, `SEC-FB-FINAL-003-TAMPERED-PIN-TEST-PARTIAL`, `SEC-FB-FINAL-004-COST-ROUNDING-NOT-CEIL`
- target_commit_sha: `293a2d50d4af17d3c5c604b67cc7c746fd6e6296`
- verified_input_files_sha256: `2fce50fc6afd7a703dd325380dac726b45843c404fc24ca2b79554e1aa808c9b`
- 증거 물질화: r001 manifest에서 선언한 task evidence 4건이 모두 `path_role=EVIDENCE`이며 Fable이 실제 review/run hash를 교차 대조했다.
- 실행기 회귀시험: self-test 40개 묶음과 protocol 1.2 20/20 exit 0. 선언 증거만 포함, FINAL·SECURITY 동일 lane 승계, Opus 비승계 사유 보존, fallback pin별 75/STALE 거부를 포함한다.
- 제품 전체 검증: `corepack pnpm verify` exit 0. 타입, DB 32/32·core 177(2 skip)·mobile 189, ACL, 새 DB+경합+locale parity, 업그레이드 8/8, 웹 번들 6단계 전부 통과.
- 환경 정리: `fresh_%` 임시 DB 0개. Opus·별도 API 키는 사용하지 않았다.
- Fable 재검수: PASS, 필수 미해결 0건, 네 predecessor Finding 모두 `VERIFIED`, gate_state는 P0-2 전이므로 `OPEN` 유지.
- next_review_request: `AI_DEPUTY_GATE_REVIEW`

## BACKLOG_DISPOSITION · turn-o001

- role: `AI-DEPUTY-ORCHESTRATOR`
- reply_to_turn_id: `turn-f001`
- optional_finding_ids: `SEC-FB-SEC005-FIXTURE-SET-AND-PIN-RESIDUAL`
- backlog_id: `AI-REVIEW-2-P2-FIXTURE-PIN-RESIDUAL`
- owner: `AI-DEPUTY-ORCHESTRATOR`
- 재검토 조건·시점: 다음 fable-review runner 보강 작업에서 from_task_id 변조와 handoff 뒤 추가 manual 턴 회귀시험을 함께 추가한다. 운영·제품 권한을 넓히는 결함이 아니라 감사 가시성·시험 커버리지 개선이므로 현재 PASS와 병합을 막지 않는다.
- 공식 산출물 반영 여부: `docs/작업큐.md` AI-REVIEW-2 완료 결과의 후속 P2로 등록한다.
- review_state_effect: `NON_BLOCKING`

## AI_DEPUTY_GATE_DECISION · turn-o002

- role: `AI-DEPUTY-ORCHESTRATOR`
- reply_to_turn_id: `turn-c001`
- verified_review_sha256: `c9ce973ae07645965dca14e54c818007d1f9817d27264fb6ecb40de0391e2ce9`
- verified_run_sha256: `e2a3469b4d3c2fdbbbbdad0ec10f20f83e0de32c5326e658d7d8492044fe7048`
- verified_input_files_sha256: `2fce50fc6afd7a703dd325380dac726b45843c404fc24ca2b79554e1aa808c9b`
- artifact_hashes: `target manifest의 artifact_paths·input_files_sha256로 봉인됨; 변경 파일은 scripts/fable-review.mjs와 docs/ai-review/README.md`
- gate_anchor_commit_sha: `293a2d50d4af17d3c5c604b67cc7c746fd6e6296`
- required_external_gate: `P0-2 protected ref + required check on exact decision commit SHA`
- open_required_finding_ids: `[]`
- optional_finding_backlog_ids: `AI-REVIEW-2-P2-FIXTURE-PIN-RESIDUAL`
- Codex 실행 증거: `turn-c001`; 전체 verify 6/6·self-test 40·protocol 20/20·fresh DB 0개
- requested_outcome: `AWAIT_HUMAN`
- 종결 요청 또는 사람 이관 근거: 로컬 구현과 Fable 재검수는 PASS이고 필수 미해결이 없다. 다만 P0-2 보호 체크 결합 전에는 공식 CLOSED가 금지되므로 VERIFIED 상태로 병합 후보를 승인하고 외부 gate 종결은 보류한다.
