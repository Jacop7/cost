import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useSavePurchaseOption, useDeletePurchaseOption, type PurchaseOptionInput } from '@/features/ingredients/hooks';
import { qk } from '@/lib/queryClient';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => 'store-a' }));
beforeEach(() => rpc.mockReset().mockResolvedValue({ data: 'option-a', error: null }));
const input = { ingredientId: 'ingredient-a', name: '구매 링크', vendorId: null, volume: 1000, amount: 4000, url: 'https://example.com' };

it('실제 저장·삭제 훅의 성공 콜백이 상세/수정내역 캐시를 갱신한다', async () => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const detail = qk.ingredient(input.ingredientId);
  const history = [...qk.changeHistory('ingredient',input.ingredientId),7];
  const wrapper = ({ children }: {children: ReactNode}) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const save = renderHook(() => useSavePurchaseOption(), {wrapper});
  const remove = renderHook(() => useDeletePurchaseOption(input.ingredientId), {wrapper});
  for (const operation of ['save','delete']) {
    [detail, history].forEach(key => qc.setQueryData(key, {}));
    await act(async () => { if(operation === 'save') await save.result.current.mutateAsync(input); else await remove.result.current.mutateAsync('option-a'); });
    expect(rpc.mock.lastCall?.[0]).toBe(operation === 'save' ? 'save_purchase_option' : 'delete_purchase_option');
    expect(qc.getQueryState(detail)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(history)?.isInvalidated).toBe(true);
  }
  qc.clear();
});

it('저장 실패는 성공 기록이나 갱신으로 취급하지 않는다', async () => {
  rpc.mockResolvedValue({ data: null, error: {message: '저장 실패'} });
  const qc = new QueryClient({defaultOptions: {mutations: {retry: false}}});
  const history = [...qk.changeHistory('ingredient',input.ingredientId),7];
  qc.setQueryData(history, {});
  const wrapper = ({children}: {children: ReactNode}) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const save = renderHook(() => useSavePurchaseOption(),{wrapper});
  await act(async () => { await expect(save.result.current.mutateAsync(input)).rejects.toThrow('저장 실패'); });
  expect(qc.getQueryState(history)?.isInvalidated).toBe(false);
  qc.clear();
});

it.each([{ code: '45009', details: 'REVISION_CONFLICT' }, { code: '40001', details: 'OPTION_EDIT_CONFLICT' }])('실제 수정 훅은 $code/$details·큰 판본을 유지하고 전역 retry 설정에도 재전송하지 않는다', async ({ code, details }) => {
  rpc.mockResolvedValue({ data: null, error: { message: '충돌', code, details } });
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: 2, retryDelay: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const save = renderHook(() => useSavePurchaseOption(), { wrapper });
  await act(async () => { await expect(save.result.current.mutateAsync({ ...input, id: 'option-a', expectedRevision: '9007199254740993' }))
    .rejects.toMatchObject({ code, details, message: '충돌' }); });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc.mock.lastCall?.[1].p_payload.expected_revision).toBe('9007199254740993');
  qc.clear();
});

it('신규 생성에는 판본 키가 없고 수정의 누락 판본은 네트워크 전에 차단한다', async () => {
  const qc = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const save = renderHook(() => useSavePurchaseOption(), { wrapper });
  await act(async () => { await save.result.current.mutateAsync(input); });
  expect(rpc.mock.lastCall?.[1].p_payload).not.toHaveProperty('expected_revision');
  // Deliberately cross the runtime boundary: old JS clients have no TS checker.
  await act(async () => { await expect(save.result.current.mutateAsync({ ...input, id: 'option-a' } as PurchaseOptionInput))
    .rejects.toMatchObject({ code: '22000', details: 'OPTION_BASE_REQUIRED' }); });
  expect(rpc).toHaveBeenCalledTimes(1); qc.clear();
});
