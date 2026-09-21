# AI-CHAT-ROUTER-ISOLATION-004 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `6497666e655609a4f4bfe10bfaea6070dad01286`

## 요약

격리 delta는 첫 파일럿의 unrelated DECISION_POINTER 재전달 사건을 정직하게 공개했고, 저장소 내 해시 결속은 모두 일치한다(receipt의 decisionSha256=c8efb3a8…, policySha256=92dc3a05…, designSha256=83baffef…, 구현 증거 e6f7b69f…가 sealed 입력 실제 해시와 동일). gate kind BLOCKED_POLICY 경계와 비운영 범위·mutation 금지도 유지된다. 그러나 필수 Finding 3건이 남는다. (1) Major ISO004-CHILD-ROUTE-MECHANICAL-ENFORCEMENT: 재발 방지 증거가 수신 prompt 문구 포함 검사뿐이며, 문제의 재전달은 허용 edge(01→02 DECISION_POINTER) 위에서 발생했으므로 edge allowlist로 차단되지 않는다. child_routes_allowed=false 세션의 신규 route를 실행기가 BLOCKED_POLICY로 거부하는 기계적 강제와 sabotage test 증거(또는 exact SHA 결속 사람 위험 수용)가 필요하다. (2) Minor ISO004-DESIGN-ENVELOPE-CONTRACT-DRIFT: policy·receipt가 결속한 designSha256은 v0.4이고 §4 envelope schema에 scope_isolation·child_routes_allowed·expected_response 필드가 없어 격리 계약이 구현 증거 산문과 저장소 밖 plugin bytes에만 존재한다. 설계는 reference 경로이므로 별도 작업의 전진 정정(v0.5)과 재결속을 요구한다. (3) Minor ISO004-UPDATED-PLUGIN-BYTES-EVIDENCE: 설치 판본 stamp 20260903222746이 2026-09-04 보강 시점보다 앞서고 테스트 수가 35/35로 유지되어 "갱신된 plugin bytes" 주장을 sealed 입력만으로 증명할 수 없다. Improvement 2건: 보강 후 child_routes_allowed=false ACK 재파일럿 실측 증거를 후속 라운드에 첨부할 것, 그리고 reference로 선언된 ACTIVATION-003 r001 review.md가 sealed 입력에 미물질화되어 receipt reviewEvidence 해시 4건을 교차검증하지 못했으므로 다음 라운드에 포함할 것. SOLAR의 집중 질문(unrelated history 재실행 차단 + 명시적 child routing 유지)에 대한 답: 설계 방향은 맞으나 현재 증거로는 차단이 prompt 권고 수준이라 기계적 보장으로 볼 수 없다. 판정 CHANGES_REQUIRED.

## Findings

### ISO004-CHILD-ROUTE-MECHANICAL-ENFORCEMENT — Major / OPEN

- 범주: ARCHITECTURE
- 영향: 첫 파일럿에서 관측된 실패(수신 작업이 ACK 뒤 과거 문맥의 DECISION_POINTER를 허용 edge로 재전달)는 edge·kind allowlist로 차단되지 않으며, 이번 보강의 sealed 증거는 수신 prompt 문구 포함 검사뿐이다. prompt는 권고적 통제라 동일 실패가 재발할 수 있고, TEAM-ROUTER:scope-isolation과 no-unrelated-history 불변식이 기계적으로 보장되지 않는다.
- 근거: docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md:51, docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md:63, docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md:95
- 완료 조건: child_routes_allowed=false envelope로 수신한 세션이 새 route prepare-dispatch를 시도하면 실행기가 BLOCKED_POLICY event로 거부한다는 구현 증거가 결속 산출물 해시와 함께 기록된다. / 해당 거부를 검증하는 sabotage test가 추가되고, 추가·수정된 테스트 이름과 개수 delta가 구현 증거 문서에 명시된다. / 또는 prompt 수준 통제와 재파일럿 감사로 충분하다는 명시적 사람 위험 수용이 exact SHA에 결속되어 기록된다.
- 필요한 테스트: child_routes_allowed=false 수신 세션의 신규 route 생성 시 BLOCKED_POLICY 거부 sabotage test / 허용 edge(01→02 DECISION_POINTER)에서 unrelated prior-context 재전달이 거부되는 회귀 test

### ISO004-DESIGN-ENVELOPE-CONTRACT-DRIFT — Minor / OPEN

- 범주: DATA_INTEGRITY
- 영향: 격리 계약이 저장소 안에서는 구현 증거 산문에만, 실행 측에서는 Git 밖 plugin bytes에만 존재한다. 봉인 designSha256이 격리 필드가 없는 v0.4에 결속되어, 봉인 설계를 기준으로 envelope를 검증하는 후속 검수·validator가 격리 계약을 확인·강제할 수 없다.
- 근거: .codex/team-router/policy.json:12, .codex/team-router/activation-receipt.json:7, docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md:127, docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md:13
- 완료 조건: 별도 작업에서 실행 설계를 전진 정정(v0.5)해 §4 envelope schema에 scope_isolation·child_routes_allowed·expected_response 필드와 의미를 추가하고, 새 designSha256을 policy.json과 activation receipt에 재결속한다. / 재결속 전까지 구현 증거 문서에 이 drift 사실과 정정 계획을 명시한다.
- 필요한 테스트: 갱신된 designSha256과 policy·receipt 결속에 대한 validate-policy 재검증

### ISO004-UPDATED-PLUGIN-BYTES-EVIDENCE — Minor / OPEN

- 범주: DATA_INTEGRITY
- 영향: required_evidence의 'active receipt validates against updated plugin bytes'에서 receipt가 어떤 bytes와 일치하는지는 검증되지만, 그 bytes가 격리 보강 이후의 갱신본이라는 사실은 sealed 입력만으로 증명되지 않는다. 판본 stamp와 불변 테스트 수는 오히려 보강 이전 build일 가능성을 배제하지 못한다.
- 근거: docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md:38, docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md:44, COLLABORATION_LOG:0
- 완료 조건: 격리 보강 이후 재설치 판본·시각(또는 보강 전후 team_router.py sha 비교)이 구현 증거 문서에 기록된다. / 격리 보강으로 추가·수정된 테스트의 이름과 개수 변화가 명시된다.
- 필요한 테스트: 재설치 후 active receipt의 implementationArtifacts 해시와 설치 bytes의 재검증(plugin validate)

### ISO004-ACK-REPILOT-EVIDENCE — Improvement / OPEN

- 범주: TEST_GAP
- 영향: 요구사항 4(TEAM_ROUTER_ACK 파일럿은 동일 delivery token ACK 외 작업 금지)의 실측 증거가 아직 없다. 다만 미실행 사실이 정직하게 공개되었고 Fable delta 이후 실행이 계획된 순서이므로 차단 사유는 아니다.
- 근거: docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md:66, COLLABORATION_LOG:0
- 완료 조건: 재파일럿 후 route ledger tail hash와 함께 추가 route 0건·ACK 외 동작 0건을 보여주는 증거를 후속 라운드에 첨부한다.
- 필요한 테스트: child_routes_allowed=false ACK 재파일럿 및 추가 route 미생성 확인

### ISO004-REVIEW-EVIDENCE-PATH-MISSING — Improvement / OPEN

- 범주: OPERATIONS
- 영향: 선언된 reference 경로가 sealed 입력에서 빠져 receipt의 reviewEvidence 결속을 독립 확인할 수 없었다. 핵심 격리 delta 검증에는 영향이 없으나 봉인 증거 사슬의 완결성이 낮아진다.
- 근거: .codex/team-router/activation-receipt.json:39, COLLABORATION_LOG:0
- 완료 조건: 다음 라운드 sealed 입력에 ACTIVATION-003 r001 review.md(및 가능하면 run.json)를 물질화해 receipt reviewEvidence 해시를 교차검증할 수 있게 한다.
- 필요한 테스트: 없음

## 공동 편집 제안

### ISO004-EDIT-ENFORCEMENT-TEST-NOTE — COMMENT

- 대상: `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md`
- 위치: - 수신 prompt에 현재 envelope만 처리하고 이전 문맥을 재개하지 않는 격리 문구와 child-route 기본 차단 포함
- 연결 Finding: ISO004-CHILD-ROUTE-MECHANICAL-ENFORCEMENT
- 이유: 관측된 실패 모드에 대한 강제 지점이 prompt 권고뿐이라는 Major Finding의 해소 경로를 산출물에 직접 기록하기 위함.

    prompt 문구 포함 검사 외에, child_routes_allowed=false envelope로 수신한 세션이 새 route prepare-dispatch를 시도하면 실행기가 BLOCKED_POLICY로 기계적으로 거부하는 sabotage test를 추가하고, 추가·수정된 테스트 이름과 새 테스트 개수를 이 목록에 명시해 주세요. 첫 파일럿의 unrelated DECISION_POINTER 재전달은 허용 edge(01→02 DECISION_POINTER) 위에서 발생했으므로 edge allowlist와 prompt 문구만으로는 재발을 기계적으로 막을 수 없습니다.

### ISO004-EDIT-REINSTALL-STAMP — COMMENT

- 대상: `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md`
- 위치: 설치 판본은 `0.1.0+codex.20260903222746`이다. 원시 provider endpoint ID와 HMAC key는 Git 바깥
- 연결 Finding: ISO004-UPDATED-PLUGIN-BYTES-EVIDENCE
- 이유: required_evidence의 'updated plugin bytes' 주장과 sealed 증거 사이의 판본 시점 공백을 닫기 위함.

    격리 보강 이후 재설치의 판본·시각(또는 보강 전후 team_router.py SHA-256 비교)을 여기에 기록해, receipt가 봉인한 해시가 2026-09-04 보강 이후 bytes임을 증명해 주세요. 현재 build stamp(2026-09-03 22:27:46)는 보강 발견 시점보다 앞서 있어 sealed 입력만으로는 갱신 여부를 판별할 수 없습니다.

### ISO004-EDIT-DESIGN-DRIFT-NOTE — ADD

- 대상: `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md`
- 위치: 확인한다.
- 연결 Finding: ISO004-DESIGN-ENVELOPE-CONTRACT-DRIFT
- 이유: designSha256이 격리 계약 없는 v0.4에 결속된 drift를 산출물에 공개하고 전진 정정 경로를 고정하기 위함. 설계 문서는 reference 경로라 직접 수정 대신 별도 작업을 요청한다.

    
    이 격리 계약(`scope_isolation.only_this_envelope`, `resume_prior_context`, `child_routes_allowed`, `expected_response`)은 봉인된 실행 설계 v0.4 §4 envelope schema에는 아직 없다. 별도 작업에서 설계를 v0.5로 전진 정정해 해당 필드와 의미를 추가하고 `policy.json`·activation receipt의 `designSha256`을 새 판본으로 재결속하기 전까지는, 이 문서가 저장소 측의 유일한 격리 계약 기록임을 명시한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: ISO004-CHILD-ROUTE-MECHANICAL-ENFORCEMENT, ISO004-DESIGN-ENVELOPE-CONTRACT-DRIFT, ISO004-UPDATED-PLUGIN-BYTES-EVIDENCE

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
