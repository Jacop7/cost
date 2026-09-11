import { describe, expect, it } from 'vitest';
import { emptyDraft } from '@/features/recipes/draftStore';
import { draftPreviewInput } from '@/features/recipes/draftPreviewInput';

const ingredientId = '00000000-0000-4000-8000-000000000001';
function draft() {
  return { ...emptyDraft(), price: '12,000', baseServings: '10', targetProfitRate: '40',
    lines: [{ ingredientId, subRecipeId: null, name: '대파', unit: 'g' as const, inputQty: 250, unitPrice: 4 }],
    extras: [{ materialId: null, name: '직접 비용', qty: 1, amountPerServing: 300, unitCost: 300 }] };
}
describe('unsaved recipe preview request', () => {
  it('preserves batch quantities and per-serving extras, without transmitting cached prices or memo', () => {
    const source = draft(); const before = structuredClone(source);
    expect(draftPreviewInput(source)).toEqual({ recipe_id: null, price: 12000, base_servings: 10,
      target_profit_rate: 40, lines: [{ ingredient_id: ingredientId, input_qty: 250 }],
      extras: [{ material_id: null, qty: 1, amount: 300 }] });
    expect(source).toEqual(before);
  });
  it.each(['', ' ', '-', '12abc', 'Infinity', 'NaN', '-1'])('pauses incomplete price %s', price => {
    expect(draftPreviewInput({ ...draft(), price })).toBeNull();
  });
  it.each(['0', '1.5', '-1', ''])('rejects invalid base servings %s', baseServings => {
    expect(draftPreviewInput({ ...draft(), baseServings })).toBeNull();
  });
  it('allows zero price and missing cached ingredient price for server resolution', () => {
    const source = draft(); source.price = '0';
    expect(draftPreviewInput({ ...source, lines: source.lines.map(line => ({ ...line, unitPrice: null })) })?.price).toBe(0);
  });
  it('rejects nonfinite amounts and out-of-scope subrecipes', () => {
    const source = draft();
    expect(draftPreviewInput({ ...source, lines: source.lines.map(line => ({ ...line, inputQty: NaN })) })).toBeNull();
    expect(draftPreviewInput({ ...source, lines: source.lines.map(line => ({ ...line, subRecipeId: ingredientId })) })).toBeNull();
    expect(draftPreviewInput({ ...source, extras: source.extras.map(extra => ({ ...extra, amountPerServing: Infinity })) })).toBeNull();
  });
  it('binds edited recipe identity and every draft change to a different request', () => {
    const source = { ...draft(), id: ingredientId };
    expect(draftPreviewInput(source)?.recipe_id).toBe(ingredientId);
    expect(draftPreviewInput({ ...source, price: '13000' })).not.toEqual(draftPreviewInput(source));
    expect(draftPreviewInput({ ...source, baseServings: '20' })).not.toEqual(draftPreviewInput(source));
    expect(draftPreviewInput({ ...source, id: 'invalid' })).toBeNull();
  });
});
