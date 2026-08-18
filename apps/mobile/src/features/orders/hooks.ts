/**
 * 발주 조회·등록 훅.
 *
 * ⚠ 절대원칙 2: 발주 등록(E7)은 **기록만** 한다. 재고·기준단가는 변하지 않는다.
 *   실제 재고 반영은 입고 확정(E1)에서만 일어난다. 그래서 무효화 대상도 다르다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import { supabase, makeInboundKey } from '@/lib/supabase';
import { useStoreId } from '@/lib/SessionProvider';

const num = (v: unknown): number => Number(v ?? 0);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export type CandidateReason = 'safety_stock' | 'soon_out' | 'recipe' | 'manual';

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
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      return {
        candidates: ((r.candidates ?? []) as Record<string, unknown>[]).map((c) => ({
          ingredientId: String(c.ingredient_id),
          name: String(c.name),
          reasons: (c.reasons ?? []) as CandidateReason[],
          recommendedQty: num(c.recommended_qty),
          status: (c.status as OrderCandidate['status']) ?? 'pending',
          stockTotal: num(c.stock_total),
          safetyTotal: num(c.safety_total),
          baseUnit: c.base_unit as OrderCandidate['baseUnit'],
          perVolume: num(c.per_volume),
        })),
        waiting: ((r.waiting ?? []) as Record<string, unknown>[]).map(toRecord),
        received: ((r.received ?? []) as Record<string, unknown>[]).map(toRecord),
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
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (items: PlaceOrderInput[]): Promise<string[]> => {
      const ids: string[] = [];
      for (const it of items) {
        const { data, error } = await supabase.rpc('e7_place_order', {
          p_store: storeId,
          p_ingredient: it.ingredientId,
          p_vendor: (it.vendorId ?? null) as string,
          p_brand: null as unknown as string,
          p_volume: it.volume,
          p_amount: it.amount,
          p_qty: it.qty,
          p_expected: it.expectedAt,
          p_source: 'manual',
        });
        if (error) throw new Error(error.message);
        ids.push(String(data));
      }
      return ids;
    },
    onSuccess: () => invalidate(qc, invalidateOn.e7()),
  });
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
 * `idempotencyKey` 는 **사용자 의도 1회분**을 식별한다. 화면은 버튼을 누른 시점에 키를 한 번
 * 만들어 두고 재시도에는 같은 값을 다시 넘겨야 중복 입고가 막힌다. 방어는 DB 유니크 인덱스가
 * 하므로 debounce 에 의존하지 않는다.
 */
export function useConfirmInbound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      orderId: string;
      ingredientId: string;
      actualQty?: number;
      idempotencyKey?: string;
      occurredAt?: string;
    }): Promise<ConfirmInboundResult> => {
      const { data, error } = await supabase.rpc('e1_confirm_inbound', {
        p_order: input.orderId,
        p_actual_qty: input.actualQty,
        p_idempotency_key: input.idempotencyKey ?? makeInboundKey(input.orderId),
        p_occurred_at: input.occurredAt,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      return {
        orderId: String(r.order_id ?? input.orderId),
        receivedQty: num(r.received_qty),
        unitPrice: numOrNull(r.unit_price),
        priceSpike: Boolean(r.price_spike),
        duplicate: Boolean(r.duplicate),
        alreadyReceived: Boolean(r.already_received),
      };
    },
    onSuccess: (_r, input) => invalidate(qc, invalidateOn.e1(input.ingredientId)),
  });
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
      if (error) throw new Error(error.message);
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
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, input) => invalidate(qc, invalidateOn.e1(input.ingredientId)),
  });
}
