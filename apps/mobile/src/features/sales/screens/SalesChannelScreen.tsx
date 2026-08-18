/**
 * SALES-18 채널별 손익 — 매장·배달·포장 분할 손익.
 *
 * 매출·수량·재료비·세금·수수료는 판매 줄에 채널별 수량이 있어 **정확히** 나뉜다.
 * 고정지출·폐기·추가지출만 매출 비중 배분이며, 표에 '배분'이라고 적어 구분한다 —
 * 배분값을 실제값처럼 보이게 하면 "배달이 적자"라는 잘못된 결론으로 이어진다.
 */
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { useSalesRange } from '../hooks';
import { useChannelFixed } from '@/features/my/hooks';
import { rangeLabel, todayBusiness } from '../period';

const NUM = { fontVariant: ['tabular-nums' as const] };
const COLOR: Record<string, string> = { hall: '#3182F6', delivery: '#7A8694', takeout: '#C5CCD3' };

export default function SalesChannelScreen() {
  const params = useLocalSearchParams<{ from?: string; to?: string; date?: string }>();
  const today = todayBusiness();
  const from = params.from ?? params.date ?? today;
  const to = params.to ?? params.date ?? today;

  const range = useSalesRange(from, to);
  // 고정지출은 항목마다 드는 채널이 다르다(수수료는 배달에만). 서버가 비중대로 나눠 준다.
  const chFixed = useChannelFixed(from, to);
  const s = range.data?.summary;
  const channels = (range.data?.channels ?? []).filter((c) => c.amount > 0);
  const menuRevenue = channels.reduce((a, c) => a + c.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="채널별 손익" onBack={() => safeBack(`/sales/day?date=${to}`)} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28, gap: 11 }}>
        <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600', marginHorizontal: 2 }}>{rangeLabel(from, to)}</Text>

        <QueryState
          isLoading={range.isLoading}
          error={range.error}
          isEmpty={channels.length === 0}
          onRetry={() => void range.refetch()}
          emptyTitle="이 기간에 판매 기록이 없어요"
        >
          {channels.map((c) => {
            // 채널에 귀속되지 않는 비용은 **메뉴 매출** 비중으로 나눈다.
            // 기타 매출은 채널이 없으므로 분모에서 뺀다.
            const share = menuRevenue > 0 ? c.amount / menuRevenue : 0;
            const waste = (s?.wasteLoss ?? 0) * share;
            // 비중 설정이 있으면 그 값, 없으면 서버가 매출 비중으로 계산한 값이 온다.
            const fixed = chFixed.data?.byChannel[c.code] ?? (s?.fixedCost ?? 0) * share;
            const daily = (s?.dailyExtra ?? 0) * share;
            const extraMat = (s?.extraMaterialCost ?? 0) * share;
            const profit = c.amount - c.material - extraMat - c.fee - c.tax - waste - fixed - daily;
            const rate = c.amount > 0 ? Math.round((profit / c.amount) * 1000) / 10 : 0;
            const neg = profit < 0;
            const PR = neg ? T.red : T.green;
            const p = (v: number) => (c.amount > 0 ? Math.round((v / c.amount) * 1000) / 10 : 0);

            // [라벨, 금액, 배분값인가]
            const costs: [string, number, boolean][] = [
              ['(−) 재료 원가', c.material, false],
              ['(−) 부자재', extraMat, true],
              ['(−) 채널 수수료', c.fee, false],
              ['(−) 폐기 손실', waste, true],
              ['(−) 고정 지출', fixed, chFixed.data === undefined],
              ['(−) 추가 지출', daily, true],
              ['(−) 세금', c.tax, false],
            ];

            return (
              <Card key={c.code} pad={0} style={{ overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: COLOR[c.code] ?? T.sub2 }} />
                  <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>{c.name}</Text>
                  {c.feeRate > 0 ? (
                    <Text style={[{ fontSize: 14, fontWeight: '700', color: T.amberText }, NUM]}>수수료 {c.feeRate}%</Text>
                  ) : null}
                  <View style={{ flex: 1 }} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: T.ter }}>매출 대비 %</Text>
                </View>
                <View style={{ paddingHorizontal: 15, paddingBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>판매 수량</Text>
                    <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{c.qty}개</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>매출</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(c.amount)}원</Text>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }}>100%</Text>
                    </View>
                  </View>
                  {costs.map(([n, v, allocated]) => (
                    <View key={n} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>
                        {n}
                        {allocated ? <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}> 배분</Text> : null}
                      </Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ter }, NUM]}>{won(v)}원</Text>
                        <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>{p(v)}%</Text>
                      </View>
                    </View>
                  ))}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12 }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>순이익</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[{ fontSize: 16, fontWeight: '800', color: PR }, NUM]}>{neg ? '−' : ''}{won(Math.abs(profit))}원</Text>
                      <Text style={[{ fontSize: 14, fontWeight: '800', color: PR, marginTop: 2 }, NUM]}>{rate}%</Text>
                    </View>
                  </View>
                </View>
              </Card>
            );
          })}
        </QueryState>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blueLine }}>
          <Icon name="info" size={15} color={T.blue} />
          <Text style={{ flex: 1, fontSize: 14, color: T.blue, fontWeight: '600', lineHeight: 20 }}>
            재료비·수수료·세금은 채널별 판매 수량에서 나온 실제값이에요. 고정 지출은 항목별 채널 비중대로 나뉘고,
            비중을 정하지 않은 항목만 매출 비중으로 배분돼요.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
