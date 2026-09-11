import { LAUNCH_MARKETS, TAX_PRICE_BASES, TAX_TREATMENTS, type RecipeSimulationContext, type RecipeSimulationRow } from '@margincook/types';
import type { DraftPreviewInput } from './draftPreviewInput';
export type PreviewRow = Omit<RecipeSimulationRow, 'extra'> & { extra: number | null };
export type Recommendation = { status: 'ready'; price: number; profit: number; profitRate: number } |
  { status: 'basis_missing' | 'range_exhausted' | 'search_limit'; price: null; profit: null; profitRate: null };
export type DraftPreview = { input: DraftPreviewInput; localDate: string } & (
  { status: 'unavailable'; reason: string; context: null; one: null; batch: null; recommendation: null } |
  { status: 'ready'; reason: null; context: RecipeSimulationContext; one: PreviewRow; batch: PreviewRow; recommendation: Recommendation });
const bad = (): never => { throw new Error('현재 입력의 계산 결과를 확인하지 못했어요. 다시 시도해 주세요.'); };
const obj = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : bad();
const num = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) ? v : bad();
const nullable = (v: unknown) => v === null ? null : num(v);
const id = (v: unknown): string => typeof v === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v) ? v : bad();
const integer = (v: unknown, min = 0) => { const n = num(v); return Number.isSafeInteger(n) && n >= min ? n : bad(); };
const oneOf = <T extends string>(v: unknown, values: readonly T[]): T => values.includes(v as T) ? v as T : bad();
export const previewIdentity = (v: unknown): string => JSON.stringify(v, function (_key, value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value;
});
function parseRow(value: unknown, servings: number): PreviewRow {
  const r = obj(value); if (integer(r.servings, 1) !== servings) bad();
  return { servings, listedTotal: num(r.listed_total), tax: num(r.tax), customerTotal: num(r.customer_total), netSales: num(r.net_sales),
    material: nullable(r.material), extra: nullable(r.extra), fixed: nullable(r.fixed), profit: nullable(r.profit), profitRate: nullable(r.profit_rate),
    meetsTarget: r.meets_target === null ? null : typeof r.meets_target === 'boolean' ? r.meets_target : bad() };
}
export function parseDraftPreview(value: unknown, actorId: string, storeId: string, input?: DraftPreviewInput, recipeId?: string): DraftPreview {
  const r = obj(value), sent = obj(r.input);
  if (r.contract_version !== 1 || r.actor_id !== actorId || r.store_id !== storeId ||
    (input && previewIdentity(sent) !== previewIdentity(input)) || (recipeId && sent.recipe_id !== recipeId)) bad();
  if (sent.recipe_id !== null) id(sent.recipe_id);
  const price = num(sent.price), servings = integer(sent.base_servings, 1), target = num(sent.target_profit_rate);
  if (price < 0 || target < 0 || target > 100 || !Array.isArray(sent.lines) || !Array.isArray(sent.extras)) bad();
  const localDate = typeof r.local_date === 'string' ? r.local_date : bad();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || !Number.isFinite(Date.parse(localDate)) || new Date(localDate).toISOString().slice(0, 10) !== localDate) bad();
  const identity = { input: sent as DraftPreviewInput, localDate };
  if (r.status === 'unavailable') {
    if (['context', 'quote', 'one', 'batch', 'basis', 'recommendation'].some(k => r[k] !== null)) bad();
    return { ...identity, status: 'unavailable', reason: oneOf(r.reason, ['disabled', 'not_active', 'market_missing', 'tax_missing']), context: null, one: null, batch: null, recommendation: null };
  }
  if (r.status !== 'ready' || r.reason !== null) bad();
  const c = obj(r.context), b = obj(r.basis), q = obj(r.quote), rec = obj(r.recommendation);
  const countryCode = oneOf(c.country_code, ['KR', 'US', 'GB', 'AU', 'CA']), market = LAUNCH_MARKETS[countryCode];
  if (c.currency_code !== market.currencyCode || c.business_locale_code !== market.businessLocaleCode || c.minor_unit !== market.minorUnit || c.sales_channel_code !== 'hall') bad();
  const context: RecipeSimulationContext = { marketId: id(c.market_id), marketRevision: integer(c.market_revision, 1), countryCode,
    currencyCode: market.currencyCode, locale: market.businessLocaleCode, minorUnit: market.minorUnit,
    priceBasis: oneOf(c.price_basis, TAX_PRICE_BASES), taxProfileId: id(c.tax_profile_id), taxProfileRevision: integer(c.tax_profile_revision, 1),
    treatment: oneOf(c.treatment, TAX_TREATMENTS), taxCategory: c.tax_category === null ? null : typeof c.tax_category === 'string' ? c.tax_category : bad(),
    overrideRevision: integer(c.override_revision), salesChannel: 'hall' };
  if (b.fixed_month !== localDate.slice(0, 7) || b.target_profit_rate !== target || b.profit_rate_denominator !== 'listed_total' || b.batch_basis !== 'per_serving_comparison') bad();
  for (const key of ['missing_ingredient_price_ids', 'missing_material_price_ids']) {
    if (!Array.isArray(b[key])) bad(); (b[key] as unknown[]).forEach(id);
  }
  const material = nullable(b.material_per_serving), extra = nullable(b.extra_per_serving), fixedRate = nullable(b.fixed_rate);
  const one = parseRow(r.one, 1), batch = parseRow(r.batch, servings);
  if (one.listedTotal !== price || one.tax !== num(q.tax_total) || one.netSales !== num(q.net_sales) || one.customerTotal !== num(q.customer_total) || one.material !== material || one.extra !== extra) bad();
  if (price === 0 && (one.profitRate !== null || one.meetsTarget !== null || batch.profitRate !== null || batch.meetsTarget !== null)) bad();
  if (material === null || extra === null || fixedRate === null) {
    if ([one, batch].some(row => row.profit !== null || row.profitRate !== null || row.meetsTarget !== null)) bad();
  }
  let recommendation: Recommendation;
  if (rec.status === 'ready') {
    const recPrice = num(rec.price), recProfit = num(rec.profit), recRate = num(rec.profit_rate), rq = obj(rec.quote);
    if (material === null || extra === null || fixedRate === null || recPrice <= 0 || recPrice > 90071992547409 ||
      Number(recPrice.toFixed(context.minorUnit)) !== recPrice || recRate < target / 100 || num(rq.listed_total) !== recPrice) bad();
    recommendation = { status: 'ready', price: recPrice, profit: recProfit, profitRate: recRate };
  } else {
    if (['price', 'quote', 'profit', 'profit_rate'].some(k => rec[k] !== null)) bad();
    recommendation = { status: oneOf(rec.status, ['basis_missing', 'range_exhausted', 'search_limit']), price: null, profit: null, profitRate: null };
  }
  return { ...identity, status: 'ready', reason: null, context, one, batch, recommendation };
}
