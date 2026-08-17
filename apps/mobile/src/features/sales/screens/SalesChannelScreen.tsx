/**
 * SALES-18 채널별 손익 — 매장·배달·포장 분할 손익. 일 손익 상세 '채널 구성 자세히 보기'로 진입.
 * 채널 직접비는 해당 채널에, 공유비(인건·임대 등)는 매출 비중으로 배분. ⚠ 디자인 프로토타입(정적·데모).
 */
import { ScrollView, Text, View } from 'react-native';
import { AppHeader, Card, Icon } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };

interface Chan { name: string; qty: number; rev: number; material: number; waste: number; extra: number; fixed: number; daily: number; tax: number; color: string; }
const CHANS: Chan[] = [
  { name: '매장', qty: 95, rev: 598500, material: 151100, waste: 11300, extra: 9500, fixed: 110900, daily: 7600, tax: 54400, color: '#3182F6' },
  { name: '배달', qty: 42, rev: 266000, material: 67200, waste: 5000, extra: 4200, fixed: 167100, daily: 3400, tax: 24200, color: '#7A8694' },
  { name: '포장', qty: 14, rev: 85500, material: 21600, waste: 1700, extra: 1300, fixed: 19700, daily: 1000, tax: 7800, color: '#C5CCD3' },
];

export default function SalesChannelScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="채널별 손익" onBack={() => safeBack('/sales/day')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28, gap: 11 }}>
        {CHANS.map((c) => {
          const profit = c.rev - c.material - c.waste - c.extra - c.fixed - c.daily - c.tax;
          const rate = Math.round((profit / c.rev) * 1000) / 10;
          const neg = profit < 0;
          const PR = neg ? T.red : T.green;
          const p = (v: number) => Math.round((v / c.rev) * 1000) / 10;
          const costs: [string, number][] = [
            ['(−) 재료 원가', c.material], ['(−) 폐기 손실', c.waste], ['(−) 부자재', c.extra],
            ['(−) 고정 지출', c.fixed], ['(−) 추가 지출', c.daily], ['(−) 세금', c.tax],
          ];
          return (
            <Card key={c.name} pad={0} style={{ overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.color }} />
                <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>{c.name}</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: T.ter }}>판매가 대비 %</Text>
              </View>
              <View style={{ paddingHorizontal: 15, paddingBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>판매 수량</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{c.qty}개</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>매출</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(c.rev)}원</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }}>100%</Text>
                  </View>
                </View>
                {costs.map(([n, v]) => (
                  <View key={n} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{n}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ter }, NUM]}>{won(v)}원</Text>
                      <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>{p(v)}%</Text>
                    </View>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>순이익</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[{ fontSize: 16, fontWeight: '800', color: PR }, NUM]}>{neg ? '−' : ''}{won(Math.abs(profit))}원</Text>
                    <Text style={[{ fontSize: 14, fontWeight: '800', color: PR, marginTop: 2 }, NUM]}>{rate}%</Text>
                  </View>
                </View>
              </View>
            </Card>
          );
        })}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blueLine }}>
          <Icon name="info" size={15} color={T.blue} />
          <Text style={{ flex: 1, fontSize: 14, color: T.blue, fontWeight: '600', lineHeight: 20 }}>수수료·배달대행·포장비 등 채널에 직접 드는 비용은 해당 채널에, 인건비·임대 등 공유 비용은 매출 비중으로 자동 배분해요.</Text>
        </View>
      </ScrollView>
    </View>
  );
}
