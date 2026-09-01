/** INTL-1A/1B TypeScript 기준선과 살아 있는 DB 계약을 직접 대조한다. */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  APP_CAPABILITIES_BASELINE,
  BUSINESS_LOCALE_CODES,
  INTERNATIONAL_SALES_CHANNEL_CODES,
  INTERNATIONAL_TAX_CALCULATION_VERSIONS,
  LAUNCH_TAX_REGIONS,
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
import { calculateInternationalTax, type InternationalTaxComponentInput } from '../src';

const DB = process.env.MARGINCOOK_PARITY_DB;
const CT = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_margincook';

function queryJson(sql: string): unknown {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      CT,
      'psql',
      '-U',
      'postgres',
      '-d',
      DB!,
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
      '-c',
      sql,
    ],
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
  it('서버와 공용 타입이 같은 판본·최소 버전·활성 상태다', () => {
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
      'international_country_code',
      'international_currency_code',
      'business_locale_code',
      'tax_price_basis',
      'tax_treatment',
      'tax_component_kind',
      'tax_calculation_basis',
      'tax_jurisdiction_level',
      'tax_remittance_owner',
      'international_sales_channel_code',
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

  it('INTL-1C 미국·캐나다 관할 카탈로그가 공용 타입과 같다', () => {
    const raw = queryJson(`
      select coalesce(jsonb_agg(jsonb_build_object(
        'countryCode', country_code,
        'regionCode', region_code,
        'name', name,
        'jurisdictionLevel', jurisdiction_level,
        'parentRegionCode', parent_region_code,
        'active', active
      ) order by country_code::text, region_code), '[]'::jsonb)
        from public.tax_region_catalog
       where country_code in ('US', 'CA')
    `);
    const expected = [...LAUNCH_TAX_REGIONS]
      .map((region) => ({ ...region, parentRegionCode: null, active: true }))
      .sort(
        (a, b) =>
          a.countryCode.localeCompare(b.countryCode) || a.regionCode.localeCompare(b.regionCode),
      );
    expect(raw).toEqual(expected);
  });

  it.each([
    ['tax_exclusive', 10, 10, 11.55, 1.55],
    ['tax_inclusive', 11.55, 10, 11.55, 1.55],
  ] as const)(
    'INTL-1D %s SQL numeric 결과와 core 미리보기가 같다',
    (priceBasis, unitPrice, netSales, customerTotal, taxTotal) => {
      const coreComponents: InternationalTaxComponentInput[] = [
        {
          id: '00000000-0000-0000-0000-0000000000c1',
          kind: 'primary',
          ratePct: 10,
          calculationBasis: 'primary_tax_exclusive',
          appliesToTreatments: ['taxable'],
          remittanceOwner: 'merchant',
        },
        {
          id: '00000000-0000-0000-0000-0000000000c2',
          kind: 'additional',
          ratePct: 5,
          calculationBasis: 'primary_tax_inclusive',
          appliesToTreatments: ['taxable'],
          remittanceOwner: 'marketplace',
        },
      ];
      const dbComponents = coreComponents.map((component) => ({
        component_id: component.id,
        kind: component.kind,
        rate_pct: component.ratePct,
        calculation_basis: component.calculationBasis,
        applies_to_treatments: component.appliesToTreatments,
        remittance_owner: component.remittanceOwner,
      }));
      const db = queryJson(`select public.calculate_international_tax(
        '${priceBasis}',2::smallint,'taxable',${unitPrice},
        '${JSON.stringify(dbComponents)}'::jsonb)::text`) as Record<string, unknown>;
      const core = calculateInternationalTax({
        priceBasis,
        minorUnit: 2,
        treatment: 'taxable',
        unitPrice,
        quantity: 1,
        components: coreComponents,
      });
      expect({
        netSales: Number(db.net_sales),
        customerTotal: Number(db.customer_total),
        taxTotal: Number(db.tax_total),
        componentAmounts: (db.components as Array<Record<string, unknown>>).map((component) =>
          Number(component.rounded_amount),
        ),
      }).toEqual({
        netSales,
        customerTotal,
        taxTotal,
        componentAmounts: core.components.map((component) => component.roundedAmount),
      });
    },
  );

  it('INTL-1D KRW 포함가 역산도 SQL numeric과 core가 같다', () => {
    const component: InternationalTaxComponentInput = {
      id: '00000000-0000-0000-0000-0000000000c1',
      kind: 'primary',
      ratePct: 10,
      calculationBasis: 'primary_tax_exclusive',
      appliesToTreatments: ['taxable'],
      remittanceOwner: 'merchant',
    };
    const dbComponent = {
      component_id: component.id,
      kind: component.kind,
      rate_pct: component.ratePct,
      calculation_basis: component.calculationBasis,
      applies_to_treatments: component.appliesToTreatments,
      remittance_owner: component.remittanceOwner,
    };
    const db = queryJson(`select public.calculate_international_tax(
      'tax_inclusive',0::smallint,'taxable',12000,
      '${JSON.stringify([dbComponent])}'::jsonb)::text`) as Record<string, unknown>;
    const core = calculateInternationalTax({
      priceBasis: 'tax_inclusive',
      minorUnit: 0,
      treatment: 'taxable',
      unitPrice: 12000,
      quantity: 1,
      components: [component],
    });
    expect({
      netSales: core.netSales,
      customerTotal: core.customerTotal,
      taxTotal: core.taxTotal,
    }).toEqual({
      netSales: Number(db.net_sales),
      customerTotal: Number(db.customer_total),
      taxTotal: Number(db.tax_total),
    });
    expect(core).toMatchObject({ netSales: 10909, customerTotal: 12000, taxTotal: 1091 });
  });

  it.each(['zero_rated', 'exempt'] as const)(
    'INTL-1D %s 비과세 의미도 SQL numeric과 core가 같다',
    (treatment) => {
      const component: InternationalTaxComponentInput = {
        id: '00000000-0000-0000-0000-0000000000c1',
        kind: 'primary',
        ratePct: 10,
        calculationBasis: 'primary_tax_exclusive',
        appliesToTreatments: ['taxable'],
        remittanceOwner: 'merchant',
      };
      const dbComponent = {
        component_id: component.id,
        kind: component.kind,
        rate_pct: component.ratePct,
        calculation_basis: component.calculationBasis,
        applies_to_treatments: component.appliesToTreatments,
        remittance_owner: component.remittanceOwner,
      };
      const db = queryJson(`select public.calculate_international_tax(
        'tax_inclusive',2::smallint,'${treatment}',10,
        '${JSON.stringify([dbComponent])}'::jsonb)::text`) as Record<string, unknown>;
      const core = calculateInternationalTax({
        priceBasis: 'tax_inclusive',
        minorUnit: 2,
        treatment,
        unitPrice: 10,
        quantity: 1,
        components: [component],
      });
      expect({
        netSales: core.netSales,
        customerTotal: core.customerTotal,
        taxTotal: core.taxTotal,
      }).toEqual({
        netSales: Number(db.net_sales),
        customerTotal: Number(db.customer_total),
        taxTotal: Number(db.tax_total),
      });
    },
  );

  it('INTL-1D 십진 절반 반올림 경계도 SQL numeric과 core가 같다', () => {
    const component: InternationalTaxComponentInput = {
      id: '00000000-0000-0000-0000-0000000000c1',
      kind: 'primary',
      ratePct: 10,
      calculationBasis: 'primary_tax_exclusive',
      appliesToTreatments: ['taxable'],
      remittanceOwner: 'merchant',
    };
    const dbComponent = {
      component_id: component.id,
      kind: component.kind,
      rate_pct: component.ratePct,
      calculation_basis: component.calculationBasis,
      applies_to_treatments: component.appliesToTreatments,
      remittance_owner: component.remittanceOwner,
    };
    const db = queryJson(`select public.calculate_international_tax(
      'tax_exclusive',2::smallint,'taxable',10.05,
      '${JSON.stringify([dbComponent])}'::jsonb)::text`) as Record<string, unknown>;
    const core = calculateInternationalTax({
      priceBasis: 'tax_exclusive',
      minorUnit: 2,
      treatment: 'taxable',
      unitPrice: 10.05,
      quantity: 1,
      components: [component],
    });
    expect(Number(db.tax_total)).toBe(1.01);
    expect(core.taxTotal).toBe(Number(db.tax_total));
  });

  it('INTL-1D 구성 항목·납부 주체 합도 SQL numeric과 core가 같다', () => {
    const coreComponents: InternationalTaxComponentInput[] = [
      {
        id: '00000000-0000-0000-0000-0000000000c1',
        kind: 'primary',
        ratePct: 0,
        calculationBasis: 'primary_tax_exclusive',
        appliesToTreatments: ['taxable'],
        remittanceOwner: 'merchant',
      },
      {
        id: '00000000-0000-0000-0000-0000000000c2',
        kind: 'additional',
        ratePct: 1,
        calculationBasis: 'primary_tax_exclusive',
        appliesToTreatments: ['taxable'],
        remittanceOwner: 'merchant',
      },
      {
        id: '00000000-0000-0000-0000-0000000000c3',
        kind: 'additional',
        ratePct: 2,
        calculationBasis: 'primary_tax_exclusive',
        appliesToTreatments: ['taxable'],
        remittanceOwner: 'marketplace',
      },
    ];
    const dbComponents = coreComponents.map((component) => ({
      component_id: component.id,
      kind: component.kind,
      rate_pct: component.ratePct,
      calculation_basis: component.calculationBasis,
      applies_to_treatments: component.appliesToTreatments,
      remittance_owner: component.remittanceOwner,
    }));
    const db = queryJson(`select public.calculate_international_tax(
      'tax_exclusive',2::smallint,'taxable',10,
      '${JSON.stringify(dbComponents)}'::jsonb)::text`) as Record<string, unknown>;
    const core = calculateInternationalTax({
      priceBasis: 'tax_exclusive',
      minorUnit: 2,
      treatment: 'taxable',
      unitPrice: 10,
      quantity: 1,
      components: coreComponents,
    });
    expect({
      taxTotal: core.taxTotal,
      customerTotal: core.customerTotal,
      merchant: core.merchantTaxLiability,
      marketplace: core.marketplaceTaxLiability,
    }).toEqual({
      taxTotal: Number(db.tax_total),
      customerTotal: Number(db.customer_total),
      merchant: Number(db.merchant_tax_liability),
      marketplace: Number(db.marketplace_tax_liability),
    });
  });
});

if (!DB) {
  it('MARGINCOOK_PARITY_DB가 없어 살아 있는 DB 대조는 건너뛴다 (verify ④가 실행한다)', () => {
    expect(true).toBe(true);
  });
}
