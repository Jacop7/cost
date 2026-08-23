# features/ — 화면 ID ↔ 기능 모듈 매핑

탭별 feature 모듈. 각 모듈은 `screens/`(화면·시트) + `hooks.ts`(조회·저장)로 구성한다.
**`demoData.ts` 는 전부 제거됐다** — 모든 화면이 Supabase 실데이터를 쓴다.
공통 UI 킷은 `src/components/kit`, 계산은 `@sikjae/core`, 데이터 계약은 `@sikjae/types`.

화면은 supabase 를 직접 부르지 않는다. `features/<도메인>/hooks.ts` 가 유일한 경계이고,
쿼리 키·무효화 규칙은 `src/lib/queryClient.ts` 의 `qk`·`invalidateOn` 이 단일 출처다.

하단 탭 순서: **식재료(ING) · 레시피(RCP) · 발주(ORD) · 매출관리(SALES) · MY** — 5탭.
(AGENTS.md 는 4탭으로 적혀 있으나 매출관리 탭이 추가되어 실제 구현은 5탭이다. `app/(tabs)/_layout.tsx` 가 실물.)
공통 헤더 패턴: 리스트 화면은 **타이틀(좌, 24·800) + 검색/알림 아이콘(우)**, 그 아래 **밑줄형 탭/카테고리 스트립**(좌측 정렬, 하단 구분선 `#D1D6DB`).

식재료 상세에서 진입하는 재고·구매·폐기 내역 화면의 공통 구조와 컴포넌트 기준은
`docs/식재료-상세-내역화면-공통-UI-가이드.md`를 따른다.

## 화면 인벤토리 — ✅ 구현 / ⬜ 미구현

| 모듈 | 화면 ID | 이름 | 라우트 / 파일 | 상태 |
|---|---|---|---|---|
| `ingredients` | ING-01 | 식재료 리스트 (카테고리 스트립·정렬·소진임박 알림·FAB) | `ingredients/index` (`IngredientListScreen`) | ✅ |
| `ingredients` | ING-02 | 식재료 추가 (등록 폼·단위 시트·단가 미리보기) | `ingredients/add` (`IngredientAddScreen`) | ✅ |
| `ingredients` | ING-03 | 식재료 상세 (잔여·기준단가·로스율·재고 변동·구매이력·구매옵션) | `ingredients/[id]` (`IngredientDetailScreen`) | ✅ |
| `ingredients` | ING-04 | 식재료 수정 (용량·안전재고·최소발주·구매옵션) | `ingredients/edit/[id]` (`IngredientEditScreen`) | ✅ |
| `ingredients` | ING-03b | 재고 추가 (빠른 입고 · 구매 옵션 자동 채움 · 서버 미리보기) → **E7+E1** | `ingredients/add-stock/[id]` (`QuickInboundScreen`) | ✅ |
| `ingredients` | ING-05 | 재고 수정 (수량 조정·완전 소진·폐기) → **E2/E5** | `StockEditSheet`(시트) | ✅ |
| `ingredients` | ING-06 | 구매 링크·옵션 수정 (URL·환산단가·최근 비교) | `ingredients/option` (`PurchaseOptionScreen`) | ✅ |
| `ingredients` | ING-07 | 재고 내역 (변동 원장·기간 필터) | `ingredients/history/[id]` (`StockHistoryScreen`) | ✅ |
| `ingredients` | ING-08 | 조회 설정 (기간·유형·정렬 필터) | `HistoryFilterSheet`(시트) | ✅ |
| `ingredients` | ING-09 | 구매 이력 전체 (건별 단가·단가 범위·기준단가 대조) | `ingredients/purchases/[id]` (`PurchaseHistoryScreen`) | ✅ |
| `ingredients` | ING-10 | 폐기 내역 (탭: 전체·조리 전 폐기·조리 후 폐기) | `ingredients/discards/[id]` (`DiscardHistoryScreen`) | ✅ |
| `ingredients` | — | 메모 수정 (멀티라인·글자수) | `MemoEditSheet`(시트) | ✅ |
| `recipes` | RCP-01 | 레시피 리스트 (정렬·판매상태/목표 필터) | `recipes/index` | ✅ |
| `recipes` | RCP-02 | 레시피 상세 (도넛·손익·재료·고정지출·**세금 항목별**) | `recipes/[id]` | ✅ |
| `recipes` | RCP-03 | 레시피 추가/수정 (세금 시트에서 **세금 항목 추가·삭제**) → **E3** | `recipes/add` | ✅ |
| `recipes` | RCP-09 | 식재료 검색·담기 + 사용량 입력 시트 | `recipes/ingredient-search` | ✅ |
| `recipes` | RCP-11 | 부자재 검색·담기 | `recipes/material-search` (`MaterialSearchScreen`) | ✅ |
| `recipes` | RCP-13 | 부자재 관리 (+ RCP-14 부자재 수정 시트) | `recipes/materials` (`MaterialManageScreen`) | ✅ |
| `recipes` | RCP-07 | 평균 판매량 입력 (기간·환산·배분비율) | `recipes/avg-sales` (`AvgSalesScreen`) | ✅ |
| `recipes` | RCP-16 | 손익 변동 (금액 목록 → 원인·결과 시트, 커서 20건) | `recipes/profit-history` (`ProfitHistoryScreen`) | ✅ |
| `recipes` | RCP-12 | 레시피 카테고리 설정 (추가·수정·삭제) | `recipes/category` (`CategoryScreen`) | ✅ |
| `recipes`→`my` | MY-02 | 고정 지출 자세히 (자세히 보기 진입) | `recipes/fixed-cost` (`my/FixedCostScreen`) | ✅ |
| `recipes`→`my` | MY-02 | 고정 지출 수정 (항목/카드 추가·삭제) → **E4** | `recipes/fixed-cost-edit` (`my/FixedCostEditScreen`) | ✅ |
| `recipes` | RCP-05 | 판매가 시뮬레이션 (상세 내 시트·슬라이더 라이브 재계산) | `recipes/PriceSimSheet`(시트) | ✅ |
| `recipes`→`my` | RCP-15 | 적용 채널·비중 (고정지출 수정 내 시트·슬라이더·합계 검증) | `my/ChannelWeightSheet`(시트) | ✅ |
| `orders` | ORD-01 | 발주 현황 (발주 후보/입고 예정/입고 완료) | `orders/index` | ✅ |
| `orders` | ORD-05 | 주문하기 — 구매 링크·옵션 시트 | (OrdersHome 내 시트) | ✅ |
| `orders` | ORD-06 | 발주 완료 — 구매처 선택 시트 | (OrdersHome 내 시트) | ✅ |
| `orders` | ORD-02 | 발주 완료 등록 (도착 예정일 달력) → **E7** | `orders/complete` (`OrderCompleteScreen`) | ✅ |
| `orders` | ORD-03 | 입고 확정 (실제 수량·부분 입고·멱등키) → **E1** | (OrdersHome 내 시트) | ✅ |
| `orders` | ORD-07 | 발주 취소 → **E12** / 입고 취소 → **E11** | (OrdersHome 카드 버튼) | ✅ |
| `my` | MY-01 | 마이페이지 홈 (사업장 + 설정 메뉴) | `my/index` (`MyHomeScreen`) | ✅ |
| `my` | MY-TAX | 세금 (부가세 · 추가 항목 → 전 레시피 손익 반영) | `my/tax` (`MyTaxScreen`) | ✅ |
| `my` | MY-03 | 카테고리 관리 허브 | `my/categories` (`MyCategoryHubScreen`) | ✅ |
| `my` | MY-03 | 카테고리 편집 | `my/category` (`MyCategoryScreen`) | ✅ |
| `my` | MY-05 | 구매처·브랜드 | `my/vendors` (`MyVendorsScreen`) | ✅ |
| `my` | MY-06 | 알림 설정 | `my/notifications` (`MyNotificationsScreen`) | ✅ |
| `recipes` | RCP-12b | 부자재 카테고리 | `recipes/material-category` (`MaterialCategoryScreen`) | ✅ |
| `sales` | SALES-06 | 기타 매출 추가 (항목·단가·수량) | (SalesHome 내 시트) | ✅ |
| `sales` | SALES-06 | 기타 매출 추가에 **판매 채널** 선택(매장·배달·포장) | `SalesHomeScreen` 시트 | ✅ |
| `sales` | SALES-17 | 폐기 손실 자세히 (조리 폐기 · 식재료 폐기) | `sales/waste` (`SalesWasteScreen`) | ✅ |
| `sales` | SALES-18 | 세금 자세히 (항목별 · 메뉴분/기타분) | `sales/tax` (`SalesTaxScreen`) | ✅ |
| `sales` | SALES-07 | 당일 지출 추가 (항목·금액·메모) | (SalesHome 내 시트) | ✅ |
| `sales` | SALES-05b | 판매 수량 입력 (매장/배달/포장 + **조리 폐기**) → **E10/E8** | (SalesHome 내 시트) | ✅ |
| `sales` | SALES-01 | 매출관리 홈 (일일 판매 입력 + **영업 상태 바**) | `sales/index` (`SalesHomeScreen`) | ✅ |
| `changes` | ING-03b / RCP-02b | 수정 내역 (식재료·레시피 공용 · 전후값·자동 전파·매출 반영 상태) | `ingredients/changes/[id]` · `recipes/changes/[id]` | ✅ |
| `sales` | SALES-01b | 영업중·브레이크타임·영업종료 · 자동 종료 알림 | (SalesHome 내 `BusinessDayBar`) | ✅ |
| `sales` | SALES-02 | 매출 분석 (기간 선택·캘린더·손익) | `sales/analytics` (`SalesAnalyticsScreen`) | ✅ |
| `sales` | SALES-03 | 일 손익 상세 | `sales/day-detail` (`SalesDayDetailScreen`) | ✅ |
| `sales` | SALES-04 | 일 손익 전체 | `sales/day` (`SalesDayFullScreen`) | ✅ |
| `sales` | SALES-05 | 매출 상세 | `sales/revenue` (`SalesRevenueScreen`) | ✅ |
| `sales` | SALES-08 | 메뉴별 손익 (하루=그날 스냅샷 · 기간=날짜별 **합**, 판매가 여럿이면 목록) | `sales/menu` (`SalesMenuDetailScreen`) | ✅ |
| `sales` | SALES-18 | 채널별 손익 | `sales/channel` (`SalesChannelScreen`) | ✅ |
| `sales` | SALES-11 | 재료 원가 상세 | `sales/material` (`SalesMaterialScreen`) | ✅ |
| `sales` | SALES-12 | 부자재 상세 | `sales/extra` (`SalesExtraScreen`) | ✅ |
| `sales` | SALES-13 | 고정 지출 상세 | `sales/fixed` (`SalesFixedScreen`) | ✅ |
| `sales` | SALES-14 | 추가 지출 | `sales/expense` (`SalesExpenseScreen`) | ✅ |
| `my` | MY-04 | 단위 설정 (단위 시스템·조리컵/스푼·묶음 단위·**단가 표기 자릿수**) | `my/units` (`MyUnitsScreen`) | ✅ |
| `my` | MY-08 | 언어·통화 설정 (로케일 → 통화·구분자·소수점·금액 자릿수) | `my/language` (`MyLanguageScreen`) | ✅ |
| `my` | MY-09 | 영업시간 (시작·종료·브레이크 · 영업일 경계) | `my/hours` (`MyHoursScreen`) | ✅ |

> 위 ✅ 는 **실데이터 연결 + 전파 + 재조회**까지 통과한 상태다(2026-08-19).

## 주요 화면 플로우 (수집 → 등록 → 노출)

- **식재료**: 리스트(카테고리·정렬·소진임박) → 카드 탭 **상세** → [수정] 액션시트=식재료 수정/재고 수정(시트)/메모 수정. 상세 **자세히 보기** → 재고 내역(원장·조회 설정 시트). FAB **추가** → 등록 폼(단위 시트·단가 미리보기) → 구매 링크·옵션 수정.
- **레시피**: 리스트 → 카드 탭 **상세**(도넛·손익) → [수정]. 추가 화면에서 **재료 검색·담기**(검색→카드 탭→사용량 입력 시트: 삭제/담기), **추가 지출** 편집행, **고정 지출 자세히 보기** → 자세히 → [수정].
- **발주**: 발주 후보 카드 → **주문하기**(구매 옵션 시트, 외부 주문) / **발주 완료**(구매처 선택 시트 → **발주 완료 등록 ORD-02**, 도착 예정일 달력) → 입고 예정 → **입고 완료**.

## 데이터 — 서버 함수가 화면 단위로 내려준다

화면 한 장이 필요한 값을 **한 번의 호출**로 받는다. 파생값(재고 총량·기준단가·손익)은 전부 서버가
정의하므로 앱이 다시 계산하지 않는다(절대원칙 3).

| 훅 | 서버 함수 | 쓰는 화면 |
|---|---|---|
| `ingredients/hooks` | `ingredient_list` · `ingredient_detail` · `stock_history` | ING-01/03/07 |
| `recipes/hooks` | `recipe_list` · `recipe_detail` · `recipe_pick_list` | RCP-01/02/03 |
| `orders/hooks` | `order_board` | ORD-01 |
| `sales/hooks` | `sales_day` · `sales_range` · `sales_material_usage` · `sales_extra_usage` · `sales_fixed_breakdown` | SALES 전부 |
| `my/hooks` | `settings_lists` · `get_settings` · `sales_channel_fixed` | MY 전부 |

저장은 하나의 함수 = 하나의 트랜잭션이다: `save_ingredient` · `save_recipe` · `save_purchase_option`
· `save_material` · `save_category` · `save_vendor` · `save_channel` · `save_fixed_costs` · `save_sale`.

**편집 중인 폼**만 클라이언트 상태로 둔다(`recipes/draftStore.ts` — 재료·부자재 검색이 별도 화면이라
고른 결과를 폼으로 돌려줘야 한다). 저장 직후 초안은 버린다.

## 표기 규칙 (현재 반영)
- 수량/용량 단위는 **kg·g·ml + 개수(개/모)** 만 노출(망·통·박스·판 등 구매단위 라벨은 표기에서 제거, 상품명/거래처로 분리).
- 구매 옵션 표기: **식재료명 · 용량 · 금액 / 구매처 · 단가**.
- 재고는 최소단위(g/ml/개)의 **총량 하나**로 저장·표시한다. 미개봉/개봉분을 별도 상태로 관리하지 않는다.
- 재고 상태: **여유 / 소진 임박**(2단계, ING 리스트). 발주 후보는 사유(안전재고 미달·곧 소진).
- 숫자 서식은 `@sikjae/core` 의 `locale.ts` 가 단일 출처(`formatMoney`·`formatUnitPrice`·`formatPercent`·`parseNumber`). 축이 둘로 나뉜다:
  - **로케일이 정함**(MY-08 언어·통화): 자릿수 구분자 · 소수점 문자 · 통화기호 · **금액** 소수 자릿수(원·엔·동=0, 그 외=2). 선택지가 아니라 사실이라 사용자는 언어만 고른다.
  - **사용자가 정함**(MY-04 단위 설정): **단가** 소수 자릿수 0~4. 기본값 = 금액 자릿수 + 2 (한국 4.71원/g · 미국 $0.0047/g). 기본값과 같은 값을 고르면 override 를 지워(null) 언어를 바꿔도 새 기본값을 따라간다.
  - 비율(%)은 **소수 1자리 · 절사 고정**(설정 대상 아님) — 4,046.69/12,000 = 33.72% → 33.7%. 반올림하면 검산 기준값과 어긋난다.
  - 서식은 표기 계층 전용. 저장은 항상 최소단위·풀정밀도이고 계산에 되돌아가지 않는다.

## 전파 (E1~E12)

전파 이벤트는 도메인 훅이 호출하고, 성공 후 `invalidateOn` 이 정한 키를 무효화한다.
`src/lib/supabase.ts` 에 있던 `rpc.*` 래퍼는 제거했다 — 훅과 두 갈래가 되면 무효화 규칙이 갈라진다.

특히 **판매(E10)는 매출뿐 아니라 재고도 바꾼다**(E8 소진). 그래서 `invalidateOn.e10()` 은
`sales` 와 함께 `ingredients`·`orders` 도 무효화한다. 이걸 빼면 "팔았는데 식재료 화면은 그대로"가 된다.

메뉴를 팔면 서버가 레시피를 **반제품까지 재귀로 펼쳐** 식재료를 차감한다
(`recipe_ingredient_needs`). 재고가 모자란 채로 팔렸으면 부족분을 돌려주고, 화면이 그대로 알린다 —
판매를 막지는 않는다(이미 팔린 것이므로).
