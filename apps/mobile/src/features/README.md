# features/ — 화면 ID ↔ 기능 모듈 매핑

탭별 feature 모듈. 각 모듈은 `screens/`(화면·시트) · `demoData.ts`(임시 데이터)로 구성하고, 추후 `hooks/`(쿼리·뮤테이션)을 더한다.
공통 UI 킷은 `src/components/kit`, 계산은 `@sikjae/core`, 데이터 계약은 `@sikjae/types`.

하단 탭 순서: **식재료(ING) · 레시피(RCP) · 발주(ORD) · MY**.
공통 헤더 패턴: 리스트 화면은 **타이틀(좌, 24·800) + 검색/알림 아이콘(우)**, 그 아래 **밑줄형 탭/카테고리 스트립**(좌측 정렬, 하단 구분선 `#D1D6DB`).

## 화면 인벤토리 — ✅ 구현 / ⬜ 미구현

| 모듈 | 화면 ID | 이름 | 라우트 / 파일 | 상태 |
|---|---|---|---|---|
| `ingredients` | ING-01 | 식재료 리스트 (카테고리 스트립·정렬·소진임박 알림·FAB) | `ingredients/index` (`IngredientListScreen`) | ✅ |
| `ingredients` | ING-02 | 식재료 추가 (등록 폼·단위 시트·단가 미리보기) | `ingredients/add` (`IngredientAddScreen`) | ✅ |
| `ingredients` | ING-03 | 식재료 상세 (잔여·기준단가·재고 변동·구매옵션·수정 액션시트) | `ingredients/[id]` (`IngredientDetailScreen`) | ✅ |
| `ingredients` | ING-04 | 식재료 수정 (용량/로스율/안전·최소발주·옵션) | `ingredients/edit/[id]` (`IngredientEditScreen`) | ✅ |
| `ingredients` | ING-05 | 재고 수정 (수량 조정·완전 소진·폐기) → **E2/E5** | `StockEditSheet`(시트) | ✅ |
| `ingredients` | ING-06 | 구매 링크·옵션 수정 (URL·환산단가·최근 비교) | `ingredients/option` (`PurchaseOptionScreen`) | ✅ |
| `ingredients` | ING-07 | 재고 내역 (변동 원장·기간 필터) | `ingredients/history/[id]` (`StockHistoryScreen`) | ✅ |
| `ingredients` | ING-08 | 조회 설정 (기간·유형·정렬 필터) | `HistoryFilterSheet`(시트) | ✅ |
| `ingredients` | — | 메모 수정 (멀티라인·글자수) | `MemoEditSheet`(시트) | ✅ |
| `recipes` | RCP-01 | 레시피 리스트 (정렬·판매상태/목표 필터) | `recipes/index` | ✅ |
| `recipes` | RCP-02 | 레시피 상세 (도넛·손익·재료·고정지출) | `recipes/[id]` | ✅ |
| `recipes` | RCP-03 | 레시피 추가/수정 → **E3** | `recipes/add` | ✅ |
| `recipes` | RCP-09 | 식재료 검색·담기 + 사용량 입력 시트 | `recipes/ingredient-search` | ✅ |
| `recipes` | RCP-11 | 부자재 검색·담기 | `recipes/material-search` (`MaterialSearchScreen`) | ✅ |
| `recipes` | RCP-13 | 부자재 관리 (+ RCP-14 부자재 수정 시트) | `recipes/materials` (`MaterialManageScreen`) | ✅ |
| `recipes` | RCP-07 | 평균 판매량 입력 (기간·환산·배분비율) | `recipes/avg-sales` (`AvgSalesScreen`) | ✅ |
| `recipes` | RCP-10 | 순이익률 변동 추이 (기간별 라인·min/max) | `recipes/profit-trend` (`ProfitTrendScreen`) | ✅ |
| `recipes` | RCP-16 | 손익 변동 상세 (원장 → 손익표 시트) | `recipes/profit-history` (`ProfitHistoryScreen`) | ✅ |
| `recipes` | RCP-12 | 레시피 카테고리 설정 (추가·수정·삭제) | `recipes/category` (`CategoryScreen`) | ✅ |
| `recipes`→`my` | MY-02 | 고정 지출 자세히 (자세히 보기 진입) | `recipes/fixed-cost` (`my/FixedCostScreen`) | ✅ |
| `recipes`→`my` | MY-02 | 고정 지출 수정 (항목/카드 추가·삭제) → **E4** | `recipes/fixed-cost-edit` (`my/FixedCostEditScreen`) | ✅ |
| `recipes` | RCP-05 | 판매가 시뮬레이션 (상세 내 시트·슬라이더 라이브 재계산) | `recipes/PriceSimSheet`(시트) | ✅ |
| `recipes`→`my` | RCP-15 | 적용 채널·비중 (고정지출 수정 내 시트·슬라이더·합계 검증) | `my/ChannelWeightSheet`(시트) | ✅ |
| `orders` | ORD-01 | 발주 현황 (발주 후보/입고 예정/입고 완료) | `orders/index` | ✅ |
| `orders` | ORD-05 | 주문하기 — 구매 링크·옵션 시트 | (OrdersHome 내 시트) | ✅ |
| `orders` | ORD-06 | 발주 완료 — 구매처 선택 시트 | (OrdersHome 내 시트) | ✅ |
| `orders` | ORD-02 | 발주 완료 등록 (도착 예정일 달력) → **E7** | `orders/complete` (`OrderCompleteScreen`) | ✅ |
| `orders` | ORD-03 | 입고 확정 → **E1** | — (입고 완료 버튼 자리만) | ⬜ |
| `orders` | ORD-04 | 레시피 계산기 → **E6** (2차) | — | ⬜ |
| `my` | MY-01 | 마이페이지 홈 | `my/index` | ⬜(스캐폴드) |
| `my` | MY-03·05~06 | 카테고리·구매처·알림 | — | ⬜ |
| `my` | MY-04 | 단위 설정 (단위 시스템·조리컵/스푼·묶음 단위·**단가 표기 자릿수**) | `my/units` (`MyUnitsScreen`) | ✅ |
| `my` | MY-08 | 언어·통화 설정 (로케일 → 통화·구분자·소수점·금액 자릿수) | `my/language` (`MyLanguageScreen`) | ✅ |

## 주요 화면 플로우 (수집 → 등록 → 노출)

- **식재료**: 리스트(카테고리·정렬·소진임박) → 카드 탭 **상세** → [수정] 액션시트=식재료 수정/재고 수정(시트)/메모 수정. 상세 **자세히 보기** → 재고 내역(원장·조회 설정 시트). FAB **추가** → 등록 폼(단위 시트·단가 미리보기) → 구매 링크·옵션 수정.
- **레시피**: 리스트 → 카드 탭 **상세**(도넛·손익) → [수정]. 추가 화면에서 **재료 검색·담기**(검색→카드 탭→사용량 입력 시트: 삭제/담기), **추가 지출** 편집행, **고정 지출 자세히 보기** → 자세히 → [수정].
- **발주**: 발주 후보 카드 → **주문하기**(구매 옵션 시트, 외부 주문) / **발주 완료**(구매처 선택 시트 → **발주 완료 등록 ORD-02**, 도착 예정일 달력) → 입고 예정 → **입고 완료**.

## 데이터 (현재 데모, Supabase 연동 전)
- `ingredients/demoData.ts`: `IngCardData`(잔여·기준단가·avg/low/high·loss·safe·vendor·memo) · `DETAIL_EXTRAS`(추이·구매이력·옵션) · `getIngredient` · `perLabel`.
- `recipes/demoData.ts`: `DEMO_RECIPES` · `RECIPE_DETAILS`(라인·추가지출) · `FIXED_ITEMS` · `recipeProfit`(손익 계산) · `pct`.
- `orders/demoData.ts`: `CANDIDATES`(사유·권장발주·옵션) · `WAITING`(입고 예정) · `DONE`(입고 완료) · `OrderOption`.

## 표기 규칙 (현재 반영)
- 수량/용량 단위는 **kg·g·ml + 개수(개/모)** 만 노출(망·통·박스·판 등 구매단위 라벨은 표기에서 제거, 상품명/거래처로 분리).
- 구매 옵션 표기: **식재료명 · 용량 · 금액 / 구매처 · 단가**.
- 재고 상태: **여유 / 소진 임박**(2단계, ING 리스트). 발주 후보는 사유(안전재고 미달·곧 소진).
- 숫자 서식은 `@sikjae/core` 의 `locale.ts` 가 단일 출처(`formatMoney`·`formatUnitPrice`·`formatPercent`·`parseNumber`). 축이 둘로 나뉜다:
  - **로케일이 정함**(MY-08 언어·통화): 자릿수 구분자 · 소수점 문자 · 통화기호 · **금액** 소수 자릿수(원·엔·동=0, 그 외=2). 선택지가 아니라 사실이라 사용자는 언어만 고른다.
  - **사용자가 정함**(MY-04 단위 설정): **단가** 소수 자릿수 0~4. 기본값 = 금액 자릿수 + 2 (한국 4.71원/g · 미국 $0.0047/g). 기본값과 같은 값을 고르면 override 를 지워(null) 언어를 바꿔도 새 기본값을 따라간다.
  - 비율(%)은 **소수 1자리 · 절사 고정**(설정 대상 아님) — 4,014/12,000 = 33.45% → 33.4%. 반올림하면 검산 기준값과 어긋난다.
  - 서식은 표기 계층 전용. 저장은 항상 최소단위·풀정밀도이고 계산에 되돌아가지 않는다.

전파 이벤트(E1~E7)는 `src/lib/supabase.ts` 의 `rpc.*` 로 호출하고, 성공 후 `qk` 키를 무효화한다(현재는 데모 데이터, 연동 예정).
