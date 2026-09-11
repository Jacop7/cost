# P3 후보 검사기 자체 검수

대상: `fb01db7`에서 도입한 읽기 전용 검사기 및 이번 수정.
제품 후보: `7716a078e2d6b1c2e64438eef1cbc1c5c96a42bf`.
범위 결정 초안: `4390d8d`. 문서 자문 PASS는 `c5351d3` 대상이며 이후 3개 Minor 문구를 수정했다.

## 발견 및 수정

- 배치 ID를 배열 위치로 해석하던 결함: 의미별 고정 ID로 비교한다. 결정의 배치 순서 변경에도 같은 판정을 유지한다.
- gate 목록과 entries에서 파일을 함께 제거하면 빠지던 검사: 기준/대상 git delta에서 선정 규칙을 독립 재계산한다.
- 공용 검사에 제품 root, 시험 우선순위, 해시 계약, B5 귀속 검사를 추가했다.

## 실행 증거

`node --test scripts/p3-review-candidate-contract.test.mjs`: 8 PASS, 0 FAIL.
정상 입력, 배치 순서 변경, 두 목록에서 verify.mjs 동시 누락, 국제세금 시험 오배정,
gate의 B1 오배정, root 축소/우선순위 변경, 한 바이트 변조, CRLF/끝개행 훼손을 검사했다.

`node scripts/p3-review-candidate-check.mjs`: candidateValid=true, 485 entries, failures=[];
acceptancePresent=false, baselineWriteAuthorized=false, releaseApproved=false.

## 한계와 다음 단계

현재 도구는 고정 제품 후보와 문서의 정합성만 검사한다. 이후 HEAD 제품 변경의 승인이나
사람 수용 기록의 진위, 전체 기능·DB 시험, P0 승계, 정식 독립검수, CI 통과를 증명하지 않는다.
새 검사기 자체는 기존 485개 manifest에 포함되지 않는 후속 변경이므로 별도 검수 대상이다.
기존 P0 게이트는 계속 실패하며 기준선을 변경하지 않았다.
