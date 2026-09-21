import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SalesMenuDetailScreen from '@/features/sales/screens/SalesMenuDetailScreen';
vi.mock('expo-secure-store', () => ({}));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({ recipe: 'r', from: '2026-09-01', to: '2026-09-14' }), useRouter: () => ({ push: vi.fn() }), router: { canGoBack: () => false, replace: vi.fn() } }));
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => 'store' }));
vi.mock('@/features/business-day/businessDay', () => ({ useSalesBusinessDate: () => ({ date: '2026-09-14', isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock('@/features/recipes/hooks', () => ({ useRecipeDetail: () => ({ data: { name: '현재 메뉴', price: 10000, lines: [], extras: [], targetProfitRate: 40 }, isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: async (name: string) => ({ error: null, data: name === 'range_menu_detail'
  ? { sold: true, name: '과거 메뉴', qty: 3, revenue: 30000, unit_price: 10000, unit_material_cost: 2000,
    unit_extra_cost: 100, unit_fixed_cost: 1000, unit_tax: 1000, unit_profit: 6900,
    lines: [], extras: [{ name: '기간 포장비', qty: 3, amount: 300 }], fixed_items: [], price_points: [] }
  : { summary: {}, menu: [{ recipe_id: 'r', qty: 3, revenue: 30000, qty_hall: 3 }], daily: [], channels: [] } }) } }));
let client: QueryClient;
afterEach(() => { cleanup(); client?.clear(); });
it('실제 기간 조회 매퍼를 거친 과거 포장비는 원래 총액을 정확히 한 번 표시한다', async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><SalesMenuDetailScreen /></QueryClientProvider>);
  expect(await screen.findByText('기간 포장비')).toBeTruthy();
  expect(screen.getByText('300원')).toBeTruthy();
  expect(screen.queryByText('100원')).toBeNull();
  expect(screen.queryByText('900원')).toBeNull();
});
