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

/**
 * 레시피 계산 역산 (E6): 메뉴×인분 → 식재료별 필요량 합산.
 * lines 는 식재료별 1인분 소요량 목록. 부족분 = 필요 − 잔여환산.
 */
export interface RequiredLine {
  ingredientId: string;
  perServingQty: number; // 1인분 소요량(기준단위)
}

export function requiredByIngredient(
  menus: { lines: RequiredLine[]; servings: number }[],
): Map<string, number> {
  const acc = new Map<string, number>();
  for (const menu of menus) {
    for (const l of menu.lines) {
      acc.set(l.ingredientId, (acc.get(l.ingredientId) ?? 0) + l.perServingQty * menu.servings);
    }
  }
  return acc;
}

/** 부족분 = max(0, 필요 − 잔여환산). */
export const shortage = (required: number, remainConverted: number): number =>
  Math.max(0, required - remainConverted);
