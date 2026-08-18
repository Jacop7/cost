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
import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useStoreId } from '@/lib/SessionProvider';

/** 목록 카드가 필요한 만큼만. 화면이 쓰지 않는 컬럼까지 끌어오지 않는다. */
export interface IngredientRow {
  id: string;
  name: string;
  categoryName: string | null;
  baseUnit: 'g' | 'ml' | 'ea';
  perVolume: number;
  lossRate: number;
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

/**
 * 목록 조회.
 *
 * 재고 총량·기준단가는 **서버 함수**라 일반 select 로는 못 가져온다.
 * 한 건씩 RPC 를 부르면 N+1 이 되므로 목록 전용 함수를 쓴다(아래 마이그레이션에서 제공).
 */
export function useIngredientList() {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.ingredients,
    queryFn: async (): Promise<IngredientRow[]> => {
      const { data, error } = await supabase.rpc('ingredient_list', { p_store: storeId });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        categoryName: (r.category_name as string | null) ?? null,
        baseUnit: r.base_unit as 'g' | 'ml' | 'ea',
        perVolume: Number(r.per_volume ?? 0),
        lossRate: Number(r.loss_rate ?? 0),
        safetyStock: Number(r.safety_stock ?? 0),
        vendorName: (r.vendor_name as string | null) ?? null,
        memo: (r.memo as string | null) ?? null,
        stockTotal: Number(r.stock_total ?? 0),
        // null 을 0 으로 바꾸지 않는다 — "산출 불가"와 "0원"은 다른 뜻이다.
        basePrice: r.base_price === null || r.base_price === undefined ? null : Number(r.base_price),
        soonOut: Boolean(r.soon_out),
        lastInboundAt: (r.last_inbound_at as string | null) ?? null,
      }));
    },
  });
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
      reason: string;
    }) => {
      if (input.kind === 'waste') {
        // E2 는 "남은 양"을 받아 폐기량을 역산한다.
        const { error } = await supabase.rpc('e2_discard', {
          p_ingredient: input.ingredientId,
          p_remain_volume: input.value,
        });
        if (error) throw new Error(error.message);
        return;
      }
      // E5 는 미개봉 개수 단위로 받는다. 총량을 개당 용량으로 나눠 넘긴다.
      const target = input.kind === 'out' ? 0 : input.value;
      const sealed = input.perVolume > 0 ? Math.floor(target / input.perVolume) : 0;
      const { error } = await supabase.rpc('e5_stock_adjusted', {
        p_ingredient: input.ingredientId,
        p_sealed: sealed,
        p_opened: 0,
        p_soon: false,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, input) => {
      // 전파 계약대로 무효화한다(가이드 §8.2). 목록·상세·이력·후보가 함께 갱신돼야 한다.
      void qc.invalidateQueries({ queryKey: qk.ingredients });
      void qc.invalidateQueries({ queryKey: qk.ingredient(input.ingredientId) });
      void qc.invalidateQueries({ queryKey: qk.candidates });
      void qc.invalidateQueries({ queryKey: qk.recipes });
    },
  });
}
