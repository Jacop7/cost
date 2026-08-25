/**
 * SALES-20 추가 지출 상세 — 당일 일회성 현금 지출 목록.
 * 하루 장부에 붙어 있는 항목이라 기간 조회에서는 합계만 보여준다.
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { isRevisionConflict, useSalesBusinessDate } from '../businessDay';
import { useSalesDay, useSalesRange, useSaveSale } from '../hooks';
import { rangeLabel } from '../period';
import { DetailSummary } from '../components/ProfitBlocks';

const NUM = { fontVariant: ['tabular-nums' as const] };

export default function SalesExpenseScreen() {
  const params = useLocalSearchParams<{ from?: string; to?: string; date?: string }>();
    /*
   * ⚠ **서버가 정한 장부 날짜**를 쓴다(0125). 앱이 `+09:00` 고정 오프셋으로 직접
   *   계산하면 앱과 DB 가 각자 오늘을 갖게 된다(기획서 §2.1).
   *   못 받았으면 빈 문자열이고, 그동안 조회가 꺼진다 — 잘못된 날의 숫자보다 낫다.
   */
  const serverToday = useSalesBusinessDate() ?? '';
  const today = serverToday;
  const from = params.from ?? params.date ?? today;
  const to = params.to ?? params.date ?? today;
  const isOneDay = from === to;

  const day = useSalesDay(isOneDay ? from : '');
  const range = useSalesRange(from, to, !isOneDay);
  const saveSale = useSaveSale();
  /** 다른 기기가 먼저 저장했을 때 짧게만 알린다(45009 · 0117). 사장님이 할 일은 없다. */
  const [toast, setToast] = useState<string | null>(null);

  const rows = isOneDay ? (day.data?.extraItems ?? []) : [];
  const total = isOneDay ? (day.data?.dailyExtra ?? 0) : (range.data?.summary.dailyExtra ?? 0);

  const remove = (index: number) => {
    if (!isOneDay || !day.data) return;
    const items = day.data.items
      .filter((it) => it.recipeId)
      .map((it) => ({ recipeId: it.recipeId as string, qtyHall: it.qtyHall, qtyDelivery: it.qtyDelivery, qtyTakeout: it.qtyTakeout, qtyWaste: it.qtyWaste }));
    /*
     * ⚠ 판본을 실어 보낸다(0117). 이 화면도 `extra_items` 를 **배열 통째로** 교체하므로,
     *   빼먹으면 다른 기기가 방금 넣은 지출이 조용히 사라진다.
     *   저장하는 곳이 여럿인데 한 곳만 빠져도 그 문으로 뚫린다.
     */
    saveSale.mutate(
      { date: from, items, extraItems: rows.filter((_, i) => i !== index), baseRevision: day.data.revision },
      {
        onError: (e) => {
          /*
           * ⚠ 매출 홈과 **같게** 다룬다. 판본만 보내고 45009 를 기본 오류창으로 띄우면
           *   데이터는 지켜지지만 사장님은 무슨 일인지 모르고, 낡은 목록을 계속 보며
           *   같은 삭제를 반복하게 된다. 다시 받아서 최신 목록을 보여 줘야 끝난다.
           */
          if (isRevisionConflict(e)) {
            void day.refetch();
            setToast('다른 기기에서 판매 내역이 변경됐어요 · 최신 내역을 다시 불러왔어요');
            return;
          }
          Alert.alert('삭제하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');
        },
      },
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
          {/*
        다른 기기가 먼저 저장했다(45009 · 0117). 최신 목록은 이미 다시 받고 있으므로
        사장님이 누를 것이 없다 — 모달로 세우지 않고 짧게만 알린다. 매출 홈과 같은 모양이다.
      */}
      {toast ? (
        <Pressable
          onPress={() => setToast(null)}
          accessibilityRole="button" accessibilityLabel="알림 닫기"
          style={{ position: 'absolute', left: 16, right: 16, bottom: 24, paddingVertical: 13, paddingHorizontal: 15, borderRadius: 12, backgroundColor: 'rgba(25,31,40,0.92)' }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', lineHeight: 20 }}>{toast}</Text>
        </Pressable>
      ) : null}
</View>
  );
}
