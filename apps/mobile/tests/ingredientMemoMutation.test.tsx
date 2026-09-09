import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSaveIngredientMemo } from '@/features/ingredients/hooks';
import { qk } from '@/lib/queryClient';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => 'store-memo-fixture' }));
const clients: QueryClient[] = [];

function fixture() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const listKey = qk.ingredients;
  const detailKey = qk.ingredient('ingredient-memo-fixture');
  client.setQueryData(listKey, [{ id: 'ingredient-memo-fixture', memo: 'before' }]);
  client.setQueryData(detailKey, { id: 'ingredient-memo-fixture', memo: 'before' });
  const invalidated = vi.spyOn(client, 'invalidateQueries');
  return { client, listKey, detailKey, invalidated, ...renderHook(() => useSaveIngredientMemo(), { wrapper }) };
}

// Real mutation hook and React Query cache, with only the transport/session mocked.
// SQL locking, CAS correctness and authenticated ACL require separate DB tests.
describe('식재료 메모 전용 실제 mutation 계약', () => {
  beforeEach(() => rpc.mockReset().mockResolvedValue({ data: 'ingredient-memo-fixture', error: null }));
  afterEach(() => { clients.splice(0).forEach(client => client.clear()); });

  for (const [memo, expectedMemo] of [['새 메모', '원본 메모'], ['', '삭제할 메모'], ['첫 메모', null]] as const) {
    it(`메모 ${JSON.stringify(memo)}와 원본 ${JSON.stringify(expectedMemo)}만 전달하고 성공 후 상세·목록을 무효화한다`, async () => {
      const f = fixture();
      await act(async () => {
        await expect(f.result.current.mutateAsync({ id: 'ingredient-memo-fixture', memo, expectedMemo }))
          .resolves.toBe('ingredient-memo-fixture');
      });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith('save_ingredient', {
        p_store: 'store-memo-fixture',
        p_payload: { id: 'ingredient-memo-fixture', patch: 'memo', memo, expected_memo: expectedMemo },
      });
      expect(Object.keys(rpc.mock.calls[0]![1].p_payload).sort()).toEqual(['expected_memo', 'id', 'memo', 'patch']);
      expect(f.invalidated).toHaveBeenCalledWith({ queryKey: f.detailKey });
      expect(f.invalidated).toHaveBeenCalledWith({ queryKey: f.listKey });
      expect(f.client.getQueryState(f.detailKey)?.isInvalidated).toBe(true);
      expect(f.client.getQueryState(f.listKey)?.isInvalidated).toBe(true);
    });
  }

  for (const code of ['40001', '42501']) {
    it(`서버 ${code} 오류를 실패로 반환하며 성공 캐시 무효화를 실행하지 않는다`, async () => {
      rpc.mockResolvedValue({ data: null, error: { code, message: `메모 저장 거절 ${code}` } });
      const f = fixture();
      await act(async () => {
        await expect(f.result.current.mutateAsync({ id: 'ingredient-memo-fixture', memo: '초안', expectedMemo: '원본' }))
          .rejects.toThrow(`메모 저장 거절 ${code}`);
      });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(f.invalidated).not.toHaveBeenCalled();
      expect(f.client.getQueryState(f.detailKey)?.isInvalidated).toBe(false);
      expect(f.client.getQueryState(f.listKey)?.isInvalidated).toBe(false);
      expect(f.client.getQueryData(f.detailKey)).toEqual({ id: 'ingredient-memo-fixture', memo: 'before' });
    });
  }

  it('통신 실패를 성공으로 취급하지 않고 같은 원본값으로 명시적 재시도할 수 있다', async () => {
    rpc.mockRejectedValueOnce(new Error('연결 끊김'));
    const f = fixture();
    const input = { id: 'ingredient-memo-fixture', memo: '재시도 초안', expectedMemo: null };
    await act(async () => { await expect(f.result.current.mutateAsync(input)).rejects.toThrow('연결 끊김'); });
    expect(f.invalidated).not.toHaveBeenCalled();
    await act(async () => { await f.result.current.mutateAsync(input); });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0]);
    expect(f.client.getQueryState(f.detailKey)?.isInvalidated).toBe(true);
  });
});
