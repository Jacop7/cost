import { Text, View } from 'react-native';
import { Card, Donut, QueryState } from '@/components/kit';
import { COLOR, COMPONENT, TYPE, space } from '@/theme/tokens';
import { formatPercent } from '@margincook/core';
import { RecipeDetailHeading, RecipeDetailRow } from './components/RecipeDetailParts';
import type { useRecipeRecommendation } from './draftPreviewQuery';
import type { DraftPreview } from './draftPreviewContract';

type Ready = Extract<DraftPreview, { status: 'ready' }>;
const money = (value: number | null, data: Ready) => value === null ? '산출 전' :
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
    <RecipeDetailRow label="판매가" value={money(data.one.listedTotal, data)} />
    <RecipeDetailRow label="기준 인분" value={`${data.input.base_servings}인분`} />
    <RecipeDetailRow label="목표 순이익률" value={`${data.input.target_profit_rate}%`} last />
  </>}</Snapshot>;
}

export function RecipeInternationalComposition({ query, comparison }: { query: SnapshotQuery; comparison: 'one' | 'batch' }) {
  return <Card pad={0}><RecipeDetailHeading title="판매가 구성" />
    <Snapshot query={query}>{data => {
      const row = comparison === 'batch' ? data.batch : data.one;
      const exclusive = data.context.priceBasis === 'tax_exclusive';
      const profitColor = row.profit !== null && row.profit < 0 ? COLOR.status.negative : COLOR.text.primary;
      const parts = [
        { label: '재료', amount: row.material, color: COMPONENT.profitChart.material },
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
      return <View style={{ padding: space.md, gap: space.sm }}>
        <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>{data.context.currencyCode} · {row.servings}인분 · {exclusive ? '세금 별도 판매가 기준' : '세금 포함 판매가 기준'}</Text>
        {canChart ? <View accessibilityRole="image" accessibilityLabel="판매가 구성비">
          <Donut segments={parts.filter(part => part.amount! > 0).map(part => ({ label: part.label,
            value: part.amount! / row.listedTotal * 100, color: part.color }))}
            size={COMPONENT.recipeComposition.donutSize} thick={COMPONENT.recipeComposition.donutThickness}
            centerTop="순이익률" centerMain={row.profitRate === null ? '산출 전' : formatPercent(row.profitRate)} mainColor={profitColor} />
        </View> : <Text style={{ ...TYPE.caption, color: profitColor }}>{row.profit !== null && row.profit < 0
          ? '손실이 발생해 구성비 대신 금액을 표시해요.' : row.listedTotal === 0
            ? '판매가가 0이면 구성비를 계산할 수 없어요.' : '구성비를 확인할 수 없어 금액을 표시해요.'}</Text>}
        {parts.map(part => <RecipeDetailRow key={part.label} label={part.label} value={money(part.amount, data)}
          secondary={part.amount === null || row.listedTotal <= 0 ? '—' : formatPercent(part.amount / row.listedTotal)}
          color={part.label === '순이익' ? profitColor : undefined} />)}
        <RecipeDetailRow label="판매가 합계" value={money(row.listedTotal, data)} />
        {exclusive ? <RecipeDetailRow label="고객이 별도로 내는 세금" value={money(row.tax, data)} /> : null}
        <RecipeDetailRow label="세전 순매출" value={money(row.netSales, data)} />
        <RecipeDetailRow label="고객 결제액" value={money(row.customerTotal, data)} last />
      </View>;
    }}</Snapshot>
  </Card>;
}

export function snapshotAmount(query: SnapshotQuery, field: 'material' | 'extra' | 'fixed' | 'tax', comparison: 'one' | 'batch'): string {
  if (query.isFetching) return '확인 중';
  if (query.error || query.data?.status !== 'ready') return '금액 확인 전';
  return money((comparison === 'batch' ? query.data.batch : query.data.one)[field], query.data);
}
