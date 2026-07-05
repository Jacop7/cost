/**
 * RCP-16 손익 변동 상세 — 판매가 변경 시점별 손익 스냅샷(원장). 행 탭 → 손익표 시트.
 * ⚠ 디자인 프로토타입(데모). 실데이터는 Supabase profit_trends 스냅샷으로 교체.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Card, Icon, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };

interface Snap {
  date: string;
  price: number;
  profit: number;
  rate: string;
  now?: boolean;
  rows: [string, number, string][]; // [항목, 금액, 비율]
}
const HISTORY: Snap[] = [
  { date: '2026.06.12 14:20', price: 9000, profit: 2111, rate: '23.4%', now: true, rows: [['재료', 3001, '33.3%'], ['부자재', 250, '2.7%'], ['고정 지출', 2820, '31.3%'], ['세금', 818, '9.0%']] },
  { date: '2026.05.28 11:05', price: 9000, profit: 2259, rate: '25.1%', rows: [['재료', 2853, '31.7%'], ['부자재', 250, '2.7%'], ['고정 지출', 2820, '31.3%'], ['세금', 818, '9.0%']] },
  { date: '2026.04.15 09:40', price: 8500, profit: 1870, rate: '22.0%', rows: [['재료', 2853, '33.6%'], ['부자재', 250, '2.9%'], ['고정 지출', 2655, '31.2%'], ['세금', 772, '9.1%']] },
  { date: '2026.03.02 17:30', price: 8500, profit: 1683, rate: '19.8%', rows: [['재료', 3040, '35.8%'], ['부자재', 250, '2.9%'], ['고정 지출', 2655, '31.2%'], ['세금', 772, '9.1%']] },
];

export default function ProfitHistoryScreen() {
  const [open, setOpen] = useState<number | null>(null);
  const e = open != null ? HISTORY[open] : null;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="손익 변동" onBack={() => safeBack('/recipes')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        {/* 기간 라벨 */}
        <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: T.line }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink2 }}>최근 3개월</Text>
        </View>

        {HISTORY.map((r, i) => (
          <Pressable
            key={i}
            onPress={() => setOpen(i)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 14, paddingHorizontal: 22, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.line2 }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600' }, NUM]}>{r.date}</Text>
                {r.now ? <Badge tone="blue" sm>현재 적용 중</Badge> : null}
              </View>
              <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>판매가 {won(r.price)}원</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink2 }, NUM]}>순이익 {won(r.profit)}원</Text>
              <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 4, fontWeight: '700' }, NUM]}>{r.rate}</Text>
            </View>
            <Icon name="chevron" size={16} color={T.line3} />
          </Pressable>
        ))}
      </ScrollView>

      {/* 손익표 시트 */}
      <Sheet visible={e != null} onClose={() => setOpen(null)} title="손익 상세" sub={e ? `${e.date} 기준` : undefined} height={480}>
        {e ? (
          <Card pad={0} onLine style={{ overflow: 'hidden' }}>
            {/* 판매가 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>판매가</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 16 }, NUM]}>{won(e.price)}원</Text>
              <Text style={{ width: 48, textAlign: 'right', fontSize: 14, fontWeight: '700', color: T.sub2 }}>100%</Text>
            </View>
            {/* 비용 행 */}
            {e.rows.map(([label, amt, pctv], i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{label}</Text>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink2, marginRight: 16 }, NUM]}>{won(amt)}원</Text>
                <Text style={[{ width: 48, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.sub2 }, NUM]}>{pctv}</Text>
              </View>
            ))}
            {/* 순이익 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: T.surface2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>순이익</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.red, marginRight: 16 }, NUM]}>{won(e.profit)}원</Text>
              <Text style={[{ width: 48, textAlign: 'right', fontSize: 14, fontWeight: '800', color: T.red }, NUM]}>{e.rate}</Text>
            </View>
          </Card>
        ) : null}
      </Sheet>
    </View>
  );
}
