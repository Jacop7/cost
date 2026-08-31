/** INTL-1A/1B TypeScript 기준선과 살아 있는 DB 계약을 직접 대조한다. */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  APP_CAPABILITIES_BASELINE,
  BUSINESS_LOCALE_CODES,
  INTERNATIONAL_SALES_CHANNEL_CODES,
  INTERNATIONAL_TAX_CALCULATION_VERSIONS,
  LAUNCH_COUNTRY_CODES,
  LAUNCH_CURRENCY_CODES,
  LAUNCH_MARKETS,
  TAX_CALCULATION_BASES,
  TAX_COMPONENT_KINDS,
  TAX_JURISDICTION_LEVELS,
  TAX_PRICE_BASES,
  TAX_REMITTANCE_OWNERS,
  TAX_TREATMENTS,
} from '@margincook/types';

const DB = process.env.MARGINCOOK_PARITY_DB;
const CT = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_margincook';

function queryJson(sql: string): unknown {
  const result = spawnSync(
    'docker',
    ['exec', '-i', CT, 'psql', '-U', 'postgres', '-d', DB!, '-v', 'ON_ERROR_STOP=1', '-At', '-c',
      sql],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(`psql 실패: ${result.stderr}`);
  return JSON.parse(result.stdout.trim());
}

function queryCapabilities(): unknown {
  return queryJson('select public.app_capabilities()::text');
}

function expectedMinorUnits(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const market of Object.values(LAUNCH_MARKETS)) {
    const seen = result[market.currencyCode];
    if (seen !== undefined && seen !== market.minorUnit) {
      throw new Error(
        `${market.currencyCode} minor unit 충돌: 기존 ${seen}, ${market.countryCode} ${market.minorUnit}`,
      );
    }
    result[market.currencyCode] = market.minorUnit;
  }
  return result;
}

describe('국제 출시 통화 minor unit 단일 계약', () => {
  it('같은 통화를 쓰는 시장끼리 minor unit이 같고 모든 출시 통화가 정의돼 있다', () => {
    expect(Object.keys(expectedMinorUnits()).sort()).toEqual([...LAUNCH_CURRENCY_CODES].sort());
  });
});

const dbDescribe = DB ? describe : describe.skip;

dbDescribe(`app_capabilities(DB=${DB ?? '없음'}) ↔ TypeScript 기준선`, () => {
  it('서버와 공용 타입이 같은 판본·최소 버전·비활성 상태다', () => {
    const raw = queryCapabilities() as Record<string, unknown>;
    const tax = raw.international_tax as Record<string, unknown>;
    expect({
      contractVersion: raw.contract_version,
      minimumSupportedAppVersion: raw.minimum_supported_app_version,
      internationalTax: {
        contractVersion: tax.contract_version,
        readEnabled: tax.read_enabled,
        writeEnabled: tax.write_enabled,
        minimumWriteAppVersion: tax.minimum_write_app_version,
      },
    }).toEqual(APP_CAPABILITIES_BASELINE);
  });

  it('INTL-1B DB enum과 공용 타입의 값·순서가 같다', () => {
    const names = [
      'international_country_code', 'international_currency_code', 'business_locale_code',
      'tax_price_basis', 'tax_treatment', 'tax_component_kind', 'tax_calculation_basis',
      'tax_jurisdiction_level', 'tax_remittance_owner', 'international_sales_channel_code',
      'international_tax_calculation_version',
    ];
    const raw = queryJson(`
      select jsonb_object_agg(type_name, labels order by type_name)
        from (
          select t.typname type_name, jsonb_agg(e.enumlabel order by e.enumsortorder) labels
            from pg_type t join pg_enum e on e.enumtypid = t.oid
           where t.typnamespace = 'public'::regnamespace
             and t.typname = any(array[${names.map((name) => `'${name}'`).join(',')}])
           group by t.typname
        ) x
    `) as Record<string, string[]>;
    expect(raw).toEqual({
      business_locale_code: [...BUSINESS_LOCALE_CODES],
      international_country_code: [...LAUNCH_COUNTRY_CODES],
      international_currency_code: [...LAUNCH_CURRENCY_CODES],
      international_sales_channel_code: [...INTERNATIONAL_SALES_CHANNEL_CODES],
      international_tax_calculation_version: [...INTERNATIONAL_TAX_CALCULATION_VERSIONS],
      tax_calculation_basis: [...TAX_CALCULATION_BASES],
      tax_component_kind: [...TAX_COMPONENT_KINDS],
      tax_jurisdiction_level: [...TAX_JURISDICTION_LEVELS],
      tax_price_basis: [...TAX_PRICE_BASES],
      tax_remittance_owner: [...TAX_REMITTANCE_OWNERS],
      tax_treatment: [...TAX_TREATMENTS],
    });

    const minorUnits = queryJson(`
      select jsonb_object_agg(c::text, public.international_currency_minor_unit(c))
        from unnest(enum_range(null::public.international_currency_code)) c
    `) as Record<string, number>;
    const expected = expectedMinorUnits();
    expect(minorUnits).toEqual(expected);
  });
});

if (!DB) {
  it('MARGINCOOK_PARITY_DB가 없어 살아 있는 DB 대조는 건너뛴다 (verify ④가 실행한다)', () => {
    expect(true).toBe(true);
  });
}
