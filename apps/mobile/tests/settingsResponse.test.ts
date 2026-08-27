/**
 * get_settings 응답 경계(검토 지적) — null 을 빈 객체로 바꿔 ko/KRW 로 채우면 설정 행 누락·RLS 회귀가
 * 정상 한국어 설정처럼 보인다. 키·타입이 하나라도 어긋나면 오류다.
 */
import { describe, expect, it } from 'vitest';
import { parseStoreSettings } from '@/features/my/hooks';

const FULL = {
  locale: 'en-US', currency: 'USD', unit_system: 'metric', cup_volume: 200, default_target_profit_rate: 40,
  unit_price_digits: 4, quantity_digits: 0, money_digits: 2,
  alert_morning_summary: true, alert_inbound_delay: false, alert_price_spike: true, alert_target_miss: false,
  open_time: '11:00', close_time: '22:00', break_start: null, break_end: null, overnight: false, open_minutes: 660,
  tax_mode: 'included', tax_items: [{ name: '부가세', rate: 9.0909 }],
};

describe('parseStoreSettings', () => {
  it('완전한 응답은 그대로 옮긴다 — 기본값으로 메우지 않는다', () => {
    const s = parseStoreSettings(FULL);
    expect(s.locale).toBe('en-US');
    expect(s.currency).toBe('USD');
    expect(s.moneyDigits).toBe(2);
    expect(s.taxItems).toEqual([{ name: '부가세', rate: 9.0909 }]);
  });

  it('null·배열·비객체는 오류다 — ko/KRW 로 위장하지 않는다', () => {
    for (const bad of [null, undefined, [], 'x', 3]) expect(() => parseStoreSettings(bad), String(bad)).toThrow(/비어 있어요/);
  });

  it('필수 키가 빠지면 그 키 이름으로 오류다', () => {
    const { locale: _l, ...noLocale } = FULL;
    expect(() => parseStoreSettings(noLocale)).toThrow(/locale/);
    const { tax_items: _t, ...noTax } = FULL;
    expect(() => parseStoreSettings(noTax)).toThrow(/tax_items/);
  });

  it('타입이 다르면 오류다', () => {
    expect(() => parseStoreSettings({ ...FULL, money_digits: '2' })).toThrow(/money_digits/);
    expect(() => parseStoreSettings({ ...FULL, alert_target_miss: 'yes' })).toThrow(/alert_target_miss/);
    expect(() => parseStoreSettings({ ...FULL, break_start: 5 })).toThrow(/break_start/);
  });
});
