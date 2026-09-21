import { describe, expect, it } from 'vitest';
import { nullablePercentOfTotal, percentOfTotal, percentOfTotalText } from '@/features/sales/periodPercent';

describe('매출 기간 비율 계약', () => {
  it('하루 비율을 평균 내지 않고 기간 금액 합계를 기간 총매출로 나눈다', () => {
    const dayOne = { revenue: 1_000, cost: 100 };   // 10%
    const dayTwo = { revenue: 9_000, cost: 4_500 }; // 50%

    expect(percentOfTotal(dayOne.cost + dayTwo.cost, dayOne.revenue + dayTwo.revenue)).toBe(46);
    expect(percentOfTotalText(4_600, 10_000)).toBe('46%');
  });

  it('미산출 금액은 null을 유지하고 매출이 없으면 0%로 표시한다', () => {
    expect(nullablePercentOfTotal(null, 10_000)).toBeNull();
    expect(percentOfTotal(500, 0)).toBe(0);
  });
});
