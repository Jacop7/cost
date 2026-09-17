import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import { rpcNumber as num, rpcNullableNumber as numOrNull, rpcNullableString as str } from '@/lib/rpcValue';
import { useSessionState, useStoreId } from '@/lib/SessionProvider';
import { rpcError, supabase } from '@/lib/supabase';
import { parseSummary, type SalesSummary } from './hooks';

export type SalesEntryStatus = 'missing' | 'editing' | 'completed' | 'closed';

export interface SalesFeedItem {
  businessDate: string;
  status: SalesEntryStatus;
  draftId: string | null;
  versionId: string | null;
  sales: number;
  netSales: number;
  qty: number;
  expense: number | null;
  profit: number | null;
  profitRate: number | null;
  canEdit: boolean;
  canClassify: boolean;
  calendarRevision: number;
  blockedReason: string | null;
  action: 'write' | 'resume' | 'detail';
}

export interface SalesFeed {
  from: string;
  to: string;
  summary: Omit<SalesSummary, 'fixedCost' | 'profit'> & {
    fixedCost: number | null;
    profit: number | null;
    uncomputedDayCount: number;
  };
  counts: { missing: number; editing: number; completed: number; closed: number };
  items: SalesFeedItem[];
  clock: { serverNow: string; recommendedSalesDate: string; editableFrom: string; editableTo: string };
}

export function useSalesFeed(from: string, to: string) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.salesFeed(from, to),
    enabled: Boolean(storeId && from && to),
    queryFn: async (): Promise<SalesFeed> => {
      const { data, error } = await supabase.rpc('sales_feed', {
        p_store: storeId, p_from: from, p_to: to, p_before: undefined, p_limit: 100,
      });
      if (error) throw rpcError(error);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      const counts = (r.counts ?? {}) as Record<string, unknown>;
      const clock = (r.clock ?? {}) as Record<string, unknown>;
      const rawSummary = (r.summary ?? {}) as Record<string, unknown>;
      const parsedSummary = parseSummary(rawSummary);
      return {
        from: String(r.from ?? from), to: String(r.to ?? to), summary: {
          ...parsedSummary,
          fixedCost: numOrNull(rawSummary.fixed_cost),
          profit: numOrNull(rawSummary.profit),
          uncomputedDayCount: num(rawSummary.uncomputed_day_count),
        },
        counts: { missing: num(counts.missing), editing: num(counts.editing), completed: num(counts.completed), closed: num(counts.closed) },
        items: ((r.items ?? []) as Record<string, unknown>[]).map((x) => ({
          businessDate: String(x.business_date), status: x.status as SalesEntryStatus,
          draftId: str(x.draft_id), versionId: str(x.version_id), sales: num(x.sales),
          netSales: num(x.net_sales), qty: num(x.qty), expense: numOrNull(x.expense),
          profit: numOrNull(x.profit), profitRate: numOrNull(x.profit_rate),
          canEdit: x.can_edit === true, canClassify: x.can_classify === true,
          calendarRevision: num(x.calendar_revision), blockedReason: str(x.blocked_reason),
          action: x.action as SalesFeedItem['action'],
        })),
        clock: {
          serverNow: String(clock.server_now ?? ''), recommendedSalesDate: String(clock.recommended_sales_date ?? to),
          editableFrom: String(clock.editable_from ?? ''), editableTo: String(clock.editable_to ?? to),
        },
      };
    },
  });
}

export interface SalesInventoryCountRequirement {
  required: boolean;
  phase: 'legacy_active' | 'draining' | 'freezing' | 'active' | 'blocked' | null;
  referenceSalesDate: string | null;
  reason: string | null;
}

export function useSalesInventoryCountRequirement() {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.salesInventoryCountRequirement,
    enabled: Boolean(storeId),
    queryFn: async (): Promise<SalesInventoryCountRequirement> => {
      const { data, error } = await supabase.rpc('sales_inventory_count_requirement', { p_store: storeId });
      if (error) throw rpcError(error);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      return {
        required: r.required === true,
        phase: r.phase == null ? null : r.phase as SalesInventoryCountRequirement['phase'],
        referenceSalesDate: str(r.reference_sales_date),
        reason: str(r.reason),
      };
    },
  });
}

export function useSetSalesCalendarDay() {
  const storeId = useStoreId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, kind }: { item: SalesFeedItem; kind: 'closed' | 'expected' }) => {
      const { data, error } = await supabase.rpc('set_sales_calendar_day', {
        p_store: storeId,
        p_date: item.businessDate,
        p_kind: kind,
        p_base_revision: item.calendarRevision,
        p_reason: kind === 'closed' ? '매출관리에서 휴무 확정' : '매출관리에서 영업일로 변경',
      });
      if (error) throw rpcError(error);
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.sales }),
  });
}

export interface SalesDraftMenuLine {
  id: string;
  recipeId: string;
  menuName: string;
  qtyHall: number;
  qtyDelivery: number;
  qtyTakeout: number;
  qtyWaste: number;
  deleted: boolean;
}
export interface SalesDraftEtcLine { id: string; name: string; price: number; qty: number; channel: 'hall' | 'delivery' | 'takeout'; deleted: boolean }
export interface SalesDraftExpenseLine { id: string; name: string; amount: number; memo?: string; deleted: boolean }
export interface SalesDraft {
  id: string;
  businessDate: string;
  kind: 'initial' | 'amendment';
  status: 'editing' | 'pending_inventory_resolution' | 'expired' | 'discarded' | 'finalized';
  revision: number;
  payloadHash: string;
  expiresAt: string;
  items: SalesDraftMenuLine[];
  etcItems: SalesDraftEtcLine[];
  extraItems: SalesDraftExpenseLine[];
}

function parseDraft(value: unknown): SalesDraft {
  const r = (value ?? {}) as Record<string, unknown>;
  const p = (r.payload ?? {}) as Record<string, unknown>;
  return {
    id: String(r.draft_id), businessDate: String(r.business_date), kind: r.kind as SalesDraft['kind'],
    status: r.status as SalesDraft['status'], revision: num(r.revision), payloadHash: String(r.payload_hash ?? ''),
    expiresAt: String(r.expires_at ?? ''),
    items: ((p.items ?? []) as Record<string, unknown>[]).map((x) => ({
      id: String(x.id), recipeId: String(x.recipe_id), menuName: String(x.menu_name),
      qtyHall: num(x.qty_hall), qtyDelivery: num(x.qty_delivery), qtyTakeout: num(x.qty_takeout),
      qtyWaste: num(x.qty_waste), deleted: x.deleted === true,
    })),
    etcItems: ((p.etc_items ?? []) as Record<string, unknown>[]).map((x) => ({
      id: String(x.id), name: String(x.name), price: num(x.price), qty: num(x.qty),
      channel: x.channel as SalesDraftEtcLine['channel'], deleted: x.deleted === true,
    })),
    extraItems: ((p.extra_items ?? []) as Record<string, unknown>[]).map((x) => ({
      id: String(x.id), name: String(x.name), amount: num(x.amount), memo: str(x.memo) ?? undefined,
      deleted: x.deleted === true,
    })),
  };
}

export function createSalesRequestKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const v = Math.floor(Math.random() * 16);
    return (c === 'x' ? v : (v & 3) | 8).toString(16);
  });
}

export function useSalesDraft(draftId: string | null) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.salesDraft(draftId ?? ''), enabled: Boolean(storeId && draftId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('sales_draft_detail', { p_store: storeId, p_draft: draftId! });
      if (error) throw rpcError(error);
      return parseDraft(data);
    },
    staleTime: 10_000,
  });
}

export function useOpenSalesDraft() {
  const storeId = useStoreId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      const { data, error } = await supabase.rpc('open_sales_draft', {
        p_store: storeId, p_date: date, p_draft_id: createSalesRequestKey(),
      });
      if (error) throw rpcError(error);
      return parseDraft(data);
    },
    onSuccess: draft => {
      qc.setQueryData(qk.salesDraft(draft.id), draft);
      void qc.invalidateQueries({ queryKey: qk.sales });
    },
  });
}

export function useSaveSalesDraft() {
  const storeId = useStoreId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: SalesDraft) => {
      const { data, error } = await supabase.rpc('save_sales_draft', {
        p_store: storeId, p_draft: draft.id, p_base_revision: draft.revision,
        p_items: draft.items.map(x => ({ id: x.id, recipe_id: x.recipeId, menu_name: x.menuName,
          qty_hall: x.qtyHall, qty_delivery: x.qtyDelivery, qty_takeout: x.qtyTakeout,
          qty_waste: x.qtyWaste, deleted: x.deleted })),
        p_etc_items: draft.etcItems.map(x => ({ id: x.id, name: x.name, price: x.price, qty: x.qty, channel: x.channel, deleted: x.deleted })),
        p_extra_items: draft.extraItems.map(x => ({ id: x.id, name: x.name, amount: x.amount, memo: x.memo ?? '', deleted: x.deleted })),
      });
      if (error) throw rpcError(error);
      return parseDraft(data);
    },
    onSuccess: d => { qc.setQueryData(qk.salesDraft(d.id), d); void qc.invalidateQueries({ queryKey: qk.sales }); },
  });
}

export function useFinalizeSalesDraft() {
  const storeId = useStoreId();
  const session = useSessionState();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ draft, requestKey }: { draft: SalesDraft; requestKey: string }) => {
      const { submitSalesFinalize } = await import('./salesCommandOperation');
      const scope = { actorId: session.userId ?? '', storeId, businessDate: draft.businessDate, draftId: draft.id };
      const command = { requestKey, payloadHash: draft.payloadHash, baseRevision: draft.revision };
      const execute = async (saved: typeof command, savedScope: typeof scope) => {
        const { data, error } = await supabase.rpc('finalize_sales_draft', {
          p_store: storeId,p_draft: savedScope.draftId,p_base_revision: saved.baseRevision,
          p_request_key: saved.requestKey,p_payload_hash: saved.payloadHash,
          p_reason: draft.kind === 'amendment' ? '매출 작성 내역 수정' : undefined,
        });
        if (error) throw rpcError(error);
        return data as unknown as Record<string, unknown>;
      };
      const result = await submitSalesFinalize<Record<string, unknown>>(scope, command, execute, async saved => {
        const { data, error } = await supabase.rpc('get_sales_command_receipt', {
          p_store: storeId,p_command_kind: 'finalize_sales_draft',p_request_key: saved.requestKey,p_payload_hash: saved.payloadHash,
        });
        if (error) throw rpcError(error);
        const receipt = data as unknown as { result?: Record<string, unknown> } | null;
        return receipt?.result ? { resolved: 'recorded' as const, result: receipt.result } : { resolved: 'not_recorded' as const };
      });
      if ('resolved' in result) return result.result ?? { status: 'not_recorded' };
      return result as Record<string, unknown>;
    },
    onSuccess: () => invalidate(qc, invalidateOn.e10()),
  });
}

export function useRecoverSalesFinalize() {
  const storeId=useStoreId();
  const session=useSessionState();
  return useMutation({
    mutationFn: async (businessDate:string) => {
      const { recoverSalesFinalize }=await import('./salesCommandOperation');
      return recoverSalesFinalize({actorId:session.userId ?? '',storeId,businessDate},async saved => {
        const {data,error}=await supabase.rpc('get_sales_command_receipt',{
          p_store:storeId,p_command_kind:'finalize_sales_draft',p_request_key:saved.requestKey,p_payload_hash:saved.payloadHash,
        });
        if(error) throw rpcError(error);
        const receipt=data as unknown as {result?:Record<string,unknown>}|null;
        return receipt?.result ? {resolved:'recorded' as const,result:receipt.result}:{resolved:'not_recorded' as const};
      });
    },
  });
}

export function useDiscardSalesDraft() {
  const storeId = useStoreId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: SalesDraft) => {
      const { data, error } = await supabase.rpc('discard_sales_draft', {
        p_store: storeId,p_draft: draft.id,p_base_revision: draft.revision,
      });
      if (error) throw rpcError(error);
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.sales }),
  });
}

export interface InventoryCountTarget {
  ingredientId: string;
  name: string;
  baseUnit: string;
  stockTotal: number;
}

export interface InventoryCountSession {
  id: string;
  status: 'active' | 'completed' | 'cancelled' | 'expired' | 'invalidated';
  cutoffBusinessDate: string;
  observationStartedAt: string;
  expiresAt: string;
  targets: InventoryCountTarget[];
}

function parseInventoryCountSession(value: unknown): InventoryCountSession {
  const r = (value ?? {}) as Record<string, unknown>;
  return {
    id: String(r.session_id ?? ''),
    status: r.status as InventoryCountSession['status'],
    cutoffBusinessDate: String(r.cutoff_business_date ?? ''),
    observationStartedAt: String(r.observation_started_at ?? ''),
    expiresAt: String(r.expires_at ?? ''),
    targets: ((r.targets ?? []) as Record<string, unknown>[]).map(target => ({
      ingredientId: String(target.ingredient_id ?? ''),
      name: String(target.name ?? ''),
      baseUnit: String(target.base_unit ?? ''),
      stockTotal: num(target.stock_total),
    })),
  };
}

export function useBeginInventoryCount() {
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.rpc('begin_inventory_count', {
        p_store: storeId, p_session: sessionId,
      });
      if (error) throw rpcError(error);
      return parseInventoryCountSession(data);
    },
  });
}

export function useCommitInventoryCount() {
  const storeId = useStoreId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, requestKey, counts }: {
      sessionId: string;
      requestKey: string;
      counts: { ingredientId: string; countedQuantity: number }[];
    }) => {
      const { data, error } = await supabase.rpc('commit_inventory_count_batch', {
        p_store: storeId,
        p_session: sessionId,
        p_request_key: requestKey,
        p_counts: counts.map(row => ({
          ingredient_id: row.ingredientId,
          counted_quantity: row.countedQuantity,
        })),
      });
      if (error) throw rpcError(error);
      return (data ?? {}) as unknown as Record<string, unknown>;
    },
    onSuccess: () => invalidate(qc, invalidateOn.e10()),
  });
}

export function useCancelInventoryCount() {
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.rpc('cancel_inventory_count', {
        p_store: storeId, p_session: sessionId,
      });
      if (error) throw rpcError(error);
      return data;
    },
  });
}
