import { useUnitPriceFormat } from '@/lib/unitPriceFormat';
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
import { ProfitBreakdownRows, SalesRow, SecLabel } from '../components/ProfitBlocks';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { safeBack } from '@/lib/nav';
import { LAYOUT, COLOR, COMPONENT, T, won, TYPE, space } from '@/theme/tokens';
import { formatQuantity } from '@costkeep/core';
import { useRecipeDetail } from '@/features/recipes/hooks';
import { useDayMenuDetail, useRangeMenuDetail, useSalesRange } from '../hooks';
import { rangeLabel } from '@/lib/date';
import { useSalesBusinessDate } from '@/features/business-day/businessDay';
import { percentOfTotal } from '../periodPercent';

const NUM = { fontVariant: ['tabular-nums' as const] };
const CARD_INSET = COMPONENT.card.contentInset;
/** DB 기준단위(ea) → 화면 표기(개). */
const dispUnit = (u: 'g' | 'ml' | 'ea' | null) => (u === null ? null : u === 'ea' ? '개' : u);

function SecHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: CARD_INSET, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>{title}</Text>
      {sub ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary }}>{sub}</Text> : null}
    </View>
  );
}

/**
 * ⚠ 서버가 정한 장부 날짜를 받고 나서 본체를 붙인다(0125). 앱이 직접 계산하지 않는다.
 *   게이트가 로딩·오류·재시도를 함께 다룬다 — 날짜 조회가 실패하면 예전엔 영원히
 *   "불러오는 중" 만 떴다.
 */
export default function SalesMenuDetailScreen() {
  return (
    <BusinessDateGate source={useSalesBusinessDate()} title="메뉴 손익">
      {(serverToday) => <SalesMenuDetailScreenBody serverToday={serverToday} />}
    </BusinessDateGate>
  );
}

function SalesMenuDetailScreenBody({ serverToday }: { serverToday: string }) {
  const formatUnitPrice = useUnitPriceFormat();
  const params = useLocalSearchParams<{ recipe?: string; from?: string; to?: string }>();
  const today = serverToday;
  const from = params.from ?? today;
  const to = params.to ?? today;

  const recipe = useRecipeDetail(params.recipe, { readOnly: true });
  const range = useSalesRange(from, to);
  /** 하루 조회면 그날 기준값을 쓴다. 기간이면 날마다 달라 한 벌로 못 그린다. */
  const oneDay = from === to;
  const day = useDayMenuDetail(oneDay ? from : undefined, params.recipe);
  // 합계·폐기 손실은 하루 조회도 기간 RPC의 한 날짜 합계를 사용한다.
  // day RPC는 세부 줄, range RPC는 선택 메뉴 총액의 권위다.
  const span = useRangeMenuDetail(from, to, params.recipe);

  const r = recipe.data;
  const sold = range.data?.menu.find((m) => m.recipeId === params.recipe);
  const periodSummary = range.data?.summary;

  /**
   * 개당 손익 — **그날 기준값**이다(0051).
   *
   * ⚠ 예전에는 현재 레시피(useRecipeDetail)로 구성했다. 그러면 레시피를 고치는
   *   순간 지난 날짜의 재료 줄·부자재·고정지출 항목까지 따라 움직인다.
   *   여기는 "그날 얼마 벌었나"를 보는 장부라 그날 값이어야 한다.
   *   레시피 화면은 "지금 팔면 얼마 남나"라 현재 값이 맞다 — 둘은 다른 질문이다.
   *
   * 조회가 성공했고 판매가 없을 때만 현재 메뉴를 참고한다.
   */
  const d = oneDay && day.data?.sold ? day.data : null;
  const g = span.data?.sold ? span.data : null;
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
  const tax = d ? d.tax : g ? g.unitTax : r?.tax ?? 0;
  const fixed = d ? d.fixedCost : g ? g.unitFixedCost : Math.round((r?.fixedRate ?? 0) * price);
  // 판매 시점 서버 순이익을 그대로 사용한다. 판매가 세금 별도 기록의 tax는 0이다.
  const profit = d ? d.profit : g ? g.unitProfit : price - material - extra - tax - fixed;
  const ledgerQuery = span;

  /**
   * 기간에 판매가가 여러 가지였는가. 9,300 / 9,800 / 12,000 을 평균 하나로 뭉개면
   * 사장님이 확인할 방법이 없다 — 몇 원짜리가 몇 개였는지 함께 보여 준다.
   */
  const pricePoints = g?.pricePoints ?? [];
  const multiPrice = pricePoints.length > 1;

  const rate = percentOfTotal(profit, price);
  const p = (v: number) => percentOfTotal(v, price);
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
  const menuRevenue = g?.revenue ?? sold?.revenue ?? 0;
  /**
   * 카드 순서만 메인 손익과 공유한다. 숫자는 선택 메뉴의 판매 시점 장부와
   * 기간 공통비 배분액으로 구성하며, 전체 영업일 합계를 섞지 않는다.
   */
  const menuSummary = totalBasis && g ? {
    from,
    to,
    days: g?.days ?? 1,
    revenue: menuRevenue,
    etcRevenue: 0,
    qty: soldQty,
    materialCost: g.materialCost,
    extraMaterialCost: g.extraCost,
    tax: g.tax,
    wasteLoss: g.wasteMenu,
    wasteIngredient: 0,
    wasteMenu: g.wasteMenu,
    // 일 추가 지출은 특정 메뉴에 귀속되는 장부가 아니므로 메뉴 카드에서 배분하지 않는다.
    dailyExtra: 0,
    fixedCost: g.fixedCost,
    fixedRate: menuRevenue > 0 ? g.fixedCost / menuRevenue : null,
    fixedRateProvisional: periodSummary?.fixedRateProvisional ?? false,
    profit: g.profit,
  } : null;
  const legend: [string, number, number, string][] = [
    ['재료', material + extra, p(material + extra), COMPONENT.profitChart.material],
    ['고정 지출', fixed, p(fixed), COMPONENT.profitChart.fixed],
    ...(tax !== 0 ? [['세금', tax, p(tax), COMPONENT.profitChart.tax] as [string, number, number, string]] : []),
    ['순이익', profit, rate, rate >= target ? COLOR.status.positive : COLOR.status.negative],
  ];

  const dynamicChannelRows = (g?.channels?.length ?? 0) > 0
    ? g!.channels
    : (d?.channels?.length ?? 0) > 0 ? d!.channels : sold?.channels ?? [];
  // 구 판본에는 UUID 채널 배열 없이 기본 3채널 수량만 남아 있다. 서버가
  // 동적 채널 계약으로 이행하는 동안에도 확정 원장의 과거 수량은 그대로 보인다.
  const channelRows = dynamicChannelRows.length > 0 ? dynamicChannelRows : [
    { name: '매장', quantity: g?.qtyHall ?? d?.qtyHall ?? sold?.qtyHall ?? 0, customerTotal: null },
    { name: '배달', quantity: g?.qtyDelivery ?? d?.qtyDelivery ?? sold?.qtyDelivery ?? 0, customerTotal: null },
    { name: '포장', quantity: g?.qtyTakeout ?? d?.qtyTakeout ?? sold?.qtyTakeout ?? 0, customerTotal: null },
  ];
  const channelColors = [COMPONENT.channelChart.hall, COMPONENT.channelChart.delivery, COMPONENT.channelChart.takeout];
  const chQty = channelRows.map((channel, index) => ({
    label: channel.name,
    qty: channel.quantity,
    amount: channel.customerTotal,
    color: channelColors[index % channelColors.length],
  })).filter((channel) => channel.qty > 0);
  const chTotal = chQty.reduce((a, c) => a + c.qty, 0);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="메뉴 손익" onBack={() => safeBack(`/sales/day?date=${to}`)} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: CARD_INSET, paddingTop: LAYOUT.scroll.start, paddingBottom: LAYOUT.scroll.end, gap: space.md }}>
        <QueryState
          isLoading={recipe.isLoading || range.isLoading || ledgerQuery.isLoading}
          error={recipe.error ?? range.error ?? ledgerQuery.error}
          isEmpty={!r && !ledger}
          onRetry={() => { void recipe.refetch(); void range.refetch(); void ledgerQuery.refetch(); }}
          emptyTitle="메뉴를 찾을 수 없어요"
        >
          {r || ledger ? (
            <>
              {/* 메뉴 요약 */}
              <Card pad={0} style={{ overflow: 'hidden' }}>
                <View style={{ paddingHorizontal: CARD_INSET, paddingTop: space.md, paddingBottom: 12 }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>
                    {d?.name ?? g?.name ?? r?.name ?? '메뉴'}
                    {sold?.isDeleted ? <Text style={{ color: COLOR.text.tertiary, fontWeight: '700' }}> (삭제 메뉴)</Text> : null}
                  </Text>
                </View>
                {([
                  ['영업일', rangeLabel(from, to)],
                ] as const).map(([k, v]) => (
                  <View key={k} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 47, paddingVertical: 12, paddingHorizontal: CARD_INSET, borderTopWidth: 1, borderTopColor: T.line2 }}>
                    <Text style={{ flex: 1, ...TYPE.body, color: T.sub }}>{k}</Text>
                    <Text style={[{ ...TYPE.body, fontWeight: '800', color: T.ink }, NUM]}>{v}</Text>
                  </View>
                ))}
                {menuSummary ? (
                  <View style={{ paddingHorizontal: CARD_INSET, paddingTop: space.xs, paddingBottom: space.xs }}>
                    <ProfitBreakdownRows
                      summary={menuSummary}
                      qtyLabel={`${menuSummary.qty}개${sold && sold.qtyWaste > 0 ? ` · 폐기 ${sold.qtyWaste}` : ''}`}
                      from={from}
                      to={to}
                      profitFirst
                      blackAmounts
                      includeAdditionalExpense={false}
                      linkDetails={false}
                      targetRate={target}
                    />
                  </View>
                ) : null}
              </Card>

              {/* 판매가가 여럿이었던 기간 — 몇 원짜리가 몇 개였는지 */}
              {multiPrice ? (
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="판매가" sub={`이 기간에 ${pricePoints.length}가지였어요`} />
                  <View style={{ paddingHorizontal: CARD_INSET, paddingBottom: 4 }}>
                    {pricePoints.map((pp, i) => (
                      <View
                        key={pp.price}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, borderBottomWidth: i < pricePoints.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(pp.price)}원</Text>
                          <Text style={[{ ...TYPE.captionSm, color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>
                            {pp.from === pp.to ? pp.from : `${pp.from} ~ ${pp.to}`} · {pp.days}일
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{pp.qty}개</Text>
                          <Text style={[{ ...TYPE.captionSm, color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>
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
              {!totalBasis ? (
                <>
                  <SecLabel title="1개 기준" />
                  <Card pad={0} style={{ overflow: 'hidden' }}>
                    <View style={{ paddingHorizontal: CARD_INSET, paddingTop: space.xs, paddingBottom: space.xs }}>
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
                            reserveArrowSpace={false}
                          />
                        );
                      })}
                    </View>
                  </Card>
                </>
              ) : null}

              {/* 채널 구성 — 기간 판매 실적 */}
              {chTotal > 0 ? (
                <>
                  <SecLabel title="채널 구성" />
                  <Card pad={0} style={{ overflow: 'hidden' }}>
                    <View style={{ paddingHorizontal: CARD_INSET, paddingTop: space.xs, paddingBottom: space.xs }}>
                      {chQty.map((c, i) => (
                        <SalesRow
                          key={c.label}
                          label={c.label}
                          // 여러 판매가의 평균을 채널 수량에 곱하면 실제 채널 매출과 달라진다.
                          amount={c.amount != null ? `${won(Math.round(c.amount))}원`
                            : multiPrice ? `${c.qty}개` : `${won(Math.round(price * c.qty))}원`}
                          percent={`${multiPrice ? '' : `${c.qty}개 / `}${Math.round((c.qty / chTotal) * 1000) / 10}%`}
                          strong
                          last={i === chQty.length - 1}
                          reserveArrowSpace={false}
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
                <View style={{ paddingHorizontal: CARD_INSET, paddingTop: 4, paddingBottom: space.md }}>
                  {lineRows.map((l, i, all) => {
                    const used = l.perServing * mult;
                    const cost = l.unitPrice === null ? null : used * l.unitPrice;
                    const unit = dispUnit(l.baseUnit);
                    return (
                      <View key={l.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, borderBottomWidth: i < all.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>
                            {l.name}
                          </Text>
                          <Text style={[{ ...TYPE.captionSm, color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>
                            {l.unitPrice === null ? '단가 산출 전' : formatUnitPrice(l.unitPrice, unit ?? '인분')}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[{ fontSize: 16, fontWeight: '800', color: cost === null ? COLOR.text.tertiary : T.ink }, NUM]}>
                            {cost === null ? '—' : `${won(Math.round(cost))}원`}
                          </Text>
                          <Text style={[{ ...TYPE.captionSm, color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>
                            {unit === null ? `${used}인분` : formatQuantity(used, unit)} / {cost === null ? '—' : `${p(cost / mult)}%`}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                    {extraRows.map((e, i, all) => (
                      <View key={e.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, borderBottomWidth: i < all.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>{e.name}</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(Math.round(e.amount * mult))}원</Text>
                          <Text style={[{ ...TYPE.captionSm, color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>{p(e.amount)}%</Text>
                        </View>
                      </View>
                    ))}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: T.line }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>소계</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round((material + extra) * mult))}원</Text>
                      <Text style={[{ ...TYPE.captionSm, fontWeight: '700', color: T.sub2, marginTop: space.xs }, NUM]}>{p(material + extra)}%</Text>
                    </View>
                  </View>
                </View>
              </Card>

              {/*
                고정 지출·세금은 위 손익 카드에 이미 포함된다. 이 자리는 선택 메뉴에
                직접 귀속되는 조리 후 폐기가 있을 때만 그 근거를 보여 준다.
                재료 관리에서 기록한 식재료 폐기(E2)는 특정 메뉴에 귀속할 수 없으므로
                일별·기간 전체의 폐기 손실 상세에서만 표시한다.
              */}
              {g && g.wasteMenu > 0 ? (
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="폐기 손실" />
                  <View style={{ paddingHorizontal: CARD_INSET, paddingBottom: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.md }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: T.ink2 }}>조리 후 폐기</Text>
                        <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, marginTop: space.xs }}>
                          판매하지 못한 메뉴 {g.qtyWaste}개
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(Math.round(g.wasteMenu))}원</Text>
                        <Text style={[{ ...TYPE.captionSm, color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>
                          {percentOfTotal(g.wasteMenu, menuRevenue)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                </Card>
              ) : null}
            </>
          ) : null}
        </QueryState>
      </ScrollView>
    </View>
  );
}
