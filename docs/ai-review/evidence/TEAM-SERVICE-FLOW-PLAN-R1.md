# 팀 서비스 구현계획 — Sol ultra 1차 교차검수

날짜: 2026-09-05. reviewer 설정: gpt-5.6-sol / ultra. 기존 Sol 교차검수 agent에 단일 계획 후속 요청.
추가 subagent·외부 유료 모델 호출·파일 편집·실제 채팅 전송 없음.
입력: docs/팀서비스-자동흐름-구현계획.md v0.1.
SHA-256: fc73bb5e351c10891864b36a2aef52e722aa5653369a61af6d3ac7a525d5d697.
불변 입력: TEAM-SERVICE-FLOW-PLAN-R1.input.json.
반환 판정: **CHANGES_REQUIRED**. 실제 구현·서비스 연결·Fable/Opus 공식 게이트는 미완료.

## 반환 Finding

- SR1 / 높음: 실제 host provenance와 source 사칭 방지가 선언뿐이다. v0.1 104–112, 128–129행.
  모델이 채운 source/verified 값과 구별되는 CallerAttestation/HostReceipt 입력 경로·schema를 확정하고,
  host에서 필요한 근거를 얻을 수 없으면 실제 dispatch를 차단해야 한다.
- SR2 / 높음: P1의 실제 깨우기 완료조건과 권한 전 mock만 허용이 충돌한다. v0.1 151, 161행.
  P1a API/schema·mock과 승인 후 P1b 실제 ACK-only probe를 분리해야 한다.
- SR3 / 높음: intent_key 기반 crash-safe prepare 선행조건이 outbox 뒤 P6에 있다. v0.1 137–138, 156행.
  비활성 get-or-prepare 계약·구현·경합시험을 P3 이전에 두고 P6은 host 연결로 한정해야 한다.
- SR4 / 높음: STOP·중복 배정·협업 순환의 linearization key가 없다. v0.1 95–100, 140–143행.
  assignment/subtask/effect 안정 ID, send fence/lease, STOP CAS 시점, DAG cycle과 깊이/fan-out 상한 필요.
- SR5 / 높음: 다중 파일 교체에 단일 원자적 활성화 경계가 없다. v0.1 198–207행.
  불변 bundle hash와 current_epoch CAS, 이전 in-flight receipt의 캡처 epoch 검증 규칙이 필요하다.
- SR6 / 중요: P2 후보 모델 계획으로 P3 구현에 들어갈 수 있는지 불명확하다. v0.1 152–153, 191–194행.
  기존 봉인 계획의 범위 포함 검증 또는 후속 SEALED/SHA·실제 모델/추론·가중치 검증을 exit로 정하고
  실패 시 P3 구현을 막아야 한다.

검수자는 사람→CEO→서비스 총괄→팀, 상황실 비필수 집계, 협업·blocker·outbox·권한 교집합과
활성 계약 보존 방향은 타당하나 위 계약이 구현 전에 필요하다고 판단했다.
이 기록은 반환 의견의 구조화 보존이며 공식 Fable/Opus review.json/게이트를 합성한 것이 아니다.
