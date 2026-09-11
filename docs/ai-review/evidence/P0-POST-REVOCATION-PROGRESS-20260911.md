# 화면 동결 해제 후 릴리스 검사 정리

## 범위와 원본 보존

화면 변경 금지 해제 커밋은 `4d6527afb38c0d2e049a2472c482bc57235d8ca1`이다. 이번 작업은 기록 등록·byte 검사 정합성만 수정하며 제품 기능·DB·기존 실패 판정을 변경하지 않는다.

- byte manifest에서 기존 파일 8개 해시가 오래됐고, Git에 이미 존재하는 산출물 177개의 등록이 빠져 있었다.
- 기존 산출물 전부와 실패 캡처도 함께 등록했다. `present`는 파일 존재·해시 확인이지 검수 PASS가 아니다.
- 캡처 JSON 155개는 `raw-json-evidence-v1`로 원본 JSON·UTF-8·SHA-256을 검사한다. 허용 경로는 식재료·레시피·발주·매출의 기존 P3 visual 하위 JSON뿐이다. baseline·소스·장부를 이 형식으로 우회시키면 실패한다.
- Windows 자동 줄바꿈 때문에 111개 캡처의 작업 파일 bytes가 Git blob과 달랐다. 모든 대상이 **CRLF→LF 이외 차이가 없음**을 먼저 확인한 뒤 작업 파일만 Git 원본 bytes로 정규화했다. 캡처 155개가 기존 HEAD blob과 byte 단위로 같음을 재확인했다. 캡처 Git diff는 0이다.
- `.gitattributes`는 해당 네 캡처 디렉터리 JSON을 `-text`로 고정하여 앞으로 Windows/Linux checkout이 기존 Git blob을 재작성하지 않게 한다. 원본 자체가 CRLF인 파일도 그대로 보존한다.
- `three-surface-sales-capture.mjs`는 파일 끝의 중복 빈 줄 1개만 제거했다.
- byte 검사 변경에 필요한 baseline의 검사기 hash 1개와 byte manifest를 갱신했다. 기존 baseline 실측값·실패 목록·분류·threshold는 그대로다.
- 기존 생성기를 실행한 결과 레지스트리의 README 출처 SHA 한 곳만 갱신됐다. 화면/라우트/state 선언은 바꾸지 않았다.

## 실행 결과

- `node scripts/three-surface-byte-artifacts-check.test.mjs`: **13/13 PASS**. 원본 FAIL→PASS 변조, raw 형식을 baseline에 적용하는 경우, 잘못된 JSON을 차단한다.
- `node scripts/three-surface-byte-artifacts-check.mjs`: **PASS — present 218 / planned 2**.
- 기존 캡처 155개와 HEAD 원본 bytes 비교: **PASS**, 제품·DB 변경 없음.
- `node scripts/three-surface-visual-diff-check.mjs`: 기존 파일럿 **5 screens / responsive 20/20 PASS**. 전체 현 제품 시각검수 완료를 뜻하지 않는다.
- `node scripts/three-surface-sync-check.mjs`: 최초에 dirty baseline 전이와 README 출처 SHA 불일치로 실패. 생성본 SHA 정정 후 commit 경계에서 재검증한다.
- P0 실제 실행은 동결 조건 이후까지 진행했지만 `successorBacklog`의 38건 중복 예외로 종료했다. 아직 전체 CI PASS가 아니다.

## 남은 S4/P0 차이 — 읽기 전용 교차검토

기존 읽기 전용 협업 검토자는 현재 ROOT의 exported 평가 함수를 사용했다. 외부 Fable 검수나 제품 완료 판정이 아니다.

- 현재 S4 raw 211개, 기존 봉인 raw 54개, 문장 일치 43개(기존 backlog 38 + component-transfer 5).
- `evaluateS4Successor`가 `현재 raw 실패가 봉인 source와 다르다`로 실패하면서 raw 전체를 다시 출력한다. P0가 이 결과를 다시 regression에 넣어 이전 backlog 38개와 중복된다. **38개는 신규 제품 결함 수가 아니다.**
- 현재 raw: S3a 파일별 표현식 개수 202개, AST 2개, 전역 occurrence 4개, Button 정규식 2개, Sheet 정규식 1개.
- Button status wrapper와 hitSlop 조건 분기, Sheet footer의 safe-area 소유 분기를 이전 정규식이 인식하지 못한다. 별도 정상·부정 시험으로 검사기를 수정할 필요가 있다.
- AST 줄 번호와 occurrence 이동도 차이를 만들므로 의미 변경과 구별해야 한다.
- S3a 202개를 모두 오탐으로 처리하면 안 된다. 공용 컴포넌트로 이동한 경우와 실제 숫자 스타일 변경이 섞여 있다. 경로별 소유권·현재 토큰·UI 증거를 대조하고 실제 회귀를 수정해야 한다.
- raw/옛 실패를 삭제하거나 중복 검사를 무력화하지 않는다. 새 계약은 이전 Git blob 계보·차집합·독립검수를 유지한다.

## 배포 상태

스테이징 적용·main 병합·운영 배포 없음. 화면 동결 제한은 해제됐지만 다른 검증의 완료를 대체하지 않는다. 유료 검수 비용의 회차별 위험 수용과 배포 성공 기록도 합성하지 않는다.

## 추가 사용자 지시: 실제 CI 실패 조사 및 과거 화면 고정 조건 분리

사용자는 이후 “신 CI도 빠른 검사 디자인수정 조건에서 뺀거 아니야?” 및 “CI의 실제 실패 원인 부터 파악에 조건을 삭제하던가”라고 지시했다. 앞 절의 기록은 당시 상태로 보존한다. 이번 변경은 단순 제품 변경 감지를 없애는 데 그치지 않고 **과거 화면의 AST·표현식 개수·정확한 실패 목록을 현재 제품에도 강제하던 조건**을 필수 CI에서 분리한다. 독립검수·운영 배포를 완료했다는 결정이 아니다.

### 확인한 실제 원인

- 원격 `8ce93c45923ba453125021cb588ead978470b1f2`, run `34567568175`, Node 24 job `103162883579`: `P0 regression과 successor backlog가 38건 중복된다`로 종료했다. 제품 결함 38개가 새로 생겼다는 뜻이 아니다.
- 로컬 독립 명령 13종: 4 통과/9 실패. 원본 출력은 `.codex/recipe-study/release-contract-diagnostic-1789106405494/`에 보존했다. 일부는 같은 원인을 중복 보고한다.
- S4 raw 211개 중 과거 표현식 등장수 202개, 과거 AST 2개, 전역 등장수 4개, Button/Sheet 정규식 3개였다. 의미 있는 현재 품질 조건과 과거 변경 작업의 이력 증명이 섞여 있었다.
- `CandidateOrderForm.tsx`의 오류 글자에 `T.red` 1건이 남아 실제 의미 토큰 규칙에 실패했다. `COLOR.status.negative`로 수정했다. 값은 동일하며 계산·저장·DB 동작은 바꾸지 않았다.
- 기존 verify ③은 첫 실패 즉시 종료했다. 뒤의 터치 목록·네이티브 증거·문서 문제는 실행되지 않아 CI 재시도 때마다 뒤늦게 드러나는 구조였다.

### 변경 내용 및 유지 경계

- `p0-backlog-summary.mjs`: 두 목록에 같은 문장이 있어도 원본을 삭제하지 않고 고유 미해결 수만 중복 없이 집계한다. 변조·형식 검증은 유지한다.
- `design-token-s4-check.mjs --current`: 역사적 AST/등장수/S3a 배정/봉인 raw 대조를 호출하지 않는다. 현재 탭 5개·글자 확대·탭 높이·Button 크기와 status hitSlop·Sheet inset·카테고리 조작·판매 요약 줄바꿈·HubHeader 소유 계약·터치 미달/중첩 조건을 검사한다. current는 과거 Git blob을 로드하지 않으며 실제 current 실패를 backlog로 면제하지 않는다.
- 과거 P0/S4 도구·baseline·raw 실패·successor·검수 원본은 그대로 보존했다. `pnpm verify:design-history`로 명시적으로 감사하며 불일치는 계속 비정상 종료한다. 현 제품 승인으로 취급하지 않는다.
- `verify-contracts.mjs`: 독립된 모든 ③ 검사를 실행하고 마지막에 각 명령의 PASS/FAIL 및 전체 실패 상태를 반환한다. 예외·Bash 부재·실패를 성공으로 바꾸지 않는다. `pnpm verify:contracts`로 DB 시험 재실행 없이 ③ 전체 원인을 조사할 수 있다.
- 동기화·시각/byte·색대비·의미색상·S3d·터치 감사·native 원시자료/영수증·CLI·ACL·문서·보호 CI는 유지한다. 기존 type/core/mobile/DB/경합/업그레이드/번들 단계와 배포 가드는 바꾸지 않았다.
- 검사 분리 때문에 상위 verify 파일의 문자열만 찾던 메타 시험은 실제 호출 관계와 새 검사 모듈을 함께 확인하도록 갱신했다. 시험 자체를 삭제하지 않았다.
- baseline은 검사 코드 hash와 집계 helper 등록만 갱신했다. 기존 실측·실패 목록·threshold는 재작성하지 않았다.

### 확인된 시험과 남은 실패

- 집계 단위 시험 6/6, current S4 정상·회귀 시험 17/17, 전체 명령 실행/실패 보존 시험 4/4 PASS.
- 발주 화면 회귀 24/24 PASS, 색상 토큰 검사 PASS.
- 프로토타입 hash·셸·팀 P3 연결 메타 시험 묶음 22/22 PASS.
- current S4 명령 및 byte 검사 PASS. sync는 baseline commit 경계 이후 다시 확인한다.
- ③ 전체 실행 로그: `.codex/recipe-study/current-contracts-20260911-1511.log`. 실행 중 수정된 해시·메타 시험의 이전 실패 출력도 덮어쓰지 않는다. 수정 후 결과를 구분해서 재실행한다.
- 남은 실패: 현재 버튼 소비처/정적 형제 판정 목록과 옛 터치 목록의 불일치; 제품 변경 뒤 낡은 Android/iOS 터치·iOS 글자 확대 증거; `docs/team/ROLE_CONTEXTS.md`에 필요한 `chat-context-registry:v1` 부재. 실제 네이티브 재측정 없이 productCommit만 바꾸거나 자료를 PASS로 고치지 않는다.

이 변경은 CI 오동작과 과거 화면 고정 조건을 정리한 것이며, 전체 CI 성공·독립검수 완료·운영 배포 완료를 뜻하지 않는다.

## 기기 재연결 뒤 현재 화면 실측 (2026-09-11)

- Android API 35 에뮬레이터와 USB iPhone의 실제 Hermes/Fabric 연결을 복구했다. 사용자가 iPhone 식재료 목록 표시를 확인했다. USB 캡처의 앱 본문 검은 화면 문제는 별도 미해결이며 시각 검수 PASS로 쓰지 않는다.
- 기존 네이티브 계약에는 현재 `알림 설정` 대신 `알림`, 폐기 내역의 제거된 더보기, 통합 HistoryFilterSheet, 레시피의 제거된 Chip/가로 스크롤이 남아 있었다. 공식 원본은 보존하고 `.codex/recipe-study/build-native-current-diagnostic.mjs`로 현재 진단 후보를 만들었다. 아직 전체 정식 계약을 승계한 상태가 아니다.
- 식재료 목록·레시피 목록·옛 폐기 경로의 재고 내역 이동·재고 기간/유형/정렬 각각을 조회/열기만 했다. 저장·입고·차감·폐기·취소·원장 변경은 실행하지 않았다.
- Android 2배율 레시피 필터가 줄바꿈하면서 6dp 상하 hitSlop과 8dp 행 간격이 겹쳐 4dp 중첩을 만들었다. 세로 간격만 공용 hitSlop 두 개 이상으로 보정하고 가로 간격은 유지했다.
- iPhone 1배율 재고 조건 행은 바로 위 부모 높이가 32dp여서 6dp hitSlop이 잘렸다. ConditionRow의 직접 부모에 공용 hitSlop만큼 상하 공간을 확보했다. 외부 행 높이만으로 통과 처리하지 않았다.
- Android 2배율 선택 행은 2.625 density에서 실제 한 물리 픽셀 중첩이 있었다. Android 접근성 bounds도 `[53,1867][1028,2041]`과 `[53,2040][1028,2211]`로 이를 확인했다. 공용 SelectionRow의 마지막 행을 제외한 행 사이에 StyleSheet.hairlineWidth를 두었다. 측정 허용오차를 넓히거나 실패 목록에 면제하지 않았다.
- 수정 후 6개 진단 시나리오/9개 타깃은 Android 2배율·iPhone 1배율 모두 새 미달 0/중첩 0이었다. 원본: `.codex/recipe-study/native-current-android-2x-spacing-20260911.json`, `native-current-ios-1x-spacing-20260911.json`. 이전 실패 산출물도 보존했다. 모두 **DIAGNOSTIC_DIRTY_NOT_EVIDENCE**이므로 정확한 커밋의 공식 네이티브 승인 증거가 아니다.
- 터치 감사 시험 66/66, 목록·조건 행·요약 회귀 31/31, 추가 선택 행 시험 1/1, mobile 타입 검사, 현재 S4, 팀 문서 activation 그래프 PASS. 새 기기 실측 후 전체 게이트는 아직 재실행/완료하지 않았다.
- 팀 레지스트리가 참조하는 기존 `docs/team/MODEL-ACCESS.md`는 미추적 상태였다. 11개 기존 manifest의 깨진 의존을 복구하기 위해 기존 파일 내용을 바꾸지 않고 함께 포함한다. 새 모델/배포 권한을 선언한 것이 아니다.
- 잔여: 다른 네이티브 시나리오·Android 1배율/iPhone 확대·실제 탭 및 글자 증거·정확한 커밋 결속·독립검수·CI·배포. 기존 증거의 productCommit을 바꾸어 대신하지 않는다.
- 전체 mobile 회귀는 110파일, 1,231개 통과/7개 기존 건너뜀(총 1,238개)이었다. 로그: `.codex/recipe-study/mobile-regression-native-fixes-20260911.log`. 검사기 회귀 묶음은 95/95 통과했다.
- ③ 전체 재실행은 완료됐으며 sync(미커밋 경계)와 native touch 원본·영수증·관련 시험, native text 증거가 실패했다. 나머지 현재 품질·문서·CLI·ACL·CI 구조 검사는 통과했다. 로그: `.codex/recipe-study/current-contracts-20260911-1551.log`. 기존 native 증거를 새 실측으로 교체하는 정식 작업이 남았다는 뜻이며 전체 통과가 아니다.
- 별도 읽기 전용 Codex 교차검토는 추가 P1/P2를 발견하지 않았고 신규 의존의 staged 포함을 확인했다. 이는 Fable 독립검수 또는 운영 승인 대체가 아니다.
