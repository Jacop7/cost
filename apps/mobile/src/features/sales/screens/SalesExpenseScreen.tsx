/**
 * SALES-20 추가 지출 상세 — 당일 일회성 현금 지출 목록.
 * 하루 장부에 붙어 있는 항목이라 기간 조회에서는 합계만 보여준다.
 */
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { useSalesDay, useSalesRange, useSaveSale } from '../hooks';
import { rangeLabel, todayBusiness } from '../period';
import { DetailSummary } from '../components/ProfitBlocks';

const NUM = { fontVariant: ['tabular-nums' as const] };

export default function SalesExpenseScreen() {
  const params = useLocalSearchParams<{ from?: string; to?: string; date?: string }>();
  const today = todayBusiness();
  const from = params.from ?? params.date ?? today;
  const to = params.to ?? params.date ?? today;
  const isOneDay = from === to;

  const day = useSalesDay(isOneDay ? from : '');
  const range = useSalesRange(from, to, !isOneDay);
  const saveSale = useSaveSale();

  const rows = isOneDay ? (day.data?.extraItems ?? []) : [];
  const total = isOneDay ? (day.data?.dailyExtra ?? 0) : (range.data?.summary.dailyExtra ?? 0);

  const remove = (index: number) => {
    if (!isOneDay || !day.data) return;
    const items = day.data.items
      .filter((it) => it.recipeId)
      .map((it) => ({ recipeId: it.recipeId as string, qtyHall: it.qtyHall, qtyDelivery: it.qtyDelivery, qtyTakeout: it.qtyTakeout, qtyWaste: it.qtyWaste }));
    saveSale.mutate(
      { date: from, items, extraItems: rows.filter((_, i) => i !== index) },
      { onError: (e) => Alert.alert('삭제하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요') },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="추가 지출" onBack={() => safeBack(`/sales/day?date=${to}`)} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28 }}>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 11 }}>
          <DetailSummary rows={[['영업일', rangeLabel(from, to)]]} />
        </Card>

        <QueryState
          isLoading={isOneDay ? day.isLoading : range.isLoading}
          error={isOneDay ? day.error : range.error}
          isEmpty={total === 0}
          onRetry={() => { void day.refetch(); void range.refetch(); }}
          emptyTitle="기록된 추가 지출이 없어요"
          emptyHint="매출관리 홈의 ‘지출 추가’로 등록할 수 있어요"
        >
          <Card onLine pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ paddingHorizontal: 15, paddingBottom: 15 }}>
              {rows.map((r, i) => (
                <View key={`${r.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{r.name}</Text>
                    {r.memo ? <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600', marginTop: 3 }}>{r.memo}</Text> : null}
                  </View>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink, marginRight: 12 }, NUM]}>{won(r.amount)}원</Text>
                  <Pressable onPress={() => remove(i)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${r.name} 삭제`}>
                    <Icon name="close" size={16} color={T.ter} />
                  </Pressable>
                </View>
              ))}
              {!isOneDay ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>기간 합계</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(total)}원</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: T.line }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>합계</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(total)}원</Text>
                </View>
              )}
            </View>
          </Card>
        </QueryState>

      </ScrollView>
    </View>
  );
}
