import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { recommendInternationalPrice, type InternationalPriceRecommendationInput as Input } from '../src/internationalPriceRecommendation';
import type { InternationalTaxComponentInput as Component } from '../src/internationalTax';

const primary = (ratePct = 10): Component => ({ id: 'primary', kind: 'primary', ratePct,
  calculationBasis: 'primary_tax_exclusive', appliesToTreatments: ['taxable'], remittanceOwner: 'merchant' });
const additional = (id: string, ratePct: number, inclusive = false): Component => ({
  id, kind: 'additional', ratePct, calculationBasis: inclusive ? 'primary_tax_inclusive' : 'primary_tax_exclusive',
  appliesToTreatments: ['taxable'], remittanceOwner: 'marketplace',
});
const input = (overrides: Partial<Input> = {}): Input => ({ materialPerServing: 2, extraPerServing: 0,
  fixedRate: 0.313, targetProfitRate: 20,
  tax: { priceBasis: 'tax_inclusive', minorUnit: 0, treatment: 'taxable', components: [primary()] }, ...overrides });

// Independent exact rational oracle: neither Decimal, the tax helper, nor the
// production lower-bound jump is used. Enumerate EVERY lower positive minor.
type F = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => { while (b) [a, b] = [b, a % b]; return a < 0n ? -a : a; };
function fraction(n: bigint, d = 1n): F { const g = gcd(n, d); return { n: n / g, d: d / g }; }
function numberF(n: number): F {
  const [mantissa, power = '0'] = String(n).toLowerCase().split('e');
  const [whole, digits = ''] = mantissa!.split('.');
  const scale = digits.length - Number(power);
  const numerator = BigInt(whole! + digits);
  return scale >= 0 ? fraction(numerator, 10n ** BigInt(scale)) : fraction(numerator * 10n ** BigInt(-scale));
}
const plus = (a: F, b: F) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
const minus = (a: F, b: F) => plus(a, { n: -b.n, d: b.d });
const times = (a: F, b: F) => fraction(a.n * b.n, a.d * b.d);
const divide = (a: F, b: F) => fraction(a.n * b.d, a.d * b.n);
const one = fraction(1n);
const zero = fraction(0n);
const hundred = fraction(100n);
const gte = (a: F, b: F) => a.n * b.d >= b.n * a.d;
function oracle(input: Input, units: number): { meets: boolean; net: F } {
  const { tax } = input;
  const step = fraction(1n, tax.minorUnit === 0 ? 1n : 100n);
  const price = times(numberF(units), step);
  const primaryRate = tax.treatment === 'taxable'
    ? divide(numberF(tax.components.find(c => c.kind === 'primary')!.ratePct), hundred) : zero;
  const coefficients = tax.components.map(c => {
    if (!(c.kind === 'primary' ? tax.treatment === 'taxable' : c.appliesToTreatments.includes(tax.treatment))) return zero;
    return times(divide(numberF(c.ratePct), hundred), c.calculationBasis === 'primary_tax_inclusive' ? plus(one, primaryRate) : one);
  });
  const multiplier = coefficients.reduce((sum, c, i) => tax.components[i]!.kind === 'additional' ? plus(sum, c) : sum, plus(one, primaryRate));
  const base = tax.priceBasis === 'tax_inclusive' ? divide(price, multiplier) : price;
  const taxes = coefficients.reduce((sum, c) => {
    const minorAmount = divide(times(base, c), step);
    const rounded = (minorAmount.n * 2n + minorAmount.d) / (minorAmount.d * 2n);
    return plus(sum, times(fraction(rounded), step));
  }, zero);
  const net = tax.priceBasis === 'tax_inclusive' ? minus(price, taxes) : price;
  const profit = minus(minus(net, plus(numberF(input.materialPerServing!), numberF(input.extraPerServing!))), times(numberF(input.fixedRate!), price));
  return { meets: gte(profit, times(price, divide(numberF(input.targetProfitRate), hundred))), net };
}
function brute(input: Input, limit: number): number | null {
  for (let k = 1; k <= limit; k++) if (oracle(input, k).meets) return k;
  return null;
}

describe('international minimum price: preview and SQL verification only', () => {
  const markets: [string, 0 | 2, Component[]][] = [
    ['KR', 0, [primary(10)]], ['US', 2, [primary(0), additional('state', 5), additional('local', 2)]],
    ['GB', 2, [primary(20)]], ['CA', 2, [primary(5), additional('qst', 9.975)]], ['AU', 2, [primary(10)]],
  ];
  for (const [country, minorUnit, components] of markets) {
    for (const priceBasis of ['tax_inclusive', 'tax_exclusive'] as const) {
      for (const treatment of ['taxable', 'zero_rated', 'exempt'] as const) {
        it(`${country} ${priceBasis} ${treatment}: matches exhaustive fractions, previous minor fails`, () => {
          const fixture = input({ materialPerServing: minorUnit === 0 ? 2 : 0.02,
            extraPerServing: minorUnit === 0 ? 1 : 0.01, tax: { priceBasis, minorUnit, treatment, components } });
          const expected = brute(fixture, 500);
          expect(expected).not.toBeNull();
          const actual = recommendInternationalPrice(fixture);
          expect(actual.status).toBe('ready');
          if (actual.status !== 'ready') return;
          const units = Math.round(actual.price * (minorUnit === 0 ? 1 : 100));
          expect(units).toBe(expected);
          expect(oracle(fixture, units).meets).toBe(true);
          if (units > 1) expect(oracle(fixture, units - 1).meets).toBe(false);
        });
      }
    }
  }
  it('compound inclusive-base additional tax agrees with exhaustive oracle', () => {
    for (const treatment of ['taxable', 'zero_rated', 'exempt'] as const) {
      const extra = { ...additional('compound', 5, true), appliesToTreatments: [treatment] };
      const fixture = input({ tax: { priceBasis: 'tax_inclusive', minorUnit: 2, treatment, components: [primary(), extra] }, materialPerServing: 0.17 });
      expect(recommendInternationalPrice(fixture)).toMatchObject({ status: 'ready', price: brute(fixture, 1000)! / 100 });
    }
  });
  it('simultaneous component rounding makes net nonmonotonic; the first feasible price is still found', () => {
    const fixture = input({ materialPerServing: 0.5, fixedRate: 0.25, targetProfitRate: 0,
      tax: { priceBasis: 'tax_inclusive', minorUnit: 0, treatment: 'taxable', components: [primary(0), additional('a', 50), additional('b', 50)] } });
    expect(gte(oracle(fixture, 1).net, oracle(fixture, 2).net)).toBe(true);
    expect(gte(oracle(fixture, 2).net, oracle(fixture, 1).net)).toBe(false);
    expect(recommendInternationalPrice(fixture)).toMatchObject({ status: 'ready', price: 1, profit: '0.25' });
  });
  it('deterministic small cases independently scan all lower minor prices', () => {
    let seed = 20260911;
    const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    for (let j = 0; j < 60; j++) {
      const fixture = input({ materialPerServing: (next() % 150) / 100, extraPerServing: (next() % 20) / 100,
        fixedRate: (next() % 20) / 100, targetProfitRate: next() % 40,
        tax: { priceBasis: j % 2 ? 'tax_inclusive' : 'tax_exclusive', minorUnit: 2,
          treatment: 'taxable', components: [primary(next() % 25), additional('a', next() % 8, j % 3 === 0)] } });
      const expected = brute(fixture, 2000);
      expect(expected).not.toBeNull();
      expect(recommendInternationalPrice(fixture)).toMatchObject({ status: 'ready', price: expected! / 100 });
    }
  });
  it('does not skip an exact equality ceiling boundary', () => {
    const fixture = input({ materialPerServing: 7, fixedRate: 0.5, targetProfitRate: 0,
      tax: { priceBasis: 'tax_exclusive', minorUnit: 0, treatment: 'taxable', components: [primary()] } });
    expect(recommendInternationalPrice(fixture)).toMatchObject({ status: 'ready', price: 14, profit: '0', profitRate: '0' });
  });
  it.each([0, 2] as const)('zero cost tests first positive minor even with zero margin (minor=%s)', minorUnit => {
    const fixture = input({ materialPerServing: 0, fixedRate: 1, targetProfitRate: 0,
      tax: { priceBasis: 'tax_exclusive', minorUnit, treatment: 'exempt', components: [primary()] } });
    expect(recommendInternationalPrice(fixture)).toMatchObject({ status: 'ready', price: minorUnit === 0 ? 1 : 0.01, iterations: 1 });
    expect(recommendInternationalPrice({ ...fixture, fixedRate: 1.01 })).toMatchObject({ status: 'range_exhausted', price: null, iterations: 1 });
    expect(recommendInternationalPrice({ ...fixture, materialPerServing: 1 })).toMatchObject({ status: 'range_exhausted', price: null });
  });
  it('target 100% can be feasible at zero cost but positive cost cannot', () => {
    const fixture = input({ materialPerServing: 0, fixedRate: 0, targetProfitRate: 100,
      tax: { priceBasis: 'tax_inclusive', minorUnit: 0, treatment: 'exempt', components: [primary()] } });
    expect(recommendInternationalPrice(fixture)).toMatchObject({ status: 'ready', price: 1 });
    expect(recommendInternationalPrice({ ...fixture, extraPerServing: 1 })).toMatchObject({ status: 'range_exhausted' });
  });
  it('caps at 2048 tax quotes without claiming impossibility or an unproven price', () => {
    const fixture = input({ materialPerServing: 20, fixedRate: 0.5, targetProfitRate: 0,
      tax: { priceBasis: 'tax_inclusive', minorUnit: 0, treatment: 'taxable', components: [primary(0), additional('a', 50), additional('b', 50)] } });
    expect(recommendInternationalPrice(fixture)).toEqual({ status: 'search_limit', price: null, quote: null, profit: null, profitRate: null, iterations: 2048 });
  });
  it('includes exact maximum price; exceeding range does not return a quote', () => {
    const fixture = input({ materialPerServing: 90071992547409, fixedRate: 0, targetProfitRate: 0,
      tax: { priceBasis: 'tax_exclusive', minorUnit: 2, treatment: 'exempt', components: [primary()] } });
    expect(recommendInternationalPrice(fixture)).toMatchObject({ status: 'ready', price: 90071992547409 });
    expect(recommendInternationalPrice({ ...fixture, extraPerServing: 0.01 })).toMatchObject({ status: 'range_exhausted', iterations: 0 });
  });
  it('does not claim a minimum when a cent cannot round-trip through the number tax API', () => {
    expect(recommendInternationalPrice(input({ materialPerServing: 90071992547408, extraPerServing: 0.01, fixedRate: 0, targetProfitRate: 0,
      tax: { priceBasis: 'tax_exclusive', minorUnit: 2, treatment: 'exempt', components: [primary()] } }))).toMatchObject({ status: 'precision_unavailable', price: null });
  });
  it('catches a finite-precision tax quote mismatch without altering global Decimal configuration', () => {
    const precision = Decimal.precision;
    try {
      Decimal.set({ precision: 2 });
      expect(recommendInternationalPrice(input({ materialPerServing: 1000 }))).toMatchObject({ status: 'precision_unavailable', price: null });
      expect(Decimal.precision).toBe(2);
    } finally { Decimal.set({ precision }); }
  });
  it.each(['materialPerServing', 'extraPerServing', 'fixedRate'] as const)('null %s is missing, not a zero basis', key => {
    expect(recommendInternationalPrice(input({ [key]: null }))).toMatchObject({ status: 'basis_missing', iterations: 0 });
  });
  it.each([-1, NaN, Infinity])('rejects invalid basis/rates %s', value => {
    for (const key of ['materialPerServing', 'extraPerServing', 'fixedRate', 'targetProfitRate'])
      expect(() => recommendInternationalPrice(input({ [key]: value }))).toThrow();
  });
  it('rejects invalid target, minor, basis, treatment and component contracts', () => {
    expect(() => recommendInternationalPrice(input({ targetProfitRate: 101 }))).toThrow();
    for (const patch of [{ minorUnit: 1 }, { priceBasis: 'invalid' }, { treatment: 'invalid' },
      { components: [] }, { components: [primary(), primary()] }, { components: [primary(100)] },
      { components: [{ ...primary(), calculationBasis: 'bad' }] }, { components: [{ ...primary(), id: '' }] }]) {
      expect(() => recommendInternationalPrice(input({ tax: { ...input().tax, ...patch } as Input['tax'] }))).toThrow();
    }
  });
});
