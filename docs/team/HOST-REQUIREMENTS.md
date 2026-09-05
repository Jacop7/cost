# Host 최소 요구와 미충족 시 축소 계약

범위: HOST-SCOPE-002. 이 문서는 연동 구현 설계나 플랫폼 기능 존재 선언이 아니다.
기계 계약: [host-requirements-contract.json](host-requirements-contract.json).
착수 조건/종료값: [host-scope-002.json](host-scope-002.json).
현재 실행 상태는 [CURRENT](../ai-review/evidence/TEAM-SERVICE-FLOW-CURRENT.json)만 소유한다.

## 1. 초기 제품 목표는 11개 방의 실제 업무 왕복

사람01 → CEO02 → 서비스총괄03 → 담당 팀 → 총괄 → CEO → 사람의 왕복을 유지한다.
상황실은 비차단 집계이며, CEO 직접 관여·총괄 동기화·허용 peer 협업·전 역할 사람 보고를 포함한다.
04 개발/스테이징 및 05 운영 게이트의 사람 결정 책임도 유지한다.
LOCAL_CORE_ONLY는 진행을 위한 별도 산출물이지 초기 소통 제품의 완성이 아니다.

## 2. 세 요구는 서로 대체하지 않는다

| 요구 | 최소 충분 요청 | 로컬에서 할 수 있는 일 | 없을 때 잃는 주장 |
| --- | --- | --- | --- |
| P1 실제 caller | 실제 invocation에 결속된 보호된 caller/context 참조 | manifest role와 generation lookup | 실제 호출자 인증; 자기 입력으로 대체 불가 |
| P2 결과 출처 | raw 결과와 actual target/invocation의 보호된 연결 | 무편집 capture·hash·intent 대조 | 검증된 target ACK; capture 이후 무변경만으로 출처를 증명 못 함 |
| P3 STOP fence | 전송 시작점의 root epoch/run/lease 원자 검사 | queued work 차단·in-flight 취소/조회/회수 | 외부 전송을 STOP 이후 원자적으로 막았다는 보장 |

P1/P2는 독립적으로 요구할 수 있다. P3는 엄격한 예방을 원하는 제품에서만 플랫폼 요구다.
회수형 제품을 채택해도 P1 인증이나 P2 출처가 생기는 것은 아니다.
플랫폼에 8+5개의 필드를 모두 요구하지 않는다. application role/generation/hash/expiry는 로컬 파생값이다.
P1·P2의 보호된 참조가 여러 속성을 한 객체로 담아도 되지만, 주장에 필요한 결속은 제거할 수 없다.

## 3. 필드별 degradation matrix

| 필드 | 구분 | 출처/대체 | 없으면 주장할 수 없는 것 |
| --- | --- | --- | --- |
| CC.host_id | DERIVABLE | Single declared host namespace; protected caller ref must still be scoped | Cross-host identity collision exclusion |
| CC.protected_source_ref | PLATFORM_REQUIRED | Protected invocation context, not prompt/CLI/env assertion | Authenticated actual calling endpoint |
| CC.logical_role | DERIVABLE | Exact local manifest lookup from authenticated source binding | Authorized role attribution |
| CC.runtime_generation | LOCAL_REQUIRED | Protected runtime generation CAS | Current successor attribution and stale endpoint rejection |
| CC.host_run_ref | OPTIONAL | Platform invocation ref if supplied; otherwise local attempt ref for audit only | Platform run-level attribution |
| CC.collected_at | LOCAL_REQUIRED | Capture timestamp plus trusted/approved clock policy | Age/freshness bound |
| CC.expires_at | DERIVABLE | Capture validity window and Decision expiry intersection | Still-valid caller context |
| CC.provenance | PLATFORM_REQUIRED | Protected context/result origin chain; may be same opaque P1 context capability | Non-self-asserted identity |
| HR.tool_call_ref | PLATFORM_OR_PROTECTED_CAPTURE | Host invocation link or documented protected capture connection | Result belongs to exact tool invocation |
| HR.response_source | PLATFORM_OR_PROTECTED_CAPTURE | Unedited tool bytes captured by declared trusted writer | Origin-authenticated result receipt |
| HR.observed_target_ref | PLATFORM_REQUIRED_FOR_ACK | Actual target binding in tool result/context; prompt echo insufficient | ACK came from intended target |
| HR.status | PLATFORM_OR_OBSERVED | Tool transport status and separately observed target response | queued vs target ACK vs work result |
| HR.response_hash | DERIVABLE | Hash exact bytes after protected capture | No alteration since capture |

상세 축소 행동은 기계 계약 각 행의 degradation을 따른다.
로컬 attempt ID는 host_run_ref가 아니며, 선택한 target을 prompt에 넣었다고 실제 응답 출처가 되지 않는다.
collected_at/expires_at은 유효성 판단용이다. 정확한 시계가 P1/P2를 만들어내지 않는다.
보호 runtime에 모델이 사후 작성한 JSON은 무편집 host raw 결과를 대체하지 않는다.
같은 사용자/관리자 공격자에 대한 암호학적 보호를 주장하지 않는다.

## 4. 충족 수준별 제품

1. LOCAL_CORE_ONLY: 정규화·CAS·intent·event chain·outbox/replay·blocker·로컬 STOP.
   host 없는 결정론적 fixture 시험이 가능하다. 실제 메시지·ACK 인증·11개 방 서비스 완료는 주장하지 않는다.
2. COOPERATIVE_11_ROLE_FLOW 후보: 초기 11개 방 기능 흐름은 목표로 유지하되
   협력적인 agent·도구 target 선택·관측 receipt를 사용하는 별도 신뢰 계약이다.
   실제 caller 인증과 원자 remote STOP은 주장하지 않고 불확실한 전송은 회수/조정한다.
   **현재 채택/발송 승인이 아니다.** 별도 사람 위험 Decision·검수·긍정 증거·정확한 activation 전에는 발송 0이다.
3. AUTHENTICATED_ROLE_FLOW: P1/P2 및 exact role binding을 확보하는 외부 의존 제품.
   P3 제공 여부에 따라 엄격 예방 또는 별도 승인된 회수형 STOP을 선택한다. 선택을 묵시적으로 바꾸지 않는다.

## 5. 종료와 외부 이관

HOST_REQUIREMENTS_SPECIFIED는 명세가 완성됐지만 플랫폼 제공 여부는 외부 의존으로 남았다는 뜻이다.
HOST_PARTIAL_VIABLE은 일부 제품의 가용성을 실제 출처로 뒷받침할 때만 가능하며 live 승인과 다르다.
HOST_INTEGRATION_INFEASIBLE은 명시적 플랫폼 제약이 최소 요구와 모순될 때만 가능하다.
문서에 API가 없다는 이유만으로 플랫폼 전체 불가능이라 하지 않는다. 시간/출처 한도 미충족은 INCOMPLETE다.

이번에는 최소 요구와 축소 계약을 확정하고 제공 여부는 미정으로 외부 의존 목록에 올린다.
플랫폼에 메시지/기능 요청을 실제 전송하지 않는다.
요청 패킷은 P1/P2/P3 각각의 필요 주장·최소 인터페이스·반환 불가 시 축소 행동을 분리해 전달할 수 있다.

**002의 어떤 결과도 001을 HOST_BINDING_AVAILABLE로 소급 변경하지 않는다.**
001 원본과 hash는 불변이고, 새 양성 조사는 새 scope ID·requirements bundle·실제 증거로만 판정한다.

## 6. 발송과 로컬 코어 트랙 분리

send gate는 닫힌 채 유지한다. 새로운 양성 host scope는 필요조건일 뿐이며 exact 승인·정식 게이트도 필요하다.
로컬 코어는 host 양성을 선행조건으로 하지 않는다. C1/C2도 이 별도 트랙에 넣는다.
다만 model/scope 검증·fixture-only 경계·무발송 기계 시험·독립 완료 검수는 그대로 필요하다.
실제 Router CLI/앱 도구/네트워크를 local core에서 호출하거나 synthetic receipt를 실수신으로 승격하지 않는다.

local completion에는 dispatch_attempts=0, 허용 import 경계와 throw-on-send 경로 시험을 묶는다.
host 의존 AC는 BLOCKED_HOST/SKIP_HOST_DEPENDENCY로 분리 표시하며 전체 AC/서비스 PASS의 분모에서 숨기지 않는다.
본 002 회차는 읽기·설계 전용이며 C1/C2 제품 소스 수정이나 store/driver 구현은 하지 않는다.
