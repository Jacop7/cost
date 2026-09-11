import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LAUNCH_MARKETS } from '@margincook/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { RecipeDraftPreview, RecipeRecommendation } from '@/features/recipes/RecipeDraftPreview';
import { actor, store, recipe, previewInput, previewRaw } from './fixtures/recipeDraftPreview';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), actor: '00000000-0000-4000-8000-000000000003' }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mock.rpc }, rpcError: (e: { message: string }) => new Error(e.message) }));
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => store, useSessionState: () => ({ userId: mock.actor }) }));
let client: QueryClient;
beforeEach(() => { mock.rpc.mockReset(); mock.actor = actor; client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); });
afterEach(() => { cleanup(); client.clear(); });
const wrap = (node: React.ReactNode) => <QueryClientProvider client={client}>{node}</QueryClientProvider>;
it('shows server quote, batch and recommendation; apply changes only parent input', async () => {
 const apply = vi.fn(); const input = previewInput(); mock.rpc.mockResolvedValue({ data: previewRaw(), error: null });
 render(wrap(<RecipeDraftPreview input={input} onApply={apply} />)); await screen.findByText('$7.87');
 expect(mock.rpc).toHaveBeenCalledWith('recipe_draft_preview', { p_store: store, p_input: input });
 fireEvent.click(screen.getByText('2인분')); await screen.findByText('$15.74');
 fireEvent.click(screen.getByRole('button', { name: '권장 판매가 적용' })); expect(apply).toHaveBeenCalledWith(4); expect(mock.rpc).toHaveBeenCalledTimes(1);
});
it('late ingredient/serving response cannot replace a changed draft', async () => {
 let resolve!: (v: unknown) => void; const first = previewInput(); const next = { ...first, base_servings: 5, lines: [{ ...first.lines[0]!, input_qty: 500 }] };
 mock.rpc.mockImplementation((_name, { p_input }) => p_input.base_servings === 2 ? new Promise(r => { resolve = r; }) : Promise.resolve({ data: previewRaw(next, 3), error: null }));
 const view = render(wrap(<RecipeDraftPreview input={first} />)); await waitFor(() => expect(mock.rpc).toHaveBeenCalledTimes(1));
 view.rerender(wrap(<RecipeDraftPreview input={next} />)); await screen.findByText('$3.00');
 await act(async () => resolve({ data: previewRaw(), error: null })); expect(screen.queryByText('$7.87')).toBeNull();
});
it('incomplete input disables query and clears the prior result', async () => {
 mock.rpc.mockResolvedValue({ data: previewRaw(), error: null }); const view = render(wrap(<RecipeDraftPreview input={previewInput()} />)); await screen.findByText('$7.87');
 view.rerender(wrap(<RecipeDraftPreview input={null} />)); expect(screen.queryByText('$7.87')).toBeNull(); expect(mock.rpc).toHaveBeenCalledTimes(1);
});
it('actor change isolates cache and rejects an old actor response', async () => {
 mock.rpc.mockResolvedValue({ data: previewRaw(), error: null }); const view = render(wrap(<RecipeDraftPreview input={previewInput()} />)); await screen.findByText('$7.87');
 mock.actor = store; view.rerender(wrap(<RecipeDraftPreview input={previewInput()} />)); await screen.findByText('정보를 불러오지 못했어요'); expect(screen.queryByText('$7.87')).toBeNull();
});
it('missing RPC and retry preserve the exact unsaved body', async () => {
 const input = previewInput(); mock.rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing rpc' } }).mockResolvedValue({ data: previewRaw(), error: null });
 render(wrap(<RecipeDraftPreview input={input} />)); await screen.findByText('정보를 불러오지 못했어요'); fireEvent.click(screen.getByText('다시 시도')); await screen.findByText('$7.87');
 expect(mock.rpc.mock.calls.every(([name, args]) => name === 'recipe_draft_preview' && args.p_input === input)).toBe(true);
});
it('saved recommendation uses its own read-only server snapshot endpoint', async () => {
 mock.rpc.mockResolvedValue({ data: previewRaw({ ...previewInput(), recipe_id: recipe }), error: null });
 render(wrap(<RecipeRecommendation recipeId={recipe} />)); await screen.findByText('$4.00'); expect(mock.rpc).toHaveBeenCalledWith('recipe_price_recommendation', { p_store: store, p_recipe: recipe });
});
it('draft batch selection survives changed input and pending response', async () => {
 let finish!: (value: unknown) => void;
 const first = previewInput();
 const next = { ...first, price: 15, lines: [{ ...first.lines[0]!, input_qty: 500 }] };
 mock.rpc.mockImplementation((_name, { p_input }) => p_input.price === first.price
   ? Promise.resolve({ data: previewRaw(first), error: null })
   : new Promise(resolve => { finish = resolve; }));
 const view = render(wrap(<RecipeDraftPreview input={first} />));
 await screen.findByText('$7.87');
 fireEvent.click(screen.getByRole('tab', { name: '2인분' }));
 expect(displayedRow('순이익').getByText('$15.74')).toBeTruthy();
 view.rerender(wrap(<RecipeDraftPreview input={next} />));
 await screen.findByText('불러오는 중이에요');
 expect(screen.queryByText('순이익')).toBeNull();
 await act(async () => finish({ data: previewRaw(next, 3), error: null }));
 expect((await screen.findByRole('tab', { name: '2인분' })).getAttribute('aria-selected')).toBe('true');
 expect(displayedRow('순이익').getByText('$6.00')).toBeTruthy();
 expect(displayedRow('순이익').queryByText('$3.00')).toBeNull();
});
const displayedRow = (label: string) => within(screen.getByText(label).parentElement!);
it.each(['KR', 'US', 'GB', 'AU', 'CA'] as const)('saved profit displays current %s snapshot, not recommended-price profit', async country => {
 const market = LAUNCH_MARKETS[country];
 const input = { ...previewInput(), recipe_id: recipe, price: country === 'KR' ? 12000 : 12.34 };
 const raw = previewRaw(input);
 Object.assign(raw.context, { country_code: country, currency_code: market.currencyCode, business_locale_code: market.businessLocaleCode,
   minor_unit: market.minorUnit, price_basis: country === 'US' || country === 'CA' ? 'tax_exclusive' : 'tax_inclusive' });
 const tax = country === 'KR' ? 1091 : 1.23;
 const net = raw.context.price_basis === 'tax_exclusive' ? input.price : input.price - tax;
 const customer = raw.context.price_basis === 'tax_exclusive' ? input.price + tax : input.price;
 Object.assign(raw.quote, { tax_total: tax, net_sales: net, customer_total: customer });
 Object.assign(raw.one, { tax, net_sales: net, customer_total: customer });
 Object.assign(raw.batch, { tax: tax * 2, net_sales: net * 2, customer_total: customer * 2 });
 const format = (value: number) => new Intl.NumberFormat(market.businessLocaleCode, { style: 'currency', currency: market.currencyCode }).format(value);
 mock.rpc.mockResolvedValue({ data: raw, error: null });
 render(wrap(<RecipeRecommendation recipeId={recipe} showProfit />));
 await screen.findByText('세전 순매출');
 expect(displayedRow('순이익').getByText(format(raw.one.profit))).toBeTruthy();
 expect(displayedRow('순이익').queryByText(format(raw.recommendation.profit))).toBeNull();
 expect(displayedRow('세전 순매출').getByText(format(net))).toBeTruthy();
 expect(displayedRow('고객 결제액').getByText(format(customer))).toBeTruthy();
 fireEvent.click(screen.getByText('2인분'));
 expect(displayedRow('순이익').getByText(format(raw.batch.profit))).toBeTruthy();
 expect(screen.queryByRole('button', { name: '권장 판매가 적용' })).toBeNull();
 expect(mock.rpc).toHaveBeenCalledTimes(1);
 expect(mock.rpc).toHaveBeenCalledWith('recipe_price_recommendation', { p_store: store, p_recipe: recipe });
});
it('saved missing basis stays unknown in both serving modes', async () => {
 const raw = previewRaw({ ...previewInput(), recipe_id: recipe });
 const data = { ...raw, basis: { ...raw.basis, material_per_serving: null, fixed_rate: null },
   one: { ...raw.one, material: null, fixed: null, profit: null, profit_rate: null, meets_target: null },
   batch: { ...raw.batch, material: null, fixed: null, profit: null, profit_rate: null, meets_target: null },
   recommendation: { status: 'basis_missing', price: null, quote: null, profit: null, profit_rate: null } };
 mock.rpc.mockResolvedValue({ data, error: null });
 render(wrap(<RecipeRecommendation recipeId={recipe} showProfit />)); await screen.findByText('이익률 산출 전');
 expect(displayedRow('순이익').getByText('산출 전')).toBeTruthy();
 fireEvent.click(screen.getByText('2인분')); expect(displayedRow('순이익').getByText('산출 전')).toBeTruthy();
 expect(screen.queryByText('목표 달성')).toBeNull();
});
it('saved zero remains zero without inventing a profit rate', async () => {
 const raw = previewRaw({ ...previewInput(), recipe_id: recipe, price: 0 });
 const data = { ...raw, quote: { ...raw.quote, tax_total: 0, net_sales: 0, customer_total: 0 },
   one: { ...raw.one, tax: 0, net_sales: 0, customer_total: 0, fixed: 0, profit: -2, profit_rate: null, meets_target: null },
   batch: { ...raw.batch, tax: 0, net_sales: 0, customer_total: 0, fixed: 0, profit: -4, profit_rate: null, meets_target: null } };
 mock.rpc.mockResolvedValue({ data, error: null });
 render(wrap(<RecipeRecommendation recipeId={recipe} showProfit />)); await screen.findByText('이익률 산출 전');
 expect(displayedRow('판매가 합계').getByText('$0.00')).toBeTruthy();
 expect(displayedRow('순이익').getByText('-$2.00')).toBeTruthy();
});
it('saved loading and missing RPC never fall back to a won estimate', async () => {
 let resolve!: (value: unknown) => void;
 mock.rpc.mockImplementation(() => new Promise(r => { resolve = r; }));
 render(wrap(<RecipeRecommendation recipeId={recipe} showProfit />));
 await screen.findByText('불러오는 중이에요'); expect(screen.queryByText('순이익')).toBeNull();
 await act(async () => resolve({ data: null, error: { code: 'PGRST202', message: 'missing rpc' } }));
 await screen.findByText('정보를 불러오지 못했어요'); expect(screen.queryByText('순이익')).toBeNull();
});
it('saved unavailable tax context does not show local profit', async () => {
 const raw = previewRaw({ ...previewInput(), recipe_id: recipe });
 mock.rpc.mockResolvedValue({ data: { ...raw, status: 'unavailable', reason: 'not_active', context: null,
   quote: null, basis: null, one: null, batch: null, recommendation: null }, error: null });
 render(wrap(<RecipeRecommendation recipeId={recipe} showProfit />));
 await screen.findByText('세금 설정이 적용된 후 계산할 수 있어요.'); expect(screen.queryByText('순이익')).toBeNull();
});
it('late saved response cannot replace another recipe current profit', async () => {
 let finish!: (value: unknown) => void;
 mock.rpc.mockImplementation((_name, { p_recipe }) => p_recipe === recipe
   ? new Promise(resolve => { finish = resolve; })
   : Promise.resolve({ data: previewRaw({ ...previewInput(), recipe_id: store }, 3), error: null }));
 const view = render(wrap(<RecipeRecommendation recipeId={recipe} showProfit />));
 await waitFor(() => expect(mock.rpc).toHaveBeenCalledTimes(1));
 view.rerender(wrap(<RecipeRecommendation recipeId={store} showProfit />));
 await screen.findByText('$3.00');
 await act(async () => finish({ data: previewRaw({ ...previewInput(), recipe_id: recipe }), error: null }));
 expect(displayedRow('순이익').getByText('$3.00')).toBeTruthy();
 expect(screen.queryByText('$7.87')).toBeNull();
});
