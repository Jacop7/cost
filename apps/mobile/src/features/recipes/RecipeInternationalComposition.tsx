import { Text, View } from 'react-native';
import { Card, Donut, QueryState, ScrollTabs } from '@/components/kit';
import { COLOR, COMPONENT, T, TYPE, space, tnum } from '@/theme/tokens';
import { formatPercent } from '@margincook/core';
import { RecipeDetailHeading, RecipeDetailRow, RecipeDetailSubtotal } from './components/RecipeDetailParts';
import type { useRecipeRecommendation } from './draftPreviewQuery';
import type { DraftPreview } from './draftPreviewContract';

type Ready = Extract<DraftPreview, { status: 'ready' }>;
export const recipeSnapshotMoney = (value: number | null, data: Ready) => value === null ? '산출 전' :
  data.context.currencyCode === 'KRW' ? `${new Intl.NumberFormat(data.context.locale, { maximumFractionDigits: 0 }).format(value)}원` :
  new Intl.NumberFormat(data.context.locale, { style: 'currency', currency: data.context.currencyCode,
    minimumFractionDigits: data.context.minorUnit, maximumFractionDigits: data.context.minorUnit }).format(value);

type SnapshotQuery = ReturnType<typeof useRecipeRecommendation>;
function Snapshot({ query, children }: { query: SnapshotQuery; children: (data: Ready) => React.ReactNode }) {
  return <QueryState isLoading={query.isFetching} error={query.error} isEmpty={false} emptyTitle=""
    onRetry={() => { void query.refetch(); }}>
    {query.data?.status === 'ready' ? children(query.data) : query.data?.status === 'unavailable'
      ? <Text style={{ ...TYPE.caption, color: COLOR.text.secondary, padding: space.md }}>현재 적용된 국가·세금 설정이 확인되면 금액을 표시해요.</Text> : null}
  </QueryState>;
}

export function RecipeCurrentPrice({ query }: { query: SnapshotQuery }) {
  return <Snapshot query={query}>{data => <>
    <RecipeDetailRow label="판매가" value={recipeSnapshotMoney(data.one.listedTotal, data)} />
    <RecipeDetailRow label="기준 인분" value={`${data.input.base_servings}인분`} />
    <RecipeDetailRow label="목표 순이익률" value={`${data.input.target_profit_rate}%`} last />
  </>}</Snapshot>;
}

export function RecipeInternationalComposition({ query, comparison }: { query: SnapshotQuery; comparison: 'one' | 'batch' }) {
  return <Card pad={0} style={{ overflow: 'hidden' }}><RecipeDetailHeading title="판매가 구성" />
    <Snapshot query={query}>{data => {
      const row = comparison === 'batch' ? data.batch : data.one;
      const exclusive = data.context.priceBasis === 'tax_exclusive';
      const profitColor = row.profit === null ? COLOR.text.primary : row.meetsTarget === false || row.profit < 0 ? COLOR.status.negative : COLOR.status.positive;
      const parts = [
        { label: '식재료', amount: row.material, color: COMPONENT.profitChart.material },
        { label: '부자재', amount: row.extra, color: COMPONENT.profitChart.extra },
        { label: '고정 지출', amount: row.fixed, color: COMPONENT.profitChart.fixed },
        ...(!exclusive ? [{ label: '세금', amount: row.tax, color: COMPONENT.profitChart.tax }] : []),
        { label: '순이익', amount: row.profit, color: profitColor },
      ];
      // The kit only supports nonnegative percentages. Never clip a loss into a
      // profitable-looking pie or add exclusive customer tax to a sales-price pie.
      const nonnegative = parts.every(part => part.amount !== null && part.amount >= 0);
      const sum = parts.reduce((total, part) => total + (part.amount ?? 0), 0);
      const canChart = nonnegative && row.listedTotal > 0
        && Math.abs(sum - row.listedTotal) <= Number.EPSILON * Math.max(1, row.listedTotal) * parts.length * 4;
      return <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: space.lg, padding: space.lg }}>
        {canChart ? <View accessibilityRole="image" accessibilityLabel="판매가 구성비">
          <Donut segments={[parts[parts.length - 1]!, ...parts.slice(0, -1)].filter(part => part.amount! > 0).map(part => ({ label: part.label,
            value: part.amount! / row.listedTotal * 100, color: part.color }))}
            size={COMPONENT.recipeComposition.donutSize} thick={COMPONENT.recipeComposition.donutThickness}
            centerTop="순이익률" centerMain={row.profitRate === null ? '산출 전' : formatPercent(row.profitRate)} mainSize={TYPE.body.fontSize} mainColor={profitColor} />
        </View> : <Text style={{ ...TYPE.caption, color: profitColor }}>{row.profit !== null && row.profit < 0
          ? '손실이 발생해 구성비 대신 금액을 표시해요.' : row.listedTotal === 0
            ? '판매가가 0이면 구성비를 계산할 수 없어요.' : '구성비를 확인할 수 없어 금액을 표시해요.'}</Text>}
        <View style={{ flexGrow: 1, flexBasis: COMPONENT.recipeComposition.legendMinWidth, maxWidth: '100%', gap: space.xs }}>
          {[...parts, { label: '소계', amount: row.listedTotal, color: COLOR.text.primary }].map(part => {
            const total = part.label === '소계';
            const accent = part.label === '순이익';
            return <View key={part.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm,
              ...(total ? { borderTopWidth: 1, borderTopColor: T.line2, paddingTop: space.sm, marginTop: space.xs } : {}) }}>
              <Text style={{ ...TYPE.captionSm, flex: 1, color: accent ? profitColor : COLOR.text.secondary, fontWeight: accent ? TYPE.body.fontWeight : TYPE.captionSm.fontWeight }}>{part.label}</Text>
              <Text style={{ ...TYPE.captionSm, ...tnum, fontWeight: TYPE.body.fontWeight, color: accent ? profitColor : COLOR.text.primary }}>{recipeSnapshotMoney(part.amount, data)}</Text>
              <Text style={{ ...TYPE.captionSm, ...tnum, minWidth: COMPONENT.recipeComposition.rateMinWidth, textAlign: 'right', color: accent ? profitColor : COLOR.text.tertiary }}>{part.amount === null || row.listedTotal <= 0 ? '—' : total ? '100%' : formatPercent(part.amount / row.listedTotal)}</Text>
            </View>;
          })}
        </View>
      </View>;
    }}</Snapshot>
  </Card>;
}

export function snapshotAmount(query: SnapshotQuery, field: 'material' | 'extra' | 'fixed' | 'tax', comparison: 'one' | 'batch'): string {
  if (query.isFetching) return '확인 중';
  if (query.error || query.data?.status !== 'ready') return '금액 확인 전';
  return recipeSnapshotMoney((comparison === 'batch' ? query.data.batch : query.data.one)[field], query.data);
}

/** 계산 응답의 종류와 무관하게 상세의 판매 손익 행 디자인을 유지한다. */
export function RecipeCurrentProfit({ query, comparison, onComparisonChange }: { query: SnapshotQuery; comparison: 'one' | 'batch'; onComparisonChange: (value: 'one' | 'batch') => void }) {
  return <Snapshot query={query}>{data => <RecipeProfitRows data={data} comparison={comparison} onComparisonChange={onComparisonChange} />}</Snapshot>;
}

/** 입력 전 0 표시는 UI 초기값이며 서버 견적을 생성하거나 대체하지 않는다. */
export function RecipeProfitRows({ data, baseServings = 1, comparison, onComparisonChange, showRecommendation = true }: {
  data: Ready | null; baseServings?: number; comparison: 'one' | 'batch';
  onComparisonChange: (value: 'one' | 'batch') => void; showRecommendation?: boolean;
}) {
    const row = data ? (comparison === 'batch' ? data.batch : data.one) : null;
    const servings = data?.input.base_servings ?? (Number.isSafeInteger(baseServings) && baseServings > 0 ? baseServings : 1);
    const exclusive = data?.context.priceBasis === 'tax_exclusive';
    const profitColor = !row || row.profit === null ? COLOR.text.primary : row.meetsTarget === false || row.profit < 0 ? COLOR.status.negative : COLOR.status.positive;
    const amountText = (value: number | null | undefined) => data ? recipeSnapshotMoney(value ?? null, data) : '0원';
    const percent = (value: number | null | undefined) => !row ? '0.0%' : value == null || row.listedTotal <= 0 ? '—' : formatPercent(value / row.listedTotal);
    return <>
      <View style={{ paddingTop: space.md, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.line }}>
        <ScrollTabs tabs={[`${servings}인분`, '1인분']} active={comparison === 'batch' ? 0 : 1} onChange={i => onComparisonChange(i === 0 ? 'batch' : 'one')} />
      </View>
      <RecipeDetailRow label="판매가" value={amountText(row?.listedTotal)} secondary={!row ? '0.0%' : row.listedTotal > 0 ? '100%' : '—'} />
      <RecipeDetailRow label="판매량" value={`${row?.servings ?? (comparison === 'batch' ? servings : 1)}인분`} />
      <RecipeDetailRow label={exclusive ? '별도 부과 세금' : '(−) 세금'} value={amountText(row?.tax)} secondary={percent(row?.tax)} />
      {exclusive ? <RecipeDetailRow label="세전 순매출" value={amountText(row?.netSales)} /> : null}
      {([['식재료 원가', row?.material], ['고정 지출', row?.fixed], ['부자재', row?.extra]] as const).map(([label, amount]) =>
        <RecipeDetailRow key={label} label={`(−) ${label}`} value={amountText(amount)} secondary={percent(amount)} />)}
      <RecipeDetailRow label="순이익" value={amountText(row?.profit)} secondary={!row ? '0.0%' : row.profitRate === null ? '이익률 산출 전' : formatPercent(row.profitRate)}
        sub={!row || row.meetsTarget === null ? undefined : <Text style={{ color: profitColor }}>{row.meetsTarget ? '목표 달성' : '목표 미달'}</Text>} color={profitColor} last />
      {showRecommendation && row?.meetsTarget === false && data?.recommendation.status === 'ready' ? <RecipeDetailSubtotal label="권장 판매가" sub={`목표 ${data.input.target_profit_rate}% 기준`}
        value={recipeSnapshotMoney(data.recommendation.price, data)} secondary={`${data.input.target_profit_rate}%`} /> : null}
    </>;
}
