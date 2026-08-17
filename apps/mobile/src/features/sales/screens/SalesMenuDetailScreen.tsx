/**
 * SALES-09 오늘 메뉴 손익 상세 — 메뉴 1개 손익(RCP-02 포맷) + 오늘 채널 구성.
 * SALES-08 메뉴별 손익 팝업의 '자세히 보기'로 진입. ⚠ 디자인 프로토타입(정적·제육볶음).
 */
import { ScrollView, Text, View } from 'react-native';
import { AppHeader, Card, Donut } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { SALES } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };

// 제육볶음(오늘 판매 메뉴) 1개 기준 손익 — 프로토타입 고정값.
const PRICE = 12000;
const MATERIAL = 2832;
const EXTRA = 300;
const FIXED = 3760;
const TAX = 1091;
const PROFIT = PRICE - MATERIAL - EXTRA - FIXED - TAX; // 4,017
const RATE = Math.round((PROFIT / PRICE) * 1000) / 10; // 33.5

const MAT_LINES: [string, string, string, string, string][] = [
  ['돼지고기 앞다리', '200g', '2,200원', '11원/g', '18.3%'],
  ['양념장', '50g', '347원', '6.9원/g', '2.9%'],
  ['양파', '68g', '144원', '2.1원/g', '1.2%'],
  ['대파', '30g', '141원', '4.71원/g', '1.2%'],
];
const FIXED_LINES: [string, number, string][] = [
  ['인건비', 1800, '15.0%'],
  ['플랫폼 수수료', 900, '7.5%'],
  ['포장비', 360, '3.0%'],
  ['배달/배송', 480, '4.0%'],
  ['광고/홍보', 220, '1.8%'],
];

function SecHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>{title}</Text>
      {sub ? <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}>{sub}</Text> : null}
    </View>
  );
}

export default function SalesMenuDetailScreen() {
  const m = SALES.menu[0]!;
  const pctQ = (q: number) => Math.round((q / m.qty) * 100);
  const chMix = [
    { label: '매장', qty: m.hall, value: pctQ(m.hall), color: T.blue },
    { label: '배달', qty: m.delivery, value: pctQ(m.delivery), color: '#7A8694' },
    { label: '포장', qty: m.takeout, value: pctQ(m.takeout), color: '#C5CCD3' },
  ];
  const donutSeg = [
    { label: '재료', value: 23.6, color: '#8B95A1' },
    { label: '부자재', value: 2.5, color: '#CDD3DA' },
    { label: '고정 지출', value: 31.3, color: '#5B6573' },
    { label: '세금', value: 9.1, color: '#B0B8C1' },
    { label: '순이익', value: RATE, color: T.red },
  ];
  const legend: [string, number, string, string][] = [
    ['재료', MATERIAL, '23.6%', '#8B95A1'],
    ['부자재', EXTRA, '2.5%', '#CDD3DA'],
    ['고정 지출', FIXED, '31.3%', '#5B6573'],
    ['세금', TAX, '9.1%', '#B0B8C1'],
    ['순이익', PROFIT, `${RATE}%`, T.red],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="오늘 메뉴 손익" onBack={() => safeBack('/sales/day')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28, gap: 11 }}>
        {/* 메뉴 요약 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{m.name}</Text>
          </View>
          {([['판매가', `${won(PRICE)}원`], ['오늘 판매량', `${m.qty}개`], ['목표 순이익률', '40.0%'], ['현재 순이익률', `${RATE}%`]] as const).map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{k}</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: k === '현재 순이익률' ? (RATE >= 40 ? T.green : T.red) : T.ink }, NUM]}>{v}</Text>
            </View>
          ))}
        </Card>

        {/* 순이익률 도넛 */}
        <Card pad={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Donut size={112} thick={17} mainSize={18} mainColor={T.red} centerTop="순이익률" centerMain={`${RATE}%`} segments={donutSeg} />
          <View style={{ flex: 1 }}>
            {legend.map(([l, amt, p, c]) => {
              const accent = l === '순이익';
              return (
                <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 }}>
                  <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c }} />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: accent ? '800' : '600', color: accent ? T.red : T.sub2 }}>{l}</Text>
                  <Text style={[{ fontSize: 14, fontWeight: '800', color: accent ? T.red : T.ink, marginRight: 8 }, NUM]}>{won(amt)}원</Text>
                  <Text style={[{ width: 40, textAlign: 'right', fontSize: 14, fontWeight: '600', color: accent ? T.red : T.ter }, NUM]}>{p}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* 채널 구성 도넛 */}
        <Card pad={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Donut size={120} thick={19} segments={chMix} centerTop="오늘 판매" centerMain={`${m.qty}개`} mainSize={20} />
          <View style={{ flex: 1 }}>
            <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '700', marginBottom: 8 }, NUM]}>매출 {won(PRICE * m.qty)}원 · 채널 구성</Text>
            {chMix.map((c) => (
              <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 }}>
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c.color }} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub2 }}>{c.label}</Text>
                <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub, marginRight: 8 }, NUM]}>{c.qty}개</Text>
                <Text style={[{ width: 34, textAlign: 'right', fontSize: 14, fontWeight: '700', color: T.ter }, NUM]}>{c.value}%</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* 재료 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <SecHead title="재료" />
          <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
            {MAT_LINES.map(([n, qq, c, u, p], i) => (
              <View key={n} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < MAT_LINES.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{n}</Text>
                  <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>{u}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{c}</Text>
                  <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>{qq} / {p}</Text>
                </View>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>소계</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(MATERIAL)}원</Text>
                <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: 2 }, NUM]}>23.6%</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* 부자재 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <SecHead title="부자재" sub="(이 메뉴에만 들어가는 부자재)" />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>특수 포장용기</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(EXTRA)}원</Text>
              <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>2.5%</Text>
            </View>
          </View>
        </Card>

        {/* 고정 지출 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <SecHead title="고정 지출" sub="(개당 환산)" />
          <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
            {FIXED_LINES.map(([n, a, p], i) => (
              <View key={n} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: i < FIXED_LINES.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>{n}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(a)}원</Text>
                  <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>{p}</Text>
                </View>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>소계</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(FIXED)}원</Text>
                <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: 2 }, NUM]}>31.3%</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* 세금 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <SecHead title="세금" />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>부가세</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(TAX)}원</Text>
              <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>9.1%</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
