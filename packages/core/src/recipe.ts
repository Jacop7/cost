/**
 * 레시피 원가·손익 계산 — ② 3장, ⑤ 2.3.
 * 1인분 소요량 = 입력량 ÷ N. 재료 원가 = Σ(1인분량 × 기준단가).
 * 순이익 = 판매가 − 세금 − 재료 − 고정 − 추가.
 * 권장 판매가 = (재료+추가) ÷ (1 − 1/11 − 고정지출률 − 목표).
 */
import type { TaxItem } from '@sikjae/types';
import { isNonNegativeFinite, isPositiveFinite } from './guards';

/**
 * 1인분 소요량 = 입력량(N인분) ÷ N.
 * 인분이 0 이하이거나 입력량이 음수·비유한이면 산출 불가(null) — Infinity 로 전파시키지 않는다.
 */
export function perServingQty(inputQty: number, servings: number): number | null {
  if (!isNonNegativeFinite(inputQty)) return null;
  if (!isPositiveFinite(servings)) return null;
  return inputQty / servings;
}

/**
 * 세금 비율(판매가 대비 0~1) = **사장님이 적은 항목의 합**(0090).
 *
 * 부가세도 항목 하나다. 포함/별도/면세 세 갈래는 없앴다 — 답해야 할 질문이
 * 하나 더 생기는 것이었다. 항목이 없으면 0이고, 그게 면세다.
 *
 * ⚠ 부가세 포함 가격이면 요율은 10 이 아니라 **10/110 = 9.0909…** 다.
 * SQL `tax_of()` 와 같은 공식이다 — 한쪽만 고치면 안 된다(절대원칙 3).
 */
export function taxRate(items: readonly TaxItem[] = []): number {
  let rate = 0;
  for (const i of items) {
    // 0 이하·비유한 요율은 없는 항목으로 본다. SQL 의 `where rate > 0` 과 같다.
    if (!isPositiveFinite(i?.rate)) continue;
    rate += i.rate / 100;
  }
  return rate;
}

/** 세금액 = 판매가 × 세금 비율. */
export function taxAmount(price: number, items: readonly TaxItem[] = []): number {
  if (!isNonNegativeFinite(price)) return 0; // 음수·비유한 판매가에서 음수 세금을 만들지 않는다
  return price * taxRate(items);
}

/** 항목별 내역 — 화면이 '(−) 세금'을 펼칠 때 쓴다. SQL `tax_breakdown()` 미러. */
export function taxBreakdown(
  price: number,
  items: readonly TaxItem[] = [],
): { name: string; rate: number; amount: number; builtin: boolean }[] {
  const p = isNonNegativeFinite(price) ? price : 0;
  const out: { name: string; rate: number; amount: number; builtin: boolean }[] = [];
  // 0090: 기본 항목은 없다. 부가세도 사장님이 적은 줄 하나다.
  for (const i of items) {
    if (!isPositiveFinite(i?.rate)) continue;
    out.push({ name: i.name, rate: i.rate, amount: (p * i.rate) / 100, builtin: false });
  }
  return out;
}

export interface RecipeLineInput {
  inputQty: number; // N인분 기준 입력량(기준단위)
  baseUnitPrice: number | null; // 기준 단가(원/기준단위). null이면 잠정(0 취급, '?')
}

export interface ProfitInput {
  price: number; // 판매가
  servings: number; // 기준 인분 N
  /** 세금 항목(0090). 부가세도 여기 한 줄이다. 없으면 세금 0원 — 그게 면세다. */
  taxItems?: readonly TaxItem[];
  lines: RecipeLineInput[];
  extraPerServing: number; // 추가 지출 합(1인분 정액)
  fixedRate: number | null; // 고정지출률(0~1). null이면 0% 잠정(A-04)
}

export interface ProfitResult {
  price: number;
  tax: number;
  materialCost: number;
  extraCost: number;
  fixedCost: number;
  profit: number;
  profitRate: number; // 0~1
  materialRate: number; // 0~1
  hasMissingPrice: boolean; // 단가 미입력 재료 포함 → 잠정치
}

/** 재료 원가(1인분) = Σ(1인분량 × 기준단가). 단가 null은 0으로 잠정. */
export function materialCost(lines: RecipeLineInput[], servings: number): {
  cost: number;
  hasMissingPrice: boolean;
} {
  let cost = 0;
  let hasMissingPrice = false;
  for (const l of lines) {
    // 단가 미입력은 잠정(0원 취급) — SQL 의 coalesce(base_unit_price, 0) 와 같은 값이 된다.
    if (l.baseUnitPrice == null || !isNonNegativeFinite(l.baseUnitPrice)) {
      hasMissingPrice = true;
      continue;
    }
    // 입력량·인분이 오염되면 그 라인을 원가에 더하지 않고 잠정으로 표시한다.
    // (음수 입력량을 더하면 원가가 깎여 순이익이 과대 계상된다.)
    const per = perServingQty(l.inputQty, servings);
    if (per === null) {
      hasMissingPrice = true;
      continue;
    }
    cost += per * l.baseUnitPrice;
  }
  return { cost, hasMissingPrice };
}

/** 손익 계산 (② 3장). 검산: 제육 → profit 4014, rate 0.334. */
export function computeProfit(input: ProfitInput): ProfitResult {
  const { servings, taxItems, lines } = input;
  // 음수·비유한 판매가는 0으로 정규화한다. 음수 매출은 도메인상 존재하지 않고,
  // 그대로 흘리면 세금·고정지출·순이익률이 전부 뒤집힌다.
  const price = isNonNegativeFinite(input.price) ? input.price : 0;
  const extraPerServing = isNonNegativeFinite(input.extraPerServing) ? input.extraPerServing : 0;
  const rawFixedRate = input.fixedRate ?? 0;
  const fixedRate = isNonNegativeFinite(rawFixedRate) ? rawFixedRate : 0;
  const tax = taxAmount(price, taxItems ?? []);
  const mat = materialCost(lines, servings);
  const fixedCost = fixedRate * price;
  const profit = price - tax - mat.cost - extraPerServing - fixedCost;
  return {
    price,
    tax,
    materialCost: mat.cost,
    extraCost: extraPerServing,
    fixedCost,
    profit,
    profitRate: price > 0 ? profit / price : 0,
    materialRate: price > 0 ? mat.cost / price : 0,
    hasMissingPrice: mat.hasMissingPrice,
  };
}

/**
 * 권장 판매가 (② 3.6) = (재료+추가) ÷ (1 − 세금비율 − 고정지출률 − 목표순이익률).
 * 세금비율 기본값은 부가세 포함분 1/11(=10/110). 카드 수수료 같은 세금 항목이 있으면
 * `taxRate(items)` 를 넘긴다 — 안 넘기면 그만큼 권장가가 낮게 나온다(0052).
 * 분모 ≤ 0이면 산출 불가(null).
 * 검산: 제육 (2835+300)/(1−1/11−0.313−0.40) ≈ 15,986 → 16,000
 */
export function recommendedPrice(
  materialPlusExtra: number,
  fixedRate: number,
  targetProfitRate: number,
  taxRatio: number = 10 / 110,
): number | null {
  const denom = 1 - taxRatio - fixedRate - targetProfitRate;
  return denom > 0 ? materialPlusExtra / denom : null;
}
