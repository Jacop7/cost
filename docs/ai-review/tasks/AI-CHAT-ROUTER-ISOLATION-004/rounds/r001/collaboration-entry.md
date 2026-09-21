
<!-- fable-review:r001 sha256=5f9b5b9dc8442162584fc0afd7dac4ebf6bfa463063ec9a9cc74ed786cee72ab -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `5f9b5b9dc8442162584fc0afd7dac4ebf6bfa463063ec9a9cc74ed786cee72ab`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- input_files_sha256: `e2776231f0c28236ab86f40b9a7de1ff14a65bad411970de4c81d9bc97f0fda9`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: ISO004-CHILD-ROUTE-MECHANICAL-ENFORCEMENT, ISO004-DESIGN-ENVELOPE-CONTRACT-DRIFT, ISO004-UPDATED-PLUGIN-BYTES-EVIDENCE
- 선택 미종결 Finding: ISO004-ACK-REPILOT-EVIDENCE, ISO004-REVIEW-EVIDENCE-PATH-MISSING
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

격리 delta는 첫 파일럿의 unrelated DECISION_POINTER 재전달 사건을 정직하게 공개했고, 저장소 내 해시 결속은 모두 일치한다(receipt의 decisionSha256=c8efb3a8…, policySha256=92dc3a05…, designSha256=83baffef…, 구현 증거 e6f7b69f…가 sealed 입력 실제 해시와 동일). gate kind BLOCKED_POLICY 경계와 비운영 범위·mutation 금지도 유지된다. 그러나 필수 Finding 3건이 남는다. (1) Major ISO004-CHILD-ROUTE-MECHANICAL-ENFORCEMENT: 재발 방지 증거가 수신 prompt 문구 포함 검사뿐이며, 문제의 재전달은 허용 edge(01→02 DECISION_POINTER) 위에서 발생했으므로 edge allowlist로 차단되지 않는다. child_routes_allowed=false 세션의 신규 route를 실행기가 BLOCKED_POLICY로 거부하는 기계적 강제와 sabotage test 증거(또는 exact SHA 결속 사람 위험 수용)가 필요하다. (2) Minor ISO004-DESIGN-ENVELOPE-CONTRACT-DRIFT: policy·receipt가 결속한 designSha256은 v0.4이고 §4 envelope schema에 scope_isolation·child_routes_allowed·expected_response 필드가 없어 격리 계약이 구현 증거 산문과 저장소 밖 plugin bytes에만 존재한다. 설계는 reference 경로이므로 별도 작업의 전진 정정(v0.5)과 재결속을 요구한다. (3) Minor ISO004-UPDATED-PLUGIN-BYTES-EVIDENCE: 설치 판본 stamp 20260903222746이 2026-09-04 보강 시점보다 앞서고 테스트 수가 35/35로 유지되어 "갱신된 plugin bytes" 주장을 sealed 입력만으로 증명할 수 없다. Improvement 2건: 보강 후 child_routes_allowed=false ACK 재파일럿 실측 증거를 후속 라운드에 첨부할 것, 그리고 reference로 선언된 ACTIVATION-003 r001 review.md가 sealed 입력에 미물질화되어 receipt reviewEvidence 해시 4건을 교차검증하지 못했으므로 다음 라운드에 포함할 것. SOLAR의 집중 질문(unrelated history 재실행 차단 + 명시적 child routing 유지)에 대한 답: 설계 방향은 맞으나 현재 증거로는 차단이 prompt 권고 수준이라 기계적 보장으로 볼 수 없다. 판정 CHANGES_REQUIRED.

### 공동 편집 제안 색인

- ISO004-EDIT-ENFORCEMENT-TEST-NOTE: COMMENT `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md` · - 수신 prompt에 현재 envelope만 처리하고 이전 문맥을 재개하지 않는 격리 문구와 child-route 기본 차단 포함 · 원문은 review.md 참조
- ISO004-EDIT-REINSTALL-STAMP: COMMENT `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md` · 설치 판본은 `0.1.0+codex.20260903222746`이다. 원시 provider endpoint ID와 HMAC key는 Git 바깥 · 원문은 review.md 참조
- ISO004-EDIT-DESIGN-DRIFT-NOTE: ADD `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md` · 확인한다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
