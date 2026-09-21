import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { useDeactivateMaterial, useSaveCategory, useSaveMaterial, useSaveVendor } from '@/features/master-data/hooks';
import { useAmendPastSale, useSaveSale } from '@/features/sales/hooks';
import { usePlaceOrders } from '@/features/orders/hooks';
import { useRevenueCheck, useSaveFixedCosts } from '@/features/my/hooks';
import { useQuickInboundBatch, useSaveIngredient, useStockChange } from '@/features/ingredients/hooks';
import { submitStockQuantity } from '@/features/ingredients/stockQuantityOperation';
import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/SessionProvider', () => ({
  useStoreId: () => 'store-1',
  useSessionState: () => ({ userId: 'user-1', storeId: 'store-1' }),
}));

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
const rpc = () => vi.spyOn(supabase, 'rpc');
// These hooks await RPC JSON only; the transport stub does not implement query chaining.
const respond = (handler: (name: string) => unknown) =>
  rpc().mockImplementation(name => Promise.resolve(handler(name)) as never);
const saleInput = (qty: number) => ({
  date: '2026-09-09', baseRevision: 1,
  items: [{ recipeId: 'recipe-1', qtyHall: qty, qtyDelivery: 0, qtyTakeout: 0, qtyWaste: 0 }],
});

beforeEach(() => {
  localStorage.clear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
});
afterEach(() => qc.clear());

describe('저장 성공 후 소비 화면의 데이터 갱신', () => {
  it('재료 정보 저장은 재고 원장을 쓰지 않고 목록·상세·설정·메뉴·발주·매출을 함께 갱신한다', async () => {
    const transport = respond(name => name === 'save_ingredient'
      ? { data: 'ingredient-1', error: null } : { data: null, error: null });
    const roots = [qk.ingredients, qk.ingredient('ingredient-1'), qk.settingsLists, qk.recipes, qk.orders, qk.sales];
    roots.forEach(key => qc.setQueryData(key, { stale: true }));
    const { result } = renderHook(() => useSaveIngredient(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'ingredient-1', name: '대파', categoryId: null,
        baseUnit: 'g', profileOnly: true, safetyStock: 2000, defaultVendorId: null, memo: null })).resolves.toBe('ingredient-1');
    });
    expect(transport.mock.calls.filter(([name]) => name === 'save_ingredient')).toHaveLength(1);
    expect(transport.mock.calls.some(([name]) => String(name).includes('stock'))).toBe(false);
    roots.forEach(key => expect(qc.getQueryState(key)?.isInvalidated).toBe(true));
  });

  it.each([
    ['deduct', { kind: 'out' as const, value: 0 }, 'record_current_stock_adjustment'],
    ['discard', { kind: 'waste' as const, value: 900 }, 'record_current_discard'],
  ])('%s 확정은 재료 상세·원장·발주 후보·메뉴 부족·매출 손익을 함께 갱신한다', async (_label, input, rpcName) => {
    const transport = respond(name => name === rpcName
      ? { data: rpcName === 'record_current_discard' ? { discarded: 100, skipped: false, unit_price: 4 } : null, error: null }
      : { data: null, error: null });
    const roots = [qk.ingredients, qk.ingredient('ingredient-1'), qk.stockHistory('ingredient-1'), qk.orders, qk.recipes, qk.sales];
    roots.forEach(key => qc.setQueryData(key, { stale: true }));
    const { result } = renderHook(() => useStockChange(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ ingredientId: 'ingredient-1', ...input }); });
    expect(transport.mock.calls.filter(([name]) => name === rpcName)).toHaveLength(1);
    roots.forEach(key => expect(qc.getQueryState(key)?.isInvalidated).toBe(true));
  });

  it('일괄 입고는 모든 재료별 상세·원장과 공통 소비 키를 중복 없이 갱신한다', async () => {
    const ingredientIds = ['ingredient-1', 'ingredient-2'];
    respond(name => name === 'record_current_quick_inbound_batch' ? { data: { items: ingredientIds.map((ingredientId, index) => ({
      client_item_id: `card-${index + 1}`, ingredient_id: ingredientId,
      stock_before: 1000, stock_after: 2000, inbound_unit_price: 4, base_price_after: 4,
      affected_recipes: 1, card_idempotency_key: `key-${index + 1}`, order_id: `order-${index + 1}`,
      inventory_event_id: `event-${index + 1}`,
    })) }, error: null } : { data: null, error: null });
    const roots = [qk.ingredients, ...ingredientIds.flatMap(id => [qk.ingredient(id), qk.stockHistory(id)]),
      qk.orders, qk.recipes, qk.sales];
    roots.forEach(key => qc.setQueryData(key, { stale: true }));
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useQuickInboundBatch(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ requestKey: '00000000-0000-4000-8000-000000000010', items: ingredientIds.map((ingredientId, index) => ({
        clientItemId: `card-${index + 1}`, ingredientId, vendorId: null, receivedQuantity: 1000, paidAmount: 4000,
      })) });
    });
    roots.forEach(key => expect(qc.getQueryState(key)?.isInvalidated).toBe(true));
    expect(invalidate.mock.calls.filter(([options]) => JSON.stringify(options?.queryKey) === JSON.stringify(qk.orders))).toHaveLength(1);
  });

  it.each([
    ['deduct', { kind: 'out' as const, value: 0 }, 'record_current_stock_adjustment'],
    ['discard', { kind: 'waste' as const, value: 900 }, 'record_current_discard'],
  ])('%s 실패는 소비 화면의 기존 캐시를 성공처럼 갱신하지 않는다', async (_label, input, rpcName) => {
    respond(name => name === rpcName ? { data: null, error: { message: '재고 쓰기 실패' } } : { data: null, error: null });
    const roots = [qk.ingredients, qk.ingredient('ingredient-1'), qk.stockHistory('ingredient-1'), qk.orders, qk.recipes, qk.sales];
    roots.forEach(key => qc.setQueryData(key, { stale: false }));
    const { result } = renderHook(() => useStockChange(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ ingredientId: 'ingredient-1', ...input })).rejects.toThrow('재고 쓰기 실패');
    });
    roots.forEach(key => expect(qc.getQueryState(key)?.isInvalidated).toBe(false));
  });

  it.each(['deduct', 'discard'] as const)('%s 응답 유실 확인도 원래 사건 종류의 전체 소비 화면을 갱신한다', async kind => {
    const scope = { actorId: 'user-1', storeId: 'store-1', ingredientId: 'ingredient-1' };
    await expect(submitStockQuantity(scope, `lost-${kind}`, kind,
      async () => { throw new Error('응답 유실'); }, async () => 'recorded')).rejects.toThrow('응답 유실');
    const transport = respond(name => name === 'resolve_stock_quantity'
      ? { data: { status: 'recorded' }, error: null } : { data: null, error: null });
    const roots = [qk.ingredients, qk.ingredient('ingredient-1'), qk.stockHistory('ingredient-1'), qk.orders, qk.recipes, qk.sales];
    roots.forEach(key => qc.setQueryData(key, { stale: true }));
    const { result } = renderHook(() => useStockChange(), { wrapper });
    await act(async () => {
      await expect(result.current.resolvePending('ingredient-1')).resolves.toEqual({ resolved: 'recorded', previousKind: kind });
    });
    expect(transport.mock.calls.filter(([name]) => name === 'resolve_stock_quantity')).toHaveLength(1);
    roots.forEach(key => expect(qc.getQueryState(key)?.isInvalidated).toBe(true));
    expect(localStorage.length).toBe(0);
  });

  it('월 실적 비교 키를 옮겨도 고정 지출 저장 후 수기 매출·요율 비교를 다시 읽는다', async () => {
    let written = false;
    const transport = respond(name => {
      if (name === 'fixed_cost_revenue_check') return { data: { month: '2026-09',
        manual_revenue: written ? 24000000 : 12000000, rate_manual: written ? 0.1 : 0.2 }, error: null };
      written = true;
      return { data: { month: '2026-09', rate: 0.1 }, error: null };
    });
    const { result } = renderHook(() => ({ save: useSaveFixedCosts(), check: useRevenueCheck('2026-09') }), { wrapper });
    await waitFor(() => expect(result.current.check.data?.rateManual).toBe(0.2));
    await act(async () => { await result.current.save.mutateAsync({ month: '2026-09', totalRevenue: 24000000,
      items: [{ key: 'rent', mode: 'total', total: 2400000, lines: [], weights: null }] }); });
    await waitFor(() => expect(result.current.check.data).toMatchObject({ manualRevenue: 24000000, rateManual: 0.1 }));
    expect(transport.mock.calls.filter(([name]) => name === 'fixed_cost_revenue_check')).toHaveLength(2);
  });

  it.each(['save', 'amend'] as const)('%s 성공은 캐시된 월 실적 비교만 다시 읽고 수기 설정은 보존한다', async operation => {
    const month = operation === 'save' ? '2026-09' : '2026-08';
    const fixedKey = qk.fixedCosts(month);
    const manual = { totalRevenue: 12000000, items: [{ key: 'rent', total: 2400000 }] };
    qc.setQueryData(fixedKey, manual);
    qc.setQueryData(qk.storeSettings, { name: '매장 설정' });
    let written = false;
    const transport = respond(name => {
      if (name === 'fixed_cost_revenue_check') return { data: { month, manual_revenue: manual.totalRevenue,
        actual_revenue: written ? 240000 : 120000, has_sales: true }, error: null };
      written = true;
      return { data: operation === 'save' ? { items: [], day_opened: false }
        : { changed: true, created: false, revision: 2, audit_revision_no: 1, basis_quality: 'exact', items: [] }, error: null };
    });
    const { result } = renderHook(() => ({ save: useSaveSale(), amend: useAmendPastSale(),
      check: useRevenueCheck(month) }), { wrapper });
    await waitFor(() => expect(result.current.check.data?.actualRevenue).toBe(120000));
    const readCalls = () => transport.mock.calls.filter(([name]) => name === 'fixed_cost_revenue_check');
    expect(readCalls()).toHaveLength(1);
    await act(async () => {
      const input = { ...saleInput(2), date: `${month}-09` };
      if (operation === 'save') await result.current.save.mutateAsync(input);
      else await result.current.amend.mutateAsync({ ...input, reason: '수량 정정' });
    });
    await waitFor(() => expect(result.current.check.data?.actualRevenue).toBe(240000));
    expect(readCalls()).toHaveLength(2);
    expect(readCalls()[1]?.[1]).toEqual({ p_store: 'store-1', p_month: month });
    expect(result.current.check.data?.manualRevenue).toBe(manual.totalRevenue);
    expect(qc.getQueryData(fixedKey)).toEqual(manual);
    expect(qc.getQueryState(fixedKey)?.isInvalidated).toBe(false);
    expect(qc.getQueryState(qk.storeSettings)?.isInvalidated).toBe(false);
  });

  it.each(['save', 'amend'] as const)('%s 실패는 캐시된 실적 비교와 수기 설정을 무효화하지 않는다', async operation => {
    const month = '2026-08';
    const fixedKey = qk.fixedCosts(month);
    const manual = { totalRevenue: 12000000, items: [] };
    qc.setQueryData(fixedKey, manual);
    const transport = respond(name => name === 'fixed_cost_revenue_check'
      ? { data: { month, manual_revenue: manual.totalRevenue, actual_revenue: 120000 }, error: null }
      : { data: null, error: { message: '저장 실패' } });
    const { result } = renderHook(() => ({ save: useSaveSale(), amend: useAmendPastSale(),
      check: useRevenueCheck(month) }), { wrapper });
    await waitFor(() => expect(result.current.check.data?.actualRevenue).toBe(120000));
    const cached = result.current.check.data;
    await act(async () => {
      const input = { ...saleInput(2), date: `${month}-09` };
      const saving = operation === 'save' ? result.current.save.mutateAsync(input)
        : result.current.amend.mutateAsync({ ...input, reason: '수량 정정' });
      await expect(saving).rejects.toEqual({ message: '저장 실패' });
    });
    expect(result.current.check.data).toBe(cached);
    expect(transport.mock.calls.filter(([name]) => name === 'fixed_cost_revenue_check')).toHaveLength(1);
    expect(qc.getQueryCache().getAll().every(query => !query.state.isInvalidated)).toBe(true);
    expect(qc.getQueryData(fixedKey)).toEqual(manual);
  });

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

  it.each(['save', 'deactivate'] as const)('폐기된 부자재 %s 훅은 서버 RPC를 호출하지 않는다', async (operation) => {
    const { result } = renderHook(() => ({
      save: useSaveMaterial(),
      deactivate: useDeactivateMaterial(),
    }), { wrapper });
    await act(async () => {
      if (operation === 'save') {
        await expect(result.current.save.mutateAsync({ id: 'material-1', name: '용기', categoryId: null, unitCost: 200 }))
          .rejects.toThrow('재료로 통합');
      } else {
        await expect(result.current.deactivate.mutateAsync('material-1')).rejects.toThrow('재료로 통합');
      }
    });
    expect(rpc()).not.toHaveBeenCalled();
  });

  it('발주 등록은 주문만 갱신하고 레시피·재고 캐시는 유지한다', async () => {
    rpc().mockResolvedValue({ data: { order_ids: ['order-1'], duplicate: false }, error: null } as never);
    for (const key of [qk.orders, qk.recipes, qk.ingredients]) qc.setQueryData(key, []);
    const { result } = renderHook(() => usePlaceOrders(), { wrapper });
    await act(async () => { await result.current.mutateAsync([{ ingredientId: 'ingredient-1', vendorId: null, volume: 1000, amount: 4000, qty: 1, expectedAt: '2026-09-10' }]); });
    expect(qc.getQueryState(qk.orders)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(qk.recipes)?.isInvalidated).toBe(false);
    expect(qc.getQueryState(qk.ingredients)?.isInvalidated).toBe(false);
  });
});
