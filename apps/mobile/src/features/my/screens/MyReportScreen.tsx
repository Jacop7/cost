/**
 * MY-07 월 손익 리포트 — 월 순이익 추이 + 매출 구성 도넛(순이익/고정/재료). ⚠ 디자인 프로토타입(추정·데모).
 */
import { Dimensions, ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Card, Donut, Icon, TrendChart } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { MY_COMMON, MY_REPORT_DONUT, MY_REPORT_MONTHS, MY_REPORT_TREND } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };
const CW = Dimensions.get('window').width - 68; // 스크롤 16*2 + 카드 pad 18*2

export default function MyReportScreen() {
  const c = MY_COMMON;
  const legend: [string, string, string, string][] = [
    ['순이익', won(c.netProfit), '39.9%', T.green],
    ['고정 지출', won(c.total), '31.3%', '#7A8694'],
    ['재료비', won(c.material), '28.8%', '#A4AEB8'],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="월 손익 리포트" onBack={() => safeBack('/my')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28, gap: 11 }}>
        {/* 순이익 추이 */}
        <Card pad={18}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter }}>2026년 6월 순이익 (추정)</Text>
            <Badge tone="green" sm>▲ 전월 +0.9%</Badge>
          </View>
          <Text style={[{ fontSize: 22, fontWeight: '800', color: T.green, letterSpacing: -0.6 }, NUM]}>{won(c.netProfit)}<Text style={{ fontSize: 16 }}>원</Text></Text>
          <Text style={{ fontSize: 14, color: T.sub2, marginTop: 3, fontWeight: '600' }}>순이익률 {c.netRate}%</Text>
          <View style={{ marginTop: 8 }}>
            <TrendChart points={MY_REPORT_TREND} w={CW} h={80} color={T.green} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            {MY_REPORT_MONTHS.map((m) => <Text key={m} style={{ fontSize: 13, color: T.ter }}>{m}</Text>)}
          </View>
        </Card>

        {/* 매출 구성 도넛 */}
        <Card pad={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Donut size={128} thick={20} segments={MY_REPORT_DONUT} centerTop="순이익" centerMain="39.9%" mainColor={T.green} />
          <View style={{ flex: 1 }}>
            <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '700', marginBottom: 8 }, NUM]}>매출 {won(c.sales)}원 구성</Text>
            {legend.map(([l, , p, col], i) => (
              <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 }}>
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: col }} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: i === 0 ? T.green : T.sub2 }}>{l}</Text>
                <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub }, NUM]}>{p}</Text>
              </View>
            ))}
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: 7, marginHorizontal: 4, alignItems: 'flex-start' }}>
          <Icon name="info" size={14} color={T.ter} />
          <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>'추정' — 재료비는 입고 기준(소진 기준 아님), 부가세·세무 조정은 미반영이에요.</Text>
        </View>
      </ScrollView>
    </View>
  );
}
