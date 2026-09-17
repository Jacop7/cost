import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useConfirmInbound } from '@/features/orders/hooks';
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc }, makeInboundKey: () => 'generated-key' }));
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => 'store', useSessionState: () => ({ userId: 'actor', storeId: 'store' }) }));
const mount = () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return renderHook(() => useConfirmInbound(), { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
};
beforeEach(() => { mocks.rpc.mockReset(); localStorage.clear(); });
afterEach(cleanup);
it('부분 입고 응답 유실 후 재마운트·입력 변경은 이전 요청 조회만 수행한다', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: '응답 유실', code: '' } });
  const first = mount();
  await act(async () => { await expect(first.result.current.mutateAsync({ orderId: 'order', ingredientId: 'ingredient', actualQty: 1, idempotencyKey: 'old' })).rejects.toThrow(); });
  first.unmount();
  mocks.rpc.mockResolvedValueOnce({ data: { status: 'recorded', order_id: 'order' }, error: null });
  const second = mount();
  await act(async () => { await expect(second.result.current.mutateAsync({ orderId: 'order', ingredientId: 'ingredient', actualQty: 2, idempotencyKey: 'changed' })).resolves.toMatchObject({ resolved: 'recorded' }); });
  expect(mocks.rpc.mock.calls.map(call => call[0])).toEqual(['record_current_inbound', 'resolve_order_inbound']);
  expect(mocks.rpc.mock.calls[1]![1]).toEqual({ p_store: 'store', p_order: 'order', p_request_key: 'old' });
});
it.each(['40001', '22000', '45010', '42501', 'P0002'])('서버 확정 거절 %s는 키를 해제하고 코드를 보존한다', async code => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: '거절', code } });
  const view = mount();
  await act(async () => { await expect(view.result.current.mutateAsync({ orderId: 'order', ingredientId: 'ingredient', actualQty: 1, idempotencyKey: 'old' })).rejects.toMatchObject({ code }); });
  expect(localStorage.length).toBe(0);
});
it('성공 응답의 발주·반영 수량이 확인되지 않으면 키를 지우지 않는다', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: { order_id: 'other', received_qty: 1 }, error: null });
  const view = mount();
  await act(async () => { await expect(view.result.current.mutateAsync({ orderId: 'order', ingredientId: 'ingredient', actualQty: 1, idempotencyKey: 'old' })).rejects.toThrow('결과'); });
  expect(localStorage.length).toBe(1);
  mocks.rpc.mockResolvedValueOnce({ data: { status: 'recorded', order_id: 'wrong' }, error: null });
  await act(async () => { await expect(view.result.current.resolvePending({ orderId: 'order', ingredientId: 'ingredient' })).rejects.toThrow('결과'); });
  expect(localStorage.length).toBe(1);
  expect(mocks.rpc.mock.calls[1]![0]).toBe('resolve_order_inbound');
});
