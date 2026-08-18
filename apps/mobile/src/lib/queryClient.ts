import { QueryClient } from '@tanstack/react-query';

/** 전역 쿼리 클라이언트. 전파 RPC 후 관련 key 무효화로 화면 정합 유지. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

/**
 * 쿼리 키 — 전파 이벤트 후 무효화 대상 매핑의 **단일 출처**.
 *
 * 규칙:
 *   1. 도메인마다 **루트 키**를 둔다. 루트를 무효화하면 그 도메인의 모든 하위 쿼리가 함께 갱신된다.
 *      (react-query 는 접두 일치로 무효화한다 — `['orders']` 는 `['orders','waiting']` 도 무효화한다.)
 *   2. 키 조각은 **케밥이 아니라 배열 분리**로 표현한다. `'monthly-pl'` 처럼 한 조각에 뭉치면
 *      상위 무효화가 불가능하다.
 *   3. 화면에서 문자열 리터럴을 직접 쓰지 않는다. 오타는 조용한 캐시 미스로 남는다.
 */
export const qk = {
  // ── 식재료 ──────────────────────────────────────────────────
  ingredients: ['ingredients'] as const,
  ingredient: (id: string) => ['ingredients', id] as const,
  /** 재고 변동 원장(ING-07). 식재료 상세와 함께 갱신돼야 한다. */
  stockHistory: (id: string) => ['ingredients', id, 'history'] as const,
  purchaseOptions: (id: string) => ['ingredients', id, 'options'] as const,
  priceTrends: (id: string) => ['ingredients', id, 'price-trends'] as const,

  // ── 발주 ────────────────────────────────────────────────────
  orders: ['orders'] as const,
  candidates: ['orders', 'candidates'] as const,
  waiting: ['orders', 'waiting'] as const,
  received: ['orders', 'received'] as const,

  // ── 레시피 ──────────────────────────────────────────────────
  recipes: ['recipes'] as const,
  recipe: (id: string) => ['recipes', id] as const,
  profitTrends: (id: string) => ['recipes', id, 'profit-trends'] as const,
  materials: ['recipes', 'materials'] as const,

  // ── 매출 ────────────────────────────────────────────────────
  sales: ['sales'] as const,
  /** 일별 장부 한 장. */
  salesDay: (date: string) => ['sales', 'day', date] as const,
  /** 기간 집계(sales_summary). from~to 가 다르면 다른 쿼리다. */
  salesSummary: (from: string, to: string) => ['sales', 'summary', from, to] as const,
  salesChannels: ['sales', 'channels'] as const,

  // ── 설정·집계 ───────────────────────────────────────────────
  settings: ['settings'] as const,
  categories: ['settings', 'categories'] as const,
  vendors: ['settings', 'vendors'] as const,
  fixedCosts: (month: string) => ['fixed-costs', month] as const,
  monthlyPL: (month: string) => ['monthly', 'pl', month] as const,

  /** 매장 컨텍스트(세션에서 해석). 로그인 상태가 바뀌면 전부 다시 받아야 한다. */
  store: ['store'] as const,
} as const;

/**
 * 전파 이벤트 → 무효화해야 하는 쿼리 키 목록.
 *
 * 가이드 §8.2 전파 계약 매트릭스를 코드로 옮긴 것이다. 화면마다 무효화 목록을 손으로 적으면
 * 한 곳이 빠져 "저장했는데 다른 화면은 옛 값"이 된다.
 */
export const invalidateOn = {
  /** E1 입고: 재고·단가·이력·추이·후보·영향 레시피·월 재료비가 모두 바뀐다. */
  e1: (ingredientId: string) => [qk.ingredients, qk.ingredient(ingredientId), qk.stockHistory(ingredientId), qk.priceTrends(ingredientId), qk.orders, qk.recipes, qk.monthlyPL, qk.sales],
  /** E2 폐기: 재고·잔량·실측 로스율·기준단가·영향 레시피. 주문 기록은 불변. */
  e2: (ingredientId: string) => [qk.ingredients, qk.ingredient(ingredientId), qk.stockHistory(ingredientId), qk.recipes],
  /** E3 레시피 저장: 레시피와 손익 추이. 재고·단가·주문은 불변. */
  e3: (recipeId: string) => [qk.recipes, qk.recipe(recipeId), qk.profitTrends(recipeId)],
  /** E4 고정지출: 같은 매장 **전 레시피** 손익과 월 손익. */
  e4: () => [qk.recipes, qk.fixedCosts, qk.monthlyPL, qk.sales],
  /** E5 재고 실사: 재고 상태·이력·뱃지·후보. 기준단가와 주문 기록은 불변. */
  e5: (ingredientId: string) => [qk.ingredients, qk.ingredient(ingredientId), qk.stockHistory(ingredientId), qk.candidates],
  /** E7 발주 등록: 주문 기록과 후보 상태만. **재고·단가는 절대 무효화 대상이 아니다**(불변식 2). */
  e7: () => [qk.orders, qk.candidates],
} as const;
