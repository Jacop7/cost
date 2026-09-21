/**
 * 발주 조회·등록 훅.
 *
 * ⚠ 절대원칙 2: 발주 등록(E7)은 **기록만** 한다. 재고·기준단가는 변하지 않는다.
 *   실제 재고 반영은 입고 확정(E1)에서만 일어난다. 그래서 무효화 대상도 다르다.
 */
import { menuSystemError } from '@/lib/productTerms';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import {
  rpcNullableNumber as numOrNull,
  rpcNullableString as str,
  rpcNumber as num,
} from '@/lib/rpcValue';
import { supabase, makeInboundKey } from '@/lib/supabase';
import { useSessionState, useStoreId } from '@/lib/SessionProvider';
import { resolvePendingOrderInbound, submitOrderInbound, type OrderInboundResolution } from './orderInboundOperation';
import {
  createOrderPlacementKey,
  resolvePendingOrderPlacement,
  submitOrderPlacement,
  type OrderPlacementResolution,
} from './orderPlacementOperation';
import { resolveInventoryOccurredAt } from '@/features/ingredients/hooks';
import { readOrderInboundDates } from './orderInboundDates';

export type CandidateReason = 'safety_stock' | 'soon_out' | 'manual';

const normalizeReasons = (reasons: unknown): CandidateReason[] => {
  const raw = Array.isArray(reasons) ? reasons : [];
  return raw.filter(
    (r): r is CandidateReason => r === 'safety_stock' || r === 'soon_out' || r === 'manual',
  );
};

export interface OrderCandidate {
  ingredientId: string;
  name: string;
  reasons: CandidateReason[];
  recommendedQty: number;
  status: 'pending' | 'ordered' | 'excluded';
  stockTotal: number;
  safetyTotal: number;
  baseUnit: 'g' | 'ml' | 'ea';
  perVolume: number;
}

export interface OrderRecord {
  id: string;
  ingredientId: string;
  name: string;
  vendorName: string | null;
  volume: number;
  amount: number;
  qty: number;
  receivedQty: number;
  status: 'ordered' | 'partial' | 'received' | 'canceled';
  orderedAt: string;
  receivedAt?: string | null;
  expectedAt: string | null;
  unitPrice: number | null;
}

export interface OrderBoard {
  candidates: OrderCandidate[];
  waiting: OrderRecord[];
  received: OrderRecord[];
}

const toRecord = (r: Record<string, unknown>): OrderRecord => ({
  id: String(r.id),
  ingredientId: String(r.ingredient_id),
  name: String(r.name),
  vendorName: str(r.vendor_name),
  volume: num(r.volume),
  amount: num(r.amount),
  qty: num(r.qty),
  receivedQty: num(r.received_qty),
  status: (r.status as OrderRecord['status']) ?? 'received',
  orderedAt: String(r.ordered_at),
  expectedAt: str(r.expected_at),
  unitPrice: numOrNull(r.unit_price),
});

/** 발주 현황 3탭(후보·입고대기·입고완료)을 한 번에. */
export function useOrderBoard() {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.orders,
    queryFn: async (): Promise<OrderBoard> => {
      const { data, error } = await supabase.rpc('order_board', { p_store: storeId });
      if (error) throw new Error(menuSystemError(error.message));
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      const received = ((r.received ?? []) as Record<string, unknown>[]).map(toRecord);
      const dates = await readOrderInboundDates(storeId, received.map(order => order.id));
      return {
        candidates: ((r.candidates ?? []) as Record<string, unknown>[]).map((c) => ({
          ingredientId: String(c.ingredient_id),
          name: String(c.name),
          reasons: normalizeReasons(c.reasons),
          recommendedQty: num(c.recommended_qty),
          status: (c.status as OrderCandidate['status']) ?? 'pending',
          stockTotal: num(c.stock_total),
          safetyTotal: num(c.safety_total),
          baseUnit: c.base_unit as OrderCandidate['baseUnit'],
          perVolume: num(c.per_volume),
        })),
        waiting: ((r.waiting ?? []) as Record<string, unknown>[]).map(toRecord),
        received: received.map(order => ({ ...order, receivedAt: dates.get(order.id) ?? null })),
      };
    },
  });
}

export interface PlaceOrderInput {
  ingredientId: string;
  vendorId: string | null;
  volume: number;
  amount: number;
  qty: number;
  /** 도착 예정일 'YYYY-MM-DD' */
  expectedAt: string;
}

/** E7 발주 등록 — 여러 건을 한 번에 보낼 수 있다(발주서 화면). */
export function usePlaceOrders() {
  const qc = useQueryClient();
  const { userId, storeId } = useSessionState();
  const scope = { actorId: userId ?? '', storeId: storeId ?? '' };
  const resolve = async (key: string): Promise<OrderPlacementResolution> => {
    const { data, error } = await supabase.rpc('resolve_order_placement', {
      p_store: storeId ?? '', p_request_key: key,
    });
    if (error) throw Object.assign(new Error(menuSystemError(error.message)), { code: error.code });
    const response = (data ?? {}) as Record<string, unknown>;
    const status = String(response.status);
    const orderIds = Array.isArray(response.order_ids)
      ? response.order_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    if (!['recorded', 'not_recorded'].includes(status) || (status === 'recorded' && orderIds.length === 0))
      throw Error('발주 결과를 확인하지 못했어요. 다시 확인해 주세요.');
    return { resolved: status as OrderPlacementResolution['resolved'], orderIds };
  };
  const mutation = useMutation({
    retry: false,
    mutationFn: async (items: PlaceOrderInput[]): Promise<string[] | OrderPlacementResolution> => {
      const requestKey = createOrderPlacementKey();
      return submitOrderPlacement(scope, requestKey, async () => {
        const payload = items.map(item => ({
          ingredient_id: item.ingredientId,
          vendor_id: item.vendorId,
          brand_id: null,
          volume: item.volume,
          amount: item.amount,
          qty: item.qty,
          expected_at: item.expectedAt,
          source: 'manual',
        }));
        const { data, error } = await supabase.rpc('place_orders', {
          p_store: storeId ?? '', p_items: payload, p_request_key: requestKey,
        });
        if (error) throw Object.assign(new Error(menuSystemError(error.message)), {
          code: error.code,
          orderPlacementRejected: ['22000', '23503', '23514', '42501', 'P0002'].includes(error.code),
        });
        const response = (data ?? {}) as Record<string, unknown>;
        const orderIds = Array.isArray(response.order_ids)
          ? response.order_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
          : [];
        if (orderIds.length !== items.length) throw Error('발주 결과를 확인하지 못했어요. 다시 확인해 주세요.');
        return orderIds;
      }, resolve);
    },
    onSuccess: () => invalidate(qc, invalidateOn.e7()),
  });
  return {
    ...mutation,
    resolvePending: async () => {
      const result = await resolvePendingOrderPlacement(scope, resolve);
      if (result?.resolved === 'recorded') await invalidate(qc, invalidateOn.e7());
      return result;
    },
  };
}

export interface ConfirmInboundResult {
  orderId: string;
  receivedQty: number;
  unitPrice: number | null;
  /** 직전 평균 대비 급등 여부 — 화면이 경고를 띄운다. */
  priceSpike: boolean;
  duplicate: boolean;
  alreadyReceived: boolean;
}

/**
 * E1 입고 확정.
 *
 * `idempotencyKey`는 사용자 의도 1회분이다. 응답이 불명확하면 키만 보관하고 다음 호출은
 * 해당 발주의 결과를 조회한다. 이전 수량을 다시 실행하지 않으며, 결과 확인 후 별도 입고는
 * 최신 잔여량을 확인한 사용자의 새 요청으로 처리한다.
 */
export function useConfirmInbound() {
  const qc = useQueryClient();
  const { userId, storeId } = useSessionState();
  const scope = (orderId: string) => ({ actorId: userId ?? '', storeId: storeId ?? '', orderId });
  const resolve = (orderId: string) => async (key: string) => {
    const { data, error } = await supabase.rpc('resolve_order_inbound', {
      p_store: storeId ?? '', p_order: orderId, p_request_key: key,
    });
    if (error) throw Object.assign(new Error(menuSystemError(error.message)), { code: error.code });
    const response = data as { status?: unknown; order_id?: unknown } | null;
    if (!response || !['recorded', 'not_recorded'].includes(String(response.status)) || response.order_id !== orderId)
      throw Error('입고 결과를 확인하지 못했어요. 다시 확인해 주세요.');
    return response.status as OrderInboundResolution['resolved'];
  };
  const mutation = useMutation({
    retry: false,
    mutationFn: async (input: {
      orderId: string;
      ingredientId: string;
      actualQty: number;
      idempotencyKey?: string;
      occurredAt?: string;
      occurredDate?: string;
      occurredTime?: string;
    }): Promise<ConfirmInboundResult | OrderInboundResolution> => {
      const key = input.idempotencyKey ?? makeInboundKey(input.orderId);
      return submitOrderInbound(scope(input.orderId), key, async () => {
      const delayedAt = await resolveInventoryOccurredAt(input.ingredientId, input);
      const { data, error } = delayedAt
        ? await supabase.rpc('record_delayed_inbound', {
          p_order: input.orderId,
          p_actual_qty: input.actualQty,
          p_request_key: key,
          p_occurred_at: delayedAt,
        })
        : await supabase.rpc('record_current_inbound', {
        p_order: input.orderId,
        p_actual_qty: input.actualQty,
        p_request_key: key,
        });
      if (error) throw Object.assign(new Error(menuSystemError(error.message)), { code: error.code,
        orderInboundRejected: ['40001', '22000', '45010', '42501', 'P0002'].includes(error.code) });
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      if (r.order_id !== input.orderId || !['number', 'string'].includes(typeof r.received_qty)
        || r.received_qty === '' || !Number.isFinite(Number(r.received_qty)) || Number(r.received_qty) < 0
        || (Number(r.received_qty) === 0 && r.duplicate !== true && r.already_received !== true))
        throw Error('입고 결과를 확인하지 못했어요. 다시 확인해 주세요.');
      return {
        orderId: String(r.order_id ?? input.orderId),
        receivedQty: num(r.received_qty),
        unitPrice: numOrNull(r.unit_price),
        priceSpike: Boolean(r.price_spike),
        duplicate: Boolean(r.duplicate),
        alreadyReceived: Boolean(r.already_received),
      };
      }, resolve(input.orderId));
    },
    onSuccess: (_r, input) => invalidate(qc, invalidateOn.e1(input.ingredientId)),
  });
  return { ...mutation, resolvePending: async (input: { orderId: string; ingredientId: string }) => {
    const result = await resolvePendingOrderInbound(scope(input.orderId), resolve(input.orderId));
    if (result) await invalidate(qc, invalidateOn.e1(input.ingredientId));
    return result;
  } };
}

/** E12 발주 취소 — 아직 입고되지 않은 주문만. */
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { orderId: string; reason?: string }) => {
      const { error } = await supabase.rpc('e12_order_canceled', {
        p_order: input.orderId,
        p_reason: input.reason,
      });
      if (error) throw new Error(menuSystemError(error.message));
    },
    onSuccess: () => invalidate(qc, invalidateOn.e7()),
  });
}

/** E11 입고 취소 — 잘못 확정한 입고를 되돌린다. 재고·단가·추이가 함께 되돌아간다. */
export function useRevertInbound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { orderId: string; ingredientId: string; reason?: string }) => {
      const { error } = await supabase.rpc('e11_inbound_reverted', {
        p_order: input.orderId,
        p_reason: input.reason,
      });
      if (error) throw new Error(menuSystemError(error.message));
    },
    onSuccess: (_r, input) => invalidate(qc, invalidateOn.e1(input.ingredientId)),
  });
}
