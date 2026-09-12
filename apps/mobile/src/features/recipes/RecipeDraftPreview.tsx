import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, QueryState, ScrollTabs } from '@/components/kit';
import { COLOR, TYPE, space } from '@/theme/tokens';
import { formatPercent } from '@margincook/core';
import type { DraftPreview, Recommendation } from './draftPreviewContract';
import type { DraftPreviewInput } from './draftPreviewInput';
import { useRecipeDraftPreview, useRecipeRecommendation } from './draftPreviewQuery';
import { RecipeProfitRows } from './RecipeInternationalComposition';
const profitFields = [
  ['판매가 합계', 'listedTotal'], ['세금', 'tax'], ['고객 결제액', 'customerTotal'], ['세전 순매출', 'netSales'],
  ['식재료 원가', 'material'], ['부자재', 'extra'], ['고정 지출', 'fixed'], ['순이익', 'profit'],
] as const;
const money = (value: number | null, context: NonNullable<DraftPreview['context']>) => value === null ? '산출 전' :
  new Intl.NumberFormat(context.locale, { style: 'currency', currency: context.currencyCode, minimumFractionDigits: context.minorUnit, maximumFractionDigits: context.minorUnit }).format(value);
function RecommendationRow({ value, context, target, onApply }: { value: Recommendation; context: NonNullable<DraftPreview['context']>; target: number; onApply?: (price: number) => void }) {
  return <View style={{ paddingVertical: space.md, gap: space.sm }}>
    <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>권장 판매가 · 목표 {target}% 기준</Text>
    <Text style={{ ...TYPE.body, color: COLOR.text.accent }}>{value.status === 'ready' ? money(value.price, context) : value.status === 'basis_missing'
      ? '원가와 고정지출이 확인되면 계산할 수 있어요.' : value.status === 'search_limit' ? '현재 조건의 최소 판매가를 확정하지 못했어요.' : '입력 가능한 가격 범위에서 목표를 달성할 수 없어요.'}</Text>
    {value.status === 'ready' && onApply ? <Button accessibilityLabel="권장 판매가 적용" onPress={() => onApply(value.price)}>적용하기</Button> : null}
  </View>;
}
const unavailable = (reason: string) => reason === 'not_active' ? '세금 설정이 적용된 후 계산할 수 있어요.' :
  reason === 'disabled' ? '현재 연결에서는 이 계산을 사용할 수 없어요.' : '현재 적용된 국가·세금 설정을 확인해 주세요.';
type ComparisonProps = { comparison?: 'one' | 'batch'; onComparisonChange?: (value: 'one' | 'batch') => void };
function PreviewRows({ ready, onApply, comparison, onComparisonChange }: { ready: Extract<DraftPreview, { status: 'ready' }>; onApply?: (price: number) => void } & ComparisonProps) {
  const [localBatch, setBatch] = useState(false);
  const batch = comparison ? comparison === 'batch' : localBatch;
  const row = batch ? ready.batch : ready.one;
  return <>
      <ScrollTabs tabs={[`${ready.input.base_servings}인분`, '1인분']} active={batch ? 0 : 1} onChange={i => { setBatch(i === 0); onComparisonChange?.(i === 0 ? 'batch' : 'one'); }} />
      <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>{ready.context.currencyCode} · {ready.context.priceBasis === 'tax_inclusive' ? '세금 포함 판매가' : '세금 별도 판매가'}</Text>
      {batch ? <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>1인분 계산 결과를 기준 인분으로 비교해요.</Text> : null}
      {profitFields.map(([label, key]) =>
        <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.md }}>
          <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{label}</Text><Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{money(row[key], ready.context)}</Text>
        </View>)}
      <Text style={{ ...TYPE.body, color: COLOR.text.secondary }}>{row.profitRate === null ? '이익률 산출 전' : formatPercent(row.profitRate)}</Text>
      {row.meetsTarget !== null ? <Text style={{ ...TYPE.caption, color: row.meetsTarget ? COLOR.status.positive : COLOR.status.negative }}>{row.meetsTarget ? '목표 달성' : '목표 미달'}</Text> : null}
      {row.material === null || row.extra === null ? <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>식재료·부자재 단가가 확인되면 순이익을 계산할 수 있어요.</Text> : null}
      {row.fixed === null ? <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>이번 달 고정지출 배분 기준이 없어 순이익을 계산할 수 없어요.</Text> : null}
      <RecommendationRow value={ready.recommendation} context={ready.context} target={ready.input.target_profit_rate} onApply={onApply} />
  </>;
}
export function RecipeDraftPreview({ input, onApply, baseServings = 1 }: { input: DraftPreviewInput | null; onApply?: (price: number) => void; baseServings?: number }) {
  const query = useRecipeDraftPreview(input); const data = query.data;
  const [comparison, setComparison] = useState<'one' | 'batch'>('one');
  const ready = data?.status === 'ready' ? data : null;
  if (!input) return <RecipeProfitRows data={null} baseServings={baseServings} comparison={comparison} onComparisonChange={setComparison} />;
  return <View><QueryState isLoading={query.isFetching} error={query.error} isEmpty={false} emptyTitle="" onRetry={() => { void query.refetch(); }}>
    {data?.status === 'unavailable' ? <Text style={{ ...TYPE.body, color: COLOR.text.secondary }}>{unavailable(data.reason)}</Text> : null}
    {ready?.status === 'ready' ? <>
      <RecipeProfitRows data={ready} comparison={comparison} onComparisonChange={setComparison} showRecommendation={false} />
      <View style={{ paddingHorizontal: space.lg }}>
        <RecommendationRow value={ready.recommendation} context={ready.context} target={ready.input.target_profit_rate} onApply={onApply} />
      </View>
    </> : null}
  </QueryState></View>;
}
type RecommendationProps = { recipeId: string; showProfit?: boolean } & ComparisonProps;
export function RecipeRecommendation(props: RecommendationProps) {
  const query = useRecipeRecommendation(props.recipeId);
  return <RecipeRecommendationResult {...props} query={query} />;
}
export function RecipeRecommendationResult({ recipeId, showProfit = false, comparison, onComparisonChange, query }: RecommendationProps & { query: ReturnType<typeof useRecipeRecommendation> }) {
  const data = query.data;
  return <View style={{ padding: space.md }}><QueryState isLoading={query.isFetching} error={query.error} isEmpty={false} emptyTitle="" onRetry={() => { void query.refetch(); }}>
    {data?.status === 'ready' ? (showProfit ? <PreviewRows key={recipeId} ready={data} comparison={comparison} onComparisonChange={onComparisonChange} /> : <RecommendationRow value={data.recommendation} context={data.context} target={data.input.target_profit_rate} />) : null}
    {data?.status === 'unavailable' ? <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>{unavailable(data.reason)}</Text> : null}
  </QueryState></View>;
}
