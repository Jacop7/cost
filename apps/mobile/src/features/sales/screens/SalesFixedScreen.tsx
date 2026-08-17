/**
 * SALES-17 일 고정지출 자세히 — 월 고정지출 ÷ 30일 일배분. 항목 탭 시 채널별 배분 금액.
 * 일 손익 상세 '고정 지출' 행에서 진입. ⚠ 디자인 프로토타입(정적·데모).
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Card, Icon } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };

interface FItem { n: string; a: number; p: string; split: [string, number][]; }
interface FGroup { name: string; items: FItem[]; sub: [number, string]; }
const GROUPS: FGroup[] = [
  { name: '인건비', items: [{ n: '월 인건비', a: 160000, p: '15.0%', split: [['매장 30%', 48000], ['배달 50%', 80000], ['포장 20%', 32000]] }], sub: [160000, '15.0%'] },
  { name: '플랫폼 수수료', items: [{ n: '배민', a: 55000, p: '5.2%', split: [['배달 100%', 55000]] }, { n: '쿠팡이츠', a: 32400, p: '3.0%', split: [['배달 100%', 32400]] }], sub: [87400, '8.2%'] },
  { name: '포장비', items: [{ n: '중대용기', a: 7500, p: '0.7%', split: [['배달 70%', 5250], ['포장 30%', 2250]] }, { n: '소용기', a: 5200, p: '0.5%', split: [['배달 70%', 3640], ['포장 30%', 1560]] }], sub: [12700, '1.2%'] },
  { name: '배달/배송 (대행)', items: [{ n: '바로고', a: 21500, p: '2.0%', split: [['배달 100%', 21500]] }], sub: [21500, '2.0%'] },
  { name: '광고/홍보', items: [{ n: '인스타 광고', a: 16100, p: '1.5%', split: [['매장 30%', 4830], ['배달 50%', 8050], ['포장 20%', 3220]] }], sub: [16100, '1.5%'] },
];
const TOTAL = GROUPS.reduce((a, g) => a + g.sub[0], 0);

export default function SalesFixedScreen() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="고정 지출" onBack={() => safeBack('/sales/day')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28, gap: 11 }}>
        {GROUPS.map((g, gi) => (
          <Card key={g.name} pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>{g.name}</Text>
            </View>
            <View style={{ paddingHorizontal: 15, paddingBottom: 15 }}>
              {g.items.map((it, i) => {
                const k = `${gi}-${i}`;
                const isOpen = open[k];
                return (
                  <View key={it.n}>
                    <Pressable onPress={() => toggle(k)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>{it.n}</Text>
                      <View style={{ alignItems: 'flex-end', marginRight: 6 }}>
                        <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(it.a)}원</Text>
                        <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>{it.p}</Text>
                      </View>
                      <View style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>
                        <Icon name="chevronDown" size={16} color={T.ter} />
                      </View>
                    </Pressable>
                    {isOpen ? (
                      <View style={{ backgroundColor: T.surface2, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 13, marginVertical: 8 }}>
                        {it.split.map(([sn, sv]) => (
                          <View key={sn} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
                            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub }}>{sn}</Text>
                            <Text style={[{ fontSize: 14, fontWeight: '700', color: T.ink2 }, NUM]}>{won(sv)}원</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 10 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>소계</Text>
                <View style={{ alignItems: 'flex-end', marginRight: 22 }}>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(g.sub[0])}원</Text>
                  <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: 2 }, NUM]}>{g.sub[1]}</Text>
                </View>
              </View>
            </View>
          </Card>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 16, borderRadius: 12, backgroundColor: T.surface2 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink2 }}>고정 지출 합계</Text>
          <View style={{ flex: 1 }} />
          <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink, marginRight: 10 }, NUM]}>{won(TOTAL)}원</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>31.3%</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blueLine }}>
          <Icon name="info" size={15} color={T.blue} />
          <Text style={{ flex: 1, fontSize: 14, color: T.blue, fontWeight: '600', lineHeight: 20 }}>항목을 누르면 매장·배달·포장 채널별 배분 금액을 볼 수 있어요.</Text>
        </View>
      </ScrollView>
    </View>
  );
}
