/**
 * SALES-15 부자재 자세히 (+ SALES-16 부자재별 사용 메뉴 시트).
 * 오늘 사용 부자재 집계 → 부자재 탭 시 메뉴별 차감. 일 손익 상세 '부자재' 행에서 진입.
 * ⚠ 디자인 프로토타입(정적·데모).
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Card, Icon, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };

interface ExItem { name: string; use: string; amt: number; top: string; }
const ITEMS: ExItem[] = [
  { name: '제육볶음 전용 소스팩', use: '38개', amt: 7600, top: '제육볶음' },
  { name: '돈까스 소스 (개별)', use: '5개', amt: 1500, top: '치즈돈까스' },
  { name: '비빔밥 고추장팩', use: '10개', amt: 1200, top: '비빔밥' },
  { name: '계란말이 고명용 김', use: '16개', amt: 800, top: '계란말이' },
  { name: '라면 사리면 토핑', use: '7개', amt: 700, top: '라면' },
];

export default function SalesExtraScreen() {
  const [sel, setSel] = useState<ExItem | null>(null);
  const total = ITEMS.reduce((a, m) => a + m.amt, 0);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="부자재 자세히" onBack={() => safeBack('/sales/day')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28 }}>
        <Card onLine pad={0} style={{ overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>매출 대비</Text>
            <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>1.1%</Text>
          </View>
          <View style={{ paddingHorizontal: 15, paddingBottom: 4 }}>
            {ITEMS.map((m, i) => (
              <Pressable key={m.name} onPress={() => setSel(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingLeft: 12, borderBottomWidth: i < ITEMS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub }}>{m.name} <Text style={{ color: T.ter }}>{m.use}</Text></Text>
                  <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }} numberOfLines={1}>{m.top}</Text>
                </View>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(m.amt)}원</Text>
                <Icon name="chevron" size={15} color={T.line3} />
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 15, backgroundColor: T.surface2, borderTopWidth: 1, borderTopColor: T.line }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>부자재 합계</Text>
            <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink }, NUM]}>{won(total)}원</Text>
          </View>
        </Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 11, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: T.blueTint }}>
          <Icon name="info" size={15} color={T.blue} />
          <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: 20 }}>판매된 메뉴에 설정된 부자재(포장용기 등)를 자동 합산한 금액이에요.</Text>
        </View>
      </ScrollView>

      {/* SALES-16 부자재별 사용 메뉴 */}
      <Sheet visible={sel != null} onClose={() => setSel(null)} title="부자재 지출" sub={sel ? `오늘 ${sel.use} 사용 · 메뉴별 차감` : undefined} height={360}>
        {sel ? (
          <View>
            <Card onLine pad={0} style={{ overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>{sel.top}</Text>
                  <Text style={[{ fontSize: 14, color: T.sub, fontWeight: '600', marginTop: 3 }, NUM]}>1개 × {sel.use.replace('개', '')}</Text>
                </View>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(sel.amt)}원</Text>
              </View>
            </Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingVertical: 14, paddingHorizontal: 15, borderRadius: 12, backgroundColor: T.surface2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>합계</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>총 {sel.use}</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(sel.amt)}원</Text>
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
