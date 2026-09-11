import type { RecipeDraft } from './draftStore';

/** Read-only preview input. Prices come from the server, never from cached draft unit prices. */
export type DraftPreviewInput = {
  recipe_id: string | null;
  price: number;
  base_servings: number;
  target_profit_rate: number;
  lines: { ingredient_id: string; input_qty: number }[];
  extras: { material_id: string | null; qty: number; amount: number }[];
};
const uuid = (value: string | null | undefined): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const finite = (value: number, max: number) => Number.isFinite(value) && value >= 0 && value <= max;
const decimal = (value: string): number | null => {
  const normalized = value.replace(/,/g, '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const result = Number(normalized);
  return finite(result, 90071992547409) ? result : null;
};

/** Incomplete input pauses the preview; it must not become an apparently valid zero quote. */
export function draftPreviewInput(draft: RecipeDraft): DraftPreviewInput | null {
  const price = decimal(draft.price);
  const servings = decimal(draft.baseServings);
  const target = decimal(draft.targetProfitRate);
  if (price === null || servings === null || !Number.isSafeInteger(servings) || servings < 1
    || target === null || target > 100 || (draft.id !== undefined && !uuid(draft.id))) return null;
  if (draft.lines.length > 500 || draft.extras.length > 500) return null;
  if (draft.lines.some(line => !uuid(line.ingredientId) || line.subRecipeId !== null
    || !finite(line.inputQty, 90071992547409))) return null;
  if (draft.extras.some(extra => (extra.materialId !== null && !uuid(extra.materialId))
    || !finite(extra.qty, 90071992547409) || !finite(extra.amountPerServing, 90071992547409))) return null;
  return {
    recipe_id: draft.id ?? null, price, base_servings: servings, target_profit_rate: target,
    lines: draft.lines.map(line => ({ ingredient_id: line.ingredientId!, input_qty: line.inputQty })),
    extras: draft.extras.map(extra => ({ material_id: extra.materialId, qty: extra.qty, amount: extra.amountPerServing })),
  };
}
