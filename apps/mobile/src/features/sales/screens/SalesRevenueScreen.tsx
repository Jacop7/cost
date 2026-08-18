/**
 * SALES-12 매출 자세히 — 메뉴 매출(TOP + 더보기) + 기타 매출 + 매출 합계.
 * 손익 상세의 '매출' 행에서 진입.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { useSalesDay, useSalesRange } from '../hooks';
import { rangeLabel, todayBusiness } from '../period';

const NUM = { fontVariant: ['tabular-nums' as const] };

export default function SalesRevenueScreen() {
  const params = useLocalSearchParams<{ from?: string; to?: string; date?: string }>();
  const today = todayBusiness();
  const from = params.from ?? params.date ?? today;
  const to = params.to ?? params.date ?? today;
  const isOneDay = from === to;

  const range = useSalesRange(from, to);
  // 기타 매출 내역(항목별)은 하루 장부에만 있다. 기간 조회에서는 합계만 보여준다.
  const day = useSalesDay(isOneDay ? from : '');

  const [showAll, setShowAll] = useState(false);

  const s = range.data?.summary;
  const sorted = [...(range.data?.menu ?? [])].sort((a, b) => b.revenue - a.revenue);
  const menuSum = sorted.reduce((a, m) => a + m.revenue, 0);
  const list = showAll ? sorted : sorted.slice(0, 5);
  const etcItems = isOneDay ? (day.data?.etcItems ?? []) : [];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="매출 자세히" onBack={() => safeBack(`/sales/day?date=${to}`)} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28 }}>
        <QueryState
          isLoading={range.isLoading}
          error={range.error}
          isEmpty={false}
          onRetry={() => void range.refetch()}
          emptyTitle=""
        >
          <Card onLine pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>판매 수량</Text>
              <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{rangeLabel(from, to)} {s?.qty ?? 0}개</Text>
            </View>

            <View style={{ paddingHorizontal: 15, paddingBottom: 15 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: T.ink, paddingTop: 12, paddingBottom: 2 }}>메뉴 매출</Text>
              {list.map((m) => (
                <View key={m.recipeId ?? m.menuName} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }} numberOfLines={1}>
                    {m.menuName} <Text style={{ color: T.ter }}>×{m.qty}</Text>
                  </Text>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(m.revenue)}원</Text>
                </View>
              ))}
              {list.length === 0 ? (
                <Text style={{ fontSize: 14, color: T.ter, paddingVertical: 16 }}>판매된 메뉴가 없어요</Text>
              ) : null}
              {!showAll && sorted.length > 5 ? (
                <Pressable
                  onPress={() => setShowAll(true)}
                  accessibilityRole="button" accessibilityLabel={`메뉴 ${sorted.length - 5}개 더 보기`}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>더보기 ({sorted.length - 5}개)</Text>
                  <Icon name="chevronDown" size={15} color={T.blue} />
                </Pressable>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: T.line }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.sub2 }}>소계</Text>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink2 }, NUM]}>{won(menuSum)}원</Text>
              </View>

              <Text style={{ fontSize: 14, fontWeight: '800', color: T.ink, paddingTop: 16, paddingBottom: 4 }}>기타 매출</Text>
              {etcItems.map((e, i) => (
                <View key={`${e.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{e.name} <Text style={{ color: T.ter }}>×{e.qty}</Text></Text>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(e.price * e.qty)}원</Text>
                </View>
              ))}
              {etcItems.length === 0 && (s?.etcRevenue ?? 0) > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>기간 합계</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(s?.etcRevenue ?? 0)}원</Text>
                </View>
              ) : null}
              {(s?.etcRevenue ?? 0) === 0 ? (
                <Text style={{ fontSize: 14, color: T.ter, paddingVertical: 12, paddingLeft: 12 }}>기록된 기타 매출이 없어요</Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.sub2 }}>소계</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink2 }, NUM]}>{won(s?.etcRevenue ?? 0)}원</Text>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 15, backgroundColor: T.surface2, borderTopWidth: 1, borderTopColor: T.line }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>매출 합계</Text>
              <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink }, NUM]}>{won(s?.revenue ?? 0)}원</Text>
            </View>
          </Card>
        </QueryState>
      </ScrollView>
    </View>
  );
}
