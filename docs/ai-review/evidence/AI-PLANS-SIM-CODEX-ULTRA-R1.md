# AI-PLANS-SIM-CODEX-ULTRA-R1 — 실제 업무 계약 1차 재감사

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: `CHANGES_REQUIRED → VERIFIED`
> 기준 commit: `8ab364e3330bbd7205572279fb5a4d6b969e2a51`
> 대상: 다섯 기획안·작업큐·업무 네트워크 시뮬레이터의 Ultra 재시작 후보
> 역할: Codex 계약 감사 1차

## 1. 방법

이 회차는 기존 20개 시험을 성공 근거로 재사용하지 않았다. 다섯 문서의 권위·상태·요청·Task·검수·
Finding·Learning·자율성 계약을 다시 읽고, 정상 업무를 실행한 뒤 계약을 하나씩 약화하는 변이를
추가했다. 제품 코드·DB·실제 디렉터리는 변경하지 않았다.

## 2. Finding 처리

| Finding ID | 판정 | 발견한 공백 | 처리·재현 시험 |
|---|---|---|---|
| `CXU1-GRAPH-001` | VERIFIED | 탐색 강연결과 권위 DAG가 섞일 수 있음 | 두 그래프를 별도 검사하고 링크 절단·권위 순환 변이 |
| `CXU1-AUTHORITY-002` | VERIFIED | 디렉터리 표에서 평가 정책과 Learning 장부 소유가 합쳐짐 | 정책 소유와 인스턴스 장부 소유를 별도 행으로 고정 |
| `CXU1-REQUEST-003` | VERIFIED | `REQUEST_INPUT → NORMALIZED_REQUEST → TASK` 경로와 의미 분류가 실행 모델에 없음 | `NORMALIZES`·`ROUTES_TO` 관계와 의미 분류 7종 추가 |
| `CXU1-TASK-004` | VERIFIED | 공식 Task Packet 필드·Task SHA·상태 전이·depends_on 결속이 약함 | 역할·요구·불변식·결정·Learning·산출물·시험·위험·질문 필드와 exact SHA 검사 |
| `CXU1-LEASE-005` | VERIFIED | 같은 actor 중복 artifact lease·update 우회·무관 HANDOFF 허용 | 경로 중첩, 제어 필드 보호, Task/from/to 결속 Decision 검사 |
| `CXU1-SUPERSEDE-006` | VERIFIED | 승인 전 범위 덮어쓰기 또는 승인 후 적용 경로 부재 | Task·SHA 결속 `SUPERSEDE` Decision 전에는 의미 필드 변경 거부 |
| `CXU1-REVIEW-007` | VERIFIED | Fable/Codex 회차를 같은 세션·증거로 재포장 가능 | 엔진·모델·CLI·세션·hash·비용·공식 review Task·scope·role 고유성 검사 |
| `CXU1-BUDGET-008` | VERIFIED | 실패 비용을 포함한 Fable Task 누적 상한 미검사 | 같은 review Task의 성공·실패 사용액 합산 후 상한 초과 거부 |
| `CXU1-FINDING-009` | VERIFIED | Finding이 Task·원본 회차와 분리되고 무관 Task를 전역 차단 | Task·round·역할·SHA 결속 registry와 Task별 미해결 집합 검사 |
| `CXU1-AUDIT-010` | VERIFIED | run/evidence 배열 삭제·변조의 역방향 완전성 미검사 | append-only audit hash chain과 양방향 수·payload 대조 |
| `CXU1-ACTIVE-011` | VERIFIED | `DRAFT`에서 `REVIEWED` 없이 바로 활성화하거나 부분 활성화 가능 | `DRAFT → REVIEWED → ACTIVE`, 네 상태·Decision·AGENTS 원자 commit 검사 |
| `CXU1-DIRECTORY-012` | VERIFIED | preflight·보호 gate 증거가 boolean 자기주장일 수 있음 | 증거 reference·SHA, path map hash, exact protected SHA 결속 |
| `CXU1-LEARNING-013` | VERIFIED | caller가 route를 속여 독립 감사에 Learning을 주입 가능 | 대상 Task route·predecessor·reviewer 결속, 최초 SECURITY/FINAL 차단 |
| `CXU1-AUTONOMY-014` | VERIFIED | 승격 Decision 재사용과 route 불일치 가능 | route·SHA 결속, 1단계 승격, Decision 1회 사용, 운영 실행 사람 전용 |

## 3. 회차 결론

모든 Finding은 같은 후보에서 대응 시험과 함께 `VERIFIED`됐다. 이 회차는 문서 활성화 승인이
아니다. 2차 Codex 적대 검수와 같은 exact commit에 대한 독립 Fable 두 Task가 남아 있다.
