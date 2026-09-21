# AI 채팅 라우팅 실행 초안 — Opus 직접 교차자문 R2

> 상태: `ADVISORY · NOT_AN_OFFICIAL_FABLE_FALLBACK_OR_VERDICT`
>
> 대상: `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md`
>
> 입력: Fable 직접 자문 R1, router 초안, `docs/team/MODEL-ACCESS.md`

## 자문 판정

`CHANGES_REQUIRED`

Opus는 Fable R1의 F1~F7을 모두 유지했다. F6의 "수신자가 발송"은 권한 모순이 아니라 모호한
표현으로 낮췄지만, 플랫폼 메시지 API 존재·발신 주체를 실증하지 않은 점은 전체 구현을 막는 P0로
확인했다. 이 기록은 사용자 요청에 따른 직접 교차자문이며 Fable fallback, 독립 PASS 또는 사람
승인을 대체하지 않는다.

## Fable Finding 교차판정

| ID | 판정 | 최소 조치 |
| --- | --- | --- |
| F1 | CONFIRM | 발송 권한 예외 Decision 전에는 무발송 ledger 시뮬레이션만 허용 |
| F2 | CONFIRM | 스키마 확정 뒤 11개 `accepts_from`/`sends_to` 논리 chat ID delta 표 작성 |
| F3 | REFINE | 공통 lock만이 아니라 단일 writer 또는 compare-and-append(CAS)+샤드 동시성 모델 확정 |
| F4 | REFINE | 모든 entry의 chain, genesis 값, canonical JSON 및 payload 해시 범위 확정 |
| F5 | REFINE | 논리 target과 물리 endpoint 분리, rollover 중 재시도는 HANDOFF 검증 전 held |
| F6 | REFINE | 플러그인 착수 전 API spike, API 부재 시 사람 릴레이 fallback, 발신자를 출발 채팅으로 명시 |
| F7 | REFINE → Major | 04/05 사람 결정 포인터와 정의 없는 `DEPLOYMENT_DISPATCH`를 정식 타입 또는 삭제로 처리 |

## 추가 필수 Finding

1. **P0 — target enum 부족.** 03→Quality, 부서→03, 03→02, 02→01 회신을 현재 enum이 표현하지
   못한다. 회신을 새 route로 둘지 원 route reply entry로 둘지 먼저 정한다.
2. **P0 — `04` 식별자 충돌.** 마스터 04 개발·스테이징과 부서 04 Quality를 전역 유일 chat ID
   namespace로 분리하고 `DEPARTMENT-*` 같은 와일드카드 매칭을 금지한다.
3. **P0 — 원시 thread ID 영구화.** `source_turn_pointer`는 불투명 Task 상대 포인터 또는 해시로
   대체한다.
4. **P1 — route 상태와 receipt 상태의 전이표 부재.** 불가능 조합, 완료 주체, 재개 규칙을 하나의
   전이표로 고정한다.
5. **P1 — 전달 증명 부족.** `SENT_UNCONFIRMED`, 수신 증거가 있는 `DELIVERED`, 무발송 파일럿의
   `SIMULATED`를 구분한다.
6. **P1 — 승인·병렬성 표현 부족.** `decision_required`, `decision_pointer`, authority path 겹침
   계산 규칙과 lease 우선순위를 스키마에 넣는다.

## 안전한 수정 순서

1. 자동 발송 예외의 사람 Decision을 초안으로 만들고, 미승인 시 시뮬레이션 한정으로 선언한다.
2. 읽기 전용 플랫폼 spike로 메시지 API·발신 주체를 검증하고 API 부재 fallback을 확정한다.
3. 전역 chat ID namespace, target/reply 형태, 04 충돌, deployment 용어를 정리한다.
4. 상태 전이·승인 필드·병렬성 판정 규칙을 동결한다.
5. canonical 직렬화·해시 범위·rollover 재시도 규칙을 순서대로 확정한다.
6. ledger 동시성 모델과 비식별 포인터를 확정한다.
7. 그 뒤에만 11개 manifest delta와 sabotage test, 무발송 파일럿을 진행한다.

## 잔여 위험

Opus는 축소 패킷만 읽었으므로 11개 manifest·AGENTS·Mission Relay·Project Orchestrator의 실제
기존 조문은 재확인하지 않았다. 플랫폼 메시지 API가 없으면 router 구조 일부를 사람 릴레이 중심으로
재작성해야 한다. 재시도 상한·kill-switch 형식·in-flight 재시도·발송 권한 예외는 사람 결정 대기다.
