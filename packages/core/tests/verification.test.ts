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
  remainConverted,
  recommendedOrderQty,
  round,
  pct1,
} from '../src';

describe('단가 (① 3.5, A-02)', () => {
  it('대파 4,000원/1,000g, 로스 15% → 4.71원/g', () => {
    expect(round(previewBaseUnitPrice(4000, 1000, 0.15), 2)).toBe(4.71);
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
    fixedRate: 0.3133, // 률 적용 시 고정 ≈ 3,760
    // 재료 합 2,835 를 단일 라인으로 검증 (1인분량 1 × 단가 2835)
    lines: [{ inputQty: 10, baseUnitPrice: 2835 }],
  });

  it('세금 = 12,000 × 10/110 ≈ 1,091', () => {
    expect(round(result.tax)).toBe(1091);
  });

  it('고정 지출 ≈ 3,760', () => {
    expect(round(result.fixedCost)).toBe(3760);
  });

  it('순이익 4,014원', () => {
    expect(round(result.profit)).toBe(4014);
  });

  it('순이익률 ≈ 33.4%', () => {
    // 4,014 / 12,000 = 33.45% → 문서 표기 33.4%. 경계값이라 비율로 검증.
    expect(result.profitRate).toBeCloseTo(0.334, 2);
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
  it('대파 미개봉2·개봉1, 안전2 → 충분', () => {
    expect(
      stockBadge({ sealedCount: 2, openedCount: 1, openedRemain: null, soonOut: false }, 2),
    ).toBe('ok');
  });
  it('양파 미개봉0·개봉1, 안전3 → 부족', () => {
    expect(
      stockBadge({ sealedCount: 0, openedCount: 1, openedRemain: null, soonOut: false }, 3),
    ).toBe('low');
  });
  it('다진마늘 곧소진 → 소진임박', () => {
    expect(
      stockBadge({ sealedCount: 0, openedCount: 1, openedRemain: null, soonOut: true }, 2),
    ).toBe('out');
  });
});

describe('잔여 환산·발주 (⑤ 2.3)', () => {
  it('잔여 환산량 = 개수 × 개당용량 × (1−로스)', () => {
    // 미개봉2 × 1000g + 개봉1(가득 1000g) = 3000, 로스 15% → 2550
    const v = remainConverted(
      { sealedCount: 2, openedCount: 1, openedRemain: null, soonOut: false },
      1000,
      0.15,
    );
    expect(round(v)).toBe(2550);
  });

  it('권장 발주 수량 = Ceil(부족 ÷ 개당용량), 최소발주 보정', () => {
    expect(recommendedOrderQty(2500, 1000, 1)).toBe(3); // ceil(2.5)=3
    expect(recommendedOrderQty(200, 1000, 2)).toBe(2); // 최소발주 2
  });
});
