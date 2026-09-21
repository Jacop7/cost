# AI-CHAT-ROUTER-ISOLATION-005 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `6497666e655609a4f4bfe10bfaea6070dad01286`

## 요약

AI-CHAT-ROUTER-ISOLATION-005 초기 검수(FABLE-ARCH, 봉인 단일-pass) 판정 PASS. ISO004 필수 3건의 완료 조건이 sealed 입력으로 충족됨을 확인했다. (1) CHILD-ROUTE-MECHANICAL-ENFORCEMENT: 실행 설계 v0.5 §4가 child_routes_allowed=false 발송의 shared-runtime 수신 scope lock 선생성과, ACK receipt로 lock이 닫히기 전 수신 logical chat의 새 prepare-dispatch를 허용 edge라도 BLOCKED_POLICY event로 거부함을 규정하고(scope lock 경로·최소 필드 포함), 구현 증거에 신규 sabotage test `test_active_no_child_scope_blocks_unrelated_allowed_route_until_ack`와 35→36 테스트 개수 delta, Codex Router 36/36 PASS가 기록됐다. (2) DESIGN-ENVELOPE-CONTRACT-DRIFT: 설계가 v0.5로 전진 정정되어 §4 envelope schema에 scope_isolation(only_this_envelope·resume_prior_context·child_routes_allowed)과 expected_response=TEAM_ROUTER_ACK 의미가 추가됐고, 새 designSha256(221c666a…)이 현재 bytes sha256과 정확히 일치하며 policy.json:12·activation-decision.json:13·activation-receipt.json:7에 모두 재결속됐다(Codex validate-policy ACTIVE_DISPATCH valid). (3) UPDATED-PLUGIN-BYTES-EVIDENCE: 보강 전 script SHA 51845988…→보강 후 918e31fb…가 receipt implementationArtifacts와 일치하고, 재설치 판본 0.1.0+codex.20260903223631·설치 시각 2026-09-04T07:36:31+09:00(UTC 22:36:31, ISOLATION-004 검수 종료 22:34:44Z 이후)이 build stamp와 정합하며 Codex가 동일 판본 설치를 확인했다. (4) 이전 공식 검수 원본 물질화: ACTIVATION-003 r001 PASS review.md(b63f12da…)·run.json(b8f14027…)이 receipt reviewEvidence 해시와 byte-exact 일치하고, ISOLATION-004 r001 CHANGES_REQUIRED 원본·run.json도 물질화됐다. (5) 재파일럿 미실행이 정직하게 공개되어 required_evidence의 'no actual re-pilot before this review'와 일치한다. receipt의 decisionSha256(74be91fe…)·policySha256(21ecfdb3…)·구현 증거(e3fc837d…)도 현재 bytes와 모두 일치한다. 필수 Finding(Blocker~Minor)은 0건이다. 절차 주의: 본 작업은 predecessor_review가 null인 INITIAL이므로 ISO004 등록부의 공식 상태 전이는 ISOLATION-004 작업 절차에 속하며, 이 검수는 그 완료 조건 충족을 봉인 증거로 확인한 것이다. SOLAR 집중 질문에 대한 답: 예 — ISO004 필수 3건의 완료 조건은 모두 충족됐고, envelope 범위 내(child_routes_allowed=false·일반 REQUEST kind·비운영) ACK 재파일럿을 진행해도 된다. 신규 Improvement 4건만 남긴다: ① 재파일럿 실측 증거(ledger tail hash·추가 route 0건·ACK 외 발신 0건) 후속 첨부, ② receipt reviewEvidence의 직접 검수 R2(225ff42d…)·R5(14449cd2…) 문서가 이번에도 미물질화되어 교차검증 불가, ③ activation-decision.json이 approvedAt(07:02:35) 이후 v0.5 designSha256으로 재결속됐으나 파일 내 amendment 메타데이터가 없어 재결속 권위가 협업 장부 turn-h001에만 존재, ④ v0.5 설계 §12에 'v0.4' 자기참조 잔존(③과 다음 재결속 라운드에 일괄 전진 정정 권장, 단독 재봉인 불요). 이 PASS는 로컬 판정이며 외부 보호 게이트(gate_state)는 OPEN으로 남는다.

## Findings

### ISO005-ACK-REPILOT-EVIDENCE-PENDING — Improvement / OPEN

- 범주: TEST_GAP
- 영향: 기계적 강제(scope lock·BLOCKED_POLICY)는 sabotage test로 검증됐지만, 실제 재파일럿에서 추가 route 0건·ACK 외 동작 0건이라는 실측 증거는 아직 없다. 미실행 사실이 정직하게 공개됐고 이 검수 PASS 뒤 실행이 승인된 순서이므로 차단 사유는 아니다. 다만 plugin CLI를 우회한 out-of-band 플랫폼 메시지는 scope lock이 막을 수 없는 잔여 위험이므로 재파일럿 감사가 이를 함께 확인해야 한다.
- 근거: docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md:66, COLLABORATION_LOG:0
- 완료 조건: child_routes_allowed=false ACK 재파일럿 후 route ledger tail hash, 추가 route 0건, 동일 delivery token ACK 외 발신 0건(plugin 우회 out-of-band 메시지 포함) 증거를 후속 라운드 sealed 입력에 첨부한다.
- 필요한 테스트: child_routes_allowed=false ACK 재파일럿 실측 및 수신 채팅의 추가 route·out-of-band 발신 0건 감사

### ISO005-DIRECT-REVIEW-EVIDENCE-UNMATERIALIZED — Improvement / OPEN

- 범주: OPERATIONS
- 영향: ISO004 Improvement가 요구한 ACTIVATION-003 물질화는 충족됐으나, receipt가 결속한 advisory 직접 검수 2건은 여전히 독립 확인이 불가해 봉인 증거 사슬의 완결성이 부분적으로 낮다. 핵심 격리 delta 검증에는 영향이 없다.
- 근거: .codex/team-router/activation-receipt.json:40
- 완료 조건: 후속 라운드 sealed 입력에 R2·R5 evidence 문서를 물질화해 receipt reviewEvidence 해시 전체를 교차검증하거나, receipt에 해당 항목이 advisory 참고임을 명시한다.
- 필요한 테스트: 없음

### ISO005-DECISION-REBIND-AMENDMENT-TRACE — Improvement / OPEN

- 범주: DATA_INTEGRITY
- 영향: 결정 JSON 단독으로는 v0.5 재결속이 언제·어떤 사람 결정으로 이뤄졌는지 추적할 수 없고, 감사 사슬이 협업 장부 turn-h001에 의존한다. 승인 유지 자체는 장부로 확인되므로 차단 사유는 아니다. 결정 JSON은 reference 경로이므로 별도 작업의 전진 정정을 요청한다.
- 근거: .codex/team-router/activation-decision.json:6, COLLABORATION_LOG:0
- 완료 조건: 별도 작업에서 activation-decision.json에 amendedAt(또는 revision)과 turn-h001/DEC 포인터 등 amendment 메타데이터를 전진 추가하고, receipt의 decisionSha256을 새 bytes로 재결속한다(ISO005-DESIGN-STALE-V04-SELF-REFERENCE 정정과 같은 재결속 라운드에 일괄 수행 권장). / 재결속 전까지는 구현 증거 문서가 재결속 권위 포인터(turn-h001)를 기록한다.
- 필요한 테스트: 재결속 후 validate-policy 및 receipt 해시 재검증

### ISO005-DESIGN-STALE-V04-SELF-REFERENCE — Improvement / OPEN

- 범주: OTHER
- 영향: 해시 봉인된 설계 안에서 판본 자기참조가 어긋나 후속 감사 시 혼선을 줄 수 있다. 바이트 수정은 designSha256과 decision·policy·receipt 3중 결속을 모두 깨므로 단독 재봉인 비용이 실익보다 크다. 의미상 영향은 없다.
- 근거: docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md:1, docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md:420
- 완료 조건: 다음 designSha256 재결속 라운드(예: ISO005-DECISION-REBIND-AMENDMENT-TRACE 정정)에서 §12의 v0.4 자기참조를 함께 정정하고 decision·policy·receipt 결속을 같은 라운드에 갱신한다.
- 필요한 테스트: 없음

## 공동 편집 제안

### ISO005-EDIT-DESIGN-V04-REF-FIX — REPLACE

- 대상: `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md`
- 위치: 1. 이 v0.4와 Fable delta 재검수 Finding을 정리한다.
- 연결 Finding: ISO005-DESIGN-STALE-V04-SELF-REFERENCE
- 이유: v0.5 문서에 남은 v0.4 자기참조를 제거한다. 이 수정은 designSha256을 바꾸므로 단독 적용하지 말고 다음 재결속 라운드에서 activation-decision·policy·receipt의 designSha256 갱신과 같은 commit으로 일괄 적용해야 한다.

    1. 이 설계와 Fable delta 재검수 Finding을 정리한다.

### ISO005-EDIT-REPILOT-EVIDENCE-SPEC — COMMENT

- 대상: `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md`
- 위치: 다시 실행해 추가 route가 0건인지 확인한다.
- 연결 Finding: ISO005-ACK-REPILOT-EVIDENCE-PENDING
- 이유: 재파일럿 증거의 수용 기준을 산출물에 직접 고정해 후속 라운드에서 증거 공백 재발을 방지한다.

    재파일럿 실측 증거를 이 문서에 추가할 때 다음을 포함해 주세요: (1) 해당 route의 ledger tail hash(checkpoint export), (2) 수신 logical chat의 추가 route 0건(scope lock BLOCKED_POLICY event 유무 포함), (3) 동일 delivery token ACK 외 발신 0건 — plugin CLI를 우회한 out-of-band 플랫폼 메시지가 없었는지 수신 채팅 감사도 함께 기록, (4) dedupe record 경로의 first_ack_sha256. 이 증거가 후속 라운드 sealed 입력에 물질화되면 ISO005-ACK-REPILOT-EVIDENCE-PENDING을 해소할 수 있습니다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
