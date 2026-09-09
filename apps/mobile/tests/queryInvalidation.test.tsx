import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { useDeactivateMaterial, useSaveCategory, useSaveMaterial, useSaveVendor } from '@/features/master-data/hooks';
import { useAmendPastSale, useSaveSale } from '@/features/sales/hooks';
import { usePlaceOrders } from '@/features/orders/hooks';
import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => 'store-1' }));

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
const rpc = () => vi.spyOn(supabase, 'rpc');
const saleInput = (qty: number) => ({
  date: '2026-09-09', baseRevision: 1,
  items: [{ recipeId: 'recipe-1', qtyHall: qty, qtyDelivery: 0, qtyTakeout: 0, qtyWaste: 0 }],
});

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
});
afterEach(() => qc.clear());

describe('저장 성공 후 소비 화면의 데이터 갱신', () => {
  it.each([1, 0])('판매 목표 수량 %i 저장 후 열려 있는 레시피 부족·재고·판매량을 다시 읽는다', async (qty) => {
    rpc().mockResolvedValue({ data: { items: [], day_opened: false }, error: null } as never);
    qc.setQueryData(qk.recipes, [{ blockedBy: '대파' }]);
    qc.setQueryData(qk.recipe('recipe-1'), { stockTotal: -100, sales30d: { qty: 9 } });
    const listRead = vi.fn(async () => [{ blockedBy: null }]);
    const detailRead = vi.fn(async () => ({ stockTotal: 500, sales30d: { qty: 9 + qty } }));
    const { result } = renderHook(() => ({
      save: useSaveSale(),
      list: useQuery({ queryKey: qk.recipes, queryFn: listRead }),
      detail: useQuery({ queryKey: qk.recipe('recipe-1'), queryFn: detailRead }),
    }), { wrapper });
    expect(listRead).not.toHaveBeenCalled();
    await act(async () => { await result.current.save.mutateAsync(saleInput(qty)); });
    await waitFor(() => {
      expect(result.current.list.data).toEqual([{ blockedBy: null }]);
      expect(result.current.detail.data).toEqual({ stockTotal: 500, sales30d: { qty: 9 + qty } });
    });
    expect(listRead).toHaveBeenCalledOnce();
    expect(detailRead).toHaveBeenCalledOnce();
  });

  it('종료된 날 정정도 캐시된 레시피 재고와 판매량을 무효화한다', async () => {
    rpc().mockResolvedValue({ data: { changed: true, created: false, revision: 2, audit_revision_no: 1, basis_quality: 'exact', items: [] }, error: null } as never);
    qc.setQueryData(qk.recipes, [{ blockedBy: null }]);
    qc.setQueryData(qk.recipe('recipe-1'), { sales30d: { qty: 10 } });
    const { result } = renderHook(() => useAmendPastSale(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ ...saleInput(0), date: '2026-09-08', reason: '판매 취소' }); });
    expect(qc.getQueryState(qk.recipes)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(qk.recipe('recipe-1'))?.isInvalidated).toBe(true);
  });

  it('카테고리 이름 저장 후 레시피 행이 새 이름으로 갱신된다', async () => {
    rpc().mockResolvedValue({ data: 'category-1', error: null } as never);
    qc.setQueryData(qk.recipes, [{ categoryName: '이전 분류' }]);
    const { result } = renderHook(() => ({
      save: useSaveCategory(),
      list: useQuery({ queryKey: qk.recipes, queryFn: async () => [{ categoryName: '새 분류' }] }),
    }), { wrapper });
    await act(async () => { await result.current.save.mutateAsync({ id: 'category-1', name: '새 분류', kind: 'recipe' }); });
    await waitFor(() => expect(result.current.list.data).toEqual([{ categoryName: '새 분류' }]));
  });

  it('구매처 이름 저장 후 발주판과 하위 조회가 함께 갱신된다', async () => {
    rpc().mockResolvedValue({ data: 'vendor-1', error: null } as never);
    const waitingKey = [...qk.orders, 'waiting'] as const;
    qc.setQueryData(qk.orders, [{ vendorName: '이전 구매처' }]);
    qc.setQueryData(waitingKey, [{ vendorName: '이전 구매처' }]);
    const { result } = renderHook(() => ({
      save: useSaveVendor(),
      board: useQuery({ queryKey: qk.orders, queryFn: async () => [{ vendorName: '새 구매처' }] }),
      waiting: useQuery({ queryKey: waitingKey, queryFn: async () => [{ vendorName: '새 구매처' }] }),
    }), { wrapper });
    await act(async () => { await result.current.save.mutateAsync({ id: 'vendor-1', name: '새 구매처' }); });
    await waitFor(() => {
      expect(result.current.board.data).toEqual([{ vendorName: '새 구매처' }]);
      expect(result.current.waiting.data).toEqual([{ vendorName: '새 구매처' }]);
    });
  });

  it('저장 실패는 소비 화면의 기존 캐시를 버리지 않는다', async () => {
    rpc().mockResolvedValue({ data: null, error: { message: '저장 실패' } } as never);
    qc.setQueryData(qk.recipes, [{ categoryName: '기존 분류' }]);
    qc.setQueryData(qk.orders, [{ vendorName: '기존 구매처' }]);
    const { result } = renderHook(() => useSaveCategory(), { wrapper });
    await act(async () => { await expect(result.current.mutateAsync({ name: '새 분류', kind: 'recipe' })).rejects.toThrow('저장 실패'); });
    expect(qc.getQueryState(qk.recipes)?.isInvalidated).toBe(false);
    expect(qc.getQueryState(qk.orders)?.isInvalidated).toBe(false);
  });

  it.each(['save', 'deactivate'] as const)('부자재 %s 후 레시피를 중복 요청하지 않는다', async (operation) => {
    rpc().mockResolvedValue({ data: null, error: null } as never);
    qc.setQueryData(qk.recipes, [{ materialCost: 100 }]);
    const readRecipes = vi.fn(async () => [{ materialCost: 200 }]);
    const { result } = renderHook(() => ({
      save: useSaveMaterial(),
      deactivate: useDeactivateMaterial(),
      list: useQuery({ queryKey: qk.recipes, queryFn: readRecipes }),
    }), { wrapper });
    await act(async () => {
      if (operation === 'save') {
        await result.current.save.mutateAsync({ id: 'material-1', name: '용기', categoryId: null, unitCost: 200 });
      } else {
        await result.current.deactivate.mutateAsync('material-1');
      }
    });
    await waitFor(() => expect(result.current.list.data).toEqual([{ materialCost: 200 }]));
    expect(readRecipes).toHaveBeenCalledOnce();
  });

  it('발주 등록은 주문만 갱신하고 레시피·재고 캐시는 유지한다', async () => {
    rpc().mockResolvedValue({ data: 'order-1', error: null } as never);
    for (const key of [qk.orders, qk.recipes, qk.ingredients]) qc.setQueryData(key, []);
    const { result } = renderHook(() => usePlaceOrders(), { wrapper });
    await act(async () => { await result.current.mutateAsync([{ ingredientId: 'ingredient-1', vendorId: null, volume: 1000, amount: 4000, qty: 1, expectedAt: '2026-09-10' }]); });
    expect(qc.getQueryState(qk.orders)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(qk.recipes)?.isInvalidated).toBe(false);
    expect(qc.getQueryState(qk.ingredients)?.isInvalidated).toBe(false);
  });
});
