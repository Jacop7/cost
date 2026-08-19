/**
 * 로케일 서식 검산 — 언어·통화 설정에서 확정한 10개 로케일의 표기를 고정한다.
 * 이 수치가 깨지면 표기 규칙이 설계와 어긋난 것.
 *
 * 두 축을 나눠 잠근다.
 *   1) 로케일 표 자체 — 금액 / 단가 표기 (설계 표의 3·4열)
 *   2) 검산 기준값이 서식을 통과해도 유지되는지 — 4.00원/g · 4,046.69원 · 33.72% · 31.3%
 */
import { describe, it, expect } from 'vitest';
import {
  LOCALES,
  type LocaleKey,
  getLocale,
  unitPriceDigits,
  formatMoney,
  formatUnitPrice,
  formatPercent,
  formatNumber,
  parseNumber,
  localeSample,
  previewBaseUnitPrice,
  computeProfit,
  fixedCostRate,
} from '../src';

/** 설계 표 그대로 — [로케일, 금액(1250.5), 단가(1250.5)]. 금액 자릿수 0인 통화는 반올림되어 1,251. */
const TABLE: [LocaleKey, string, string][] = [
  ['ko',    '1,251',    '1,250.50'],
  ['en-US', '1,250.50', '1,250.5000'],
  ['ja',    '1,251',    '1,250.50'],
  ['de',    '1.250,50', '1.250,5000'],
  ['ar-SA', '1,250.50', '1,250.5000'],
  ['ar-AE', '1,250.50', '1,250.5000'],
  ['vi',    '1,251',    '1,250.50'],
  ['es-ES', '1.250,50', '1.250,5000'],
  ['es-MX', '1,250.50', '1,250.5000'],
  ['pt-BR', '1.250,50', '1.250,5000'],
];

describe('로케일 서식 표', () => {
  it.each(TABLE)('%s — 금액 %s · 단가 %s', (key, money, unit) => {
    const L = getLocale(key);
    expect(formatNumber(1250.5, { digits: L.moneyDigits, group: L.group, decimal: L.decimal })).toBe(money);
    expect(formatNumber(1250.5, { digits: unitPriceDigits(key), group: L.group, decimal: L.decimal })).toBe(unit);
  });

  it('단가 자릿수 = 금액 자릿수 + 2', () => {
    for (const L of LOCALES) expect(unitPriceDigits(L.key)).toBe(L.moneyDigits + 2);
  });

  it('구분자와 소수점 문자는 항상 서로 다르다', () => {
    for (const L of LOCALES) expect(L.group).not.toBe(L.decimal);
  });

  it('원·엔·동은 소수 없음, 나머지는 2자리', () => {
    for (const L of LOCALES) {
      expect(L.moneyDigits).toBe(['KRW', 'JPY', 'VND'].includes(L.currency) ? 0 : 2);
    }
  });

  it('미등록 키는 기본 로케일(ko)로 폴백', () => {
    expect(getLocale('xx' as LocaleKey).key).toBe('ko');
  });
});

/** 언어·통화 설정 화면(MY-08)에 노출되는 "기본 표시 예시 · 기본 소수 자릿수" 표. */
const DISPLAY: [LocaleKey, string, number][] = [
  ['ko',    '1,250',    0],
  ['en-US', '1,250.50', 2],
  ['ja',    '1,250',    0],
  ['de',    '1.250,50', 2],
  ['ar-SA', '1,250.50', 2],
  ['ar-AE', '1,250.50', 2],
  ['vi',    '1,250',    0],
  ['es-ES', '1.250,50', 2],
  ['es-MX', '1,250.50', 2],
  ['pt-BR', '1.250,50', 2],
];

describe('기본 표시 예시 · 기본 소수 자릿수 (MY-08 노출값)', () => {
  it.each(DISPLAY)('%s — 예시 %s · 기본 %i자리', (key, sample, digits) => {
    expect(localeSample(key)).toBe(sample);
    expect(getLocale(key).moneyDigits).toBe(digits);
  });

  it('0자리 통화 예시는 반올림 없이 1,250 — 1,251 이 되면 견본 구실을 못 한다', () => {
    for (const L of LOCALES) {
      if (L.moneyDigits === 0) expect(localeSample(L.key)).not.toContain('1,251');
    }
  });

  it('소수를 쓰는 통화 예시는 소수점 문자를 드러낸다', () => {
    for (const L of LOCALES) {
      if (L.moneyDigits > 0) expect(localeSample(L.key)).toContain(L.decimal + '50');
    }
  });

  it('예시에는 통화기호를 붙이지 않는다', () => {
    for (const L of LOCALES) expect(localeSample(L.key)).not.toContain(L.symbol);
  });
});

describe('통화기호 부착', () => {
  it('한국은 후치·공백 없음, 미국은 전치', () => {
    expect(formatMoney(12000, 'ko')).toBe('12,000원');
    expect(formatMoney(1250.5, 'en-US')).toBe('$1,250.50');
  });

  it('유럽식은 후치 + 공백', () => {
    expect(formatMoney(1250.5, 'de')).toBe('1.250,50 €');
    expect(formatMoney(1250.5, 'pt-BR')).toBe('R$1.250,50');
  });

  it('음수 부호는 통화기호 바깥', () => {
    expect(formatMoney(-1250.5, 'en-US')).toBe('-$1,250.50');
    expect(formatMoney(-12000, 'ko')).toBe('-12,000원');
  });

  it('유한수가 아니면 0 으로 표기 — 화면을 깨뜨리지 않는다', () => {
    expect(formatMoney(NaN, 'ko')).toBe('0원');
    expect(formatMoney(Infinity, 'ko')).toBe('0원');
  });
});

describe('검산 기준값이 서식을 통과해도 유지된다', () => {
  it('대파 4,000원/1,000g → 4원/g', () => {
    const p = previewBaseUnitPrice(4000, 1000);
    expect(p).not.toBeNull();
    expect(formatUnitPrice(p!, 'g', 'ko')).toBe('4.00원/g');
  });

  it('같은 단가가 미국 로케일에서는 4자리로 보인다', () => {
    // 표기 자릿수만 다를 뿐 값은 동일 — 서식은 계산에 닿지 않는다.
    expect(formatUnitPrice(0.004706, 'g', 'en-US')).toBe('$0.0047/g');
  });

  it('단가 자릿수를 사용자가 0~4 로 덮어쓸 수 있다', () => {
    // 나누어떨어지지 않는 단가라야 자릿수 반올림이 드러난다.
    // 4,000원에 850g 이 들어온 경우 — 0041 이후에도 있을 수 있는 실제 입고다.
    const p = previewBaseUnitPrice(4000, 850); // 4.70588…
    expect(p).not.toBeNull();
    expect(formatUnitPrice(p!, 'g', 'ko', 0)).toBe('5원/g');
    expect(formatUnitPrice(p!, 'g', 'ko', 1)).toBe('4.7원/g');
    expect(formatUnitPrice(p!, 'g', 'ko', 2)).toBe('4.71원/g');
    expect(formatUnitPrice(p!, 'g', 'ko', 4)).toBe('4.7059원/g');
  });

  it('제육볶음 순이익 4,046.69원 · 33.72%', () => {
    const r = computeProfit({
      price: 12000,
      servings: 10,
      taxMode: 'included',
      extraPerServing: 300,
      fixedRate: 0.313,
      lines: [{ inputQty: 10, baseUnitPrice: 2806.4 }],
    });
    expect(formatMoney(r.profit, 'ko')).toBe('4,047원');
    expect(formatPercent(r.profitRate)).toBe('33.7%');
  });

  it('비율은 절사다 — 33.45% 는 33.5% 가 아니라 33.4%', () => {
    // 반올림이면 경계에서 한 눈금 올라가 서버 값과 어긋난다. 경계를 따로 못 박는다.
    expect(formatPercent(0.3345)).toBe('33.4%');
  });

  it('고정지출률 31.3% — 부동소수 오차로 31.2% 가 되지 않는다', () => {
    expect(formatPercent(fixedCostRate(3_756_000, 12_000_000)!)).toBe('31.3%');
    expect(formatPercent(0.313)).toBe('31.3%');
  });

  it('비율도 로케일 소수점 문자를 따른다', () => {
    expect(formatPercent(0.334, 'de')).toBe('33,4%');
  });
});

describe('입력 파싱 (역방향)', () => {
  it('한국·미국식 — 쉼표 구분, 점 소수', () => {
    expect(parseNumber('1,250.50', 'ko')).toBe(1250.5);
    expect(parseNumber('$1,250.50', 'en-US')).toBe(1250.5);
  });

  it('독일·브라질식 — 점 구분, 쉼표 소수', () => {
    expect(parseNumber('1.250,50', 'de')).toBe(1250.5);
    expect(parseNumber('1.250,5000', 'pt-BR')).toBe(1250.5);
    // 순서가 뒤바뀌면 1.25 로 뭉개진다 — 회귀 방지.
    expect(parseNumber('1.250,50', 'de')).not.toBe(1.25);
  });

  it('서식 → 파싱 왕복이 값을 보존한다', () => {
    for (const L of LOCALES) {
      expect(parseNumber(formatMoney(1250.5, L.key), L.key)).toBe(L.moneyDigits === 0 ? 1251 : 1250.5);
    }
  });

  it('빈 값·문자만 있으면 0', () => {
    expect(parseNumber('', 'ko')).toBe(0);
    expect(parseNumber('원', 'ko')).toBe(0);
  });
});
