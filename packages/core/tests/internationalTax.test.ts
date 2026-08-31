import { describe, expect, it } from 'vitest';
import { calculateInternationalTax, type InternationalTaxComponentInput } from '../src';

const components: InternationalTaxComponentInput[] = [
  {
    id: 'primary',
    kind: 'primary',
    ratePct: 10,
    calculationBasis: 'primary_tax_exclusive',
    appliesToTreatments: ['taxable'],
    remittanceOwner: 'merchant',
  },
  {
    id: 'additional',
    kind: 'additional',
    ratePct: 5,
    calculationBasis: 'primary_tax_inclusive',
    appliesToTreatments: ['taxable'],
    remittanceOwner: 'marketplace',
  },
];
const primary = components[0]!;
const additional = components[1]!;

describe('국제 세금 미리보기', () => {
  it('한국 포함가 12,000원의 법정 10%를 구성 항목 단위로 반올림한다', () => {
    const result = calculateInternationalTax({
      priceBasis: 'tax_inclusive',
      minorUnit: 0,
      treatment: 'taxable',
      unitPrice: 12000,
      quantity: 1,
      components: [primary],
    });
    expect(result).toMatchObject({
      listedTotal: 12000,
      netSales: 10909,
      customerTotal: 12000,
      taxTotal: 1091,
    });
  });

  it('USD 미포함가에서 기본세 포함 기준 추가세를 계산한다', () => {
    const result = calculateInternationalTax({
      priceBasis: 'tax_exclusive',
      minorUnit: 2,
      treatment: 'taxable',
      unitPrice: 10,
      quantity: 1,
      components,
    });
    expect(result).toMatchObject({
      listedTotal: 10,
      netSales: 10,
      customerTotal: 11.55,
      taxTotal: 1.55,
    });
    expect(result.components.map(({ roundedAmount }) => roundedAmount)).toEqual([1, 0.55]);
  });

  it('USD 포함가 11.55를 순매출 10.00과 두 세금으로 분해한다', () => {
    const result = calculateInternationalTax({
      priceBasis: 'tax_inclusive',
      minorUnit: 2,
      treatment: 'taxable',
      unitPrice: 11.55,
      quantity: 1,
      components,
    });
    expect(result).toMatchObject({
      listedTotal: 11.55,
      netSales: 10,
      customerTotal: 11.55,
      taxTotal: 1.55,
    });
    expect(result.components.map(({ roundedAmount }) => roundedAmount)).toEqual([1, 0.55]);
  });

  it.each(['zero_rated', 'exempt'] as const)(
    '%s는 의미를 보존하되 적용되지 않는 세액은 0이다',
    (treatment) => {
      const result = calculateInternationalTax({
        priceBasis: 'tax_inclusive',
        minorUnit: 2,
        treatment,
        unitPrice: 10,
        quantity: 1,
        components,
      });
      expect(result.taxTotal).toBe(0);
      expect(result.netSales).toBe(10);
    },
  );

  it('0% 과세에 명시 적용된 추가세는 기본세율을 0으로 두고 계산한다', () => {
    const result = calculateInternationalTax({
      priceBasis: 'tax_exclusive',
      minorUnit: 2,
      treatment: 'zero_rated',
      unitPrice: 10,
      quantity: 1,
      components: [primary, { ...additional, appliesToTreatments: ['zero_rated'] }],
    });
    expect(result.components.map(({ roundedAmount }) => roundedAmount)).toEqual([0, 0.5]);
    expect(result.taxTotal).toBe(0.5);
  });

  it('PostgreSQL numeric과 같은 십진 반올림으로 1.005를 1.01로 만든다', () => {
    const result = calculateInternationalTax({
      priceBasis: 'tax_exclusive',
      minorUnit: 2,
      treatment: 'taxable',
      unitPrice: 10.05,
      quantity: 1,
      components: [primary],
    });
    expect(result.components[0]!.unroundedAmount).toBe(1.005);
    expect(result.taxTotal).toBe(1.01);
    expect(result.customerTotal).toBe(11.06);
  });

  it('반올림한 여러 구성 항목 합도 이진 부동소수점 오차를 노출하지 않는다', () => {
    const result = calculateInternationalTax({
      priceBasis: 'tax_exclusive',
      minorUnit: 2,
      treatment: 'taxable',
      unitPrice: 10,
      quantity: 1,
      components: [
        { ...primary, ratePct: 0 },
        {
          ...additional,
          id: 'additional-1',
          ratePct: 1,
          calculationBasis: 'primary_tax_exclusive',
          remittanceOwner: 'merchant',
        },
        {
          ...additional,
          id: 'additional-2',
          ratePct: 2,
          calculationBasis: 'primary_tax_exclusive',
          remittanceOwner: 'marketplace',
        },
      ],
    });
    expect(result.taxTotal).toBe(0.3);
    expect(result.merchantTaxLiability).toBe(0.1);
    expect(result.marketplaceTaxLiability).toBe(0.2);
    expect(result.customerTotal).toBe(10.3);
  });

  it('기본세가 정확히 하나가 아니거나 구성 ID가 중복되면 실패 폐쇄한다', () => {
    expect(() =>
      calculateInternationalTax({
        priceBasis: 'tax_inclusive',
        minorUnit: 0,
        treatment: 'taxable',
        unitPrice: 1,
        quantity: 1,
        components: [],
      }),
    ).toThrow('정확히 하나');
    expect(() =>
      calculateInternationalTax({
        priceBasis: 'tax_inclusive',
        minorUnit: 0,
        treatment: 'taxable',
        unitPrice: 1,
        quantity: 1,
        components: [primary, additional, { ...additional }],
      }),
    ).toThrow('중복');
  });
});
