# Team Router 비운영 활성화 구현 증거 001

> 상태: `REBINDING_REQUIRED · 기존 활성 영수증은 새 구현 hash와 불일치하여 fail-closed`
>
> Decision: `DEC-TEAM-ROUTER-ACTIVATE-NON-PROD-001`
>
> 승인 원문: `실제 자동 라우팅 활성화를 승인합니다`

## 활성 범위

- 정확한 11개 logical chat과 manifest v2 allowlist 메시지 전달만 허용한다.
- 활성 source endpoint가 `prepare-dispatch`를 실행하고 Codex 앱 메시지 도구가 정확한 target에 전달한다.
- envelope는 `scope_isolation.only_this_envelope=true`, `resume_prior_context=false`를 고정한다.
  `child_routes_allowed=false`이면 수신 작업은 이전 대화의 미완료 요청·승인·백로그를 재개하거나 다른
  작업으로 전달하지 않고, 요청된 ACK만 반환한다.
- 앱 도구가 호출을 수락한 시점은 `SENT_UNCONFIRMED`이며, 반환 receipt 또는 target ACK 뒤에만
  `DELIVERED`를 append한다.
- 제품·DB·Supabase·git·staging·production·비밀·배포 mutation은 이 Decision으로 허용하지 않는다.
- `humanRelayEnabled=false`를 유지하고 자동 새 작업 생성·백그라운드 서비스는 포함하지 않는다.
- `STAGING_GATE_REQUEST`·`STAGING_GATE_RESULT`·`PRODUCTION_GATE_REQUEST`는 manifest에 논리 edge가 있어도
  이번 비운영 활성화에서는 `BLOCKED_POLICY`다. 별도 사람 게이트 Decision과 exact SHA·보호 CI·스테이징
  증거·복구 계획 없이는 열리지 않으며, 첫 실제 파일럿은 일반 `REQUEST`만 사용한다.

## 결속 구현

| 산출물 | SHA-256 |
|---|---|
| Team Router `scripts/team_router.py` | `e17c995b2d51fb3e84a5eddefdc54f32ae176a0eceaa3b8f12e781e3f0aabec9` |
| Team Router `tests/test_team_router.py` | `de2eff5dd55fb7d5b82f36214d5c1486afa14fdf2ea949a099c966fcda006947` |
| Team Router `skills/team-router/SKILL.md` | `3a095c5e4c6151f29f7f28140898f58ed3bb181efc9b973c153ded97e8534e7c` |
| Team Router `.codex-plugin/plugin.json` | `9e5fb66a08da61a9db74fc49b458fae72d326978fd11bac167fcee3f84f80814` |
| Team Router `POLICY.md` | `addaffcabde5c573f9c9457846db0b5728451cf2aa37d95d8c6ebd84953e88ec` |
| 실행 설계 v0.6 | `ee834824b81bea8da79cb38af841c9278bb1a9cb696662bda392358a52417a42` |
| 봉인 model plan | `60d7cb6a85cc43a76532f9047bcc5c4ed5113ebc3fd1708b0c954da91f85d96e` |
| 활성화 Decision JSON | `d9212f9a4b06465ea08b55f3031d8b6332cfd26caf10c7a5fdba7686506b32db` |
| 활성 policy JSON | `a37575fbd75c78466c29b22564605c6fb3697187f3890c5af78f7089d3d12a78` |

격리 보강 전 script SHA는 `518459885eb35044a82a88862d88496aeb008c5d9070a55f8d99dc12771dfa5d`,
보강 후 SHA는 `918e31fb3042bb5a9db93c78df43c41357775d55e66eae528f08d3805e24395a`다.
보강 후 설치 판본은 `0.1.0+codex.20260903223631`이며 설치 시각은 `2026-09-04T07:36:31+09:00`이다.
원시 provider endpoint ID와 HMAC key는 Git 바깥
`C:\Codex-AI-Operations\Codex-Team-Router\data\MARGINCOOK-PROJECT-001` 아래 사용자 전용 ACL
runtime에만 둔다.

## canonical root·수신 거절 보강

- outbound envelope에 `canonical_project_root`를 byte-exact로 넣고, 수신자는 이 경로에서만
  `authority_paths`와 `.codex` 계약을 읽는다. disposable worktree를 계약 루트로 쓰지 않는다.
- `ROUTE_REJECTED`는 `SENT_UNCONFIRMED → REJECTED`의 terminal event다. `record-rejection`은 같은
  delivery token·rejection pointer를 요구하고 inbound scope를 `REJECTED`로 닫는다. ACK와 재시도로
  위장할 수 없다.
- canonical root는 runtime의 `canonical-root.json`에 현재 active Decision ID와 함께 별도 등록하며, 수신
  envelope에는 `project_id`와 root를 함께 넣는다. 수신자는 이 두 값을 `validate-receiver-root`로 등록
  root·현재 policy·activation receipt와 대조한다. 경로 불가·미등록·불일치·기록 손상·policy/hash 실패는
  모두 `ROUTE_REJECTED`의 root 사유로 fail-closed한다.
- Decision amendment는 `amendedAt`과 `amendmentPointer`의 완전한 쌍만 허용하며, partial metadata는
  activation decision schema에서 거부한다.
- 설치 판본은 `0.1.0+codex.20260904020429`이다. 이 판본은 기존 activation receipt와 hash가 달라
  재검수·재봉인 전 실제 dispatch를 허용하지 않는다.

## 로컬 시험

- Team Router unit/sabotage: `38/38 PASS`
- exact 승인문·decision hash·policy hash·design hash·model-plan hash 변조 시 active policy 거부
- 잘못된 source endpoint generation 거부
- 초기 endpoint CAS와 같은 binding의 멱등성
- 실제 provider ID가 route JSONL에 노출되지 않음
- `SENT_UNCONFIRMED → DELIVERED`는 동일 delivery token과 receipt pointer를 요구
- staging/production gate message kind는 별도 gate Decision이 없으면 `BLOCKED_POLICY`
- 수신 prompt에 현재 envelope만 처리하고 이전 문맥을 재개하지 않는 격리 문구와 child-route 기본 차단 포함
- `test_active_no_child_scope_blocks_unrelated_allowed_route_until_ack`: ACK 전 허용 edge의 unrelated child
  `prepare-dispatch`를 `BLOCKED_POLICY` event로 거부하고 ACK 뒤에만 새 route를 허용
- `test_receiver_rejection_is_terminal_and_closes_inbound_scope`: canonical root 불가 수신 거절을
  terminal chain event와 scope closure로 기록

## 검수 상태

- Opus 독립 재검수 006은 `CHANGES_REQUIRED`이며 원본은
  `docs/ai-review/evidence/AI-CHAT-ROUTER-OPUS-RECHECK-006.md`에 보존한다. 수신 project ID·root record
  schema·active Decision 결속·in-flight terminal audit append를 반영했다. 그 수정본의 Opus 006-R2는
  `PASS`이고 원본은 `docs/ai-review/evidence/AI-CHAT-ROUTER-OPUS-RECHECK-006-R2.md`에 보존한다.
- 두 번의 02 빈 응답을 ACK로 오인하지 않고 `record-failure`로 닫는 보강은 Opus 006-R3에서 `PASS`했고,
  원본은 `docs/ai-review/evidence/AI-CHAT-ROUTER-OPUS-RECHECK-006-R3.md`에 보존한다.

- 이전 구현 직접 Fable R2: 필수 Finding 0, 단 공식 runner 결과는 아님
- 설계 직접 Fable R5: 새 필수 Finding 0, `READY_FOR_HUMAN_DECISION`, 단 공식 runner 결과는 아님
- 정식 Fable `AI-CHAT-ROUTER-ACTIVATION-003` r001은 `PASS`, 필수 Finding 0건이다. 선택 개선
  `ACT003-GATE-EDGE-KIND-SCOPE`의 제안대로 gate kind 차단을 추가했고 첫 실제 파일럿은 일반
  `REQUEST`만 사용한다.

## 첫 파일럿에서 발견한 격리 보강

최초 `01 → 02 → 01` 왕복은 두 route 모두 전달·ACK·hash-chain 검증에 성공했다. 다만 01 수신 작업이
ACK 처리 뒤 과거 대화의 별도 DB Decision을 새 `DECISION_POINTER`로 한 번 더 보냈다. 02는 ACK만 했고
제품·DB·Supabase·git·배포 mutation은 발생하지 않았지만 현재 envelope만 처리한다는 범위에는 어긋났다.
따라서 이 동작을 완료 기준으로 숨기지 않고 `scope_isolation`, 수신 prompt의 과거 문맥 재개 금지,
shared-runtime 수신 scope lock을 추가했다. 발송 준비 시 target scope를 먼저 `ACTIVE`로 만들고 ACK
receipt 뒤 `ACKED`로 닫는다. 그 사이 수신 logical chat의 새 `prepare-dispatch`는 허용 edge라도
`BLOCKED_POLICY` event를 남기고 거부한다. 보강 뒤에는 `child_routes_allowed=false`인 ACK 파일럿을
다시 실행해 추가 route가 0건인지 확인한다.

## 수신 무응답 처리

복구 파일럿 `ROUTE-2c446d12-ff34-4620-a811-c59ca2a4ce17`은 provider turn이 빈 응답으로 끝나 ACK·거절
어느 것도 반환하지 않았다. 이를 전달 완료로 기록하지 않고 `FAILED_TRANSIENT`와
`RECEIPT:TARGET-EMPTY-RESPONSE-001`로 audit chain을 닫았다. `record-failure`는 새 route를 열지 않고
기존 `SENT_UNCONFIRMED` route만 실패로 닫으며 inbound scope를 `FAILED`로 해제한다. 다음 재시도는
수정된 `project_id` 포함 envelope로 별도 route를 준비해야 한다.
