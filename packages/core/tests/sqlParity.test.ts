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
  purchases: { amount: number; volume: number; receivedQty: number }[],
  lossPercent: number,
): number | null {
  let num = 0;
  let den = 0;
  for (const p of purchases) {
    if (p.volume === 0) continue; // nullif(volume,0) → null → sum 에서 제외
    // ⚠ 가중치는 **실입고량**이다(0038). 발주량을 쓰면 아직 안 온 물량이 평균을 끈다.
    num += (p.amount / p.volume) * p.receivedQty;
    den += p.receivedQty;
  }
  if (den === 0) return null;
  const avg = num / den;
  const loss = lossPercent / 100;
  if (!Number.isFinite(loss) || loss < 0 || loss >= 1) return null;
  return avg / (1 - loss);
}

/** SQL `real_loss_rate`: 누적폐기 / 누적구매 × 100. 구매 <= 0 이면 null. **%로 반환**한다. */
/**
 * SQL `real_loss_rate(uuid)` — **0038 판** 기준.
 *
 *   v_events = 되돌려지지 않은 discard 이벤트 **건수**
 *   if v_events = 0 then return null            ← 0011: 측정 없음을 0% 로 단정하지 않는다
 *   v_purchase = Σ(volume × received_qty)       ← 0038: 발주량이 아니라 실입고량
 *   if v_purchase <= 0 then return null
 *   v_rate = v_discard / v_purchase × 100
 *   if v_rate >= 100 then return null           ← 0038: 산 것보다 많이 버릴 수는 없다
 *
 * ⚠ 이 미러는 예전에 v_events 가드가 없어 **0011 이 고친 버그를 그대로 인코딩**하고 있었다.
 *   그래서 "폐기 0건인데 0% 를 반환한다"는 회귀를 잡지 못했다.
 */
function sqlRealLossRatePercent(
  discardEvents: number[],
  purchases: { volume: number; receivedQty: number }[],
): number | null {
  const live = discardEvents.filter((v) => v > 0);
  if (live.length === 0) return null;
  const purchased = purchases.reduce((a, p) => a + p.volume * p.receivedQty, 0);
  if (purchased <= 0) return null;
  const rate = (live.reduce((a, v) => a + v, 0) / purchased) * 100;
  if (rate >= 100) return null;
  return rate;
}

/**
 * SQL `base_unit_price` 의 로스율 선택 규칙(0038 기준):
 *   v_loss = coalesce(real_loss_rate(id), ingredients.loss_rate)
 * 실측이 있으면 **추정을 대체한다**. 이 규칙은 core 에 미러가 없어 앱 미리보기와 서버가
 * 갈릴 수 있다 — 로스율 설계 재검토가 끝나면 core 로 옮겨야 한다.
 */
function sqlEffectiveLossPercent(realPercent: number | null, estimatedPercent: number): number {
  return realPercent ?? estimatedPercent;
}

/**
 * core `weightedAvgUnitPrice` 는 가중치를 `qty` 라는 이름으로 받는다.
 * SQL 에서 그 가중치는 **received_qty**(실입고량)다 — 앱은 반드시 실입고량을 넣어야 한다.
 * 발주량을 넣으면 아직 도착하지 않은 물량이 평균을 끌어 서버와 값이 갈린다.
 */
const forCore = (ps: { amount: number; volume: number; receivedQty: number }[]) =>
  ps.map((p) => ({ amount: p.amount, volume: p.volume, qty: p.receivedQty }));

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
    { amount: 4000, volume: 1000, receivedQty: 2 },
    { amount: 3600, volume: 1000, receivedQty: 3 },
    { amount: 4200, volume: 1000, receivedQty: 1 },
  ];

  it('정상 이력 + 로스 15% 에서 같은 값', () => {
    const core = baseUnitPrice(weightedAvgUnitPrice(forCore(purchases)), 0.15);
    const sql = sqlBaseUnitPrice(purchases, 15);
    expect(core).not.toBeNull();
    expect(core!).toBeCloseTo(sql!, 10);
  });

  it('검산 — 대파 단일 구매 4,000원/1,000g, 로스 15% → 4.71', () => {
    const one = [{ amount: 4000, volume: 1000, receivedQty: 1 }];
    expect(baseUnitPrice(weightedAvgUnitPrice(forCore(one)), 0.15)!).toBeCloseTo(sqlBaseUnitPrice(one, 15)!, 10);
    expect(Math.round(sqlBaseUnitPrice(one, 15)! * 100) / 100).toBe(4.71);
  });

  it('용량 0 인 이력은 양쪽 모두 평균에서 제외한다', () => {
    const mixed = [
      { amount: 4000, volume: 1000, receivedQty: 2 },
      { amount: 3600, volume: 0, receivedQty: 3 }, // 오염 행
    ];
    expect(weightedAvgUnitPrice(forCore(mixed))).toBe(4);
    expect(sqlBaseUnitPrice(mixed, 0)).toBe(4);
  });

  it('로스율 100% 는 양쪽 모두 null (분모 0)', () => {
    const one = [{ amount: 4000, volume: 1000, receivedQty: 1 }];
    expect(baseUnitPrice(weightedAvgUnitPrice(forCore(one)), 1)).toBeNull();
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
    const one = [{ amount: 4000, volume: 1000, receivedQty: 1 }];
    expect(baseUnitPrice(weightedAvgUnitPrice(one), 1.2)).toBeNull();
    expect(sqlBaseUnitPrice(one, 120)).toBeNull();
  });

  it('로스율 음수 — core·SQL 모두 null', () => {
    const one = [{ amount: 4000, volume: 1000, receivedQty: 1 }];
    expect(baseUnitPrice(weightedAvgUnitPrice(one), -0.1)).toBeNull();
    expect(sqlBaseUnitPrice(one, -10)).toBeNull();
  });
});

describe('real_loss_rate — 단위 차이를 명시한다', () => {
  const buy1kg = [{ volume: 1000, receivedQty: 1 }];

  it('core 는 0~1 비율, SQL 은 % — 정확히 100배 차이', () => {
    const core = realLossRate(150, 1000);
    const sql = sqlRealLossRatePercent([150], buy1kg);
    expect(core).toBe(0.15);
    expect(sql).toBe(15);
    expect(sql!).toBeCloseTo(core! * 100, 10);
  });

  it('구매 0 이면 양쪽 모두 null', () => {
    expect(realLossRate(150, 0)).toBeNull();
    expect(sqlRealLossRatePercent([150], [{ volume: 1000, receivedQty: 0 }])).toBeNull();
  });

  it('base_unit_price 가 SQL 에서 %를 100으로 나눠 쓰므로 최종값은 일치한다', () => {
    const one = [{ amount: 4000, volume: 1000, receivedQty: 1 }];
    const lossRatio = realLossRate(150, 1000)!; // 0.15
    const lossPct = sqlRealLossRatePercent([150], buy1kg)!; // 15
    expect(baseUnitPrice(weightedAvgUnitPrice(forCore(one)), lossRatio)!).toBeCloseTo(
      sqlBaseUnitPrice(one, lossPct)!,
      10,
    );
  });

  // ── 0011 · 0038 회귀 (예전 미러에는 이 가드가 없어 버그를 못 잡았다) ──

  it('폐기 기록이 0건이면 null — 0% 로 단정하지 않는다 (0011)', () => {
    expect(sqlRealLossRatePercent([], buy1kg)).toBeNull();
  });

  it('폐기량 0 인 유령 이벤트는 측정으로 치지 않는다 (0038-A)', () => {
    // e2_discard 가 "버릴 게 없는데" 만들던 0g 행. 이게 측정으로 잡히면
    // 사장님이 넣은 추정 로스율이 통째로 0% 로 덮인다.
    expect(sqlRealLossRatePercent([0], buy1kg)).toBeNull();
    expect(sqlRealLossRatePercent([0, 0], buy1kg)).toBeNull();
  });

  it('산 것보다 많이 버리면 측정 실패(null) — 원가 0원으로 무너지지 않게 (0038-E)', () => {
    expect(sqlRealLossRatePercent([1000], buy1kg)).toBeNull();  // 100%
    expect(sqlRealLossRatePercent([1600], buy1kg)).toBeNull();  // 160%
    expect(sqlRealLossRatePercent([999], buy1kg)).toBeCloseTo(99.9, 10); // 경계 바로 아래는 유효
  });

  it('분모는 실입고량 — 발주만 하고 안 온 물량은 세지 않는다 (0038-D)', () => {
    // 2개 발주 중 1개만 도착. 분모는 1,000g 이어야 한다(2,000g 이 아니라).
    const partial = [{ volume: 1000, receivedQty: 1 }];
    expect(sqlRealLossRatePercent([150], partial)).toBe(15);
  });
});

describe('로스율 선택 규칙 — 실측이 추정을 대체한다', () => {
  const one = [{ amount: 4000, volume: 1000, receivedQty: 1 }];

  it('실측이 없으면 추정(사용자 입력)을 쓴다 — 대파 4.7059', () => {
    const loss = sqlEffectiveLossPercent(null, 15);
    expect(loss).toBe(15);
    expect(Math.round(sqlBaseUnitPrice(one, loss)! * 10000) / 10000).toBe(4.7059);
  });

  it('실측이 있으면 추정을 대체한다 — 실측이 작으면 단가가 내려간다', () => {
    // 사용자가 지적한 현상: 폐기를 기록했는데 단가가 오히려 내려간다.
    // 폐기 자체는 단가를 올리지만(분모 1-loss), 대체 규칙 탓에 15% -> 4% 로 떨어져서다.
    const loss = sqlEffectiveLossPercent(4, 15);
    expect(loss).toBe(4);
    const lower = sqlBaseUnitPrice(one, loss)!;
    const higher = sqlBaseUnitPrice(one, 15)!;
    expect(lower).toBeLessThan(higher);
    expect(Math.round(lower * 10000) / 10000).toBe(4.1667);
  });

  it('로스율 자체는 커질수록 단가를 올린다 (단조 증가)', () => {
    const prices = [0, 5, 15, 30, 50].map((p) => sqlBaseUnitPrice(one, p)!);
    for (let i = 1; i < prices.length; i += 1) {
      expect(prices[i]!).toBeGreaterThan(prices[i - 1]!);
    }
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
