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
