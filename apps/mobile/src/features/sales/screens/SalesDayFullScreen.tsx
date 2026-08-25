/**
 * SALES-10 손익 자세히 — 매출(메뉴 TOP5 + 기타) + 지출 항목별 하위 내역 + 순이익.
 * 손익 상세의 '자세히 보기'로 진입.
 *
 * 하위 내역은 지어내지 않는다. 재료·부자재는 원장에서 되짚고(sales_material_usage),
 * 고정지출은 월 항목을 비중대로 나눈다(sales_fixed_breakdown). 근거 없는 줄은 그리지 않는다.
 */
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Badge, Card, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { useExtraUsage, useFixedBreakdown, useMaterialUsage, useSalesRange } from '../hooks';
import { rangeLabel } from '../period';
import { useSalesBusinessDate } from '../businessDay';
import { BusinessDateGate } from '../components/BusinessDateGate';

const NUM = { fontVariant: ['tabular-nums' as const] };
const TARGET_RATE = 20;

/** 고정지출 항목 키 → 한글 라벨. 키를 그대로 보여주면 사장님이 못 읽는다. */
const FIXED_LABEL: Record<string, string> = {
  labor: '인건비', rent: '임대료', utility: '공과금', commission: '플랫폼 수수료',
  packing: '포장비', delivery: '배달/배송', ads: '광고/홍보', etc: '기타',
};

/**
 * ⚠ 서버가 정한 장부 날짜를 받고 나서 본체를 붙인다(0125). 앱이 직접 계산하지 않는다.
 *   게이트가 로딩·오류·재시도를 함께 다룬다 — 날짜 조회가 실패하면 예전엔 영원히
 *   "불러오는 중" 만 떴다.
 */
export default function SalesDayFullScreen() {
  return (
    <BusinessDateGate source={useSalesBusinessDate()} title="매출 상세">
      {(serverToday) => <SalesDayFullScreenBody serverToday={serverToday} />}
    </BusinessDateGate>
  );
}

function SalesDayFullScreenBody({ serverToday }: { serverToday: string }) {
  const params = useLocalSearchParams<{ date?: string; from?: string; to?: string }>();
    const today = serverToday;
  const from = params.from ?? params.date ?? today;
  const to = params.to ?? params.date ?? today;

  const range = useSalesRange(from, to);
  const material = useMaterialUsage(from, to);
  const extra = useExtraUsage(from, to);
  const fixed = useFixedBreakdown(from, to);

  const s = range.data?.summary;
  const pctOf = (v: number) => (s && s.revenue > 0 ? Math.round((v / s.revenue) * 1000) / 10 : 0);

  const menu = [...(range.data?.menu ?? [])].sort((a, b) => b.revenue - a.revenue);
  const top = menu.slice(0, 5);
  const topSum = top.reduce((a, m) => a + m.revenue, 0);
  const rest = (s?.revenue ?? 0) - topSum;

  const marginPct = pctOf(s?.profit ?? 0);
  const met = marginPct >= TARGET_RATE;
  const PR = met ? T.green : T.amberText;

  const costs: { n: string; v: number; sub: [string, number][] }[] = s
    ? [
        { n: '(−) 재료 원가', v: s.materialCost, sub: (material.data?.items ?? []).slice(0, 5).map((i) => [i.name, Math.round(i.amount)] as [string, number]) },
        { n: '(−) 부자재', v: s.extraMaterialCost, sub: (extra.data?.items ?? []).slice(0, 5).map((i) => [i.name, Math.round(i.amount)] as [string, number]) },
        { n: '(−) 폐기 손실', v: s.wasteLoss, sub: [
            ...(s.wasteIngredient > 0 ? [['식재료 폐기', Math.round(s.wasteIngredient)] as [string, number]] : []),
            ...(s.wasteMenu > 0 ? [['조리 폐기', Math.round(s.wasteMenu)] as [string, number]] : []),
          ] },
        { n: '(−) 고정 지출', v: s.fixedCost, sub: (fixed.data?.items ?? []).map((i) => [FIXED_LABEL[i.key] ?? i.key, Math.round(i.amount)] as [string, number]) },
        { n: '(−) 추가 지출', v: s.dailyExtra, sub: [] },
        { n: '(−) 세금', v: s.tax, sub: [] },
      ]
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={`${rangeLabel(from, to)} 손익 자세히`} onBack={() => safeBack(`/sales/day?date=${to}`)} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28 }}>
        <QueryState
          isLoading={range.isLoading}
          error={range.error}
          isEmpty={false}
          onRetry={() => void range.refetch()}
          emptyTitle=""
        >
          {s ? (
            <Card onLine pad={0} style={{ overflow: 'hidden' }}>
              <View style={{ paddingHorizontal: 15, paddingBottom: 15 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>판매 수량</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{s.qty}개</Text>
                </View>

                <Text style={{ fontSize: 14, fontWeight: '800', color: T.ink, paddingTop: 12, paddingBottom: 6 }}>매출</Text>
                {top.map((m) => (
                  <View key={m.recipeId ?? m.menuName} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub }} numberOfLines={1}>
                      {m.menuName} <Text style={{ color: T.ter }}>×{m.qty}</Text>
                    </Text>
                    <Text style={[{ fontSize: 14, fontWeight: '700', color: T.ink }, NUM]}>{won(m.revenue)}원</Text>
                  </View>
                ))}
                {rest > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub }}>그 외 메뉴 · 기타 매출</Text>
                    <Text style={[{ fontSize: 14, fontWeight: '700', color: T.ink }, NUM]}>{won(rest)}원</Text>
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>매출 합계</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 16 }, NUM]}>{won(s.revenue)}원</Text>
                  <Text style={{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.ter }}>100%</Text>
                </View>

                {costs.map((c) => (
                  <View key={c.n}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{c.n}</Text>
                      <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ter, marginRight: 16 }, NUM]}>{won(c.v)}원</Text>
                      <Text style={[{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.ter }, NUM]}>{pctOf(c.v)}%</Text>
                    </View>
                    {c.sub.map(([sn, sv]) => (
                      <View key={`${c.n}-${sn}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                        <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.ter }} numberOfLines={1}>· {sn}</Text>
                        <Text style={[{ fontSize: 14, fontWeight: '600', color: T.sub2 }, NUM]}>{won(sv)}원</Text>
                      </View>
                    ))}
                  </View>
                ))}

                <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 13 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 8 }}>순이익</Text>
                  <Badge tone={met ? 'green' : 'amber'} sm>{met ? '목표 달성' : '목표 미달'}</Badge>
                  <View style={{ flex: 1 }} />
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: PR, marginRight: 16 }, NUM]}>{won(s.profit)}원</Text>
                  <Text style={[{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '800', color: PR }, NUM]}>{marginPct}%</Text>
                </View>
              </View>
            </Card>
          ) : null}
        </QueryState>
      </ScrollView>
    </View>
  );
}
