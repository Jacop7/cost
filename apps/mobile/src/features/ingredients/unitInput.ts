import { displayToBase, isDisplayUnit } from '@margincook/core';

export const unitFamily = (unit: string) => unit === 'kg' || unit === 'g' ? 'g' : unit === 'L' || unit === 'ml' ? 'ml' : unit === '개' ? 'ea' : null;

/** 같은 차원에서 표기만 바꿀 때 입력한 실물 수량을 보존한다. */
export function convertUnitInput(value: string, from: string, to: string): string {
  if (value.trim() === '' || from === to) return value;
  if (!unitFamily(from) || unitFamily(from) !== unitFamily(to)) return '';
  if (!isDisplayUnit(from) || !isDisplayUnit(to)) return value;
  const converted = Number(value) * displayToBase(1, from) / displayToBase(1, to);
  return Number.isFinite(converted) ? String(Number(converted.toFixed(9))) : '';
}
