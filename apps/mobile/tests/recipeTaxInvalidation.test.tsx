import { CURRENT_STORE, QUOTE_CONTEXT } from './fixtures/internationalTaxCurrentContext';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSaveRecipe } from '@/features/recipes/hooks';
import { useRecipeTaxState } from '@/features/international-tax/hooks';
import { readRecipeIntent } from '@/features/recipes/intentStorage';
import { qk } from '@/lib/queryClient';

// Real mutation, quote parser, QueryClient and web journal; only RPC transport
// and the authenticated test scope are substituted. No database is contacted.
const transport = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: transport.rpc }) }));
vi.mock('expo-secure-store', () => ({}));
vi.mock('@/lib/supabase', async original => await original<typeof import('@/lib/supabase')>());
vi.mock('@/lib/SessionProvider', () => ({ useSessionState: () => ({ userId: 'tax-actor' }), useStoreId: () => CURRENT_STORE }));

const id = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const scope = { actorId: 'tax-actor', storeId: CURRENT_STORE };
const input = { patch: 'full' as const, id, expectedRevision: '1',
  requestId: '00000000-0000-4000-8000-000000000011', name: '메뉴', price: 22000, baseServings: 1, targetProfitRate: 30 };
const rawState = (saved = false) => ({
  capabilities: { contract_version: 1, minimum_supported_app_version: '0.2.0',
    international_tax: { contract_version: 'international_tax_v1', read_enabled: true, write_enabled: true, minimum_write_app_version: '0.2.0' } },
  tax_profile_id: id, tax_profile_revision: 1, default_treatment: 'taxable', override_revision: 0,
  effective_from: null, tax_category: null, treatment: null, currency_code: 'KRW', minor_unit: 0,
  price_basis: 'tax_inclusive', categories: [],
  quote_context: { ...QUOTE_CONTEXT, market: { ...QUOTE_CONTEXT.market, country_code: 'KR', region_code: null, currency_code: 'KRW', minor_unit: 0, business_locale_code: 'ko-KR', price_basis: 'tax_inclusive', effective_to: null } },
  quote: { listed_total: saved ? 22000 : 11000, net_sales: saved ? 20000 : 10000,
    customer_total: saved ? 22000 : 11000, tax_total: saved ? 2000 : 1000,
    merchant_tax_liability: saved ? 2000 : 1000, marketplace_tax_liability: 0, components: [] },
});
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
beforeEach(() => {
  localStorage.clear(); transport.rpc.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); localStorage.clear(); });
const reads = (recipeId: string) => transport.rpc.mock.calls.filter(([name, args]) => name === 'recipe_tax_app_state' && args.p_recipe === recipeId);
const useSubject = () => ({ save: useSaveRecipe(), tax: useRecipeTaxState(id), otherTax: useRecipeTaxState(otherId) });

it('price save refreshes only that recipe quote and preserves the other recipe and profile caches', async () => {
  let saved = false;
  transport.rpc.mockImplementation(async (name: string, args: { p_recipe?: string }) => {
    if (name === 'recipe_tax_app_state') return { data: rawState(args.p_recipe === id && saved), error: null };
    if (name !== 'save_recipe') throw new Error(`Unexpected RPC: ${name}`);
    saved = true; return { data: id, error: null };
  });
  client.setQueryData(qk.internationalTax, { profile: 'unchanged' });
  const { result } = renderHook(useSubject, { wrapper });
  await waitFor(() => {
    expect(result.current.tax.data?.quote?.listedTotal).toBe(11000);
    expect(result.current.otherTax.data?.quote?.listedTotal).toBe(11000);
    expect(result.current.save.intentReady).toBe(true);
  });
  expect(result.current.tax.data?.quoteContext?.market.currencyCode).toBe('KRW');
  const beforeContext = result.current.tax.data?.quoteContext;
  const otherQuote = result.current.otherTax.data;
  expect(reads(id)).toHaveLength(1);
  await act(async () => { await result.current.save.mutateAsync(input); });
  await waitFor(() => expect(result.current.tax.data?.quote).toMatchObject({ listedTotal: 22000, netSales: 20000, taxAmount: 2000 }));
  expect(result.current.tax.data?.quoteContext).toEqual(beforeContext);
  // React Query may retain equal context through structural sharing while the quote changes.
  expect(reads(id)).toHaveLength(2);
  expect(reads(id)[1]?.[1]).toEqual({ p_store: scope.storeId, p_recipe: id });
  expect(reads(otherId)).toHaveLength(1);
  expect(result.current.otherTax.data).toBe(otherQuote);
  expect(client.getQueryState(qk.recipeTax(otherId))?.isInvalidated).toBe(false);
  expect(client.getQueryState(qk.internationalTax)?.isInvalidated).toBe(false);
  expect(await readRecipeIntent(scope)).toBeNull();
});

it.each(['rejected', 'transport'] as const)('%s price save retains cached quotes without refetching', async failure => {
  transport.rpc.mockImplementation(async (name: string) => {
    if (name === 'recipe_tax_app_state') return { data: rawState(), error: null };
    if (name !== 'save_recipe') throw new Error(`Unexpected RPC: ${name}`);
    if (failure === 'transport') throw new Error('network lost');
    return { data: null, error: { code: '22000', message: '입력 거절', details: null } };
  });
  const { result } = renderHook(useSubject, { wrapper });
  await waitFor(() => {
    expect(result.current.tax.data?.quote?.listedTotal).toBe(11000);
    expect(result.current.otherTax.data?.quote?.listedTotal).toBe(11000);
    expect(result.current.save.intentReady).toBe(true);
  });
  const before = result.current.tax.data, otherBefore = result.current.otherTax.data;
  await act(async () => { await expect(result.current.save.mutateAsync(input)).rejects.toThrow(); });
  expect(result.current.tax.data).toBe(before);
  expect(result.current.otherTax.data).toBe(otherBefore);
  expect(reads(id)).toHaveLength(1); expect(reads(otherId)).toHaveLength(1);
  expect(client.getQueryState(qk.recipeTax(id))?.isInvalidated).toBe(false);
  expect(client.getQueryState(qk.recipeTax(otherId))?.isInvalidated).toBe(false);
  const intent = await readRecipeIntent(scope);
  if (failure === 'transport') expect(intent?.payload.request_id).toBe(input.requestId);
  else expect(intent).toBeNull();
});
