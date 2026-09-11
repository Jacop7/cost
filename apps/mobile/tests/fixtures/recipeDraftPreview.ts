import { simulationRaw, simulationRecipe, simulationStore } from './recipePriceSimulation';
export const actor = '00000000-0000-4000-8000-000000000003';
export const store = simulationStore;
export const recipe = simulationRecipe;
export const previewInput = () => ({ recipe_id: null as string | null, price: 12.34, base_servings: 2, target_profit_rate: 30,
  lines: [{ ingredient_id: simulationStore, input_qty: 100 }], extras: [{ material_id: null, qty: 1, amount: 1 }] });
export function previewRaw(input = previewInput(), profit = 7.872) {
  const raw = simulationRaw(input.price);
  return { ...raw, actor_id: actor, input, basis: { ...raw.basis, missing_material_price_ids: [] },
    one: { ...raw.one, profit }, batch: { ...raw.batch, servings: input.base_servings, profit: profit * input.base_servings },
    recommendation: { status: 'ready', price: 4, quote: { listed_total: 4 }, profit: 1.2, profit_rate: 0.3 } };
}
