# AI-CHAT-ROUTER-REACTIVATION-006 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `RECHECK`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `6497666e655609a4f4bfe10bfaea6070dad01286`

## 요약

RECHECK r001 (선행 검수 없음, 모든 Finding 신규 OPEN). 핵심 SHA 결속은 정확하다: 설계 v0.6(02666df0…)은 policy.designSha256, decision.designSha256, receipt.designSha256, 재활성화 증거 문서에서 동일하고, model plan(60d7cb6a…)은 .sha256 파일·decision·receipt·증거 문서와 일치하며, receipt.decisionSha256(d066abab…)과 receipt.policySha256(15aad51c…)도 현재 bytes와 일치한다. Decision amendment는 amendedAt+amendmentPointer 완전한 쌍이고 scope=NON_PRODUCTION_CHAT_MESSAGES, humanRelay/production/DB/deployment 모두 false로 인간 승인 범위를 넓히지 않는다. 원시 provider ID는 산출물에 없다. 그러나 필수 Finding 3건이 남는다. (1) 재봉인 receipt의 implementationArtifacts가 AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md를 bba7c773…으로 결속하지만 현재 스냅샷 bytes는 7f4da42f…로 불일치해, ACTIVATION_SEALED를 주장하는 봉인 산출물 내부에 부정확한 hash 주장이 남는다(Major). (2) required_evidence 1번인 validate-policy·validate-manifests의 ACTIVE_DISPATCH 통과 기록이 재활성화 증거 문서를 포함한 어떤 artifact에도 없고 evidence_paths도 비어 있다(Major). (3) policy dispatchEnabled=true·receipt ACTIVATION_SEALED 상태에서 '11개 이동 채팅의 endpoint 재결속과 단일 ACK 파일럿이 실제 dispatch 이전의 후속 게이트'라는 사실이 참조 문서(REBINDING_REQUIRED, 설치 판본 hash 불일치 fail-closed)에만 있고 봉인 artifact 세트에는 기록되지 않아, 이후 구현 hash 재결속만으로 ACK 파일럿 없이 dispatch가 열릴 해석 여지가 있다(Major). 개선 1건: policy allowedMessageKinds에 STAGING/PRODUCTION gate kind가 포함되어 script 수준 BLOCKED_POLICY에만 의존한다(비차단). SENT_UNCONFIRMED→DELIVERED 의미는 설계 §6과 구현 증거에서 보존됨을 확인했다. 증거 문서 보강과 receipt hash 재결속 proposed_edits를 제안한다.

## Findings

### REACT006-RECEIPT-STALE-IMPL-SHA — Major / OPEN

- 범주: DATA_INTEGRITY
- 영향: 봉인 receipt가 저장소 내 검증 가능한 파일에 대해 거짓 hash를 주장하므로, receipt를 기준으로 in-repo 증거를 대조하는 어떤 검증기도 실패하거나(fail-closed) 반대로 stale 값을 신뢰하게 된다. '현재 설계·모델 계획·Decision·policy·receipt의 SHA 결속이 정확해야 한다'는 요구를 receipt 내부 증거 체인이 위반한다.
- 근거: .codex/team-router/activation-receipt.json:30, .codex/team-router/activation-receipt.json:3, docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md:26
- 완료 조건: activation-receipt.json의 implementationArtifacts 중 저장소 내 경로 항목이 현재 스냅샷 bytes의 sha256과 정확히 일치하거나, stale 항목을 의도적으로 유지하는 경우 그 사유와 fail-closed 의미가 재활성화 증거 문서에 명시된다. / receipt 재봉인 후 decision·policy·design·model-plan 결속이 여전히 현재 bytes와 일치한다.
- 필요한 테스트: receipt implementationArtifacts의 repo 상대 경로 전 항목에 대한 sha256 재계산 대조 / 변조된 implementation hash로 validate-policy 실행 시 active dispatch 거부 확인

### REACT006-VALIDATOR-EVIDENCE-MISSING — Major / OPEN

- 범주: TEST_GAP
- 영향: required_evidence 1번(validate-policy and validate-manifests pass with ACTIVE_DISPATCH)이 미충족이다. 재봉인된 hash 조합이 실제 검증기를 통과하는지 확인되지 않은 채 ACTIVE_DISPATCH 계약이 봉인된 상태다.
- 근거: docs/ai-review/evidence/AI-CHAT-ROUTER-REACTIVATION-20260904.md:1, .codex/team-router/policy.json:3
- 완료 조건: 현재 policy·decision·receipt·design·model-plan sha256에 결속된 validate-policy·validate-manifests PASS 기록이 재활성화 증거 문서 또는 evidence_paths에 추가된다. / 검증 실행 주체(CODEX-FUNCTION-QA)와 실행 시각·대상 hash가 증거에 명시된다.
- 필요한 테스트: 현재 bytes 기준 validate-policy 실행 및 결과 기록 / 11개 manifest에 대한 validate-manifests 실행 및 결과 기록 / exact 승인문·hash 변조 시 거부되는 sabotage 재확인

### REACT006-SUBSEQUENT-GATES-UNRECORDED — Major / OPEN

- 범주: ARCHITECTURE
- 영향: required_evidence 3번(endpoint rebinding and a single ACK pilot remain subsequent gates)이 봉인 artifact 세트에 기록되지 않았다. 현재 dispatch 차단이 구현 hash 불일치라는 부수 효과에만 의존하므로, 이후 구현 hash만 재결속하면 11개 이동 채팅의 endpoint 재결속 검증과 ACK 파일럿 없이 실제 dispatch가 열릴 해석 여지가 생겨 요구사항 3을 약화시킨다.
- 근거: .codex/team-router/activation-receipt.json:3, .codex/team-router/policy.json:3, docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md:3, docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md:58, docs/ai-review/evidence/AI-CHAT-ROUTER-REACTIVATION-20260904.md:8
- 완료 조건: 재활성화 증거 문서에 '11개 이동 logical chat의 endpoint 재결속 완료와 child_routes_allowed=false 단일 ACK 파일럿(추가 route 0건)이 실제 dispatch 이전의 필수 후속 게이트이며, 현재 봉인은 scope·hash 결속만 승인한다'는 문구가 추가된다. / receipt 또는 증거 문서가 현재 설치 구현과의 hash 불일치로 dispatch가 fail-closed 상태임을 명시한다.
- 필요한 테스트: endpoint 재결속 전 prepare-dispatch가 fail-closed로 거부되는지 확인 / 재결속 후 child_routes_allowed=false ACK 파일럿에서 추가 route 0건 확인

### REACT006-POLICY-GATE-KINDS — Improvement / OPEN

- 범주: ARCHITECTURE
- 영향: gate kind 차단이 policy 계층이 아닌 router script의 추가 검사에만 의존한다. script 회귀 시 policy allowlist가 방어선이 되지 못한다. 이전 정식 검수에서 수용된 설계이므로 비차단 개선 항목이다.
- 근거: .codex/team-router/policy.json:20, docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md:20
- 완료 조건: 다음 policy 재봉인 시 비운영 활성 allowlist에서 staging/production gate kind를 제거하거나, gate kind가 policy 수준에서도 차단되는 별도 필드를 추가한다.
- 필요한 테스트: policy 수준에서 gate kind가 거부되는 회귀 시험

## 공동 편집 제안

### REACT006-EVIDENCE-GATES-VALIDATORS — ADD

- 대상: `docs/ai-review/evidence/AI-CHAT-ROUTER-REACTIVATION-20260904.md`
- 위치: - Model plan SHA-256: `60d7cb6a85cc43a76532f9047bcc5c4ed5113ebc3fd1708b0c954da91f85d96e`
- 연결 Finding: REACT006-VALIDATOR-EVIDENCE-MISSING, REACT006-SUBSEQUENT-GATES-UNRECORDED
- 이유: required_evidence 1·3번(검증기 통과 기록, endpoint 재결속·ACK 파일럿 후속 게이트)을 봉인 artifact에 명시해 REACT006-VALIDATOR-EVIDENCE-MISSING과 REACT006-SUBSEQUENT-GATES-UNRECORDED를 해소한다. run pointer는 실제 실행 증거로 채워야 한다.

    - Policy SHA-256: `15aad51c68927075f8d54fdbdba043bde9c50db5bb7af866c040e7ed0ccb787e`
    - Activation decision SHA-256: `d066abab56cf851965ef155368e35e3077c942d6daabeca51a72012c4ef00327`
    - Validation: `validate-policy` and `validate-manifests` PASS under `ACTIVE_DISPATCH` against the SHAs above (executed by CODEX-FUNCTION-QA; run pointer: <추가 필요>).
    
    Actual dispatch remains fail-closed until two subsequent gates complete: (1) endpoint rebinding of all 11 relocated logical chats against the currently installed implementation hashes, and (2) one `child_routes_allowed=false` ACK-only pilot recording zero additional routes. This reseal binds scope and hashes only; it does not authorize immediate dispatch.

### REACT006-RECEIPT-IMPL-SHA-REBIND — REPLACE

- 대상: `.codex/team-router/activation-receipt.json`
- 위치:       "sha256": "bba7c7736f37edc4fbf378f9267ed446e3bfc353bdeb29f218b2ed10c5844983"
- 연결 Finding: REACT006-RECEIPT-STALE-IMPL-SHA
- 이유: AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md의 현재 스냅샷 sha256으로 재결속한다. 적용 시 receipt bytes가 바뀌므로 runtime 측 receipt 결속 재봉인과 나머지 implementationArtifacts(특히 PILOT-002·플러그인 script) hash의 현재 값 재검증을 같은 재봉인 절차에서 함께 수행해야 한다.

          "sha256": "7f4da42fd139556be09887e1286ee5eeba57c041a7ff8c72f4a8fbf994fac411"

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: REACT006-RECEIPT-STALE-IMPL-SHA, REACT006-VALIDATOR-EVIDENCE-MISSING, REACT006-SUBSEQUENT-GATES-UNRECORDED

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
