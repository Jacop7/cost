# AI 채팅 라우팅 실행 초안 — Fable 직접 재자문 R4

> 상태: `ADVISORY · READY_FOR_HUMAN_DECISION · NOT_AN_OFFICIAL_FABLE_VERDICT`
>
> 대상: `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md` v0.3
>
> Codex 호출 직전 대상 SHA-256:
> `146ff6b86e1df61641900d94bc38f5e2258df753d61ed12eaf2c451c167ab584`
>
> 봉인 model-plan SHA-256:
> `60d7cb6a85cc43a76532f9047bcc5c4ed5113ebc3fd1708b0c954da91f85d96e`
>
> 실행 경계: 새 Claude Fable 5 세션, plan mode, Read만 허용했다. Fable은 shell 금지 때문에 해시를
> 독립 재계산하지 않고 파일 내용만 검수했다. 이 기록은 직접 자문이며 공식 `pnpm fable:review`
> 원본·PASS를 대체하지 않는다.

## 자문 판정

`READY_FOR_HUMAN_DECISION`

## N1·N2·N3 재판정

1. **N1 VERIFIED.** 02의 `sends_to`에 01이 추가됐고 `MASTER-02 → MASTER-01` edge가
   `AGGREGATE_RESULT`·`VERIFIED_STATUS`·`DECISION_POINTER`에 결속됐다. 별도 return route와 같은
   `correlation_id`로 `03→02→01`을 실행할 수 있다.
2. **N2 VERIFIED.** route 생성 시 모드 고정, 자동 승격 금지, route별 사람 확인,
   `HUMAN_RELAY_INTENT`·`HUMAN_RELAY_ACCEPTED`, 동일 delivery token의 target ACK와 source import 뒤
   `DELIVERED`가 되는 계약이 명시됐다. `humanRelayEnabled`는 사람 확인을 대체하지 않는다.
3. **N3 VERIFIED.** runtime HMAC·same-host·lock·dedupe probe, 고정 dedupe 경로,
   prepared-write+atomic rename, probe 실패 시 active dispatch 금지와 사람 확인부 relay 후보 전환이
   명시됐다.

## 새 필수 Finding

없음. Fable은 edge/kind 표, 상태 전이, MODEL-ACCESS 권한 경계에서 새 P0/Major 차단 요인을 찾지 않았다.

## 구현 게이트

지금 가능한 범위는 v0.3 기반 사람 Decision 후보 제출, 읽기 전용 capability spike, 무발송
`SIMULATION_ONLY`, 공식 Fable runner 버전 게이트 해소 준비다.

다음은 계속 금지된다.

- 실제 `ACTIVE_DISPATCH`와 `HUMAN_RELAY` 실행
- 사람 Decision 전 11개 manifest 선행 수정
- 사람 Decision 전 plugin schema·ledger 구현
- `dispatchEnabled=true` 반영
- 운영·배포 edge 개방
- 이 직접 자문을 공식 Fable PASS로 표현하는 행위

## 선택 개선

1. dedupe 충돌 판정에 payload hash 외 `route_id`·`logical_source_chat_id`도 포함한다.
2. `SENT_UNCONFIRMED` timeout 규칙을 수치 또는 계산 규칙으로 고정한다.
3. `HUMAN_RELAY_INTENT` attempt 계수 규칙을 명시한다.
4. relay packet의 시계 오차와 만료 처리 상태를 명시한다.
5. 스테이징 결과와 운영 결과의 message kind 비대칭 근거를 기록한다.

