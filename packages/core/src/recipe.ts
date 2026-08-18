/**
 * 레시피 원가·손익 계산 — ② 3장, ⑤ 2.3.
 * 1인분 소요량 = 입력량 ÷ N. 재료 원가 = Σ(1인분량 × 기준단가).
 * 순이익 = 판매가 − 세금 − 재료 − 고정 − 추가.
 * 권장 판매가 = (재료+추가) ÷ (1 − 1/11 − 고정지출률 − 목표).
 */
import type { TaxMode } from '@sikjae/types';
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

/** 세금액 — 부가세 포함: 판매가 × 10/110, 별도/면세: 0(별도는 외부 부과, 면세 없음). */
export function taxAmount(price: number, mode: TaxMode): number {
  if (!isNonNegativeFinite(price)) return 0; // 음수·비유한 판매가에서 음수 세금을 만들지 않는다
  return mode === 'included' ? (price * 10) / 110 : 0;
}

export interface RecipeLineInput {
  inputQty: number; // N인분 기준 입력량(기준단위)
  baseUnitPrice: number | null; // 기준 단가(원/기준단위). null이면 잠정(0 취급, '?')
}

export interface ProfitInput {
  price: number; // 판매가
  servings: number; // 기준 인분 N
  taxMode: TaxMode;
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
  const { servings, taxMode, lines } = input;
  // 음수·비유한 판매가는 0으로 정규화한다. 음수 매출은 도메인상 존재하지 않고,
  // 그대로 흘리면 세금·고정지출·순이익률이 전부 뒤집힌다.
  const price = isNonNegativeFinite(input.price) ? input.price : 0;
  const extraPerServing = isNonNegativeFinite(input.extraPerServing) ? input.extraPerServing : 0;
  const rawFixedRate = input.fixedRate ?? 0;
  const fixedRate = isNonNegativeFinite(rawFixedRate) ? rawFixedRate : 0;
  const tax = taxAmount(price, taxMode);
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
 * 권장 판매가 (② 3.6) = (재료+추가) ÷ (1 − 1/11 − 고정지출률 − 목표순이익률).
 * 부가세 포함분 1/11(=10/110). 분모 ≤ 0이면 산출 불가(null).
 * 검산: 제육 (2835+300)/(1−1/11−0.313−0.40) ≈ 15,986 → 16,000
 */
export function recommendedPrice(
  materialPlusExtra: number,
  fixedRate: number,
  targetProfitRate: number,
): number | null {
  const denom = 1 - 1 / 11 - fixedRate - targetProfitRate;
  return denom > 0 ? materialPlusExtra / denom : null;
}
