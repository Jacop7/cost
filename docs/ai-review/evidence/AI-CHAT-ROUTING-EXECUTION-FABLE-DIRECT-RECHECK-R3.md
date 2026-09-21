# AI 채팅 라우팅 실행 초안 — Fable 직접 재자문 R3

> 상태: `ADVISORY · CHANGES_REQUIRED · NOT_AN_OFFICIAL_FABLE_VERDICT`
>
> 대상: `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md` v0.2
>
> 실행 경계: 별도 Claude Fable 5 읽기 전용 세션이 초안, Fable R1, Opus R2,
> `docs/team/MODEL-ACCESS.md`만 읽었다. shell·write·network·MCP는 허용하지 않았다.
> `pnpm fable:review` 공식 원본·PASS를 대체하지 않는다.

## 자문 판정

`CHANGES_REQUIRED`

## 이전 Finding 재판정

- `VERIFIED`: F1, F3, F4, F5, F6, F7, A2, A3, A4, A5, A6
- `PARTIAL`: F2, A1 — 아래 N1의 반환 edge 누락 때문에 완결되지 않았다.

## 새 필수 Finding

1. **N1 Major — `MASTER-02-ORCHESTRATION → MASTER-01-HUMAN-DECISIONS` edge 누락.**
   01은 02에서 받는다고 선언했지만 02의 `sends_to`에는 01이 없어서 §9의 결과 반환과 §14의
   `03→02→01` 완료 조건을 실행할 수 없다.
2. **N2 Major — `HUMAN_RELAY` 원장 의미와 모드 전환 권한 미정의.** 누가 전달 의도를 append하고,
   사람 복사와 target 수락을 어떤 event로 기록하며, 동일 delivery token ACK가 있어야
   `DELIVERED`인지 명시해야 한다. 기본 `SIMULATION_ONLY`에서 자동 확장돼서도 안 된다.
3. **N3 Major — 공유 runtime 가정과 수신 dedupe 영구 저장소 미정의.** source와 target이 같은
   host/filesystem/plugin CLI를 공유하는지 preflight하고 수신 dedupe record의 경로를 고정해야 한다.
   공유 조건이 없으면 `HUMAN_RELAY`로 낮춰야 한다.

## 선택 개선

- endpoint 평문 SHA 대신 project salt/HMAC을 사용한다.
- 운영 게이트 결과가 `DECISION_POINTER`인지 별도 type인지 확정한다.
- helper 상태 진입과 retry 소진 전이를 완전히 열거한다.
- `SIMULATED` route는 나중에 전송하지 않고 새 route를 만들게 한다.
- manifest edge마다 허용 message kind를 결속한다.
- 유효한 타 소유자 edit lease 경합은 정책 위반과 일시 경합을 구분한다.

## 구현 게이트

N1~N3을 다음 판본에서 먼저 해소하기 전 plugin schema·ledger 구현을 시작하지 않는다. 사람 Decision과
exact policy commit 전에는 `SIMULATION_ONLY`만 허용하며, `HUMAN_RELAY`도 의미와 사람 확인 절차가
고정된 뒤에만 사용한다. 공식 runner 차단이 해소되고 사람 승인되기 전 실제 dispatch는 금지한다.

