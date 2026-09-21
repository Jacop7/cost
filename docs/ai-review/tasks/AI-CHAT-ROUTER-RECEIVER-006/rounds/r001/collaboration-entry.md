
<!-- fable-review:r001 sha256=bd69e387c25c452dcea1f01881404d8b4d6d1a75bef7ebfb176e1f9ecc1def48 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `bd69e387c25c452dcea1f01881404d8b4d6d1a75bef7ebfb176e1f9ecc1def48`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- input_files_sha256: `669fe4072e777da29de2222a4d649b5cf8e03108aa28862f376f624a80a1ab47`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: RCV006-REJECTED-CONTRACT-SCHEMA-DRIFT, RCV006-CANONICAL-ROOT-ENVELOPE-TRUST, RCV006-REBIND-ROUND-CARRYOVER-MISS
- 선택 미종결 Finding: RCV006-BINDING-TABLE-GENERATION-AMBIGUITY
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

AI-CHAT-ROUTER-RECEIVER-006 초기 검수(FABLE-ARCH, 봉인 단일-pass) 판정 CHANGES_REQUIRED. 세 요구사항의 방향성과 required_evidence는 확인된다. (1) canonical_project_root 수신 계약: 설계 v0.6 §2.1과 구현 증거가 수신자가 disposable worktree가 아닌 canonical root에서 authority_paths·.codex/team-router·model plan을 검증함을 규정한다. (2) terminal rejection: ROUTE_REJECTED가 SENT_UNCONFIRMED → REJECTED terminal event로 append되고 record-rejection이 동일 delivery token·rejection pointer를 요구하며 inbound scope를 REJECTED로 닫아 ACK·재시도로 위장할 수 없다. (3) fail-closed: 신규 설치판 0.1.0+codex.20260904002351이 기존 activation receipt hash와 불일치해 재봉인 전 실제 dispatch가 차단되고, Codex가 Router 37/37 PASS·plugin validate PASS·activation artifact mismatch BLOCKED를 확인했다(터미널 증거는 협업 장부 turn-c001 기반 주장 검증). 그러나 재봉인 전 반드시 고칠 필수 Finding 3건이 있다. [Major] RCV006-REJECTED-CONTRACT-SCHEMA-DRIFT: §2.1·구현이 강제하는 REJECTED terminal 계약이 §4 envelope schema(canonical_project_root 필드 부재)·scope lock 최소 필드(state 부재)·§5 event_type enum(거절 event 부재)·§6 닫힌 전이 집합(SENT_UNCONFIRMED → REJECTED 미허용, REJECTED 불가역 목록 부재)과 자기모순이다. §6은 불가능 전이·조합을 실행기가 거부한다고 명시하므로 이대로 designSha256을 재결속하면 모순이 해시로 봉인된다. [Major] RCV006-CANONICAL-ROOT-ENVELOPE-TRUST: 수신자가 발신 envelope가 지정한 canonical_project_root 값을 수신측 고정 기준 없이 신뢰한다. 내부적으로 정합한 .codex 계약을 가진 사본·구판 clone 루트를 지정하면 hash 검증이 통과해 ACK 거짓 양성이 가능하고, 현재 REBINDING_REQUIRED fail-closed 상태를 사본 루트로 우회하는 경로가 되어 canonical-authority-root 불변식이 발신자 입력에 종속된다. 수신측 runtime의 project_id별 등록 루트와 byte-exact 대조를 추가해야 한다. [Minor] RCV006-REBIND-ROUND-CARRYOVER-MISS: ISO005가 '다음 designSha256 재결속 라운드에서' 정정하기로 한 §12 v0.4 자기참조가 바로 그 재결속 라운드(v0.5→v0.6)인 이번 bytes에 그대로 남아 있고, activation-decision.json amendment 메타데이터 이월 항목도 미처리다(결정 JSON은 reference 경로라 별도 작업 요청). 지금 놓치면 decision·policy·receipt 3중 재결속을 한 번 더 치러야 한다. [Improvement] 구현 증거의 결속 표가 구 receipt에 봉인된 v0.5 계보와 재봉인 대기 신규 bytes를 구분 없이 섞어 감사 혼선 위험이 있다. SOLAR 집중 질문에 대한 답: terminal REJECTED는 프로토콜상 ACK 거짓 양성·무한 재시도를 만들지 않는다 — REJECTED는 불가역이고 재시도는 FAILED_TRANSIENT 2회 상한에만 적용되며 발송은 명시적 에이전트 행위다. 다만 위 Major 2건이 해소되어야 이 보장이 봉인 설계와 수신측 검증에 기계적으로 고정된다. 세 건 모두 재봉인 전 수정 비용이 거의 없으므로 같은 재결속 라운드에 일괄 반영을 권장하며, 공동 편집 제안 7건을 첨부한다. 이 판정은 로컬이며 외부 보호 게이트는 OPEN으로 남는다.

### 공동 편집 제안 색인

- RCV006-EDIT-EVENT-TYPE-REJECTED: REPLACE `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md` · event_type: ROUTE_STATE | DISPATCH_INTENT | DELIVERY_RECEIPT | ACK | POLICY_BLOCK | · 원문은 review.md 참조
- RCV006-EDIT-STATE-MACHINE-REJECTED: ADD `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md` · 직전 비종결 상태에서 `CANCELLED`로만 이동한다. · 원문은 review.md 참조
- RCV006-EDIT-ENVELOPE-CANONICAL-ROOT: ADD `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md` · delivery_token: DELIVERY-<uuid> · 원문은 review.md 참조
- RCV006-EDIT-RECEIVER-ROOT-PINNING: ADD `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md` · 닫는다. 거절은 ACK·DELIVERED·재시도로 바꿀 수 없으며, 수정된 계약으로만 새 route를 준비한다. · 원문은 review.md 참조
- RCV006-EDIT-TESTS-REJECTION: ADD `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md` · - `SENT_UNCONFIRMED`를 `DELIVERED`로 위장하는 receipt 거부 · 원문은 review.md 참조
- RCV006-EDIT-V04-REF-FIX: REPLACE `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md` · 1. 이 v0.4와 Fable delta 재검수 Finding을 정리한다. · 원문은 review.md 참조
- RCV006-EDIT-BINDING-TABLE-GENERATION-NOTE: COMMENT `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md` · | 실행 설계 v0.5 | `221c666aba93d773c99df1553f5b3b0d09a19b9d7e6773cadd247301038b2ef4` | · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
