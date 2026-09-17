import { ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Button, Card, QueryState } from '@/components/kit';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { useSalesBusinessDate } from '@/features/business-day/businessDay';
import { rangeLabel } from '@/lib/date';
import { safeBack } from '@/lib/nav';
import { COLOR, LAYOUT, T, space, won } from '@/theme/tokens';
import { DetailSummary } from '../components/ProfitBlocks';
import { useSalesDay, useSalesRange } from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 추가 지출은 읽기 상세만 제공하고 모든 변경은 날짜별 서버 초안에서 수행한다. */
export default function SalesExpenseReadScreen() {
  return (
    <BusinessDateGate source={useSalesBusinessDate()} title="추가 지출">
      {today => <SalesExpenseReadBody today={today} />}
    </BusinessDateGate>
  );
}

function SalesExpenseReadBody({ today }: { today: string }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; to?: string; date?: string }>();
  const from = params.from ?? params.date ?? today;
  const to = params.to ?? params.date ?? today;
  const oneDay = from === to;
  const day = useSalesDay(oneDay ? from : '');
  const range = useSalesRange(from, to, !oneDay);
  const rows = oneDay ? (day.data?.extraItems ?? []) : [];
  const total = oneDay ? (day.data?.dailyExtra ?? 0) : (range.data?.summary.dailyExtra ?? 0);
  const canEdit = oneDay && Boolean(day.data?.hasLedger && day.data.editable) && !day.error;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="추가 지출" onBack={() => safeBack(`/sales/day?date=${to}` as Href)}
        right={canEdit ? <Button kind="ghost" onPress={() => router.push(`/sales/write?date=${from}` as Href)}>수정</Button> : undefined} />
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: LAYOUT.scroll.start, paddingBottom: LAYOUT.scroll.end }}>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: space.md }}>
          <DetailSummary rows={[[oneDay ? '영업일' : '기간', rangeLabel(from, to)]]} />
        </Card>
        <QueryState isLoading={oneDay ? day.isLoading : range.isLoading}
          error={oneDay ? day.error : range.error} isEmpty={total === 0}
          onRetry={() => { void day.refetch(); void range.refetch(); }}
          emptyTitle="기록된 추가 지출이 없어요" emptyHint={canEdit ? '수정에서 추가할 수 있어요' : undefined}>
          <Card onLine pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ paddingHorizontal: space.md }}>
              {rows.map((row, index) => (
                <View key={`${row.name}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                  borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{row.name}</Text>
                    {row.memo ? <Text style={{ marginTop: space.xs, fontSize: 14, fontWeight: '600', color: COLOR.text.tertiary }}>{row.memo}</Text> : null}
                  </View>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(row.amount)}원</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>합계</Text>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(total)}원</Text>
              </View>
            </View>
          </Card>
        </QueryState>
      </ScrollView>
    </View>
  );
}
