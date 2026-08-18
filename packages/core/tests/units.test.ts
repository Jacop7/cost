/**
 * 단위 환산·표기 단일 출처 — 절대원칙 1(저장은 최소단위 g/ml/개) · AGENTS.md 표기 규칙.
 *
 * 문제:
 *   1) 입력 환산 `값 × (kg|L 이면 1000)` 이 3개 화면에 **동일한 식으로 복제**돼 있었다
 *      (IngredientAdd / IngredientEdit / PurchaseOption). 한 곳만 고치면 이중 환산·환산 누락이 난다.
 *   2) 표기 규칙(1,000 이상이면 kg/L)이 최소 4곳에 복제됐고 **반올림이 서로 달랐다**:
 *        base 1234 → `fmtStock` "1.2kg" / `perLabel` "1.234kg"
 *        base 1250 → `fmtStock` "1.3kg" / `perLabel` "1.25kg"
 *      같은 값이 화면마다 다르게 보이는 상태였다.
 *
 * 해결:
 *   환산과 표기를 core 한 곳에 두고, **정밀도는 호출부가 의도를 밝혀 선택**한다.
 *   - 재고 잔량은 대략값이면 되므로 소수 1자리
 *   - 구매 옵션 용량은 상품 스펙이라 반올림하면 다른 상품이 되므로 소수 3자리(1g 단위까지 정확)
 */
import { describe, it, expect } from 'vitest';
import { displayToBase, formatQuantity, toBase } from '../src';

describe('displayToBase — 화면 입력 → 저장 최소단위', () => {
  it('kg 은 1,000배 해서 g 으로 저장한다', () => {
    expect(displayToBase(1.5, 'kg')).toBe(1500);
  });

  it('L 은 1,000배 해서 ml 로 저장한다', () => {
    expect(displayToBase(1.8, 'L')).toBe(1800);
  });

  it('g·ml·개는 그대로 저장한다', () => {
    expect(displayToBase(500, 'g')).toBe(500);
    expect(displayToBase(250, 'ml')).toBe(250);
    expect(displayToBase(30, '개')).toBe(30);
  });

  it('검산 — 대파 1,000g 구매 단위', () => {
    expect(displayToBase(1, 'kg')).toBe(1000);
  });

  it('음수·비유한 입력은 0 으로 막는다 (불변식 6)', () => {
    expect(displayToBase(-1, 'kg')).toBe(0);
    expect(displayToBase(Number.NaN, 'kg')).toBe(0);
    expect(displayToBase(Number.POSITIVE_INFINITY, 'g')).toBe(0);
  });

  it('core toBase 와 같은 배수를 쓴다 — 두 경로가 갈라지면 안 된다', () => {
    expect(displayToBase(2, 'kg')).toBe(toBase(2, 'kg').value);
    expect(displayToBase(2, 'L')).toBe(toBase(2, 'L').value);
  });
});

describe('formatQuantity — 저장 최소단위 → 화면 표기', () => {
  it('1,000 미만은 원단위 그대로', () => {
    expect(formatQuantity(999, 'g')).toBe('999g');
    expect(formatQuantity(250, 'ml')).toBe('250ml');
  });

  it('1,000 이상은 큰 단위로 올린다', () => {
    expect(formatQuantity(1000, 'g')).toBe('1kg');
    expect(formatQuantity(1000, 'ml')).toBe('1L');
  });

  it('개수는 환산하지 않는다 — 1,000개는 그냥 1,000개다', () => {
    expect(formatQuantity(1000, '개')).toBe('1000개');
    expect(formatQuantity(3, '개')).toBe('3개');
  });

  it('기본 정밀도는 소수 1자리 — 재고 잔량 표기', () => {
    expect(formatQuantity(1234, 'g')).toBe('1.2kg');
    expect(formatQuantity(1250, 'g')).toBe('1.3kg');
    expect(formatQuantity(12345, 'g')).toBe('12.3kg');
  });

  it('정밀도를 올리면 상품 스펙을 정확히 표기한다 — 구매 옵션 용량', () => {
    expect(formatQuantity(1234, 'g', { maxDigits: 3 })).toBe('1.234kg');
    expect(formatQuantity(1250, 'g', { maxDigits: 3 })).toBe('1.25kg');
    expect(formatQuantity(12345, 'g', { maxDigits: 3 })).toBe('12.345kg');
  });

  it('불필요한 뒤 0 은 떼어낸다 — "1.0kg" 이 아니라 "1kg"', () => {
    expect(formatQuantity(1000, 'g', { maxDigits: 3 })).toBe('1kg');
    expect(formatQuantity(1500, 'g', { maxDigits: 3 })).toBe('1.5kg');
    expect(formatQuantity(2000, 'ml')).toBe('2L');
  });

  it('경계값 999 / 1000 에서 단위가 정확히 전환된다', () => {
    expect(formatQuantity(999, 'g')).toBe('999g');
    expect(formatQuantity(1000, 'g')).toBe('1kg');
  });

  it('0 은 0 으로 표기한다 (빈 값과 구분)', () => {
    expect(formatQuantity(0, 'g')).toBe('0g');
    expect(formatQuantity(0, '개')).toBe('0개');
  });

  it('음수·비유한 값은 0 으로 막는다 — 화면에 Infinity 를 띄우지 않는다', () => {
    expect(formatQuantity(-500, 'g')).toBe('0g');
    expect(formatQuantity(Number.NaN, 'g')).toBe('0g');
    expect(formatQuantity(Number.POSITIVE_INFINITY, 'g')).toBe('0g');
  });

  it('소수 단위 재고도 원단위에서 반올림한다', () => {
    expect(formatQuantity(999.6, 'g')).toBe('1000g');
    expect(formatQuantity(12.4, 'g')).toBe('12g');
  });

  it('환산 왕복 — kg 로 입력한 값이 같은 kg 로 다시 보인다', () => {
    const stored = displayToBase(1.234, 'kg'); // 1234
    expect(formatQuantity(stored, 'g', { maxDigits: 3 })).toBe('1.234kg');
  });
});
