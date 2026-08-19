/**
 * 식재료 조회·변경 훅 — 화면과 Supabase 사이의 단일 경계.
 *
 * 화면이 supabase 를 직접 부르지 않게 한다(가이드 P0-1). 그래야
 *   · 쿼리 키가 한 곳에서 관리되고
 *   · 전파 후 무효화 대상이 흩어지지 않으며
 *   · 나중에 조회 방식을 바꿔도 화면을 건드리지 않는다.
 *
 * ⚠ 재고는 DB 가 **미개봉 개수 + 개봉분 잔량** 두 값으로 들고 있고, 총량은 서버 함수
 *   `stock_total_base()` 가 정의한다. 앱이 다시 계산하면 두 개의 진실이 생기므로
 *   조회 시 서버에서 받아온다(절대원칙 3).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useStoreId } from '@/lib/SessionProvider';
import { asJson } from '@/lib/json';

export type BaseUnit = 'g' | 'ml' | 'ea';

/** null 을 0 으로 바꾸지 않는다 — "산출 불가"와 "0원"은 다른 뜻이다. */
const num = (v: unknown): number => Number(v ?? 0);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

/** 목록 카드가 필요한 만큼만. 화면이 쓰지 않는 컬럼까지 끌어오지 않는다. */
export interface IngredientRow {
  id: string;
  name: string;
  categoryName: string | null;
  baseUnit: BaseUnit;
  perVolume: number;
  safetyStock: number;
  vendorName: string | null;
  memo: string | null;
  /** 재고 총량(기준단위) — 서버 `stock_total_base()` 값 */
  stockTotal: number;
  /** 기준단가(원/기준단위). 구매 이력이 없거나 로스율이 100% 이상이면 null(산출 불가). */
  basePrice: number | null;
  soonOut: boolean;
  lastInboundAt: string | null;
}

export interface PurchaseOption {
  id: string;
  url: string | null;
  name: string;
  volume: number;
  amount: number;
  vendorId: string | null;
  vendorName: string | null;
}

/** 상세 화면의 '구매 이력' — 발주 기록 최근 20건. */
export interface PurchaseRecord {
  id: string;
  orderedAt: string;
  status: 'ordered' | 'partial' | 'received' | 'canceled';
  volume: number;
  amount: number;
  qty: number;
  receivedQty: number;
  vendorName: string | null;
  unitPrice: number | null;
}

export interface IngredientDetail extends IngredientRow {
  categoryId: string | null;
  minOrderQty: number;
  sealedCount: number;
  openedRemain: number;
  purchase: { avg: number | null; low: number | null; high: number | null; count: number };
  priceTrends: { date: string; price: number }[];
  options: PurchaseOption[];
  orders: PurchaseRecord[];
  loss: IngredientLoss;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: 'inbound' | 'consume' | 'discard' | 'stocktake' | 'adjust';
  /** 재고 증감 — **기준단위**. 종류와 무관하게 같은 단위다(0034). */
  countDelta: number;
  volumeDelta: number | null;
  note: string | null;
  /** 그 사건 직후 잔량. 서버가 누적해서 준다 — 앱이 종류별 분기를 알 필요가 없다. */
  balance: number;
  /** 이미 되돌려진 폐기인가. 되돌린 폐기는 로스율 표시에서 빠진다. */
  reverted: boolean;
  /** 조리 폐기(메뉴를 만들어 놓고 못 팔아 버린 몫)인가. 보관 폐기와 원인이 다르다(0041). */
  waste: boolean;
}

/**
 * 실측 로스율 — **표시 전용**(0042). 기준단가에 곱하지 않는다.
 * 보관 폐기와 조리 폐기를 갈라서 준다. 원인이 다르면 사장님이 할 일도 다르다.
 * 폐기 기록이 없으면 rate 는 null — 0% 로 단정하지 않는다.
 */
export interface IngredientLoss {
  purchased: number;
  storageAmount: number;
  cookingAmount: number;
  storageCount: number;
  cookingCount: number;
  totalAmount: number;
  totalCost: number | null;
  rate: number | null;
  storageRate: number | null;
  cookingRate: number | null;
}

function toRow(r: Record<string, unknown>): IngredientRow {
  return {
    id: String(r.id),
    name: String(r.name),
    categoryName: str(r.category_name),
    baseUnit: r.base_unit as BaseUnit,
    perVolume: num(r.per_volume),
    safetyStock: num(r.safety_stock),
    vendorName: str(r.vendor_name),
    memo: str(r.memo),
    stockTotal: num(r.stock_total),
    basePrice: numOrNull(r.base_price),
    soonOut: Boolean(r.soon_out),
    lastInboundAt: str(r.last_inbound_at),
  };
}

/**
 * 목록 조회.
 *
 * 재고 총량·기준단가는 **서버 함수**라 일반 select 로는 못 가져온다.
 * 한 건씩 RPC 를 부르면 N+1 이 되므로 목록 전용 함수를 쓴다.
 */
export function useIngredientList() {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.ingredients,
    queryFn: async (): Promise<IngredientRow[]> => {
      const { data, error } = await supabase.rpc('ingredient_list', { p_store: storeId });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Record<string, unknown>[]).map(toRow);
    },
  });
}

/** 상세 (ING-03) — 구매 이력 요약·단가 추이·구매 옵션까지 한 번에. */
export function useIngredientDetail(id: string | undefined) {
  return useQuery({
    queryKey: qk.ingredient(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<IngredientDetail | null> => {
      const { data, error } = await supabase.rpc('ingredient_detail', { p_ingredient: id as string });
      if (error) throw new Error(error.message);
      if (!data) return null;
      const r = data as unknown as Record<string, unknown>;
      const pu = (r.purchase ?? {}) as Record<string, unknown>;
      return {
        ...toRow(r),
        categoryId: str(r.category_id),
        minOrderQty: num(r.min_order_qty),
        sealedCount: num(r.sealed_count),
        openedRemain: num(r.opened_remain),
        loss: (() => {
          const l = (r.loss ?? {}) as Record<string, unknown>;
          return {
            purchased: num(l.purchased),
            storageAmount: num(l.storage_amount),
            cookingAmount: num(l.cooking_amount),
            storageCount: num(l.storage_count),
            cookingCount: num(l.cooking_count),
            totalAmount: num(l.total_amount),
            totalCost: numOrNull(l.total_cost),
            rate: numOrNull(l.rate),
            storageRate: numOrNull(l.storage_rate),
            cookingRate: numOrNull(l.cooking_rate),
          };
        })(),
        purchase: {
          avg: numOrNull(pu.avg),
          low: numOrNull(pu.low),
          high: numOrNull(pu.high),
          count: num(pu.count),
        },
        priceTrends: ((r.price_trends ?? []) as Record<string, unknown>[]).map((t) => ({
          date: String(t.date),
          price: num(t.price),
        })),
        options: ((r.options ?? []) as Record<string, unknown>[]).map((o) => ({
          id: String(o.id),
          url: str(o.url),
          name: String(o.name),
          volume: num(o.volume),
          amount: num(o.amount),
          vendorId: str(o.vendor_id),
          vendorName: str(o.vendor_name),
        })),
        orders: ((r.orders ?? []) as Record<string, unknown>[]).map((o) => ({
          id: String(o.id),
          orderedAt: String(o.ordered_at),
          status: o.status as PurchaseRecord['status'],
          volume: num(o.volume),
          amount: num(o.amount),
          qty: num(o.qty),
          receivedQty: num(o.received_qty),
          vendorName: str(o.vendor_name),
          unitPrice: numOrNull(o.unit_price),
        })),
      };
    },
  });
}

/** 재고 변동 원장 (ING-07). */
export function useStockHistory(id: string | undefined, range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: [...qk.stockHistory(id ?? ''), range?.from ?? '', range?.to ?? ''],
    enabled: Boolean(id),
    queryFn: async (): Promise<LedgerEntry[]> => {
      const { data, error } = await supabase.rpc('stock_history', {
        p_ingredient: id as string,
        p_from: range?.from,
        p_to: range?.to,
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Record<string, unknown>[]).map((e) => ({
        id: String(e.id),
        date: String(e.occurred_on),
        type: e.type as LedgerEntry['type'],
        countDelta: num(e.count_delta),
        volumeDelta: numOrNull(e.volume_delta),
        note: str(e.note),
        balance: num(e.balance),
        reverted: Boolean(e.reverted),
        waste: Boolean(e.waste),
      }));
    },
  });
}

export interface IngredientInput {
  id?: string;
  name: string;
  categoryId: string | null;
  baseUnit: BaseUnit;
  perVolume: number;
  safetyStock: number;
  minOrderQty: number;
  defaultVendorId: string | null;
  memo: string | null;
}

/** 등록·수정 (ING-02 / ING-04). 저장 한 번이 서버 트랜잭션 하나다. */
export function useSaveIngredient() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: IngredientInput): Promise<string> => {
      const { data, error } = await supabase.rpc('save_ingredient', {
        p_store: storeId,
        p_payload: asJson({
          id: input.id ?? '',
          name: input.name,
          category_id: input.categoryId ?? '',
          base_unit: input.baseUnit,
          per_volume: input.perVolume,
          safety_stock: input.safetyStock,
          min_order_qty: input.minOrderQty,
          default_vendor_id: input.defaultVendorId ?? '',
          memo: input.memo ?? '',
        }),
      });
      if (error) throw new Error(error.message);
      return String(data);
    },
    onSuccess: (id) => invalidate(qc, invalidateOn.ingredientSaved(id)),
  });
}

/** 삭제 = 비활성화. 과거 입고·판매 기록은 그대로 남는다(원장 보존). */
export function useDeactivateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('deactivate_ingredient', { p_ingredient: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.ingredientSaved()),
  });
}

export interface PurchaseOptionInput {
  id?: string;
  ingredientId: string;
  name: string;
  vendorId: string | null;
  volume: number;
  amount: number;
  url: string | null;
}

/** 구매 옵션 등록·수정 (ING-05). */
export function useSavePurchaseOption() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: PurchaseOptionInput) => {
      const { error } = await supabase.rpc('save_purchase_option', {
        p_store: storeId,
        p_payload: asJson({
          id: input.id ?? '',
          ingredient_id: input.ingredientId,
          purchase_name: input.name,
          vendor_id: input.vendorId ?? '',
          volume: input.volume,
          amount: input.amount,
          url: input.url ?? '',
        }),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, input) => invalidate(qc, [qk.ingredient(input.ingredientId)]),
  });
}

export function useDeletePurchaseOption(ingredientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_purchase_option', { p_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, [qk.ingredient(ingredientId)]),
  });
}

/** 폐기 결과 — 버릴 게 없으면 서버가 아무 일도 하지 않고 skipped 로 알린다. */
export interface DiscardResult {
  discarded: number;
  skipped: boolean;
  unitPrice: number | null;
}

/**
 * 재고 수정 — 조정(E5) / 완전 소진(E5) / 폐기(E2).
 *
 * 어떤 종류인지에 따라 **다른 RPC** 를 부른다. 폐기는 실측 로스율에 누적되어 기준단가까지
 * 바꾸므로 조정으로 기록하면 로스율이 영원히 0 이 된다.
 */
export function useStockChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      ingredientId: string;
      kind: 'adj' | 'out' | 'waste';
      /** 조정·소진: 변경 후 총량(기준단위). 폐기: 남은 양(기준단위). */
      value: number;
      perVolume: number;
      soonOut?: boolean;
      /** 원장에 남길 사유. 비워두면 서버가 기본 문구를 쓴다. */
      reason?: string;
    }) => {
      if (input.kind === 'waste') {
        // E2 는 "남은 양"을 받아 폐기량을 역산한다.
        const { data, error } = await supabase.rpc('e2_discard', {
          p_ingredient: input.ingredientId,
          p_remain_volume: input.value,
        });
        if (error) throw new Error(error.message);
        const r = (data ?? {}) as unknown as Record<string, unknown>;
        return {
          discarded: num(r.discarded),
          skipped: Boolean(r.skipped),
          unitPrice: numOrNull(r.unit_price),
        } satisfies DiscardResult;
      }
      // E5 는 미개봉 개수 + 개봉분 잔량으로 받는다. 총량을 개당 용량으로 쪼개 넘긴다.
      const target = input.kind === 'out' ? 0 : input.value;
      const per = input.perVolume > 0 ? input.perVolume : 1;
      const sealed = Math.floor(target / per);
      const remain = target - sealed * per;
      const { error } = await supabase.rpc('e5_stock_adjusted', {
        p_ingredient: input.ingredientId,
        p_sealed: sealed,
        p_opened: remain > 0 ? 1 : 0,
        p_soon: input.kind === 'out' ? true : Boolean(input.soonOut),
        p_opened_remain: remain,
        p_note: input.reason,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, input) =>
      invalidate(qc, input.kind === 'waste' ? invalidateOn.e2(input.ingredientId) : invalidateOn.e5(input.ingredientId)),
  });
}

/**
 * 폐기 취소 (E2 되돌리기).
 *
 * 오입력한 폐기 하나가 그 식재료의 기준단가를 **영구히** 바꿔버리는 걸 막는다.
 * 원장은 지우지 않고 반대 이벤트를 쌓아 상쇄한다 — 되돌린 폐기는 실측 로스율에서 빠진다.
 */
export function useRevertDiscard(ingredientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { eventId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('e2_discard_reverted', {
        p_event: input.eventId,
        p_reason: input.reason,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      return { alreadyReverted: Boolean(r.already_reverted), restored: num(r.restored) };
    },
    onSuccess: () => invalidate(qc, invalidateOn.e2(ingredientId)),
  });
}
