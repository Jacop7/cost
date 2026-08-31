import { describe, expect, it } from 'vitest';
import {
  APP_CAPABILITIES_BASELINE,
  BUSINESS_LOCALE_CODES,
  LAUNCH_COUNTRY_CODES,
  LAUNCH_CURRENCY_CODES,
  LAUNCH_MARKETS,
  LAUNCH_TAX_REGIONS,
} from '@margincook/types';

describe('국제 출시 계약 기준선', () => {
  it('5개국·5개 통화·5개 업무 로케일을 일대일로 소유한다', () => {
    expect(Object.keys(LAUNCH_MARKETS)).toEqual(LAUNCH_COUNTRY_CODES);
    expect(Object.values(LAUNCH_MARKETS).map((market) => market.currencyCode)).toEqual(LAUNCH_CURRENCY_CODES);
    expect(Object.values(LAUNCH_MARKETS).map((market) => market.businessLocaleCode)).toEqual(BUSINESS_LOCALE_CODES);
  });

  it('앱 언어를 시장 metadata에 넣지 않는다', () => {
    for (const market of Object.values(LAUNCH_MARKETS)) expect(market).not.toHaveProperty('defaultAppLanguage');
  });

  it('KRW만 0자리이고 나머지 출시 통화는 2자리다', () => {
    expect(LAUNCH_MARKETS.KR.minorUnit).toBe(0);
    for (const code of ['US', 'GB', 'AU', 'CA'] as const) expect(LAUNCH_MARKETS[code].minorUnit).toBe(2);
  });

  it('INTL-1A에서는 국제 세금 읽기·쓰기를 활성화하지 않는다', () => {
    expect(APP_CAPABILITIES_BASELINE).toEqual({
      contractVersion: 1,
      minimumSupportedAppVersion: '0.1.0',
      internationalTax: {
        contractVersion: 'international_tax_v1',
        readEnabled: false,
        writeEnabled: false,
        minimumWriteAppVersion: null,
      },
    });
  });

  it('INTL-1C 관할 카탈로그는 미국 51개·캐나다 13개 ISO 3166-2 코드를 중복 없이 가진다', () => {
    expect(LAUNCH_TAX_REGIONS.filter((region) => region.countryCode === 'US')).toHaveLength(51);
    expect(LAUNCH_TAX_REGIONS.filter((region) => region.countryCode === 'CA')).toHaveLength(13);
    expect(new Set(LAUNCH_TAX_REGIONS.map((region) => region.regionCode)).size)
      .toBe(LAUNCH_TAX_REGIONS.length);
    for (const region of LAUNCH_TAX_REGIONS) {
      expect(region.regionCode.startsWith(`${region.countryCode}-`)).toBe(true);
    }
  });
});
