/**
 * 매출 조회·저장 훅.
 *
 * 여기가 사이클의 마지막 고리다. 메뉴를 팔면 서버가 레시피를 재귀로 펼쳐
 * **식재료 재고까지 차감**한다(E10 → E8). 그래서 저장 후에는 매출뿐 아니라
 * 재고·발주 후보 캐시도 함께 버려야 한다 — 안 그러면 "팔았는데 식재료 화면은 그대로"가 된다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useStoreId } from '@/lib/SessionProvider';

const num = (v: unknown): number => Number(v ?? 0);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

/** 손익 한 장. 서버 `sales_summary()` 가 유일한 계산 주체다(절대원칙 3). */
export interface SalesSummary {
  from: string;
  to: string;
  days: number;
  revenue: number;
  etcRevenue: number;
  qty: number;
  materialCost: number;
  extraMaterialCost: number;
  tax: number;
  wasteLoss: number;
  wasteIngredient: number;
  wasteMenu: number;
  dailyExtra: number;
  fixedCost: number;
  fixedRate: number | null;
  /** 해당 월 고정지출이 없어 과거 월 값을 빌려 쓴 상태. 화면이 "잠정"이라 표시해야 한다. */
  fixedRateProvisional: boolean;
  profit: number;
}

export interface SaleItem {
  id: string;
  recipeId: string | null;
  menuName: string;
  unitPrice: number;
  unitMaterialCost: number;
  unitExtraCost: number;
  qtyHall: number;
  qtyDelivery: number;
  qtyTakeout: number;
  /** 조리 폐기 — 재료는 나갔고 매출은 0. */
  qtyWaste: number;
  qty: number;
}

export interface EtcItem { name: string; price: number; qty: number }
export interface ExtraItem { name: string; amount: number; memo?: string }

export interface SalesDay {
  saleDate: string;
  items: SaleItem[];
  etcItems: EtcItem[];
  extraItems: ExtraItem[];
  etcRevenue: number;
  dailyExtra: number;
  summary: SalesSummary;
}

export function parseSummary(v: unknown): SalesSummary {
  const r = (v ?? {}) as Record<string, unknown>;
  return {
    from: String(r.from ?? ''),
    to: String(r.to ?? ''),
    days: num(r.days),
    revenue: num(r.revenue),
    etcRevenue: num(r.etc_revenue),
    qty: num(r.qty),
    materialCost: num(r.material_cost),
    extraMaterialCost: num(r.extra_material_cost),
    tax: num(r.tax),
    wasteLoss: num(r.waste_loss),
    wasteIngredient: num(r.waste_ingredient),
    wasteMenu: num(r.waste_menu),
    dailyExtra: num(r.daily_extra),
    fixedCost: num(r.fixed_cost),
    fixedRate: numOrNull(r.fixed_rate),
    fixedRateProvisional: Boolean(r.fixed_rate_provisional),
    profit: num(r.profit),
  };
}

const EMPTY_SUMMARY = (date: string): SalesSummary => ({
  from: date, to: date, days: 0, revenue: 0, etcRevenue: 0, qty: 0,
  materialCost: 0, extraMaterialCost: 0, tax: 0,
  wasteLoss: 0, wasteIngredient: 0, wasteMenu: 0, dailyExtra: 0,
  fixedCost: 0, fixedRate: null, fixedRateProvisional: true, profit: 0,
});

/** 하루 장부 (SALES-01 / SALES-03). 판매 기록이 없는 날도 빈 장부를 돌려준다. */
export function useSalesDay(date: string) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.salesDay(date),
    queryFn: async (): Promise<SalesDay> => {
      const { data, error } = await supabase.rpc('sales_day', { p_store: storeId, p_date: date });
      if (error) throw new Error(error.message);
      const r = (data ?? null) as unknown as Record<string, unknown> | null;
      if (!r) {
        return { saleDate: date, items: [], etcItems: [], extraItems: [], etcRevenue: 0, dailyExtra: 0, summary: EMPTY_SUMMARY(date) };
      }
      return {
        saleDate: String(r.sale_date ?? date),
        etcRevenue: num(r.etc_revenue),
        dailyExtra: num(r.daily_extra),
        etcItems: ((r.etc_items ?? []) as Record<string, unknown>[]).map((e) => ({
          name: String(e.name ?? ''), price: num(e.price), qty: num(e.qty),
        })),
        extraItems: ((r.extra_items ?? []) as Record<string, unknown>[]).map((e) => ({
          name: String(e.name ?? ''), amount: num(e.amount), memo: str(e.memo) ?? undefined,
        })),
        items: ((r.items ?? []) as Record<string, unknown>[]).map((it) => ({
          id: String(it.id),
          recipeId: str(it.recipe_id),
          menuName: String(it.menu_name),
          unitPrice: num(it.unit_price),
          unitMaterialCost: num(it.unit_material_cost),
          unitExtraCost: num(it.unit_extra_cost),
          qtyHall: num(it.qty_hall),
          qtyDelivery: num(it.qty_delivery),
          qtyTakeout: num(it.qty_takeout),
          qtyWaste: num(it.qty_waste),
          qty: num(it.qty),
        })),
        summary: parseSummary(r.summary),
      };
    },
  });
}

export interface RangeDay { date: string; revenue: number; qty: number; material: number; profit: number }
export interface RangeMenu {
  recipeId: string | null;
  menuName: string;
  qty: number;
  qtyHall: number;
  qtyDelivery: number;
  qtyTakeout: number;
  qtyWaste: number;
  revenue: number;
  unitPrice: number;
  unitMaterialCost: number;
  material: number;
}
export interface RangeChannel {
  code: string;
  name: string;
  amount: number;
  qty: number;
  /** 채널별 수량이 있으므로 배분이 아니라 정확히 나뉜 값. */
  material: number;
  tax: number;
}

export interface SalesRange {
  from: string;
  to: string;
  summary: SalesSummary;
  daily: RangeDay[];
  menu: RangeMenu[];
  channels: RangeChannel[];
}

/** 기간 분석 (SALES-02). 날짜마다 조회하면 30일에 30 왕복이 되므로 한 번에 받는다. */
export function useSalesRange(from: string, to: string, enabled = true) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.salesRange(from, to),
    enabled: enabled && Boolean(from) && Boolean(to),
    queryFn: async (): Promise<SalesRange> => {
      const { data, error } = await supabase.rpc('sales_range', { p_store: storeId, p_from: from, p_to: to });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      return {
        from, to,
        summary: parseSummary(r.summary),
        daily: ((r.daily ?? []) as Record<string, unknown>[]).map((d) => ({
          date: String(d.date), revenue: num(d.revenue), qty: num(d.qty),
          material: num(d.material), profit: num(d.profit),
        })),
        menu: ((r.menu ?? []) as Record<string, unknown>[]).map((m) => ({
          recipeId: str(m.recipe_id),
          menuName: String(m.menu_name),
          qty: num(m.qty),
          qtyHall: num(m.qty_hall),
          qtyDelivery: num(m.qty_delivery),
          qtyTakeout: num(m.qty_takeout),
          qtyWaste: num(m.qty_waste),
          revenue: num(m.revenue),
          unitPrice: num(m.unit_price),
          unitMaterialCost: num(m.unit_material_cost),
          material: num(m.material),
        })),
        channels: ((r.channels ?? []) as Record<string, unknown>[]).map((c) => ({
          code: String(c.code), name: String(c.name),
          amount: num(c.amount), qty: num(c.qty), material: num(c.material),
          tax: num(c.tax),
        })),
      };
    },
  });
}

export interface SaveSaleInput {
  date: string;
  items: { recipeId: string; qtyHall: number; qtyDelivery: number; qtyTakeout: number; qtyWaste?: number }[];
  /** 생략하면 그날 값을 그대로 둔다. 빈 배열을 보내면 전부 지운다. */
  etcItems?: EtcItem[];
  extraItems?: ExtraItem[];
}

/** 재고가 모자란 채로 팔린 항목 — 화면이 "재고 기록이 실제와 다를 수 있어요"를 알려야 한다. */
export interface Shortage { ingredientId: string; name: string; needed: number; available: number; shortage: number }

export function useSaveSale() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: SaveSaleInput): Promise<Shortage[]> => {
      const { data, error } = await supabase.rpc('save_sale', {
        p_store: storeId,
        p_date: input.date,
        p_items: input.items.map((i) => ({
          recipe_id: i.recipeId,
          qty_hall: i.qtyHall,
          qty_delivery: i.qtyDelivery,
          qty_takeout: i.qtyTakeout,
          qty_waste: i.qtyWaste ?? 0,
        })),
        p_etc_items: input.etcItems
          ? input.etcItems.map((e) => ({ name: e.name, price: e.price, qty: e.qty }))
          : undefined,
        p_extra_items: input.extraItems
          ? input.extraItems.map((e) => ({ name: e.name, amount: e.amount, memo: e.memo ?? '' }))
          : undefined,
      });
      if (error) throw new Error(error.message);

      // 부족분은 오류가 아니다 — 이미 팔린 것이다. 화면에 알려주기 위해 모아 돌려준다.
      const results = ((data as unknown as Record<string, unknown>)?.items ?? []) as Record<string, unknown>[];
      const out: Shortage[] = [];
      for (const res of results) {
        const consume = (res?.consume ?? {}) as Record<string, unknown>;
        for (const s of (consume.shortages ?? []) as Record<string, unknown>[]) {
          out.push({
            ingredientId: String(s.ingredient_id),
            name: String(s.name),
            needed: num(s.needed),
            available: num(s.available),
            shortage: num(s.shortage),
          });
        }
      }
      return out;
    },
    onSuccess: (_r, input) => invalidate(qc, [...invalidateOn.e10(), qk.salesDay(input.date)]),
  });
}

// ── 지출 내역 되짚기 (SALES-13/15/17) ─────────────────────────
// 합계만 보여주면 사장님은 확인할 방법이 없다. 내역은 이미 원장에 있으므로 되읽어 온다.

export interface MaterialUsageMenu { menuName: string; qty: number; amount: number }
export interface MaterialUsageItem {
  ingredientId: string;
  name: string;
  baseUnit: 'g' | 'ml' | 'ea';
  qty: number;
  unitPrice: number | null;
  amount: number;
  menus: MaterialUsageMenu[];
}

export function useMaterialUsage(from: string, to: string, enabled = true) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.salesRange(from, to), 'material'],
    enabled: enabled && Boolean(from) && Boolean(to),
    queryFn: async (): Promise<{ total: number; items: MaterialUsageItem[] }> => {
      const { data, error } = await supabase.rpc('sales_material_usage', { p_store: storeId, p_from: from, p_to: to });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      return {
        total: num(r.total),
        items: ((r.items ?? []) as Record<string, unknown>[]).map((i) => ({
          ingredientId: String(i.ingredient_id),
          name: String(i.name),
          baseUnit: i.base_unit as 'g' | 'ml' | 'ea',
          qty: num(i.qty),
          unitPrice: numOrNull(i.unit_price),
          amount: num(i.amount),
          menus: ((i.menus ?? []) as Record<string, unknown>[]).map((m) => ({
            menuName: String(m.menu_name), qty: num(m.qty), amount: num(m.amount),
          })),
        })),
      };
    },
  });
}

export interface ExtraUsageItem {
  name: string;
  qty: number;
  amount: number;
  menus: { menuName: string; qty: number; unit: number; amount: number }[];
}

export function useExtraUsage(from: string, to: string, enabled = true) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.salesRange(from, to), 'extra'],
    enabled: enabled && Boolean(from) && Boolean(to),
    queryFn: async (): Promise<{ total: number; items: ExtraUsageItem[] }> => {
      const { data, error } = await supabase.rpc('sales_extra_usage', { p_store: storeId, p_from: from, p_to: to });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      return {
        total: num(r.total),
        items: ((r.items ?? []) as Record<string, unknown>[]).map((i) => ({
          name: String(i.name),
          qty: num(i.qty),
          amount: num(i.amount),
          menus: ((i.menus ?? []) as Record<string, unknown>[]).map((m) => ({
            menuName: String(m.menu_name), qty: num(m.qty), unit: num(m.unit), amount: num(m.amount),
          })),
        })),
      };
    },
  });
}

export interface FixedBreakdownItem {
  key: string;
  monthTotal: number;
  amount: number;
  lines: { name: string; amount: number }[];
}

export function useFixedBreakdown(from: string, to: string, enabled = true) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.salesRange(from, to), 'fixed'],
    enabled: enabled && Boolean(from) && Boolean(to),
    queryFn: async (): Promise<{
      month: string; rate: number | null; provisional: boolean; total: number; items: FixedBreakdownItem[];
    }> => {
      const { data, error } = await supabase.rpc('sales_fixed_breakdown', { p_store: storeId, p_from: from, p_to: to });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      return {
        month: String(r.month ?? ''),
        rate: numOrNull(r.rate),
        provisional: Boolean(r.provisional),
        total: num(r.total),
        items: ((r.items ?? []) as Record<string, unknown>[]).map((i) => ({
          key: String(i.key),
          monthTotal: num(i.month_total),
          amount: num(i.amount),
          lines: ((i.lines ?? []) as Record<string, unknown>[]).map((l) => ({
            name: String(l.name ?? ''), amount: num(l.amount),
          })),
        })),
      };
    },
  });
}
