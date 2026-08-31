import Decimal from 'decimal.js';

export type InternationalTaxPriceBasis = 'tax_inclusive' | 'tax_exclusive';
export type InternationalTaxTreatment = 'taxable' | 'zero_rated' | 'exempt';
export type InternationalTaxCalculationBasis = 'primary_tax_exclusive' | 'primary_tax_inclusive';
export type InternationalTaxRemittanceOwner = 'merchant' | 'marketplace';

export type InternationalTaxComponentInput = {
  id: string;
  kind: 'primary' | 'additional';
  ratePct: number;
  calculationBasis: InternationalTaxCalculationBasis;
  appliesToTreatments: InternationalTaxTreatment[];
  remittanceOwner: InternationalTaxRemittanceOwner;
};

export type InternationalTaxInput = {
  priceBasis: InternationalTaxPriceBasis;
  minorUnit: 0 | 2;
  treatment: InternationalTaxTreatment;
  unitPrice: number;
  quantity: number;
  components: InternationalTaxComponentInput[];
};

export type InternationalTaxComponentAmount = InternationalTaxComponentInput & {
  unroundedAmount: number;
  roundedAmount: number;
};

export type InternationalTaxResult = {
  listedTotal: number;
  netSales: number;
  customerTotal: number;
  taxTotal: number;
  merchantTaxLiability: number;
  marketplaceTaxLiability: number;
  components: InternationalTaxComponentAmount[];
};

/**
 * 국제 세금 입력 미리보기다. 영구 저장의 권위는 DB numeric 계산이며, 이 함수는
 * 같은 공식의 화면 미리보기와 SQL↔core 검산에만 사용한다.
 */
export function calculateInternationalTax(input: InternationalTaxInput): InternationalTaxResult {
  const { priceBasis, minorUnit, treatment, unitPrice, quantity, components } = input;
  if (!Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(quantity) || quantity < 0) {
    throw new Error('판매가와 수량은 0 이상의 유한수여야 합니다');
  }
  if (minorUnit !== 0 && minorUnit !== 2) throw new Error('지원하지 않는 통화 소수 자릿수입니다');

  const primary = components.filter((component) => component.kind === 'primary');
  if (primary.length !== 1) throw new Error('기본세 구성 항목은 정확히 하나여야 합니다');
  if (new Set(components.map((component) => component.id)).size !== components.length) {
    throw new Error('세금 구성 항목 ID가 중복됐습니다');
  }
  for (const component of components) {
    if (!Number.isFinite(component.ratePct) || component.ratePct < 0 || component.ratePct >= 100) {
      throw new Error('세율은 0 이상 100 미만이어야 합니다');
    }
  }

  const listedTotalDecimal = new Decimal(unitPrice).times(quantity);
  const primaryRate =
    treatment === 'taxable' ? new Decimal(primary[0]!.ratePct).div(100) : new Decimal(0);
  const multiplier = components.reduce((sum, component) => {
    if (component.kind === 'primary' || !component.appliesToTreatments.includes(treatment))
      return sum;
    const basis =
      component.calculationBasis === 'primary_tax_inclusive' ? primaryRate.plus(1) : new Decimal(1);
    return sum.plus(new Decimal(component.ratePct).div(100).times(basis));
  }, primaryRate.plus(1));
  const netBeforeRounding =
    priceBasis === 'tax_inclusive' ? listedTotalDecimal.div(multiplier) : listedTotalDecimal;

  const amounts = components.map((component): InternationalTaxComponentAmount => {
    const applies =
      component.kind === 'primary'
        ? treatment === 'taxable'
        : component.appliesToTreatments.includes(treatment);
    const basis =
      component.calculationBasis === 'primary_tax_inclusive' ? primaryRate.plus(1) : new Decimal(1);
    const unrounded = applies
      ? netBeforeRounding.times(new Decimal(component.ratePct).div(100)).times(basis)
      : new Decimal(0);
    return {
      ...component,
      unroundedAmount: unrounded.toNumber(),
      roundedAmount: unrounded.toDecimalPlaces(minorUnit, Decimal.ROUND_HALF_UP).toNumber(),
    };
  });
  const taxTotalDecimal = amounts.reduce(
    (sum, component) => sum.plus(component.roundedAmount),
    new Decimal(0),
  );
  const merchantTaxDecimal = amounts
    .filter((component) => component.remittanceOwner === 'merchant')
    .reduce((sum, component) => sum.plus(component.roundedAmount), new Decimal(0));
  const marketplaceTaxDecimal = amounts
    .filter((component) => component.remittanceOwner === 'marketplace')
    .reduce((sum, component) => sum.plus(component.roundedAmount), new Decimal(0));
  const customerTotalDecimal =
    priceBasis === 'tax_inclusive' ? listedTotalDecimal : listedTotalDecimal.plus(taxTotalDecimal);
  const netSalesDecimal =
    priceBasis === 'tax_inclusive' ? listedTotalDecimal.minus(taxTotalDecimal) : listedTotalDecimal;

  return {
    listedTotal: listedTotalDecimal.toNumber(),
    netSales: netSalesDecimal.toNumber(),
    customerTotal: customerTotalDecimal.toNumber(),
    taxTotal: taxTotalDecimal.toNumber(),
    merchantTaxLiability: merchantTaxDecimal.toNumber(),
    marketplaceTaxLiability: marketplaceTaxDecimal.toNumber(),
    components: amounts,
  };
}
