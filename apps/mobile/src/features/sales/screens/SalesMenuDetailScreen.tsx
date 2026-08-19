/**
 * SALES-09 메뉴 손익 상세 — 메뉴 1개 손익(RCP-02 포맷) + 기간 채널 구성.
 * SALES-08 메뉴별 손익 시트의 '자세히 보기'로 진입.
 *
 * 개당 손익은 **현재 레시피 기준**이고(서버 recipe_detail), 기간 실적은 판매 스냅샷 기준이다.
 * 둘은 다른 시점의 값이라 나란히 두되 라벨로 구분한다.
 */
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Donut, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { formatQuantity, formatUnitPrice } from '@sikjae/core';
import { useRecipeDetail } from '@/features/recipes/hooks';
import { useSalesRange } from '../hooks';
import { rangeLabel, todayBusiness } from '../period';

const NUM = { fontVariant: ['tabular-nums' as const] };
/** DB 기준단위(ea) → 화면 표기(개). */
const dispUnit = (u: 'g' | 'ml' | 'ea' | null) => (u === null ? null : u === 'ea' ? '개' : u);

function SecHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>{title}</Text>
      {sub ? <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}>{sub}</Text> : null}
    </View>
  );
}

export default function SalesMenuDetailScreen() {
  const params = useLocalSearchParams<{ recipe?: string; from?: string; to?: string }>();
  const today = todayBusiness();
  const from = params.from ?? today;
  const to = params.to ?? today;

  const recipe = useRecipeDetail(params.recipe);
  const range = useSalesRange(from, to);

  const r = recipe.data;
  const sold = range.data?.menu.find((m) => m.recipeId === params.recipe);

  // 개당 손익 — 서버가 준 현재 레시피 값으로 구성한다.
  const price = r?.price ?? 0;
  const material = r?.materialCost ?? 0;
  const extra = r?.extraCost ?? 0;
  const tax = r?.taxMode === 'included' ? (price * 10) / 110 : 0;
  const fixed = (r?.fixedRate ?? 0) * price;
  const profit = price - material - extra - tax - fixed;
  const rate = price > 0 ? Math.round((profit / price) * 1000) / 10 : 0;
  const p = (v: number) => (price > 0 ? Math.round((v / price) * 1000) / 10 : 0);
  const target = r?.targetProfitRate ?? 0;

  const donutSeg = [
    { label: '재료', value: p(material), color: '#8B95A1' },
    { label: '부자재', value: p(extra), color: '#CDD3DA' },
    { label: '고정 지출', value: p(fixed), color: '#5B6573' },
    { label: '세금', value: p(tax), color: '#B0B8C1' },
    { label: '순이익', value: Math.max(0, rate), color: rate >= target ? T.green : T.red },
  ].filter((x) => x.value > 0);

  const legend: [string, number, number, string][] = [
    ['재료', material, p(material), '#8B95A1'],
    ['부자재', extra, p(extra), '#CDD3DA'],
    ['고정 지출', fixed, p(fixed), '#5B6573'],
    ['세금', tax, p(tax), '#B0B8C1'],
    ['순이익', profit, rate, rate >= target ? T.green : T.red],
  ];

  const chQty = sold ? [
    { label: '매장', qty: sold.qtyHall, color: T.blue },
    { label: '배달', qty: sold.qtyDelivery, color: '#7A8694' },
    { label: '포장', qty: sold.qtyTakeout, color: '#C5CCD3' },
  ].filter((c) => c.qty > 0) : [];
  const chTotal = chQty.reduce((a, c) => a + c.qty, 0);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="메뉴 손익" onBack={() => safeBack(`/sales/day?date=${to}`)} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28, gap: 11 }}>
        <QueryState
          isLoading={recipe.isLoading || range.isLoading}
          error={recipe.error ?? range.error}
          isEmpty={!r}
          onRetry={() => { void recipe.refetch(); void range.refetch(); }}
          emptyTitle="메뉴를 찾을 수 없어요"
        >
          {r ? (
            <>
              {/* 메뉴 요약 */}
              <Card pad={0} style={{ overflow: 'hidden' }}>
                <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{r.name}</Text>
                </View>
                {([
                  ['판매가', `${won(price)}원`, false],
                  [`${rangeLabel(from, to)} 판매량`, `${sold?.qty ?? 0}개${sold && sold.qtyWaste > 0 ? ` · 폐기 ${sold.qtyWaste}` : ''}`, false],
                  ['목표 순이익률', `${target}%`, false],
                  ['현재 순이익률', `${rate}%`, true],
                ] as const).map(([k, v, accent]) => (
                  <View key={k} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: T.line2 }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{k}</Text>
                    <Text style={[{ fontSize: 16, fontWeight: '800', color: accent ? (rate >= target ? T.green : T.red) : T.ink }, NUM]}>{v}</Text>
                  </View>
                ))}
              </Card>

              {/* 순이익률 도넛 — 개당 기준 */}
              <Card pad={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Donut size={112} thick={17} mainSize={18} mainColor={rate >= target ? T.green : T.red} centerTop="순이익률" centerMain={`${rate}%`} segments={donutSeg} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: T.ter, fontWeight: '700', marginBottom: 6 }}>1개 기준</Text>
                  {legend.map(([l, amt, pct, c]) => {
                    const accent = l === '순이익';
                    return (
                      <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 }}>
                        <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c }} />
                        <Text style={{ flex: 1, fontSize: 14, fontWeight: accent ? '800' : '600', color: accent ? c : T.sub2 }}>{l}</Text>
                        <Text style={[{ fontSize: 14, fontWeight: '800', color: accent ? c : T.ink, marginRight: 8 }, NUM]}>{won(Math.round(amt))}원</Text>
                        <Text style={[{ width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: accent ? c : T.ter }, NUM]}>{pct}%</Text>
                      </View>
                    );
                  })}
                </View>
              </Card>

              {/* 채널 구성 — 기간 판매 실적 */}
              {chTotal > 0 ? (
                <Card pad={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <Donut
                    size={120} thick={19} mainSize={20}
                    segments={chQty.map((c) => ({ label: c.label, value: Math.round((c.qty / chTotal) * 1000) / 10, color: c.color }))}
                    centerTop="판매" centerMain={`${chTotal}개`}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '700', marginBottom: 8 }, NUM]}>매출 {won(sold?.revenue ?? 0)}원 · 채널 구성</Text>
                    {chQty.map((c) => (
                      <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 }}>
                        <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c.color }} />
                        <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub2 }}>{c.label}</Text>
                        <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub, marginRight: 8 }, NUM]}>{c.qty}개</Text>
                        <Text style={[{ width: 40, textAlign: 'right', fontSize: 14, fontWeight: '700', color: T.ter }, NUM]}>
                          {Math.round((c.qty / chTotal) * 1000) / 10}%
                        </Text>
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}

              {/* 재료 */}
              <Card pad={0} style={{ overflow: 'hidden' }}>
                <SecHead title="재료" sub="(1인분 기준)" />
                <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
                  {r.lines.map((l, i) => {
                    const cost = l.unitPrice === null ? null : l.perServing * l.unitPrice;
                    const unit = dispUnit(l.baseUnit);
                    return (
                      <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < r.lines.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>
                            {l.name}
                          </Text>
                          <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>
                            {l.unitPrice === null ? '단가 산출 전' : unit === null ? `${won(Math.round(l.unitPrice))}원/인분` : formatUnitPrice(l.unitPrice, unit)}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[{ fontSize: 16, fontWeight: '800', color: cost === null ? T.ter : T.ink }, NUM]}>
                            {cost === null ? '—' : `${won(Math.round(cost))}원`}
                          </Text>
                          <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>
                            {unit === null ? `${l.perServing}인분` : formatQuantity(l.perServing, unit)} / {cost === null ? '—' : `${p(cost)}%`}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>소계</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round(material))}원</Text>
                      <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: 2 }, NUM]}>{p(material)}%</Text>
                    </View>
                  </View>
                </View>
              </Card>

              {/* 부가 원가 */}
              {r.extras.length > 0 ? (
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="부자재" sub="(이 메뉴에만 들어가는 부가 원가)" />
                  <View style={{ paddingHorizontal: 15, paddingBottom: 4 }}>
                    {r.extras.map((e, i) => (
                      <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: i < r.extras.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>{e.name}</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(e.amount)}원</Text>
                          <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>{p(e.amount)}%</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}

              {/* 고정 지출 · 세금 */}
              <Card pad={0} style={{ overflow: 'hidden' }}>
                <SecHead title="고정 지출 · 세금" sub="(개당 환산)" />
                <View style={{ paddingHorizontal: 15, paddingBottom: 4 }}>
                  {([
                    ['고정 지출', fixed, `고정지출률 ${Math.round((r.fixedRate ?? 0) * 1000) / 10}%`],
                    ['부가세', tax, r.taxMode === 'included' ? '판매가 포함 (10/110)' : r.taxMode === 'separate' ? '별도' : '면세'],
                  ] as const).map(([n, v, note], i) => (
                    <View key={n} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: i < 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: T.ink2 }}>{n}</Text>
                        <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{note}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(Math.round(v))}원</Text>
                        <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>{p(v)}%</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </Card>
            </>
          ) : null}
        </QueryState>
      </ScrollView>
    </View>
  );
}
