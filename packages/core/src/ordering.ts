/**
 * 안전재고 부족량과 선택한 구매 옵션의 발주 수량 미리보기.
 */

/**
 * 구매 옵션의 실제 용량으로만 환산한다. 식재료 기본 용량·최소 발주는 사용하지 않는다.
 */
export function recommendedOrderQty(
  shortageGross: number,
  perVolume: number,
): number {
  if (!Number.isFinite(shortageGross) || !Number.isFinite(perVolume) || shortageGross <= 0 || perVolume <= 0) return 0;
  return Math.ceil(shortageGross / perVolume);
}

/** 음수 재고도 부족량에 포함한다. */
export function safetyStockShortage(stockTotal: number, safetyTotal: number): number {
  return Math.max(0, safetyTotal - stockTotal);
}
