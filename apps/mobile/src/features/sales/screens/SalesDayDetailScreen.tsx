/**
 * SALES-03 일 손익 상세 — 채널 구성 도넛 + 일 손익 계산(브레이크다운) + 메뉴별 판매량.
 * 손익 = 매출 − (세금+재료원가+부자재+고정지출+추가지출+폐기손실). ⚠ 디자인 프로토타입(정적·데모).
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Badge, Card, Donut, Icon, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { SALES, SaleMenu } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };

function SecLabel({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2, marginTop: 2 }}>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.sub }}>{title}</Text>
      <Pressable onPress={onPress} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>자세히 보기</Text>
        <Icon name="chevron" size={15} color={T.blue} />
      </Pressable>
    </View>
  );
}

export default function SalesDayDetailScreen() {
  const router = useRouter();
  const s = SALES;
  const [showAll, setShowAll] = useState(false);
  const [sel, setSel] = useState<SaleMenu | null>(null); // 메뉴별 손익 팝업
  const pctOf = (v: number) => Math.round((v / s.revenue) * 1000) / 10;
  const qty = s.menu.reduce((a, m) => a + m.qty, 0);
  const marginPct = pctOf(s.profit);
  const met = marginPct >= 20;
  const PROFIT = met ? T.green : T.amberText;

  const costs: [string, number, Href | null][] = [
    ['(−) 재료 원가', s.material, '/sales/material' as Href],
    ['(−) 폐기 손실', s.waste, null],
    ['(−) 부자재', s.extra, '/sales/extra' as Href],
    ['(−) 고정 지출', s.fixed, '/sales/fixed' as Href],
    ['(−) 추가 지출', s.dailyExtra, '/sales/expense' as Href],
    ['(−) 세금', s.tax, null],
  ];
  const sorted = [...s.menu].sort((a, b) => b.qty - a.qty);
  const list = showAll ? sorted : sorted.slice(0, 10);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="6월 18일 손익" onBack={() => safeBack('/sales' as Href)} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24, gap: 11 }}>
        {/* 채널 구성 */}
        <SecLabel title="채널 구성" onPress={() => router.push('/sales/channel' as Href)} />
        <Card pad={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Donut size={120} thick={19} segments={s.channelMix} centerTop="순이익률" centerMain={`${pctOf(s.profit)}%`} mainSize={20} mainColor={PROFIT} />
          <View style={{ flex: 1 }}>
            <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '700', marginBottom: 8 }, NUM]}>매출 {won(s.revenue)}원 · 채널 구성</Text>
            {s.channelMix.map((c) => (
              <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 }}>
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c.color }} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub2 }}>{c.label}</Text>
                <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub, marginRight: 8 }, NUM]}>{won(c.amt)}원</Text>
                <Text style={[{ width: 34, textAlign: 'right', fontSize: 14, fontWeight: '700', color: T.ter }, NUM]}>{c.value}%</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* 일 손익 계산 */}
        <SecLabel title="일 손익 계산" onPress={() => router.push('/sales/day-detail' as Href)} />
        <Card onLine pad={0} style={{ overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
            {/* 판매 수량 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>판매 수량</Text>
              <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>오늘 {qty}개</Text>
              <View style={{ width: 15 }} />
            </View>
            {/* 매출 */}
            <Pressable onPress={() => router.push('/sales/revenue' as Href)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>매출</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 16 }, NUM]}>{won(s.revenue)}원</Text>
              <Text style={{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.ter }}>100%</Text>
              <Icon name="chevron" size={15} color={T.line3} />
            </Pressable>
            {/* 비용 행 */}
            {costs.map(([n, v, route]) => (
              <Pressable key={n} onPress={route ? () => router.push(route) : undefined} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{n}</Text>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ter, marginRight: 16 }, NUM]}>{won(v)}원</Text>
                <Text style={[{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.ter }, NUM]}>{pctOf(v)}%</Text>
                <Icon name="chevron" size={15} color={route ? T.line3 : 'transparent'} />
              </Pressable>
            ))}
            {/* 순이익 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 13 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 8 }}>순이익</Text>
              <Badge tone={met ? 'green' : 'amber'} sm>{met ? '목표 달성' : '목표 미달'}</Badge>
              <View style={{ flex: 1 }} />
              <Text style={[{ fontSize: 16, fontWeight: '800', color: PROFIT, marginRight: 16 }, NUM]}>{won(s.profit)}원</Text>
              <Text style={[{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '800', color: PROFIT }, NUM]}>{marginPct}%</Text>
              <View style={{ width: 15 }} />
            </View>
          </View>
        </Card>

        {/* 메뉴별 판매량 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2, marginTop: 4 }}>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.sub }}>메뉴별 판매량</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter }}>총 {s.menu.length}개 · 판매량순</Text>
        </View>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {list.map((m, i) => (
            <Pressable key={i} onPress={() => setSel(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{m.name} <Text style={{ fontSize: 14, color: T.blue, fontWeight: '700' }}>×{m.qty}</Text></Text>
                <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>매장 {m.hall} · 배달 {m.delivery} · 포장 {m.takeout}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(m.price * m.qty)}원</Text>
                <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>지출 {won(m.cogs * m.qty)}</Text>
              </View>
              <Icon name="chevron" size={17} color={T.line3} />
            </Pressable>
          ))}
          {!showAll && s.menu.length > 10 ? (
            <Pressable onPress={() => setShowAll(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 13 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>더보기 ({s.menu.length - 10}개)</Text>
              <Icon name="chevron" size={15} color={T.blue} />
            </Pressable>
          ) : null}
        </Card>
      </ScrollView>

      {/* SALES-08 메뉴별 손익 (매출 비중만큼 고정지출·폐기·부자재 자동 배분) */}
      <Sheet
        visible={sel != null}
        onClose={() => setSel(null)}
        title={sel ? `${sel.name} 손익` : undefined}
        sub={sel ? `오늘 ${sel.qty}개 판매 · 채널 배분 자동 계산` : undefined}
        height={600}
        headerRight={
          <Pressable onPress={() => { setSel(null); router.push('/sales/menu' as Href); }} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 4 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>자세히 보기</Text>
            <Icon name="chevron" size={15} color={T.blue} />
          </Pressable>
        }
      >
        {sel
          ? (() => {
              const revenue = sel.price * sel.qty;
              const material = sel.cogs * sel.qty;
              const share = revenue / s.revenue;
              const mWaste = Math.round((s.waste * share) / 100) * 100;
              const mExtra = Math.round((s.extra * share) / 100) * 100;
              const mFixed = Math.round((s.fixed * share) / 1000) * 1000;
              const mTax = Math.round((revenue * 10) / 110);
              const mProfit = revenue - material - mWaste - mExtra - mFixed - mTax;
              const p = (v: number) => Math.round((v / revenue) * 1000) / 10;
              const mMet = p(mProfit) >= 20;
              const MPR = mMet ? T.green : T.amberText;
              const mCosts: [string, number][] = [
                ['(−) 재료 원가', material],
                ['(−) 폐기 손실', mWaste],
                ['(−) 부자재', mExtra],
                ['(−) 고정 지출', mFixed],
                ['(−) 세금', mTax],
              ];
              return (
                <View>
                  <Card onLine pad={0} style={{ overflow: 'hidden', marginBottom: 12 }}>
                    <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
                      {/* 판매 수량 */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>판매 수량</Text>
                        <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink, marginRight: 12 }, NUM]}>{sel.qty}개</Text>
                        <Text style={{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.ter }}>—</Text>
                      </View>
                      {/* 채널 구성 */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>채널 구성</Text>
                        <Text style={[{ fontSize: 14, fontWeight: '600', color: T.sub2 }, NUM]}>매장 {sel.hall} · 배달 {sel.delivery} · 포장 {sel.takeout}</Text>
                      </View>
                      {/* 매출 */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line }}>
                        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>매출</Text>
                        <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 12 }, NUM]}>{won(revenue)}원</Text>
                        <Text style={{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.ter }}>100%</Text>
                      </View>
                      {/* 비용 행 */}
                      {mCosts.map(([n, v]) => (
                        <View key={n} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                          <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{n}</Text>
                          <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ter, marginRight: 12 }, NUM]}>{won(v)}원</Text>
                          <Text style={[{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: T.ter }, NUM]}>{p(v)}%</Text>
                        </View>
                      ))}
                      {/* 순이익 */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 13 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 8 }}>순이익</Text>
                        <Badge tone={mMet ? 'green' : 'amber'} sm>{mMet ? '목표 달성' : '목표 미달'}</Badge>
                        <View style={{ flex: 1 }} />
                        <Text style={[{ fontSize: 16, fontWeight: '800', color: MPR, marginRight: 12 }, NUM]}>{won(mProfit)}원</Text>
                        <Text style={[{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '800', color: MPR }, NUM]}>{p(mProfit)}%</Text>
                      </View>
                    </View>
                  </Card>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: T.blueTint }}>
                    <Icon name="info" size={15} color={T.blue} />
                    <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: 20 }}>고정 지출은 이 메뉴의 매출 비중({Math.round(share * 100)}%)만큼 자동 배분됩니다.</Text>
                  </View>
                </View>
              );
            })()
          : null}
      </Sheet>
    </View>
  );
}
