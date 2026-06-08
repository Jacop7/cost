/**
 * 레시피 원가·손익 계산 — ② 3장, ⑤ 2.3.
 * 1인분 소요량 = 입력량 ÷ N. 재료 원가 = Σ(1인분량 × 기준단가).
 * 순이익 = 판매가 − 세금 − 재료 − 고정 − 추가.
 * 권장 판매가 = (재료+추가) ÷ (1 − 1/11 − 고정지출률 − 목표).
 */
import type { TaxMode } from '@sikjae/types';

/** 1인분 소요량 = 입력량(N인분) ÷ N. */
export const perServingQty = (inputQty: number, servings: number): number => inputQty / servings;

/** 세금액 — 부가세 포함: 판매가 × 10/110, 별도/면세: 0(별도는 외부 부과, 면세 없음). */
export function taxAmount(price: number, mode: TaxMode): number {
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
    if (l.baseUnitPrice == null) {
      hasMissingPrice = true;
      continue;
    }
    cost += perServingQty(l.inputQty, servings) * l.baseUnitPrice;
  }
  return { cost, hasMissingPrice };
}

/** 손익 계산 (② 3장). 검산: 제육 → profit 4014, rate 0.334. */
export function computeProfit(input: ProfitInput): ProfitResult {
  const { price, servings, taxMode, lines, extraPerServing } = input;
  const tax = taxAmount(price, taxMode);
  const mat = materialCost(lines, servings);
  const fixedRate = input.fixedRate ?? 0;
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
