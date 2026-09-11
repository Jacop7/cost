import Decimal from 'decimal.js';
import {
  calculateInternationalTax,
  type InternationalTaxInput,
  type InternationalTaxResult,
} from './internationalTax';

export type InternationalPriceRecommendationInput = {
  tax: Omit<InternationalTaxInput, 'unitPrice' | 'quantity'>;
  materialPerServing: number | null;
  extraPerServing: number | null;
  /** Ratio, not percent: 0.313 means 31.3%. May exceed one. */
  fixedRate: number | null;
  /** Percent in [0, 100], with listed price as the denominator. */
  targetProfitRate: number;
};

export type InternationalPriceRecommendation = {
  status: 'ready';
  price: number;
  quote: InternationalTaxResult;
  /** Decimal strings avoid losing the multiplication/comparison precision. */
  profit: string;
  /** Display only; never used for the target comparison. */
  profitRate: string;
  iterations: number;
} | {
  status: 'basis_missing' | 'range_exhausted' | 'search_limit' | 'precision_unavailable';
  price: null;
  quote: null;
  profit: null;
  profitRate: null;
  iterations: number;
};

const MAX_PRICE = '90071992547409';
const SEARCH_LIMIT = 2048;
// All inputs are finite JS numbers (at most 17 significant decimal digits,
// exponent -324..308), and at most 500 components. 2048 digits cover the finite
// additions/products below, including products of two tiny tax rates. No global
// Decimal configuration is changed. Nonterminating quotients are never used to
// decide a ceiling or a tax rounding boundary.
const D = Decimal.clone({ precision: 2048, rounding: Decimal.ROUND_HALF_UP });

function unavailable(status: Exclude<InternationalPriceRecommendation['status'], 'ready'>,
  iterations = 0): InternationalPriceRecommendation {
  return { status, price: null, quote: null, profit: null, profitRate: null, iterations };
}

function nonnegative(value: number | null, name: string): void {
  if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
    throw new Error(`${name} must be a finite nonnegative number or null`);
  }
}

function ceilRatio(numerator: Decimal, denominator: Decimal): Decimal {
  const whole = numerator.divToInt(denominator);
  return whole.times(denominator).lt(numerator) ? whole.plus(1) : whole;
}

function roundRatio(numerator: Decimal, denominator: Decimal): Decimal {
  const whole = numerator.divToInt(denominator);
  return numerator.minus(whole.times(denominator)).times(2).gte(denominator)
    ? whole.plus(1) : whole;
}

/**
 * Preview/check only. DB recipe_draft_preview (0205) is authoritative for stored
 * costs, tax profiles and the final recommendation. Callers supply an already
 * normalized one-serving basis; this helper reads/writes no store or ledger.
 *
 * Lower-bound invariant (MINIMUM-PROOF.md): all positive minor prices below k*u
 * are excluded. A=1-fixed-target/100. Initially k=ceil(C/(A*u)) if A>0.
 * When p fails, tax(Q)>=tax(p) for Q>p, so Q*A<C+tax(p) excludes Q. Jump to
 * max(k+1, ceil((C+tax(p))/(A*u))). Exclusive prices deduct no tax. This does NOT
 * binary-search profit: simultaneous tax rounding can make profit decrease.
 * With A<=0, test the first positive price (zero-cost equality can succeed),
 * then failure excludes the whole range. No solution is asserted at a search
 * cap: after 2048 quotes return search_limit, with no suggested price.
 *
 * Existing calculateInternationalTax has a number boundary and finite Decimal
 * precision. We reuse its quote, but certify every rounded amount with exact
 * finite decimal numerator/denominator arithmetic. If price/quote loses decimal
 * precision, fail closed with precision_unavailable; never label it a minimum.
 * This is a core-only limitation, not a SQL status. No floating rate extrapolation
 * or assumed bound on intermediate division errors is used.
 */
export function recommendInternationalPrice(
  input: InternationalPriceRecommendationInput,
): InternationalPriceRecommendation {
  nonnegative(input.materialPerServing, 'materialPerServing');
  nonnegative(input.extraPerServing, 'extraPerServing');
  nonnegative(input.fixedRate, 'fixedRate');
  if (typeof input.targetProfitRate !== 'number' || !Number.isFinite(input.targetProfitRate)
    || input.targetProfitRate < 0 || input.targetProfitRate > 100) {
    throw new Error('targetProfitRate must be a finite percent in [0, 100]');
  }
  const { tax } = input;
  if (!tax || !['tax_inclusive', 'tax_exclusive'].includes(tax.priceBasis)
    || !['taxable', 'zero_rated', 'exempt'].includes(tax.treatment)
    || (tax.minorUnit !== 0 && tax.minorUnit !== 2) || !Array.isArray(tax.components)) {
    throw new Error('Invalid international tax context');
  }
  for (const c of tax.components) {
    if (!c || typeof c.id !== 'string' || !c.id.trim()
      || !['primary', 'additional'].includes(c.kind)
      || !['primary_tax_exclusive', 'primary_tax_inclusive'].includes(c.calculationBasis)
      || !['merchant', 'marketplace'].includes(c.remittanceOwner)
      || !Array.isArray(c.appliesToTreatments)
      || c.appliesToTreatments.some(t => !['taxable', 'zero_rated', 'exempt'].includes(t))) {
      throw new Error('Invalid international tax component');
    }
  }
  // Reuse the public tax helper's primary/duplicate/rate validation as well.
  calculateInternationalTax({ ...tax, unitPrice: 0, quantity: 1 });
  if (input.materialPerServing === null || input.extraPerServing === null || input.fixedRate === null) {
    return unavailable('basis_missing');
  }
  if (tax.components.length > 500) return unavailable('precision_unavailable');

  const step = new D(tax.minorUnit === 0 ? 1 : '0.01');
  const maxUnits = new D(MAX_PRICE).div(step);
  const cost = new D(input.materialPerServing).plus(input.extraPerServing);
  const fixed = new D(input.fixedRate);
  const target = new D(input.targetProfitRate).div(100);
  const margin = new D(1).minus(fixed).minus(target);
  const primary = tax.components.find(c => c.kind === 'primary')!;
  const primaryRate = new D(tax.treatment === 'taxable' ? primary.ratePct : 0).div(100);
  const coefficients = tax.components.map(c => {
    const applies = c.kind === 'primary' ? tax.treatment === 'taxable'
      : c.appliesToTreatments.includes(tax.treatment);
    return applies ? new D(c.ratePct).div(100).times(
      c.calculationBasis === 'primary_tax_inclusive' ? primaryRate.plus(1) : 1,
    ) : new D(0);
  });
  const multiplier = coefficients.reduce((sum, c, i) =>
    tax.components[i]!.kind === 'additional' ? sum.plus(c) : sum, primaryRate.plus(1));
  const divisor = tax.priceBasis === 'tax_inclusive' ? multiplier : new D(1);
  const denominator = divisor.times(step);

  let units = margin.gt(0) ? D.max(1, ceilRatio(cost, margin.times(step))) : new D(1);
  let iterations = 0;
  while (units.lte(maxUnits) && iterations < SEARCH_LIMIT) {
    iterations++;
    const price = units.times(step);
    const listed = price.toNumber();
    if (!Number.isFinite(listed) || !new D(listed).eq(price)) {
      return unavailable('precision_unavailable', iterations);
    }
    const quote = calculateInternationalTax({ ...tax, unitPrice: listed, quantity: 1 });
    let totalTax = new D(0);
    let merchantTax = new D(0);
    let marketplaceTax = new D(0);
    for (let j = 0; j < coefficients.length; j++) {
      const rounded = roundRatio(price.times(coefficients[j]!), denominator).times(step);
      const actual = quote.components[j]!.roundedAmount;
      if (!Number.isFinite(actual) || !rounded.eq(actual)) {
        return unavailable('precision_unavailable', iterations);
      }
      totalTax = totalTax.plus(rounded);
      if (tax.components[j]!.remittanceOwner === 'merchant') merchantTax = merchantTax.plus(rounded);
      else marketplaceTax = marketplaceTax.plus(rounded);
    }
    const deductedTax = tax.priceBasis === 'tax_inclusive' ? totalTax : new D(0);
    const net = price.minus(deductedTax);
    const customer = tax.priceBasis === 'tax_inclusive' ? price : price.plus(totalTax);
    const pairs: [Decimal, number][] = [[price, quote.listedTotal], [net, quote.netSales],
      [customer, quote.customerTotal], [totalTax, quote.taxTotal],
      [merchantTax, quote.merchantTaxLiability], [marketplaceTax, quote.marketplaceTaxLiability]];
    if (pairs.some(([expected, actual]) => !Number.isFinite(actual) || !expected.eq(actual))) {
      return unavailable('precision_unavailable', iterations);
    }
    const profit = net.minus(cost).minus(fixed.times(price));
    if (profit.gte(price.times(target))) {
      return { status: 'ready', price: listed, quote, profit: profit.toFixed(),
        profitRate: profit.div(price).toSignificantDigits(30).toString(), iterations };
    }
    if (margin.lte(0)) return unavailable('range_exhausted', iterations);
    units = D.max(units.plus(1), ceilRatio(cost.plus(deductedTax), margin.times(step)));
  }
  return unavailable(units.gt(maxUnits) ? 'range_exhausted' : 'search_limit', iterations);
}
