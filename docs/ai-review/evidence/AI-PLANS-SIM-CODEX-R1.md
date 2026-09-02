# AI-PLANS-SIM-CODEX-R1 — 1차 정적 계약·기준 실행 검수

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: CHANGES_REQUIRED → 공식 문서·시뮬레이터에 반영
> 기준 commit: `8ab364e3330bbd7205572279fb5a4d6b969e2a51`
> 검수 범위: 다섯 기획안, `docs/작업큐.md`, 최초 시뮬레이션 구현
> 역할: Codex 계약 검수 1차

## 1. 실행 결과

최초 실행은 19개 중 16개가 통과하고 문서 계약 3개가 실패했다. 실행 모델의 초판을 함께 읽은
독립 검토에서는 그 모델이 공식 문서를 임의 단순화한 결함도 확인했다. 이 회차는 통과 증거가 아니라
실패를 드러낸 기준선이다.

## 2. 필수 Finding과 처리

| Finding | 심각도 | 재현 | 처리 |
|---|---|---|---|
| Task 최소 스키마 불일치 | Major | 팀 §11이 요구하는 `risk_basis`, Task별 `seq`·직전/item hash가 온톨로지·오케스트레이션 예제에 없음 | 두 예제와 매핑 표를 같은 필드로 보완 |
| 중앙 권위 표의 5노드 미완성 | Major | 디렉터리 표에 디렉터리 자체 소유와 평가의 품질·Learning·자율성 소유가 없음 | 두 권위 행 추가 |
| 참조망과 권위 DAG 혼합 | Major | 초판 검사기가 강연결 하나만 봄 | 탐색 참조 강연결과 `OWNS`·`DEPENDS_ON` DAG를 별도 단언 |
| disposition 계약 오기 | Major | 초판 enum이 `ADD_TO_EXISTING`, chain이 전역 seq | `ADD | SUPERSEDE_PROPOSAL | NEW_TASK | STATUS_ONLY`, Task별 chain으로 교체 |
| stale writer 판별 무효 | Major | 같은 현재 배열의 before/after만 비교해 lock 전 prefix 유실을 못 잡음 | 관찰한 count·seq·head·prefix hash를 lock 안 현재값과 대조 |
| 만료 lease 자동 인수 | Major | 초판은 만료만으로 새 actor가 획득 가능 | 이전 소유자 인계 또는 사람 `HANDOFF` Decision 없으면 거부 |
| Fable 실패 원본 덮어쓰기 | Major | 단일 run 상태를 다음 성공 run이 대체 | run 배열 불변 보존, 실패는 verdict 없음·유효 회차 미산입 |
| Learning 상태 위반 | Major | 문서에 없는 `ACTIVE` 상태 사용 | `CANDIDATE | VERIFIED | RETIRED`; 재사용은 상태가 아니라 적용 이력 |
| 자동 강등 폭 과다 | Major | A3 사고를 A0으로 내림 | 평가안 계약대로 A3→A2 한 단계 강등 |
| 누적 집합 수 복제 | Major | 디렉터리안이 자체 금지하면서 `다섯 문서`를 고정 | `현재 누적 집합`으로 변경 |
| 부분 활성화 허용 | Major | Fable 1 PASS만으로 네 문서를 ACTIVE 처리 | Codex 2회·Fable 유효 2회·사람 Decision 뒤 네 상태+AGENTS를 한 commit에서 갱신 |

## 3. 실제 작업큐 판정

기존 `AI-ORCH-PLANS-1`은 Opus 시점 SHA와 미구현 hash placeholder를 가진 과거 Task이므로 소급
수정하지 않았다. 실행형 시험은 별도 산출물·수명주기를 가지므로 `AI-ORCH-PLANS-SIM-1`을 새로
등록하고 이전 Task에 `depends_on`으로 연결했다. 새 Task는 팀 §11 필수 복원 필드, canonical
disposition 이름, 실제 계산한 Task별 item hash, 단일 owner·lease, 사용자 파일 제외를 가진다.

## 4. 1차 결론

개념적 5문서 네트워크는 성립했지만 초판 문서와 시뮬레이터는 실제 운영 계약을 모두 표현하지
못했다. 위 Finding을 반영하기 전 판정은 `CHANGES_REQUIRED`다. 수정 뒤 2차 Codex 실행 검수와
독립 Fable 2회가 필요하며, 이 증거만으로 문서를 `ACTIVE`로 바꾸지 않는다.
