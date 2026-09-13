import { describe, expect, it } from 'vitest';
import { combinedMaterialCost } from '../src/features/recipes/materialCost';
import { isStockUnentered } from '../src/features/ingredients/stockPresentation';

describe('unified material presentation', () => {
  it('keeps legacy packaging in total menu costs', () => {
    expect(combinedMaterialCost(2806.4, 300)).toBe(3106.4);
    expect(combinedMaterialCost(3106.4, 0)).toBe(3106.4);
  });
  it('does not turn an unknown cost into a zero or partial total', () => {
    expect(combinedMaterialCost(null, 300)).toBeNull();
    expect(combinedMaterialCost(100, null)).toBeNull();
    expect(combinedMaterialCost(0, 0)).toBe(0);
  });
  it('does not send a cost-only material to initial stock entry', () => {
    expect(isStockUnentered({ stockTracking: false, stockTotal: 0, lastInboundAt: null })).toBe(false);
    expect(isStockUnentered({ stockTracking: true, stockTotal: 0, lastInboundAt: null })).toBe(true);
    expect(isStockUnentered({ stockTotal: -2, lastInboundAt: null })).toBe(false);
  });
});
