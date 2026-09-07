# TEAM-SERVICE P2b 구현 후보 001 — Claude Opus 5 독립 구현 검수

- 검수 방식: direct Opus Cowork 자문, formal CLI receipt 아님
- 후보: `TEAM-SERVICE-P2B-IMPLEMENTATION-CANDIDATE-001.json`
- 후보 SHA-256: `667288c5f67343859d3b9ae606c37b942e7c488c5f8ceb6dfcf9dbee8f608e38`
- 대상 HEAD: `b035e449792dd6ea908a6d5a85e693eeabd5e8cb`
- 대상 tree: `6b48d11abc77b2ffa0a8271246d6b3a94f71f012`
- 구현 commit: `0aedd450669004c5fec48da2475737d01639d3cc`
- 최종 판정: `CHANGES_REQUIRED`

## 결속 실측

후보 SHA, HEAD/tree, 구현 입력 6개, admission, 선작업 재검수, 완료 번들, 구현 증거의 raw blob SHA가 모두 일치했다. 구현 commit은 승인된 정확한 6개 파일만 변경했고 후속 commit은 증거 2개만 추가했다. 검수자는 저장소를 수정하거나 시험을 재실행하지 않았다.

## OPEN_BLOCKING

### BL-1 — AC-10-A06 endpoint successor가 실제 구현 관측이 아님

기존 시험은 동일 identity 재호출로 A01을 반복하고, fixture helper에 `endpoint_id`가 없다는 자기 사실만 단언했다. endpoint successor 사건을 identity 밖 값으로 모델링해 동일 identity가 원래 route/token을 유지하는 양성 시험과, `endpoint_id`를 identity에 섞으면 `INVALID_INTENT_IDENTITY_FIELDS`로 거부되는 음성 시험이 필요하다.

### BL-2 — 완료 증거가 raw 실행 출력 없이 요약 문자열만 보유

구현 증거는 `PASS_7_OF_7`과 수기 assertion 라벨만 기록했고 커밋된 TAP/stdout SHA가 없다. 동일 commit·동일 핀에서 두 명령의 raw TAP stdout/stderr/exit를 저장·커밋하고 증거 JSON에 SHA로 결속해야 한다. 가능하면 assertion별 관측은 runner가 직접 출력해야 한다.

## OPEN_NONBLOCKING

- NB-1: `effectKeyOf`가 계획의 business-effect 4필드 공식과 다르다. P3/P4가 소비하기 전에 정렬한다.
- NB-2: `metrics()`의 실제 provider/send 0은 리터럴이다. AC-24 P2B 무발송 harness가 실제 관측해야 한다.
- NB-3: AC-24 P2B 완료 실행과 gate 소유자 기록이 아직 없다.
- NB-4: 완료 번들의 import closure 범위를 AC-24 실행 전에 확정해야 한다.
- NB-5: 비멱등 provider 오류에 blind-retry 오류 코드를 재사용한다.
- NB-6: 기존 TAP 4개도 작업본에만 있고 커밋 트리에는 없다.

## 범위 제한

실제 전송, Team Router CLI get-or-prepare, durable filesystem store, host 인증, `service_ready`, 전체 `pnpm verify` 통과는 승인하지 않는다. BL-1·BL-2 해소 뒤 축소 재검수와 AC-24 P2B 완료 실행이 필요하다.
