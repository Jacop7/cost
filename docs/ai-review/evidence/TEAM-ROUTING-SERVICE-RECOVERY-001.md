# 팀 채팅 서비스 중단 재현과 복구 범위

상태: 진단·수정 요구사항. 실행 승인, 독립검수 PASS, endpoint 복원 또는 서비스 정상 증거가 아니다.
날짜: 2026-09-05. 출처: 사용자의 CEO·서비스 총괄 구조 확정, 팀 간 협업·사람에게 문제 보고 및 01 요청 미전달 수정 요청.

정정: 최초 진단의 '상황실 필수 경유'는 잘못된 해석이었다. 사용자는 주를 CEO, 부를 서비스 총괄로
확정했으며 부는 상황실과 각 팀에 직접 지시한다. 아래 개정 내용이 이 진단의 이전 해석을 대체한다.

## 확인한 중단 요인

- 모델 계획 검증은 `MODEL_PLAN_VERIFIED`, 라우터 정책은 `POLICY_VALID / ACTIVE_DISPATCH`,
  manifest는 `MANIFESTS_VALID / 11 chats / 21 edges`다. 이 세 결과는 업무 자동 수행 완료가 아니다.
- `docs/team/chats/master-01-human-decisions.md`에는 요청을 Master 02로 보내는 edge는 있지만,
  요청 수신부터 실제 전송·ACK·업무 결과까지 진행하는 실행 루프를 manifest 자체가 제공하지 않는다.
- `docs/team/chats/master-03-deputy-context.md`의 부→팀 직접 연결은 올바른 기본 배정 경로다.
  다만 부→상황실 상태 관리, 주→팀 직접 관여, 팀 상호 협업과 보고 경로의 추가 검토가 필요하다.
- 팀 상호간 직접 협업 edge가 없고, 사람 결정 창구로의 직접 보고는 Master 02·04·05만 허용한다.
- `scripts/docs-graph-check.mjs`의 고정 CHAT_ROUTING과 기존 시험은 이 이전 구조의 일관성을 검사한다.
- 전역 Team Router 정책상 자체 background service는 없다. 활성 source가 prepare-dispatch의
  정확한 prompt와 target을 앱 도구로 전송해야 한다. `child_routes_allowed=false`는 후속 발송을
  금지하고 `TEAM_ROUTER_ACK`는 업무 실행이 아닌 ACK 전용이다.
- runtime의 11개 endpoint는 generation 1 / ACTIVE_INITIAL이다. 이 숫자 자체가 오류는 아니지만,
  이동된 작업으로의 successor 재결속 완료를 증명하지 않는다. 실제 대상 대조·인계 게이트가 별도다.

## 수정해야 할 동작

1. 사람의 평시 입력을 질문/업무요청/결정/중단으로 분류한다. 단순 질문을 임의 업무로 만들지 않는다.
   업무요청에는 Task ID·범위·완료조건·담당·correlation을 부여하고 실제 배정을 이어간다.
2. 주는 CEO로 전체 목표·우선순위·자원·결과를 책임지고 필요하면 각 팀에 직접 관여한다.
   부는 서비스 총괄로 상황실과 5개 팀에 직접 지시하며 실행 순서·진행·의존성·자원을 조율한다.
   상황실은 공유 상태·차단·결과 취합 창구이며 필수 배정 중계소가 아니다.
   기본 배정 경로는 01→02→03→팀이고 결과는 역방향이다. 주의 직접 지시도 같은 Task와 revision으로
   부에게 공유하여 별도 중복 작업을 만들지 않는다. 추후 마케팅 총괄은 주 아래 서비스 총괄과 병렬로
   확장하되 지금 마케팅 조직·채팅을 생성하지 않는다.
3. 팀끼리 직접 협업할 수 있다. 새 COLLAB_REQUEST/COLLAB_RESULT는 검토할 메시지 종류 제안이며
   아직 현재 정책의 허용 kind가 아니다. 협업 메시지는 범위·배포 권한을 늘리지 않는다. 관련 Task
   안의 변경분·질문·결과만 보내고 상황실의 공식 상태에 연결한다. 무조건 전체 팀에 broadcast하지 않는다.
4. 주·부·상황실·팀·게이트는 소통 단절, 지침 충돌 또는 해결할 수 없는 문제를 01에 직접 보고할 수
   있어야 한다. 기존 DECISION_POINTER 종류로 문제와 필요한 결정을 연결하는 경로를 검토한다.
   보고는 승인으로 간주하지 않는다. 응답은 원 Task/correlation에 연결하고 평시 배정 체계를 유지한다.
5. 수신 ACK와 업무 완료를 분리한다. 허용된 업무 배정에만 child route를 허용하고, ACK-only 파일럿이나
   단순 문의에 이를 일괄 활성화하지 않는다. sender의 도구 호출 수락만으로 DELIVERED/COMPLETED를
   기록하지 않는다. 모든 접수 업무는 다음 배정 또는 명시적 차단/완료 상태를 남겨야 한다.
6. 재개는 미확인 outbox와 결과 회수부터 수행한다. 거부는 terminal로 기록하고 동일 메시지를 무한
   재전송하지 않는다. retry 제한, 중복방지, 동일 Task의 편집 충돌, 중단 결정을 검사한다.
7. 사람의 업무 수정 승인과 라우터의 전송 승인을 구분한다. 현재 생성 prompt는 DB·Supabase·배포
   mutation을 금지하므로 연결 복구만으로 기존 DB 업무가 실행 가능해지는 것은 아니다. 업무별 권한
   전달 계약을 별도 검수하고 운영 배포 승인·Quality 독립검수는 유지한다.

## 이번 변경과 재현 방법

새 `scripts/team-routing-contract-audit.mjs`는 위 요구사항의 정적 연결 누락만 읽기 전용 검사한다.
활성 정책·manifest·기존 봉인·runtime을 수정하지 않고 메시지도 보내지 않는다. 일반 validator의
대체본이 아니며 `pnpm verify`에 아직 연결하지 않았다. 정적 조건이 모두 맞아도
`STATIC_COVERAGE_ONLY`, `serviceReady=false`이고 실행·권한·인계·ACK 왕복은 미검증으로 남긴다.

```powershell
node --test scripts/team-routing-contract-audit.test.mjs
node scripts/team-routing-contract-audit.mjs
```

정적 진단 자체 시험: 6/6 통과. 현재 프로젝트 진단: REQUIREMENTS_NOT_MET, 의도된 종료 코드 1.
이것은 구현 회귀시험 통과와 서비스 요구사항 미충족을 구분한 결과이며 독립검수 결과가 아니다.

## 이번 후속 구현: 평시 배정·회신 상태 전이

`scripts/team-service-workflow.mjs`와 시험을 추가했다. 순수 상태 전이 모듈이며 foreground 실행기에
연결할 구성요소다. 네트워크 전송, 영구 outbox 저장, 활성화 승인, endpoint 재결속을 자체 수행하지 않는다.

- `createServiceWorkflow`: Task 포인터·correlation·담당 팀으로 01→주→부→팀→부→주→01의 6개 leg 구성.
- `nextServiceAction`: 현재 발신 역할에게만 PREPARE_ROUTE 후보 반환. 다른 역할은 WAIT_FOR_ACTOR.
  반환값은 허가가 아니다. adapter가 활성 계약과 prepare-dispatch 검사를 반드시 수행한다.
- `applyServiceEvent`: 실제 영수증 검증 adapter 없이는 실패 폐쇄한다. TOOL_ACCEPTED는
  SENT_UNCONFIRMED, 수신 ACK는 ACKNOWLEDGED, 결과 포인터 검증 뒤에만 다음 leg로 넘어간다.
- Task/correlation·revision·발신/수신 역할·delivery token을 검사한다. 같은 event의 재처리는 멱등이고,
  같은 event ID의 다른 내용은 거부한다. 거부는 terminal이며 자동 재발송하지 않는다.
- 소통 차단은 해당 역할에서 01로 DECISION_POINTER 보고 후보를 만들고, 검증된 사람 중단은 STOPPED다.
  상태를 JSON 직렬화해 이어가는 시험은 있지만 실제 영구 저장·재시작 복구 구현은 아직 없다.
- 모든 영수증 검증은 신뢰된 adapter 계약이다. 테스트의 합성 verifier와 PASS는 실제 앱 영수증이나
  승인 증명이 아니며 production adapter로 사용하면 안 된다. 이 모듈만으로 실제 사용자 권한이나
  수신자의 작업 완료를 검증했다고 주장하지 않는다.

```powershell
node --test scripts/team-service-workflow.test.mjs scripts/team-routing-contract-audit.test.mjs scripts/docs-graph-check.test.mjs
```

새 상태 전이 시험 10개, 정적 진단 시험 6개, 기존 문서 그래프 시험 26개를 함께 확인한다.
전체 `pnpm verify`·실제 메시지 왕복·독립검수의 대체가 아니다.

후속 검수 식별자: TEAM-SERVICE-CHIEF-FLOW-001 / r001 (아직 실행하지 않음).
첫 검수는 구조·권한 경계·누락된 실제 전송 연결을 대상으로 한다. 코드 최종 완료에는 별도 COMMIT
판본 검수와 활성화·endpoint·실제 ACK/결과 증거가 필요하다. 현재 규격상 외부 Fable 호출에는
해당 회차의 정확한 soft-cap 초과 위험 승인과 프로젝트 잔여 예산 확인이 선행되어야 한다.

## 실제 복구 순서와 완료 판정

- 한 공식 설계의 변경 diff를 검수하고, manifest·역할 컨텍스트·검사기·수신 실행 절차를 함께 바꾼다.
  현 활성 계약을 편집하면서 옛 PASS/hash를 그대로 사용하지 않는다. 전역 플러그인 변경은 별도 범위다.
- 변경된 계약 bytes에 맞는 필수 독립검수와 정확한 활성화 Decision/receipt를 확보한다.
- 각 기존 endpoint에 대해 실제 봉인 handoff→수신 작업의 복원→Study Gate→generation CAS를 완료한다.
  복구 영수증을 합성하거나 최초 결속으로 위장하지 않는다.
- 먼저 ACK-only 파일럿, 이어서 비운영·비제품 변경 Task 하나의 01→팀→01 실제 왕복을 검증한다.
  서로 다른 두 팀의 협업·사람에게 직접 문제 보고·중복·재시작·거부·중단도 시험한다.
- 위 증거가 없으면 서비스 정상/자동 지휘 완료로 보고하지 않는다. 문서 작성·폴더 노출·정적 검증만으로
  사용자의 요청 처리가 끝났다고 판단하지 않는다.

## 미완료

앱 전송/실제 영수증 검증 adapter, 영구 outbox와 crash recovery, 새 경로의 활성 계약 반영,
CEO 직접 지시 동기화·팀 간 협업 실행, successor 재결속, Fable/Opus 독립검수와 실제 왕복은 미완료다.
현재 봉인 원본과 기존 사용자 변경은 보존했다. 정책·manifest·plugin 설치본·runtime은 변경하지 않았다.
