/**
 * 파생 값 · 스냅샷 테이블 — ⑤ 2.3 계산 맵, ⑦ 4 전파.
 * 입력이 아니라 계산 결과이며, 추이 테이블은 1차부터 적재한다(그래프는 2차).
 */
import type { ID } from './entities';
import type { TrendCause } from './enums';

/** 단가 추이 스냅샷 — E1(입고 확정)에서 점 1개 생성 (① 3.4). */
export interface PriceTrendPoint {
  id: ID;
  storeId: ID;
  ingredientId: ID;
  date: string;
  unitPrice: number; // 환산 단가 (원/기준단위, 로스 반영)
  orderRecordId: ID | null; // 점 → 근거 입고 내역
}

/** 순이익 추이 스냅샷 — 손익에 영향을 주는 권위 전파 경로에서 생성. */
export interface ProfitTrendPoint {
  id: ID;
  storeId: ID;
  recipeId: ID;
  date: string;
  profitRate: number; // 순이익률 (%)
  materialRate: number; // 재료 원가율 (%)
  cause: TrendCause; // 원인 색 점
}

/** 월 손익 (파생) — 매출 − 고정 − 재료비(해당 월 입고 확정 합계) (④ 3). */
export interface MonthlyPL {
  storeId: ID;
  month: string; // 'YYYY-MM'
  revenue: number;
  fixedCost: number;
  materialCost: number; // 해당 월 입고 확정 합계
  profit: number; // = revenue - fixedCost - materialCost
  profitRate: number;
}

/** 식재료 카드/상세에 노출되는 계산 요약 (파생, 저장 안 함 — 조회 시 산출). */
export interface IngredientDerived {
  ingredientId: ID;
  baseUnitPrice: number | null; // 기준 단가 (구매이력 가중평균 ÷ (1−로스율)). 이력 없으면 null('?')
  avgUnitPrice: number | null; // 로스 미반영 평균
  realLossRate: number | null; // 실측 로스율 (누적 폐기 ÷ 누적 구매)
  remainConverted: number; // 잔여 환산량 = 개수 × 개당용량 × (1−로스율)
  badge: 'ok' | 'low' | 'out';
}

/** 레시피 손익 계산 결과 (파생) — ② 3장 공식. */
export interface RecipeProfit {
  recipeId: ID;
  price: number;
  tax: number; // 세금
  materialCost: number; // 재료 원가 = Σ(1인분량 × 기준단가)
  extraCost: number; // 추가 지출 합
  fixedCost: number; // 1개당 고정 지출 배분
  profit: number; // 판매가 − 세금 − 재료 − 고정 − 추가
  profitRate: number;
  materialRate: number;
  lines: { ingredientId: ID; perServingQty: number; lineCost: number }[];
}
