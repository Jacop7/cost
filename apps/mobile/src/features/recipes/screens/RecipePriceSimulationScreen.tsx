import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Input, QueryState, ScrollTabs } from '@/components/kit';
import { COLOR, T, TYPE, space, won } from '@/theme/tokens';
import { formatPercent, recommendedPrice, taxRate } from '@margincook/core';
import { safeBack } from '@/lib/nav';
import { clampDecimals } from '@/lib/num';
import { useAppCapabilities } from '@/features/international-tax';
import { useRecipeDetail } from '../hooks';
import { previewRecipePrice } from '../priceSimulation';

/** RCP-02c — 실제 판매가/원장은 건드리지 않는 독립 시뮬레이션 화면. */
export default function RecipePriceSimulationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useRecipeDetail(id);
  const capabilities = useAppCapabilities();
  const r = query.data;
  const [priceInput, setPriceInput] = useState('');
  const [dirty, setDirty] = useState(false);
  const [batch, setBatch] = useState(false);
  useEffect(() => { setPriceInput(''); setDirty(false); setBatch(false); }, [id]);
  const price = dirty ? Number(priceInput) || 0 : r?.price ?? 0;
  const multiplier = batch ? r?.baseServings ?? 1 : 1;
  const international = Boolean(capabilities.data?.internationalTax.readEnabled);
  const capabilityCode = (capabilities.error as { code?: string } | null)?.code;
  // Before the international-tax migration this RPC does not exist. Only that
  // explicit legacy schema condition may use the existing taxItems contract.
  const legacySchema = capabilityCode === 'PGRST202' || capabilityCode === '42883';
  const result = r ? previewRecipePrice(price, r.materialCost, r.extraCost, r.fixedRate, taxRate(r.taxItems)) : null;
  const recommendation = r ? recommendedPrice(r.materialCost + r.extraCost, r.fixedRate, r.targetProfitRate / 100, taxRate(r.taxItems)) : null;
  const recommended = recommendation !== null && recommendation > 0 ? Math.round(recommendation / 100) * 100 : null;
  const money = (amount: number) => `${won(Math.round(amount * multiplier))}원`;
  const row = (label: string, amount: number, accent = false, subtitle?: string) => <View key={label}
    style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.lg,
      borderBottomWidth: 1, borderBottomColor: T.line2 }}>
    <View style={{ flex: 1 }}><Text style={{ ...TYPE.body, fontWeight: '700', color: T.ink }}>{label}</Text>
      {subtitle ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, marginTop: space.xs }}>{subtitle}</Text> : null}</View>
    <View style={{ alignItems: 'flex-end' }}><Text style={{ ...TYPE.body, fontWeight: '800', color: accent ? COLOR.status.negative : T.ink }}>{money(amount)}</Text>
      <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary }}>{formatPercent(price > 0 ? amount / price : 0)}</Text></View>
  </View>;
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="판매가 시뮬레이션" onBack={() => safeBack(`/recipes/${id}` as Href)} />
    <ScrollView contentContainerStyle={{ padding: space.lg }}>
      <QueryState isLoading={query.isLoading || capabilities.isLoading} error={query.error ?? (legacySchema ? null : capabilities.error)}
        isEmpty={query.isFetched && !r} emptyTitle="메뉴를 찾을 수 없어요"
        onRetry={() => { void query.refetch(); void capabilities.refetch(); }}>
        {international ? <Text style={{ ...TYPE.body, color: T.sub }}>국제 세금 판매가 시뮬레이션은 서버 확정 계산을 연결한 뒤 제공해요.</Text> : r && result ? <Card pad={0} style={{ overflow: 'hidden' }}>
          <View style={{ padding: space.lg, backgroundColor: T.surface2 }}><Text style={{ ...TYPE.body, fontWeight: '800', color: T.ink }}>판매 손익</Text></View>
          <ScrollTabs tabs={[`${r.baseServings}인분`, '1인분']} active={batch ? 0 : 1} onChange={index => setBatch(index === 0)} />
          <View style={{ paddingHorizontal: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ ...TYPE.body, fontWeight: '700', color: T.ink }}>판매가</Text>
              <View style={{ flex: 1 }}><Input variant="stacked" mono suffix="원" accessibilityLabel="시뮬레이션 판매가" keyboardType="number-pad"
                value={dirty ? priceInput : String(r.price)} onChangeText={value => { setDirty(true); setPriceInput(clampDecimals(value, 0)); }} /></View>
            </View>
            <View style={{ flexDirection: 'row', paddingVertical: space.lg }}><Text style={{ flex: 1, ...TYPE.body, fontWeight: '700', color: T.ink }}>판매량</Text><Text style={{ ...TYPE.body, color: T.ink }}>{multiplier}인분</Text></View>
            {row('(−) 세금', result.tax)}
            {row('(−) 재료 원가', r.materialCost)}
            {row('(−) 고정 지출', result.fixed)}
            {row('(−) 부자재', r.extraCost)}
            {row('순이익', result.profit, result.rate * 100 < r.targetProfitRate, result.rate * 100 < r.targetProfitRate ? '목표 미달' : '목표 달성')}
            <View style={{ flexDirection: 'row', gap: space.sm, paddingVertical: space.lg }}>
              <View style={{ flex: 1 }}><Text style={{ ...TYPE.body, color: T.sub }}>권장 판매가</Text><Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary }}>목표 {r.targetProfitRate}% 기준</Text></View>
              <Text style={{ ...TYPE.body, fontWeight: '800', color: T.ink }}>{recommended === null ? '산출 불가' : `${won(recommended)}원`}</Text>
            </View>
          </View>
        </Card> : null}
      </QueryState>
    </ScrollView>
  </View>;
}
