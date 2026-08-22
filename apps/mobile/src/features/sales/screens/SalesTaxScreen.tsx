/**
 * SALES-18 세금 자세히.
 *
 * 항목별로 쪼개고, 그 안에서 **메뉴 매출분과 기타 매출분**을 갈라 보여 준다.
 * "왜 설정한 9.09% 랑 다르지?" 가 여기서 풀린다 — 예전에는 기타 매출에
 * 세금이 안 붙어서 총매출 대비 6.6% 로 보였다(0091).
 *
 * ⚠ 요율은 **판 날 기준**이다. 지금 요율로 다시 곱하면 MY > 세금 을 한 번
 *   고칠 때마다 지난달 장부가 통째로 움직인다.
 */
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { useSalesRange, useTaxBreakdown } from '../hooks';
import { rangeLabel, todayBusiness } from '../period';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 9.0909090909 → `9.09%`. 화면은 두 자리면 충분하다. */
const pct = (v: number) => `${(Math.round(v * 100) / 100).toFixed(2)}%`;

export default function SalesTaxScreen() {
  const { from: f, to: t } = useLocalSearchParams<{ from?: string; to?: string }>();
  const to = t ?? todayBusiness();
  const from = f ?? to;

  const q = useTaxBreakdown(from, to);
  const range = useSalesRange(from, to);
  const d = q.data;

  const revenue = range.data?.summary.revenue ?? 0;
  const etcRevenue = range.data?.summary.etcRevenue ?? 0;
  const menuRevenue = revenue - etcRevenue;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={`${rangeLabel(from, to)} 세금`} onBack={() => safeBack(`/sales/day?date=${to}`)} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <QueryState
          isLoading={q.isLoading}
          error={q.error}
          isEmpty={d !== undefined && d.total === 0}
          onRetry={() => void q.refetch()}
          emptyTitle="이 기간에 세금이 없어요"
          emptyHint="MY > 세금에서 항목을 넣으면 판매가에서 빠져요"
        >
          {d ? (
            <>
              <Card pad={0} style={{ overflow: 'hidden', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 15 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: T.sub }}>세금</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink }, NUM]}>
                    {won(Math.round(d.total))}원
                  </Text>
                  {revenue > 0 ? (
                    <Text style={[{ fontSize: 12, fontWeight: '700', color: T.ter, marginLeft: 4 }, NUM]}>
                      · {pct((d.total / revenue) * 100)}
                    </Text>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 15, gap: 14, borderTopWidth: 1, borderTopColor: T.line2 }}>
                  {([['메뉴 매출분', d.menuTotal], ['기타 매출분', d.etcTotal]] as const).map(([k, v]) => (
                    <View key={k} style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 12, color: T.ter, fontWeight: '700', marginBottom: 4 }}>{k}</Text>
                      <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>
                        {won(Math.round(v))}원
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>

              <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub, marginHorizontal: 2, marginBottom: 7 }}>
                항목별
              </Text>
              <Card pad={0} style={{ overflow: 'hidden', marginBottom: 12 }}>
                {d.items.map((i, k) => (
                  <View
                    key={i.name}
                    style={{
                      paddingVertical: 12, paddingHorizontal: 14,
                      borderBottomWidth: k === d.items.length - 1 ? 0 : 1, borderBottomColor: T.line2,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: T.ink }} numberOfLines={1}>
                        {i.name}
                      </Text>
                      <Text style={[{ fontSize: 12, color: T.ter, fontWeight: '700' }, NUM]}>{pct(i.rate)}</Text>
                      <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>
                        {won(Math.round(i.amount))}원
                      </Text>
                    </View>
                    <Text style={[{ fontSize: 12, color: T.sub, fontWeight: '600', marginTop: 3 }, NUM]}>
                      메뉴 {won(Math.round(i.menuAmount))}원 · 기타 {won(Math.round(i.etcAmount))}원
                    </Text>
                  </View>
                ))}
              </Card>

              {/* 분모를 밝힌다 — "설정은 9.09% 인데 왜 다르지?" 가 여기서 풀린다. */}
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub, marginHorizontal: 2, marginBottom: 7 }}>
                무엇에 붙었나
              </Text>
              <Card pad={0} style={{ overflow: 'hidden', marginBottom: 12 }}>
                {([
                  ['메뉴 매출', menuRevenue, d.menuTotal],
                  ['기타 매출', etcRevenue, d.etcTotal],
                ] as const).map(([k, base, tax], i) => (
                  <View
                    key={k}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                      paddingVertical: 12, paddingHorizontal: 14,
                      borderBottomWidth: i === 0 ? 1 : 0, borderBottomColor: T.line2,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: T.ink }}>{k}</Text>
                      <Text style={[{ fontSize: 12, color: T.sub, fontWeight: '600', marginTop: 3 }, NUM]}>
                        {won(Math.round(base))}원
                      </Text>
                    </View>
                    <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>
                      {won(Math.round(tax))}원
                    </Text>
                  </View>
                ))}
              </Card>

              <Text style={{ fontSize: 13, color: T.ter, lineHeight: 19, marginHorizontal: 2 }}>
                요율은 <Text style={{ fontWeight: '700' }}>판 날 기준</Text>이에요. MY {'>'} 세금에서 고쳐도
                지난 장부는 그대로예요.
              </Text>
            </>
          ) : null}
        </QueryState>
      </ScrollView>
    </View>
  );
}
