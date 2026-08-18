/**
 * 단위 환산 (① 4.8). 입력 구매단위 → 기준단위(g/ml/개) 정규화.
 * 1차: 미터법만. 컵/스푼·미국/영국식은 2차(toMl 의 cup/tbsp 분기 자리만 둠).
 */
import type { BaseUnit } from '@sikjae/types';
import { isNonNegativeFinite } from './guards';

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

// ── 화면 표기 단위 (AGENTS.md 표기 규칙) ────────────────────────
// 화면에 노출하는 단위는 kg·g·ml·L + 개수만. 망·통·박스·판 등 구매단위 라벨은 상품명/거래처로 분리한다.

/** 화면에서 사용자가 고르는 단위. 저장은 항상 g/ml/개로 환산된다. */
export type DisplayUnit = 'g' | 'kg' | 'ml' | 'L' | '개';

/** 표기 단위 → 저장 최소단위 배수. `TO_BASE` 와 같은 값을 참조해 두 경로가 갈라지지 않게 한다. */
const DISPLAY_TO_BASE: Record<DisplayUnit, { base: BaseUnit; factor: number }> = {
  g: TO_BASE.g,
  kg: TO_BASE.kg,
  ml: TO_BASE.ml,
  L: TO_BASE.L,
  '개': TO_BASE.ea,
};

/**
 * 문자열이 화면 표기 단위인지 판정한다.
 * 화면의 단위 상태에는 '박스' 같은 **구매단위 라벨**이 섞여 들어올 수 있는데, 그건 환산 대상이 아니라
 * 상품명·구매처로 분리해야 하는 값이다(AGENTS.md 표기 규칙). 여기서 타입 수준으로 걸러낸다.
 */
export const isDisplayUnit = (u: string): u is DisplayUnit =>
  Object.prototype.hasOwnProperty.call(DISPLAY_TO_BASE, u);

/**
 * 화면 입력값 → 저장 최소단위 수치. **저장 직전 한 번만** 호출한다(절대원칙 1).
 * 화면마다 `값 × (kg면 1000)` 을 손으로 쓰면 이중 환산·환산 누락이 난다.
 * 음수·비유한 입력은 0 으로 막는다(불변식 6).
 */
export function displayToBase(value: number, unit: DisplayUnit): number {
  if (!isNonNegativeFinite(value)) return 0;
  return value * DISPLAY_TO_BASE[unit].factor;
}

/** 저장 최소단위 → 큰 표기 단위. 개수는 올리지 않는다(1,000개는 그냥 1,000개다). */
const BIG_OF: Record<BaseUnit, DisplayUnit | null> = { g: 'kg', ml: 'L', ea: null };

/**
 * 저장 최소단위 수치 → 화면 표기 문자열.
 *
 * 정밀도는 호출부가 의도를 밝혀 고른다. 하나로 강제하면 한쪽이 반드시 틀린다.
 *   - `maxDigits: 1`(기본) — 재고 잔량처럼 대략값이면 되는 곳.  1234g → "1.2kg"
 *   - `maxDigits: 3`       — 구매 옵션 용량처럼 **상품 스펙**이라 반올림하면 다른 상품이 되는 곳.
 *                            1234g → "1.234kg"
 * 뒤따르는 0 은 항상 떼어낸다("1.0kg" 이 아니라 "1kg").
 */
export function formatQuantity(
  value: number,
  base: BaseUnit | DisplayUnit,
  opts: { maxDigits?: number } = {},
): string {
  const { maxDigits = 1 } = opts;
  const v = isNonNegativeFinite(value) ? value : 0;

  // '개'(화면 표기)와 'ea'(저장 단위)를 함께 받는다.
  if (base === 'ea' || base === '개') return `${Math.round(v)}개`;

  const baseUnit: BaseUnit = base === 'kg' ? 'g' : base === 'L' ? 'ml' : (base as BaseUnit);
  const big = BIG_OF[baseUnit];

  if (big !== null && v >= 1000) {
    // toFixed 로 자리수를 맞춘 뒤 뒤 0 을 떼어낸다. 1.000 → "1", 1.250 → "1.25"
    const text = (v / 1000).toFixed(maxDigits).replace(/\.?0+$/, '');
    return `${text}${big}`;
  }
  return `${Math.round(v)}${baseUnit === 'ml' ? 'ml' : 'g'}`;
}
