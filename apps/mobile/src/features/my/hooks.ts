/**
 * 마이페이지 설정 훅 — 카테고리 · 거래처 · 판매채널 · 고정지출 · 단위/언어.
 *
 * 목록 셋은 서로 다른 화면이 쓰지만 조회 비용이 작아 `settings_lists` 하나로 받는다.
 * 각각 따로 받으면 화면 진입마다 3 왕복이 되고, 무효화 대상도 3배로 흩어진다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { asJson } from '@/lib/json';
import { useStoreId } from '@/lib/SessionProvider';
import { currentBusinessMonth } from '@sikjae/core';

const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export type CategoryKind = 'ingredient' | 'recipe' | 'material';

export interface CategoryRow { id: string; name: string; kind: CategoryKind; sortOrder: number; defaultLossRate: number; usedCount: number }
export interface VendorRow { id: string; name: string; usedCount: number }
export interface ChannelRow { id: string; code: string; name: string; feeRate: number; feeNote: string | null; active: boolean }
/** 부자재 마스터 — 여러 메뉴가 같은 단가를 참조하게 한다. */
export interface MaterialRow {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  unitCost: number;
  unitLabel: string;
  memo: string | null;
  usedCount: number;
}

export interface SettingsLists {
  categories: CategoryRow[];
  recipeCategories: CategoryRow[];
  materialCategories: CategoryRow[];
  materials: MaterialRow[];
  vendors: VendorRow[];
  channels: ChannelRow[];
}

export function useSettingsLists() {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.settingsLists,
    queryFn: async (): Promise<SettingsLists> => {
      const { data, error } = await supabase.rpc('settings_lists', { p_store: storeId });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      const cats = (v: unknown): CategoryRow[] =>
        ((v ?? []) as Record<string, unknown>[]).map((c) => ({
          id: String(c.id), name: String(c.name),
          kind: (c.kind as CategoryKind) ?? 'ingredient',
          sortOrder: num(c.sort_order),
          defaultLossRate: num(c.default_loss_rate), usedCount: num(c.used_count),
        }));

      return {
        categories: cats(r.categories),
        recipeCategories: cats(r.recipe_categories),
        materialCategories: cats(r.material_categories),
        materials: ((r.materials ?? []) as Record<string, unknown>[]).map((m) => ({
          id: String(m.id), name: String(m.name),
          categoryId: str(m.category_id), categoryName: str(m.category_name),
          unitCost: num(m.unit_cost), unitLabel: String(m.unit_label ?? '개'),
          memo: str(m.memo), usedCount: num(m.used_count),
        })),
        vendors: ((r.vendors ?? []) as Record<string, unknown>[]).map((v) => ({
          id: String(v.id), name: String(v.name), usedCount: num(v.used_count),
        })),
        channels: ((r.channels ?? []) as Record<string, unknown>[]).map((c) => ({
          id: String(c.id), code: String(c.code), name: String(c.name),
          feeRate: num(c.fee_rate), feeNote: str(c.fee_note), active: Boolean(c.active),
        })),
      };
    },
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; kind?: CategoryKind; defaultLossRate?: number }) => {
      const { error } = await supabase.rpc('save_category', {
        p_store: storeId,
        p_payload: asJson({
          id: input.id ?? '',
          name: input.name,
          kind: input.kind ?? 'ingredient',
          default_loss_rate: input.defaultLossRate,
        }),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.settingsSaved()),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_category', { p_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.settingsSaved()),
  });
}

/** 드래그 정렬 — 여러 행이 동시에 바뀌므로 순서 전체를 한 번에 보낸다. */
export function useReorderCategories() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('reorder_categories', { p_store: storeId, p_ids: ids });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.settingsSaved()),
  });
}

export function useSaveVendor() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string }) => {
      const { error } = await supabase.rpc('save_vendor', {
        p_store: storeId,
        p_payload: asJson({ id: input.id ?? '', name: input.name }),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.settingsSaved()),
  });
}

/** 발주 이력이 있으면 서버가 숨김 처리한다 — 지우면 과거 발주의 거래처가 사라진다. */
export function useDeleteVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_vendor', { p_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.settingsSaved()),
  });
}

export function useSaveChannel() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: { id?: string; code?: string; name: string; feeRate: number; feeNote?: string | null }) => {
      const { error } = await supabase.rpc('save_channel', {
        p_store: storeId,
        p_payload: asJson({
          id: input.id ?? '', code: input.code ?? '', name: input.name,
          fee_rate: input.feeRate, fee_note: input.feeNote ?? '',
        }),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.settingsSaved()),
  });
}

// ── 고정지출 (MY-05) ──────────────────────────────────────────
export interface FixedCostLine { name: string; amount: number }
/** 채널 코드 -> 비중(%). null 이면 채널 매출 비중으로 자동 배분한다. */
export type ChannelWeights = Record<string, number>;
export interface FixedCostItem {
  key: string;
  mode: 'total' | 'detail';
  total: number;
  lines: FixedCostLine[];
  weights: ChannelWeights | null;
}
export interface FixedCosts {
  month: string;
  totalRevenue: number;
  items: FixedCostItem[];
  /** 고정지출률 = 합계 ÷ 월 매출. 서버 `fixed_cost_rate()` 와 같은 정의. */
  rate: number | null;
}

export function useFixedCosts(month: string = currentBusinessMonth()) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.fixedCosts(month),
    queryFn: async (): Promise<FixedCosts> => {
      const { data, error } = await supabase
        .from('fixed_costs_monthly')
        .select('month, total_revenue, items')
        .eq('store_id', storeId)
        .eq('month', month)
        .maybeSingle();
      if (error) throw new Error(error.message);

      const items = ((data?.items ?? []) as unknown as Record<string, unknown>[]).map((i) => ({
        key: String(i.key),
        mode: (i.mode as 'total' | 'detail') ?? 'total',
        total: num(i.total),
        lines: ((i.lines ?? []) as Record<string, unknown>[]).map((l) => ({
          name: String(l.name ?? ''), amount: num(l.amount),
        })),
        weights: i.weights && typeof i.weights === 'object'
          ? Object.fromEntries(Object.entries(i.weights as Record<string, unknown>).map(([k, v]) => [k, num(v)]))
          : null,
      }));
      const revenue = num(data?.total_revenue);
      const sum = items.reduce((a, i) => a + i.total, 0);
      return { month, totalRevenue: revenue, items, rate: revenue > 0 ? sum / revenue : null };
    },
  });
}

export function useSaveFixedCosts() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: { month: string; totalRevenue: number; items: FixedCostItem[] }) => {
      const { error } = await supabase.rpc('save_fixed_costs', {
        p_store: storeId,
        p_month: input.month,
        p_total_revenue: input.totalRevenue,
        // 합계 정규화는 서버가 한다(줄이 있으면 줄의 합이 진실). 여기서 또 계산하면 두 벌이 된다.
        p_items: asJson(input.items.map((i) => ({
          key: i.key,
          mode: i.mode,
          total: i.total,
          lines: i.lines,
          ...(i.weights ? { weights: i.weights } : {}),
        }))),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, input) => invalidate(qc, [...invalidateOn.e4(), qk.fixedCosts(input.month)]),
  });
}

// ── 매장 설정 (MY-06 단위 · MY-08 언어/통화 · 알림) ───────────
export interface StoreSettings {
  unitSystem: string;
  cupVolume: number;
  defaultTargetProfitRate: number;
  locale: string;
  currency: string;
  unitPriceDigits: number;
  quantityDigits: number;
  moneyDigits: number;
  alertMorningSummary: boolean;
  alertInboundDelay: boolean;
  alertPriceSpike: boolean;
  alertTargetMiss: boolean;
}

export function useStoreSettings() {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.storeSettings,
    queryFn: async (): Promise<StoreSettings> => {
      const { data, error } = await supabase.rpc('get_settings', { p_store: storeId });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      return {
        unitSystem: String(r.unit_system ?? 'metric'),
        cupVolume: num(r.cup_volume),
        defaultTargetProfitRate: num(r.default_target_profit_rate),
        locale: String(r.locale ?? 'ko-KR'),
        currency: String(r.currency ?? 'KRW'),
        unitPriceDigits: num(r.unit_price_digits),
        quantityDigits: num(r.quantity_digits),
        moneyDigits: num(r.money_digits),
        alertMorningSummary: Boolean(r.alert_morning_summary),
        alertInboundDelay: Boolean(r.alert_inbound_delay),
        alertPriceSpike: Boolean(r.alert_price_spike),
        alertTargetMiss: Boolean(r.alert_target_miss),
      };
    },
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: Partial<StoreSettings>) => {
      const payload: Record<string, unknown> = {};
      if (input.unitSystem !== undefined) payload.unit_system = input.unitSystem;
      if (input.cupVolume !== undefined) payload.cup_volume = input.cupVolume;
      if (input.defaultTargetProfitRate !== undefined) payload.default_target_profit_rate = input.defaultTargetProfitRate;
      if (input.locale !== undefined) payload.locale = input.locale;
      if (input.currency !== undefined) payload.currency = input.currency;
      if (input.unitPriceDigits !== undefined) payload.unit_price_digits = input.unitPriceDigits;
      if (input.quantityDigits !== undefined) payload.quantity_digits = input.quantityDigits;
      if (input.moneyDigits !== undefined) payload.money_digits = input.moneyDigits;
      if (input.alertMorningSummary !== undefined) payload.alert_morning_summary = input.alertMorningSummary;
      if (input.alertInboundDelay !== undefined) payload.alert_inbound_delay = input.alertInboundDelay;
      if (input.alertPriceSpike !== undefined) payload.alert_price_spike = input.alertPriceSpike;
      if (input.alertTargetMiss !== undefined) payload.alert_target_miss = input.alertTargetMiss;

      const { error } = await supabase.rpc('save_settings', { p_store: storeId, p_payload: asJson(payload) });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, [qk.settings]),
  });
}

// ── 부자재 마스터 (RCP-13) ────────────────────────────────────

export function useSaveMaterial() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      categoryId: string | null;
      /** 개당 단가(원). 박스로 샀으면 화면이 낱개로 환산해 넘긴다(절대원칙 1). */
      unitCost: number;
      unitLabel?: string;
      memo?: string | null;
    }) => {
      const { error } = await supabase.rpc('save_material', {
        p_store: storeId,
        p_payload: asJson({
          id: input.id ?? '',
          name: input.name,
          category_id: input.categoryId ?? '',
          unit_cost: input.unitCost,
          unit_label: input.unitLabel ?? '개',
          memo: input.memo ?? '',
        }),
      });
      if (error) throw new Error(error.message);
    },
    // 부자재 단가가 바뀌면 그걸 쓰는 메뉴 원가가 함께 움직인다 — 레시피도 무효화한다.
    onSuccess: () => invalidate(qc, [...invalidateOn.settingsSaved(), qk.recipes]),
  });
}

export function useDeactivateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('deactivate_material', { p_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, [...invalidateOn.settingsSaved(), qk.recipes]),
  });
}

/** 매장 이름 — 마이페이지 헤더에 쓴다. 하드코딩하면 다른 매장에서 남의 상호가 보인다. */
export function useStoreName() {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.store, 'name'],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from('stores').select('name').eq('id', storeId).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.name ?? null;
    },
  });
}

/** 채널별 고정지출 배분 (SALES-18). 항목 비중이 있으면 그대로, 없으면 매출 비중. */
export function useChannelFixed(from: string, to: string, enabled = true) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.salesRange(from, to), 'channel-fixed'],
    enabled: enabled && Boolean(from) && Boolean(to),
    queryFn: async (): Promise<{ total: number; provisional: boolean; byChannel: Record<string, number> }> => {
      const { data, error } = await supabase.rpc('sales_channel_fixed', { p_store: storeId, p_from: from, p_to: to });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      const ch = (r.channels ?? {}) as Record<string, unknown>;
      return {
        total: num(r.total),
        provisional: Boolean(r.provisional),
        byChannel: Object.fromEntries(Object.entries(ch).map(([k, v]) => [k, num(v)])),
      };
    },
  });
}
