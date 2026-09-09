import { expect, it } from 'vitest';
import { estimatedDiscardLoss } from '../src/inventory';

it.each([[120, 28, 3360], [120, 4, 480], [0.1, 0.2, 0.02], [2, 500, 1000], [0, 28, 0], [12, 0, 0]])(
  '기준수량 %s × 기준단가 %s = %s (PostgreSQL numeric 곱셈 검산)', (qty, price, expected) => {
    expect(estimatedDiscardLoss(qty!, price!)).toBe(expected);
  });
it.each([[1, null], [1, undefined], [-1, 28], [1, -28], [NaN, 28], [1, Infinity], [Infinity, 1], [Number.MAX_VALUE, 2]])(
  '산출 불가를 0원으로 바꾸지 않는다 (%s, %s)', (qty, price) => {
    expect(estimatedDiscardLoss(qty as number, price)).toBeNull();
  });
