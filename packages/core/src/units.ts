/**
 * 단위 환산 (① 4.8). 입력 구매단위 → 기준단위(g/ml/개) 정규화.
 * 1차: 미터법만. 컵/스푼·미국/영국식은 2차(toMl 의 cup/tbsp 분기 자리만 둠).
 */
import type { BaseUnit } from '@sikjae/types';

export type InputUnit = 'g' | 'kg' | 'ml' | 'L' | 'ea' | 'cup' | 'tbsp' | 'tsp';

const TO_BASE: Record<InputUnit, { base: BaseUnit; factor: number }> = {
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  L: { base: 'ml', factor: 1000 },
  ea: { base: 'ea', factor: 1 },
  // 2차: 컵/스푼 — 기본 환산값(설정으로 조정 가능)
  cup: { base: 'ml', factor: 200 },
  tbsp: { base: 'ml', factor: 15 },
  tsp: { base: 'ml', factor: 5 },
};

/** 입력 수치를 기준단위 수치로 환산. 예: (18, 'L') → { base:'ml', value:18000 } */
export function toBase(value: number, unit: InputUnit): { base: BaseUnit; value: number } {
  const m = TO_BASE[unit];
  return { base: m.base, value: value * m.factor };
}
