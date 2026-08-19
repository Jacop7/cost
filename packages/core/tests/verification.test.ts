/**
 * 검산 테스트 — 설계 문서(①②④⑤⑧)의 고정 검산값을 회귀 방지로 잠근다.
 * 이 수치가 깨지면 계산 공식이 설계와 어긋난 것.
 */
import { describe, it, expect } from 'vitest';
import {
  previewBaseUnitPrice,
  weightedAvgUnitPrice,
  computeProfit,
  recommendedPrice,
  fixedCostRate,
  fixedCostPerThousand,
  stockBadge,
  recommendedOrderQty,
  round,
  pct1,
} from '../src';

describe('단가 (① 3.5, A-02)', () => {
  it('대파 4,000원/1,000g → 4.00원/g (0041: 로스로 나누지 않는다)', () => {
    const p = previewBaseUnitPrice(4000, 1000);
    expect(p).not.toBeNull(); // 산출 불가(null)가 아니어야 한다 — 경계 계약은 boundary.test.ts
    expect(round(p!, 2)).toBe(4.0);
  });

  it('수량 가중 평균 (대파 구매이력)', () => {
    const avg = weightedAvgUnitPrice([
      { amount: 4000, volume: 1000, qty: 2 },
      { amount: 3600, volume: 1000, qty: 3 },
      { amount: 4200, volume: 1000, qty: 1 },
    ]);
    // (4.0*2 + 3.6*3 + 4.2*1) / 6 = 3.833…
    expect(round(avg!, 2)).toBe(3.83);
  });
});

describe('레시피 손익 (② 3장) — 제육볶음', () => {
  // 판매가 12,000 / 부가세 포함 / 재료 2,835 / 추가 300 / 고정지출률 31.3%
  const result = computeProfit({
    price: 12000,
    servings: 10,
    taxMode: 'included',
    extraPerServing: 300,
    fixedRate: 0.313, // 률 적용 시 고정 = 3,756
    // 재료 합 2,806.40 을 단일 라인으로 검증 (1인분량 1 × 단가 2806.4)
    lines: [{ inputQty: 10, baseUnitPrice: 2806.4 }],
  });

  it('세금 = 12,000 × 10/110 ≈ 1,091', () => {
    expect(round(result.tax)).toBe(1091);
  });

  it('고정 지출 = 3,756', () => {
    expect(round(result.fixedCost)).toBe(3756);
  });

  it('순이익 4,046.69원', () => {
    expect(result.profit).toBeCloseTo(4046.69, 2);
  });

  it('순이익률 33.72%', () => {
    expect(result.profitRate).toBeCloseTo(0.3372, 4);
  });

  it('권장가 16,000원 (목표 40%)', () => {
    const rec = recommendedPrice(2835 + 300, 0.313, 0.4);
    expect(round(rec! / 1000) * 1000).toBe(16000);
  });
});

describe('고정지출률 (④ 2, G-01)', () => {
  it('합계/매출 = 31.3%, 1,000원당 313원', () => {
    // 예: 매출 12,000,000, 고정 합계 3,756,000 → 31.3%
    const rate = fixedCostRate(3_756_000, 12_000_000)!;
    expect(pct1(rate)).toBe(31.3);
    expect(round(fixedCostPerThousand(rate))).toBe(313);
  });

  it('매출 미입력이면 null (잠정, G-07)', () => {
    expect(fixedCostRate(3_756_000, 0)).toBeNull();
  });
});

describe('재고 뱃지 (① 4.7, ③ 3.4)', () => {
  it('대파 재고 3,000g, 안전재고 2,000g → 충분', () => {
    expect(stockBadge({ stockTotal: 3000, soonOut: false }, 2000)).toBe('ok');
  });
  it('양파 재고 1,000g, 안전재고 3,000g → 부족', () => {
    expect(stockBadge({ stockTotal: 1000, soonOut: false }, 3000)).toBe('low');
  });
  it('다진마늘 곧소진 → 소진임박', () => {
    expect(stockBadge({ stockTotal: 1000, soonOut: true }, 2000)).toBe('out');
  });
});

describe('재고 총량·발주 (⑤ 2.3)', () => {
  it('권장 발주 수량 = Ceil(부족 ÷ 개당용량), 최소발주 보정', () => {
    expect(recommendedOrderQty(2500, 1000, 1)).toBe(3); // ceil(2.5)=3
    expect(recommendedOrderQty(200, 1000, 2)).toBe(2); // 최소발주 2
  });
});
