# features/ — 화면 ID ↔ 기능 모듈 매핑

탭별 화면 도메인은 주로 `screens/`(화면·시트) + `hooks.ts`(조회·저장)로 구성한다.
여러 화면 도메인이 함께 쓰는 영업일·설정·마스터 데이터는 아래 공용 논리 경계가 소유한다.
**`demoData.ts` 는 전부 제거됐다** — 모든 화면이 Supabase 실데이터를 쓴다.
공통 UI 킷은 `src/components/kit`, 계산은 `@sikjae/core`가 맡는다. Supabase 생성 타입은
`@sikjae/db`, `TaxItem`·`StockBadge` 같은 소형 수기 계약은 `@sikjae/types`가 맡는다.

화면은 Supabase를 직접 부르지 않는다. 서버 접근은 `features/*/hooks.ts`와
`features/business-day/businessDay.ts`가 소유한다. 공유 쿼리 루트와 전파 이벤트별 무효화 범위는
`src/lib/queryClient.ts`의 `qk`·`invalidateOn`이 소유한다. 화면 전용 보조 키는 해당 도메인 훅이 소유한다.

하단 탭 순서: **식재료(ING) · 레시피(RCP) · 발주(ORD) · 매출관리(SALES) · MY** — 5탭.
`app/(tabs)/_layout.tsx`와 `AGENTS.md`가 같은 순서를 사용한다.
공통 헤더 패턴: 리스트 화면은 **타이틀(좌, 24·800) + 검색/알림 아이콘(우)**, 그 아래 **밑줄형 탭/카테고리 스트립**(좌측 정렬, 하단 구분선 `#D1D6DB`).

식재료 상세에서 진입하는 재고·구매·폐기 내역 화면의 공통 구조와 컴포넌트 기준은
`docs/식재료-상세-내역화면-공통-UI-가이드.md`를 따르며, 구현은
`src/components/history/HistoryLayout.tsx`가 소유한다.

## 공용 논리 경계

| 경계 | 책임 | 사용 범위 |
|---|---|---|
| `features/business-day` | 서버 영업일·매장 현지 날짜, 영업 상태 전이, `BusinessDateGate` | 매출·발주·입고·이력 화면 |
| `features/settings/hooks.ts` | 매장 설정 계약·저장, 세금, 영업시간, 매장 시간대 | MY 설정 화면과 설정 소비 화면 |
| `features/master-data/hooks.ts` | 카테고리·구매처·판매 채널·부자재 조회·저장 | 식재료·레시피·MY 화면 |
| `src/lib/date.ts` | 기기 시계 없이 서버가 준 날짜를 다루는 순수 산술·표기 | 기간 조회와 날짜 머리글 |
| `src/lib/rpcValue.ts` | nullable 여부를 보존하는 공통 RPC 숫자·문자열 변환 | 도메인 응답 매핑 훅 |
| `features/sales/period.ts` | 매출 기간 프리셋 | 매출 분석 화면 |
| `components/history/HistoryLayout.tsx` | 재고·구매·폐기 이력 공통 레이아웃 | 식재료 이력 화면 |

`features/my/hooks.ts`에는 MY가 소유하는 고정 지출·매장명·채널 고정비·매출 확인만 둔다.
옛 위치의 재수출 파일은 두지 않으며, 경계 이동은 `tests/domainBoundaries.test.ts`가 검사한다.

## 화면 인벤토리 — ✅ 구현 / ⬜ 미구현

| 모듈 | 화면 ID | 이름 | 라우트 / 파일 | 상태 |
|---|---|---|---|---|
| `ingredients` | ING-01 | 식재료 리스트 (카테고리 스트립·정렬·소진임박 알림·FAB) | `ingredients/index` (`IngredientListScreen`) | ✅ |
| `ingredients` | ING-02 | 식재료 추가 (등록 폼·단위 시트·단가 미리보기) | `ingredients/add` (`IngredientAddScreen`) | ✅ |
| `ingredients` | ING-03 | 식재료 상세 (잔여·기준단가·로스율·재고 변동·구매이력·구매옵션) | `ingredients/[id]` (`IngredientDetailScreen`) | ✅ |
| `ingredients` | ING-04 | 식재료 수정 (용량·안전재고·최소발주·구매옵션) | `ingredients/edit/[id]` (`IngredientEditScreen`) | ✅ |
| `ingredients` | ING-03b | 재고 추가 (빠른 입고 · 구매 옵션 자동 채움 · 서버 미리보기) → **E7+E1** | `ingredients/add-stock/[id]` (`QuickInboundScreen`) | ✅ |
| `ingredients` | ING-05 | 재고 수정 (수량 조정·완전 소진·폐기) → **E2/E5** | `StockEditSheet`(시트) | ✅ |
| `ingredients` | ING-06 | 구매 링크·옵션 수정 | `ingredients/option` (`PurchaseOptionScreen`) | ✅ |
| `ingredients` | ING-07 | 재고 내역 (변동 원장·기간 필터) | `ingredients/history/[id]` (`StockHistoryScreen`) | ✅ |
| `ingredients` | ING-08 | 조회 설정 (기간·유형·정렬 필터) | `HistoryFilterSheet`(시트) | ✅ |
| `ingredients` | ING-09 | 구매 이력 전체 (건별 단가·단가 범위·기준단가 대조) | `ingredients/purchases/[id]` (`PurchaseHistoryScreen`) | ✅ |
| `ingredients` | ING-10 | 폐기 내역 (탭: 전체·조리 전 폐기·조리 후 폐기) | `ingredients/discards/[id]` (`DiscardHistoryScreen`) | ✅ |
| `ingredients` | — | 메모 수정 (멀티라인·글자수) | `MemoEditSheet`(시트) | ✅ |
| `recipes` | RCP-01 | 레시피 리스트 (정렬·판매상태/목표 필터) | `recipes/index` | ✅ |
| `recipes` | RCP-02 | 레시피 상세 (도넛·손익·재료·고정지출·**세금 항목별**) | `recipes/[id]` | ✅ |
| `recipes` | RCP-03 | 레시피 추가/수정 (재료·부자재·추가 지출·목표율) → **E3** | `recipes/add` | ✅ |
| `recipes` | RCP-10 | 식재료 검색·담기 + 사용량 입력 시트 | `recipes/ingredient-search` (`RecipeIngredientSearchScreen`) | ✅ |
| `recipes` | RCP-11 | 부자재 검색·담기 | `recipes/material-search` (`MaterialSearchScreen`) | ✅ |
| `recipes` | RCP-13 | 부자재 관리 (+ RCP-14 부자재 수정 시트) | `recipes/materials` (`MaterialManageScreen`) | ✅ |
| `recipes` | RCP-07 | 평균 판매량 입력 (기간·환산·배분비율) | `recipes/avg-sales` (`AvgSalesScreen`) | ✅ |
| `recipes` | RCP-16 | 손익 변동 (금액 목록 → 원인·결과 시트, 커서 20건) | `recipes/profit-history` (`ProfitHistoryScreen`) | ✅ |
| `recipes` | RCP-12 | 레시피 카테고리 설정 (추가·수정·삭제) | `recipes/category` (`CategoryScreen`) | ✅ |
| `recipes`→`my` | MY-05 | 고정 지출 자세히 (자세히 보기 진입) | `recipes/fixed-cost` (`my/FixedCostScreen`) | ✅ |
| `recipes`→`my` | MY-05b | 고정 지출 수정 (항목/카드 추가·삭제) → **E4** | `recipes/fixed-cost-edit` (`my/FixedCostEditScreen`) | ✅ |
| `recipes` | RCP-05 | 판매가 시뮬레이션 (상세 내 시트·슬라이더 라이브 재계산) | `recipes/PriceSimSheet`(시트) | ✅ |
| `recipes`→`my` | RCP-15 | 적용 채널·비중 (고정지출 수정 내 시트·슬라이더·합계 검증) | `my/ChannelWeightSheet`(시트) | ✅ |
| `orders` | ORD-01 | 발주 현황 (발주 후보/입고 예정/입고 완료) | `orders/index` | ✅ |
| `orders` | ORD-05 | 주문하기 — 구매 링크·옵션 시트 | (OrdersHome 내 시트) | ✅ |
| `orders` | ORD-06 | 발주 완료 — 구매처 선택 시트 | (OrdersHome 내 시트) | ✅ |
| `orders` | ORD-02 | 발주 완료 등록 (도착 예정일 달력) → **E7** | `orders/complete` (`OrderCompleteScreen`) | ✅ |
| `orders` | ORD-03 | 입고 확정 (실제 수량·부분 입고·멱등키) → **E1** | (OrdersHome 내 시트) | ✅ |
| `orders` | ORD-07 | 발주 취소 → **E12** / 입고 취소 → **E11** | (OrdersHome 카드 버튼) | ✅ |
| `my` | MY-01 | 마이페이지 홈 (사업장 + 설정 메뉴) | `my/index` (`MyHomeScreen`) | ✅ |
| `my` | MY-02 | 세금 (부가세 · 추가 항목 → 전 레시피 손익 반영) | `my/tax` (`MyTaxScreen`) | ✅ |
| `my` | MY-03 | 카테고리 관리 허브 | `my/categories` (`MyCategoryHubScreen`) | ✅ |
| `my` | MY-03a | 카테고리 편집 | `my/category` (`MyCategoryScreen`) | ✅ |
| `my` | MY-11 | 구매처·브랜드 | `my/vendors` (`MyVendorsScreen`) | ✅ |
| `my` | MY-06 | 알림 설정 | `my/notifications` (`MyNotificationsScreen`) | ✅ |
| `my` | MY-07 | 판매 채널 이름·사용 여부 | `my/channels` (`MyChannelsScreen`) | ✅ |
| `recipes` | RCP-12b | 부자재 카테고리 | `recipes/material-category` (`MaterialCategoryScreen`) | ✅ |
| `sales` | SALES-06 | 기타 매출 추가 (항목·단가·수량·**판매 채널** 선택) | `SalesHomeScreen` 시트 | ✅ |
| `sales` | SALES-17 | 폐기 손실 자세히 (조리 폐기 · 식재료 폐기) | `sales/waste` (`SalesWasteScreen`) | ✅ |
| `sales` | SALES-18 | 세금 자세히 (항목별 · 메뉴분/기타분) | `sales/tax` (`SalesTaxScreen`) | ✅ |
| `sales` | SALES-07 | 당일 지출 추가 (항목·금액·메모) | (SalesHome 내 시트) | ✅ |
| `sales` | SALES-05b | 판매 수량 입력 (매장/배달/포장 + **조리 폐기**) → **E10/E8** | (SalesHome 내 시트) | ✅ |
| `sales` | SALES-01 | 매출관리 홈 (일일 판매 입력 + **영업 상태 바**) | `sales/index` (`SalesHomeScreen`) | ✅ |
| `changes` | ING-11 | 식재료 수정 내역 (전후값·자동 전파·매출 반영 상태) | `ingredients/changes/[id]` (`ChangeHistoryScreen`) | ✅ |
| `changes` | RCP-02b | 레시피 수정 내역 (전후값·자동 전파·매출 반영 상태) | `recipes/changes/[id]` (`ChangeHistoryScreen`) | ✅ |
| `sales` | SALES-01b | 영업중·브레이크타임·영업종료 (전이 한 문 · 자동 브레이크는 서버 크론) | (SalesHome 내 `BusinessDayBar`) | ✅ |
| `sales` | SALES-02 | 매출 분석 (기간 선택·캘린더·손익) | `sales/analytics` (`SalesAnalyticsScreen`) | ✅ |
| `sales` | SALES-03 | 일 손익 상세 | `sales/day` (`SalesDayDetailScreen`) | ✅ |
| `sales` | SALES-10 | 손익 전체 자세히 | `sales/day-detail` (`SalesDayFullScreen`) | ✅ |
| `sales` | SALES-12 | 매출 상세 | `sales/revenue` (`SalesRevenueScreen`) | ✅ |
| `sales` | SALES-09 | 메뉴 손익 상세 (하루=그날 스냅샷 · 기간=날짜별 **합**) | `sales/menu` (`SalesMenuDetailScreen`) | ✅ |
| `sales` | SALES-04 | 채널별 손익 | `sales/channel` (`SalesChannelScreen`) | ✅ |
| `sales` | SALES-13 | 재료 원가 상세 (+ SALES-14 재료별 사용 메뉴 시트) | `sales/material` (`SalesMaterialScreen`) | ✅ |
| `sales` | SALES-15 | 부자재 상세 (+ SALES-16 부자재별 사용 메뉴 시트) | `sales/extra` (`SalesExtraScreen`) | ✅ |
| `sales` | SALES-11 | 고정 지출 상세 | `sales/fixed` (`SalesFixedScreen`) | ✅ |
| `sales` | SALES-20 | 추가 지출 | `sales/expense` (`SalesExpenseScreen`) | ✅ |
| `sales` | SALES-19 | 부족 메뉴·식재료 재고 확인 | `sales/stock-check` (`SalesStockCheckScreen`) | ✅ |
| `sales` | SALES-21 | 과거 판매 내역 수정·추가 (§6.4 · 다시 열지 않고 정정) | `sales/past` (`SalesPastEditScreen`) | ✅ |
| `my` | MY-04 | 단위 설정 (미터법 표시·1컵 용량·**단가 표기 자릿수**) | `my/units` (`MyUnitsScreen`) | ✅ |
| `my` | MY-08 | 언어·통화 설정 (로케일 → 통화·구분자·소수점·금액 자릿수) | `my/language` (`MyLanguageScreen`) | ✅ |
| `my` | MY-09 | 영업시간 (요일별 시간·브레이크 · 매장 시간대 · 영업일 경계) | `my/hours` (`MyHoursScreen`) | ✅ |
| `my` | MY-10 | 계정 관리 (탈퇴 시 접근 종료 · 매장/거래 원장 보존 안내) | `my/account` (`MyAccountScreen`) | ✅ |

> 위 ✅ 는 **실데이터 연결 + 전파 + 재조회**까지 구현된 현재 인벤토리다(2026-08-29).

## 주요 화면 플로우 (수집 → 등록 → 노출)

- **식재료**: 리스트(카테고리·정렬·소진임박) → 카드 탭 **상세** → [수정] 액션시트=식재료 수정/재고 수정(시트)/메모 수정. 상세 **자세히 보기** → 재고 내역(원장·조회 설정 시트). FAB **추가** → 등록 폼(단위 시트·단가 미리보기) → 구매 링크·옵션 수정.
- **레시피**: 리스트 → 카드 탭 **상세**(도넛·손익) → [수정]. 추가 화면에서 **재료 검색·담기**(검색→카드 탭→사용량 입력 시트: 삭제/담기), **추가 지출** 편집행, **고정 지출 자세히 보기** → 자세히 → [수정].
- **발주**: 발주 후보 카드 → **주문하기**(구매 옵션 시트, 외부 주문) / **발주 완료**(구매처 선택 시트 → **발주 완료 등록 ORD-02**, 도착 예정일 달력) → 입고 예정 → **입고 완료**.

## 데이터 — 서버 함수가 화면 단위로 내려준다

조회 함수는 화면이 필요한 응답 단위를 소유한다. 화면에 따라 한 RPC 또는 명시적 보조 조회를 사용하지만,
파생값(재고 총량·기준단가·손익)은 서버가 정의하므로 앱이 다시 계산하지 않는다(절대원칙 3).

| 훅 | 서버 함수 | 쓰는 화면 |
|---|---|---|
| `ingredients/hooks` | `ingredient_list` · `ingredient_detail` · `stock_history` | ING-01/03/07 |
| `recipes/hooks` | `recipe_list` · `recipe_detail` · `recipe_pick_list` | RCP-01/02/03 |
| `orders/hooks` | `order_board` | ORD-01 |
| `sales/hooks` | `sales_day` · `sales_range` · `sales_material_usage` · `sales_extra_usage` · `sales_fixed_breakdown` · `amend_ended_business_day` | SALES 전부 |
| `business-day/businessDay` | `business_day_state` · `transition_business_state` · `day_menu_basis` | 영업 상태·서버 날짜를 쓰는 화면 |
| `settings/hooks` | `get_settings` · `save_settings` · `save_store_tax` · `operating_hours_status` · `set_operating_hours` · `set_store_timezone` | MY 설정과 설정 소비 화면 |
| `master-data/hooks` | `settings_lists` · 카테고리·구매처·채널·부자재 저장 함수 | 식재료·레시피·MY 관리 화면 |
| `my/hooks` | `fixed_costs_monthly` · `save_fixed_costs` · 매장명 · `sales_channel_fixed` · `fixed_cost_revenue_check` | MY·레시피·매출 화면 |

저장은 하나의 함수 = 하나의 트랜잭션이다: `save_ingredient` · `save_recipe` · `save_purchase_option`
· `save_material` · `save_category` · `save_vendor` · `save_channel` · `save_fixed_costs` · `save_sale`.

**편집 중인 폼**만 클라이언트 상태로 둔다(`recipes/draftStore.ts` — 재료·부자재 검색이 별도 화면이라
고른 결과를 폼으로 돌려줘야 한다). 저장 직후 초안은 버린다.

## 표기 규칙 (현재 반영)
- 수량/용량 단위는 **kg·g·ml + 개수(개/모)** 만 노출(망·통·박스·판 등 구매단위 라벨은 표기에서 제거, 상품명/거래처로 분리).
- 구매 옵션 표기: **식재료명 · 용량 · 금액 / 구매처 · 단가**.
- 재고는 최소단위(g/ml/개)의 **총량 하나**로 저장·표시한다. 미개봉/개봉분을 별도 상태로 관리하지 않는다.
- 재고 상태: **여유 / 소진 임박 / 소진** 3단계. 0 이하는 소진이며 음수 수량을 그대로 표시한다.
  발주 후보는 별도로 안전재고 미달·곧 소진 사유를 가진다.
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

메뉴를 팔면 서버가 그날 스냅샷의 **직접 식재료 라인** 필요량을 전부 차감한다. 반제품은 1차 범위 밖이라
`recipe_lines_no_sub_recipe` 제약과 `save_recipe`가 입력을 막는다. 재고가 모자라도 가용량으로 자르지
않고 필요량 전부를 원장에 기록해 음수 잔액을 보존한다. 화면은 부족을 알리되 판매를 막지 않는다.
