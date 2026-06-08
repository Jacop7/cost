/**
 * 고정 지출 계산 — ② 2.4·3.3, ④ 2·3.
 * 고정지출률 = 월 고정 합계 ÷ 월매출. 1개 고정 지출 = 률 × 판매가 (총액 모드 1차).
 * (2차) 메뉴별 정밀 배분 = 월 고정 × 판매 비중 ÷ 월 판매량.
 */

/** 월 고정 지출 합계. */
export const fixedCostTotal = (itemTotals: number[]): number =>
  itemTotals.reduce((a, b) => a + b, 0);

/** 고정지출률 (0~1). 매출 0/미입력이면 null → 레시피 잠정 처리(A-04, G-07). */
export function fixedCostRate(monthlyFixedTotal: number, monthlyRevenue: number): number | null {
  return monthlyRevenue > 0 ? monthlyFixedTotal / monthlyRevenue : null;
}

/** 1,000원당 고정 지출(원). 률 × 1000. */
export const fixedCostPerThousand = (rate: number): number => rate * 1000;

/** 메뉴 1개당 고정 지출 (총액 모드): 률 × 판매가. */
export const fixedCostPerServingSimple = (rate: number, price: number): number => rate * price;

/**
 * (2차) 메뉴별 판매 비중 배분: 월 고정 × (메뉴 판매량 / 전체 판매량) ÷ 메뉴 판매량
 * = 월 고정 ÷ 전체 판매량. (균등 분모지만 비중 기반 검산 경로 유지)
 */
export function fixedCostPerServingAllocated(
  monthlyFixedTotal: number,
  totalMonthlySales: number,
): number {
  return totalMonthlySales > 0 ? monthlyFixedTotal / totalMonthlySales : 0;
}
