/**
 * core LOCALES ↔ SQL `locale_defaults()` (0168) 대조 — 절대원칙 3 의 언어판.
 * 언어가 통화·금액 자릿수를 정하는 표는 두 곳에 있다(앱 표시는 core, 저장은 서버).
 * 마이그레이션 파일을 **읽어서** 튜플을 뽑아 core 와 맞춘다 — 한쪽만 고치면 여기서 빨개진다.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LOCALES } from '../src/locale';

const SQL = resolve(__dirname, '../../db/supabase/migrations/20260826000168_settings_values_and_locale_defaults.sql');

function sqlLocaleDefaults(): Record<string, { currency: string; moneyDigits: number }> {
  const text = readFileSync(SQL, 'utf8');
  const body = text.slice(text.indexOf('create or replace function public.locale_defaults'), text.indexOf('as v(locale, currency, money_digits)'));
  const out: Record<string, { currency: string; moneyDigits: number }> = {};
  for (const m of body.matchAll(/\('([a-zA-Z-]+)',\s*'([A-Z]{3})',\s*(\d)\)/g)) {
    out[m[1]!] = { currency: m[2]!, moneyDigits: Number(m[3]) };
  }
  return out;
}

describe('locale_defaults(SQL) ↔ LOCALES(core)', () => {
  const sql = sqlLocaleDefaults();

  it('같은 언어 키 집합이다', () => {
    expect(Object.keys(sql).sort()).toEqual(LOCALES.map((l) => l.key).sort());
  });

  it('언어마다 통화·금액 자릿수가 같다', () => {
    for (const l of LOCALES) {
      expect(sql[l.key], l.key).toEqual({ currency: l.currency, moneyDigits: l.moneyDigits });
    }
  });

  it('settings 의 CHECK 목록도 같은 집합이다', () => {
    const text = readFileSync(SQL, 'utf8');
    const localeCk = text.match(/settings_locale_ck\s*\n?\s*check \(locale in \(([^)]*)\)\)/)?.[1] ?? '';
    const currencyCk = text.match(/settings_currency_ck\s*\n?\s*check \(currency in \(([^)]*)\)\)/)?.[1] ?? '';
    const keys = [...localeCk.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    const currencies = [...currencyCk.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(keys).toEqual(LOCALES.map((l) => l.key).sort());
    expect(currencies).toEqual([...new Set(LOCALES.map((l) => l.currency))].sort());
  });
});
