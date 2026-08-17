/**
 * SALES-20 추가 지출 상세 — 당일 일회성 현금 지출 목록. 일 손익 상세 '추가 지출' 행에서 진입.
 * ⚠ 디자인 프로토타입(정적·데모).
 */
import { ScrollView, Text, View } from 'react-native';
import { AppHeader, Card, Icon } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };
const ROWS: [string, string, number][] = [['얼음 구매', '편의점 · 현금', 12000]];
const TOTAL = ROWS.reduce((a, r) => a + r[2], 0);

export default function SalesExpenseScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="추가 지출" onBack={() => safeBack('/sales/day')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28 }}>
        <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600', marginHorizontal: 2, marginBottom: 10 }}>6월 18일 · 당일 일회성 현금 지출</Text>
        <Card onLine pad={0} style={{ overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: 15, paddingBottom: 15 }}>
            {ROWS.map(([n, memo, a], i) => (
              <View key={n} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: i < ROWS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{n}</Text>
                  <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600', marginTop: 3 }}>{memo}</Text>
                </View>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(a)}원</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: T.line }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>합계</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(TOTAL)}원</Text>
            </View>
          </View>
        </Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 11, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blueLine }}>
          <Icon name="info" size={15} color={T.blue} />
          <Text style={{ flex: 1, fontSize: 14, color: T.blue, fontWeight: '600', lineHeight: 20 }}>그날 한 번 발생한 현금 지출이에요. 고정 지출에는 반영되지 않고 오늘 손익에서만 차감돼요.</Text>
        </View>
      </ScrollView>
    </View>
  );
}
