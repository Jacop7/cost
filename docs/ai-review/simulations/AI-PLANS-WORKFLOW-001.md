# AI-PLANS-WORKFLOW-001 — 다섯 기획안 업무 네트워크 시뮬레이션

> 상태: 검수용 비권위 증거
> 대상: 다섯 AI 운영 기획안
> 실행: `corepack pnpm ai:plans:simulate`
> 증거 경계: `VIRTUAL_SIMULATION` — 메모리의 PASS·protected gate는 프로토콜 변이용 fixture이며
> 실제 Git commit·GitHub required context·Fable artifact 실재를 증명하지 않는다.

이 문서는 정책을 새로 정의하지 않는다. 다섯 공식 기획안의 계약을 실제 업무 사건으로 연결해
테스트한 시나리오와 기대 결과를 고정한다. 공식 권위와 상태는 각 기획안이 소유한다.
실제 활성화에는 별도 exact commit의 저장소 검증기와 보호 원격 gate 증거가 필요하다.

## 1. 문서 네트워크

```text
팀 구성안 ─ 역할·권한·승인 ───────────────┐
   ↓                                      │
온톨로지 ─ 노드·관계·요청 판정 ──┐       │
   ↓                              │       │
오케스트레이션 ─ Task·잠금·실행 ─┼───────┤
   ↓                              │       │
디렉터리·문서 신경망 ─ 배치·탐색 ┤       │
   ↓                              │       │
품질·학습·자율성 ─ 평가·피드백 ──┴───────┘
```

검사는 두 그래프를 섞지 않는다.

- **탐색 참조망**: 어느 문서에서 출발해도 다섯 노드 전체에 도달하는 강연결 그래프다.
- **권위·`depends_on` 그래프**: 팀 → 온톨로지 → 오케스트레이션 → 디렉터리 → 평가 방향의
  비순환 DAG다. Learning 피드백은 권위 대체가 아니라 사람 Decision으로 제한된 다음 Task 입력이다.

팀 구성안은 현재 확정 기준선이고 나머지 네 문서는 사람 승인 전 `DRAFT`다. 시뮬레이션이 그 네
문서의 미래 활성화를 실행해 보더라도 실제 파일 상태나 디렉터리는 바꾸지 않는다.

## 2. 정상 업무 시나리오

| 순서 | 사건 | 주 계약 | 기대 결과 |
|---:|---|---|---|
| 1 | 채팅 A가 새 요청 접수·정규화 | 팀·온톨로지·오케스트레이션 | `REQUEST_INPUT → NORMALIZED_REQUEST → NEW_TASK`, 비식별 reference, 공식 Task Packet, 최초 owner |
| 2 | queue ledger → Task lock | 팀·오케스트레이션 | 최초 owner와 lease를 같은 잠금 순서로 지정 |
| 3 | 채팅 B가 상태 질문·조건 추가 | 온톨로지·팀 | Task별 chain 끝에 `STATUS_ONLY`·`ADD`만 append, 다른 필드 불변 |
| 4 | 채팅 B가 범위 대체 제안 | 온톨로지 | `SUPERSEDE_PROPOSAL`, 사람 Decision 전 원래 범위 유지 |
| 5 | 채팅 C 요청 분리 | 온톨로지·오케스트레이션 | 산출물·수명주기가 다른 `NEW_TASK`, Task별 seq는 다시 1 |
| 6 | 소유 채팅이 구현 증거 기록 | 오케스트레이션 | lock 안 최신 disposition prefix·lease·SHA 재확인 |
| 7 | Fable 실행 상한 소진 | 팀·오케스트레이션·평가 | 실패 run 불변 보존, verdict 없음, 유효 회차 미산입 |
| 8 | Codex 2회·Fable 독립 Task 2회 | 팀·오케스트레이션·평가 | 같은 Task SHA, 서로 다른 scope·세션·review Task·증거 hash, 공식 `FABLE-FINAL` 역할과 누적 예산 준수, 필수 Finding 0건 |
| 9 | 사람 최종 승인 | 팀·온톨로지 | 승인자·일자·대상 SHA가 있는 Decision |
| 10 | 네 상태+AGENTS 활성화 commit | 오케스트레이션·디렉터리 | 부분 ACTIVE와 책임 목록 누락 거부 |
| 11 | 디렉터리 배치 | 디렉터리 | checker-first·path map·사용자 제외·옛 참조 0·같은 SHA 보호 gate |
| 12 | Learning 후보·검증·적용 | 평가·팀 | `CANDIDATE → VERIFIED`, 지정 독립 검증자·Decision·route 제한; `ACTIVE` 상태 없음 |

시뮬레이터 내부 `Task.currentState=DONE`은 같은 Task 계약·SHA의 Codex 2회·Fable 2회
검수 패킷이 로컬에서 완결됐다는 단말 상태이며, 공식 `workflow_state=VERIFIED`에 대응한다.
이 값만으로 공식 Task·Finding·gate가 `CLOSED`되지 않는다. 보호 원격 게이트와 closure
successor는 후속 사건으로 별도 검증한다.

## 3. 적대 시나리오

- Task lock을 queue ledger lock보다 먼저 잡기
- Task lock을 보유한 채 queue ledger lock을 중첩 획득하기
- 전역 seq/hash로 다른 Task chain을 이어 붙이기
- 비소유 채팅이 disposition 외 기존 범위를 덮어쓰기
- 만료 lease를 이유로 자동 owner 인수하기
- `request_dispositions[]` 중간 항목 삭제 또는 hash chain 손상
- Fable timeout·상한 소진을 `PASS`로 합성하기
- 유효 Fable 1회 또는 Codex 1회만으로 ACTIVE 승인하기
- 사람 결정 전에 디렉터리 이동을 실행하기
- checker·path map·사용자 파일 제외·옛 참조·보호 gate 중 하나를 건너뛰기
- 독립 검증·Decision 없이 Learning을 `VERIFIED`로 만들거나 `CANDIDATE`를 주입하기
- A3 사고를 한 단계가 아닌 A0으로 임의 강등하기
- 문서 간 필수 링크나 단일 소유 위임 문구 제거하기
- 같은 작업자 이름으로 겹치는 artifact lease를 새 Task에 만들기
- Task와 다른 SHA 또는 Opus 결과를 Fable PASS로 기록하기
- 같은 review Task·세션·증거 hash를 이름만 바꿔 두 번째 감사로 재사용하기
- 실패 비용을 빼고 Fable Task 상한을 넘기기
- 다른 Task의 Finding을 현재 Task 승인에 섞거나 run/evidence 원본을 사후 변조하기
- caller route를 속여 `FINAL_INDEPENDENT`·최초 `SECURITY` Task에 Learning을 주입하기
- 하나의 자율성 승격 Decision을 두 단계에 재사용하기

각 변이는 테스트가 실패해야 한다. 변이가 통과하면 시뮬레이션 증거는 무효다.

## 4. 현재 단계의 한계

- 기존 `docs/team/ROLE_CONTEXTS.md`·`TEAM_LEARNING.md`는 보존한다. 새 `docs/team/roles/*`와
  `docs/plans/*` 목표 디렉터리, 기존 장부의 새 schema 이관은 아직 실행하지 않는다.
- 이 테스트는 DB·앱 제품 동작을 바꾸지 않는다.
- graph checker의 `pnpm verify` 연결은 사람 최종 승인 뒤 별도 단계다.
- 시뮬레이션 PASS는 기획안의 사람 `ACTIVE` 승인을 대신하지 않는다.

## 5. 기준 실행과 실제 Task

첫 기준 실행은 19개 중 16개가 통과하고 다음 세 계약에서 실패했다.

1. 온톨로지·오케스트레이션 Task 예제의 `risk_basis`와 Task별 disposition chain 필드 누락
2. 디렉터리 중앙 권위 표의 디렉터리·평가 소유 행 누락
3. 누적 집합 수를 디렉터리 기획안에 `다섯 문서`로 복제한 자기 위반

공식 문서를 보완한 뒤 실제 작업큐의 `AI-ORCH-PLANS-SIM-1` Task와 함께 당시 20/20을 통과했다.
Sol 재시작 검수에서는 그 성공을 최종 근거로 재사용하지 않고 공식 Task Packet·Task SHA·Finding
registry·Fable provenance/예산·append-only 감사·디렉터리 preflight·Learning route·자율성 승격을
다시 모델링했다. 현재 통과 개수는 이 문서에 손으로 복제하지 않고
`corepack pnpm ai:plans:simulate`의 실행 출력과 exact-SHA 증거 문서가 소유한다.

이 새 Task는 미구현 placeholder가 남은 이전 Task를 소급 수정하지 않고 역사적 요구·실패 증거로만
참조한다. 차단된 이전 Task를 실행 의존성으로 두지 않는다. 현재 네 기획안은 여전히 `DRAFT`이며,
Codex/Sol 2회와 같은 exact commit의 공식 `FABLE-FINAL` 독립 Task 2회(`WORKFLOW_FIDELITY`,
`NETWORK_CLOSURE`), 사람 승인이 끝나기 전에는 실제 디렉터리 생성이나 권위 이전을 하지 않는다.
