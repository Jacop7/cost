/**
 * 매출 조회·저장 훅.
 *
 * 여기가 사이클의 마지막 고리다. 메뉴를 팔면 서버가 레시피를 재귀로 펼쳐
 * **식재료 재고까지 차감**한다(E10 → E8). 그래서 저장 후에는 매출뿐 아니라
 * 재고·발주 후보 캐시도 함께 버려야 한다 — 안 그러면 "팔았는데 식재료 화면은 그대로"가 된다.
 */
import { useCallback } from 'react';
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

/** 채널은 매장·배달앱·포장 **3개 고정**이다(0043). 네 번째는 없다. */
export type ChannelCode = 'hall' | 'delivery' | 'takeout';
export const CHANNEL_CODES: ChannelCode[] = ['hall', 'delivery', 'takeout'];

export interface EtcItem {
  name: string;
  price: number;
  qty: number;
  /**
   * 판매 채널(0093). **없을 수 있다** — 채널을 묻기 전에 적은 옛 줄이다.
   * ⚠ 없다고 매장으로 치면 안 된다. 모르는 것이지 매장인 게 아니다.
   */
  channel?: ChannelCode;
}
export interface ExtraItem { name: string; amount: number; memo?: string }

export interface SalesDay {
  saleDate: string;
  /**
   * 그날 매출의 판본(0117). 저장할 때 **그대로 되보낸다**.
   * 서버 값과 다르면 이 화면은 낡은 것이고, 저장은 45009 로 거부된다 —
   * 그게 다른 기기가 적은 판매를 조용히 지우지 않게 하는 유일한 장치다.
   */
  revision: number;
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
        return { saleDate: date, revision: 0, items: [], etcItems: [], extraItems: [], etcRevenue: 0, dailyExtra: 0, summary: EMPTY_SUMMARY(date) };
      }
      return {
        saleDate: String(r.sale_date ?? date),
        revision: num(r.revision),
        etcRevenue: num(r.etc_revenue),
        dailyExtra: num(r.daily_extra),
        etcItems: ((r.etc_items ?? []) as Record<string, unknown>[]).map((e) => ({
          name: String(e.name ?? ''), price: num(e.price), qty: num(e.qty),
          channel: CHANNEL_CODES.includes(e.channel as ChannelCode) ? (e.channel as ChannelCode) : undefined,
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

/** 판매 한 줄. 저장과 부족 판정이 **같은 모양**을 쓴다 — 갈리면 미리보기가 거짓말이 된다. */
export interface SaleItemInput {
  recipeId: string;
  qtyHall: number;
  qtyDelivery: number;
  qtyTakeout: number;
  qtyWaste?: number;
}

/** 부족 판정의 종류. 화면이 `안전재고` 를 쓸지 `필요 수량` 을 쓸지 가른다(기획안 §4.4). */
export type ShortageMode = 'start' | 'sale';

export interface SaveSaleInput {
  date: string;
  items: SaleItemInput[];
  /**
   * 화면이 마지막으로 본 판본(0117).
   *
   * ⚠ **필수다.** 예전엔 선택값(`?:`)이었는데, 그러면 나중에 저장 경로가 하나
   *   늘어날 때 빼먹어도 타입체크가 통과한다 — 그 경로로 낡은 화면이 남의 기록을
   *   조용히 덮어쓴다. 빼먹을 수 없게 만드는 게 유일하게 믿을 만한 방어다.
   *
   *   조회가 끝나기 전에는 저장 자체를 막는다(버튼 비활성).
   *   생략을 허용하는 건 DB 함수 쪽뿐이다 — 시드와 서버 내부 호출용이다.
   */
  baseRevision: number;
  /** 생략하면 그날 값을 그대로 둔다. 빈 배열을 보내면 전부 지운다. */
  etcItems?: EtcItem[];
  extraItems?: ExtraItem[];
}

/** 재고가 모자란 채로 팔린 항목 — 화면이 "재고 기록이 실제와 다를 수 있어요"를 알려야 한다. */
export interface Shortage { ingredientId: string; name: string; needed: number; available: number; shortage: number }

/**
 * 그날 기준 메뉴 손익 세부 — 판매가·재료 줄·부자재 항목·고정지출 항목까지
 * **영업 시작 시점 값**이다(0051).
 *
 * ⚠ 레시피 상세(useRecipeDetail)를 쓰면 안 된다. 그건 "지금 팔면 얼마 남나"라
 *   레시피를 고치는 순간 지난 날짜의 세부까지 따라 움직인다. 여기는 장부다.
 */
export interface DayMenuLine {
  ingredientId: string; name: string; baseUnit: 'g' | 'ml' | 'ea';
  perServing: number; unitPrice: number | null; amount: number;
}
export interface DayMenuExtra { name: string; qty: number; amount: number }
export interface DayMenuFixedItem { key: string; amount: number; rate: number }
export interface DayMenuDetail {
  sold: boolean;
  name: string;
  qty: number; qtyWaste: number; qtyHall: number; qtyDelivery: number; qtyTakeout: number;
  baseServings: number;
  taxMode: 'included' | 'separate' | 'exempt';
  price: number; materialCost: number; extraCost: number;
  fixedRate: number; fixedCost: number; tax: number; profit: number;
  /** 그날 세금 항목별 내역(부가세 포함). 나중에 요율을 고쳐도 이건 안 움직인다(0054). */
  taxItems: { name: string; rate: number; amount: number; builtin: boolean }[];
  lines: DayMenuLine[]; extras: DayMenuExtra[]; fixedItems: DayMenuFixedItem[];
}

export function useDayMenuDetail(date: string | undefined, recipeId: string | undefined) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.salesDay(date ?? ''), 'menu', recipeId ?? ''],
    enabled: Boolean(storeId && date && recipeId),
    queryFn: async (): Promise<DayMenuDetail> => {
      const { data, error } = await supabase.rpc('day_menu_detail', {
        p_store: storeId, p_date: date as string, p_recipe: recipeId as string,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      const arr = (k: string) => (r[k] ?? []) as Record<string, unknown>[];
      return {
        sold: Boolean(r.sold),
        name: String(r.name ?? ''),
        qty: num(r.qty), qtyWaste: num(r.qty_waste),
        qtyHall: num(r.qty_hall), qtyDelivery: num(r.qty_delivery), qtyTakeout: num(r.qty_takeout),
        baseServings: num(r.base_servings),
        taxMode: (r.tax_mode ?? 'included') as DayMenuDetail['taxMode'],
        price: num(r.price), materialCost: num(r.material_cost), extraCost: num(r.extra_cost),
        fixedRate: num(r.fixed_rate), fixedCost: num(r.fixed_cost),
        tax: num(r.tax), profit: num(r.profit),
        taxItems: arr('tax_items').map((t) => ({
          name: String(t.name ?? ''), rate: num(t.rate), amount: num(t.amount),
          builtin: t.builtin === true,
        })),
        lines: arr('lines').map((l) => ({
          ingredientId: String(l.ingredient_id), name: String(l.name),
          baseUnit: (l.base_unit ?? 'g') as DayMenuLine['baseUnit'],
          perServing: num(l.per_serving), unitPrice: numOrNull(l.unit_price), amount: num(l.amount),
        })),
        extras: arr('extras').map((e) => ({ name: String(e.name), qty: num(e.qty), amount: num(e.amount) })),
        fixedItems: arr('fixed_items').map((i) => ({ key: String(i.key), amount: num(i.amount), rate: num(i.rate) })),
      };
    },
  });
}

/**
 * 기간 메뉴 손익 — 날마다 그날 기준으로 계산해 **합산**한 값이다(0059).
 *
 * 사장님: "a재료 값을 10번 수정했어. 합계해서 보여준다고 해둬 — 어떤 합도 보여줘야 하잖아."
 * 그래서 평균이 아니라 합이다. 개당 값은 합 나누기 수량이라 '기간 평균'이라 부른다.
 */
export interface RangeMenuDetail {
  sold: boolean;
  name: string;
  days: number;
  qty: number; qtyWaste: number; qtyHall: number; qtyDelivery: number; qtyTakeout: number;
  /** 기간 합계 */
  revenue: number; materialCost: number; wasteMenu: number;
  extraCost: number; fixedCost: number; tax: number; profit: number;
  /** 개당(= 합 나누기 수량). 기간 중 값이 바뀌었으면 한 숫자로 말할 수 없다. */
  unitPrice: number; unitMaterialCost: number; unitExtraCost: number;
  unitFixedCost: number; unitTax: number; unitProfit: number;
  /** 기간에 판매가가 몇 가지였나. 하나뿐이면 길이 1. */
  pricePoints: { price: number; qty: number; days: number; from: string; to: string }[];
  lines: DayMenuLine[];
  extras: DayMenuExtra[];
  fixedItems: DayMenuFixedItem[];
}

export function useRangeMenuDetail(from: string | undefined, to: string | undefined, recipeId: string | undefined) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.salesRange(from ?? '', to ?? ''), 'menu', recipeId ?? ''],
    enabled: Boolean(storeId && from && to && recipeId),
    queryFn: async (): Promise<RangeMenuDetail> => {
      const { data, error } = await supabase.rpc('range_menu_detail', {
        p_store: storeId, p_from: from as string, p_to: to as string, p_recipe: recipeId as string,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      const arr = (k: string) => (r[k] ?? []) as Record<string, unknown>[];
      const qty = num(r.qty);
      return {
        sold: Boolean(r.sold),
        name: String(r.name ?? ''),
        days: num(r.days),
        qty, qtyWaste: num(r.qty_waste),
        qtyHall: num(r.qty_hall), qtyDelivery: num(r.qty_delivery), qtyTakeout: num(r.qty_takeout),
        revenue: num(r.revenue), materialCost: num(r.material_cost), wasteMenu: num(r.waste_menu),
        extraCost: num(r.extra_cost), fixedCost: num(r.fixed_cost),
        tax: num(r.tax), profit: num(r.profit),
        unitPrice: num(r.unit_price), unitMaterialCost: num(r.unit_material_cost),
        unitExtraCost: num(r.unit_extra_cost), unitFixedCost: num(r.unit_fixed_cost),
        unitTax: num(r.unit_tax), unitProfit: num(r.unit_profit),
        pricePoints: arr('price_points').map((x) => ({
          price: num(x.price), qty: num(x.qty), days: num(x.days),
          from: String(x.from), to: String(x.to),
        })),
        lines: arr('lines').map((l) => ({
          ingredientId: String(l.ingredient_id), name: String(l.name),
          baseUnit: (l.base_unit ?? 'g') as DayMenuLine['baseUnit'],
          perServing: num(l.per_serving), unitPrice: numOrNull(l.unit_price), amount: num(l.amount),
        })),
        // 부자재 금액은 기간 합이다. 화면은 1인분 기준으로 그리므로 개당으로 환산한다.
        extras: arr('extras').map((e) => ({
          name: String(e.name), qty: num(e.qty),
          amount: qty > 0 ? num(e.amount) / qty : 0,
        })),
        fixedItems: arr('fixed_items').map((i) => ({
          key: String(i.key),
          amount: qty > 0 ? num(i.amount) / qty : 0,
          rate: num(r.unit_price) > 0 && qty > 0 ? num(i.amount) / qty / num(r.unit_price) : 0,
        })),
      };
    },
  });
}

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
          ? input.etcItems.map((e) => ({ name: e.name, price: e.price, qty: e.qty, channel: e.channel ?? null }))
          : undefined,
        p_extra_items: input.extraItems
          ? input.extraItems.map((e) => ({ name: e.name, amount: e.amount, memo: e.memo ?? '' }))
          : undefined,
        p_base_revision: input.baseRevision,
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

/** 폐기 손실 되짚기(0092) — 조리 폐기와 식재료 폐기는 **갈라서** 본다(0041). */
export interface WasteBreakdown {
  total: number;
  menuTotal: number;
  ingredientTotal: number;
  /** 조리 폐기 — 만들어 놓고 못 판 몫. 덜 만들어야 한다는 신호. */
  menu: { name: string; qty: number; amount: number }[];
  /** 식재료 폐기 — 쓰기도 전에 버린 몫. 발주·보관을 손봐야 한다는 신호. */
  ingredient: { name: string; qty: number; baseUnit: string; amount: number }[];
}

export function useWasteBreakdown(from: string, to: string, enabled = true) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.salesRange(from, to), 'waste'],
    enabled: enabled && Boolean(from) && Boolean(to),
    queryFn: async (): Promise<WasteBreakdown> => {
      const { data, error } = await supabase.rpc('sales_waste_breakdown', { p_store: storeId, p_from: from, p_to: to });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      return {
        total: num(r.total),
        menuTotal: num(r.menu_total),
        ingredientTotal: num(r.ingredient_total),
        menu: ((r.menu ?? []) as Record<string, unknown>[]).map((m) => ({
          name: String(m.name), qty: num(m.qty), amount: num(m.amount),
        })),
        ingredient: ((r.ingredient ?? []) as Record<string, unknown>[]).map((i) => ({
          name: String(i.name), qty: num(i.qty),
          baseUnit: String(i.base_unit ?? 'g'), amount: num(i.amount),
        })),
      };
    },
  });
}

/** 세금 되짚기(0092) — 항목별, 그리고 메뉴분·기타 매출분. */
export interface TaxBreakdown {
  total: number;
  menuTotal: number;
  etcTotal: number;
  items: { name: string; rate: number; amount: number; menuAmount: number; etcAmount: number }[];
}

export function useTaxBreakdown(from: string, to: string, enabled = true) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.salesRange(from, to), 'tax'],
    enabled: enabled && Boolean(from) && Boolean(to),
    queryFn: async (): Promise<TaxBreakdown> => {
      const { data, error } = await supabase.rpc('sales_tax_breakdown', { p_store: storeId, p_from: from, p_to: to });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      return {
        total: num(r.total),
        menuTotal: num(r.menu_total),
        etcTotal: num(r.etc_total),
        items: ((r.items ?? []) as Record<string, unknown>[]).map((i) => ({
          name: String(i.name), rate: num(i.rate), amount: num(i.amount),
          menuAmount: num(i.menu_amount), etcAmount: num(i.etc_amount),
        })),
      };
    },
  });
}

/**
 * 채널별 기타 매출(0093).
 *
 * ⚠ `unassigned` 는 **매장이 아니다.** 채널을 묻기 전에 적은 줄이라 모르는 것이다.
 *   여기 몫이 크면 채널별 손익이 그만큼 눈을 감고 있다는 뜻이다.
 */
export interface EtcByChannel {
  total: number;
  byChannel: Record<string, { amount: number; tax: number }>;
  unassigned: number;
  unassignedTax: number;
}

export function useEtcByChannel(from: string, to: string, enabled = true) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.salesRange(from, to), 'etc-channel'],
    enabled: enabled && Boolean(from) && Boolean(to),
    queryFn: async (): Promise<EtcByChannel> => {
      const { data, error } = await supabase.rpc('sales_etc_by_channel', { p_store: storeId, p_from: from, p_to: to });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      const by: Record<string, { amount: number; tax: number }> = {};
      for (const [k, v] of Object.entries((r.by_channel ?? {}) as Record<string, Record<string, unknown>>)) {
        by[k] = { amount: num(v.amount), tax: num(v.tax) };
      }
      return {
        total: num(r.total),
        byChannel: by,
        unassigned: num(r.unassigned),
        unassignedTax: num(r.unassigned_tax),
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

/**
 * 재고가 바닥나 못 만드는 레시피와 그 재료들(0101).
 * ⚠ `ingredientCount` 는 **식재료** 개수다 — 같은 재료가 여러 메뉴를 막아도 하나로 센다.
 *   매출 상단의 `식재료 부족 N개` 가 쓰는 숫자가 이것이다.
 */
export interface ShortageIngredient {
  ingredientId: string;
  name: string;
  baseUnit: string;
  safetyStock: number;
  safetyStockIsBase: boolean;
  perVolume: number;
  needPerServing: number;
  /**
   * 화면에 적을 **필요 수량**. 서버가 판정 종류에 맞춰 채워 준다(0107).
   *   영업 시작 판정 → 1개 필요량
   *   판매 판정     → 이번에 **더 빠질** 몫(증가분)
   * ⚠ 앱이 다시 계산하지 않는다. 계산이 두 벌이 되면 경고와 실제 차감이 갈린다.
   */
  need: number;
  stock: number;
}
export interface ShortageRecipe {
  recipeId: string;
  name: string;
  ingredients: ShortageIngredient[];
}
export interface ShortageResult {
  /** 'start' 면 안전재고를, 'sale' 이면 필요 수량을 나란히 보여 준다(기획안 §4.4). */
  mode: ShortageMode;
  /**
   * 잴 수 있었나(0119). 필요량은 **그날 스냅샷**에서 오므로 영업 시작 전에는 못 잰다.
   * ⚠ false 면 `ingredientCount: 0` 은 "넉넉하다"가 아니라 **"못 쟀다"** 는 뜻이다.
   *   둘을 같이 취급하면 영업 시작 직후 재시도에서 경고가 통째로 새어 나간다.
   */
  hasBasis: boolean;
  ingredientCount: number;
  recipes: ShortageRecipe[];
}

const parseShortages = (data: unknown): ShortageResult => {
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    mode: r.mode === 'sale' ? 'sale' : 'start',
    // 영업 시작 판정은 지금 재고만 보므로 언제나 잴 수 있다. 스냅샷이 필요한 건 판매 판정뿐이다.
    hasBasis: r.mode === 'sale' ? r.has_basis === true : true,
    ingredientCount: num(r.ingredient_count),
    recipes: ((r.recipes ?? []) as Record<string, unknown>[]).map((x) => ({
      recipeId: String(x.recipe_id),
      name: String(x.name),
      ingredients: ((x.ingredients ?? []) as Record<string, unknown>[]).map((g) => ({
        ingredientId: String(g.ingredient_id),
        name: String(g.name),
        baseUnit: String(g.base_unit),
        safetyStock: num(g.safety_stock),
        safetyStockIsBase: g.safety_stock_is_base === true,
        perVolume: num(g.per_volume),
        needPerServing: num(g.need_per_serving),
        need: num(g.need),
        stock: num(g.stock),
      })),
    })),
  };
};

/** 영업 시작 판정 — 지금 재고로 **1개도 못 만드는** 레시피(0107). 상단 안내도 이 숫자다. */
export function useRecipeShortages(enabled = true) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: ['sales', 'shortages', storeId],
    enabled: enabled && Boolean(storeId),
    queryFn: async (): Promise<ShortageResult> => {
      const { data, error } = await supabase.rpc('recipe_shortages', { p_store: storeId });
      if (error) throw new Error(error.message);
      return parseShortages(data);
    },
  });
}

/** 저장 직전에 보낼 판매 묶음. `save_sale` 이 받는 것과 같은 모양이어야 한다. */
const toRpcItems = (items: SaleItemInput[]) =>
  items.map((i) => ({
    recipe_id: i.recipeId,
    qty_hall: i.qtyHall,
    qty_delivery: i.qtyDelivery,
    qty_takeout: i.qtyTakeout,
    qty_waste: i.qtyWaste ?? 0,
  }));

/**
 * 판매 판정 — 이 판매를 저장하면 **더 빠질 몫**이 모자란가(0107).
 *
 * ⚠ 전체 판매량이 아니라 증가분이다. 10개를 7개로 고치는데 경고가 뜨면 거짓말이다.
 *   그 계산은 전부 서버에 있다 — 여기서는 결과를 그리기만 한다.
 */
export function useSaleShortages(date: string, items: SaleItemInput[], enabled = true) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: ['sales', 'saleShortages', storeId, date, toRpcItems(items)],
    enabled: enabled && Boolean(storeId) && items.length > 0,
    queryFn: async (): Promise<ShortageResult> => {
      const { data, error } = await supabase.rpc('sale_shortages', {
        p_store: storeId, p_date: date, p_items: toRpcItems(items),
      });
      if (error) throw new Error(error.message);
      return parseShortages(data);
    },
  });
}

/**
 * 영업 시작 버튼을 누른 그 순간 한 번 재는 용도.
 *
 * ⚠ 캐시(`useRecipeShortages`)를 읽으면 안 된다. 아직 안 받았거나 실패했으면
 *   `undefined` 라 `?? 0` 에 걸려 **부족이 없는 것처럼** 지나간다 — 조용히 틀리는 쪽이다.
 *   눌렀을 때 서버에 직접 물어보면 로딩이라는 상태 자체가 없다.
 */
export function useCheckRecipeShortages() {
  const storeId = useStoreId();
  return useCallback(async (): Promise<ShortageResult> => {
    const { data, error } = await supabase.rpc('recipe_shortages', { p_store: storeId });
    if (error) throw new Error(error.message);
    return parseShortages(data);
  }, [storeId]);
}

/** 저장 버튼을 누른 그 순간 한 번 재는 용도. 조회 캐시에 얹지 않는다. */
export function useCheckSaleShortages() {
  const storeId = useStoreId();
  return useCallback(
    async (date: string, items: SaleItemInput[]): Promise<ShortageResult> => {
      const { data, error } = await supabase.rpc('sale_shortages', {
        p_store: storeId, p_date: date, p_items: toRpcItems(items),
      });
      if (error) throw new Error(error.message);
      return parseShortages(data);
    },
    [storeId],
  );
}
