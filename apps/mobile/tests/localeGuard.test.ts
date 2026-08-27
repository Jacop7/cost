/**
 * 저장된 로케일 문자열 판정(검토 J) — `unitPriceDigits()` 는 안에서 기본값으로 폴백해
 * 'xx-XX' 도 유효한 것처럼 통과했다. 판정은 LOCALES 의 키 집합으로만 한다.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, LOCALES } from '@sikjae/core';
import { asLocale, isLocaleKey } from '@/features/my/store';

describe('isLocaleKey', () => {
  it('LOCALES 의 키는 전부 참', () => {
    for (const l of LOCALES) expect(isLocaleKey(l.key), l.key).toBe(true);
  });
  it('미등록 문자열·옛 키·비문자열은 거짓', () => {
    for (const v of ['xx-XX', 'ko-KR', 'en', '', undefined, null, 3]) expect(isLocaleKey(v), String(v)).toBe(false);
  });
});

describe('asLocale — 저장값을 화면 로케일로', () => {
  it('아는 키는 그대로', () => {
    for (const l of LOCALES) expect(asLocale(l.key)).toBe(l.key);
  });
  it('미등록·옛 키는 기본값으로 떨어진다 — 폴백 함수로 재면 xx-XX 가 통과했다', () => {
    for (const v of ['xx-XX', 'ko-KR', 'en', '', undefined]) expect(asLocale(v), String(v)).toBe(DEFAULT_LOCALE);
  });
});
