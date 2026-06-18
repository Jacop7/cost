# features/ — 화면 ID ↔ 기능 모듈 매핑

탭별 feature 모듈. 각 모듈은 `screens/`(화면·시트) · `demoData.ts`(임시 데이터)로 구성하고, 추후 `hooks/`(쿼리·뮤테이션)을 더한다.
공통 UI 킷은 `src/components/kit`, 계산은 `@sikjae/core`, 데이터 계약은 `@sikjae/types`.

하단 탭 순서: **식재료(ING) · 레시피(RCP) · 발주(ORD) · MY**.
공통 헤더 패턴: 리스트 화면은 **타이틀(좌, 24·800) + 검색/알림 아이콘(우)**, 그 아래 **밑줄형 탭/카테고리 스트립**(좌측 정렬, 하단 구분선 `#D1D6DB`).

## 화면 인벤토리 — ✅ 구현 / ⬜ 미구현

| 모듈 | 화면 ID | 이름 | 라우트 / 파일 | 상태 |
|---|---|---|---|---|
| `ingredients` | ING-01 | 식재료 리스트 (카테고리 필터·정렬·소진임박 알림) | `ingredients/index` | ✅ |
| `ingredients` | ING-02 | 식재료 상세 (잔여·기준단가·최근 주문내역·구매옵션) | `ingredients/[id]` | ✅ |
| `ingredients` | ING-03 | 식재료 추가 (등록 폼·단가 미리보기) | `ingredients/add` | ✅ |
| `ingredients` | ING-04 | 재고 수정 (미개봉/개봉·완전소진·폐기) → **E2/E5** | `StockAdjustSheet`(시트) | ✅ |
| `ingredients` | ING-05 | 구매 링크·옵션 추가 (URL 추출·환산단가 비교) | `ingredients/option` | ✅ |
| `ingredients` | — | 식재료 수정 | `ingredients/edit` (`IngredientEditScreen`) | ✅ |
| `ingredients` | — | 메모 수정 | `MemoEditSheet`(시트) | ✅ |
| `recipes` | RCP-01 | 레시피 리스트 (정렬·판매상태/목표 필터) | `recipes/index` | ✅ |
| `recipes` | RCP-02 | 레시피 상세 (도넛·손익·재료·고정지출) | `recipes/[id]` | ✅ |
| `recipes` | RCP-03 | 레시피 추가/수정 → **E3** | `recipes/add` | ✅ |
| `recipes` | RCP-09 | 식재료 검색·담기 + 사용량 입력 시트 | `recipes/ingredient-search` | ✅ |
| `recipes`→`my` | MY-02 | 고정 지출 자세히 (자세히 보기 진입) | `recipes/fixed-cost` (`my/FixedCostScreen`) | ✅ |
| `recipes`→`my` | MY-02 | 고정 지출 수정 (항목/카드 추가·삭제) → **E4** | `recipes/fixed-cost-edit` (`my/FixedCostEditScreen`) | ✅ |
| `recipes` | RCP-05 | 판매가 시뮬레이션 (2차) | — | ⬜ |
| `orders` | ORD-01 | 발주 현황 (발주 후보/입고 예정/입고 완료) | `orders/index` | ✅ |
| `orders` | ORD-05 | 주문하기 — 구매 링크·옵션 시트 | (OrdersHome 내 시트) | ✅ |
| `orders` | ORD-06 | 발주 완료 — 구매처 선택 시트 | (OrdersHome 내 시트) | ✅ |
| `orders` | ORD-02 | 발주 완료 등록 (도착 예정일 달력) → **E7** | `orders/complete` (`OrderCompleteScreen`) | ✅ |
| `orders` | ORD-03 | 입고 확정 → **E1** | — (입고 완료 버튼 자리만) | ⬜ |
| `orders` | ORD-04 | 레시피 계산기 → **E6** (2차) | — | ⬜ |
| `my` | MY-01 | 마이페이지 홈 | `my/index` | ⬜(스캐폴드) |
| `my` | MY-03~07 | 카테고리·단위·구매처·알림·월손익 | — | ⬜ |

## 주요 화면 플로우 (수집 → 등록 → 노출)

- **식재료**: 리스트(검색·카테고리·정렬) → 카드 탭 **상세** → [수정]=편집/[메모]=메모시트/[재고 수정]=재고시트. FAB **추가** → 등록 폼(단가 미리보기) → 구매 링크·옵션 추가.
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

전파 이벤트(E1~E7)는 `src/lib/supabase.ts` 의 `rpc.*` 로 호출하고, 성공 후 `qk` 키를 무효화한다(현재는 데모 데이터, 연동 예정).
