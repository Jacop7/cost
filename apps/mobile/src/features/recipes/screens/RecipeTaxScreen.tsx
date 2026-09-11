import { ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams } from 'expo-router';
import { calculateInternationalTax } from '@margincook/core';
import { LAUNCH_MARKETS } from '@margincook/types';
import { AppHeader, QueryState } from '@/components/kit';
import { useAppCapabilities, useRecipeTaxState, useInternationalTaxState } from '@/features/international-tax';
import { TaxSummaryCard, TaxSummaryRow } from '@/features/international-tax/TaxSummary';
import { useRecipeDetail } from '../hooks';
import { useRecipeRecommendation } from '../draftPreviewQuery';
import { safeBack } from '@/lib/nav';
import { COLOR, T, TYPE, space } from '@/theme/tokens';

/** 현재 메뉴의 서버 견적 또는 명시적 활성일 이전 서버 상세 세액을 표시한다. 매장 설정 편집과 예약 프로필은 사용하지 않는다. */
export default function RecipeTaxScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const capabilities = useAppCapabilities();
  const enabled = Boolean(capabilities.data?.internationalTax.readEnabled);
  const state = useRecipeTaxState(id, enabled);
  const detail = useRecipeDetail(id, { readOnly: true });
  const recommendation = useRecipeRecommendation(id, enabled);
  const settings = useInternationalTaxState();
  const profile = settings?.data?.taxProfile;
  const savedMarket = settings?.data?.marketProfile;
  const primary = profile?.components.find(c => c.kind === 'primary');
  const settingQuote = profile && savedMarket ? calculateInternationalTax({ priceBasis: savedMarket.priceBasis,
    minorUnit: LAUNCH_MARKETS[savedMarket.countryCode].minorUnit, treatment: profile.defaultTreatment, unitPrice: 100, quantity: 1,
    components: profile.components.map(c => ({ id: c.id, kind: c.kind, ratePct: c.ratePct, calculationBasis: c.calculationBasis, appliesToTreatments: [...c.appliesToTreatments],
      remittanceOwner: profile.remittanceRules.find(r => r.taxComponentId === c.id && r.salesChannel === 'hall')?.remittanceOwner ?? 'merchant' })) }) : null;
  const owners = profile?.remittanceRules.map(r => r.remittanceOwner) ?? [];
  const owner = owners.length && owners.every(o => o === owners[0]) ? owners[0] ?? null : null;
  const quote = state.data?.quote;
  const market = state.data?.quoteContext?.market;
  const beforeActivation = enabled && !recommendation.isFetching && !recommendation.error
    && recommendation.data?.status === 'unavailable' && recommendation.data.reason === 'not_active'
    && !state.isLoading && !state.error && quote === null;
  const legacy = beforeActivation && !detail.isLoading && !detail.error ? detail.data : null;
  const current = quote && market ? {
    price: quote.listedTotal, tax: quote.taxAmount, net: quote.netSales, basis: market.priceBasis,
    currency: market.currencyCode, minor: market.minorUnit, locale: market.businessLocaleCode,
    components: quote.components.map(c => ({ id: c.taxComponentId, name: c.name, amount: c.roundedAmount, primary: c.kind === 'primary' })),
  } : legacy ? {
    price: legacy.price, tax: legacy.tax, net: legacy.price - legacy.tax,
    basis: 'tax_inclusive' as const, currency: 'KRW', minor: 0, locale: 'ko-KR',
    components: legacy.taxBreakdown.map((c, i) => ({ id: String(i), name: c.name, amount: c.amount, primary: c.builtin || c.name.trim() === '부가세' })),
  } : null;
  const money = (value: number) => new Intl.NumberFormat(current?.locale ?? 'ko-KR', {
    style: 'currency', currency: current!.currency,
    minimumFractionDigits: current!.minor, maximumFractionDigits: current!.minor,
  }).format(value);
  const rate = (value: number) => current && current.price > 0 ? `${(value / current.price * 100).toFixed(1)}%` : '—';
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="세금 자세히 보기" onBack={() => safeBack(id ? `/recipes/${id}` as Href : '/recipes')} />
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <QueryState isLoading={capabilities.isLoading || (enabled && (state.isLoading || recommendation.isFetching)) || (beforeActivation && detail.isLoading)} error={capabilities.error ?? state.error ?? recommendation.error ?? (beforeActivation ? detail.error : null)}
        isEmpty={false} emptyTitle="세금 정보를 찾을 수 없어요" onRetry={() => { void capabilities.refetch(); if (enabled) { void state.refetch(); void recommendation.refetch(); } void detail.refetch(); }}>
        {enabled && current ? <>
          <TaxSummaryCard title="세금 총액">
            {current.components.map(c => <TaxSummaryRow key={c.id} label={c.name} value={money(c.amount)} rate={rate(c.amount)} />)}
            <TaxSummaryRow label="합계" value={money(current.tax)} rate={rate(current.tax)} last />
          </TaxSummaryCard>
          <TaxSummaryCard title="세금 제외 금액">
            <TaxSummaryRow label="판매가" value={money(current.price)} />
            <TaxSummaryRow label={current.basis === 'tax_inclusive' ? '(−) 세금 총액' : '별도 부과 세금'} value={money(current.tax)} />
            <TaxSummaryRow label="소계" value={money(current.net)} last />
          </TaxSummaryCard>
        </> : <Text style={{ ...TYPE.body, color: COLOR.text.tertiary }}>현재 적용되는 세금 정보를 확인할 수 없어요.</Text>}
        <QueryState isLoading={settings?.isLoading ?? false} error={settings?.error} isEmpty={false} emptyTitle="세금 설정을 확인할 수 없어요" onRetry={() => { void settings.refetch(); }}>
          {profile && savedMarket ? <>
            <TaxSummaryCard title="부가세 계산 기준">
                <TaxSummaryRow label="메뉴 가격 기준" value={savedMarket.priceBasis === 'tax_inclusive' ? '부가세 포함' : '부가세 미포함'} />
                <TaxSummaryRow label="법정 세율" value={primary ? `${primary.ratePct} %` : '—'} />
                <TaxSummaryRow label="부가세 적용 요율" value={settingQuote ? `${(settingQuote.components.find(c => c.kind === 'primary')?.unroundedAmount ?? 0).toFixed(4)} %` : '—'} last />
            </TaxSummaryCard>
            <TaxSummaryCard title="과세 및 납부 설정">
                <TaxSummaryRow label="과세 상태" value={profile.defaultTreatment === 'taxable' ? '일반 과세' : profile.defaultTreatment === 'zero_rated' ? '0% 과세' : '면세'} />
                <TaxSummaryRow label="세금 납부 주체" value={owner === 'merchant' ? '매장 직접 납부' : owner === 'marketplace' ? '플랫폼 대납' : '항목·판매 채널별 설정'} last />
            </TaxSummaryCard>
          </> : null}
        </QueryState>
      </QueryState>
    </ScrollView>
  </View>;
}
