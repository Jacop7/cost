# TEAM-SERVICE P2 구현 Fable 재검수 006

## 결속

- 요청 패킷: `docs/ai-review/evidence/TEAM-SERVICE-P2-IMPLEMENTATION-FABLE-RECHECK-CANDIDATE-006.json`
- 요청 패킷 SHA-256: `b44bd1352386d9822898f4dc9d8cf1430e48a00a5c566e6c85294b2a8e253228`
- 대상 HEAD: `fe96c3c196d4c3211024c1ecbe18e9d358a230b8`
- 채널: 기존 `AI 팀 지식망 스터디·인계` Fable Cowork 채팅
- 성격: 직접 Fable Cowork 검수. formal CLI receipt가 아니다.

## 최종 판정

- `p2_recheck_verdict`: **PASS**
- `p2_local_completion`: **YES — P2 선언적 상태·권한·이벤트 스키마와 AC-18 로컬 mock에 한정**
- `blocking_findings`: **없음**
- `next_authorized_phase`: **NONE_UNLESS_SEPARATELY_ADMITTED**

P2b의 `intent_key get-or-prepare`부터는 별도의 후보·범위·입장 결정이 필요하다. 이 판정은 P2b~P5, 실제 전송, Router, 앱·DB·Supabase를 승인하지 않는다.

## 무결성

Fable은 요청 파일 SHA, 9/9 pin, HEAD, canonical model plan 불변과 CURRENT pin을 확인했다고 보고했다. run 005 증거는 보존되고 catalog에 run 005·006이 함께 남으며 `P2_STATE_CONTRACT.active_run_id`는 006이다.

## 차단 해소

### B-1 — 해소

- 계약에 `CANONICAL_JSON_NFC_SORTED_COMPACT_UTF8` payload 동일성, 비JSON 거부, 정규화 key 충돌 거부를 추가했다.
- 시험 fingerprint가 canonical JSON을 사용한다.
- key 순서를 바꾼 replay가 같은 상태를 반환한다.
- NFC 정규화 key 충돌과 `undefined` 비JSON 값을 거부한다.
- child epoch 코드를 `CHILD_STOP_EPOCH_FORBIDDEN`으로 통일했다.
- 완료 roll-up에 `required_task_state: ACTIVE`를 추가했다.

### B-2 — 해소

- 권한 계약에 필수 `clock_provenance`를 추가했다.
- `TRUSTED_HOST_UTC`만 현재 양성 경로로 통과한다.
- 출처 없는 시계는 `REJECT_NO_CLOCK_PROVENANCE`로 거부한다.
- `D-CLOCK-ALT`가 `PENDING`인 대안 시계는 `REJECT_UNAPPROVED_CLOCK_ALTERNATIVE`로 거부한다.

## run 006 결속

- bundle-006 SHA-256: `010e2c1e6cf56eab99c9dd2d388e0e8497886bbd4e84b1be5ddbc277a736e806`
- 상태 계약 SHA-256: `6fd8dc1c41373fa55852a271cbbfbf95ec6ec48cb8e93c5e32c289df40fdddb2`
- 시험 SHA-256: `b7b2a7b46280a654a393cd3bac433f59e8a38ca0a96c8d292828333077ed7796`
- raw TAP SHA-256: `afce073e40f7c862d0540a01a74b5adb75fa2550d14c303b046cb4c89e2757ad`
- 실행: 6 tests, 6 pass, 0 fail, 0 skipped
- 계약 상태: `VALIDATED_LOCAL_P2_ONLY`

## 비차단 후속

1. P2b 전 별도 입장 범위에서 canonical interpreter를 공유 module로 추출해 workflow와 후속 store/driver의 해석 drift를 막는 것을 권고한다.
2. AC-18 marker 배열을 실제 assertion 메시지와 더 직접 결속한다.
3. 절대 Node `runner_ref`는 machine-specific이므로 이식형 도구에서는 논리 runner와 실행 시 해시를 분리한다.
4. bundle-006에 run-005 superseded 관계를 명시하는 것은 역사 추적 개선 사항이다.
5. 전체 검증 ②·③ 실패와 개발 DB 42/50 퇴행은 면제되지 않는다.

## 불변 제한

`service_ready`, 실제 채팅 전송, host binding, Router 활성화, 앱·DB·Supabase 변경은 계속 거짓이다.
