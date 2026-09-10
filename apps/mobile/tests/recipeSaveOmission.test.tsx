vi.mock('expo-secure-store', () => ({}));
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSaveRecipe } from '@/features/recipes/hooks';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/SessionProvider', () => ({ useSessionState: () => ({ userId: 'recipe-actor-a' }), useStoreId: () => 'store-recipe-omission' }));

let qc: QueryClient;
let rpc: ReturnType<typeof vi.spyOn>;
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);

describe('PRT-131 useSaveRecipe legacy 월평균 키 생략', () => {
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    rpc = vi.spyOn(supabase, 'rpc' as never).mockResolvedValue({ data: '00000000-0000-4000-8000-000000000001', error: null } as never);
  });

  it('호출자가 avgMonthlySales를 생략하면 save_recipe JSON에도 avg_monthly_sales를 만들지 않는다', async () => {
    const { result } = renderHook(() => useSaveRecipe(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        patch: 'full', requestId: '00000000-0000-4000-8000-000000000011', expectedRevision: '1',
        id: '00000000-0000-4000-8000-000000000001', name: '기존 메뉴', price: 12_000,
        baseServings: 10, targetProfitRate: 33.5,
      });
    });

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith('save_recipe', expect.objectContaining({
      p_store: 'store-recipe-omission',
      p_payload: expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000001', name: '기존 메뉴', price: 12_000,
        base_servings: 10, target_profit_rate: 33.5,
      }),
    }));
    const payload = (rpc.mock.calls[0]![1] as { p_payload: Record<string, unknown> }).p_payload;
    expect(payload).not.toHaveProperty('avg_monthly_sales');
  });
});

// This exercises the real mutation hook through a mocked Supabase RPC boundary.
// It does not execute save_recipe or prove the database COALESCE migration path.
