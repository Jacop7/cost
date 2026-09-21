# AI 채팅 라우팅 실행 초안 v0.4 — Fable 직접 델타 재자문 R5

> 상태: `ADVISORY · READY_FOR_HUMAN_DECISION · NOT_AN_OFFICIAL_FABLE_VERDICT`
>
> 대상 SHA-256: `2e4a22ba69844dfdba1a2e23fb5797ede96e43a6bb3346e7f74bd765eda684a4`
>
> 봉인 model-plan SHA-256:
> `60d7cb6a85cc43a76532f9047bcc5c4ed5113ebc3fd1708b0c954da91f85d96e`
>
> 범위: R4가 판정한 v0.3 이후 N4 successor-binding delta와 회귀 여부. 새 Claude Fable 5
> plan-mode 세션이 초안 v0.4, R4, Mission Relay POLICY만 읽었다. shell 금지로 해시는 Fable이 독립
> 재계산하지 않았으며, 이 기록은 공식 `pnpm fable:review` 원본·PASS를 대체하지 않는다.

## 판정

`READY_FOR_HUMAN_DECISION`

## N4 successor 연결

`VERIFIED`

- 채팅별 `session_id`가 1.7을 독립 계산하고 다른 10개 endpoint·감시 상태를 바꾸지 않는다.
- 한 handoff hash에는 successor 하나만 연결하고 둘이면 `BLOCKED_POLICY`다.
- 생성과 활성화를 분리한다. `HANDOFF_SEALED → PENDING_SUCCESSOR → RESTORE_VERIFIED →
  STUDY_GATE_PASSED → ACTIVE_SUCCESSOR → PREDECESSOR_SUPERSEDED` 순서를 건너뛸 수 없다.
- 활성화 전 successor는 인계 채택·복원·Study Gate만 수행하며 Task mutation과 route 실행을 금지한다.
- source와 target 모두 send/receive 직전 active endpoint와 generation을 검사한다.
- in-flight route는 endpoint ref와 generation만 바꾸며 route ID, logical target, payload hash,
  delivery token과 attempt 계보를 유지한다.
- dedupe store가 logical chat ID 기준이므로 세대가 바뀌어도 중복 실행을 막는다.
- superseded predecessor는 새 Task를 실행하지 않고 `ENDPOINT_MOVED` receipt를 반환한다.
- abort, 잘못된 successor, 이중 successor, mapping crash를 fail-closed로 처리한다.
- Router는 Mission Relay의 1.7 계산·successor 생성 규칙을 복제하지 않고 봉인 영수증만 소비한다.

## 새 필수 Finding

없음. v0.3의 N1·N2·N3 반영부 회귀도 발견되지 않았다.

## 구현 게이트

현재 가능한 범위는 v0.4 기반 사람 Decision 후보, 읽기 전용 capability spike, 무발송
`SIMULATION_ONLY`, 공식 Fable runner 버전 게이트 해소 준비와 successor adapter 설계 문서화다.

계속 금지되는 범위:

- 실제 `ACTIVE_DISPATCH`·`HUMAN_RELAY` 실행과 `dispatchEnabled=true`
- Decision 전 11개 manifest 선행 수정과 plugin schema·ledger 구현
- generation·이중 successor·조기 활성화 sabotage test 전 adapter 실전 활성화
- 운영·배포 edge 개방
- 이 직접 자문을 공식 Fable PASS로 표현하는 행위

## 선택 개선

1. endpoint lock 명칭을 logical-chat lock으로 통일한다.
2. `MOVED` 표현을 `ENDPOINT_MOVED` event로 통일한다.
3. Mission Relay CLI verb와 Router 상태의 매핑 표를 구현 명세에 둔다.
4. `reset-successor`는 Study Gate 전에만 허용하고 이후 오연결은 새 handoff로 처리한다.
5. R4의 선택 개선 5건을 구현 명세로 이월한다.

