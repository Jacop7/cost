import Decimal from 'decimal.js';
import type { RecipeSimulationRow } from '@margincook/types';

/** 0203의 per_serving_comparison: 서버 1인분 값에 수량만 곱한다. 세금·손익을 재계산하지 않는다. */
export function scaleRecipeSimulation(one: RecipeSimulationRow, quantity: number): RecipeSimulationRow | null {
  if (one.servings !== 1 || !Number.isSafeInteger(quantity) || quantity < 1) return null;
  const result = { ...one, servings: quantity };
  for (const key of ['listedTotal', 'tax', 'netSales', 'customerTotal', 'material', 'extra', 'fixed', 'profit'] as const) {
    const value = one[key];
    if (value === null) continue;
    const scaled = new Decimal(value).times(quantity);
    if (!scaled.isFinite() || scaled.abs().gt(Number.MAX_SAFE_INTEGER)) return null;
    result[key] = scaled.toNumber();
  }
  return result;
}
