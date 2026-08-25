/**
 * 마이페이지 설정 훅 — 카테고리 · 거래처 · 판매채널 · 고정지출 · 단위/언어.
 *
 * 목록 셋은 서로 다른 화면이 쓰지만 조회 비용이 작아 `settings_lists` 하나로 받는다.
 * 각각 따로 받으면 화면 진입마다 3 왕복이 되고, 무효화 대상도 3배로 흩어진다.
 */
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { asJson } from '@/lib/json';
import { useStoreId } from '@/lib/SessionProvider';
import type { TaxMode } from '@sikjae/types';

const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export type CategoryKind = 'ingredient' | 'recipe' | 'material';

export interface CategoryRow { id: string; name: string; kind: CategoryKind; sortOrder: number; usedCount: number }
export interface VendorRow { id: string; name: string; usedCount: number }
export interface ChannelRow { id: string; code: string; name: string; active: boolean }
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
          usedCount: num(c.used_count),
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
          active: Boolean(c.active),
        })),
      };
    },
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; kind?: CategoryKind }) => {
      const { error } = await supabase.rpc('save_category', {
        p_store: storeId,
        p_payload: asJson({
          id: input.id ?? '',
          name: input.name,
          kind: input.kind ?? 'ingredient',
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

/**
 * 이름으로 거래처를 확보한다 — 있으면 그 id, 없으면 만들어서 id.
 *
 * 재고 추가에서 `직접 입력` 으로 구매처를 적을 때 쓴다(기획안 §4.4).
 * ⚠ 같은 이름을 두 번 만들지 않는다. `save_vendor` 가 중복을 23505 로 막긴 하지만,
 *   막힌 뒤에 되찾는 것보다 먼저 찾아보는 게 낫다 — 대소문자만 다른 경우도 같은 곳이다.
 */
export function useEnsureVendor() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  const lists = useSettingsLists();
  return useCallback(
    async (name: string): Promise<string> => {
      const n = name.trim();
      if (n === '') throw new Error('구매처를 입력해 주세요');

      const hit = (lists.data?.vendors ?? []).find(
        (v) => v.name.trim().toLowerCase() === n.toLowerCase(),
      );
      if (hit) return hit.id;

      const { data, error } = await supabase.rpc('save_vendor', {
        p_store: storeId,
        p_payload: asJson({ id: '', name: n }),
      });
      if (error) throw new Error(error.message);
      invalidate(qc, invalidateOn.settingsSaved());
      return String(data);
    },
    [qc, storeId, lists.data],
  );
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
    mutationFn: async (input: { id: string; name: string; active?: boolean }) => {
      const { error } = await supabase.rpc('save_channel', {
        p_store: storeId,
        p_payload: asJson({ id: input.id, name: input.name, active: input.active }),
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

/**
 * ⚠ `month` 에 기본값을 **두지 않는다**(0126). 예전엔 core 의 `currentBusinessMonth`
 *   였는데, 그건 기기 시계에서 나온 `+09:00` 고정 오프셋 값이다. 뉴욕 매장의
 *   8/31 22:00 은 서울로 9/1 이라 **서버는 8월 장부를 보는데 이 훅만 9월을 열었다.**
 *   부르는 쪽이 서버 월(`localDate.slice(0, 7)`)을 넘긴다.
 */
export function useFixedCosts(month: string) {
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

/**
 * 채널 사용 중지 — 지우지 않는다.
 * 과거 매출이 그 채널로 기록돼 있어서, 지우면 "어디서 팔았는지 모르는 매출"이 남는다.
 */
export function useRetireChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('retire_channel', { p_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.settingsSaved()),
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
  /** 영업 시작 시각 'HH:MM'. */
  openTime: string;
  /** 영업 종료 시각 'HH:MM'. 시작보다 이르면 자정을 넘는 영업이다. */
  closeTime: string;
  /** 브레이크 타임(선택). 없으면 null. */
  breakStart: string | null;
  breakEnd: string | null;
  /** 자정을 넘는 영업인가 — 서버가 판단해서 준다. */
  overnight: boolean;
  /** 총 영업 시간(분). 10:00~02:00 이면 960. */
  openMinutes: number;
  /**
   * 세금 — **매장 하나에 하나다**(0087). 레시피마다 다르지 않다.
   * 고치는 길은 MY > 세금 뿐이고, 고치면 전 레시피 손익 변동에 기록된다.
   */
  taxMode: TaxMode;
  taxItems: { name: string; rate: number }[];
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
        openTime: String(r.open_time ?? '11:00'),
        closeTime: String(r.close_time ?? '22:00'),
        breakStart: str(r.break_start),
        breakEnd: str(r.break_end),
        overnight: Boolean(r.overnight),
        openMinutes: num(r.open_minutes),
        taxMode: (String(r.tax_mode ?? 'included') as TaxMode),
        taxItems: ((r.tax_items ?? []) as Record<string, unknown>[]).map((t) => ({
          name: String(t.name ?? ''),
          rate: num(t.rate),
        })),
      };
    },
  });
}

/**
 * 세금 저장(0087). 전 레시피 손익이 다시 계산되고 손익 변동에 한 줄씩 남는다.
 * ⚠ 그래서 레시피·매출·수정 내역까지 함께 무효화한다 — 고정지출(E4)과 같다.
 */
export function useSaveStoreTax() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (items: { name: string; rate: number }[]) => {
      const { data, error } = await supabase.rpc('save_store_tax', {
        p_store: storeId,
        // ⚠ 서버 인자는 남아 있지만 tax_of() 가 더는 읽지 않는다(0090).
        //   세금은 항목의 합뿐이다. 인자를 지우려면 RPC 를 drop 해야 해서 자리만 뒀다.
        p_mode: 'included',
        p_items: items.filter((t) => t.name.trim() !== '' && t.rate > 0),
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      return { changed: Boolean(r.changed), recipes: num(r.recipes) };
    },
    onSuccess: () => invalidate(qc, [qk.storeSettings, ...invalidateOn.e4()]),
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
      if (input.openTime !== undefined) payload.open_time = input.openTime;
      if (input.closeTime !== undefined) payload.close_time = input.closeTime;
      // 브레이크는 지우는 것도 뜻이 있다 — undefined 가 아니면 null 이라도 보낸다.
      if (input.breakStart !== undefined) payload.break_start = input.breakStart ?? '';
      if (input.breakEnd !== undefined) payload.break_end = input.breakEnd ?? '';

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

/**
 * 수기 월매출(고정지출률 분모)과 실제 매출의 괴리 (M-030).
 *
 * 총 월매출은 수기 입력이 설계 의도다(레시피 v3 §111). 그래서 자동으로 덮어쓰지 않고
 * **얼마나 어긋났는지만** 보여준다. 그 숫자가 전 메뉴 순이익에 곱해지므로,
 * 어긋난 걸 모르면 모든 메뉴 손익이 조용히 틀어진다.
 */
export interface RevenueCheck {
  month: string;
  daysElapsed: number;
  daysTotal: number;
  /** 진행 중인 달이면 true — 월 환산이 추정치임을 화면이 밝혀야 한다. */
  inProgress: boolean;
  /** 사장님이 적은 값. 안 적었으면 null(0원 매출과 구분한다). */
  manualRevenue: number | null;
  fixedTotal: number | null;
  actualRevenue: number;
  /** 진행 중인 달은 일할 환산, 끝난 달은 실적 그대로. 경과 0일이면 null. */
  projectedRevenue: number | null;
  /** (월 환산 ÷ 수기) − 1, %. 둘 중 하나라도 없으면 null. */
  gapPct: number | null;
  rateManual: number | null;
  rateProjected: number | null;
  hasSales: boolean;
}

/** ⚠ 기본값 없음 — 위 `useFixedCosts` 와 같은 이유다(0126). */
export function useRevenueCheck(month: string) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.fixedCosts(month), 'revenue-check'],
    queryFn: async (): Promise<RevenueCheck> => {
      const { data, error } = await supabase.rpc('fixed_cost_revenue_check', {
        p_store: storeId,
        p_month: month,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      return {
        month: String(r.month ?? month),
        daysElapsed: num(r.days_elapsed),
        daysTotal: num(r.days_total),
        inProgress: Boolean(r.in_progress),
        manualRevenue: r.manual_revenue == null ? null : num(r.manual_revenue),
        fixedTotal: r.fixed_total == null ? null : num(r.fixed_total),
        actualRevenue: num(r.actual_revenue),
        projectedRevenue: r.projected_revenue == null ? null : num(r.projected_revenue),
        gapPct: r.gap_pct == null ? null : num(r.gap_pct),
        rateManual: r.rate_manual == null ? null : num(r.rate_manual),
        rateProjected: r.rate_projected == null ? null : num(r.rate_projected),
        hasSales: Boolean(r.has_sales),
      };
    },
  });
}
