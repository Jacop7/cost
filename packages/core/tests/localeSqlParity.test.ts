/**
 * core LOCALES ↔ SQL `locale_defaults()` 대조 — 절대원칙 3 의 언어판.
 * 언어가 통화·금액 자릿수를 정하는 표는 두 곳에 있다(앱 표시는 core, 저장은 서버 0168).
 * 마이그레이션 파일을 **읽어서** 튜플을 뽑아 core 와 맞춘다 — 한쪽만 고치면 여기서 빨개진다.
 *
 * ⚠ 특정 파일이 아니라 **마이그레이션 전체에서 마지막 정의**를 읽는다(검토 지적) — 0169 이후
 *   함수나 CHECK 를 다시 정의해도 그 최신본을 대조한다.
 * ⚠ SQL 은 **정규화해서** 본다(검토 지적) — 줄 주석(--)과 블록 주석을 걷어내고 공백을 접고 소문자로.
 *   대문자 SQL · DROP+CREATE · 주석에만 적힌 가짜 구현이 검사를 속이지 못하게.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LOCALES } from '../src/locale';

const MIG_DIR = resolve(__dirname, '../../db/supabase/migrations');
const files = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();

/** 주석 제거 · 공백 접기 · 소문자 — 검사는 이 형태로만 한다. */
export function normalizeSql(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
const norm = (f: string) => normalizeSql(readFileSync(resolve(MIG_DIR, f), 'utf8'));

const DEFINES_LOCALE_DEFAULTS = /create (or replace )?function public\.locale_defaults/;

/** 마이그레이션 순서상 **마지막으로** 패턴이 나오는 파일의 그 부분(뒤쪽, 정규화본)을 돌려준다. */
function lastDefinition(pattern: RegExp): { file: string; text: string } {
  for (const f of [...files].reverse()) {
    const text = norm(f);
    let last = -1;
    for (const m of text.matchAll(new RegExp(pattern.source, 'g'))) last = m.index ?? -1;
    if (last >= 0) return { file: f, text: text.slice(last) };
  }
  throw new Error(`마이그레이션에서 못 찾음: ${pattern}`);
}

function sqlLocaleDefaults(): { file: string; rows: Record<string, { currency: string; moneyDigits: number }> } {
  const { file, text } = lastDefinition(DEFINES_LOCALE_DEFAULTS);
  const body = text.slice(0, text.indexOf('as v(locale, currency, money_digits)'));
  const rows: Record<string, { currency: string; moneyDigits: number }> = {};
  for (const m of body.matchAll(/\('([a-z-]+)', ?'([a-z]{3})', ?(\d)\)/g)) {
    rows[m[1]!] = { currency: m[2]!.toUpperCase(), moneyDigits: Number(m[3]) };
  }
  return { file, rows };
}

function checkList(constraint: string, column: string): string[] {
  const { text } = lastDefinition(new RegExp(`add constraint ${constraint}`));
  const m = text.match(new RegExp(`check \\(${column} in \\(([^)]*)\\)\\)`));
  return [...(m?.[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1]!).sort();
}

const coreKeys = () => LOCALES.map((l) => l.key.toLowerCase()).sort();

describe('locale_defaults(SQL) ↔ LOCALES(core)', () => {
  const sql = sqlLocaleDefaults();

  it('마지막 정의를 찾았다', () => {
    expect(Object.keys(sql.rows).length).toBeGreaterThan(0);
  });

  it('같은 언어 키 집합이다', () => {
    expect(Object.keys(sql.rows).sort()).toEqual(coreKeys());
  });

  it('언어마다 통화·금액 자릿수가 같다', () => {
    for (const l of LOCALES) {
      expect(sql.rows[l.key.toLowerCase()], `${l.key} (${sql.file})`).toEqual({ currency: l.currency, moneyDigits: l.moneyDigits });
    }
  });

  it('settings 의 CHECK 목록(마지막 정의)도 같은 집합이다', () => {
    expect(checkList('settings_locale_ck', 'locale')).toEqual(coreKeys());
    expect(checkList('settings_currency_ck', 'currency')).toEqual([...new Set(LOCALES.map((l) => l.currency.toLowerCase()))].sort());
  });

  it('조합 CHECK(0169) 가 마지막 정의에 살아 있다', () => {
    const { text } = lastDefinition(/add constraint settings_locale_combo_ck/);
    expect(text).toMatch(/check \(public\.locale_combo_ok\(locale, currency, money_digits\)\)/);
  });

  /**
   * 목록을 바꾸는 마이그레이션의 규율(검토 지적) — locale_defaults 를 다시 정의하면 기존 settings 행은
   * 저절로 재검증되지 않는다. 같은 파일 안에 ① 기존 행 이관(update … settings) ② 조합 CHECK 재생성
   * (drop + add, 검증됨) ③ 전 행 대조(locale_combo_ok(s.locale …) 로 어긋난 행 수를 세어 멈춤)가
   * **한 단위로** 있어야 한다. 0169 이후 파일만 본다(0168 은 CHECK 가 생기기 전이다).
   * 정규화본으로 보므로 대문자·DROP+CREATE 도 잡히고, 주석에만 적은 표지는 걷힌다.
   */
  it('0169 이후 locale_defaults 를 다시 정의하는 마이그레이션은 이관·CHECK 재생성·전 행 대조를 함께 담는다', () => {
    const later = files.filter((f) => f.slice(0, 14) > '20260826000169')
      .map((f) => ({ f, text: norm(f) }))
      .filter(({ text }) => DEFINES_LOCALE_DEFAULTS.test(text));
    for (const { f, text } of later) {
      expect(text, `${f}: 기존 행 이관(update public.settings)`).toMatch(/update public\.settings/);
      expect(text, `${f}: 조합 CHECK 재생성(drop)`).toMatch(/drop constraint if exists settings_locale_combo_ck/);
      expect(text, `${f}: 조합 CHECK 재생성(add)`).toMatch(/add constraint settings_locale_combo_ck check \(public\.locale_combo_ok\(locale, currency, money_digits\)\)/);
      expect(text, `${f}: 전 행 대조`).toMatch(/not public\.locale_combo_ok\(s\.locale, s\.currency, s\.money_digits\)/);
    }
  });

  it('정규화가 주석·대소문자·공백을 걷어낸다(자기 검증)', () => {
    expect(normalizeSql('CREATE /* x */ FUNCTION  public.LOCALE_DEFAULTS -- tail\n(p text)')).toBe('create function public.locale_defaults (p text)');
  });
});
