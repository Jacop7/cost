import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSalesLifecycleClock, useSalesLifecycleObserver } from '@/features/business-day/businessDay';
import { qk } from '@/lib/queryClient';

const transport = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: transport.rpc }) }));
vi.mock('expo-secure-store', () => ({}));
vi.mock('@/lib/supabase', async original => await original<typeof import('@/lib/supabase')>());
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => '00000000-0000-4000-8000-000000000001' }));

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);

beforeEach(() => {
  transport.rpc.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
});
afterEach(() => { cleanup(); client.clear(); });

it('구형 영업 상태 없이 서버 추천일과 basis 발행 판본을 읽는다', async () => {
  transport.rpc.mockResolvedValue({ data: {
    server_now: '2026-09-16T00:00:00Z', recommended_sales_date: '2026-09-15',
    editable_from: '2026-08-01', editable_to: '2026-09-15', phase: 'active',
    basis_current_revision: 7, basis_published_revision: 7,
  }, error: null });
  const { result } = renderHook(useSalesLifecycleClock, { wrapper });
  await waitFor(() => expect(result.current.data?.recommendedSalesDate).toBe('2026-09-15'));
  expect(result.current.data).toMatchObject({ basisCurrentRevision: 7, basisPublishedRevision: 7, phase: 'active' });
  expect(transport.rpc).toHaveBeenCalledWith('sales_lifecycle_clock', { p_store: '00000000-0000-4000-8000-000000000001' });
  expect(transport.rpc.mock.calls.some(([name]) => name === 'business_day_state')).toBe(false);
});

it('추천일이나 발행 판본이 바뀌면 clock 자신을 제외한 소비자만 갱신한다', async () => {
  let revision = 1;
  transport.rpc.mockImplementation(async () => ({ data: {
    server_now: '2026-09-16T00:00:00Z', recommended_sales_date: '2026-09-16',
    editable_from: '2026-08-01', editable_to: '2026-09-16', phase: 'active',
    basis_current_revision: revision, basis_published_revision: revision,
  }, error: null }));
  const dependentKeys = [qk.salesFeed('2026-09-01', '2026-09-16'), qk.recipes, qk.settings, qk.ingredients, qk.orders];
  dependentKeys.forEach(key => client.setQueryData(key, { cached: true }));
  renderHook(useSalesLifecycleObserver, { wrapper });
  await waitFor(() => expect(client.getQueryData(qk.salesClock)).toBeTruthy());
  dependentKeys.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(false));
  revision = 2;
  await act(async () => { await client.refetchQueries({ queryKey: qk.salesClock }); });
  await waitFor(() => dependentKeys.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(true)));
  expect(client.getQueryState(qk.salesClock)?.isInvalidated).toBe(false);
});
