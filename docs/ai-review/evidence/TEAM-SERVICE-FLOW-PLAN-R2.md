# 팀 서비스 구현계획 — Sol ultra 변경분 재검수 및 착수 게이트

날짜: 2026-09-05. reviewer: gpt-5.6-sol / ultra. 동일 검수 agent, SR1~SR6 변경분만 재확인.
추가 subagent·외부 Fable/Opus 호출·실제 메시지·제품/DB 변경 없음.
입력: docs/팀서비스-자동흐름-구현계획.md v0.2.
SHA-256: 84a510f94146bab9ab590edd7959240d0e2f8b19f074aa5c8c4060ffdb2e67ca.
입력 원본: TEAM-SERVICE-FLOW-PLAN-R2.input.json.

## 실제 반환 판정

**PLAN_READY_FOR_LOCAL_IMPLEMENTATION — 조건부**.

검수자는 SR1~SR6이 계획 수준에서 모두 충족됐다고 반환했다.

| ID | 반영 | 여전히 필요한 실행 증거 |
| --- | --- | --- |
| SR1 | CallerContext/HostReceipt 신뢰 출처와 미제공 시 차단 | 실제 host 입력·source fence 제공 가능성 |
| SR2 | P1a mock/API와 P8 이후 P1b 실제 probe 분리 | 정확한 승인 뒤 실제 wake/ACK |
| SR3 | get-or-prepare를 P2b 선행 단계로 이동 | intent UNIQUE/CAS·부분 실패 복구 시험 |
| SR4 | 안정 effect 식별자·STOP CAS·send fence·DAG 상한 | 동시성·STOP 중 전송·중복 배정 시험 |
| SR5 | immutable bundle/current_epoch CAS·이전 verifier | 혼합 판본 거부·전환 및 복구 시험 |
| SR6 | P2 기존 봉인 범위 검증 또는 후속 SEALED 필수 | 실제 사용 모델/노력·가중치·SHA 일치 |

판정 조건: 현재 시작 가능한 작업은 P1a 읽기/mock feasibility와 P2 모델 계획 검증이다.
P1a가 HOST_BINDING_UNAVAILABLE이거나 P2가 P2_BLOCKED면 P2b/P3 이후 구현을 진행하지 않는다.
실제 host 기능 존재·P2 통과·코드 구현·live dispatch·서비스 복구는 아직 미확인/미구현이다.
이는 계획 자문 판정이며 Fable/Opus 공식 게이트, 사람 승인 또는 활성화 영수증을 대신하지 않는다.

## 주담당 선행 확인

1. 기존 model-plan.json의 hash/계약 검증은 MODEL_PLAN_VERIFIED다.
   SHA: 60d7cb6a85cc43a76532f9047bcc5c4ed5113ebc3fd1708b0c954da91f85d96e.
   그러나 exact profile 조회 결과 gpt-5.6-sol / ultra는 없다.
   활성 stage 13은 terra-xhigh, sol-high, fable-high, opus-review를 지정한다.
   **hash 검증 통과와 이번 모델/역할 범위 포함은 다르므로 P2는 통과하지 않았다.**
2. 현재 앱 도구 목록에는 send_message_to_thread와 wait_threads가 있지만, 이번 확인 범위에서
   CallerContext/HostReceipt와 source fence를 제공하는 명시적 API 계약은 확인하지 못했다.
   문서 목록 검색만으로 플랫폼 전체가 불가능하다고 결론내리지 않는다. bridge와 신뢰 입력 경로를
   추가 검증할 필요가 있으며 P1a 완료/실제 wake 성공으로 표시하지 않는다.
3. 현재 Team Router source 검색에는 source_endpoint_id 인수와 runtime binding의 일치 검사가 있고,
   prepare는 실제 tool send 전에 intent를 적으며 record_delivery는 evidence ID를 받는다.
   이 기능만으로 host provenance bridge가 이미 존재한다고 볼 수 없다.

이 회차에서는 위 결과를 숨기기 위해 활성 model plan·정책·endpoint·설치 plugin을 바꾸지 않았다.
신규 source codec, Router CLI 기능, outbox, driver는 아직 구현하지 않았다.

## 다음 실행 범위

- P1a: host에서 얻을 수 있는 실제 caller/tool-result 문맥과 보호 runtime을 연결하는 최소 bridge 설계·mock.
  출처 검증을 할 수 없으면 필요한 host integration 범위를 확정하고 live dispatch를 계속 차단한다.
- P2: 실제 실행 프로필·Sol ultra 검수 역할·근거 있는 가중치의 후속 계획을 작성·검증·봉인하고,
  기존 activation SHA 소비자와 충돌하지 않는 전환 절차를 준비한다. 현재 봉인 파일을 조용히 덮어쓰지 않는다.
- 위 게이트 뒤 P2b intent 복원 → P3 상태/결함/blocker → P4 저장/driver → P5 협업/집계 순서로 구현한다.

계획 자체의 미수정 원본 hash를 보존하기 위해 후속 검수 결과는 이 증거에 기록했다.
기존 전체 검증의 4/6 통과·2단계 실패와 Opus timeout 원본도 그대로 보존한다.
