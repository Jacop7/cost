/**
 * get_settings 응답 경계(검토 지적) — null 을 빈 객체로 바꿔 ko/KRW 로 채우면 설정 행 누락·RLS 회귀가
 * 정상 한국어 설정처럼 보인다. 키·타입이 하나라도 어긋나면 오류이고, 값의 뜻도 잰다.
 * ⚠ 키 목록은 DB 시험 32 의 리터럴과 같아야 한다 — 그 파일을 읽어 대조한다(RPC 실제 응답은 DB 시험이 잰다).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SETTINGS_SHAPE, parseStoreSettings } from '@/features/my/hooks';

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
    expect(s.cupVolume).toBe(200);
    expect(s.taxItems).toEqual([{ name: '부가세', rate: 9.0909 }]);
  });

  it('null·배열·비객체는 오류다 — ko/KRW 로 위장하지 않는다', () => {
    for (const bad of [null, undefined, [], 'x', 3]) expect(() => parseStoreSettings(bad), String(bad)).toThrow(/비어 있어요/);
  });

  it('필수 키가 빠지면 그 키 이름으로 오류다', () => {
    const { locale: _l, ...noLocale } = FULL;
    expect(() => parseStoreSettings(noLocale)).toThrow(/locale/);
    const { cup_volume: _c, ...noCup } = FULL;
    expect(() => parseStoreSettings(noCup)).toThrow(/cup_volume/);
    const { tax_items: _t, ...noTax } = FULL;
    expect(() => parseStoreSettings(noTax)).toThrow(/tax_items/);
  });

  it('타입이 다르면 오류다', () => {
    expect(() => parseStoreSettings({ ...FULL, money_digits: '2' })).toThrow(/money_digits/);
    expect(() => parseStoreSettings({ ...FULL, alert_target_miss: 'yes' })).toThrow(/alert_target_miss/);
    expect(() => parseStoreSettings({ ...FULL, break_start: 5 })).toThrow(/break_start/);
  });

  it('값의 뜻도 잰다 — 미등록 언어·통화 불일치·단위·컵·자릿수·시각·세금', () => {
    expect(() => parseStoreSettings({ ...FULL, locale: 'xx-XX' })).toThrow(/locale.*미등록/);
    expect(() => parseStoreSettings({ ...FULL, currency: 'KRW' })).toThrow(/currency/);          // en-US 는 USD
    expect(() => parseStoreSettings({ ...FULL, money_digits: 0 })).toThrow(/money_digits/);      // USD 는 2
    expect(() => parseStoreSettings({ ...FULL, unit_system: 'imperial' })).toThrow(/unit_system/);
    expect(() => parseStoreSettings({ ...FULL, cup_volume: -5 })).toThrow(/cup_volume/);
    expect(() => parseStoreSettings({ ...FULL, unit_price_digits: 9 })).toThrow(/unit_price_digits/);
    expect(() => parseStoreSettings({ ...FULL, quantity_digits: 1.5 })).toThrow(/quantity_digits/);
    expect(() => parseStoreSettings({ ...FULL, default_target_profit_rate: 150 })).toThrow(/default_target_profit_rate/);
    expect(() => parseStoreSettings({ ...FULL, open_time: '25:00' })).toThrow(/open_time/);
    expect(() => parseStoreSettings({ ...FULL, break_end: '9:5' })).toThrow(/break_end/);
    expect(() => parseStoreSettings({ ...FULL, open_minutes: 99999 })).toThrow(/open_minutes/);
    expect(() => parseStoreSettings({ ...FULL, tax_mode: 'vat' })).toThrow(/tax_mode/);
    expect(() => parseStoreSettings({ ...FULL, tax_items: [{ name: 3, rate: 'x' }] })).toThrow(/tax_items/);
    expect(() => parseStoreSettings({ ...FULL, tax_items: [null] })).toThrow(/tax_items/);
    // 정상 조합은 통과한다(ko/KRW/0).
    expect(parseStoreSettings({ ...FULL, locale: 'ko', currency: 'KRW', money_digits: 0 }).locale).toBe('ko');
  });

  it('키 목록이 DB 시험 32(실제 RPC 응답을 재는 쪽)의 리터럴과 같다', () => {
    const sql = readFileSync(resolve(__dirname, '../../../packages/db/tests/32_settings_contract.sql'), 'utf8');
    const m = sql.match(/v_want text\[\] := array\[([\s\S]*?)\];/);
    expect(m, '32 의 v_want 리터럴').toBeTruthy();
    const dbKeys = [...m![1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!).sort();
    expect(dbKeys).toEqual(Object.keys(SETTINGS_SHAPE).sort());
  });
});
