/**
 * 경계 입력 계약 — 가이드 불변식 6.
 * "금액과 수량은 음수·NaN·Infinity를 허용하지 않는다. 분모 0, 로스율 100% 이상, 판매가/매출 0을 명시적으로 처리한다."
 *
 * 산출 불가는 0이 아니라 **null**로 표현한다. 0으로 위장하면 원가가 0원이 되어 순이익이 과대 계상되고,
 * 그 값이 저장 경로로 들어가면 DB가 오염된다. SQL 쪽도 같은 의미로 `nullif(volume,0)` /
 * `nullif(1 - v_loss, 0)`를 써서 null을 반환한다(20260608000006_calc_helpers.sql).
 */
import { describe, it, expect } from 'vitest';
import {
  rawUnitPrice,
  baseUnitPrice,
  previewBaseUnitPrice,
  weightedAvgUnitPrice,
  computeProfit,
  materialCost,
} from '../src';

/** 어떤 경우에도 화면·저장 경로로 나가면 안 되는 값. */
const isPoisoned = (v: number | null): boolean =>
  v !== null && (!Number.isFinite(v) || Number.isNaN(v));

describe('rawUnitPrice — 분모 0과 비유한 입력', () => {
  it('용량 0이면 null (Infinity 금지)', () => {
    expect(rawUnitPrice(4000, 0)).toBeNull();
  });

  it('금액 0 · 용량 0이면 null (NaN 금지)', () => {
    expect(rawUnitPrice(0, 0)).toBeNull();
  });

  it('용량 음수면 null', () => {
    expect(rawUnitPrice(4000, -1000)).toBeNull();
  });

  it('금액 음수면 null — 음수 단가는 존재할 수 없다', () => {
    expect(rawUnitPrice(-4000, 1000)).toBeNull();
  });

  it('비유한 입력이면 null', () => {
    expect(rawUnitPrice(Number.NaN, 1000)).toBeNull();
    expect(rawUnitPrice(4000, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('정상 입력은 그대로 계산한다', () => {
    expect(rawUnitPrice(4000, 1000)).toBe(4);
  });

  it('금액 0은 유효한 0원 단가다 (무상 제공)', () => {
    expect(rawUnitPrice(0, 1000)).toBe(0);
  });
});

describe('baseUnitPrice — 산 값 그대로 (0041: 로스로 나누지 않는다)', () => {
  it('평균 단가가 null이면 null로 전파된다', () => {
    expect(baseUnitPrice(null)).toBeNull();
  });

  it('음수 단가는 null', () => {
    expect(baseUnitPrice(-1)).toBeNull();
  });

  it('0원 단가는 유효하다 (무상 제공)', () => {
    expect(baseUnitPrice(0)).toBe(0);
  });

  it('검산 — 4원/g 은 4원/g 이다', () => {
    expect(baseUnitPrice(4)).toBe(4);
  });
});

describe('previewBaseUnitPrice — 합성 경로에서도 null 전파', () => {
  it('용량 0이면 null', () => {
    expect(previewBaseUnitPrice(4000, 0)).toBeNull();
  });

  it('검산 기준값 — 대파 4,000원/1,000g → 4.00원/g', () => {
    const p = previewBaseUnitPrice(4000, 1000);
    expect(p).not.toBeNull();
    expect(p!).toBeCloseTo(4.0, 6);
  });
});

describe('weightedAvgUnitPrice — 오염된 구매 이력', () => {
  it('용량 0인 이력은 건너뛴다 (전체를 NaN으로 만들지 않는다)', () => {
    const avg = weightedAvgUnitPrice([
      { amount: 4000, volume: 1000, qty: 2 },
      { amount: 3600, volume: 0, qty: 3 }, // 오염된 행
    ]);
    expect(avg).toBe(4); // 유효한 행만 반영
  });

  it('유효한 이력이 하나도 없으면 null', () => {
    expect(weightedAvgUnitPrice([{ amount: 4000, volume: 0, qty: 2 }])).toBeNull();
  });

  it('수량 0인 이력만 있으면 null', () => {
    expect(weightedAvgUnitPrice([{ amount: 4000, volume: 1000, qty: 0 }])).toBeNull();
  });

  it('빈 배열은 null', () => {
    expect(weightedAvgUnitPrice([])).toBeNull();
  });
});


describe('computeProfit — 인분·판매가 경계', () => {
  const base = {
    price: 12000,
    servings: 10,
    taxMode: 'included' as const,
    extraPerServing: 300,
    fixedRate: 0.313,
    lines: [{ inputQty: 10, baseUnitPrice: 2806.4 }],
  };

  it('인분 0이면 재료비가 Infinity가 되지 않는다', () => {
    const r = computeProfit({ ...base, servings: 0 });
    expect(isPoisoned(r.materialCost)).toBe(false);
    expect(isPoisoned(r.profit)).toBe(false);
  });

  it('인분 0이면 재료비를 산출하지 못했음을 알린다', () => {
    const r = computeProfit({ ...base, servings: 0 });
    expect(r.hasMissingPrice).toBe(true);
    expect(r.materialCost).toBe(0);
  });

  it('인분 음수도 같은 방식으로 방어한다', () => {
    const r = computeProfit({ ...base, servings: -10 });
    expect(isPoisoned(r.materialCost)).toBe(false);
    expect(r.materialCost).toBe(0);
  });

  it('판매가 0이면 비율이 0이고 오염값이 없다', () => {
    const r = computeProfit({ ...base, price: 0 });
    expect(r.profitRate).toBe(0);
    expect(r.materialRate).toBe(0);
    expect(isPoisoned(r.profit)).toBe(false);
  });

  it('판매가 음수는 0으로 취급해 음수 매출을 만들지 않는다', () => {
    const r = computeProfit({ ...base, price: -12000 });
    expect(r.price).toBe(0);
    expect(r.tax).toBe(0);
    expect(r.profitRate).toBe(0);
  });

  it('검산 기준값은 유지된다 — 제육볶음 4,046.69원 · 33.72%', () => {
    const r = computeProfit(base);
    expect(r.profit).toBeCloseTo(4046.69, 2);
    expect(r.profitRate).toBeCloseTo(0.3372, 4);
  });
});

describe('materialCost — 라인 단위 방어', () => {
  it('입력량이 비유한이면 그 라인을 잠정 처리한다', () => {
    const r = materialCost([{ inputQty: Number.NaN, baseUnitPrice: 2835 }], 10);
    expect(r.cost).toBe(0);
    expect(r.hasMissingPrice).toBe(true);
  });

  it('입력량 음수도 잠정 처리한다 — 원가를 깎지 않는다', () => {
    const r = materialCost([{ inputQty: -10, baseUnitPrice: 2835 }], 10);
    expect(r.cost).toBe(0);
    expect(r.hasMissingPrice).toBe(true);
  });

  it('단가 null 라인은 잠정 표시하고 0으로 더한다 (SQL coalesce 와 같은 값)', () => {
    const r = materialCost(
      [
        { inputQty: 10, baseUnitPrice: null },
        { inputQty: 10, baseUnitPrice: 2835 },
      ],
      10,
    );
    expect(r.cost).toBe(2835);
    expect(r.hasMissingPrice).toBe(true);
  });
});
