import { combinedMaterialCost } from '../materialCost';
import { type ReactNode, useEffect, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { type Href, useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Input, QueryState } from '@/components/kit';
import { COLOR, COMPONENT, T, TYPE, space, won } from '@/theme/tokens';
import { formatMarketMoney, formatPercent, marketMoneyInputFormat, recommendedPrice, scaleRecipeSimulation, taxRate } from '@costkeep/core';
import type { LaunchCurrencyCode } from '@costkeep/types';
import { safeBack } from '@/lib/nav';
import { clampDecimals } from '@/lib/num';
import { useAppCapabilities } from '@/features/international-tax';
import { useRecipeDetail } from '../hooks';
import { previewRecipePrice } from '../priceSimulation';
import { useRecipeDraftPreview, useRecipeRecommendation } from '../draftPreviewQuery';
import { recipeSnapshotMoney } from '../RecipeInternationalComposition';
import { RecipeDetailHeading, RecipeDetailRow, RecipeDetailSubtotal } from '../components/RecipeDetailParts';
import { useRecipePriceSimulation } from '../priceSimulationQuery';
import { useRecipeDraft, type RecipeDraft } from '../draftStore';
import { draftPreviewInput } from '../draftPreviewInput';
import { useRecipeScope } from '../useRecipeScope';
import { useStoreSettings } from '@/features/settings/hooks';
import type { DraftPreview } from '../draftPreviewContract';




/** RCP-02c — 실제 판매가/원장은 건드리지 않는 독립 시뮬레이션 화면. */
function LegacyPriceSimulationScreen({ draft }: { draft?: RecipeDraft }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useRecipeDetail(id, { readOnly: true });
  const settings = useStoreSettings();
  const [priceInput, setPriceInput] = useState('');
  const [dirty, setDirty] = useState(false);
  const [quantityOverride, setQuantityInput] = useState<string | null>(null);
  const validDraft = draft ? draftPreviewInput({ ...draft, price: dirty ? priceInput : draft.price }) : null;
  const r = draft ? validDraft && settings.data ? {
    price: validDraft.price, baseServings: validDraft.base_servings, targetProfitRate: validDraft.target_profit_rate,
    materialCost: draft.lines.reduce((sum, line) => sum + line.inputQty / validDraft.base_servings * (line.unitPrice ?? 0), 0),
    extraCost: draft.extras.reduce((sum, extra) => sum + extra.amountPerServing, 0),
    fixedRate: query.data?.fixedRate ?? null, taxItems: settings.data.taxItems,
  } : null : query.data;
  const unknownMaterial = !!draft?.lines.some(line => line.unitPrice === null);
  const quantityInput = quantityOverride ?? (draft ? draft.baseServings : r ? String(r.baseServings) : '');
  const quantity = parseQuantity(quantityInput);
  useEffect(() => { setPriceInput(''); setDirty(false); setQuantityInput(null); }, [id]);
  const price = dirty ? Number(priceInput) || 0 : r?.price ?? 0;
  const result = r && r.fixedRate !== null
    ? previewRecipePrice(price, r.materialCost, r.extraCost, r.fixedRate, taxRate(r.taxItems)) : null;
  const comparison = r && result && quantity !== null ? scaleRecipeSimulation({ servings: 1, listedTotal: price, tax: result.tax,
    netSales: price - result.tax, customerTotal: price, material: unknownMaterial ? null : r.materialCost, extra: r.extraCost, fixed: result.fixed,
    profit: unknownMaterial ? null : result.profit, profitRate: unknownMaterial ? null : result.rate, meetsTarget: result.rate * 100 >= r.targetProfitRate }, quantity) : null;
  const recommendation = r && !unknownMaterial && r.fixedRate !== null
    ? recommendedPrice(r.materialCost + r.extraCost, r.fixedRate, r.targetProfitRate / 100, taxRate(r.taxItems)) : null;
  const recommended = recommendation !== null && recommendation > 0 ? Math.round(recommendation / 100) * 100 : null;
  const money = (amount: number | null) => amount === null ? '산출 전' : `${won(Math.round(amount))}원`;
  const row = (label: string, amount: number | null) => <RecipeDetailRow key={label} inset label={label} value={money(amount)}
    secondary={amount !== null && comparison && comparison.listedTotal > 0 ? formatPercent(amount / comparison.listedTotal) : '—'} />;
  const meetsTarget = result && !unknownMaterial ? result.rate * 100 >= (r?.targetProfitRate ?? 0) : null;
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="판매가 시뮬레이션" onBack={() => safeBack((draft ? `/recipes/add${id ? `?id=${id}` : ''}` : '/recipes/' + id) as Href)} />
    <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
      <QueryState isLoading={query.isLoading || !!draft && settings.isLoading} error={query.error ?? (draft ? settings.error : null)} isEmpty={!draft && query.isFetched && !r} emptyTitle={draft ? "메뉴 입력을 확인해 주세요." : "메뉴를 찾을 수 없어요"}
        onRetry={() => { void query.refetch(); if (draft) void settings.refetch(); }}>
        {r && result ? <SimulationCard currency="KRW" quantityInput={quantityInput} onQuantityChange={setQuantityInput}
          input={dirty ? priceInput : String(r.price)} onInputChange={value => { setDirty(true); setPriceInput(clampDecimals(value, 0)); }}>
          {draft && (!quantityInput.trim() || dirty && !priceInput.trim()) ? <EmptySimulationResults /> : quantity === null ? <QuantityError /> : !comparison ? <Text style={{ ...TYPE.caption, color: COLOR.status.negative, padding: space.lg }}>판매량이 계산 가능한 금액 범위를 초과했어요.</Text> : <>
          {row('(−) 세금', comparison.tax)}
          {row('(−) 재료', combinedMaterialCost(comparison.material, comparison.extra))}
          {row('(−) 고정 지출', comparison.fixed)}
          <RecipeDetailRow inset label="순이익" value={money(comparison.profit)} sub={meetsTarget === null ? undefined : meetsTarget ? '목표 달성' : '목표 미달'}
            color={meetsTarget === null ? COLOR.text.primary : meetsTarget ? COLOR.status.positive : COLOR.status.negative} secondaryColor={COLOR.text.tertiary}
            secondary={unknownMaterial ? '순이익률 산출 전' : formatPercent(result.rate)} last />
          <RecipeDetailSubtotal label="권장 판매가" sub={'목표 ' + r.targetProfitRate + '% 기준'}
            value={recommended === null ? '산출 불가' : won(recommended) + '원'} secondary={recommended === null ? undefined : r.targetProfitRate + '%'} />
          </>}
        </SimulationCard> : draft ? <SimulationCard currency="KRW" quantityInput={quantityInput} onQuantityChange={setQuantityInput}
          input={dirty ? priceInput : draft.price} onInputChange={value => { setDirty(true); setPriceInput(clampDecimals(value, 0)); }}>
          <EmptySimulationResults />
        </SimulationCard> : null}
      </QueryState>
    </ScrollView>
  </View>;
}

export default function RecipePriceSimulationScreen() {
  const cap = useAppCapabilities();
  const { id, draft } = useLocalSearchParams<{ id: string; draft?: string }>();
  const error = cap.error ?? (!cap.isLoading && !cap.data ? new Error('세금 계산 방식을 확인하지 못했어요.') : null);
  if (cap.isLoading || error) return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="판매가 시뮬레이션" onBack={() => safeBack((draft === '1' ? `/recipes/add${id ? `?id=${id}` : ''}` : `/recipes/${id}`) as Href)} />
    <QueryState isLoading={cap.isLoading} error={error} isEmpty={false} emptyTitle="" onRetry={() => { void cap.refetch(); }}>{null}</QueryState>
  </View>;
  if (draft === '1') return <DraftSimulation key={id ?? 'new'} id={id} legacy={cap.data?.internationalTax.readEnabled === false} />;
  return cap.data?.internationalTax.readEnabled === false ? <LegacyPriceSimulationScreen key={id} /> : <InternationalSimulation key={id} id={id} />;
}

function parseQuantity(text: string): number | null {
  const quantity = Number(text);
  return /^\d+$/.test(text) && Number.isSafeInteger(quantity) && quantity >= 1 ? quantity : null;
}

function QuantityError() {
  return <Text style={{ ...TYPE.caption, color: COLOR.status.negative, padding: space.lg }}>판매량을 1인분 이상의 정수로 입력해 주세요.</Text>;
}

function SimulationCard({ input, onInputChange, quantityInput, onQuantityChange, currency = 'KRW', exclusive = false, children }: {
  input: string; onInputChange: (value: string) => void; currency?: LaunchCurrencyCode; exclusive?: boolean; children: ReactNode;
  quantityInput: string; onQuantityChange: (value: string) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const inputFormat = marketMoneyInputFormat(currency);
  return <View style={{ gap: space.md }}>
    <Card pad={0} style={{ overflow: 'hidden' }}>
    <RecipeDetailHeading title="판매가 / 판매량" />
    <View testID="simulation-price-row" style={{ flexDirection: fontScale > 1.3 ? 'column' : 'row', alignItems: fontScale > 1.3 ? 'stretch' : 'center',
      gap: space.md, minHeight: COMPONENT.recipeSimulation.priceRowMinHeight, marginHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <Text style={{ ...TYPE.body, flex: 1, color: COLOR.text.primary }}>판매가</Text>
      <View testID="simulation-price-control" style={{ width: fontScale > 1.3 ? '100%' : '48%', minWidth: fontScale > 1.3 ? 0 : COMPONENT.recipeSimulation.priceInputMinWidth,
        maxWidth: fontScale > 1.3 ? undefined : COMPONENT.recipeSimulation.priceInputMaxWidth }}>
        <Input variant="stacked" mono prefix={inputFormat.prefix} suffix={inputFormat.suffix}
          numberFormat={{ fixedDigits: inputFormat.digits, group: inputFormat.group, decimal: inputFormat.decimal }}
          accessibilityLabel="시뮬레이션 판매가" keyboardType="decimal-pad"
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
    <View testID="simulation-summary"><Card pad={0} style={{ overflow: 'hidden' }}>
    <RecipeDetailHeading title="판매 손익" sub={exclusive ? '세금 별도' : undefined} />
    {children}
    </Card></View>
  </View>;
}

/** 입력 전 표시값. 서버 견적이나 저장 가능한 계산 결과를 만들지 않는다. */
function EmptySimulationResults() {
  return <>
    {['(−) 세금', '(−) 재료', '(−) 고정 지출', '순이익'].map((label, index) =>
      <RecipeDetailRow key={label} inset label={label} value="0원" secondary="0%" last={index === 4} />)}
    <RecipeDetailSubtotal label="권장 판매가" value="0원" secondary="0%" />
  </>;
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
      {data.recommendation.status === 'basis_missing' ? '원가와 고정 지출이 확인되면 계산할 수 있어요.' : data.recommendation.status === 'search_limit'
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
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="판매가 시뮬레이션" onBack={() => safeBack(`/recipes/${id}` as Href)} />
    <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
      <QueryState isLoading={detail.isLoading} error={detail.error} isEmpty={detail.isFetched && !r} emptyTitle="메뉴를 찾을 수 없어요"
        onRetry={() => { void detail.refetch(); void query.refetch(); }}>
        {r ? <SimulationCard
          quantityInput={quantityInput} onQuantityChange={setQuantityInput}
          input={text} onInputChange={setInput} currency={context?.currencyCode ?? 'KRW'} exclusive={exclusive}>
          {quantity === null ? <QuantityError /> : price === null ? <Text style={{ ...TYPE.caption, color: COLOR.status.negative, padding: space.lg }}>올바른 판매가를 입력해 주세요.</Text> :
            <QueryState isLoading={query.isFetching} error={query.error} isEmpty={false} emptyTitle="" onRetry={() => { void query.refetch(); }}>
              {data?.status === 'unavailable' ? <Text style={{ ...TYPE.caption, color: COLOR.text.secondary, padding: space.lg }}>{data.reason === 'not_active'
                ? '세금 설정이 아직 적용되기 전이에요. 적용 후 계산할 수 있어요.' : data.reason === 'disabled'
                  ? '현재 연결에서는 판매가 계산을 사용할 수 없어요.' : '현재 적용된 국가·세금 설정이 없어 계산할 수 없어요. MY에서 설정을 확인해 주세요.'}</Text> : null}
              {ready && !result ? <Text style={{ ...TYPE.caption, color: COLOR.status.negative, padding: space.lg }}>판매량이 계산 가능한 금액 범위를 초과했어요.</Text> : null}
              {ready?.status === 'ready' ? <SimulationResults ready={ready} quantity={quantity} recommendation={<SimulationRecommendation id={id} />} /> : null}
            </QueryState>}
        </SimulationCard> : null}
      </QueryState>
    </ScrollView>
  </View>;
}

function SimulationResults({ ready, quantity, recommendation }: {
  ready: Pick<Extract<DraftPreview, { status: 'ready' }>, 'one' | 'context'>;
  quantity: number | null; recommendation: ReactNode;
}) {
  const context = ready.context;
  const result = quantity === null ? null : scaleRecipeSimulation(ready.one, quantity);
  const exclusive = context?.priceBasis === 'tax_exclusive';
  const money = (amount: number | null) => amount === null || !context ? '산출 전' : formatMarketMoney(amount, context.currencyCode);
  const percent = (amount: number | null) => amount === null || !result || result.listedTotal <= 0 ? '—' : formatPercent(amount / result.listedTotal);
  const profitColor = result?.profit == null ? COLOR.text.primary
    : result.meetsTarget === false || result.profit < 0 ? COLOR.status.negative : COLOR.status.positive;
  if (!result) return null;
  if ([result.listedTotal, result.tax, result.material, result.extra, result.fixed, result.profit].every(value => value === 0)) return <EmptySimulationResults />;
  return <>
                {!exclusive ? <RecipeDetailRow inset label="(−) 세금" value={money(result.tax)} secondary={percent(result.tax)} /> : null}
                {([['재료', combinedMaterialCost(result.material,result.extra)], ['고정 지출', result.fixed]] as const).map(([label, amount]) =>
                  <RecipeDetailRow key={label} inset label={`(−) ${label}`} value={money(amount)} secondary={percent(amount)} />)}
                <RecipeDetailRow inset label="순이익" sub={result.meetsTarget === null ? undefined : result.meetsTarget ? '목표 달성' : '목표 미달'}
                  value={money(result.profit)} color={profitColor} secondaryColor={COLOR.text.tertiary}
                  secondary={result.profitRate === null ? '순이익률 산출 전' : formatPercent(result.profitRate)} last />
                {result.material === null ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary, padding: space.lg }}>재료 단가가 확정되면 순이익을 계산할 수 있어요.</Text> : null}
                {result.fixed === null ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary, padding: space.lg }}>이번 달 고정 지출 배분 기준이 없어 순이익을 계산할 수 없어요.</Text> : null}
                {recommendation}
  </>;
}

function DraftSimulation({ id, legacy }: { id?: string; legacy: boolean }) {
  const draft = useRecipeDraft(s => s.draft);
  const scope = useRecipeScope();
  const valid = draft.scopeKey === JSON.stringify(scope) && (id ? draft.id === id && draft.loaded : !draft.id);
  const back = `/recipes/add${id ? `?id=${id}` : ''}` as Href;
  if (!valid) return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="판매가 시뮬레이션" onBack={() => safeBack(back)} />
    <Text style={{ ...TYPE.body, color: COLOR.text.secondary, padding: space.lg }}>메뉴 등록·수정 화면에서 다시 열어 주세요.</Text>
  </View>;
  return legacy ? <LegacyPriceSimulationScreen draft={draft} /> : <DraftInternationalSimulation draft={draft} back={back} />;
}

function DraftInternationalSimulation({ draft, back }: { draft: RecipeDraft; back: Href }) {
  const [text, setInput] = useState(draft.price);
  const [quantityInput, setQuantityInput] = useState(draft.baseServings);
  const quantity = parseQuantity(quantityInput);
  const input = draftPreviewInput({ ...draft, price: text });
  const query = useRecipeDraftPreview(input);
  const ready = input && query.data?.status === 'ready' ? query.data : null;
  const context = ready?.context;
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="판매가 시뮬레이션" onBack={() => safeBack(back)} />
    <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
      <SimulationCard input={text} onInputChange={setInput} quantityInput={quantityInput} onQuantityChange={setQuantityInput}
        currency={context?.currencyCode ?? 'KRW'} exclusive={context?.priceBasis === 'tax_exclusive'}>
        {!input || !quantityInput.trim() ? <EmptySimulationResults /> : quantity === null ? <QuantityError /> :
          <QueryState isLoading={query.isFetching} error={query.error} isEmpty={false} emptyTitle="" onRetry={() => { void query.refetch(); }}>
            {query.data?.status === 'unavailable' ? <Text style={{ ...TYPE.caption, color: COLOR.text.secondary, padding: space.lg }}>현재 적용된 국가·세금 설정을 확인해 주세요.</Text> : null}
            {ready?.status === 'ready' && !scaleRecipeSimulation(ready.one, quantity) ? <Text style={{ ...TYPE.caption, color: COLOR.status.negative, padding: space.lg }}>판매량이 계산 가능한 금액 범위를 초과했어요.</Text> : null}
            {ready?.status === 'ready' ? <SimulationResults ready={ready} quantity={quantity} recommendation={
              <RecipeDetailSubtotal label="권장 판매가" sub={`목표 ${ready.input.target_profit_rate}% 기준`}
                value={ready.recommendation.status === 'ready' ? recipeSnapshotMoney(ready.recommendation.price, ready) : '산출 불가'}
                secondary={ready.recommendation.status === 'ready' ? `${ready.input.target_profit_rate}%` : undefined} />
            } /> : null}
          </QueryState>}
      </SimulationCard>
    </ScrollView>
  </View>;
}
