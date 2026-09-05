# 협력형 11역할 흐름 — 위협 모델과 완료 증거 계약

판본: 0.1 / CANDIDATE. 기계 계약: [cooperative-flow-contract.json](cooperative-flow-contract.json).
상위 계획: [팀서비스 자동 흐름 구현계획](../팀서비스-자동흐름-구현계획.md).
현재 판정은 [CURRENT](../ai-review/evidence/TEAM-SERVICE-FLOW-CURRENT.json)만 소유한다.

## 1. 제품 선택과 범위

협력형은 초기 11개 방의 기능 흐름을 구현하기 위한 **선택 후보**다. 외부 의존 때문에 이 후보만
남았다고 해서 자동 채택된 것은 아니다. 인증형 요구를 낮추거나 현재 send gate를 여는 계약이 아니다.
채택에는 정확한 후보 SHA에 대한 사람의 축소 신뢰 위험 수용, 검수, 별도 활성화가 필요하다.
최초 파일럿은 비운영·읽기 전용 자료 확인이며 제품/DB/배포/비밀 접근 권한을 주지 않는다.

기능 목표는 사람01→CEO02→서비스총괄03→담당 팀→총괄→CEO→사람01 결과 전달이다.
상황실은 비차단 집계이며 팀 협업·CEO 직접 지시·10역할의 사람 보고를 허용된 edge로 연결한다.
한 업무에 11개 방을 억지로 모두 참여시키지 않는다. 필수 leg별 실제 왕복과 별도 11역할 연결 점검을
구분한다. 04/05 방의 사람 승인 책임은 그대로이며 연결 점검이 운영 배포 실행이 되어서는 안 된다.

## 2. 신뢰 가정과 깨졌을 때의 경계

- 참여 agent는 공통 intake/driver/claim 검증을 사용하고 도구를 우회 실행하지 않는다.
- 단일 권위 runtime의 잠금·CAS와 assignment 소유권 표가 모든 실행 방에서 공유된다.
- 관측 수집기는 실제 앱 도구 요청·응답을 무편집 저장한다. 모델이 사후 작성한 JSON은 수집 결과가 아니다.
- 로컬 사용자/관리자가 runtime·collector·정책을 악의적으로 바꾸지 않는다는 가정이다.
- 실제 호출자 인증은 가정하지 않는다. 동일한 내용을 다른 agent가 제출하는 사칭까지 CAS로 막지 못한다.

이 가정은 구현된 보안 경계가 아니다. 우회 실행·출처 불명 결과·서로 다른 runtime·무단 권한 증가를
발견하면 해당 Task의 신규 배정/claim을 중단하고 결과를 격리해 사람에게 보고한다.
정상 경로 밖에서 이미 실행된 외부 효과까지 취소했다고 주장하지 않는다. 독립 agent가 임의로
도구를 사용하는 것을 OS/플랫폼이 막지 못하면 관측·중단 요청·회수만 가능하다.

## 3. 실패 모드와 로컬 방어

| ID | 실패 | 필수 로컬 통제 | 거부·회수와 잔여 위험 |
| --- | --- | --- | --- |
| T2-01 | 본문·첨부가 정책 무시/다른 Task 실행을 지시 | envelope의 typed 요청과 인용 자료를 분리. canonical Task의 scope·역할·kind·허용 도구/경로를 intake와 실행 직전에 검사. 본문은 Decision·권한·root·모델 계획을 변경할 수 없음 | 범위 밖 action 거부·본문 격리. 프롬프트 지침만으로 injection 완전 방어를 주장하지 않음. 검증기를 우회한 agent는 가정 위반 |
| T2-02 | successor 뒤 stale generation 응답·claim | 고정 logical role+binding generation+run_generation 대조. 현재 generation/owner/revision/STOP을 동일 claim CAS에서 확인 | 구세대 신규 실행 거부. 이전 intent에 맞는 늦은 결과는 AUDIT_ONLY/회수 기록. 실제 agent가 현재 generation을 사칭하는 것은 별도 신원 문제 |
| T2-03 | 다른 assignment를 자기 일로 claim | effect_key만 비교하지 않고 task/assignment/owner role/binding generation/run/revision/lease를 한 트랜잭션에서 검증 | 소유권 불일치 거부. 모든 호출자가 검증 경로를 사용해야 함. 전달된 role 값만으로 실제 caller 인증 불가 |
| T2-04 | 사람이 두 방에서 동일 업무를 동시에 시작 | 사람 요청의 안정 request_id와 정규화한 업무 명세를 같은 intake key에 결속. 단일 store의 intent/effect CAS와 충돌 판정 | 같은 key/같은 명세는 기존 업무 반환; 다른 명세는 충돌 보류. 다른 request_id로 쓴 의미상 같은 문장은 자동 동일성 보장 없음: 의심 중복을 사람에게 병합 확인 |
| T2-05 | 잘못된 방·복사한 응답·예전 결과를 ACK로 수용 | 관측 수집의 target 선택/응답 연결과 nonce·route/token·payload hash·assignment·세대 일치 | 내용 일치만으로 ACK 승격 금지. 불명확 관측은 UNVERIFIED/UNKNOWN_DELIVERY; 자동 재전송 금지 |
| T2-06 | STOP 직후 이미 보낸 작업 도착 | 로컬 queued action 차단과 root epoch CAS, in-flight 목록의 취소/조회/회수 | 원격 원자 STOP 보장 없음. 미확인 참여자는 STOPPED_WITH_PENDING, 늦은 결과는 감사 전용 |

시험은 모델이 항상 지시를 따른다는 선언이 아니라 금지 action 입력의 실제 거부, 동일 store의
2-writer 경합, 구세대 응답/claim, 잘못된 owner, 중복 key·상이한 request_id 시나리오를 관측해야 한다.

## 4. 관측과 인증의 분리

`assurance`는 `UNVERIFIED | OBSERVED | ATTESTED` 중 하나다. transport 접수·대상 ACK·업무 결과와는
독립 축이다. `APP_QUEUED`는 어떤 assurance에서도 업무 완료가 아니다.

### OBSERVED 수용 기준 — 파일럿 전에 고정

1. 실제 도구의 전송 요청과 대상별 read/wait 응답을 수집기가 invocation 단위로 연결해야 한다.
   선택한 target ref와 실제 조회 대상으로 사용한 ref를 보호 runtime에서 대조한다.
   반환 metadata에 target ref가 있으면 추가 대조하며, 모순되거나 요청-응답 연결이 없으면 거부한다.
   이 연결은 **그 방을 지정한 도구 호출에서 관측했다**는 뜻이지 실제 agent의 신원 인증이 아니다.
2. 각 leg의 사전 저장 intent에 논리 source/target, binding generation, task/assignment/run,
   route/token, payload hash, work_spec_revision, 관측 challenge nonce, 만료를 결속한다.
   nonce·본문 일치는 상관관계 검사일 뿐 숨겨진 비밀이나 서명으로 취급하지 않는다.
3. ACK와 RESULT를 분리 파싱한다. 수집된 원응답과 정확한 intent를 대조하고 예상 action과 결과 증거를
   별도 검증한다. 자유 문장의 “완료”·다른 방의 전달 문구·모델이 작성한 verified:true는 불충분하다.
4. 수집 경로·raw bytes 참조/hash·verifier 판본·검사 결과·불확실성을 남긴다. 원시 thread ref와 응답은
   접근 제한 runtime에만 두며 Git에는 비민감 논리 참조와 hash만 기록한다.
5. 현재 도구/collector가 위 관측 연결을 제공하는지는 미검증이다. 제공하지 못하면 UNVERIFIED로
   남기며, 본 계약의 존재만으로 OBSERVED 수집이 구현됐다고 표시하지 않는다.

ATTESTED는 위 조건 외에 선언된 attestor/신뢰 루트가 실제 invocation·caller·target·응답에 결속한
증거와 유효한 검증 결과를 필요로 한다. 문자열 `ATTESTED`, 로컬 hash 또는 thread ref가 인증을
만들지 않는다. 제공자 서명이 아닌 증거는 제공자 인증으로 표기하지 않는다. 현재 가용성은 미확정이다.

`HR.observed_target_ref`의 기존 PLATFORM_REQUIRED_FOR_ACK는 **인증된 ACK** 요구로 유지한다.
협력형 OBSERVED_ACK는 별도 이름·상태이며 기존 strict ACK/Router DELIVERED 게이트를 만족하지 않는다.
기존 Task COMPLETED/verifier에 enum만 추가해 통과시키지 않는다. 협력형을 채택할 때 별도 버전의
상태·검증기·승인 계약으로 OBSERVED_ROUNDTRIP_COMPLETE를 정의하고 정확한 SHA로 재검수해야 한다.

## 5. 왕복 완료 영수증

필수 필드는 기계 계약의 receipt.required_fields가 소유한다. receipt는 후보 명세이며 실행 기록이 아니다.

- 필수 leg의 실제 REQUEST_ACK, RESULT, 각 검증 결과, 최종 사람01 방의 결과 게시 관측을 연결한다.
  사람 방에 게시됐다는 것과 사람이 읽거나 승인했다는 것은 다르다. 별도 사람 결정은 대체하지 않는다.
- 현재 run의 필수 assignment 결과와 별도 Quality 결과가 모두 있어야 한다. 미해결 blocker, pending,
  STOP·UNKNOWN_DELIVERY가 있으면 완료 불가다. 상황실 지연은 별도 표시하되 비차단이다.
- 각 leg assurance와 전체 assurance를 저장한다. 전체는 필수 증거 중 가장 낮은 수준이다.
  하나라도 UNVERIFIED이면 완료 불가, OBSERVED가 하나라도 있으면 ATTESTED로 집계하지 않는다.
- OBSERVED 완료를 초기 기능 목표의 충족으로 인정할지는 사람이 **파일럿 전에** 해당 약한 보장과
  정확한 acceptance bundle을 승인해야 한다. 미승인 상태에서는 관측 후보일 뿐 서비스 완료가 아니다.
- 인증형 완료와 관측형 완료는 보고·대시보드·키트에서 구분한다. mock은 두 종류 모두 아니다.

## 6. 잘못된 관측의 오염 범위와 복구

잘못된 target/복사 응답/collector 오결속이 발견되면 그 receipt를 REVOKED_BY_EVIDENCE 이벤트로 무효화한다.
해당 receipt에 의존한 leg·assignment 검증·종합 결과·사람 전달 요약·완료 상태를 의존 그래프로 역추적해
INVALIDATED_PENDING_RECONCILIATION으로 재개방한다. 원본과 옛 완료 기록은 삭제하지 않는다.
관련 queued 작업은 멈추고, 이미 발생한 effect는 미실행으로 초기화하지 않는다. 별도 독립 증거가 있는
다른 가지까지 무조건 무효화하지 않으며, 영향 범위를 알 수 없으면 Task 전체를 격리한다.
사람에게 종전 완료 보고의 정정과 영향 범위·미확인 효과를 알리고, 재승인 없는 blind retry를 금지한다.

## 7. 입장·시험·승격

로컬 입장은 전체 verify 실행 기준선·실패의 명시적 처분, 해당 범위 모델·검수, 무발송 증거가 선행한다.
known failure 등록은 PASS나 위험 수용이 아니다. 변경과 같은 경계를 검사하지 못했거나 source drift가
있으면 입장을 차단하고, 분리 가능한 실패는 범위·담당·재검증 조건을 명시한 검수로만 예외 후보가 된다.
위협 시험 T2-01~06, assurance 약화·오염 회수·중복 의미 한계 시험은 모두 미실행이다.
실제 관측 수집·11역할 연결·왕복은 별도 승인 후 실증하며 현재 send gate와 001 음성을 우회하지 않는다.
후보 기계 단계는 T2-SPEC-REVIEW→T2-ADOPT→T2-LOCAL, 별도 T2-OBSERVATION-FEASIBILITY를 합쳐
T2-PROBE→T2-ROUNDTRIP으로 진행한다. 모든 gate는 미실행이며 기존 strict phase를 열지 않는다.
