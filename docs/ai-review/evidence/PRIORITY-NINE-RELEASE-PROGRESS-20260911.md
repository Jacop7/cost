# 번역 제외 9항목 우선 복구 — 통합 진행

현재 상태: 구현 후보/통합 검수 중, 운영 미배포. 이 기록은 독립검수나 배포 승인을 대신하지 않는다.

## 후속 실행 및 중단점

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
