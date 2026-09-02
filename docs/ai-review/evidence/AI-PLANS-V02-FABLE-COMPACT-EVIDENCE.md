# AI 기획안 v0.2 Fable 축소 증거

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: `CANDIDATE_EVIDENCE`
> 대상 계획 수정 commit: `0e8a1c320f01dafdd0af4dc13ca8fe012dfaa46e`
> 목적: 다섯 공식 기획안의 누적 Fable 검수에서 큰 실행 원본을 다시 싣지 않고 판별력과 재현 경로를 제공한다.

## 1. 공식 artifact 결속

다음 다섯 문서는 누적 Fable 검수 범위다. 이 증거는 공식 문서를 대체하지 않는다. 문서별 검수는 해당 공식
문서 하나를 `ARTIFACT` 원문으로 유지하고 나머지 문서는 이 표의 target commit/tree·content hash와 아래
교차계약 투영으로 결속한다. 문서별 회차는 최종 네트워크 closure가 아니며, 마지막 Fable Task가 문서별 유효
review/run/input hash와 전체 content hash·투영 완전성 시험을 함께 대조한다.

| 문서 | 상태·판본 | Git blob | bytes |
|---|---|---|---:|
| 팀 구성 및 운영 | `CONFIRMED` v1.3 | `ce68e2cc85b8973bcb968a8f968a153b65c3dfa0` | 113,926 |
| AI 지식 온톨로지 | `DRAFT` v0.2 | `57fb2c564baf64202f66a66efdc9d21759b5c34a` | 32,401 |
| AI 오케스트레이션 | `DRAFT` v0.2 | `dc2ace81b3823d284e125763d29ae2387d7675be` | 34,516 |
| 디렉터리·문서 신경망 | `DRAFT` v0.2 | `2c5b1602570c4f2ca8294006a5c4f55904b1a277` | 28,444 |
| 품질·학습·자율성 평가 | `DRAFT` v0.2 | `e2e6fab00a15784182a9afd10dca886a0f2d61ae` | 32,563 |

이번 축소 successor에서 원문 재전송을 생략할 수 있는 것은 팀 구성안 하나뿐이다.

- 선행 검수: `AI-KNOWLEDGE-ORBIT-TEAM-003/r001`
- 상태: `RESULT_RECEIVED · VERIFIED · PASS`
- run hash: `5d253e37d59f89668954d2bfa6a3f462b9a34f54e92299af7ee228948758b8fb`
- review hash: `4076d9738f4680ceadad4f6fe2e59b3691e799532a96c03e31f2fb6582c7afb7`
- 선행·현재 blob: `ce68e2cc85b8973bcb968a8f968a153b65c3dfa0`로 동일
- 네 DRAFT는 각각 자기 문서 검수에서 원문을 싣는다. 다른 문서의 원문 생략은 해당 문서 PASS를 뜻하지
  않으며 이 표·교차계약 투영·시뮬레이션 hash가 어긋나면 회차를 시작하지 않는다.

## 2. 이번 후보의 상호작용 축

1. 사용자 자연어 요청은 오케스트레이션이 정규화하고, 판정 enum·HANDOFF 관계는 온톨로지가 소유한다.
2. 팀 구성안의 마스터 5개·부서 6개 채팅은 라우팅 표면이고, 실제 편집은 한 Task·한 lease의 임시 채팅에서 한다.
3. Context & Token Steward는 rollover 신호만 내며 범위·비용·검수·승인 권한을 갖지 않는다.
4. rollover 뒤에는 Task checkpoint와 더 높은 HANDOFF 판본을 먼저 만들고, successor가 L0~L4와 snapshot을 복원한 뒤 lease를 인수한다.
5. 디렉터리안은 `docs/team/roles`, `teams`, `handoffs`, Role Context, Learning, Release의 물리 위치를 정하지만 DRAFT 동안 만들지 않는다.
6. 평가안은 맥락 손실·불필요 rollover·권위 복제·HANDOFF 불완전과 Fable 실패 비용을 서로 다른 지표로 잰다.
7. 모든 필수 검수 route는 Fable을 유지한다. 비용은 Codex 사전검수, 입력 manifest, compact evidence로 줄이며 실패를 PASS로 바꾸지 않는다.
8. 실제 구조를 검증한 뒤에만 `AI-TEAM-STARTER-KIT-1`로 추출하고, MarginCook의 Git·DB·Supabase·서버 설정은 project profile/adapter로 분리한다.

## 3. 실행형 검증

- 실행: `corepack pnpm ai:plans:simulate`
- 결과: `70/70 PASS`
- 코드 blob: `79f36400c91d3b7072149a72f379eeaa7b30a37e`
- 시험 blob: `fed2374798b4e4ee6d6638a18136921d909cf198`

추가된 행동 fixture는 다음을 실제 상태 전이로 확인한다.

- rollover 신호만으로 현재 edit owner가 바뀌지 않는다.
- source SHA가 다른 HANDOFF는 생성되지 않는다.
- 동일·낮은 HANDOFF 판본은 복원되지 않는다.
- HANDOFF 뒤 Task snapshot을 바꾸면 복원되지 않는다.
- 유효 HANDOFF를 복원하고 사람 인계 Decision을 소비한 뒤에만 successor가 lease를 얻는다.
- 같은 predecessor에서 분기한 HANDOFF 계보는 거부된다.
- 발행된 HANDOFF 원본을 고치면 append-only 감사 원본과 달라져 거부된다.
- 문서별 축소 검수를 최종 네트워크 closure로 세거나 승계 fallback으로 Fable 필수 검수를 대체하면 거부된다.

문서망 검사는 코드 블록·HTML 주석에 숨긴 가짜 계약, 중복 권위, 권위 DAG 순환, 끊긴 탐색 링크,
누락된 역할·Task·Decision·Finding·Learning 감사 원본, 사용자 변경 경로 겹침을 거부한다.

## 4. Fable이 반드시 반례를 찾을 질문

1. 팀·온톨로지·오케스트레이션 사이에서 요청 판정·HANDOFF·lease의 권위가 중복됐는가?
2. 마스터/부서 채팅과 임시 Task 채팅의 경계가 실제 다중 채팅에서 경쟁 공식 상태를 만들 수 있는가?
3. Context Steward가 신호 전용이라는 계약을 우회해 비용·범위·검수 결정을 할 수 있는가?
4. HANDOFF의 단조 판본·snapshot·source SHA·predecessor/successor 계약에 원자성 구멍이 있는가?
5. 디렉터리 materialization 전제와 네 DRAFT 문서의 원자적 ACTIVE 전이가 서로 모순되는가?
6. 모든 Fable 필수 검수를 유지하면서 축소 패킷이 필요한 반례 증거를 숨기는가?
7. 스타터 키트가 제품 고유 권위와 공통 운영 규약을 섞어 다른 프로젝트에서 잘못된 정책을 주입하는가?

## 5. 판정 제한

- 이 파일만 읽은 결과는 유효한 문서별 또는 네트워크 검수가 아니다. 문서별 회차는 해당 DRAFT 원문을,
  최종 네트워크 회차는 문서별 유효 review/run/input hash와 전체 content hash·투영 parity를 함께 읽어야 한다.
  어느 blob이든 달라지면 관련 문서 검수와 네트워크 결속을 다시 수행한다.
- 실행 원본이 필요하면 위 blob과 저장소 경로를 요청한다. hash만으로 행동을 PASS 처리하지 않는다.
- Fable CLI 실패, 구조화 결과 누락, budget exhaustion은 `RUN_FAILED`이며 검수 회차로 세지 않는다.
- 유효 Fable 결과 전에는 네 DRAFT 문서를 `ACTIVE`로 바꾸거나 실제 팀 디렉터리·채팅을 만들지 않는다.
