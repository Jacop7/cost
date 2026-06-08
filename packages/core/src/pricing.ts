/**
 * 단가 계산 — ⑤ 2.3, ① 4.1·8.6.
 * 기준 단가 = 구매이력 가중평균(수량 가중) ÷ (1−로스율).
 * 실측 로스율 = 누적 폐기량 ÷ 누적 구매량.
 */

export interface PurchaseLike {
  amount: number; // 금액 (원)
  volume: number; // 용량 (기준단위)
  qty: number; // 수량 (구매단위 개수)
}

/** 구매 1건의 환산 단가 = 금액 ÷ 용량 (원/기준단위, 로스 미반영). */
export const rawUnitPrice = (amount: number, volume: number): number => amount / volume;

/** 수량 가중 평균 단가 (로스 미반영). 이력 없으면 null. */
export function weightedAvgUnitPrice(purchases: PurchaseLike[]): number | null {
  let pricedQty = 0;
  let weighted = 0;
  for (const p of purchases) {
    const per = rawUnitPrice(p.amount, p.volume);
    weighted += per * p.qty;
    pricedQty += p.qty;
  }
  return pricedQty > 0 ? weighted / pricedQty : null;
}

/** 기준 단가 = 평균 단가 ÷ (1 − 로스율). lossRate 는 0~1. */
export const baseUnitPrice = (avgUnitPrice: number, lossRate: number): number =>
  avgUnitPrice / (1 - lossRate);

/**
 * 등록 미리보기 단가 — 단일 구매가 기준 (① 3.5, A-02).
 * 예: 4,000원 / 1,000g, 로스 15% → 4.71원/g
 */
export const previewBaseUnitPrice = (
  amount: number,
  volume: number,
  lossRate: number,
): number => baseUnitPrice(rawUnitPrice(amount, volume), lossRate);

/** 실측 로스율 = 누적 폐기량 ÷ 누적 구매량 (0~1). 구매 0이면 null. */
export function realLossRate(totalDiscarded: number, totalPurchased: number): number | null {
  return totalPurchased > 0 ? totalDiscarded / totalPurchased : null;
}

/** 입고가가 평균 대비 ±임계% 벗어나는지 (E1 급등 알림 판정, 기본 15%). */
export function isPriceSpike(newUnitPrice: number, avgUnitPrice: number, threshold = 0.15): boolean {
  if (avgUnitPrice <= 0) return false;
  return Math.abs(newUnitPrice - avgUnitPrice) / avgUnitPrice >= threshold;
}
