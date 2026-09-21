import { combinedMaterialCost } from './materialCost';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { QueryState, ScrollTabs } from '@/components/kit';
import { COLOR, TYPE, space } from '@/theme/tokens';
import { formatMarketMoney, formatPercent } from '@costkeep/core';
import type { DraftPreview, Recommendation } from './draftPreviewContract';
import type { DraftPreviewInput } from './draftPreviewInput';
import { useRecipeDraftPreview, useRecipeRecommendation } from './draftPreviewQuery';
import { RecipeProfitRows } from './RecipeInternationalComposition';
import { recipeSnapshotMoney } from './RecipeInternationalComposition';
import { RecipePreviewCostCards } from './components/RecipePreviewCostCards';
import type { ComponentProps } from 'react';

export function RecipeDraftCostCards({ input, ...props }: Omit<ComponentProps<typeof RecipePreviewCostCards>, 'row' | 'details' | 'money'> & { input: DraftPreviewInput | null }) {
  const query = useRecipeDraftPreview(input);
  const ready = input && !query.isFetching && !query.error && query.data?.status === 'ready' ? query.data : null;
  if (!input) return <RecipePreviewCostCards {...props} row={null} money={() => '0원'} />;
  const servings = props.comparison === 'batch' ? input.base_servings : 1;
  // Keep composition editing available while a quote is loading or unavailable.
  // Unknown amounts remain unknown; only the empty-input branch displays zeros.
  return ready?.status === 'ready' ? <RecipePreviewCostCards {...props} row={props.comparison === 'batch' ? ready.batch : ready.one}
    details={ready.costDetails} currencyCode={ready.context.currencyCode} money={value => recipeSnapshotMoney(value, ready)} exclusive={ready.context.priceBasis === 'tax_exclusive'} /> :
    <RecipePreviewCostCards {...props} unavailable row={{ servings, listedTotal: input.price * servings, material: null, extra: null, fixed: null,
      tax: 0, netSales: 0, customerTotal: 0, profit: null, profitRate: null, meetsTarget: null }} money={() => '금액 확인 전'} />;
}
const baseProfitFields = [
  ['판매가 합계', 'listedTotal'], ['재료', 'material'], ['고정 지출', 'fixed'], ['순이익', 'profit'],
] as const;
const money = (value: number | null, context: NonNullable<DraftPreview['context']>) => value === null ? '산출 전' :
  formatMarketMoney(value, context.currencyCode);
function RecommendationRow({ value, context, target }: { value: Recommendation; context: NonNullable<DraftPreview['context']>; target: number }) {
  return <View style={{ paddingVertical: space.md, gap: space.sm }}>
    <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>권장 판매가 · 목표 {target}% 기준</Text>
    <Text style={{ ...TYPE.body, color: COLOR.text.accent }}>{value.status === 'ready' ? money(value.price, context) : value.status === 'basis_missing'
      ? '원가와 고정 지출이 확인되면 계산할 수 있어요.' : value.status === 'search_limit' ? '현재 조건의 최소 판매가를 확정하지 못했어요.' : '입력 가능한 가격 범위에서 목표를 달성할 수 없어요.'}</Text>
  </View>;
}
const unavailable = (reason: string) => reason === 'not_active' ? '세금 설정이 적용된 후 계산할 수 있어요.' :
  reason === 'disabled' ? '현재 연결에서는 이 계산을 사용할 수 없어요.' : '현재 적용된 국가·세금 설정을 확인해 주세요.';
type ComparisonProps = { comparison?: 'one' | 'batch'; onComparisonChange?: (value: 'one' | 'batch') => void };
function PreviewRows({ ready, comparison, onComparisonChange }: { ready: Extract<DraftPreview, { status: 'ready' }> } & ComparisonProps) {
  const [localBatch, setBatch] = useState(false);
  const batch = comparison ? comparison === 'batch' : localBatch;
  const row = batch ? ready.batch : ready.one;
  const taxApplied = ready.context.priceBasis === 'tax_inclusive';
  const profitFields = taxApplied
    ? ([['판매가 합계', 'listedTotal'], ['세금', 'tax'], ['세전 순매출', 'netSales'], ['재료', 'material'], ['고정 지출', 'fixed'], ['순이익', 'profit']] as const)
    : baseProfitFields;
  return <>
      <ScrollTabs tabs={[`${ready.input.base_servings}인분`, '1인분']} active={batch ? 0 : 1} onChange={i => { setBatch(i === 0); onComparisonChange?.(i === 0 ? 'batch' : 'one'); }} />
      <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>{ready.context.currencyCode} · {taxApplied ? '세금 포함' : '세금 별도'}</Text>
      {batch ? <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>1인분 계산 결과를 기준 인분으로 비교해요.</Text> : null}
      {profitFields.map(([label, key]) =>
        <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.md }}>
          <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{label}</Text><Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{money(key === 'material' ? combinedMaterialCost(row.material,row.extra) : row[key], ready.context)}</Text>
        </View>)}
      <Text style={{ ...TYPE.body, color: COLOR.text.secondary }}>{row.profitRate === null ? '순이익률 산출 전' : formatPercent(row.profitRate)}</Text>
      {row.meetsTarget !== null ? <Text style={{ ...TYPE.caption, color: row.meetsTarget ? COLOR.status.positive : COLOR.status.negative }}>{row.meetsTarget ? '목표 달성' : '목표 미달'}</Text> : null}
      {row.material === null || row.extra === null ? <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>재료 단가가 확인되면 순이익을 계산할 수 있어요.</Text> : null}
      {row.fixed === null ? <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>이번 달 고정 지출 배분 기준이 없어 순이익을 계산할 수 없어요.</Text> : null}
      <RecommendationRow value={ready.recommendation} context={ready.context} target={ready.input.target_profit_rate} />
  </>;
}
export function RecipeDraftPreview({ input, baseServings = 1 }: { input: DraftPreviewInput | null; baseServings?: number }) {
  const query = useRecipeDraftPreview(input); const data = query.data;
  const [comparison, setComparison] = useState<'one' | 'batch'>('one');
  const ready = data?.status === 'ready' ? data : null;
  if (!input) return <RecipeProfitRows data={null} baseServings={baseServings} comparison={comparison} onComparisonChange={setComparison} />;
  return <View><QueryState isLoading={query.isFetching} error={query.error} isEmpty={false} emptyTitle="" onRetry={() => { void query.refetch(); }}>
    {data?.status === 'unavailable' ? <Text style={{ ...TYPE.body, color: COLOR.text.secondary }}>{unavailable(data.reason)}</Text> : null}
    {ready?.status === 'ready' ? <>
      <RecipeProfitRows data={ready} comparison={comparison} onComparisonChange={setComparison} showRecommendation={false} />
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
