# AI-CHAT-ROUTER-REACTIVATION-006 공동 작업 장부

> 이 장부의 비-Fable 턴은 `pnpm fable:append`로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: policy·activation Decision·receipt·reactivation Decision evidence
- 충족해야 할 요구사항·불변식: current SHA 결속, exact non-production scope, endpoint rebind 이전 dispatch 금지, ACK 의미 보존
- 이번에 바꾼 내용: 현재 권위 설계 SHA와 인간 재활성화 결정을 activation 계약에 반영했다.
- 집중 검토 질문: 재봉인이 scope를 넓히거나 endpoint binding·ACK 없이 전달을 허용하는가?
- 실행한 테스트·현재 증거: sealed model plan verified; 기존 evidence bytes가 달라 새 검수가 필요하다.
- 사람 결정이 필요한 항목: 없음.
- next_review_request: `FABLE_REVIEW`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-TEAM-ROUTER-ACTIVATE-NON-PROD-001`
- task_budget_usd_approved: `4.00`
- soft_budget_overrun_risk_accepted: `r001@4.00`
- 결정: 현재 권위 문서 기준의 비운영 채팅 자동 라우팅 재활성화를 승인한다.
- 허용 범위·기한: 현재 설계 기준 11개 allowlist 비운영 메시지 재활성화의 독립검수 1회.
- 금지: human relay, 자동 새 작업, 제품·DB·Supabase·git·staging·production·비밀·배포 mutation.
- 승인자·시각: `HUMAN-CHIEF · 2026-09-04T13:28:56+09:00`
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=927ceea94e8a8566f9450a3a97bccb5b154a8923a03a97f9e98c95b0a7eca369 -->
## FABLE_RECHECK · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `927ceea94e8a8566f9450a3a97bccb5b154a8923a03a97f9e98c95b0a7eca369`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- input_files_sha256: `87b4c4826c6c17d6a6a48592f329aacce4d81f5e758efaffbc22c1e0fc4212ac`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: REACT006-RECEIPT-STALE-IMPL-SHA, REACT006-VALIDATOR-EVIDENCE-MISSING, REACT006-SUBSEQUENT-GATES-UNRECORDED
- 선택 미종결 Finding: REACT006-POLICY-GATE-KINDS
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

RECHECK r001 (선행 검수 없음, 모든 Finding 신규 OPEN). 핵심 SHA 결속은 정확하다: 설계 v0.6(02666df0…)은 policy.designSha256, decision.designSha256, receipt.designSha256, 재활성화 증거 문서에서 동일하고, model plan(60d7cb6a…)은 .sha256 파일·decision·receipt·증거 문서와 일치하며, receipt.decisionSha256(d066abab…)과 receipt.policySha256(15aad51c…)도 현재 bytes와 일치한다. Decision amendment는 amendedAt+amendmentPointer 완전한 쌍이고 scope=NON_PRODUCTION_CHAT_MESSAGES, humanRelay/production/DB/deployment 모두 false로 인간 승인 범위를 넓히지 않는다. 원시 provider ID는 산출물에 없다. 그러나 필수 Finding 3건이 남는다. (1) 재봉인 receipt의 implementationArtifacts가 AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md를 bba7c773…으로 결속하지만 현재 스냅샷 bytes는 7f4da42f…로 불일치해, ACTIVATION_SEALED를 주장하는 봉인 산출물 내부에 부정확한 hash 주장이 남는다(Major). (2) required_evidence 1번인 validate-policy·validate-manifests의 ACTIVE_DISPATCH 통과 기록이 재활성화 증거 문서를 포함한 어떤 artifact에도 없고 evidence_paths도 비어 있다(Major). (3) policy dispatchEnabled=true·receipt ACTIVATION_SEALED 상태에서 '11개 이동 채팅의 endpoint 재결속과 단일 ACK 파일럿이 실제 dispatch 이전의 후속 게이트'라는 사실이 참조 문서(REBINDING_REQUIRED, 설치 판본 hash 불일치 fail-closed)에만 있고 봉인 artifact 세트에는 기록되지 않아, 이후 구현 hash 재결속만으로 ACK 파일럿 없이 dispatch가 열릴 해석 여지가 있다(Major). 개선 1건: policy allowedMessageKinds에 STAGING/PRODUCTION gate kind가 포함되어 script 수준 BLOCKED_POLICY에만 의존한다(비차단). SENT_UNCONFIRMED→DELIVERED 의미는 설계 §6과 구현 증거에서 보존됨을 확인했다. 증거 문서 보강과 receipt hash 재결속 proposed_edits를 제안한다.

### 공동 편집 제안 색인

- REACT006-EVIDENCE-GATES-VALIDATORS: ADD `docs/ai-review/evidence/AI-CHAT-ROUTER-REACTIVATION-20260904.md` · - Model plan SHA-256: `60d7cb6a85cc43a76532f9047bcc5c4ed5113ebc3fd1708b0c954da91f85d96e` · 원문은 review.md 참조
- REACT006-RECEIPT-IMPL-SHA-REBIND: REPLACE `.codex/team-router/activation-receipt.json` ·       "sha256": "bba7c7736f37edc4fbf378f9267ed446e3bfc353bdeb29f218b2ed10c5844983" · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
