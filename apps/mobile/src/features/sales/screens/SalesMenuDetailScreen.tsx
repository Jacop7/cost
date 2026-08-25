/**
 * SALES-09 메뉴 손익 상세 — 메뉴 1개 손익(RCP-02 포맷) + 기간 채널 구성.
 * SALES-08 메뉴별 손익 시트의 '자세히 보기'로 진입.
 *
 * **여기는 장부다. 전부 그날 기준이고, 현재 레시피는 쓰지 않는다.**
 *   하루 조회  → 그날 스냅샷 (day_menu_detail, 0051)
 *   기간 조회  → 날마다 그날 기준으로 계산해 **합산** (range_menu_detail, 0059)
 *
 * 예전에는 현재 레시피(recipe_detail)로 그려서, 레시피를 고치는 순간 지난 날짜의
 * 재료 줄·부자재·고정지출 항목까지 따라 움직였다. 레시피 화면은 "지금 팔면 얼마 남나"라
 * 현재 값이 맞고, 여기는 "그때 얼마 벌었나"라 그때 값이어야 한다 — 다른 질문이다.
 */
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, QueryState } from '@/components/kit';
import { SalesRow, SecLabel } from '../components/ProfitBlocks';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { formatQuantity, formatUnitPrice } from '@sikjae/core';
import { useRecipeDetail } from '@/features/recipes/hooks';
import { useDayMenuDetail, useRangeMenuDetail, useSalesRange } from '../hooks';
import { rangeLabel } from '../period';
import { useSalesBusinessDate } from '../businessDay';

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
    /*
   * ⚠ **서버가 정한 장부 날짜**를 쓴다(0125). 앱이 `+09:00` 고정 오프셋으로 직접
   *   계산하면 앱과 DB 가 각자 오늘을 갖게 된다(기획서 §2.1).
   *   못 받았으면 빈 문자열이고, 그동안 조회가 꺼진다 — 잘못된 날의 숫자보다 낫다.
   */
  const serverToday = useSalesBusinessDate() ?? '';
  const today = serverToday;
  const from = params.from ?? today;
  const to = params.to ?? today;

  const recipe = useRecipeDetail(params.recipe);
  const range = useSalesRange(from, to);
  /** 하루 조회면 그날 기준값을 쓴다. 기간이면 날마다 달라 한 벌로 못 그린다. */
  const oneDay = from === to;
  const day = useDayMenuDetail(oneDay ? from : undefined, params.recipe);
  const span = useRangeMenuDetail(oneDay ? undefined : from, oneDay ? undefined : to, params.recipe);

  const r = recipe.data;
  const sold = range.data?.menu.find((m) => m.recipeId === params.recipe);

  /**
   * 개당 손익 — **그날 기준값**이다(0051).
   *
   * ⚠ 예전에는 현재 레시피(useRecipeDetail)로 구성했다. 그러면 레시피를 고치는
   *   순간 지난 날짜의 재료 줄·부자재·고정지출 항목까지 따라 움직인다.
   *   여기는 "그날 얼마 벌었나"를 보는 장부라 그날 값이어야 한다.
   *   레시피 화면은 "지금 팔면 얼마 남나"라 현재 값이 맞다 — 둘은 다른 질문이다.
   *
   * 그날 판매가 없으면(또는 기간 조회면) 현재 레시피로 떨어진다.
   */
  const d = oneDay && day.data?.sold ? day.data : null;
  const g = !oneDay && span.data?.sold ? span.data : null;
  /** 장부 값을 하나라도 찾았는가. 못 찾으면(판매 없음) 현재 레시피로 그린다. */
  const ledger = Boolean(d || g);

  /**
   * 화면이 그릴 재료·부자재 줄. 하루면 그날 스냅샷, 기간이면 날짜별 합, 둘 다 없으면 현재 레시피.
   * 세 소스의 모양이 달라 여기서 한 번만 맞춘다 — 아래 JSX 는 분기를 모른다.
   */
  const lineRows: { key: string; name: string; baseUnit: 'g' | 'ml' | 'ea' | null; perServing: number; unitPrice: number | null }[] =
    d
      ? d.lines.map((l) => ({ key: l.ingredientId, name: l.name, baseUnit: l.baseUnit, perServing: l.perServing, unitPrice: l.unitPrice }))
      : g
        ? g.lines.map((l) => ({ key: l.ingredientId, name: l.name, baseUnit: l.baseUnit, perServing: l.perServing, unitPrice: l.unitPrice }))
        : (r?.lines ?? []).map((l) => ({ key: l.id, name: l.name, baseUnit: l.baseUnit, perServing: l.perServing, unitPrice: l.unitPrice }));

  const extraRows: { key: string; name: string; amount: number }[] =
    d
      ? d.extras.map((e, i) => ({ key: `${e.name}-${i}`, name: e.name, amount: e.amount }))
      : g
        ? g.extras.map((e, i) => ({ key: `${e.name}-${i}`, name: e.name, amount: e.amount }))
        : (r?.extras ?? []).map((e) => ({ key: e.id, name: e.name, amount: e.amount }));

  const price = d?.price ?? g?.unitPrice ?? r?.price ?? 0;
  const material = d?.materialCost ?? g?.unitMaterialCost ?? r?.materialCost ?? 0;
  const extra = d?.extraCost ?? g?.unitExtraCost ?? r?.extraCost ?? 0;
  const tax = d ? d.tax : g ? g.unitTax : r?.taxMode === 'included' ? (price * 10) / 110 : 0;
  const fixed = d ? d.fixedCost : g ? g.unitFixedCost : (r?.fixedRate ?? 0) * price;
  const profit = price - material - extra - tax - fixed;

  /**
   * 기간에 판매가가 여러 가지였는가. 9,300 / 9,800 / 12,000 을 평균 하나로 뭉개면
   * 사장님이 확인할 방법이 없다 — 몇 원짜리가 몇 개였는지 함께 보여 준다.
   */
  const pricePoints = g?.pricePoints ?? [];
  const multiPrice = pricePoints.length > 1;

  /**
   * 세금 내역 — 그날 판매 기준이다(0054). 기간이면 날마다 구성이 다를 수 있어
   * 합계 한 줄만 그린다.
   */
  const taxRows = d?.taxItems ?? [];
  const taxMode = d ? d.taxMode : r?.taxMode;
  const taxNote = g
    ? `기간 합 ${won(Math.round(g.tax))}원`
    : taxMode === 'included' ? '판매가 포함 (10/110)' : taxMode === 'separate' ? '별도' : '면세';
  const rate = price > 0 ? Math.round((profit / price) * 1000) / 10 : 0;
  const p = (v: number) => (price > 0 ? Math.round((v / price) * 1000) / 10 : 0);
  const target = r?.targetProfitRate ?? 0;

  /*
   * ⚠ 프로토타입은 이 화면 전체가 **총액 기준**이다 — 재료 33,677원은 개당 2,806원에
   *   12개를 곱한 값이고, 아래 재료 소계도 같은 숫자로 맞물린다.
   *   개당으로 그리면 카드마다 기준이 달라 소계가 안 맞는다.
   * ⚠ 판매가 없으면 곱할 게 없으므로 개당으로 떨어지고, 제목이 그렇게 말한다.
   */
  const soldQty = sold?.qty ?? 0;
  const totalBasis = soldQty > 0;
  const mult = totalBasis ? soldQty : 1;
  const basisLabel = totalBasis ? `${rangeLabel(from, to)} 판매량 기준` : '1개 기준';


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
                  ['영업일', rangeLabel(from, to), undefined, false],
                  ['판매 수량', `${soldQty}개${sold && sold.qtyWaste > 0 ? ` · 폐기 ${sold.qtyWaste}` : ''}`, undefined, false],
                  // 기간에 판매가가 여러 가지였으면 평균이라고 밝힌다. 그냥 한 숫자로 두면
                  // 그 가격에 팔았다고 읽힌다.
                  totalBasis
                    ? ['매출', `${won(Math.round(sold?.revenue ?? price * soldQty))}원`, undefined, false] as const
                    : [multiPrice ? '판매가 (기간 평균)' : '판매가', `${won(Math.round(price))}원`, undefined, false] as const,
                  [ledger ? '순이익률' : '현재 순이익률', `${rate}%`, `목표 ${target}%`, true],
                ] as const).map(([k, v, subLabel, accent]) => (
                  <View key={k} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 47, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: T.line2 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: T.sub }}>{k}</Text>
                      {subLabel ? <Text style={{ fontSize: 12, fontWeight: '700', color: T.ter, marginTop: 3 }}>{subLabel}</Text> : null}
                    </View>
                    <Text style={[{ fontSize: 15, fontWeight: '800', color: accent ? (rate >= target ? T.green : T.red) : T.ink }, NUM]}>{v}</Text>
                  </View>
                ))}
              </Card>

              {/* 판매가가 여럿이었던 기간 — 몇 원짜리가 몇 개였는지 */}
              {multiPrice ? (
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="판매가" sub={`이 기간에 ${pricePoints.length}가지였어요`} />
                  <View style={{ paddingHorizontal: 15, paddingBottom: 4 }}>
                    {pricePoints.map((pp, i) => (
                      <View
                        key={pp.price}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: i < pricePoints.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(pp.price)}원</Text>
                          <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>
                            {pp.from === pp.to ? pp.from : `${pp.from} ~ ${pp.to}`} · {pp.days}일
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{pp.qty}개</Text>
                          <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>
                            {won(Math.round(pp.price * pp.qty))}원
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}

              {/*
                ⚠ 도넛을 뺐다(프로토타입 규격). 다섯 조각짜리 도넛이 알려 주는 건
                  줄에 적힌 비율과 같은 것이고, 가운데 순이익률은 위 카드가 이미 말한다.
              */}
              <SecLabel title={basisLabel} />
              <Card pad={0} style={{ overflow: 'hidden' }}>
                <View style={{ paddingHorizontal: 14, paddingTop: 5, paddingBottom: 5 }}>
                  {legend.map(([l, amt, pct, c], i) => {
                    const accent = l === '순이익';
                    return (
                      <SalesRow
                        key={l}
                        label={l}
                        amount={`${won(Math.round(amt * mult))}원`}
                        percent={`${pct}%`}
                        strong={accent}
                        tone={accent ? c : undefined}
                        last={i === legend.length - 1}
                      />
                    );
                  })}
                </View>
              </Card>

              {/* 채널 구성 — 기간 판매 실적 */}
              {chTotal > 0 ? (
                <>
                  <SecLabel title="채널 구성" />
                  <Card pad={0} style={{ overflow: 'hidden' }}>
                    <View style={{ paddingHorizontal: 14, paddingTop: 5, paddingBottom: 5 }}>
                      {chQty.map((c, i) => (
                        <SalesRow
                          key={c.label}
                          label={c.label}
                          amount={`${won(Math.round(price * c.qty))}원`}
                          percent={`${c.qty}개 / ${Math.round((c.qty / chTotal) * 1000) / 10}%`}
                          strong
                          last={i === chQty.length - 1}
                        />
                      ))}
                    </View>
                  </Card>
                </>
              ) : null}

              {/* 재료 */}
              <Card pad={0} style={{ overflow: 'hidden' }}>
                {/* ⚠ 위 손익 카드와 **같은 기준**이라야 소계가 맞물린다. */}
                <SecHead title="재료" />
                <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
                  {lineRows.map((l, i, all) => {
                    const used = l.perServing * mult;
                    const cost = l.unitPrice === null ? null : used * l.unitPrice;
                    const unit = dispUnit(l.baseUnit);
                    return (
                      <View key={l.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < all.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
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
                            {unit === null ? `${used}인분` : formatQuantity(used, unit)} / {cost === null ? '—' : `${p(cost / mult)}%`}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>소계</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round(material * mult))}원</Text>
                      <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: 2 }, NUM]}>{p(material)}%</Text>
                    </View>
                  </View>
                </View>
              </Card>

              {/* 부가 원가 */}
              {extraRows.length > 0 ? (
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="부자재" />
                  <View style={{ paddingHorizontal: 15, paddingBottom: 4 }}>
                    {extraRows.map((e, i, all) => (
                      <View key={e.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: i < all.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>{e.name}</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(Math.round(e.amount * mult))}원</Text>
                          <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>{p(e.amount)}%</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}

              {/* 고정 지출 · 세금 */}
              <Card pad={0} style={{ overflow: 'hidden' }}>
                <SecHead title="고정 지출 · 세금" />
                <View style={{ paddingHorizontal: 15, paddingBottom: 4 }}>
                  {(taxRows.length > 0
                    ? [
                        ['고정 지출', fixed, `고정지출률 ${Math.round((d ? d.fixedRate : r.fixedRate ?? 0) * 1000) / 10}%`] as const,
                        // 세금은 항목별로 편다 — 부가세만 있으면 한 줄, 카드 수수료가 있으면 두 줄.
                        ...taxRows.map((t) =>
                          [t.name, t.amount, `판매가의 ${Math.round(t.rate * 10) / 10}%`] as const),
                      ]
                    : ([
                        ['고정 지출', fixed, `고정지출률 ${Math.round((d ? d.fixedRate : r.fixedRate ?? 0) * 1000) / 10}%`],
                        ['세금', tax, taxNote],
                      ] as const)
                  ).map(([n, v, note], i, all) => (
                    <View key={`${n}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: i < all.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: T.ink2 }}>{n}</Text>
                        <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{note}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(Math.round(v * mult))}원</Text>
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
