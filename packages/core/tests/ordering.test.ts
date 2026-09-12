import { describe, expect, it } from 'vitest';
import { recommendedOrderQty, safetyStockShortage } from '../src/ordering';
describe('안전재고 부족량과 구매 옵션 환산', () => {
  it.each([[0,3000,300,10],[0,3000,1000,3],[900,3000,300,7],[-750,3000,300,13],[3000,3000,300,0],[4000,3000,300,0],[0,10,3,4]])(
    '재고 %s / 안전 %s / 옵션 %s → %s개', (stock,safe,volume,qty) => {
      expect(recommendedOrderQty(safetyStockShortage(stock,safe),volume)).toBe(qty);
    });
  it.each([0,-1,NaN,Infinity])('유효하지 않은 옵션 용량 %s는 자동 수량을 만들지 않는다', volume => {
    expect(recommendedOrderQty(3000,volume)).toBe(0);
  });
});
