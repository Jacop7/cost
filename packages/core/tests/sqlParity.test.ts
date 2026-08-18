/**
 * core ↔ SQL 공식 대조 (명세 테스트) — 절대원칙 3.
 * "확정 계산은 packages/db RPC 가 권위. packages/core 는 같은 공식의 미리보기이며 공식이 항상 일치해야 한다."
 *
 * Docker 가 없어 SQL 을 실행할 수 없는 환경에서, 두 구현의 계약 차이를 **테스트로 고정**하는 것이
 * 유일한 방어선이다. 여기서는 SQL 함수 본문을 TypeScript 로 **그대로 옮긴 참조 구현**을 두고
 * core 와 값을 비교한다. 참조 구현이 SQL 과 어긋나면 이 파일을 고쳐야 하고, 그때 core 도 함께 본다.
 *
 * 대조 대상 (packages/db/supabase/migrations/20260608000006_calc_helpers.sql):
 *   base_unit_price · real_loss_rate · fixed_cost_rate · recompute_recipe
 *
 * ⚠ 이 테스트는 "SQL 이 실제로 그렇게 동작한다"를 증명하지 않는다. **SQL 본문을 읽고 옮긴 것**이
 *   core 와 일치하는지만 증명한다. 실제 DB 검증은 `supabase db reset` 후 별도로 해야 한다.
 */
import { describe, it, expect } from 'vitest';
import {
  baseUnitPrice,
  weightedAvgUnitPrice,
  realLossRate,
  fixedCostRate,
  computeProfit,
  taxAmount,
  perServingQty,
} from '../src';

// ── SQL 본문을 옮긴 참조 구현 ─────────────────────────────────

/**
 * SQL `base_unit_price(uuid)` — **20260819000010_value_constraints.sql 판** 기준.
 *   v_avg  = sum((amount / nullif(volume,0)) * qty) / sum(qty)   -- qty > 0 인 이력만 sum 에 기여
 *   v_loss = coalesce(real_loss_rate(ing), loss_rate) / 100.0
 *   if v_loss is null or v_loss < 0 or v_loss >= 1 then return null   ← 0010 에서 보강
 *   return v_avg / (1 - v_loss)
 *
 * 0006 원본은 `nullif(1 - v_loss, 0)` 이라 **정확히 0** 만 걸러내 로스율 100% 초과에서 음수 단가가
 * 나왔다(CV-8). 0010 이 core 와 같은 계약으로 맞췄다.
 */
function sqlBaseUnitPrice(
  purchases: { amount: number; volume: number; qty: number }[],
  lossPercent: number,
): number | null {
  let num = 0;
  let den = 0;
  for (const p of purchases) {
    if (p.volume === 0) continue; // nullif(volume,0) → null → sum 에서 제외
    num += (p.amount / p.volume) * p.qty;
    den += p.qty;
  }
  if (den === 0) return null;
  const avg = num / den;
  const loss = lossPercent / 100;
  if (!Number.isFinite(loss) || loss < 0 || loss >= 1) return null;
  return avg / (1 - loss);
}

/** SQL `real_loss_rate`: 누적폐기 / 누적구매 × 100. 구매 <= 0 이면 null. **%로 반환**한다. */
function sqlRealLossRatePercent(discarded: number, purchased: number): number | null {
  if (purchased <= 0) return null;
  return (discarded / purchased) * 100;
}

/** SQL `fixed_cost_rate`: 고정합계 / 매출. 매출 null 이거나 <= 0 이면 null. */
function sqlFixedCostRate(fixedTotal: number, revenue: number): number | null {
  if (revenue <= 0) return null;
  return fixedTotal / revenue;
}

/**
 * SQL `recompute_recipe` 의 손익 부분:
 *   v_material = Σ (input_qty / base_servings) × coalesce(base_unit_price, 0)
 *   v_tax      = tax_mode='included' ? price*10/110 : 0
 *   v_rate     = coalesce(fixed_cost_rate(store, month), 0)
 *   v_fixed    = v_rate × price
 *   v_profit   = price − tax − material − extra − fixed
 *   v_pr       = price > 0 ? round(profit/price*100, 2) : 0
 */
function sqlRecomputeRecipe(input: {
  price: number;
  baseServings: number;
  taxIncluded: boolean;
  lines: { inputQty: number; baseUnitPrice: number | null }[];
  extraPerServing: number;
  fixedRate: number | null;
}): { material: number; tax: number; fixed: number; profit: number; profitRatePct: number } {
  const material = input.lines.reduce(
    (a, l) => a + (l.inputQty / input.baseServings) * (l.baseUnitPrice ?? 0),
    0,
  );
  const tax = input.taxIncluded ? (input.price * 10) / 110 : 0;
  const rate = input.fixedRate ?? 0;
  const fixed = rate * input.price;
  const profit = input.price - tax - material - input.extraPerServing - fixed;
  const pr = input.price > 0 ? Math.round((profit / input.price) * 100 * 100) / 100 : 0;
  return { material, tax, fixed, profit, profitRatePct: pr };
}

// ── 대조 ───────────────────────────────────────────────────────

describe('base_unit_price — core ↔ SQL', () => {
  const purchases = [
    { amount: 4000, volume: 1000, qty: 2 },
    { amount: 3600, volume: 1000, qty: 3 },
    { amount: 4200, volume: 1000, qty: 1 },
  ];

  it('정상 이력 + 로스 15% 에서 같은 값', () => {
    const core = baseUnitPrice(weightedAvgUnitPrice(purchases), 0.15);
    const sql = sqlBaseUnitPrice(purchases, 15);
    expect(core).not.toBeNull();
    expect(core!).toBeCloseTo(sql!, 10);
  });

  it('검산 — 대파 단일 구매 4,000원/1,000g, 로스 15% → 4.71', () => {
    const one = [{ amount: 4000, volume: 1000, qty: 1 }];
    expect(baseUnitPrice(weightedAvgUnitPrice(one), 0.15)!).toBeCloseTo(sqlBaseUnitPrice(one, 15)!, 10);
    expect(Math.round(sqlBaseUnitPrice(one, 15)! * 100) / 100).toBe(4.71);
  });

  it('용량 0 인 이력은 양쪽 모두 평균에서 제외한다', () => {
    const mixed = [
      { amount: 4000, volume: 1000, qty: 2 },
      { amount: 3600, volume: 0, qty: 3 }, // 오염 행
    ];
    expect(weightedAvgUnitPrice(mixed)).toBe(4);
    expect(sqlBaseUnitPrice(mixed, 0)).toBe(4);
  });

  it('로스율 100% 는 양쪽 모두 null (분모 0)', () => {
    const one = [{ amount: 4000, volume: 1000, qty: 1 }];
    expect(baseUnitPrice(weightedAvgUnitPrice(one), 1)).toBeNull();
    expect(sqlBaseUnitPrice(one, 100)).toBeNull();
  });

  it('이력이 없으면 양쪽 모두 null', () => {
    expect(weightedAvgUnitPrice([])).toBeNull();
    expect(sqlBaseUnitPrice([], 15)).toBeNull();
  });

  /**
   * CV-8 해소 확인 — 로스율 **100% 초과**.
   * 0006 원본에서는 SQL 이 음수 단가(-20)를 반환했다. core 는 M-001, SQL 은 0010 에서 각각 null 로 막았다.
   * 이 테스트가 두 구현이 다시 갈라지는 것을 막는다.
   *
   * 이 경로는 CHECK 제약만으로는 못 막는다 — `loss_rate` 컬럼에 CHECK 을 걸어도
   * `real_loss_rate()` 는 **누적 폐기 ÷ 누적 구매**로 계산되므로 폐기가 구매를 넘으면 100% 를 넘길 수 있다.
   * 그래서 함수 안에도 같은 가드를 둔다(방어를 한 겹만 두지 않는다).
   */
  it('로스율 100% 초과 — core·SQL 모두 null (CV-8 해소)', () => {
    const one = [{ amount: 4000, volume: 1000, qty: 1 }];
    expect(baseUnitPrice(weightedAvgUnitPrice(one), 1.2)).toBeNull();
    expect(sqlBaseUnitPrice(one, 120)).toBeNull();
  });

  it('로스율 음수 — core·SQL 모두 null', () => {
    const one = [{ amount: 4000, volume: 1000, qty: 1 }];
    expect(baseUnitPrice(weightedAvgUnitPrice(one), -0.1)).toBeNull();
    expect(sqlBaseUnitPrice(one, -10)).toBeNull();
  });
});

describe('real_loss_rate — 단위 차이를 명시한다', () => {
  it('core 는 0~1 비율, SQL 은 % — 정확히 100배 차이', () => {
    const core = realLossRate(150, 1000);
    const sql = sqlRealLossRatePercent(150, 1000);
    expect(core).toBe(0.15);
    expect(sql).toBe(15);
    expect(sql!).toBeCloseTo(core! * 100, 10);
  });

  it('구매 0 이면 양쪽 모두 null', () => {
    expect(realLossRate(150, 0)).toBeNull();
    expect(sqlRealLossRatePercent(150, 0)).toBeNull();
  });

  it('base_unit_price 가 SQL 에서 %를 100으로 나눠 쓰므로 최종값은 일치한다', () => {
    const one = [{ amount: 4000, volume: 1000, qty: 1 }];
    const lossRatio = realLossRate(150, 1000)!; // 0.15
    const lossPct = sqlRealLossRatePercent(150, 1000)!; // 15
    expect(baseUnitPrice(weightedAvgUnitPrice(one), lossRatio)!).toBeCloseTo(
      sqlBaseUnitPrice(one, lossPct)!,
      10,
    );
  });
});

describe('fixed_cost_rate — core ↔ SQL', () => {
  it('검산 31.3% 에서 같은 값', () => {
    expect(fixedCostRate(3_756_000, 12_000_000)!).toBeCloseTo(sqlFixedCostRate(3_756_000, 12_000_000)!, 12);
  });

  it('매출 0 이면 양쪽 모두 null — 0% 로 확정하지 않는다 (G-07 잠정)', () => {
    expect(fixedCostRate(3_756_000, 0)).toBeNull();
    expect(sqlFixedCostRate(3_756_000, 0)).toBeNull();
  });
});

describe('recompute_recipe 손익 — core ↔ SQL', () => {
  const fixture = {
    price: 12000,
    baseServings: 10,
    taxIncluded: true,
    lines: [{ inputQty: 10, baseUnitPrice: 2835 }],
    extraPerServing: 300,
    fixedRate: 0.3133,
  };

  it('제육볶음 검산 — 순이익 4,014원이 양쪽에서 같다', () => {
    const sql = sqlRecomputeRecipe(fixture);
    const core = computeProfit({
      price: fixture.price,
      servings: fixture.baseServings,
      taxMode: 'included',
      lines: fixture.lines,
      extraPerServing: fixture.extraPerServing,
      fixedRate: fixture.fixedRate,
    });
    expect(core.materialCost).toBeCloseTo(sql.material, 10);
    expect(core.tax).toBeCloseTo(sql.tax, 10);
    expect(core.fixedCost).toBeCloseTo(sql.fixed, 10);
    expect(core.profit).toBeCloseTo(sql.profit, 10);
    expect(Math.round(core.profit)).toBe(4014);
  });

  it('순이익률 — core 는 비율(0~1), SQL 은 % 2자리 반올림', () => {
    const sql = sqlRecomputeRecipe(fixture);
    const core = computeProfit({
      price: fixture.price, servings: fixture.baseServings, taxMode: 'included',
      lines: fixture.lines, extraPerServing: fixture.extraPerServing, fixedRate: fixture.fixedRate,
    });
    expect(Math.round(core.profitRate * 100 * 100) / 100).toBe(sql.profitRatePct);
  });

  it('세금 — 부가세 포함은 판매가 × 10/110', () => {
    expect(taxAmount(12000, 'included')).toBeCloseTo(sqlRecomputeRecipe(fixture).tax, 10);
    expect(taxAmount(12000, 'separate')).toBe(0);
  });

  it('단가 null 재료 — core 는 건너뛰고 SQL 은 coalesce 0, 결과 원가는 같다', () => {
    const withNull = {
      ...fixture,
      lines: [
        { inputQty: 10, baseUnitPrice: null },
        { inputQty: 10, baseUnitPrice: 2835 },
      ],
    };
    const sql = sqlRecomputeRecipe(withNull);
    const core = computeProfit({
      price: withNull.price, servings: withNull.baseServings, taxMode: 'included',
      lines: withNull.lines, extraPerServing: withNull.extraPerServing, fixedRate: withNull.fixedRate,
    });
    expect(core.materialCost).toBeCloseTo(sql.material, 10);
    // 다만 core 만 '잠정' 신호를 준다 — SQL 에는 대응 플래그가 없다(관측성 격차).
    expect(core.hasMissingPrice).toBe(true);
  });

  it('판매가 0 이면 양쪽 모두 비율 0', () => {
    const zero = { ...fixture, price: 0 };
    expect(sqlRecomputeRecipe(zero).profitRatePct).toBe(0);
    const core = computeProfit({
      price: 0, servings: zero.baseServings, taxMode: 'included',
      lines: zero.lines, extraPerServing: zero.extraPerServing, fixedRate: zero.fixedRate,
    });
    expect(core.profitRate).toBe(0);
  });

  it('1인분 환산 — input_qty / base_servings 가 core perServingQty 와 같다', () => {
    expect(perServingQty(10, 10)).toBe(10 / 10);
    expect(perServingQty(35, 10)).toBe(35 / 10);
  });

  /**
   * 인분 0 — 역할 분담이 다르지만 결과는 안전한 쪽으로 일치한다.
   *   SQL: `recipes.base_servings int not null default 1 check (base_servings > 0)`
   *        (20260608000004_recipes_pl.sql:13) 로 **스키마가 0 을 아예 막는다** → 나눗셈에 도달하지 않는다.
   *   core: 저장 전 미리보기라 스키마 보호를 받지 못하므로 함수가 직접 막는다(M-001).
   * 즉 방어 위치는 다르지만 "0 인분은 계산하지 않는다"는 계약은 같다.
   */
  it('인분 0 — core 가 스키마 CHECK 와 같은 계약을 함수 수준에서 지킨다', () => {
    expect(perServingQty(10, 0)).toBeNull();
    expect(perServingQty(10, -5)).toBeNull();
  });

  /**
   * ⚠ 알려진 차이 — 음수 판매가.
   * SQL `recipes.price numeric not null default 0` 에는 **CHECK 제약이 없다**(동 파일 10행).
   * 즉 DB 수준에서는 음수 판매가가 저장될 수 있고, 그러면 세금·고정지출·순이익률이 모두 뒤집힌다.
   * core 는 M-001 에서 0 으로 정규화해 막았다. 스키마 보강은 별도 미션(M-018).
   */
  it('[알려진 차이] 음수 판매가 — core 는 0 으로 정규화, SQL 에는 제약이 없다', () => {
    const core = computeProfit({
      price: -12000, servings: 10, taxMode: 'included',
      lines: [], extraPerServing: 0, fixedRate: 0,
    });
    expect(core.price).toBe(0);
    expect(core.tax).toBe(0);
    // SQL 참조 구현은 음수를 그대로 계산한다 — 제약이 없으므로 이 값이 저장될 수 있다.
    expect(sqlRecomputeRecipe({
      price: -12000, baseServings: 10, taxIncluded: true,
      lines: [], extraPerServing: 0, fixedRate: 0,
    }).tax).toBeLessThan(0);
  });
});
