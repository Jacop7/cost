/**
 * 손익 변동 검산 (RCP-16 · 0083).
 *
 * DB `profit_delta_cause()` / `money_short()` 의 미러가 실제로 같은 값을 내는지 잠근다.
 * 이 둘이 어긋나면 목록 한 줄과 상세 시트가 서로 다른 항목을 가리킨다.
 *
 * 고정 검산값은 제육볶음 — 판매가 12,000 / 재료비 2,806.40 / 부자재 300 /
 * 세금 1,090.91 / 고정지출 3,756 / 순이익 4,046.69 · 33.72%.
 */
import { describe, it, expect } from 'vitest';
import {
  computeProfit,
  moneyShort,
  profitDelta,
  profitDeltaCause,
  snapshotBalances,
  round,
  type ProfitSnapshot,
} from '../src';

/** 검산값 그대로의 기준선. */
const BASE: ProfitSnapshot = {
  price: 12000,
  materialCost: 2806.4,
  extraCost: 300,
  taxAmount: 12000 * (10 / 110),
  fixedCost: 12000 * 0.313,
  profitAmount: 12000 - 12000 * (10 / 110) - 2806.4 - 300 - 12000 * 0.313,
};

describe('기준선 자체가 검산값이다', () => {
  it('제육볶음 4,046.69원 · 33.72%', () => {
    expect(round(BASE.profitAmount, 2)).toBe(4046.69);
    expect(round((BASE.profitAmount / BASE.price) * 100, 2)).toBe(33.72);
    expect(round(BASE.fixedCost, 2)).toBe(3756);
    expect(round(BASE.taxAmount, 2)).toBe(1090.91);
  });

  it('손익표가 맞아떨어진다', () => {
    expect(snapshotBalances(BASE)).toBe(true);
  });

  it('computeProfit 과 같은 값이다 — 공식이 두 벌이 아니다', () => {
    const p = computeProfit({
      price: 12000,
      servings: 10,
      taxItems: [{ name: '부가세', rate: (100 * 10) / 110 }],
      lines: [{ inputQty: 28064, baseUnitPrice: 1 }],
      extraPerServing: 300,
      fixedRate: 0.313,
    });
    expect(round(p.profit, 2)).toBe(4046.69);
  });
});

describe('대표 원인은 가장 크게 움직인 하나', () => {
  it('재료비가 32원 줄면 그걸 고른다', () => {
    const cur = { ...BASE, materialCost: 2774.4, profitAmount: BASE.profitAmount + 32 };
    const c = profitDeltaCause(BASE, cur)!;
    expect(c.key).toBe('material_cost');
    expect(c.summary).toBe('재료비 32원 감소');
    expect(profitDelta(BASE, cur)).toBe(32);
  });

  it('여러 개가 함께 바뀌면 큰 쪽', () => {
    // 재료비 −5원, 고정지출 +36원 → 고정지출이 대표다.
    const cur = {
      ...BASE,
      materialCost: BASE.materialCost - 5,
      fixedCost: BASE.fixedCost + 36,
      profitAmount: BASE.profitAmount - 31,
    };
    const c = profitDeltaCause(BASE, cur)!;
    expect(c.key).toBe('fixed_cost');
    expect(c.summary).toBe('고정지출 36원 증가');
  });

  it('세금은 소수 둘째 자리까지 말한다', () => {
    const cur = {
      ...BASE,
      taxAmount: BASE.taxAmount + 45.4545,
      profitAmount: BASE.profitAmount - 45.4545,
    };
    expect(profitDeltaCause(BASE, cur)!.summary).toBe('세금 45.45원 증가');
  });

  it('아무것도 안 움직이면 사건이 아니다', () => {
    expect(profitDeltaCause(BASE, { ...BASE })).toBeNull();
  });

  it('1원의 100분의 1 아래는 변동이 아니다 — 부동소수 찌꺼기', () => {
    const cur = { ...BASE, materialCost: BASE.materialCost + 0.004 };
    expect(profitDeltaCause(BASE, cur)).toBeNull();
  });

  it('비교할 앞이 없으면 null — 첫 점을 변동이라 부르지 않는다', () => {
    expect(profitDeltaCause(null, BASE)).toBeNull();
    expect(profitDelta(null, BASE)).toBeNull();
  });
});

describe('판매가 인상은 그대로 순이익이 되지 않는다', () => {
  it('12,000 → 12,500 일 때 순이익은 500원이 아니라 298.05원 오른다', () => {
    // 부가세 10/110 이 +45.45, 고정지출 31.3% 가 +156.50 만큼 따라 오른다.
    const cur: ProfitSnapshot = {
      ...BASE,
      price: 12500,
      taxAmount: 12500 * (10 / 110),
      fixedCost: 12500 * 0.313,
      profitAmount: 12500 - 12500 * (10 / 110) - 2806.4 - 300 - 12500 * 0.313,
    };
    const c = profitDeltaCause(BASE, cur)!;
    expect(c.key).toBe('price'); // 500 > 156.50 > 45.45
    expect(c.summary).toBe('판매가 500원 증가');

    const d = profitDelta(BASE, cur)!;
    expect(round(d, 2)).toBe(298.05); // 500 − 45.45 − 156.50
    expect(round(d, 2)).not.toBe(500);
  });
});

describe('금액 표기', () => {
  it('정수는 소수점을 붙이지 않는다', () => {
    expect(moneyShort(32)).toBe('32');
    expect(moneyShort(500)).toBe('500');
  });
  it('소수는 둘째 자리까지', () => {
    expect(moneyShort(45.4545)).toBe('45.45');
    expect(moneyShort(2806.4)).toBe('2,806.40');
  });
  it('천 단위를 끊는다', () => {
    expect(moneyShort(1234567)).toBe('1,234,567');
  });
});

describe('반쪽 스냅샷', () => {
  it('금액이 비면 0원으로 보지 않고 그 항목을 건너뛴다', () => {
    const broken = { ...BASE, taxAmount: Number.NaN };
    const cur = { ...broken, materialCost: BASE.materialCost + 10 };
    const c = profitDeltaCause(broken, cur)!;
    expect(c.key).toBe('material_cost'); // NaN 인 세금이 '가장 크게 움직인 항목'이 되지 않는다
  });

  it('손익표가 안 맞으면 균형이 깨졌다고 말한다', () => {
    expect(snapshotBalances({ ...BASE, profitAmount: 0 })).toBe(false);
  });
});
