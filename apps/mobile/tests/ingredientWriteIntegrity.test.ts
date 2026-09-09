import { describe, expect, it } from 'vitest';
import { operationKeyFor } from '@/features/ingredients/operationKey';
import { convertUnitInput, unitFamily } from '@/features/ingredients/unitInput';

describe('식재료 작업 식별·단위 경계', () => {
  it('동일 값의 별도 입고는 새 키, 동일 제출의 재시도는 같은 키', () => {
    const values = ['ingredient', '2030-07-15', 1000, 4000, 1, 'vendor'];
    const first = operationKeyFor(null, values, 'qi');
    expect(operationKeyFor(first, values, 'qi').key).toBe(first.key);
    expect(operationKeyFor(null, values, 'qi').key).not.toBe(first.key);
    expect(operationKeyFor(first, [...values.slice(0, -1), 'other'], 'qi').key).not.toBe(first.key);
  });
  it('같은 차원에서 단위만 바꾸면 실제 용량·안전재고가 유지된다', () => {
    expect(convertUnitInput('1000', 'g', 'kg')).toBe('1');
    expect(convertUnitInput('0.125', 'kg', 'g')).toBe('125');
    expect(convertUnitInput('1500', 'ml', 'L')).toBe('1.5');
    expect(convertUnitInput('', 'g', 'kg')).toBe('');
    expect(convertUnitInput('12', 'g', 'ml')).toBe('');
    expect(unitFamily('박스')).toBeNull();
  });
});
