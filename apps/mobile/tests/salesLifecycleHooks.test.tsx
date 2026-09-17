import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useBeginInventoryCount, useCancelInventoryCount, useCommitInventoryCount,
  useFinalizeSalesDraft, useSalesDraft, useSaveSalesDraft, useSetSalesCalendarDay,
  type SalesDraft, type SalesFeedItem,
} from '@/features/sales/lifecycle';
import { qk } from '@/lib/queryClient';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/SessionProvider', () => ({
  useStoreId: () => 'store-sales',
  useSessionState: () => ({ userId: 'actor-sales', storeId: 'store-sales', phase: 'ready' }),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc },
  rpcError: (error: { message?: string }) => new Error(error.message ?? 'RPC 오류'),
}));

const draft: SalesDraft = {
  id: 'draft-1', businessDate: '2026-09-15', kind: 'amendment', status: 'editing', revision: 0,
  payloadHash: 'a'.repeat(64), expiresAt: '2026-10-15T00:00:00Z',
  items: [{ id: 'line-1', recipeId: 'recipe-1', menuName: '김치찌개', qtyHall: 1, qtyDelivery: 0, qtyTakeout: 0, qtyWaste: 0, deleted: false }],
  etcItems: [], extraItems: [],
};
const wireDraft = {
  draft_id: draft.id, business_date: draft.businessDate, kind: draft.kind, status: 'editing', revision: 1,
  payload_hash: 'b'.repeat(64), expires_at: draft.expiresAt,
  payload: { items: [{ id: 'line-1', recipe_id: 'recipe-1', menu_name: '김치찌개', qty_hall: 1, qty_delivery: 0, qty_takeout: 0, qty_waste: 0, deleted: false }], etc_items: [], extra_items: [] },
};

const clients: QueryClient[] = [];
function mount<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...renderHook(hook, { wrapper }) };
}

describe('매출 서버 초안 mutation 계약', () => {
  beforeEach(() => { rpc.mockReset(); localStorage.clear(); });
  afterEach(() => clients.splice(0).forEach(client => client.clear()));

  it('임시저장 응답에서 날짜·종류·만료시각을 보존하고 해당 초안 캐시에 넣는다', async () => {
    rpc.mockResolvedValue({ data: wireDraft, error: null });
    const hook = mount(() => useSaveSalesDraft());
    let saved!: SalesDraft;
    await act(async () => { saved = await hook.result.current.mutateAsync(draft); });
    expect(saved).toMatchObject({ businessDate: '2026-09-15', kind: 'amendment', revision: 1, expiresAt: draft.expiresAt });
    expect(hook.client.getQueryData(qk.salesDraft('draft-1'))).toMatchObject({ id: 'draft-1', revision: 1 });
  });

  it('초안 조회는 생성 RPC를 호출하지 않는다',async()=>{
    rpc.mockResolvedValue({data:wireDraft,error:null});
    const hook=mount(()=>useSalesDraft('draft-1'));
    await waitFor(()=>expect(hook.result.current.data?.id).toBe('draft-1'));
    expect(rpc).toHaveBeenCalledWith('sales_draft_detail',{p_store:'store-sales',p_draft:'draft-1'});
    expect(rpc).not.toHaveBeenCalledWith('open_sales_draft',expect.anything());
  });

  it('작성 완료 재시도용 요청 키를 훅 내부에서 바꾸지 않고 서버에 그대로 전달한다', async () => {
    rpc.mockResolvedValue({ data: { status: 'finalized', duplicate: false }, error: null });
    const hook = mount(() => useFinalizeSalesDraft());
    const requestKey = 'request-key-kept-for-retry';
    await act(async () => { await hook.result.current.mutateAsync({ draft, requestKey }); });
    expect(rpc).toHaveBeenCalledWith('finalize_sales_draft', expect.objectContaining({
      p_draft: draft.id, p_base_revision: 0, p_payload_hash: draft.payloadHash,
      p_request_key: requestKey, p_reason: '매출 작성 내역 수정',
    }));
  });

  it('휴무 분류는 피드의 날짜 판본을 CAS 기준으로 전달한다', async () => {
    rpc.mockResolvedValue({ data: { day_kind: 'closed', revision: 4 }, error: null });
    const hook = mount(() => useSetSalesCalendarDay());
    const item = {
      businessDate: '2026-09-14', status: 'missing', draftId: null, versionId: null,
      sales: 0, netSales: 0, qty: 0, expense: null, profit: null, profitRate: null,
      canEdit: true, canClassify: true, calendarRevision: 3, blockedReason: null, action: 'write',
    } satisfies SalesFeedItem;
    await act(async () => { await hook.result.current.mutateAsync({ item, kind: 'closed' }); });
    expect(rpc).toHaveBeenCalledWith('set_sales_calendar_day', {
      p_store: 'store-sales', p_date: '2026-09-14', p_kind: 'closed', p_base_revision: 3,
      p_reason: '매출관리에서 휴무 확정',
    });
  });

  it('재고 실사 시작 응답은 비활성 미해결 식재료까지 입력 대상으로 보존한다', async () => {
    rpc.mockResolvedValue({ data: {
      session_id: 'count-1', status: 'active', cutoff_business_date: '2026-09-15',
      observation_started_at: '2026-09-16T01:00:00Z', expires_at: '2026-09-16T05:00:00Z',
      targets: [{ ingredient_id: 'ingredient-1', name: '대파', base_unit: 'g', stock_total: '812.5' }],
    }, error: null });
    const hook = mount(() => useBeginInventoryCount());
    let session!: Awaited<ReturnType<typeof hook.result.current.mutateAsync>>;
    await act(async () => { session = await hook.result.current.mutateAsync('count-1'); });
    expect(session.targets[0]).toEqual({
      ingredientId: 'ingredient-1', name: '대파', baseUnit: 'g', stockTotal: 812.5,
    });
    expect(rpc).toHaveBeenCalledWith('begin_inventory_count', {
      p_store: 'store-sales', p_session: 'count-1',
    });
  });

  it('재고 실사는 전체 목표 수량과 멱등 요청 키를 한 번에 전달한다', async () => {
    rpc.mockResolvedValue({ data: { batch_id: 'batch-1', duplicate: false }, error: null });
    const hook = mount(() => useCommitInventoryCount());
    await act(async () => { await hook.result.current.mutateAsync({
      sessionId: 'count-1', requestKey: 'request-1',
      counts: [{ ingredientId: 'ingredient-1', countedQuantity: 750 }],
    }); });
    expect(rpc).toHaveBeenCalledWith('commit_inventory_count_batch', {
      p_store: 'store-sales', p_session: 'count-1', p_request_key: 'request-1',
      p_counts: [{ ingredient_id: 'ingredient-1', counted_quantity: 750 }],
    });
  });

  it('실사 취소는 활성 세션 ID를 서버에 전달한다', async () => {
    rpc.mockResolvedValue({ data: { session_id: 'count-1', status: 'cancelled' }, error: null });
    const hook = mount(() => useCancelInventoryCount());
    await act(async () => { await hook.result.current.mutateAsync('count-1'); });
    expect(rpc).toHaveBeenCalledWith('cancel_inventory_count', {
      p_store: 'store-sales', p_session: 'count-1',
    });
  });
});
