import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { calculateInternationalTax, formatMarketMoney, marketMoneyInputFormat } from '@costkeep/core';
import {
  LAUNCH_COUNTRY_CODES,
  LAUNCH_MARKETS,
  TAX_CALCULATION_BASES,
  TAX_COMPONENT_KINDS,
  TAX_PRICE_BASES,
  TAX_REMITTANCE_OWNERS,
  TAX_TREATMENTS,
  type LaunchCountryCode,
  type TaxCalculationBasis,
  type TaxComponentKind,
  type TaxPriceBasis,
  type TaxRemittanceOwner,
  type TaxTreatment,
} from '@costkeep/types';
import { AppHeader, Card, Input, QueryState } from '@/components/kit';
import { RecipeDetailHeading, RecipeDetailRow, RecipeDetailSubtotal } from '@/features/recipes/components/RecipeDetailParts';
import { useInternationalTaxState } from '@/features/international-tax';
import { safeBack } from '@/lib/nav';
import { clampDecimals } from '@/lib/num';
import { T, space } from '@/theme/tokens';

type SimulationComponent = {
  id: string;
  name: string;
  kind: TaxComponentKind;
  ratePct: number;
  calculationBasis: TaxCalculationBasis;
  appliesToTreatments: TaxTreatment[];
  remittanceOwner: TaxRemittanceOwner;
};

type TaxSimulationParams = {
  country?: string;
  basis?: string;
  treatment?: string;
  components?: string;
};

const includes = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === 'string' && values.includes(value as T);

function parseComponents(value: string | undefined): SimulationComponent[] | null {
  if (!value) return null;
  try {
    const rows: unknown = JSON.parse(value);
    if (!Array.isArray(rows)) return null;
    const parsed = rows.map((row): SimulationComponent | null => {
      if (!row || typeof row !== 'object') return null;
      const item = row as Record<string, unknown>;
      if (typeof item.id !== 'string' || typeof item.name !== 'string' || !includes(TAX_COMPONENT_KINDS, item.kind)
        || typeof item.ratePct !== 'number' || !Number.isFinite(item.ratePct) || item.ratePct < 0 || item.ratePct >= 100
        || !includes(TAX_CALCULATION_BASES, item.calculationBasis) || !Array.isArray(item.appliesToTreatments)
        || !item.appliesToTreatments.every(entry => includes(TAX_TREATMENTS, entry)) || !includes(TAX_REMITTANCE_OWNERS, item.remittanceOwner)) return null;
      return { id: item.id, name: item.name, kind: item.kind, ratePct: item.ratePct, calculationBasis: item.calculationBasis,
        appliesToTreatments: item.appliesToTreatments as TaxTreatment[], remittanceOwner: item.remittanceOwner };
    });
    if (parsed.some(row => row === null)) return null;
    const result = parsed as SimulationComponent[];
    return result.filter(row => row.kind === 'primary').length === 1 ? result : null;
  } catch { return null; }
}

/** MY-02c — 세금 설정을 저장하지 않고 판매가별 세금만 확인하는 독립 화면. */
export default function TaxSimulationScreen() {
  const params = useLocalSearchParams<TaxSimulationParams>();
  const state = useInternationalTaxState();
  const [priceInput, setPriceInput] = useState('');
  const routeComponents = useMemo(() => parseComponents(params.components), [params.components]);
  const market = state.data?.marketProfile;
  const taxProfile = state.data?.taxProfile;
  const country: LaunchCountryCode = includes(LAUNCH_COUNTRY_CODES, params.country) ? params.country : market?.countryCode ?? 'KR';
  const definition = LAUNCH_MARKETS[country];
  const inputFormat = marketMoneyInputFormat(definition.currencyCode);
  const basis: TaxPriceBasis = includes(TAX_PRICE_BASES, params.basis) ? params.basis : market?.priceBasis ?? definition.defaultTaxPriceBasis;
  const treatment: TaxTreatment = includes(TAX_TREATMENTS, params.treatment) ? params.treatment : taxProfile?.defaultTreatment ?? 'taxable';
  const components = routeComponents ?? taxProfile?.components.map(component => ({
    id: component.configKey,
    name: component.name,
    kind: component.kind,
    ratePct: component.ratePct,
    calculationBasis: component.calculationBasis,
    appliesToTreatments: [...component.appliesToTreatments],
    remittanceOwner: taxProfile.remittanceRules.find(rule => rule.taxComponentId === component.id && rule.salesChannel === 'hall')?.remittanceOwner ?? 'merchant',
  })) ?? [];
  const amount = Number(priceInput);
  const canCalculate = priceInput.trim() !== '' && Number.isFinite(amount) && amount >= 0
    && amount <= Number.MAX_SAFE_INTEGER / (10 ** definition.minorUnit) && components.filter(row => row.kind === 'primary').length === 1;
  const simulation = canCalculate ? calculateInternationalTax({ priceBasis: basis, minorUnit: definition.minorUnit,
    treatment, unitPrice: amount, quantity: 1, components }) : null;
  const money = (value: number) => formatMarketMoney(value, definition.currencyCode);
  const rate = (value: number) => simulation && amount > 0 ? `${(value / amount * 100).toFixed(1)}%` : '0.0%';
  const missing = !state.isLoading && !state.error && components.length === 0;

  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="세금 시뮬레이션" onBack={() => safeBack('/my/tax')} />
    <ScrollView style={{ backgroundColor: T.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
      <QueryState isLoading={!routeComponents && state.isLoading} error={!routeComponents ? state.error : null} isEmpty={missing}
        emptyTitle="세금 설정을 확인할 수 없어요" onRetry={() => void state.refetch()}>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <RecipeDetailHeading title="판매가" />
          <View testID="tax-simulation-price-row" style={{ marginHorizontal: space.lg, paddingVertical: space.md }}>
            <View testID="tax-simulation-price-control" style={{ width: '100%' }}>
              <Input accessibilityLabel="시뮬레이션 판매가" value={priceInput} onChangeText={value => setPriceInput(clampDecimals(value, definition.minorUnit))}
                placeholder="판매가 입력" prefix={inputFormat.prefix} suffix={inputFormat.suffix}
                numberFormat={{ fixedDigits: inputFormat.digits, group: inputFormat.group, decimal: inputFormat.decimal }}
                keyboardType="decimal-pad" variant="stacked" mono />
            </View>
          </View>
        </Card>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <RecipeDetailHeading title="세금 총액" />
          {components.map(component => {
            const result = simulation?.components.find(row => row.id === component.id);
            return <RecipeDetailRow key={component.id} inset label={component.name} value={money(result?.roundedAmount ?? 0)}
              secondary={rate(result?.roundedAmount ?? 0)} />;
          })}
          <RecipeDetailSubtotal label="합계" value={money(simulation?.taxTotal ?? 0)} secondary={rate(simulation?.taxTotal ?? 0)} />
        </Card>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <RecipeDetailHeading title="세금 제외 금액" />
          <RecipeDetailRow inset label="판매가" value={money(simulation ? amount : 0)} secondary={simulation && amount > 0 ? '100%' : '0.0%'} />
          <RecipeDetailRow inset label="(−) 세금 총액" value={money(simulation?.taxTotal ?? 0)} secondary={rate(simulation?.taxTotal ?? 0)} last />
          <RecipeDetailSubtotal label="소계" value={money(simulation?.netSales ?? 0)} secondary={rate(simulation?.netSales ?? 0)} />
        </Card>
      </QueryState>
    </ScrollView>
  </View>;
}
