/**
 * SALES-10 일 손익 자세히 — 매출(메뉴 TOP5 + 기타) + 지출(항목별 하위 내역) + 순이익.
 * 일 손익 상세 '일 손익 계산 자세히 보기'로 진입. ⚠ 디자인 프로토타입(정적·데모).
 */
import { ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Card } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { SALES } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };

export default function SalesDayFullScreen() {
  const s = SALES;
  const pctOf = (v: number) => Math.round((v / s.revenue) * 1000) / 10;
  const qty = s.menu.reduce((a, m) => a + m.qty, 0);
  const top = [...s.menu].sort((a, b) => b.price * b.qty - a.price * a.qty).slice(0, 5);
  const topSum = top.reduce((a, m) => a + m.price * m.qty, 0);
  const marginPct = pctOf(s.profit);
  const met = marginPct >= 20;
  const PR = met ? T.green : T.amberText;

  const costs: { n: string; v: number; sub?: [string, number][] }[] = [
    { n: '(−) 재료 원가', v: s.material },
    { n: '(−) 폐기 손실', v: s.waste, sub: [['제육볶음 4개', 11328], ['두부 6개', 6672]] },
    { n: '(−) 부자재', v: s.extra, sub: [['포장용기 외', 15000]] },
    { n: '(−) 고정 지출', v: s.fixed, sub: [['인건·임대 외', 207700], ['플랫폼 수수료', 90000]] },
    { n: '(−) 추가 지출', v: s.dailyExtra, sub: [['얼음 구매', 12000]] },
    { n: '(−) 세금', v: s.tax },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="6월 18일 손익 자세히" onBack={() => safeBack('/sales/day')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28 }}>
        <Card onLine pad={0} style={{ overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: 15, paddingBottom: 15 }}>
            {/* 판매 수량 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>판매 수량</Text>
              <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>오늘 {qty}개</Text>
            </View>
            {/* 매출 — TOP5 + 기타 */}
            <Text style={{ fontSize: 14, fontWeight: '800', color: T.ink, paddingTop: 12, paddingBottom: 6 }}>매출</Text>
            {top.map((m) => (
              <View key={m.name} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub }}>{m.name} <Text style={{ color: T.ter }}>×{m.qty}</Text></Text>
                <Text style={[{ fontSize: 14, fontWeight: '700', color: T.ink }, NUM]}>{won(m.price * m.qty)}원</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub }}>그 외 메뉴 · 기타 매출</Text>
              <Text style={[{ fontSize: 14, fontWeight: '700', color: T.ink }, NUM]}>{won(s.revenue - topSum)}원</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>매출 합계</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 16 }, NUM]}>{won(s.revenue)}원</Text>
              <Text style={{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.ter }}>100%</Text>
            </View>
            {/* 지출 항목 */}
            {costs.map((c) => (
              <View key={c.n}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{c.n}</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ter, marginRight: 16 }, NUM]}>{won(c.v)}원</Text>
                  <Text style={[{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.ter }, NUM]}>{pctOf(c.v)}%</Text>
                </View>
                {c.sub?.map(([sn, sv]) => (
                  <View key={sn} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.ter }}>· {sn}</Text>
                    <Text style={[{ fontSize: 14, fontWeight: '600', color: T.sub2 }, NUM]}>{won(sv)}원</Text>
                  </View>
                ))}
              </View>
            ))}
            {/* 순이익 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 13 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 8 }}>순이익</Text>
              <Badge tone={met ? 'green' : 'amber'} sm>{met ? '목표 달성' : '목표 미달'}</Badge>
              <View style={{ flex: 1 }} />
              <Text style={[{ fontSize: 16, fontWeight: '800', color: PR, marginRight: 16 }, NUM]}>{won(s.profit)}원</Text>
              <Text style={[{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '800', color: PR }, NUM]}>{marginPct}%</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
