# TEAM-SERVICE P2b 구현 후보 002 — Claude Opus 5 축소 재검수

- 검수 방식: direct Opus Cowork 자문, formal CLI receipt 아님
- 후보: `TEAM-SERVICE-P2B-IMPLEMENTATION-CANDIDATE-002.json`
- 후보 SHA-256: `78502bce293929f44e6b08aadb1bc27aaff01237adebe42a65d54db413640e08`
- 대상 HEAD: `37767fd2d6911007d7dd227580e2bcb0c016a727`
- 대상 tree: `be41b4d3…`
- 최종 판정: `PASS`
- OPEN_BLOCKING: 없음 — 이전 `BL-1`, `BL-2` 모두 `CLOSED`

## 결속 실측

후보 SHA와 대상 HEAD/tree가 일치했다. `delta_inputs` 5개, 변경되지 않은 구현 입력 5개,
직전 검수 원본의 raw blob SHA가 모두 일치했다. `b035e44`부터 `37767fd`까지 구현 변경은
승인 범위 안의 `scripts/team-service-router-adapter.test.mjs` 한 파일뿐이며, 나머지는 증거와
완료 번들 추가다. 카탈로그의 AC-10, P2B 시나리오와 P2b gate가 여전히 `NOT_EXECUTED`여서
후보가 자기 gate를 승격하지 않은 것도 확인했다.

## 질문별 판정

1. **BL-1 CLOSED.** endpoint successor를 identity 바깥 사건으로 모델링한 뒤 원래 route와
   delivery token, provider call count 1을 관측한다. `endpoint_id`를 identity에 섞는 음성은
   `INVALID_INTENT_IDENTITY_FIELDS`로 거부된다.
2. **BL-2 CLOSED.** 커밋된 raw TAP 2개의 경로·SHA·exit code·명령이 증거 JSON과 번들에
   결속됐다. assertion 관측은 `AC-10-A0N → TAP_SUBTEST_N`으로 원본 subtest를 가리킨다.
3. AC-10 TAP는 7/7, 결합 TAP는 32/32를 직접 관측한다. 두 파일 모두 실패·skip·todo가 없다.
4. 새 blocking finding 없이 `AC-24 P2B` 완료 실행으로 진행할 수 있다. 실행 전에 완료 번들의
   import closure 정의만 확정해야 한다.

## OPEN_NONBLOCKING

- NB-1: `effectKeyOf` 파생식이 계획의 business-effect 4필드 공식과 다르다. P3/P4 소비 전에 정렬한다.
- NB-2: `metrics()`의 `actual_provider_calls`와 `dispatch_attempts`는 리터럴 0이다. AC-24 P2B
  harness가 무발송을 실제 관측해야 한다.
- NB-3: `AC-24 P2B`와 gate 소유자 기록은 아직 실행 전이다.
- NB-4: A06의 `endpointSuccessor` 객체 자체 deep-equal은 죽은 단언이다. 핵심 증거력에는 영향이
  없지만 제거하거나 실제 관측 경로에 연결한다.
- NB-5: 증거-002에 `evidence_commit`을 추가하면 실행 commit과 산출물 commit의 관계가 더 명확하다.
- NB-6: 번들의 entry closure는 정확하지만 `implementation_targets` 전체 closure 정의와 혼동하지
  않도록 AC-24 profile의 검사 범위를 확정한다.
- NB-7: 비멱등 provider 오류가 `BLIND_PREPARE_RETRY_REJECTED`를 재사용한다.

## 범위 제한

실제 전송, Team Router CLI get-or-prepare, durable filesystem store, host 인증, `service_ready`,
전체 `pnpm verify` 통과는 승인하지 않는다. 이 기록은 direct Opus Cowork 자문이며 formal CLI
receipt가 아니다. 다음 단계는 번들-002에 대한 `AC-24 P2B` 완료 실행과 gate 소유자 기록이다.
