import { CURRENT_STORE, QUOTE_CONTEXT } from './fixtures/internationalTaxCurrentContext';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBusinessDay, useOpenBusinessDay, useCloseStaleAndOpen } from '@/features/business-day/businessDay';
import { useRecipeTaxState } from '@/features/international-tax/hooks';
import { qk } from '@/lib/queryClient';

// Real transition hooks, quote parser and QueryClient. Only transport and store
// identity are fixtures. No DB, device-clock rollover or tax calculation runs here.
const transport = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: transport.rpc }) }));
vi.mock('expo-secure-store', () => ({}));
vi.mock('@/lib/supabase', async original => await original<typeof import('@/lib/supabase')>());
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => CURRENT_STORE }));

const id = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
// Server response amounts from the F4-3 same-market boundary contract (DB 58).
// Reserved metadata stays on P1; the current quote follows the server date.
const rawState = (effective: boolean) => ({
  capabilities: { contract_version: 1, minimum_supported_app_version: '0.2.0',
    international_tax: { contract_version: 'international_tax_v1', read_enabled: true,
      write_enabled: true, minimum_write_app_version: '0.2.0' } },
  tax_profile_id: id, tax_profile_revision: 2, default_treatment: 'taxable', override_revision: 0,
  effective_from: null, tax_category: null, treatment: null, currency_code: 'KRW', minor_unit: 0,
  price_basis: 'tax_inclusive', categories: [],
  quote_context: { ...{ ...QUOTE_CONTEXT, market: { ...QUOTE_CONTEXT.market, country_code: 'KR', region_code: null, currency_code: 'KRW', minor_unit: 0, business_locale_code: 'ko-KR', price_basis: 'tax_inclusive', effective_to: null } }, local_date: effective ? '2026-09-02' : '2026-09-01', tax_profile_id: effective ? id : QUOTE_CONTEXT.tax_profile_id },
  quote: { listed_total: 12000, customer_total: 12000,
    net_sales: effective ? 10000 : 10909, tax_total: effective ? 2000 : 1091,
    merchant_tax_liability: effective ? 2000 : 1091, marketplace_tax_liability: 0, components: [] },
});
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
const useSubject = () => ({ open: useOpenBusinessDay(), catchUp: useCloseStaleAndOpen(),
  tax: useRecipeTaxState(id), otherTax: useRecipeTaxState(otherId) });
const reads = (recipeId: string) => transport.rpc.mock.calls.filter(
  ([name, args]) => name === 'recipe_tax_app_state' && args.p_recipe === recipeId);
const transitions = () => transport.rpc.mock.calls.filter(([name]) => name === 'transition_business_state');
beforeEach(() => {
  transport.rpc.mockReset();
  client = new QueryClient({ defaultOptions: {
    queries: { retry: false, staleTime: Infinity }, mutations: { retry: false },
  } });
});
afterEach(() => { cleanup(); client.clear(); });

it('a server-reported close refreshes current quotes without making a business-state mutation', async () => {
  let closed = false;
  transport.rpc.mockImplementation(async (name: string) => {
    if (name === 'recipe_tax_app_state') return { data: rawState(closed), error: null };
    if (name === 'business_day_state') return { data: {
      today: '2026-09-01', local_date: '2026-09-01', business_date: '2026-09-01', timezone: 'Asia/Seoul',
      status: closed ? 'closed' : 'open', business_day_id: id, hours: {},
    }, error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  });
  const { result } = renderHook(() => ({ business: useBusinessDay(), tax: useRecipeTaxState(id) }), { wrapper });
  await waitFor(() => expect(result.current.business.data?.status).toBe('open'));
  await waitFor(() => expect(result.current.tax.data?.quote?.taxAmount).toBe(1091));
  closed = true;
  await act(async () => { await result.current.business.refetch(); });
  await waitFor(() => expect(result.current.tax.data?.quote?.taxAmount).toBe(2000));
  expect(transitions()).toHaveLength(0);
});

it.each(['open', 'catchUp'] as const)('%s success refreshes both cached recipe quotes and invalidates application timing', async action => {
  let effective = false;
  transport.rpc.mockImplementation(async (name: string) => {
    if (name === 'recipe_tax_app_state') return { data: rawState(effective), error: null };
    if (name !== 'transition_business_state') throw new Error(`Unexpected RPC: ${name}`);
    effective = true;
    return { data: null, error: null };
  });
  client.setQueryData(qk.internationalTax, { profile: 'reserved P1' });
  client.setQueryData([...qk.internationalTax, 'capabilities'], { readEnabled: true });
  const profile = client.getQueryData(qk.internationalTax);
  const { result } = renderHook(useSubject, { wrapper });
  await waitFor(() => {
    expect(result.current.tax.data?.quote?.taxAmount).toBe(1091);
    expect(result.current.otherTax.data?.quote?.taxAmount).toBe(1091);
  });
  expect(result.current.tax.data?.quoteContext).toMatchObject({ localDate: '2026-09-01', taxProfileId: QUOTE_CONTEXT.tax_profile_id });
  expect(reads(id)).toHaveLength(1); expect(reads(otherId)).toHaveLength(1);
  await act(async () => { await result.current[action].mutateAsync({ closeTime: '23:00' }); });
  await waitFor(() => {
    expect(result.current.tax.data?.quote).toMatchObject({ taxAmount: 2000, netSales: 10000, listedTotal: 12000 });
    expect(result.current.otherTax.data?.quote).toMatchObject({ taxAmount: 2000, netSales: 10000, listedTotal: 12000 });
  });
  for (const tax of [result.current.tax, result.current.otherTax]) expect(tax.data?.quoteContext).toMatchObject({ localDate: '2026-09-02', taxProfileId: id });
  for (const recipeId of [id, otherId]) {
    expect(reads(recipeId)).toHaveLength(2);
    expect(reads(recipeId)[1]?.[1]).toEqual({ p_store: CURRENT_STORE, p_recipe: recipeId });
  }
  expect(transitions()).toEqual([['transition_business_state', {
    p_store: CURRENT_STORE, p_action: 'open', p_close_time: '23:00',
  }]]);
  expect(client.getQueryData(qk.internationalTax)).toBe(profile);
  expect(client.getQueryState(qk.internationalTax)?.isInvalidated).toBe(true);
  expect(client.getQueryState([...qk.internationalTax, 'capabilities'])?.isInvalidated).toBe(true);
  expect(transport.rpc.mock.calls).toHaveLength(5); // two initial reads + one open + two refreshes
});

it('failed open and catch-up keep both quote objects and fetch counts unchanged', async () => {
  transport.rpc.mockImplementation(async (name: string) => {
    if (name === 'recipe_tax_app_state') return { data: rawState(false), error: null };
    if (name !== 'transition_business_state') throw new Error(`Unexpected RPC: ${name}`);
    return { data: null, error: { code: '45014', message: '영업 상태가 변경됐어요', details: null } };
  });
  const { result } = renderHook(useSubject, { wrapper });
  await waitFor(() => {
    expect(result.current.tax.data?.quote?.taxAmount).toBe(1091);
    expect(result.current.otherTax.data?.quote?.taxAmount).toBe(1091);
  });
  const before = result.current.tax.data, otherBefore = result.current.otherTax.data;
  for (const action of ['open', 'catchUp'] as const) {
    await act(async () => { await expect(result.current[action].mutateAsync(undefined)).rejects.toThrow(); });
    expect(result.current.tax.data).toBe(before);
    expect(result.current.otherTax.data).toBe(otherBefore);
    expect(reads(id)).toHaveLength(1); expect(reads(otherId)).toHaveLength(1);
    expect(client.getQueryState(qk.recipeTax(id))?.isInvalidated).toBe(false);
    expect(client.getQueryState(qk.recipeTax(otherId))?.isInvalidated).toBe(false);
  }
  expect(transitions()).toHaveLength(2);
  expect(transport.rpc.mock.calls).toHaveLength(4);
});
