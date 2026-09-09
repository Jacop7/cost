import { round } from '@margincook/core';

/** 기존 시뮬레이터와 전체 화면이 공유하는 저장 없는 legacy 미리보기. */
export function previewRecipePrice(price: number, material: number, extra: number, fixedRate: number, taxRatio: number) {
  const tax = round(price * taxRatio);
  const fixed = round(fixedRate * price);
  const profit = price - tax - material - fixed - extra;
  return { tax, fixed, profit, rate: price > 0 ? profit / price : 0 };
}
