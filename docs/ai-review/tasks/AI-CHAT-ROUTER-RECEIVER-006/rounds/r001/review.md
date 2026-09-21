# AI-CHAT-ROUTER-RECEIVER-006 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `6497666e655609a4f4bfe10bfaea6070dad01286`

## 요약

AI-CHAT-ROUTER-RECEIVER-006 초기 검수(FABLE-ARCH, 봉인 단일-pass) 판정 CHANGES_REQUIRED. 세 요구사항의 방향성과 required_evidence는 확인된다. (1) canonical_project_root 수신 계약: 설계 v0.6 §2.1과 구현 증거가 수신자가 disposable worktree가 아닌 canonical root에서 authority_paths·.codex/team-router·model plan을 검증함을 규정한다. (2) terminal rejection: ROUTE_REJECTED가 SENT_UNCONFIRMED → REJECTED terminal event로 append되고 record-rejection이 동일 delivery token·rejection pointer를 요구하며 inbound scope를 REJECTED로 닫아 ACK·재시도로 위장할 수 없다. (3) fail-closed: 신규 설치판 0.1.0+codex.20260904002351이 기존 activation receipt hash와 불일치해 재봉인 전 실제 dispatch가 차단되고, Codex가 Router 37/37 PASS·plugin validate PASS·activation artifact mismatch BLOCKED를 확인했다(터미널 증거는 협업 장부 turn-c001 기반 주장 검증). 그러나 재봉인 전 반드시 고칠 필수 Finding 3건이 있다. [Major] RCV006-REJECTED-CONTRACT-SCHEMA-DRIFT: §2.1·구현이 강제하는 REJECTED terminal 계약이 §4 envelope schema(canonical_project_root 필드 부재)·scope lock 최소 필드(state 부재)·§5 event_type enum(거절 event 부재)·§6 닫힌 전이 집합(SENT_UNCONFIRMED → REJECTED 미허용, REJECTED 불가역 목록 부재)과 자기모순이다. §6은 불가능 전이·조합을 실행기가 거부한다고 명시하므로 이대로 designSha256을 재결속하면 모순이 해시로 봉인된다. [Major] RCV006-CANONICAL-ROOT-ENVELOPE-TRUST: 수신자가 발신 envelope가 지정한 canonical_project_root 값을 수신측 고정 기준 없이 신뢰한다. 내부적으로 정합한 .codex 계약을 가진 사본·구판 clone 루트를 지정하면 hash 검증이 통과해 ACK 거짓 양성이 가능하고, 현재 REBINDING_REQUIRED fail-closed 상태를 사본 루트로 우회하는 경로가 되어 canonical-authority-root 불변식이 발신자 입력에 종속된다. 수신측 runtime의 project_id별 등록 루트와 byte-exact 대조를 추가해야 한다. [Minor] RCV006-REBIND-ROUND-CARRYOVER-MISS: ISO005가 '다음 designSha256 재결속 라운드에서' 정정하기로 한 §12 v0.4 자기참조가 바로 그 재결속 라운드(v0.5→v0.6)인 이번 bytes에 그대로 남아 있고, activation-decision.json amendment 메타데이터 이월 항목도 미처리다(결정 JSON은 reference 경로라 별도 작업 요청). 지금 놓치면 decision·policy·receipt 3중 재결속을 한 번 더 치러야 한다. [Improvement] 구현 증거의 결속 표가 구 receipt에 봉인된 v0.5 계보와 재봉인 대기 신규 bytes를 구분 없이 섞어 감사 혼선 위험이 있다. SOLAR 집중 질문에 대한 답: terminal REJECTED는 프로토콜상 ACK 거짓 양성·무한 재시도를 만들지 않는다 — REJECTED는 불가역이고 재시도는 FAILED_TRANSIENT 2회 상한에만 적용되며 발송은 명시적 에이전트 행위다. 다만 위 Major 2건이 해소되어야 이 보장이 봉인 설계와 수신측 검증에 기계적으로 고정된다. 세 건 모두 재봉인 전 수정 비용이 거의 없으므로 같은 재결속 라운드에 일괄 반영을 권장하며, 공동 편집 제안 7건을 첨부한다. 이 판정은 로컬이며 외부 보호 게이트는 OPEN으로 남는다.

## Findings

### RCV006-REJECTED-CONTRACT-SCHEMA-DRIFT — Major / OPEN

- 범주: ARCHITECTURE
- 영향: 재봉인될 권위 설계 v0.6이 구현된 거절 계약과 자기모순이다. §6 규칙대로면 실행기는 SENT_UNCONFIRMED → REJECTED를 불가능 전이로 거부해야 하고, 반대로 구현의 enum 확장은 봉인 설계 밖 동작이 된다. 이대로 designSha256을 재결속하면 모순이 해시로 봉인되어 truthful-delivery 계약의 단일 권위가 깨진다.
- 근거: docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md:58, docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md:185, docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md:240, docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md:135, docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md:45
- 완료 조건: §4 envelope schema에 canonical_project_root 필드를 추가한다. / §4 scope lock record에 state 필드(ACTIVE → ACKED | REJECTED)를 추가한다. / §5 event_type enum에 ROUTE_REJECTED를 추가한다. / §6에 SENT_UNCONFIRMED → REJECTED terminal 전이를 명시하고 REJECTED를 불가역 목록에 추가한다. / §13 필수 시험에 거절 terminal·scope 폐쇄·재해석 차단 시험을 추가한 뒤 같은 라운드에 재결속한다.
- 필요한 테스트: test_receiver_rejection_is_terminal_and_closes_inbound_scope가 갱신된 schema(ROUTE_REJECTED event type·scope state)와 일치하는지 재확인 / REJECTED를 ACK·DELIVERED·재시도로 재해석하려는 시도의 sabotage 차단

### RCV006-CANONICAL-ROOT-ENVELOPE-TRUST — Major / OPEN

- 범주: ARCHITECTURE
- 영향: 발신 envelope가 내부적으로 정합한 .codex 계약(구판 policy·receipt)을 가진 사본·구판 clone 루트를 지정하면 수신 hash 검증이 통과해 ACK 거짓 양성이 가능하다. 현재 canonical root의 REBINDING_REQUIRED fail-closed 상태를 사본 루트로 우회하는 경로가 되며, canonical-authority-root 불변식이 발신자 입력에 종속된다. SOLAR 집중 질문(ACK 거짓 양성)의 직접 잔여 위험이다.
- 근거: docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md:58, docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md:47, AGENTS.md:31
- 완료 조건: 수신측 shared runtime에 project_id별 등록 canonical root를 고정하고 envelope 값과 byte-exact 대조를 의무화한다. / 불일치·미등록·기록 손상 시 계약 검증 없이 같은 delivery token으로 ROUTE_REJECTED만 반환한다. / 등록 루트 변경은 사람 Decision이 연결된 전진 정정으로만 수행함을 설계 §2.1에 명문화하고 재결속한다.
- 필요한 테스트: 등록 루트와 불일치하는 envelope canonical_project_root(사본·사칭 루트) 거절 sabotage test / 등록 루트 일치 시 기존 canonical root 검증 경로가 그대로 동작하는 회귀 확인

### RCV006-REBIND-ROUND-CARRYOVER-MISS — Minor / OPEN

- 범주: OTHER
- 영향: 이번 라운드가 바로 약속된 재결속 라운드인데 v0.4 자기참조가 봉인 후보 bytes에 그대로 남아 있다. 지금 재봉인하면 이전 Improvement의 완료 조건이 사실상 무기 연기되고, 정정에 또 한 번의 decision·policy·receipt 3중 재결속이 필요해진다. activation-decision.json은 reference 경로이므로 amendment 메타데이터는 별도 작업으로 요청해야 한다.
- 근거: docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md:1, docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md:420, docs/ai-review/tasks/AI-CHAT-ROUTER-ISOLATION-005/rounds/r001/review.md:40, docs/ai-review/tasks/AI-CHAT-ROUTER-ISOLATION-005/rounds/r001/review.md:33
- 완료 조건: 재봉인 전에 §12의 v0.4 자기참조를 정정한다(첨부 편집 제안 반영). / 같은 재결속 commit에서 decision·policy·receipt의 designSha256을 새 bytes로 일괄 갱신한다. / 별도 작업으로 activation-decision.json에 amendment 메타데이터(amendedAt·turn-h001 포인터)를 전진 추가한다.
- 필요한 테스트: 재결속 후 validate-policy 및 receipt 해시 재검증

### RCV006-BINDING-TABLE-GENERATION-AMBIGUITY — Improvement / OPEN

- 범주: OPERATIONS
- 영향: 감사 시 어떤 행이 현재 봉인(구 receipt) 상태이고 어떤 행이 재봉인 대기 신규 bytes인지 구분할 수 없고, 002351 판본의 script SHA 계보(918e31fb… 이후)가 서술에 없다. 차단 사유는 아니나 재봉인 라운드에서 함께 정리하면 증거 사슬 추적성이 좋아진다.
- 근거: docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md:24, docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md:52
- 완료 조건: 결속 표의 각 행에 '현재 봉인'/'재봉인 대기' 상태를 표기하거나 표를 두 세대로 분리한다. / 0.1.0+codex.20260904002351 판본의 script SHA 계보를 서술에 추가한다.
- 필요한 테스트: 없음

## 공동 편집 제안

### RCV006-EDIT-EVENT-TYPE-REJECTED — REPLACE

- 대상: `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md`
- 위치: event_type: ROUTE_STATE | DISPATCH_INTENT | DELIVERY_RECEIPT | ACK | POLICY_BLOCK |
- 연결 Finding: RCV006-REJECTED-CONTRACT-SCHEMA-DRIFT
- 이유: §2.1이 요구하는 거절 event를 §5 event chain schema enum에 추가해 봉인 설계와 구현의 모순을 제거한다.

    event_type: ROUTE_STATE | DISPATCH_INTENT | DELIVERY_RECEIPT | ACK | ROUTE_REJECTED | POLICY_BLOCK |

### RCV006-EDIT-STATE-MACHINE-REJECTED — ADD

- 대상: `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md`
- 위치: 직전 비종결 상태에서 `CANCELLED`로만 이동한다.
- 연결 Finding: RCV006-REJECTED-CONTRACT-SCHEMA-DRIFT
- 이유: §6 닫힌 전이 집합에 REJECTED terminal 전이와 불가역 규칙을 명시해 §2.1·구현과 일치시킨다.

    
    수신 거절은 `SENT_UNCONFIRMED → REJECTED`로만 진입하는 terminal 전이다. `REJECTED`는 `ROUTE_REJECTED`
    event로 기록하고 동일 `delivery_token`과 rejection pointer를 요구하며, inbound scope record의 `state`를
    `REJECTED`로 닫는다. `REJECTED`는 `BLOCKED_POLICY`·`CANCELLED`·`SIMULATED`·`COMPLETED`처럼 같은
    route에서 되돌리지 않으며 ACK·`DELIVERED`·재시도로 재해석할 수 없다. scope record 최소 필드에는
    `state`(`ACTIVE → ACKED | REJECTED`)를 추가한다.

### RCV006-EDIT-ENVELOPE-CANONICAL-ROOT — ADD

- 대상: `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md`
- 위치: delivery_token: DELIVERY-<uuid>
- 연결 Finding: RCV006-REJECTED-CONTRACT-SCHEMA-DRIFT
- 이유: §2.1이 요구하는 canonical_project_root 필드를 §4 envelope schema에 추가해 schema 누락을 해소한다.

    canonical_project_root: <권위 프로젝트 루트 절대 경로 · byte-exact>

### RCV006-EDIT-RECEIVER-ROOT-PINNING — ADD

- 대상: `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md`
- 위치: 닫는다. 거절은 ACK·DELIVERED·재시도로 바꿀 수 없으며, 수정된 계약으로만 새 route를 준비한다.
- 연결 Finding: RCV006-CANONICAL-ROOT-ENVELOPE-TRUST
- 이유: 발신 제공 루트 신뢰로 인한 ACK 거짓 양성·fail-closed 우회 경로를 수신측 등록 루트 대조로 차단한다.

    
    `canonical_project_root`는 발신 envelope 값만으로 신뢰하지 않는다. 수신자는 shared runtime의
    `C:\Codex-AI-Operations\Codex-Team-Router\data\<project_id>\canonical-root.json`에 사람 Decision으로
    등록된 루트와 envelope 값을 byte-exact로 대조하고, 불일치·미등록·기록 손상이면 계약 검증 없이 같은
    delivery token으로 `ROUTE_REJECTED`만 반환한다. 등록 루트 변경은 ledger를 남기는 전진 정정으로만
    수행한다.

### RCV006-EDIT-TESTS-REJECTION — ADD

- 대상: `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md`
- 위치: - `SENT_UNCONFIRMED`를 `DELIVERED`로 위장하는 receipt 거부
- 연결 Finding: RCV006-REJECTED-CONTRACT-SCHEMA-DRIFT, RCV006-CANONICAL-ROOT-ENVELOPE-TRUST
- 이유: §13 필수 시험에 거절 계약과 루트 사칭 sabotage를 고정해 재봉인 후 시험 공백 재발을 방지한다.

    - canonical root 검증 실패의 terminal `REJECTED` 전이·inbound scope 폐쇄·ACK/재시도 재해석 차단
    - 등록 canonical root와 불일치하는 envelope `canonical_project_root` 거절(사본·사칭 루트 sabotage)

### RCV006-EDIT-V04-REF-FIX — REPLACE

- 대상: `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md`
- 위치: 1. 이 v0.4와 Fable delta 재검수 Finding을 정리한다.
- 연결 Finding: RCV006-REBIND-ROUND-CARRYOVER-MISS
- 이유: ISO005가 다음 재결속 라운드에 정정하기로 한 v0.4 자기참조를 바로 이 재결속 라운드에서 제거한다.

    1. 이 설계와 Fable delta 재검수 Finding을 정리한다.

### RCV006-EDIT-BINDING-TABLE-GENERATION-NOTE — COMMENT

- 대상: `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md`
- 위치: | 실행 설계 v0.5 | `221c666aba93d773c99df1553f5b3b0d09a19b9d7e6773cadd247301038b2ef4` |
- 연결 Finding: RCV006-BINDING-TABLE-GENERATION-AMBIGUITY
- 이유: 감사자가 어떤 해시가 현재 봉인이고 어떤 것이 재봉인 대기인지 구분할 수 있게 세대 표기를 요청한다.

    이 결속 표는 구 receipt에 봉인된 v0.5 계보와 재봉인 대기 신규 bytes가 섞여 있습니다. 재봉인 라운드에서 각 행에 '현재 봉인'/'재봉인 대기' 상태를 표기하고, 0.1.0+codex.20260904002351 판본의 script SHA 계보(918e31fb… 이후)를 서술에 추가해 주세요. 재봉인 시 실행 설계 행도 v0.6 bytes 해시로 갱신이 필요합니다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: RCV006-REJECTED-CONTRACT-SCHEMA-DRIFT, RCV006-CANONICAL-ROOT-ENVELOPE-TRUST, RCV006-REBIND-ROUND-CARRYOVER-MISS

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
