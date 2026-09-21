# TEAM-SERVICE P2 구현 Fable 사후검수 005

## 결속

- 요청 패킷: `docs/ai-review/evidence/TEAM-SERVICE-P2-IMPLEMENTATION-FABLE-REVIEW-CANDIDATE-005.json`
- 요청 패킷 SHA-256: `c1b9e460316c617b7124522f558cf5cca06b8438a65c7c1a0d935c5abf59ed67`
- 대상 HEAD: `fe96c3c196d4c3211024c1ecbe18e9d358a230b8`
- 채널: 기존 `AI 팀 지식망 스터디·인계` Fable Cowork 채팅
- 성격: 직접 Fable Cowork 검수. formal CLI receipt나 provider attestation이 아니다.

## 판정

- `p2_post_implementation_verdict`: **CHANGES_REQUIRED**
- `p2_local_completion`: **NO — 차단 2건 보완 후 YES 가능**
- `next_authorized_phase`: **NONE_UNLESS_SEPARATELY_ADMITTED**

Fable은 요청 파일 SHA, 12/12 pin, HEAD, canonical model plan 불변, Team Router 불변, CURRENT pin을 대조했다고 보고했다. 후보005·입장 재검수002·실패 처분002·entry run을 결속한 P2 한정 결정과 후보004 철회 기록도 확인했다.

## requested decisions

1. `P2_SCOPE_MATCHES_ADMISSION`: **PASS** — 상태 계약과 신규 AC-18 시험만 변경됐고 전송·Router·제품 범위 확대가 없다.
2. `AC18_A01_TO_A06_SEMANTIC_COVERAGE`: **PASS(범위)** — 여섯 assertion과 raw TAP 6/6 결속을 확인했다.
3. `STATE_AUTHORITY_EVENT_CONTRACT_FAIL_CLOSED`: **CHANGES_REQUIRED** — 아래 B-1·B-2.
4. `COMPLETION_EVIDENCE_HASH_COHERENCE`: **PASS** — bundle, contract, test, evidence, catalog, TAP 결속이 일치한다.
5. `NO_SEND_OR_ROUTER_OR_PRODUCT_SCOPE_EXPANSION`: **PASS** — send/provider 0과 범위 제한이 일치한다.
6. `P2_LOCAL_COMPLETION`: **NO** — B-1·B-2를 반영하고 새 run 006 및 재확인이 필요하다.

## 차단 finding

### B-1 — canonical payload 동일성 부재

계약은 같은 payload replay를 멱등 처리하고 바뀐 payload를 충돌로 거부하지만, 동일 payload의 정의가 없다. 시험의 `JSON.stringify` 해시는 키 삽입 순서에 의존해 계획과 BF-C2의 NFC·정렬 key·compact UTF-8 canonical 규칙과 모순된다.

요구 보완:

- 계약에 `payload_equality`와 canonical 규칙·참조·비JSON 거부를 추가한다.
- 시험 fingerprint를 canonical JSON으로 바꾼다.
- 키 재정렬 replay와 NFC 정규화 key 충돌 음성 시험을 추가한다.

### B-2 — 권한 시간의 시계 출처 부재

`valid_at_execution`의 `now` 출처가 계약에 없다. strict 기준에서 trusted host UTC가 없고 `D-CLOCK-ALT`도 미결정인데 임의 시계를 입력할 수 있다.

요구 보완:

- `clock_provenance.required=true`를 추가한다.
- `TRUSTED_HOST_UTC` 또는 `D-CLOCK-ALT`로 사람 승인된 로컬 대안만 허용한다.
- 출처가 없는 `now`를 `REJECT_NO_CLOCK_PROVENANCE`로 거부하는 시험을 추가한다.

## 비차단 후속

- 시험 안의 참조 해석기를 향후 P3/P4와 공유할 별도 module로 추출하는 것은 P1 후속이다. 현 P2 승인 범위를 자동 확대하지 않는다.
- child epoch 거부 코드를 계획·계약·실제 throw에서 하나로 통일한다.
- 완료 roll-up에 `required_task_state: ACTIVE`를 명시한다.
- AST 가용성 marker를 실제 assertion 메시지와 더 직접 결속한다.
- 보완 재실행 뒤 계약의 `gate_status`를 `VALIDATED_LOCAL_P2_ONLY`로 갱신한다.
- P2 gate 레코드에 후보005 SHA와 모델 catalog002 SHA를 명시한다.
- `runner_ref`의 절대 Node 경로는 machine-specific이라는 한계가 있으나 endpoint ID는 아니다.

## 불변 제한

전체 검증 ②·③ 실패는 면제되지 않는다. P2b~P5, 실제 전송, Router, 앱·DB·Supabase, `service_ready`는 계속 차단한다.
