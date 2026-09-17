# 앱 전체 기능 정밀 검증 — 2026-09-09

**판정: 전체 정상 아님. 재현된 제품 결함 13건, 미구현 기능과 검증 게이트 실패가 있다. 제품 소스 수정·배포는 하지 않았다.**

감사 기준: 현재 작업 트리(기존 사용자 변경 포함), HEAD `634dc4055a600db9505f9db1614849c00df007a8`. 브랜치 `codex/ai-team-knowledge-orchestration-plans`. [시작 상태](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/initial-status.txt>) 및 [소스 SHA-256](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/source-hashes.json>)로 범위를 고정했다. 검사 시각 2026-09-08T23:22:07.103Z.

## 범위와 해석

5개 탭 전부와 공통 기능을 대상으로 공식 인벤토리 65개 행, 화면·시트 모듈 55개, 레이아웃 제외 라우트 53개, 앱에서 호출하는 고유 RPC 73개를 조사했다. 모든 화면의 핸들러·조회·저장·오류 처리 연결을 소스로 검토하고, 자동 시험 및 실제 새 DB 검증을 결합했다.

**이 보고서의 ‘확인’은 모든 버튼을 실기기에서 눌러 저장까지 성공했다는 뜻이 아니다.** 화면 시험은 react-native-web/jsdom의 기본 상태와 선택한 입력·복구·캐시 시나리오다. 55개 모듈 × 3상태(정상 응답, 전체 조회 실패, 영업일 조회만 성공)는 기본 렌더링 검사이며, 정상 응답은 새 DB에서 캡처한 실제 RPC 결과를 전송 계층에 주입했다. 라우터·네이티브 모듈은 모의 처리했고 요청 인자별 응답 및 모든 조건 조합을 E2E로 검증하지는 않았다. 시트와 create/edit·기간·국가별 분기는 아래 근거와 미검증 범위를 함께 읽어야 한다.

기존 모바일 시험이 화면 파일을 직접 import한 것은 11/55개였다. 이는 구조상 연결 지표이며 코드 커버리지 비율이 아니다. [전체 연결 인벤토리](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/inventory.json>)와 [전체 화면 로직 추적](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/screen-review-extract.txt>)를 보존했다.

## 실행 결과

| 검사 | 결과 | 근거/의미 |
|---|---|---|
| 타입 | 통과 | verify ①, types/core/mobile tsc |
| 기존 core 시험 | 194 통과 · DB 연동 12 기본 실행 건너뜀 | [별도 실행 로그](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/core-mobile.log>) |
| 기존 모바일 시험 | 28파일 · 233 통과 | 별도 재실행 완료 |
| 기본 로컬 DB | 30/50 SQL 파일 통과 · 20 실패 | 기존 개발 DB와 최신 소스 스키마 불일치. 전체 verify ② 실패 |
| 새 DB 전체 migration + SQL | 50/50 SQL 파일 통과 | 기존 DB를 리셋하지 않고 일회용 새 DB에서 확인 |
| 새 DB ACL/2세션 경합 | 통과 | 판매↔마감/브레이크 경합, 앱 ACL 검사 |
| 실제 DB locale/국제 세금 parity | 2파일 · 13 통과 | verify ④에서 별도 DB 연결 실행, core 기본 실행의 skip과 구분 |
| 보완 RPC 조회 | 36/36 통과 | authenticated+시드 JWT, 실제 서버 함수 호출. [결과](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/rpc-read-results.json>) |
| 보완 저장 RPC | 18개 단언 통과 | 구매처·구매옵션·부자재·카테고리·발주취소·채널, 트랜잭션 rollback. [실행 로그](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/supplement.log>) |
| 추가 화면/회귀 시험 | 169 통과 · 14 실패 | [구조화 결과](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/audit-tests.json>) / [로그](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/audit-tests.log>) |
| 필수 게이트 ③ | 실패 | 팀 서비스 계약 38/39, export 목록 불일치. 뒤에서 중단된13개 명령 별도 실행:12통과·색 대비 출처 게이트1실패 |
| ⑤ 업그레이드 / ⑥ 웹 번들 | 아래 최종 원문 참조 | [전체 verify 로그](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/verify.log>) |

```text
════ 검증 결과 ════
  ok     ① 타입 (pnpm -r typecheck)  (7.0s)
  FAIL   ② 시험 (pnpm -r test)  (16.6s)
  FAIL   ③ CLI 계약 · ACL 보안 · 색 대비 · 문서 그래프  (2.9s)
  ok     ④ 새 DB (마이그레이션 전체 + 시험)  (129.3s)
  ok     ⑤ 업그레이드 경로  (1694.9s)
  ok     ⑥ 웹 번들 (Metro export)  (10.1s)

검증 실패 2건
 ELIFECYCLE  Command failed with exit code 1.
```

기본 개발 DB의 migration 이력 최댓값은 `20260830000175`이고 작업 트리에는 `20260904000192`까지 존재한다(dev-db-version.txt). app_capabilities·국제 세금·운영 감시 관련 스키마/함수 및 ACL 계약이 최신 코드와 맞지 않았다. 새 DB에서 동일 SQL 50개는 모두 통과했으므로 이 20개를 모두 제품 결함으로 세지 않았다. 동시에 현재 개발 DB와 연결한 앱의 정상 동작을 이 결과로 보증할 수 없다.

게이트 ③의 P3-SPEC-05는 공개 export가 3개라는 시험 기대와 현재 7개 구현의 불일치다. 색 대비26쌍의 수치 검사는 통과했지만 결정 commit 3개가 현재 HEAD 조상이 아니어서 출처 게이트가 실패했다. 이 두 실패는 앱 화면의 기능 결함과 별도로 관리한다.

## 업무 시나리오별 판정

| 시나리오 | 검증 결과 | 근거와 제한 |
|---|---|---|
| 식재료 등록·수정·최소단위·단가 | DB 작성 경로/환산 통과 | SQL08·14·15, 화면 기본 상태. 구매 금액 소수 입력 APP-AUDIT-11 |
| 발주→부분입고→중복입고→취소 | DB 전파/멱등성 통과 | SQL02·03·08·15 및 보완 E12 시험. 외부 구매 사이트 주문은 미실행 |
| 폐기→삭제/되돌리기 | DB 원장·7일 제한 통과 | SQL05·19. 과거 폐기 금액 표시 APP-AUDIT-13 |
| 실사·수량 조정·음수 재고 | DB 음수 원장 통과, UI 결함 | SQL04·19. 실제 화면 조정 APP-AUDIT-01 |
| 레시피·부자재·인분 환산·원가 | DB 계산/전파 통과, UI 결함 | SQL01·08·24·48. APP-AUDIT-05·06 |
| 판매·수량 감소·취소·재호출 | DB 원장·경합·전파 통과 | SQL06·20·21·22·49 및 2세션 경합. 갱신 APP-AUDIT-08 |
| 마감·자동 브레이크·야간 영업 | 로컬 DB 및 기존 UI 시험 통과 | SQL09·23·25·26·30, myHours/businessDayBar 시험. 원격 Cron 실행 상태는 미검증 |
| 과거 매출 정정·원판매 스냅샷 | DB 판본/경합/취소 통과, 표시 결함 | SQL12·22·27·28·49. APP-AUDIT-02·07·12 |
| 국가·세금·언어·설정 | DB 공식/권한 통과, UI 결함·미구현 | SQL31~50·locale parity, settings/intl UI 시험. APP-AUDIT-03·04·11, 실제 번역 미구현 |
| 카테고리·구매처·판매채널 관리 | 보완 RPC 쓰기/보존 통과, 캐시 결함 | APP-AUDIT-09·10. 채널 비중·단위·필터 선택 추가 시험 통과 |
| 계정 삭제·원장 보존 | DB/기존 UI 시험 통과 | SQL33·34 및 myAccount 시험. 실제 계정 종단 삭제 미실행, 로그인/가입 미구현 |
| 알림 설정·실제 발송 | 설정 시험/소스 확인, 발송 미구현 | MyNotificationsScreen의 서버 작업 연결 대기 문구 |

## 재현된 제품 결함 13건

### APP-AUDIT-01 · P1 · 재고 조정이 음수 결과를 0으로 바꾼다

- 위치: [StockEditSheet.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/StockEditSheet.tsx:135>)
- 재현: 현재 재고 −500g → 수량 조정 ‘추가’ 0.2kg → 저장.
- 기대: −300g을 E5 목표 재고로 전달.
- 실제: onApply에 nextStock: 0을 전달. 입력한 200g보다 300g 더 늘어난 목표값이다.
- 영향: 실사 보정이 사용자가 입력한 증감량과 다르게 기록된다. 음수 재고를 숨기지 않는 불변식에 위배된다.
- 수정 방향: 조정값의 0 하한을 제거하고 음수 결과를 표시·저장한다. 폐기 후 표시의 Math.max도 실제 서버 결과와 대조한다.
- 근거: stock-regression.test.tsx ([실패 원문](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/audit-tests.log>))

### APP-AUDIT-02 · P1 · 메뉴 손익 화면이 서버 순이익을 버리고 세금을 다시 차감한다

- 위치: [SalesMenuDetailScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesMenuDetailScreen.tsx:106>)
- 재현: 세금 별도 메뉴: 세전 판매가 100, 재료비 20, 세금 10, 서버 profit 80인 하루 응답을 표시.
- 기대: 서버가 확정한 순이익 80 표시. 고객에게 별도로 받는 세금은 세전 매출에서 다시 빼지 않는다.
- 실제: 화면은 price-material-extra-tax-fixed를 계산해 70원 표시. 테스트에서 70원은 존재하고 80원은 없다.
- 영향: 국제 세금 활성 이후 세금 별도 메뉴의 과거/기간 손익을 과소 표시한다.
- 수정 방향: 하루 profit과 기간의 서버 확정 손익을 사용하고 net sales/customer total/tax의 표시 기준을 맞춘다.
- 근거: functional-regressions.test.tsx ([실패 원문](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/audit-tests.log>))

### APP-AUDIT-03 · P1 · 국가·국제 세금 편집이 오래된 입력을 새 판본으로 덮어쓴다

- 위치: [MyCountryScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyCountryScreen.tsx:28>), [MyTaxScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyTaxScreen.tsx:48>)
- 재현: 판본1을 화면 초안에 로드 → 다른 기기의 변경으로 조회 데이터가 판본2로 갱신 → 저장. 국가 가격 기준과 국제 세율을 각각 시험.
- 기대: 초안과 함께 보존한 기준 판본1로 충돌을 검출하거나, 명시적으로 판본2 초안을 채택한다.
- 실제: loaded로 옛 초안을 유지하면서 baseRevision은 최신 조회값2를 사용. 옛 tax_inclusive 또는 10%를 판본2에 붙여 저장한다.
- 영향: 다른 기기의 국가/세금 변경을 충돌 없이 덮어쓸 수 있다. 기존 LegacyTaxScreen의 판본 처리와 달리 활성 국제 화면에는 이 보호가 없다.
- 수정 방향: 초안과 기준 profile id/revision을 한 상태로 묶고, 배경 재조회·충돌 새로고침·저장 성공 시 채택 규칙을 구현한다.
- 근거: functional-regressions.test.tsx (국가 및 국제 세금 2건) ([실패 원문](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/audit-tests.log>))

### APP-AUDIT-04 · P1 · 고정지출 최초 조회 실패 뒤 재시도해도 빈 초안이 남는다

- 위치: [FixedCostEditScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/FixedCostEditScreen.tsx:69>)
- 재현: 최초 useFixedCosts가 error/data undefined → 재시도 성공, 월매출 100000 및 임대료 30000 반환.
- 기대: 재조회 성공 후 기존 월매출과 지출 항목으로 편집 초안을 채운다.
- 실제: 실패 상태에서도 loaded=true가 되어 재조회 성공을 무시. 월매출 입력은 빈 문자열. 기존 지출 대신 빈 기본 항목이 남는다.
- 영향: 사용자가 월매출만 재입력해 저장하면 빈 지출 배열을 전송하는 경로가 있어 기존 지출과 메뉴 원가율이 훼손될 수 있다. 빈 배열 저장 위험은 소스 추적으로 확인했으며 실제 저장은 실행하지 않았다.
- 수정 방향: 성공 응답을 받은 뒤에만 초기화를 완료하고 조회 실패 상태와 신규 월의 정상 빈 응답을 분리한다.
- 근거: functional-regressions.test.tsx ([실패 원문](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/audit-tests.log>))

### APP-AUDIT-05 · P2 · 부자재 구매금액을 낱개 단가로 나눌 때 정수 반올림한다

- 위치: [MaterialManageScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/screens/MaterialManageScreen.tsx:71>)
- 재현: 부자재 300개를 1000원에 구매했다고 입력하고 추가.
- 기대: 쓴 돈/실제 수량인 3.333333… 단가 전달. DB numeric은 소수 단가를 보존한다.
- 실제: 화면이 3원으로 반올림해 저장 훅 호출. DB 직접 저장 시험은 3.333333… 보존에 통과했다.
- 영향: 이 사례에서 부자재 원가가 10% 낮아져 해당 부자재를 쓰는 메뉴 손익까지 달라진다.
- 수정 방향: 저장할 단가는 반올림하지 않고 표시할 때만 통화/단가 표시 규칙을 적용한다.
- 근거: functional-regressions.test.tsx + supplement.sql ([실패 원문](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/audit-tests.log>))

### APP-AUDIT-06 · P1 · 신규 레시피 손익·권장가가 고정지출률을 0으로 가정한다

- 위치: [RecipeAddScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/screens/RecipeAddScreen.tsx:131>), [RecipeAddScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/screens/RecipeAddScreen.tsx:146>)
- 재현: 기존 매장 고정지출률이 양수인 상태에서 새 레시피 추가. 기존 recipe detail은 없고 판매가12000·재료비1000·세금0.
- 기대: 매장 고정지출률로 미리보기/권장가를 계산하거나 필요한 기준을 불러오기 전까지 미확정 상태로 표시.
- 실제: d?.fixedRate ?? 0을 사용. 시험에서 순이익 11000원을 확정 숫자처럼 표시. 고정지출률31.3%라면 같은 조건의 이익은7244여야 한다. 폼의 권장가 적용도 이 0%를 사용한다.
- 영향: 저장 전후 이익이 달라지고 잘못된 권장 판매가를 적용할 수 있다. 이 폼은 세금 또한 legacy settings.taxItems에 의존하므로 활성 국제 세금 미리보기 연결을 함께 재검수해야 한다.
- 수정 방향: 신규 폼에 매장 기준 비용과 활성 세금 quote를 연결하거나 서버 확정 전 손익·권장가 적용을 보류한다.
- 근거: recipe-preview-regression.test.tsx (화면 표시 재현) + source trace ([실패 원문](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/audit-tests.log>))

### APP-AUDIT-07 · P1 · 과거 손익 스냅샷 조회 실패를 현재 레시피 숫자로 대신 표시한다

- 위치: [SalesMenuDetailScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesMenuDetailScreen.tsx:78>), [SalesMenuDetailScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesMenuDetailScreen.tsx:162>)
- 재현: 기간 매출·현재 레시피 조회는 성공, 판매가 있는 하루의 day_menu_detail만 실패.
- 기대: 과거 확정값을 불러오지 못했다는 오류 및 해당 조회 재시도 제공.
- 실제: day/span의 오류·로딩을 QueryState가 검사하지 않고 현재 레시피로 fallback. 시험에서 현재 원가의 80원을 표시하면서 오류/재시도 표시가 없다.
- 영향: 지난 날짜의 실제 손익처럼 오늘 레시피의 계산값을 보여줄 수 있다. 기간 상세(span)도 같은 오류 처리 누락이 있다.
- 수정 방향: oneDay에 따라 day/span 상태를 포함하고 ‘판매 없음’ 응답과 ‘조회 실패’를 분리한다.
- 근거: functional-regressions.test.tsx ([실패 원문](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/audit-tests.log>))

### APP-AUDIT-08 · P2 · 판매·취소 후 레시피의 재고·부족·판매량 캐시가 남는다

- 위치: [queryClient.ts](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/lib/queryClient.ts:101>), [hooks.ts](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/hooks.ts:506>)
- 재현: 레시피 목록/상세를 캐시한 뒤 판매 또는 판매 수량 정정/취소의 e10 무효화 실행.
- 기대: recipe_list의 부족 정보 및 recipe_detail의 재고·30일 판매가 재조회 대상이 된다.
- 실제: e10은 sales,ingredients,orders만 무효화. 실제 QueryClient의 recipes와 recipe(id)는 isInvalidated=false.
- 영향: 다음 독립 refetch까지 메뉴의 재고/부족 안내와 최근 판매 표시가 이전 상태로 남을 수 있다. DB 원장이 잘못 저장되는 결함은 아니다.
- 수정 방향: 판매/취소/정정 전파에 recipes 쿼리 루트를 포함한다.
- 근거: cache-contract.test.tsx ([실패 원문](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/audit-tests.log>))

### APP-AUDIT-09 · P2 · 카테고리 이름 변경 후 레시피 목록을 갱신하지 않는다

- 위치: [queryClient.ts](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/lib/queryClient.ts:118>), [hooks.ts](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/master-data/hooks.ts:77>)
- 재현: 레시피 목록을 열어 캐시한 상태에서 메뉴 카테고리 이름 저장.
- 기대: 새 카테고리 이름과 레시피 행의 categoryName이 함께 갱신된다.
- 실제: settingsSaved가 recipes를 무효화하지 않음. 실제 QueryClient 검사에서 이전 카테고리 이름의 레시피 캐시가 유효한 상태로 남음.
- 영향: 카테고리 탭과 행 이름이 서로 달라져 해당 카테고리 필터 결과가 일시적으로 비어 보일 수 있다.
- 수정 방향: 카테고리 종류별 소비 화면의 쿼리 무효화 범위를 연결한다.
- 근거: cache-contract.test.tsx ([실패 원문](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/audit-tests.log>))

### APP-AUDIT-10 · P2 · 구매처 이름 변경 후 발주판을 갱신하지 않는다

- 위치: [queryClient.ts](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/lib/queryClient.ts:118>), [hooks.ts](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/master-data/hooks.ts:120>)
- 재현: 발주판을 캐시한 상태에서 구매처 이름 수정.
- 기대: 발주 후보·입고 예정·이력에서 참조하는 구매처 표기가 갱신된다.
- 실제: settingsSaved가 orders를 무효화하지 않음. QueryClient의 발주 캐시가 이전 vendorName을 보존한다.
- 영향: 구매처 관리 화면과 발주판이 다른 이름을 보여준다. 다음 독립 refetch에서 회복될 수 있다.
- 수정 방향: 구매처 저장/숨김/삭제 전파의 발주 쿼리 무효화를 추가한다.
- 근거: cache-contract.test.tsx ([실패 원문](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/audit-tests.log>))

### APP-AUDIT-11 · P1 · 소수 통화의 구매 금액을 정수로 잘라 저장한다

- 위치: [PurchaseOptionScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/PurchaseOptionScreen.tsx:216>), [FixedCostEditScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/FixedCostEditScreen.tsx:157>)
- 재현: 구매 옵션 금액에 12.99 입력 후 추가. 동일 화면이 KRW 외 출시 통화에도 사용되며 통화별 정밀도 분기가 없다.
- 기대: USD/GBP/AUD/CAD의 2자리 금액을 보존하고 해당 통화로 표시. KRW에만 0자리 규칙 적용.
- 실제: 화면이 clampDecimals(...,0)으로 12를 저장 훅에 전달. 실제 입력→저장 호출 시험에서 amount12 확인. 고정지출 월매출 등에도 같은 정수 입력 정책이 남아 있다.
- 영향: 국가 설정·서버 세금 계산이 소수 통화를 지원해도 앱에서 입력한 구매 원금이 소실되어 단가와 비용이 달라진다. 원화 고정 표기도 함께 남아 있어 국제 출시 화면 계약이 끝나지 않았다.
- 수정 방향: 활성 통화 minor_unit에 따른 공용 금액 입력·표시를 사용하고 구매/입고/판매/고정지출의 전체 금액 경로를 점검한다.
- 근거: secondary-flows.test.tsx (구매 옵션 입력 재현) / 국제 출시 기획안 통화 2자리 표시 계약 ([실패 원문](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/audit-tests.log>))

### APP-AUDIT-12 · P1 · 메뉴별 손익 시트가 부자재 비용을 누락한다

- 위치: [MenuProfitSheet.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/components/MenuProfitSheet.tsx:60>), [hooks.ts](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/hooks.ts:200>)
- 재현: 한 메뉴만 매출1000, 재료비100, 부자재200, 다른 비용0인 기간의 메뉴 손익 시트를 연다.
- 기대: 총 순이익과 같은700을 표시하고 부자재200을 비용에 포함한다.
- 실제: summary.extraMaterialCost를 사용하지 않고 revenue-material-waste-fixed-daily-tax만 계산해900원 표시. 실제 컴포넌트에서900원 존재,700원 부재를 확인했다.
- 영향: 메뉴별 이익이 부자재 비용만큼 부풀려지고 전체 손익과 상세 시트가 맞지 않는다. 실제 RPC fixture에서도 material과 extra_material_cost는 별도 항목이다.
- 수정 방향: 서버의 메뉴별 부자재/확정 손익을 응답·훅·시트에 전달한다. 세금을 매출 비중으로 나누는 부분도 메뉴 과세 예외와 대조한다.
- 근거: history-profit-regressions.test.tsx / rpc-fixtures.json의 sales_range 및 day_menu_detail ([실패 원문](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/audit-tests.log>))

### APP-AUDIT-13 · P2 · 과거 폐기 금액이 현재 기준단가를 따라 바뀐다

- 위치: [DiscardHistoryScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/DiscardHistoryScreen.tsx:63>), [DiscardHistoryScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/DiscardHistoryScreen.tsx:122>), [LossCard.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/components/LossCard.tsx:118>)
- 재현: 지난날 폐기100g 기록과 단가4를 표시한 뒤, 폐기 기록을 바꾸지 않고 현재 단가만8로 재조회.
- 기대: 지난날 폐기 금액400을 유지한다. 매출 폐기 상세의 서버 계산 역시 버린 날 단가를 사용한다.
- 실제: 같은 과거 이벤트의 행/합계가400원에서800원으로 변경된다. 현재 ingredient_detail.basePrice를 과거 폐기량에 곱한다.
- 영향: 식재료 폐기 이력의 금액이 입고 가격 변경마다 움직여 과거 손실과 매출 폐기 상세가 불일치할 수 있다. 식재료 상세의 LossCard도 같은 현재 단가 곱셈을 사용하는 것을 소스에서 확인했다.
- 수정 방향: 폐기 당시 단가 또는 서버가 계산한 이력 금액을 반환·표시한다. 현재 가격 기준 추정치를 의도했다면 확정 이력과 구분하고 명시해야 한다.
- 근거: history-profit-regressions.test.tsx / 20260822000092_waste_tax_breakdown.sql의 day_unit_price 계약 ([실패 원문](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/audit-tests.log>))

## 구현되지 않았거나 현재 제한된 기능

| 기능 | 확인한 상태 | 근거 |
|---|---|---|
| 신규 사용자 로그인·매장 생성 진입 | 실제 로그인 화면이 없고 개발 시드 자동 로그인만 존재. 운영 signed-out에는 재시도만 제공 | [session.ts](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/lib/session.ts:11>) |
| 알림 발송 | 설정 저장은 구현, 실제 서버 알림 발송은 후속 연결 | [MyNotificationsScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyNotificationsScreen.tsx:127>) |
| 영어 화면 번역 | 사용자별 ko/en 선호 저장은 구현, 화면 전체 번역은 후속 i18n | [MyLanguageScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyLanguageScreen.tsx:1>) 및 features README |
| 활성 국제 세금의 판매가 시뮬레이션 | RecipeDetail은 준비 중 표시로 제한 | [RecipeDetailScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/screens/RecipeDetailScreen.tsx:577>) |
| 반제품 레시피 | 명시적으로 1차 범위 밖. 서버 입력 차단은 정상 계약 | AGENTS 및 DB guard 시험 |

## 전체 기능 체크리스트

공식 화면 ID 목록을 빠짐없이 포함했다. 표의 기본 검토는 소스 연결·관련 DB/core/mobile 시험의 범위를 뜻한다. 본문 상태 시험은 화면 모듈별 다음 표에 별도로 기록한다. ‘추가 재현 없음’은 모든 상호작용의 무결함 보증이 아니다.

| 화면 ID | 기능 | 구현 위치/연결 | 감사 결과 |
|---|---|---|---|
| ING-01 | 식재료 리스트 (카테고리 스트립·정렬·소진임박 알림·FAB) | `ingredients/index` (`IngredientListScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| ING-02 | 식재료 추가 (등록 폼·단위 시트·단가 미리보기) | `ingredients/add` (`IngredientAddScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| ING-03 | 식재료 상세 (잔여·기준단가·로스율·재고 변동·구매이력·구매옵션) | `ingredients/[id]` (`IngredientDetailScreen`) | APP-AUDIT-13(P2) |
| ING-04 | 식재료 수정 (용량·안전재고·최소발주·구매옵션) | `ingredients/edit/[id]` (`IngredientEditScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| ING-03b | 재고 추가 (빠른 입고 · 구매 옵션 자동 채움 · 서버 미리보기) → **E7+E1** | `ingredients/add-stock/[id]` (`QuickInboundScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| ING-05 | 재고 수정 (수량 조정·완전 소진·폐기) → **E2/E5** | `StockEditSheet`(시트) | APP-AUDIT-01(P1) |
| ING-06 | 구매 링크·옵션 수정 | `ingredients/option` (`PurchaseOptionScreen`) | APP-AUDIT-11(P1) |
| ING-07 | 재고 내역 (변동 원장·기간 필터) | `ingredients/history/[id]` (`StockHistoryScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| ING-08 | 조회 설정 (기간·유형·정렬 필터) | `HistoryFilterSheet`(시트) | 소스·기존 시험 검토 / 추가 재현 없음 |
| ING-09 | 구매 이력 전체 (건별 단가·단가 범위·기준단가 대조) | `ingredients/purchases/[id]` (`PurchaseHistoryScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| ING-10 | 폐기 내역 (탭: 전체·조리 전 폐기·조리 후 폐기) | `ingredients/discards/[id]` (`DiscardHistoryScreen`) | APP-AUDIT-13(P2) |
| — | 메모 수정 (멀티라인·글자수) | `MemoEditSheet`(시트) | 소스·기존 시험 검토 / 추가 재현 없음 |
| RCP-01 | 레시피 리스트 (정렬·판매상태/목표 필터) | `recipes/index` | APP-AUDIT-08(P2), APP-AUDIT-09(P2) |
| RCP-02 | 레시피 상세 (도넛·손익·재료·고정지출·**세금 항목별**) | `recipes/[id]` | APP-AUDIT-08(P2) |
| RCP-03 | 레시피 추가/수정 (재료·부자재·추가 지출·목표율) → **E3** | `recipes/add` | APP-AUDIT-06(P1) |
| RCP-10 | 식재료 검색·담기 + 사용량 입력 시트 | `recipes/ingredient-search` (`RecipeIngredientSearchScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| RCP-11 | 부자재 검색·담기 | `recipes/material-search` (`MaterialSearchScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| RCP-13 | 부자재 관리 (+ RCP-14 부자재 수정 시트) | `recipes/materials` (`MaterialManageScreen`) | APP-AUDIT-05(P2) |
| RCP-07 | 평균 판매량 입력 (기간·환산·배분비율) | `recipes/avg-sales` (`AvgSalesScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| RCP-16 | 손익 변동 (금액 목록 → 원인·결과 시트, 커서 20건) | `recipes/profit-history` (`ProfitHistoryScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| RCP-12 | 레시피 카테고리 설정 (추가·수정·삭제) | `recipes/category` (`CategoryScreen`) | APP-AUDIT-09(P2) |
| MY-05 | 고정 지출 자세히 (자세히 보기 진입) | `recipes/fixed-cost` (`my/FixedCostScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| MY-05b | 고정 지출 수정 (항목/카드 추가·삭제) → **E4** | `recipes/fixed-cost-edit` (`my/FixedCostEditScreen`) | APP-AUDIT-04(P1), APP-AUDIT-11(P1) |
| RCP-05 | 판매가 시뮬레이션 (상세 내 시트·슬라이더 라이브 재계산) | `recipes/PriceSimSheet`(시트) | 소스·기존 시험 검토 / 추가 재현 없음 · 활성 국제 세금은 제공 제한 |
| RCP-15 | 적용 채널·비중 (고정지출 수정 내 시트·슬라이더·합계 검증) | `my/ChannelWeightSheet`(시트) | 소스·기존 시험 검토 / 추가 재현 없음 |
| ORD-01 | 발주 현황 (발주 후보/입고 예정/입고 완료) | `orders/index` | APP-AUDIT-10(P2) |
| ORD-05 | 주문하기 — 구매 링크·옵션 시트 | (OrdersHome 내 시트) | 소스·기존 시험 검토 / 추가 재현 없음 |
| ORD-06 | 발주 완료 — 구매처 선택 시트 | (OrdersHome 내 시트) | 소스·기존 시험 검토 / 추가 재현 없음 |
| ORD-02 | 발주 완료 등록 (도착 예정일 달력) → **E7** | `orders/complete` (`OrderCompleteScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| ORD-03 | 입고 확정 (실제 수량·부분 입고·멱등키) → **E1** | (OrdersHome 내 시트) | 소스·기존 시험 검토 / 추가 재현 없음 |
| ORD-07 | 발주 취소 → **E12** / 입고 취소 → **E11** | (OrdersHome 카드 버튼) | 소스·기존 시험 검토 / 추가 재현 없음 |
| MY-01 | 마이페이지 홈 (사업장 + 설정 메뉴) | `my/index` (`MyHomeScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| MY-02 | 세금 (부가세 · 추가 항목 → 전 레시피 손익 반영) | `my/tax` (`MyTaxScreen`) | APP-AUDIT-03(P1) |
| MY-03 | 카테고리 관리 허브 | `my/categories` (`MyCategoryHubScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| MY-03a | 카테고리 편집 | `my/category` (`MyCategoryScreen`) | APP-AUDIT-09(P2) |
| MY-11 | 구매처·브랜드 | `my/vendors` (`MyVendorsScreen`) | APP-AUDIT-10(P2) |
| MY-06 | 알림 설정 | `my/notifications` (`MyNotificationsScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 · 발송 미구현 |
| MY-07 | 판매 채널 이름·사용 여부 | `my/channels` (`MyChannelsScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| RCP-12b | 부자재 카테고리 | `recipes/material-category` (`MaterialCategoryScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| SALES-06 | 기타 매출 추가 (항목·단가·수량·**판매 채널** 선택) | `SalesHomeScreen` 시트 | 소스·기존 시험 검토 / 추가 재현 없음 |
| SALES-17 | 폐기 손실 자세히 (조리 폐기 · 식재료 폐기) | `sales/waste` (`SalesWasteScreen`) | APP-AUDIT-13(P2) |
| SALES-18 | 세금 자세히 (항목별 · 메뉴분/기타분) | `sales/tax` (`SalesTaxScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| SALES-07 | 당일 지출 추가 (항목·금액·메모) | (SalesHome 내 시트) | 소스·기존 시험 검토 / 추가 재현 없음 |
| SALES-05b | 판매 수량 입력 (매장/배달/포장 + **조리 폐기**) → **E10/E8** | (SalesHome 내 시트) | APP-AUDIT-08(P2) |
| SALES-01 | 매출관리 홈 (일일 판매 입력 + **영업 상태 바**) | `sales/index` (`SalesHomeScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| ING-11 | 식재료 수정 내역 (전후값·자동 전파·매출 반영 상태) | `ingredients/changes/[id]` (`ChangeHistoryScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| RCP-02b | 레시피 수정 내역 (전후값·자동 전파·매출 반영 상태) | `recipes/changes/[id]` (`ChangeHistoryScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| SALES-01b | 영업중·브레이크타임·영업종료 (전이 한 문 · 자동 브레이크는 서버 크론) | (SalesHome 내 `BusinessDayBar`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| SALES-02 | 매출 분석 (기간 선택·캘린더·손익) | `sales/analytics` (`SalesAnalyticsScreen`) | APP-AUDIT-12(P1) |
| SALES-03 | 일 손익 상세 | `sales/day` (`SalesDayDetailScreen`) | APP-AUDIT-12(P1) |
| SALES-10 | 손익 전체 자세히 | `sales/day-detail` (`SalesDayFullScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| SALES-12 | 매출 상세 | `sales/revenue` (`SalesRevenueScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| SALES-09 | 메뉴 손익 상세 (하루=그날 스냅샷 · 기간=날짜별 **합**) | `sales/menu` (`SalesMenuDetailScreen`) | APP-AUDIT-02(P1), APP-AUDIT-07(P1) |
| SALES-04 | 채널별 손익 | `sales/channel` (`SalesChannelScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| SALES-13 | 재료 원가 상세 (+ SALES-14 재료별 사용 메뉴 시트) | `sales/material` (`SalesMaterialScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| SALES-15 | 부자재 상세 (+ SALES-16 부자재별 사용 메뉴 시트) | `sales/extra` (`SalesExtraScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| SALES-11 | 고정 지출 상세 | `sales/fixed` (`SalesFixedScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| SALES-20 | 추가 지출 | `sales/expense` (`SalesExpenseScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| SALES-19 | 부족 메뉴·식재료 재고 확인 | `sales/stock-check` (`SalesStockCheckScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| SALES-21 | 과거 판매 내역 수정·추가 (§6.4 · 다시 열지 않고 정정) | `sales/past` (`SalesPastEditScreen`) | APP-AUDIT-08(P2) |
| MY-04 | 단위 설정 (미터법 표시·1컵 용량·**단가 표기 자릿수**) | `my/units` (`MyUnitsScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| MY-08 | 사용자별 앱 언어 (한국어/영어 · 매장 국가·통화와 분리) | `my/language` (`MyLanguageScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 · 번역 미구현 |
| MY-09 | 영업시간 (요일별 시간·브레이크 · 매장 시간대 · 영업일 경계) | `my/hours` (`MyHoursScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| MY-10 | 계정 관리 (탈퇴 시 접근 종료 · 매장/거래 원장 보존 안내) | `my/account` (`MyAccountScreen`) | 소스·기존 시험 검토 / 추가 재현 없음 |
| MY-12 | 국가·통화 확인 및 설정 (시장 프로필 판본 저장) | `my/country` (`MyCountryScreen`) | APP-AUDIT-03(P1), APP-AUDIT-11(P1) |

## 55개 화면·시트 모듈별 자동 검사 근거

기본 3상태의 query 오류가 표시되는지 여부도 screen-states.json에 기록했다. 오류를 숨기는 화면은 렌더 자체가 성공할 수 있으므로 렌더 통과를 오류 처리 통과로 읽으면 안 된다. 일부 폼은 전제 조회 실패 시 빈 선택지를 표시하며, 저장·부분 실패 경로는 별도 확인이 필요하다.

| 모듈 | 기본 3상태 | 기존 직접 화면 시험 | 관련 재현 문제 |
|---|---|---|---|
| [changes/screens/ChangeHistoryScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/changes/screens/ChangeHistoryScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [ingredients/screens/DiscardHistoryScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/DiscardHistoryScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | APP-AUDIT-13 |
| [ingredients/screens/HistoryFilterSheet.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/HistoryFilterSheet.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [ingredients/screens/IngredientAddScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/IngredientAddScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [ingredients/screens/IngredientDetailScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/IngredientDetailScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [ingredients/screens/IngredientEditScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/IngredientEditScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [ingredients/screens/IngredientFormScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/IngredientFormScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [ingredients/screens/IngredientListScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/IngredientListScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [ingredients/screens/PurchaseHistoryScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/PurchaseHistoryScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [ingredients/screens/PurchaseOptionScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/PurchaseOptionScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | APP-AUDIT-11 |
| [ingredients/screens/QuickInboundScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/QuickInboundScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [ingredients/screens/StockEditSheet.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/StockEditSheet.tsx>) | 렌더 통과 | 직접 import 시험 없음 | APP-AUDIT-01 |
| [ingredients/screens/StockHistoryScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/screens/StockHistoryScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [my/screens/FixedCostEditScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/FixedCostEditScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | APP-AUDIT-04, APP-AUDIT-11 |
| [my/screens/FixedCostScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/FixedCostScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [my/screens/MyAccountScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyAccountScreen.tsx>) | 렌더 통과 | [myAccount.test.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/tests/myAccount.test.tsx>) | — |
| [my/screens/MyCategoryHubScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyCategoryHubScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [my/screens/MyCategoryScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyCategoryScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [my/screens/MyChannelsScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyChannelsScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [my/screens/MyCountryScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyCountryScreen.tsx>) | 렌더 통과 | [myCountry.test.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/tests/myCountry.test.tsx>) | APP-AUDIT-03 |
| [my/screens/MyHomeScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyHomeScreen.tsx>) | 렌더 통과 | [myHome.test.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/tests/myHome.test.tsx>) | — |
| [my/screens/MyHoursScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyHoursScreen.tsx>) | 렌더 통과 | [myHours.test.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/tests/myHours.test.tsx>) | — |
| [my/screens/MyLanguageScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyLanguageScreen.tsx>) | 렌더 통과 | [myLanguage.test.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/tests/myLanguage.test.tsx>) | — |
| [my/screens/MyNotificationsScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyNotificationsScreen.tsx>) | 렌더 통과 | [settingsScreens.test.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/tests/settingsScreens.test.tsx>) | — |
| [my/screens/MyTaxScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyTaxScreen.tsx>) | 렌더 통과 | [internationalTaxScreens.test.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/tests/internationalTaxScreens.test.tsx>), [settingsScreens.test.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/tests/settingsScreens.test.tsx>) | APP-AUDIT-03 |
| [my/screens/MyUnitsScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyUnitsScreen.tsx>) | 렌더 통과 | [settingsScreens.test.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/tests/settingsScreens.test.tsx>) | — |
| [my/screens/MyVendorsScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/screens/MyVendorsScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [orders/screens/OrderCompleteScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/orders/screens/OrderCompleteScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [orders/screens/OrdersHomeScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/orders/screens/OrdersHomeScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [recipes/screens/AvgSalesScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/screens/AvgSalesScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [recipes/screens/CategoryEditScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/screens/CategoryEditScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [recipes/screens/CategoryScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/screens/CategoryScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [recipes/screens/MaterialCategoryScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/screens/MaterialCategoryScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [recipes/screens/MaterialManageScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/screens/MaterialManageScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | APP-AUDIT-05 |
| [recipes/screens/MaterialSearchScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/screens/MaterialSearchScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [recipes/screens/ProfitHistoryScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/screens/ProfitHistoryScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [recipes/screens/RecipeAddScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/screens/RecipeAddScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | APP-AUDIT-06 |
| [recipes/screens/RecipeDetailScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/screens/RecipeDetailScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [recipes/screens/RecipeIngredientSearchScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/screens/RecipeIngredientSearchScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [recipes/screens/RecipesListScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/screens/RecipesListScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [sales/screens/SalesAnalyticsScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesAnalyticsScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [sales/screens/SalesChannelScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesChannelScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [sales/screens/SalesDayDetailScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesDayDetailScreen.tsx>) | 렌더 통과 | [salesDayDetail.test.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/tests/salesDayDetail.test.tsx>) | — |
| [sales/screens/SalesDayFullScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesDayFullScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [sales/screens/SalesExpenseScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesExpenseScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [sales/screens/SalesExtraScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesExtraScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [sales/screens/SalesFixedScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesFixedScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [sales/screens/SalesHomeScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesHomeScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [sales/screens/SalesMaterialScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesMaterialScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [sales/screens/SalesMenuDetailScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesMenuDetailScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | APP-AUDIT-02, APP-AUDIT-07 |
| [sales/screens/SalesPastEditScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesPastEditScreen.tsx>) | 렌더 통과 | [salesPastEdit.test.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/tests/salesPastEdit.test.tsx>) | — |
| [sales/screens/SalesRevenueScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesRevenueScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [sales/screens/SalesStockCheckScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesStockCheckScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |
| [sales/screens/SalesTaxScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesTaxScreen.tsx>) | 렌더 통과 | [internationalTaxScreens.test.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/tests/internationalTaxScreens.test.tsx>) | — |
| [sales/screens/SalesWasteScreen.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/screens/SalesWasteScreen.tsx>) | 렌더 통과 | 직접 import 시험 없음 | — |

### 별도 하위 컴포넌트/시트

화면 폴더 밖의 하위 기능도 소스 조사에 포함했다. 아래 목록을 55개 화면의 독립 상태 시험 수에 더하지 않는다. MenuProfitSheet(SALES-08)는 공식 인벤토리의 독립 행에는 없지만 실제 제품 코드에 존재해 추가 재현했다.

| 컴포넌트 | 이번 확인 |
|---|---|
| [business-day/components/BusinessDateGate.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/business-day/components/BusinessDateGate.tsx>) | 소스 연결 및 부모 화면 사용 검토 |
| [changes/components/RecentChangeRow.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/changes/components/RecentChangeRow.tsx>) | 소스 연결 및 부모 화면 사용 검토 |
| [ingredients/components/BasePriceCard.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/components/BasePriceCard.tsx>) | 소스 연결 및 부모 화면 사용 검토 |
| [ingredients/components/CategoryPickerSheet.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/components/CategoryPickerSheet.tsx>) | 소스 연결 및 부모 화면 사용 검토 |
| [ingredients/components/IngCard.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/components/IngCard.tsx>) | 소스 연결 및 부모 화면 사용 검토 |
| [ingredients/components/LedgerRow.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/components/LedgerRow.tsx>) | 소스 연결 및 부모 화면 사용 검토 |
| [ingredients/components/LossCard.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/components/LossCard.tsx>) | 소스 연결 및 부모 화면 사용 검토 |
| [ingredients/components/UnitPickerSheet.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/components/UnitPickerSheet.tsx>) | 무게 그룹 제한·kg 선택 상호작용 통과 |
| [ingredients/components/VendorPickerSheet.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/ingredients/components/VendorPickerSheet.tsx>) | 소스 연결 및 부모 화면 사용 검토 |
| [international-tax/RecipeTaxStatusCard.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/international-tax/RecipeTaxStatusCard.tsx>) | 소스 연결 및 부모 화면 사용 검토 |
| [my/components/ChannelWeightSheet.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/components/ChannelWeightSheet.tsx>) | 수동 비율3:5:2 전달 상호작용 통과 |
| [my/components/RevenueGapCard.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/my/components/RevenueGapCard.tsx>) | 소스 연결 및 부모 화면 사용 검토 |
| [recipes/components/PriceSimSheet.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/recipes/components/PriceSimSheet.tsx>) | 소스 검토, 활성 국제 세금에서는 상세 화면이 진입 제한 |
| [sales/components/BusinessDayBar.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/components/BusinessDayBar.tsx>) | 기존 businessDayBar 시험 통과 |
| [sales/components/LateCloseSheet.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/components/LateCloseSheet.tsx>) | 소스 연결 및 부모 화면 사용 검토 |
| [sales/components/MenuProfitSheet.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/components/MenuProfitSheet.tsx>) | 실제 시트 재현: APP-AUDIT-12 |
| [sales/components/ProfitBlocks.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/components/ProfitBlocks.tsx>) | 소스 연결 및 부모 화면 사용 검토 |
| [sales/components/SaleStepper.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/components/SaleStepper.tsx>) | 소스 연결 및 부모 화면 사용 검토 |
| [sales/components/ShortageWarningSheet.tsx](<C:/Users/jacop/프로젝트/식자재관리앱/apps/mobile/src/features/sales/components/ShortageWarningSheet.tsx>) | 소스 연결 및 부모 화면 사용 검토 |

## 앱 RPC 73개와 검증 연결

SQL 시험 연결은 함수명을 호출 형태로 찾은 구조상 지표다. 간접 호출은 표시되지 않을 수 있으며, 이름이 존재한다는 사실만으로 모든 인자/권한/실패 조합을 검증했다고 판단하지 않았다. 보완 쓰기 시험은 실제 authenticated 역할에서 실행했다.

| RPC | 기존 SQL 시험 연결 | 이번 보완 |
|---|---|---|
| amend_ended_business_day | 16_change_retention.sql, 27_amend_ended_day.sql, 28_past_edit_round_trip.sql | 기존 시험·소스 추적 |
| app_capabilities | 10_tax_items.sql, 37_international_contract_capabilities.sql, 38_international_tax_schema.sql, 39_international_tax_audit_migration.sql, 40_international_tax_calculation.sql, 44_international_tax_profile_writes.sql, 47_international_tax_release_cutover.sql | 실제 조회 성공 |
| business_day_state | 09_business_day.sql, 12_day_basis.sql, 23_store_local_date.sql, 27_amend_ended_day.sql, 29_store_context.sql | 실제 조회 성공 |
| day_menu_basis | 12_day_basis.sql, 49_international_tax_accounting_totals.sql, 50_international_tax_review_regressions.sql | 실제 조회 성공 |
| day_menu_detail | 09_business_day.sql, 10_tax_items.sql, 12_day_basis.sql, 49_international_tax_accounting_totals.sql | 실제 조회 성공 |
| deactivate_ingredient | 07_guards.sql | 기존 시험·소스 추적 |
| deactivate_material | 직접 호출 텍스트 없음 | 실제 저장/불변식 확인 |
| deactivate_recipe | 08_write_paths.sql | 기존 시험·소스 추적 |
| delete_category | 07_guards.sql | 기존 시험·소스 추적 |
| delete_purchase_option | 직접 호출 텍스트 없음 | 실제 저장/불변식 확인 |
| delete_vendor | 직접 호출 텍스트 없음 | 실제 저장/불변식 확인 |
| e11_inbound_reverted | 13_change_history.sql, 14_volume_weighted.sql, 19_negative_stock_paths.sql, 49_international_tax_accounting_totals.sql | 기존 시험·소스 추적 |
| e12_order_canceled | 직접 호출 텍스트 없음 | 실제 저장/불변식 확인 |
| e1_confirm_inbound | 03_e1_inbound.sql, 08_write_paths.sql, 09_business_day.sql, 12_day_basis.sql, 13_change_history.sql, 14_volume_weighted.sql, 17_profit_history.sql, 49_international_tax_accounting_totals.sql | 기존 시험·소스 추적 |
| e2_discard | 05_discard.sql, 07_guards.sql, 08_write_paths.sql, 12_day_basis.sql, 13_change_history.sql | 기존 시험·소스 추적 |
| e2_discard_reverted | 05_discard.sql | 기존 시험·소스 추적 |
| e5_stock_adjusted | 05_discard.sql, 11_single_stock_total.sql, 14_volume_weighted.sql, 18_material_usage.sql, 19_negative_stock_paths.sql, 20_shortage_checks.sql, 21_shared_ingredient.sql, 34_rpc_least_privilege.sql | 기존 시험·소스 추적 |
| e7_place_order | 02_e7_immutable.sql, 03_e1_inbound.sql, 08_write_paths.sql, 09_business_day.sql, 12_day_basis.sql, 13_change_history.sql, 14_volume_weighted.sql, 17_profit_history.sql, 23_store_local_date.sql | 실제 저장/불변식 확인 |
| entity_change_history | 07_guards.sql, 13_change_history.sql, 15_quick_inbound.sql | 실제 조회 성공 |
| fixed_cost_revenue_check | 직접 호출 텍스트 없음 | 실제 조회 성공 |
| get_settings | 07_guards.sql, 32_settings_contract.sql, 34_rpc_least_privilege.sql | 실제 조회 성공 |
| get_user_preferences | 16_change_retention.sql, 41_international_tax_app_contract.sql | 실제 조회 성공 |
| ingredient_detail | 05_discard.sql, 07_guards.sql, 13_change_history.sql, 34_rpc_least_privilege.sql | 실제 조회 성공 |
| ingredient_list | 직접 호출 텍스트 없음 | 실제 조회 성공 |
| international_tax_app_state | 16_change_retention.sql, 41_international_tax_app_contract.sql, 46_international_tax_authority_bridge.sql | 실제 조회 성공 |
| international_tax_regions | 16_change_retention.sql, 41_international_tax_app_contract.sql | 실제 조회 성공 |
| operating_hours_status | 23_store_local_date.sql, 25_operating_rules.sql | 실제 조회 성공 |
| order_board | 직접 호출 텍스트 없음 | 실제 조회 성공 |
| purchase_history | 05_discard.sql | 실제 조회 성공 |
| quick_inbound | 13_change_history.sql, 15_quick_inbound.sql, 16_change_retention.sql, 19_negative_stock_paths.sql, 23_store_local_date.sql | 기존 시험·소스 추적 |
| quick_inbound_preview | 15_quick_inbound.sql | 실제 조회 성공 |
| range_menu_detail | 12_day_basis.sql, 49_international_tax_accounting_totals.sql | 실제 조회 성공 |
| recipe_detail | 07_guards.sql, 10_tax_items.sql, 13_change_history.sql, 23_store_local_date.sql, 24_recipe_detail_fixed.sql | 실제 조회 성공 |
| recipe_list | 01_checksums.sql, 08_write_paths.sql, 09_business_day.sql, 10_tax_items.sql, 12_day_basis.sql, 14_volume_weighted.sql, 16_change_retention.sql, 48_international_tax_recipe_profit.sql | 실제 조회 성공 |
| recipe_pick_list | 직접 호출 텍스트 없음 | 실제 조회 성공 |
| recipe_profit_history | 10_tax_items.sql, 17_profit_history.sql | 실제 조회 성공 |
| recipe_shortages | 20_shortage_checks.sql | 실제 조회 성공 |
| recipe_tax_app_state | 16_change_retention.sql, 41_international_tax_app_contract.sql, 44_international_tax_profile_writes.sql, 46_international_tax_authority_bridge.sql, 50_international_tax_review_regressions.sql | 실제 조회 성공 |
| reorder_categories | 직접 호출 텍스트 없음 | 실제 저장/불변식 확인 |
| report_client_rpc_error | 16_change_retention.sql, 36_operations_monitoring.sql | 기존 시험·소스 추적 |
| retire_channel | 직접 호출 텍스트 없음 | 실제 저장/불변식 확인 |
| retire_my_account | 16_change_retention.sql, 33_account_retention.sql | 기존 시험·소스 추적 |
| sale_shortages | 20_shortage_checks.sql, 21_shared_ingredient.sql, 22_revision_and_close.sql | 실제 조회 성공 |
| sales_channel_fixed | 직접 호출 텍스트 없음 | 실제 조회 성공 |
| sales_day | 28_past_edit_round_trip.sql | 실제 조회 성공 |
| sales_etc_by_channel | 직접 호출 텍스트 없음 | 실제 조회 성공 |
| sales_extra_usage | 12_day_basis.sql | 실제 조회 성공 |
| sales_fixed_breakdown | 12_day_basis.sql | 실제 조회 성공 |
| sales_material_usage | 12_day_basis.sql, 18_material_usage.sql | 실제 조회 성공 |
| sales_range | 직접 호출 텍스트 없음 | 실제 조회 성공 |
| sales_tax_app_detail | 16_change_retention.sql, 41_international_tax_app_contract.sql, 46_international_tax_authority_bridge.sql, 47_international_tax_release_cutover.sql | 실제 조회 성공 |
| sales_tax_breakdown | 직접 호출 텍스트 없음 | 실제 조회 성공 |
| sales_waste_breakdown | 직접 호출 텍스트 없음 | 실제 조회 성공 |
| save_app_language | 16_change_retention.sql, 41_international_tax_app_contract.sql | 기존 시험·소스 추적 |
| save_category | 34_rpc_least_privilege.sql | 실제 저장/불변식 확인 |
| save_channel | 08_write_paths.sql | 기존 시험·소스 추적 |
| save_fixed_costs | 07_guards.sql, 09_business_day.sql, 12_day_basis.sql, 13_change_history.sql, 17_profit_history.sql | 기존 시험·소스 추적 |
| save_ingredient | 07_guards.sql, 08_write_paths.sql, 13_change_history.sql, 14_volume_weighted.sql, 34_rpc_least_privilege.sql | 기존 시험·소스 추적 |
| save_material | 직접 호출 텍스트 없음 | 실제 저장/불변식 확인 |
| save_menu_tax_override | 16_change_retention.sql, 44_international_tax_profile_writes.sql, 50_international_tax_review_regressions.sql | 기존 시험·소스 추적 |
| save_purchase_option | 08_write_paths.sql | 실제 저장/불변식 확인 |
| save_recipe | 07_guards.sql, 08_write_paths.sql, 09_business_day.sql, 10_tax_items.sql, 12_day_basis.sql, 13_change_history.sql, 16_change_retention.sql, 17_profit_history.sql, 22_revision_and_close.sql, 49_international_tax_accounting_totals.sql | 기존 시험·소스 추적 |
| save_sale | 08_write_paths.sql, 09_business_day.sql, 16_change_retention.sql, 20_shortage_checks.sql, 21_shared_ingredient.sql, 22_revision_and_close.sql, 26_auto_close_sweep.sql, 27_amend_ended_day.sql, 29_store_context.sql, 47_international_tax_release_cutover.sql | 기존 시험·소스 추적 |
| save_settings | 07_guards.sql, 16_change_retention.sql, 25_operating_rules.sql, 31_settings_lockdown.sql, 32_settings_contract.sql | 기존 시험·소스 추적 |
| save_store_market_profile | 16_change_retention.sql, 31_settings_lockdown.sql, 44_international_tax_profile_writes.sql | 기존 시험·소스 추적 |
| save_store_tax | 10_tax_items.sql, 16_change_retention.sql, 31_settings_lockdown.sql, 47_international_tax_release_cutover.sql | 기존 시험·소스 추적 |
| save_store_tax_profile | 16_change_retention.sql, 31_settings_lockdown.sql, 44_international_tax_profile_writes.sql | 기존 시험·소스 추적 |
| save_vendor | 직접 호출 텍스트 없음 | 실제 저장/불변식 확인 |
| set_operating_hours | 16_change_retention.sql, 25_operating_rules.sql, _prelude.sql | 기존 시험·소스 추적 |
| set_store_timezone | 16_change_retention.sql, 23_store_local_date.sql | 기존 시험·소스 추적 |
| settings_lists | 직접 호출 텍스트 없음 | 실제 조회 성공 |
| stock_history | 04_ledger.sql, 05_discard.sql | 실제 조회 성공 |
| transition_business_state | 08_write_paths.sql, 09_business_day.sql, 12_day_basis.sql, 16_change_retention.sql, 26_auto_close_sweep.sql, 30_state_transitions.sql, _prelude.sql | 기존 시험·소스 추적 |

## 남은 검증 경계

- Android/iOS 실기기 실행, 키보드·뒤로가기·접근성·터치·네이티브 Alert 동작은 미실행. 웹 번들은 빌드 결과이며 실기기 E2E가 아니다.
- 신규 설치부터 로그인→매장 등록→전 기능 순회의 종단 흐름은 로그인/온보딩 구현과 전용 테스트 환경이 필요하다.
- 운영/스테이징 DB, 원격 Cron, 푸시 알림 전달, 실제 외부 구매 링크/브라우저와 계정 삭제 종단 흐름은 검증하지 않았다. 운영 데이터에는 쓰기 작업을 하지 않았다.
- 모든 화면의 모든 버튼·국가·통화·세금·기간·권한·재시도 조합과 장시간 대용량 부하를 전수 실행한 것은 아니다. 이번 감사는 전체 기능 목록을 포괄한 소스/시험/DB 검증이다.
- DB ACL 검사는 로컬 새 DB 결과이며 호스티드 supabase_admin 기본 권한이나 원격 배포 완료의 증거가 아니다.

## 독립 Fable 검수

```text
> margincook-platform@0.2.0 fable:review C:\Users\jacop\프로젝트\식자재관리앱
> node scripts/fable-review.mjs "--" "--task" "APP-ALL-FUNCTION-AUDIT-20260909" "--round" "1"

Fable 검수 실행 실패: Claude Code --max-budget-usd는 실제 결제 하드캡으로 검증되지 않았으므로 외부 호출 전에 중단했습니다: PROVIDER_HARD_CAP_UNAVAILABLE
 ELIFECYCLE  Command failed with exit code 64.
```

외부 독립 검수가 실행되지 않았으면 프로젝트 완료 게이트 통과로 표시하지 않는다. 실행기의 비용 하드캡/정확한 사람 승인 조건을 우회하지 않았다. `scripts/fable-review.mjs:2964`의 assertExternalBudgetEnforcement는 기본 외부 호출을 중단하며, `--allow-soft-budget`과 해당 회차·금액에 정확히 결속된 HUMAN_DECISION이 있어야 진행한다. 이 요청에는 그 예산 위험 승인이 없어 별도 모델로 우회하지 않았다.

## 재실행과 무변경 확인

```powershell
corepack pnpm verify
corepack pnpm --filter @margincook/core test
corepack pnpm --filter @margincook/mobile test
corepack pnpm exec vitest run --config .tmp/app-full-audit-20260909/vitest.config.ts
```

보완 SQL은 별도 fresh DB에 실행하고 반드시 rollback한다. supplement.mjs의 일회용 DB 이름은 다시 생성한 DB로 교체해야 한다. 실패하는 추가 시험은 발견한 결함을 증명하기 위해 기대 동작을 단언한 것으로, 통과시키려고 제품 동작을 변경하지 않았다.

검사 시작에 hash를 보존한 제품 파일 322개 중 현재 변경 감지 0개. [무변경 검사](<C:/Users/jacop/프로젝트/식자재관리앱/.tmp/app-full-audit-20260909/source-integrity.json>). 앱/core/migration 파일은 이 감사에서 수정하지 않았다. 감사 산출물만 추가했고 기존 사용자 변경은 커밋·스테이징하지 않았다.
