/**
 * SALES-12 매출 자세히 — 메뉴 매출(TOP + 더보기) + 기타 매출 + 매출 합계.
 * 일 손익 상세의 '매출' 행에서 진입. ⚠ 디자인 프로토타입(정적·데모).
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Card, Icon } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { SALES } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };

export default function SalesRevenueScreen() {
  const s = SALES;
  const [showAll, setShowAll] = useState(false);
  const sorted = [...s.menu].sort((a, b) => b.price * b.qty - a.price * a.qty);
  const menuSum = sorted.reduce((a, m) => a + m.price * m.qty, 0);
  const total = menuSum + s.etc;
  const qty = s.menu.reduce((a, m) => a + m.qty, 0);
  const list = showAll ? sorted : sorted.slice(0, 5);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="매출 자세히" onBack={() => safeBack('/sales/day')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28 }}>
        <Card onLine pad={0} style={{ overflow: 'hidden' }}>
          {/* 판매 수량 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>판매 수량</Text>
            <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>오늘 {qty}개</Text>
          </View>
          <View style={{ paddingHorizontal: 15, paddingBottom: 15 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: T.ink, paddingTop: 12, paddingBottom: 2 }}>메뉴 매출</Text>
            {list.map((m) => (
              <View key={m.name} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{m.name} <Text style={{ color: T.ter }}>×{m.qty}</Text></Text>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(m.price * m.qty)}원</Text>
              </View>
            ))}
            {!showAll && sorted.length > 5 ? (
              <Pressable onPress={() => setShowAll(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>더보기 ({sorted.length - 5}개)</Text>
                <Icon name="chevronDown" size={15} color={T.blue} />
              </Pressable>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: T.line }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.sub2 }}>소계</Text>
              <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink2 }, NUM]}>{won(menuSum)}원</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '800', color: T.ink, paddingTop: 16, paddingBottom: 4 }}>기타 매출</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>음료 <Text style={{ color: T.ter }}>×14</Text></Text>
              <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(s.etc)}원</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.sub2 }}>소계</Text>
              <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink2 }, NUM]}>{won(s.etc)}원</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 15, backgroundColor: T.surface2, borderTopWidth: 1, borderTopColor: T.line }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>매출 합계</Text>
            <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink }, NUM]}>{won(total)}원</Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
