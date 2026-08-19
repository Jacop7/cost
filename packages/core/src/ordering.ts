/**
 * 발주 후보·권장 수량 — ③ 2.2·3, ⑤ 2.3.
 * 권장 발주 수량 = Ceil(부족 gross ÷ 개당 용량), 최소발주단위로 보정.
 */

/**
 * 권장 발주 수량(개수).
 * shortageGross: 부족한 양(기준단위, 로스 미반영 gross). perVolume: 개당 용량.
 * minOrderQty: 최소 발주 개수.
 */
export function recommendedOrderQty(
  shortageGross: number,
  perVolume: number,
  minOrderQty = 1,
): number {
  if (shortageGross <= 0) return 0;
  const need = Math.ceil(shortageGross / perVolume);
  return Math.max(need, minOrderQty);
}
