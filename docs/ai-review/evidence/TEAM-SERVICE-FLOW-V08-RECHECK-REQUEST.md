# v0.8 전체 재검수 요청 — Cowork 자문

대상: `AI 팀 지식망 스터디·인계`의 기존 Cowork 검수 맥락.
판정 입력은 `TEAM-SERVICE-FLOW-V08-CANDIDATE.json`의 exact working bytes다.
HEAD는 v0.7 `22036fb3f59f7ae66f7d3ce8b1a6eafb7bd18076`이며 v0.8은 아직 미커밋 후보다.
manifest는 대상 파일 집합의 동결용이며 공식 P7 candidate_manifest/typed receipt가 아니다.

## 요청

- 계획·협력형·host 요구·수용 catalog·상태 계약 전체를 읽고 절 간 일관성과 게이트 순환을 재검수한다.
- manifest에 선언된 SHA를 실제 bytes와 대조한다. 불일치/파일 읽기 실패는 REVIEW_INCOMPLETE이며 승인하지 않는다.
- 기존 F-1~F-7을 같은 ID로 재확인한다. 이전 finding에만 한정하지 않고 새 결함을 보고한다.
- 제품 파일 수정·실제 팀 전송·모델 계획 봉인·DB/서버/배포·추가 유료 호출·시험 실행은 하지 않는다.
- 결과는 응답으로 반환한다. PLAN_ACCEPTABLE / CHANGES_REQUIRED / REVIEW_INCOMPLETE와
  계획 확정 차단, 구현 착수 차단, 향후 운영 조건을 구분한다. 이 자문은 typed formal gate가 아니다.

## Codex 반영 응답 — 검수 결론이 아님

| ID | 반영/남은 일 |
| --- | --- |
| F-1 | CURRENT에 사람 결정 3건(담당·입력·기한 gate·미결정 기본값) 등록. scope003 사전 선언만 생성. 채택·발송·scope 결과 미생성 |
| F-2 | 모든 AC/BF case의 구현/실행 2축. workflow 파일에도 정확한 AC 시험명/필수 assertion 표식이 없어 24개 모두 NOT_IMPLEMENTED. 소스 준비 검사는 실행 증거가 아님 |
| F-3 | AC24 ADMISSION/FIX_BUNDLE/STORE_DRIVER 각각의 exact bundle·closure·allowlist·시나리오·영수증 계약. entry allowlist는 PLAN_TEST 산출물로 AC22/P4와 독립. 실제 runs=[] |
| F-4 | 기존 활성이라고 단정한 표기 수정. 미추적 파일 hash만 목록화하고 복구 bytes 보존 gate OPEN. 승인 없는 일괄 Git 추가/활성화 없음 |
| F-5 | 현재 HOST-REQUIREMENTS.md SHA를 CURRENT에 추가. 과거 scope002 기록 불변 |
| F-6 | OPEN. 새 HEAD verify는 아직 미실행. 기존 실패 기록을 승격하지 않음 |
| F-7 | Cowork 자문과 P7 Fable 기본 typed 검수/회차 soft-cap 승인 구분 |

명세 검사 36/36(실제 stdout·입력 hash·전후 동일성 별도 JSON).
서비스 AC 실행 0, scope003 조사 0, 제품 구현 0, 팀 발송 0, 전체 verify 재실행 0.

## 특히 확인할 경계

1. AVAILABLE은 파일/정확한 이름/필수 assertion 소스 표식만 확인하는 정적 준비 상태다.
   빈 test·주석·수동 PASS가 런타임 완료를 충족하지 못하는 별도 실행 계약이 유지되는지.
2. LC-ADMISSION용 시나리오가 기존 workflow reducer에서 실제로 시작할 수 있으면서도
   전체 import closure·금지 capability·음성 fixture를 빼고 공허하게 통과할 수 없는지.
3. scope003의 rollout 기록은 협력형 OBSERVED 후보 조사일 뿐이다. nested functions.exec,
   응답 잘림, target/call/result 결속 실패를 성공으로 오인하지 않는지. 원시 대화/endpoint 수출 금지.
4. 미결정 사람 항목, 미추적 복구 bytes, 정확한 모델 범위, 새 verify, AC24 실행은
   여전히 별도 게이트다. 계획에 경로를 정의한 것과 그 경로가 실행 가능해진 것을 구분할 것.
