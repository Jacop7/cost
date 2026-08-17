/**
 * SALES-13 재료 원가 자세히 (+ SALES-14 재료별 사용 메뉴 시트).
 * 오늘 사용 식재료 집계 → 식재료 탭 시 메뉴별 차감 내역. 일 손익 상세 '재료 원가' 행에서 진입.
 * ⚠ 디자인 프로토타입(정적·데모).
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Card, Icon, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };

interface MatItem { name: string; use: string; amt: number; top: string; more: number; }
const ITEMS: MatItem[] = [
  { name: '돼지고기 앞다리', use: '12.4kg', amt: 92400, top: '제육볶음 · 제육덮밥', more: 0 },
  { name: '국산 김치', use: '9.8kg', amt: 41160, top: '김치찌개 · 제육볶음', more: 2 },
  { name: '두부', use: '46개', amt: 23000, top: '된장찌개 · 순두부찌개', more: 1 },
  { name: '계란', use: '184개', amt: 22080, top: '계란말이 · 비빔밥', more: 4 },
  { name: '양파', use: '14.2kg', amt: 17040, top: '제육볶음 · 된장찌개', more: 6 },
  { name: '대파', use: '6.1kg', amt: 12200, top: '제육볶음 · 김치찌개', more: 5 },
  { name: '고춧가루', use: '2.4kg', amt: 9600, top: '제육볶음 · 김치찌개', more: 1 },
  { name: '쌀', use: '11kg', amt: 8800, top: '공기밥 · 비빔밥', more: 3 },
  { name: '돈까스육', use: '3.2kg', amt: 7360, top: '치즈돈까스', more: 0 },
  { name: '그 외 양념·부재료', use: '—', amt: 6260, top: '전 메뉴 공통', more: 0 },
];
// SALES-14 데모 — 돼지고기 앞다리 메뉴별 차감
const USE_ROWS: [string, string, number][] = [
  ['제육볶음', '200g × 38', 41800],
  ['제육덮밥', '180g × 12', 19872],
  ['돼지고기볶음(점심특선)', '160g × 86', 24640],
  ['두루치기', '170g × 19', 6088],
];

export default function SalesMaterialScreen() {
  const [showAll, setShowAll] = useState(false);
  const [sel, setSel] = useState<MatItem | null>(null);
  const total = ITEMS.reduce((a, m) => a + m.amt, 0);
  const list = showAll ? ITEMS : ITEMS.slice(0, 5);
  const useTotal = USE_ROWS.reduce((a, r) => a + r[2], 0);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="재료 원가 자세히" onBack={() => safeBack('/sales/day')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28 }}>
        <Card onLine pad={0} style={{ overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>매출 원가율</Text>
            <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>17.4%</Text>
          </View>
          <View style={{ paddingHorizontal: 15, paddingBottom: 15 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: T.ink, paddingTop: 12, paddingBottom: 2 }}>오늘 사용 식재료</Text>
            {list.map((m) => (
              <Pressable key={m.name} onPress={() => setSel(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub }}>{m.name} <Text style={{ color: T.ter }}>{m.use !== '—' ? m.use : ''}</Text></Text>
                  <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }} numberOfLines={1}>{m.top}{m.more > 0 ? ` 외 ${m.more}개` : ''}</Text>
                </View>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(m.amt)}원</Text>
                <Icon name="chevron" size={15} color={T.line3} />
              </Pressable>
            ))}
            {!showAll && ITEMS.length > 5 ? (
              <Pressable onPress={() => setShowAll(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>더보기 ({ITEMS.length - 5}개)</Text>
                <Icon name="chevronDown" size={15} color={T.blue} />
              </Pressable>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 15, backgroundColor: T.surface2, borderTopWidth: 1, borderTopColor: T.line }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>재료 원가 합계</Text>
            <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink }, NUM]}>{won(total)}원</Text>
          </View>
        </Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 11, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: T.blueTint }}>
          <Icon name="info" size={15} color={T.blue} />
          <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: 20 }}>판매된 메뉴의 레시피에서 식재료 사용량을 자동 합산한 금액이에요.</Text>
        </View>
      </ScrollView>

      {/* SALES-14 재료별 사용 메뉴 */}
      <Sheet visible={sel != null} onClose={() => setSel(null)} title={sel?.name} sub={sel ? `오늘 ${sel.use} 사용 · 메뉴별 차감` : undefined} height={460}>
        {sel ? (
          <View>
            <Card onLine pad={0} style={{ overflow: 'hidden' }}>
              {USE_ROWS.map(([n, u, a], i) => (
                <View key={n} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, borderBottomWidth: i < USE_ROWS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>{n}</Text>
                    <Text style={[{ fontSize: 14, color: T.sub, fontWeight: '600', marginTop: 3 }, NUM]}>{u}</Text>
                  </View>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(a)}원</Text>
                </View>
              ))}
            </Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingVertical: 14, paddingHorizontal: 15, borderRadius: 12, backgroundColor: T.surface2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>합계</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>총 {sel.use}</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(useTotal)}원</Text>
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
