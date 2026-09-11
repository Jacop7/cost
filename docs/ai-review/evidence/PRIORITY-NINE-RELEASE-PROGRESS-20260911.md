# 번역 제외 9항목 우선 복구 — 통합 진행

현재 상태: 구현 후보/통합 검수 중, 운영 미배포. 이 기록은 독립검수나 배포 승인을 대신하지 않는다.

## 후속 실행 및 중단점

### 2026-09-11 운영 우선 처리 — 기기 증빙 비차단 분리

- 기기 증빙을 직접 읽어 현재판본 PASS를 요구하던5개 통합 단언도 독립 integration 파일로 이동해 동일 비차단 job에서 실행한다. 원시frame/위조 탐지/기기 판별/확대 검사기 자체의 단위시험은 계속 필수이며26/26 PASS. 통합 단언을 삭제하거나 무조건 통과로 바꾸지 않았다.
- 소스 터치 재고에 be51c39의 매출 SortChip 부모 보완 이후 줄번호+2가 반영되지 않은 것도 발견했다. diff로 같은 소비처의 이동과 해소된 형제판정불가1건만 대조한 뒤 공식 생성기로 목록을 갱신했다. 현재 소스 검사 PASS, 선언상 미달0/형제중첩0. 판정불가를 실제 터치 PASS로 승격한 것은 아니다.

- 사용자의 운영 우선 처리·CI 조건 정리 요청에 따라 기기 캡처/영수증/글자 확대 증빙 3종만 배포 비차단 후속 검수로 분리했다. 실제 검사와 실패 로그는 유지하고 `ADVISORY_FAIL`로 표시한다. 별도 CI job은 비차단이며 엄격한 전용 명령은 실패 시 exit1을 반환한다. 접근성 검수 PASS나 독립검수 완료를 의미하지 않는다.
- 타입·DB/앱/core시험·ACL·배포 가드·터치 소스 검사·대비·네이티브 검사기 회귀·전체 DB·업그레이드·웹 번들 및 exact-SHA 보호 조건은 유지했다. 관련 분리 회귀와 현재 native 계약 회귀13/13, CI 계약 검사, protected validator18/18 PASS. 실제 새 후보 CI 및 배포 결과는 아직 없다.
- 이전08de42c CI는 전체6단계 중1/2/4/5/6 PASS,3기기 증빙 FAIL로 완료됐다. 실행 중으로 반복 대기하지 않는다. 스테이징/운영은 읽기 전용 migration 목록상0191까지이며0192~0205 14개 미적용이다.
- iPhone2.143배 실제 캡처에서136개 같은 문구 중130개가 비례 확대됐고, native크기232쌍 중168쌍 변경을 측정했다. 물리 좌표 터치와 정식 기기 identity 증빙은 미완료다. 임시 글자 크기는 원래1배로 복원했다.
- 확대 상태의 부자재 사용량 버튼은 고정y1700 스크롤이 버튼을 화면 위로 지나쳐 관측에서 제외시키는 검사기 문제였다. 실제 target/content/viewport 좌표를 이용한 중앙 스크롤로 변경했으며 필수 버튼 관측과44dp 조건은 삭제하지 않았다. 관련 회귀 PASS, 새 코드의 실제 기기 재측정은 후속 사항이다. 권장 판매가의 미래 세금 활성 fixture 문제도 원래 실패로 보존한다.

### 최신 델타 — 2026-09-11 현재 화면 검사 계약 정비

- b8d8e38의 Android/iOS 기본 배율 전체 실행은 앞 12시나리오를 탐색한 뒤 활성 전 세금 fixture의 권장 판매가 버튼 부재에서 실패했다. 기존 검사기가 첫 예외에서 앞선 측정까지 파일로 남기지 않는 문제를 확인해, 시나리오별 원시 phase/실패 사유를 보존하고 뒤 시나리오를 계속 수집하도록 수정했다. 실패는 재계산 시에도 반드시 FAIL로 남는다. 관련 39회귀 PASS. 이 실패 실행에서 최종 원본 파일이 생성됐다고 기록하지 않는다.
- 현재 화면의 13시나리오·30개 소스 연결로 측정 계약을 갱신했다. 폐기 내역의 재고 내역 전환, 재고 필터 3종, 카테고리 위/아래 이동, 부자재 사용량 팝업, 매출 동작을 포함한다. 낡은 줄 번호도 현재 실제 컨트롤 선언으로 대조했다. 44dp·Android/iOS 기본/확대 4칸·iOS 2배 이상·확대 레이아웃 증명 30% 조건을 유지하며, 아직 측정하지 못한 권장 판매가 적용 버튼도 필수로 유지한다. 관련 회귀 12/12 PASS.
- `d40b549`에서 Android ADB 물리 탭 3점(유효 영역 안 1회, 직접 부모 밖 0회, overflow-visible 조상 밖 1회)이 통과했다. 원본은 `.codex/recipe-study/native-touch-android-tap-probe-d40b549.json`이며, 이후 변경된 검사 계약의 최종 증거로 재표기하지 않는다.
- 같은 SHA의 원격 Node 24 검사는 오래된 native 원본/영수증으로 실패했고 전체 DB job은 확인 당시 실행 중이다. 이전 job 취소가 반복되지 않도록 진행 중인 검증 도중 추가 push를 보류한다. iOS 접근성 audit 서비스는 응답하지만 글자 크기 설정 inspector는 응답하지 않는다. iOS 확대·물리 탭이나 독립검수·배포가 완료된 상태가 아니다.

### 최신 델타 — 2026-09-11 Android 기본 배율 및 측정 연결 복구

- be51c39 제품에서 Android1배의 현재6개·관리4개·레시피/매출2개 진단을 추가 실행해 타깃26개, 미달0/중첩0을 확인했다. `.codex/recipe-study/native-{current,management,forms}-android-1x-be51c39.json` 원본을 보존했다. 기존 Android2/iOS1과 합쳐도 정식4칸 완료는 아니다.
- 응답 없는 과거/배경 Inspector page가 먼저 나올 때 전체 측정이 중단되는 원인을 수정했다. page별 연결/평가 timeout을 닫고 다음 page를 실제 React root·플랫폼으로 검증한다. 이름만 보고 플랫폼을 인정하거나 실패를 PASS로 바꾸지 않는다. 5회귀와 관련 재파생/검사 실행기6회귀, 총11/11 PASS. 새 시험을 verify③에 연결했다.
- iOS 실제 fontScale은 재확인 시1이다. USB 접근성 inspector는 연결 경고 뒤 응답하지 않아 해당 진단 프로세스만 중단했고 기존 USB tunnel은 유지했다. iPhone 확대/물리탭을 완료한 것으로 기록하지 않는다.
- 현재 제품 범위의 정식 Fable soft-budget 위험수용 pin은 확인되지 않았다. 별도 비용 승인을 만들어 넣거나 미실행 검수를 완료로 표시하지 않는다. main·원격 배포는 미실행이다.

### 최신 델타 — 2026-09-11 16:07 KST 로컬 DB 연결 복구·네이티브 추가 진단

- 실제 기기가 연결된 로컬 `supabase_db_margincook`은 0201까지만 적용돼 레시피 수정이 `edit_revision` 누락으로 차단됐다. CLI 2.116.0의 `db push --local --dry-run`으로 pending 0202~0205 정확히 4개를 확인했다. 2,089,479바이트 custom-format 백업(TOC 1,926행)을 보존한 뒤 `migration up --local`로 4개 적용 성공. 원격 스테이징·운영에는 적용하지 않았다. 백업 SHA-256: `329d151d9c829b42789c3bc49f6f0f6a3e1a09cf47f726be5d385b89068bead6`.
- 적용 전후 `inventory_events` 865행/MD5 `afb5b832b5d556a06304a4884562f02d`, `inventory_states` 19행/MD5 `9bf8b554a31d348eefb869ea9e31eddc`가 각각 일치한다. 재고·원장 삭제/리셋/보정 없음.
- 현재 기기에서 레시피 수정 정보·부자재 사용량 팝업이 열리는 것을 확인했다. 매출 정렬 칩의 iOS 직접 부모가 hitSlop 윗부분을 자르는 문제를 재현하고 공용 토큰 높이의 부모 padding으로 수정했다. `salesHomeParity.test.tsx` 12/12 및 mobile typecheck PASS.
- Android 2배/iOS 1배에서 레시피 부자재 행·팝업, 매출 정렬·수량·판매 진입 버튼의 8개 필수 타깃 진단은 모두 미달0/중첩0. 실제 저장·판매는 실행하지 않았다. `.codex/recipe-study/native-forms-actions-{android,ios}-v1-20260911.json`은 진단 자료이며 정식 4칸 증거가 아니다.
- 로컬 매장의 세금 활성 경계/시장 프로필은 **2026-09-12**, 서버 매장 날짜는 **2026-09-11**이다. 현재 손익 미리보기의 `not_active` 안내는 이 날짜 조건 때문이며 DB 함수 누락과 구분한다. 실제 활성일이나 기기/서버 시계를 바꾸지 않았다. 활성 매장 조건의 기기 검증은 아직 남는다.
- 과거 Expo export `apps/mobile/dist-ingredient-parallel/`은 제품 import/실행 경로에 참조되지 않고 기록에서도 빌드 산출물로 확인됐다. 내용은 보존하고 정확한 폴더만 gitignore에 추가해 텍스트 측정을 재개했다. 변경 전 제품 SHA cdfd7e5의 iOS 1배 Text136개 캡처 성공. 이후 매출 UI 수정이 있으므로 이 캡처를 새 제품 SHA의 최종 증거로 쓰지 않는다.
- cdfd7e5 원격 빠른 CI 2개는 옛 네이티브 원시 자료의 productCommit 불일치로 ③ 실패. 전체 DB job은 마지막 확인 시 실행 중. 네이티브 공식 계약/확대·탭·텍스트 전체 증거, 독립검수, 같은 SHA CI, main 및 배포는 미완료다.

### 최신 델타 — 2026-09-11 13:56 KST 원격 전체 검증 종료

정확한 후보 `fe335fbe6e9f8653412718bab8f25877b0f7ba10`의 GitHub run34562638433/job103148505039 원문 로그를 ROOT가 조회했다. ①타입/②시험3종/④새 DB 전체/⑤업그레이드/⑥웹번들은 통과,③은 기존 P0 제품 화면 변경 금지로 실패했다. 업그레이드24/24 통과(371.8초). 전체6/6통과나 protected-gate 성공은 아니며 운영 미배포다. ③은 조기 차단됐으므로 그 뒤 모든 하위 검사까지 통과한 것으로 세지 않는다.

로컬 session68585는 30분 제한으로 ETIMEDOUT 종료했다. 원본 full-verify-r2 결과/stdout/stderr 보존. 로컬 upgrade는19번까지 ok,20번 진행 중 잘렸으며24/24로 세지 않는다. 조회 시 bash 자식0, 격리 DB client session0, 해당fresh_upgrade DB0임을 확인했다. 공식 실행기의 임시DB 정리이며 ROOT가 기존k/j·실패컨테이너/볼륨·원장을 삭제한 것이 아니다. 별도 DB 검증을 중복 재시작하지 않는다. P3/독립검수 준비를 우선하고 이후 동결 후보 전체검증에서 충분한 timeout·실시간 로그를 사용한다.

### 최신 델타 — 2026-09-11 DB 생성 타입 통합

ROOT 전체 mobile 시험:109개 파일 통과,1229시험 통과/7생략(13:32 실행,33.38초),exit0. 생략7개를 통과 수에 포함하지 않는다.

신규 레시피 RPC3개와0204 receipt/edit_revision을 격리 검증 DB의 공식 postgres-meta 생성 타입으로 통합했다. 임시 pendingRecipeDatabase overlay 제거 및 mobile typecheck PASS. 생성 출력 SHA `7d640926e2755b096d4312b3d7925ae33f427d6b958bb6b312f8cccd520f6454`; 상세 provenance는 coordinator 최신 절과 type-generation-path-v2/render-recovery-once/result.json에 있다. 카탈로그 출력의 여러 줄 JSON 파싱 오류를5회귀로 수정하고 기존 성공 캡처를 재사용해 복구 시 DB조회0회다.

전체verify/업그레이드는 기존session68585로 진행 중이다. 실행 중 타입 통합이 있었으므로 이 실행을 새 최종SHA의6/6승인 증거로 쓰지 않는다. 운영 미배포, P3 공식 승계/정식독립검수/동일SHA보호CI/배포가드 조건은 유지한다.

### 최신 재개 결과 — 2026-09-11 13:15 KST

아래 과거 실패/중단 기록은 보존한다. 현재 재부팅 중단이나 DB 실행 lease는 없다.

- 정식 `20260911000205_recipe_draft_preview.sql` 및 DB62를 통합했다. 새 DB `fresh_recipe_draft_quote_20260911k`는 고정 CID `2887f3f0d0027b37a10f08bbc8c5f461cc702cf4ce447eddf882cec519dd402f`, network none/호스트 포트 없음인 합성 전용 환경이다. 기존 개발/운영 재고·원장에는 적용하지 않았다.
- 194개 정식 migration와 seed PASS. DB suite 첫 실행은63/64 PASS였으며 DB34의 구형 facade78/비공개 helper목록이 실패했다. 실제 권한 경계를80개 facade와 신규 내부 helper로 갱신하고 새 디렉터리에 재실행해 **64/64 및 ACL 감사 PASS**. `full-review-v1/execution-r2/result.json`은 suite/acl 각각exit0을 기록한다. 원래 실패 실행과 DB/볼륨은 보존했다.
- ACL의 허용 범위를 넓혀 오류를 숨기지 않았다. 신규 facade2개의 정확한 owner/search_path/execute 및 비공개 내부함수의 앱 실행 차단을 확인했다. 기존0204 invoker helper3개는 정확한 목록으로 제한하고 앱 실행은 계속 차단한다. Windows Git Bash의 admin-acl 셸 보안 시험도exit0이다.
- ROOT가 레시피20시험267/267, core 최소가 관련57/57을 재실행했다. SQL↔core 동일입력44사례도 실제 DB에서44/44일치했다(`.codex/ingredient-44-study/international-price-parity-20260911/root-execution/result.json`). 큰 가격의 core `precision_unavailable`과 SQL exact ready 차이는 명시적 기대값으로 분리했다. 이 검산은 tax kernel/search 비교이며 facade권한·profile통합은 DB62가 별도 검증한다.
- 추가 live DB locale/international core13시험 PASS. `verify --no-db` 재실행은①타입/②core·mobile/⑥웹 번들PASS,③기존P0 제품 변경 금지FAIL,④⑤생략이다. 따라서 전체6/6통과나 운영 준비 완료가 아니다.
- 오래된 P3 manifest가 최신HEAD/미커밋 제품변경을 포함한다고 오판하지 않도록 read-only coverage guard를 추가했다.9회귀PASS, 실제 구형manifest에대해서는 의도대로FAIL이다. 기준선 재작성/승인/게이트 우회를 하지 않았다.
- `fable:check` 연결/로그인 정상. 정식독립검수는 미실행이며, 현재 후보의 회차별 soft-budget 위험수용 pin 없이 유료호출을 하지 않는다.
- 기존 공식2세션 경합시험도 같은 합성DB k에서1회실행해exit0이다. 실제A/B잠금대기·자동브레이크·자동마감·마감후쓰기차단·최종원장합계까지확인했다(`full-review-v1/concurrency-execution/result.json`). 시험변경은 합성seed에만 남겨보존했다. 개발/운영DB에는실행하지않았다.

현재 남은 조건: DB 타입 재생성, 업그레이드/전체verify6/6, 실제 화면/네이티브 검증, 정확한 현재 후보의 P3 범위·증거 승계와 정식독립검수, 동일SHA보호CI, 배포가드/배포후점검. 영어번역은 제외한다. 앱배포대상을 다시 선택해달라는 질문은 사용자의 정정으로 철회했다. 기존 서비스 운영 환경 반영이며 신규 스토어/웹 배포를 만들지 않는다. 공식 production 영수증의 `smxaozdgoxbafjldoayb`를 현재 CLI 링크와 대조해야 한다. EAS에는development프로필만있으며DB배포영수증을앱운영배포증거로쓰지않는다.

- 사용자 최신 확인: 재부팅은 완료됐으며 번역 제외 우선 기능의 운영 배포까지 자동 재개를 요청했다. 과거 재부팅 중단은 해제했다. 기존 레시피 작업에 v3 시험 수정/재동결을 다시 배정했고, 5분 후속은 현재 단계와 배포 후 점검 완료를 종료 조건으로 갱신했다. 검사/승인 생략을 허가한 것은 아니다.
- 후속 커밋 `4366d2c` 푸시: 추가지출 Sheet 내부 오류 안내와 저장 중 입력 잠금. 내부 교차검수 F1/F2 해소, ROOT/검수자 각14/14 시험 PASS 및 ROOT mobile typecheck PASS. `.codex/ingredient-44-study/SALES-EXPENSE-CROSS-REVIEW-16f9bcd-20260911.md` 원 지적을 보존했다. 정식 Fable 검수는 아님.
- v3는 CRLF 보완 후에도 고정 이미지에 runuser가 없어 DB 기동 전 실패했다. 새 v4는 이미지에 있는 절대 su-exec 사용/종료 상태 즉시 로그 수집을 추가했고 ROOT 12회귀 PASS 후 실행했다. v4 plan `22d42ba995422e24cbe129a00bacc8e490b703f908bdcf5bbe1035f6844abf83`, CID `2c0c78a19d2b7e752268b1e0b8c36f0aaabb19e1f6fee93e8c6a494cf6bf5d6d`, DB `fresh_recipe_draft_quote_20260911j`. 193 migration·seed·후보 SQL 적용 PASS, 후보시험은 KR 저장 fixture 가격12.34 자릿수 위반으로 실패했다. 원인과 수정시험을 레시피 담당에게 배정했다. DB/실패로그 보존, 원래 실행 자동 재시도 없음. 개발/운영 DB 영향 없음.
- 추가 ACL 정적 발견: 기존0203 및 신규 facade의 pg_catalog,public 경로가 감사의 public,pg_temp 정확계약과 다르다. 새 공개 RPC2/내부 postgres helper1도 DB16/ACL 목록 통합 필요. 검사 수치만 완화하지 않고 실제 함수 경계를 검증해야 한다.

- 안전재고 연결 묶음은 `18ab6f5`로 푸시했다. 해당 SHA의 GitHub verify run `34559524899`는 조회 시 실행 중이었다(최종 결과 미확인).
- 추가 지출 오류금액4종·종료일 삭제를 보강해 관련 시험은 최종12/12 PASS. 추가5시험은 아직 미커밋이다.
- 레시피 v2 원본로그에서267 PASS를 확인했고, ROOT도 순수 최소가 검산6시험을 실행해 PASS했다.
- ROOT 단독 격리 실행 plan `ab68d1e216d2a2a3a88a608470de0536e0399c01e33549ace103535b7744c079`은 컨테이너 시작에서 실패했다. exact container `221760c2be46cfc670967d5bb490658faa291e465e7931936520171bc749fcf8`, 원인은 `/bin/sh`에 전달된 CRLF의 `set -eu` 파싱 오류다. DB 생성/SQL 적용 전 실패했고 종료 컨테이너·전용 볼륨·증거를 보존했다. 현재 DB 실행 lease 없음.
- v3는 새 대상과 LF 정규화를 준비했지만 ROOT의 `init-newline-test.py` 재실행에서 Git sh 원시CRLF가 반드시 실패한다는 시험1개가 실패했다. 컨테이너 실패와 Windows Git sh 동작을 같다고 볼 수 없다. 실행 전달bytes·정규화해시 회귀로 보완하도록 요청했으며 v3 실행은 하지 않았다.
- 레시피 담당은 별도 작업에서 새 사용자 재부팅 요청을 받아 중단했다고 보고했다. `.codex/recipe-study/REBOOT-RESUME-20260911.md`에 v3 시험 수정/재동결이 다음 행동으로 저장됐다. 자동으로 중단을 덮어써 실행하지 않는다.
- Claude 기존 게이트 채팅에 현재SHA 자문을 요청해 회신을 읽었다. 오래된 manifest를 현재승인으로 쓰지 말라는 지적은 타당하다. 다만 미추적 신규RPC 누락 및 별도worktree 제안은 권위루트 규칙과 달라 정정 요청했다. 자문을 정식 Fable 검수나 사용자 exact-SHA 수용으로 승격하지 않는다.

## ROOT 직접 확인

- 추가 지출 상세 추가창·판본 충돌·종료 영업일 정정 경로: `salesExpenseConfirm.test.tsx` 7/7 PASS. 커밋 `16f9bcd`, 기능 브랜치 푸시 완료.
- ROOT 관련 회귀 재실행: 추가 지출7 + 부족 목록11 + 식재료 폼 충돌13 = 31/31 PASS. 존재하지 않는 salesPastEditScreen 시험 이름도 명령에 있었으므로 해당 화면 시험을 실행했다고 세지 않는다.
- mobile typecheck exit0. 신규 레시피 읽기 RPC 두 개는 임시 공용 타입 선언으로 통합했다. DB 타입 생성/실제 서버 설치 증거는 아니다.
- AppMap model15/15, samples15/15 PASS. 추가 지출 팝업은 상세 경로에서 열고, 새 읽기 RPC는 응답을 보존하며 샘플 쓰기 차단을 유지한다.
- Edge `localhost:8091/sales/expense?date=2026-09-07`에서 추가 버튼 활성·입력창 열림을 확인했다. 입력/저장/삭제하지 않았다. 당일 장부 미시작 상태는 버튼 비활성이다.
- Edge `/ingredients?stock=below-safety`에서 안전재고 안내와 고춧가루978g/안전1kg 항목을 확인했다. 레시피 탭을 거쳐 식재료 탭에 재진입하면 `/ingredients`로 바뀌고 필터 안내가 사라졌다. 실제 원장 값의 정확성을 별도 DB 감사한 것은 아니다.
- `verify --no-db`: 타입/시험(core·mobile)/웹 번들 통과,③ 실패, exit1. DB·업그레이드는 생략했다. P0 제품 변경 금지 검사 실패를 유지한다.
- 화면 동기화 PASS(65/55/185), 기존 시각 증거 검사 PASS(5화면); 현 후보 전체 시각검수 완료 아님. byte-artifacts 검사는 해시 불일치·미등록 산출물로 실패한다.
- `fable:check`는 설치/인증 정상만 확인했으며 독립검수 실행이 아니다.

## 남은 필수 조건

레시피 최소 권장가 SQL 자체검수/격리 DB 실행,0202~0204 실제 계약 검증,공용 ACL/DB회귀 통합,변경분 독립검수,정식 P3 승계와 산출물 byte 결속,동일 SHA 전체 CI,환경 배포 가드가 남는다. 공유 DB에 fresh migration을 재생하는 제안은 전역 role 영향 때문에 거부하고 별도 컨테이너 계획으로 수정 요청했다. 기존 데이터/실패 증거는 삭제하지 않았다.

식재료 제출은 `.codex/ingredient-44-study/ingredient-connection-result-20260911.json`, 레시피 후보는 `.codex/recipe-study/draft-preview-resume-v1-20260911/`를 참조한다. 후속 레시피 수정은 새 입력 해시로 검증해야 한다.
