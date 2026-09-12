import { type ReactNode, useEffect, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { type Href, useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Input, QueryState } from '@/components/kit';
import { COLOR, COMPONENT, T, TYPE, space, won } from '@/theme/tokens';
import { formatPercent, recommendedPrice, scaleRecipeSimulation, taxRate } from '@margincook/core';
import { safeBack } from '@/lib/nav';
import { clampDecimals } from '@/lib/num';
import { useAppCapabilities } from '@/features/international-tax';
import { useRecipeDetail } from '../hooks';
import { previewRecipePrice } from '../priceSimulation';
import { useRecipeRecommendation } from '../draftPreviewQuery';
import { recipeSnapshotMoney } from '../RecipeInternationalComposition';
import { RecipeDetailHeading, RecipeDetailRow, RecipeDetailSubtotal } from '../components/RecipeDetailParts';
import { useRecipePriceSimulation } from '../priceSimulationQuery';

/** RCP-02c — 실제 판매가/원장은 건드리지 않는 독립 시뮬레이션 화면. */
function LegacyPriceSimulationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useRecipeDetail(id, { readOnly: true });
  const r = query.data;
  const [priceInput, setPriceInput] = useState('');
  const [dirty, setDirty] = useState(false);
  const [quantityOverride, setQuantityInput] = useState<string | null>(null);
  const quantityInput = quantityOverride ?? (r ? String(r.baseServings) : '');
  const quantity = parseQuantity(quantityInput);
  useEffect(() => { setPriceInput(''); setDirty(false); setQuantityInput(null); }, [id]);
  const price = dirty ? Number(priceInput) || 0 : r?.price ?? 0;
  const result = r ? previewRecipePrice(price, r.materialCost, r.extraCost, r.fixedRate, taxRate(r.taxItems)) : null;
  const comparison = r && result && quantity !== null ? scaleRecipeSimulation({ servings: 1, listedTotal: price, tax: result.tax,
    netSales: price - result.tax, customerTotal: price, material: r.materialCost, extra: r.extraCost, fixed: result.fixed,
    profit: result.profit, profitRate: result.rate, meetsTarget: result.rate * 100 >= r.targetProfitRate }, quantity) : null;
  const recommendation = r ? recommendedPrice(r.materialCost + r.extraCost, r.fixedRate, r.targetProfitRate / 100, taxRate(r.taxItems)) : null;
  const recommended = recommendation !== null && recommendation > 0 ? Math.round(recommendation / 100) * 100 : null;
  const money = (amount: number | null) => amount === null ? '산출 전' : `${won(Math.round(amount))}원`;
  const row = (label: string, amount: number | null) => <RecipeDetailRow key={label} inset label={label} value={money(amount)}
    secondary={amount !== null && comparison && comparison.listedTotal > 0 ? formatPercent(amount / comparison.listedTotal) : '—'} />;
  const meetsTarget = result ? result.rate * 100 >= (r?.targetProfitRate ?? 0) : null;
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="판매가 시뮬레이션" onBack={() => safeBack(('/recipes/' + id) as Href)} />
    <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
      <QueryState isLoading={query.isLoading} error={query.error} isEmpty={query.isFetched && !r} emptyTitle="메뉴를 찾을 수 없어요"
        onRetry={() => { void query.refetch(); }}>
        {r && result ? <SimulationCard suffix="원" quantityInput={quantityInput} onQuantityChange={setQuantityInput}
          input={dirty ? priceInput : String(r.price)} onInputChange={value => { setDirty(true); setPriceInput(clampDecimals(value, 0)); }}>
          {quantity === null ? <QuantityError /> : !comparison ? <Text style={{ ...TYPE.caption, color: COLOR.status.negative, padding: space.lg }}>판매량이 계산 가능한 금액 범위를 초과했어요.</Text> : <>
          {row('(−) 세금', comparison.tax)}
          {row('(−) 식재료 원가', comparison.material)}
          {row('(−) 고정 지출', comparison.fixed)}
          {row('(−) 부자재', comparison.extra)}
          <RecipeDetailRow inset label="순이익" value={money(comparison.profit)} sub={meetsTarget ? '목표 달성' : '목표 미달'}
            color={meetsTarget ? COLOR.status.positive : COLOR.status.negative} secondaryColor={COLOR.text.tertiary}
            secondary={formatPercent(result.rate)} last />
          <RecipeDetailSubtotal label="권장 판매가" sub={'목표 ' + r.targetProfitRate + '% 기준'}
            value={recommended === null ? '산출 불가' : won(recommended) + '원'} secondary={recommended === null ? undefined : r.targetProfitRate + '%'} />
          </>}
        </SimulationCard> : null}
      </QueryState>
    </ScrollView>
  </View>;
}

export default function RecipePriceSimulationScreen() {
  const cap = useAppCapabilities();
  const { id } = useLocalSearchParams<{ id: string }>();
  const error = cap.error ?? (!cap.isLoading && !cap.data ? new Error('세금 계산 방식을 확인하지 못했어요.') : null);
  if (cap.isLoading || error) return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="판매가 시뮬레이션" onBack={() => safeBack(`/recipes/${id}` as Href)} />
    <QueryState isLoading={cap.isLoading} error={error} isEmpty={false} emptyTitle="" onRetry={() => { void cap.refetch(); }}>{null}</QueryState>
  </View>;
  return cap.data?.internationalTax.readEnabled === false ? <LegacyPriceSimulationScreen key={id} /> : <InternationalSimulation key={id} id={id} />;
}

function parseQuantity(text: string): number | null {
  const quantity = Number(text);
  return /^\d+$/.test(text) && Number.isSafeInteger(quantity) && quantity >= 1 ? quantity : null;
}

function QuantityError() {
  return <Text style={{ ...TYPE.caption, color: COLOR.status.negative, padding: space.lg }}>판매량을 1인분 이상의 정수로 입력해 주세요.</Text>;
}

function SimulationCard({ input, onInputChange, quantityInput, onQuantityChange, suffix, exclusive = false, children }: {
  input: string; onInputChange: (value: string) => void; suffix?: string; exclusive?: boolean; children: ReactNode;
  quantityInput: string; onQuantityChange: (value: string) => void;
}) {
  const { fontScale } = useWindowDimensions();
  return <View style={{ gap: space.md }}>
    <Card pad={0} style={{ overflow: 'hidden' }}>
    <RecipeDetailHeading title="판매가 / 판매량" />
    <View testID="simulation-price-row" style={{ flexDirection: fontScale > 1.3 ? 'column' : 'row', alignItems: fontScale > 1.3 ? 'stretch' : 'center',
      gap: space.md, minHeight: COMPONENT.recipeSimulation.priceRowMinHeight, marginHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <Text style={{ ...TYPE.body, flex: 1, color: COLOR.text.primary }}>판매가</Text>
      <View testID="simulation-price-control" style={{ width: fontScale > 1.3 ? '100%' : '48%', minWidth: fontScale > 1.3 ? 0 : COMPONENT.recipeSimulation.priceInputMinWidth,
        maxWidth: fontScale > 1.3 ? undefined : COMPONENT.recipeSimulation.priceInputMaxWidth }}>
        <Input variant="stacked" mono suffix={suffix} accessibilityLabel="시뮬레이션 판매가" keyboardType="decimal-pad"
          value={input} onChangeText={onInputChange} />
      </View>
    </View>
    <View testID="simulation-quantity-row" style={{ flexDirection: fontScale > 1.3 ? 'column' : 'row', alignItems: fontScale > 1.3 ? 'stretch' : 'center',
      gap: space.md, minHeight: COMPONENT.recipeSimulation.priceRowMinHeight, marginHorizontal: space.lg, paddingVertical: space.md }}>
      <Text style={{ ...TYPE.body, flex: 1, color: COLOR.text.primary }}>판매량</Text>
      <View style={{ width: fontScale > 1.3 ? '100%' : '48%', minWidth: fontScale > 1.3 ? 0 : COMPONENT.recipeSimulation.priceInputMinWidth,
        maxWidth: fontScale > 1.3 ? undefined : COMPONENT.recipeSimulation.priceInputMaxWidth }}>
        <Input variant="stacked" mono suffix="인분" accessibilityLabel="시뮬레이션 판매량" keyboardType="number-pad"
          value={quantityInput} onChangeText={onQuantityChange} error={parseQuantity(quantityInput) === null} />
      </View>
    </View>
    </Card>
    <Card pad={0} style={{ overflow: 'hidden' }}>
    <RecipeDetailHeading title="판매 손익" sub={exclusive ? '세금 별도 판매가' : undefined} />
    {children}
    </Card>
  </View>;
}

function SimulationRecommendation({ id }: { id: string }) {
  const query = useRecipeRecommendation(id);
  const response = query.data;
  const data = response?.status === 'ready' ? response : null;
  return <QueryState isLoading={query.isFetching} error={query.error} isEmpty={false} emptyTitle="" onRetry={() => { void query.refetch(); }}>
    {data?.status === 'ready' ? <RecipeDetailSubtotal label="권장 판매가" sub={`목표 ${data.input.target_profit_rate}% 기준`}
      value={data.recommendation.status === 'ready' ? recipeSnapshotMoney(data.recommendation.price, data) : '산출 불가'}
      secondary={data.recommendation.status === 'ready' ? `${data.input.target_profit_rate}%` : undefined} /> : null}
    {data?.status === 'ready' && data.recommendation.status !== 'ready' ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary, padding: space.lg }}>
      {data.recommendation.status === 'basis_missing' ? '원가와 고정지출이 확인되면 계산할 수 있어요.' : data.recommendation.status === 'search_limit'
        ? '현재 조건의 최소 판매가를 확정하지 못했어요.' : '입력 가능한 가격 범위에서 목표를 달성할 수 없어요.'}
    </Text> : null}
    {query.data?.status === 'unavailable' ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary, padding: space.lg }}>현재 적용된 국가·세금 설정이 확인되면 권장 판매가를 표시해요.</Text> : null}
  </QueryState>;
}

function InternationalSimulation({ id }: { id: string }) {
  const detail = useRecipeDetail(id, { readOnly: true });
  const r = detail.data;
  const [input, setInput] = useState<string | null>(null);
  const [quantityOverride, setQuantityInput] = useState<string | null>(null);
  const quantityInput = quantityOverride ?? (r ? String(r.baseServings) : '');
  const quantity = parseQuantity(quantityInput);
  const text = input ?? (r ? String(r.price) : '');
  const price = /^\d+(?:\.\d+)?$/.test(text) && Number.isFinite(Number(text)) && Number(text) <= 90071992547409 ? Number(text) : null;
  const query = useRecipePriceSimulation(id, r ? price : null);
  const data = query.data;
  // Each price owns its result; loading cannot display another input's cached amounts.
  const ready = data?.status === 'ready' ? data : null;
  const context = ready?.context;
  const result = ready?.status === 'ready' && quantity !== null ? scaleRecipeSimulation(ready.one, quantity) : null;
  const exclusive = context?.priceBasis === 'tax_exclusive';
  const money = (amount: number | null) => amount === null || !context ? '산출 전' : context.currencyCode === 'KRW'
    ? `${new Intl.NumberFormat(context.locale, { maximumFractionDigits: 0 }).format(amount)}원`
    : new Intl.NumberFormat(context.locale, { style: 'currency', currency: context.currencyCode,
      minimumFractionDigits: context.minorUnit, maximumFractionDigits: context.minorUnit }).format(amount);
  const percent = (amount: number | null) => amount === null || !result || result.listedTotal <= 0 ? '—' : formatPercent(amount / result.listedTotal);
  const profitColor = result?.profit == null ? COLOR.text.primary
    : result.meetsTarget === false || result.profit < 0 ? COLOR.status.negative : COLOR.status.positive;
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="판매가 시뮬레이션" onBack={() => safeBack(`/recipes/${id}` as Href)} />
    <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
      <QueryState isLoading={detail.isLoading} error={detail.error} isEmpty={detail.isFetched && !r} emptyTitle="메뉴를 찾을 수 없어요"
        onRetry={() => { void detail.refetch(); void query.refetch(); }}>
        {r ? <SimulationCard
          quantityInput={quantityInput} onQuantityChange={setQuantityInput}
          input={text} onInputChange={setInput} suffix={context ? context.currencyCode === 'KRW' ? '원' : context.currencyCode : undefined} exclusive={exclusive}>
          {quantity === null ? <QuantityError /> : price === null ? <Text style={{ ...TYPE.caption, color: COLOR.status.negative, padding: space.lg }}>올바른 판매가를 입력해 주세요.</Text> :
            <QueryState isLoading={query.isFetching} error={query.error} isEmpty={false} emptyTitle="" onRetry={() => { void query.refetch(); }}>
              {data?.status === 'unavailable' ? <Text style={{ ...TYPE.caption, color: COLOR.text.secondary, padding: space.lg }}>{data.reason === 'not_active'
                ? '세금 설정이 아직 적용되기 전이에요. 적용 후 계산할 수 있어요.' : data.reason === 'disabled'
                  ? '현재 연결에서는 판매가 계산을 사용할 수 없어요.' : '현재 적용된 국가·세금 설정이 없어 계산할 수 없어요. MY에서 설정을 확인해 주세요.'}</Text> : null}
              {ready && !result ? <Text style={{ ...TYPE.caption, color: COLOR.status.negative, padding: space.lg }}>판매량이 계산 가능한 금액 범위를 초과했어요.</Text> : null}
              {result ? <>
                <RecipeDetailRow inset label={exclusive ? '별도 부과 세금' : '(−) 세금'} value={money(result.tax)} secondary={percent(result.tax)} />
                {exclusive ? <>
                  <RecipeDetailRow inset label="고객 결제액" value={money(result.customerTotal)} />
                  <RecipeDetailRow inset label="세전 순매출" value={money(result.netSales)} />
                </> : null}
                {([['식재료 원가', result.material], ['고정 지출', result.fixed], ['부자재', result.extra]] as const).map(([label, amount]) =>
                  <RecipeDetailRow key={label} inset label={`(−) ${label}`} value={money(amount)} secondary={percent(amount)} />)}
                <RecipeDetailRow inset label="순이익" sub={result.meetsTarget === null ? undefined : result.meetsTarget ? '목표 달성' : '목표 미달'}
                  value={money(result.profit)} color={profitColor} secondaryColor={COLOR.text.tertiary}
                  secondary={result.profitRate === null ? '이익률 산출 전' : formatPercent(result.profitRate)} last />
                {result.material === null ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary, padding: space.lg }}>식재료 단가가 확정되면 순이익을 계산할 수 있어요.</Text> : null}
                {result.fixed === null ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary, padding: space.lg }}>이번 달 고정지출 배분 기준이 없어 순이익을 계산할 수 없어요.</Text> : null}
                <SimulationRecommendation id={id} />
              </> : null}
            </QueryState>}
        </SimulationCard> : null}
      </QueryState>
    </ScrollView>
  </View>;
}
