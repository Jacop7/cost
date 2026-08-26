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

export interface OperatingHours {
  openTime: string;
  closeTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  /** 종료가 시작보다 이르면 1 — 다음 날로 넘어간다는 뜻이다. 서버가 계산한다. */
  closeDayOffset: number;
  closed: boolean;
}

export interface HoursStatus {
  localDate: string;
  /** 매장 시간대(IANA). 정한 적 없으면 서버 기본(Asia/Seoul)이 온다. */
  timezone: string;
  /** 사장님이 **정한** 값인가(0122 confirmed). false 면 화면이 기기 시간대를 제안한다. */
  timezoneConfirmed: boolean;
  /** 오늘 **실제로** 적용 중인 시간. settings 입력값이 아니라 규칙에서 온다. */
  today: OperatingHours;
  /** 지금 적용 중인 규칙 전체(주간) — 요일별 편집 화면의 초깃값(0156). 규칙이 없으면 null. */
  currentRule: { effectiveFrom: string | null; weeklyHours: Record<string, unknown>; weeklyBreaks: Record<string, unknown> } | null;
  /** 아직 시작 안 한 규칙. 없으면 null. */
  pending: { effectiveFrom: string; hours: OperatingHours } | null;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const YMD_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const failed = (what: string) =>
  new Error(`서버가 ${what}을 주지 않았어요. 잠시 후 다시 시도해 주세요`);

/** 시각 문자열. 형식이 아니면 던진다 — 빈 문자열로 넘기면 화면이 `~` 만 그린다. */
function reqTime(v: unknown, what: string): string {
  const t = typeof v === 'string' ? v : '';
  if (!HHMM.test(t)) throw failed(what);
  return t;
}

/** 브레이크는 **없는 게 정상**이다. 다만 있으면 시각이어야 한다. */
function optTime(v: unknown, what: string): string | null {
  if (v === null || v === undefined) return null;
  return reqTime(v, what);
}

/**
 * ⚠ 조용한 기본값을 두지 않는다(0132). `String(v.open_time ?? '')` 이면 서버가 키를
 *   빠뜨려도 화면이 멀쩡히 열리고 시간만 빈칸이 된다. 사장님은 영업시간이 지워진 줄 안다.
 */
const hoursOf = (v: Record<string, unknown>, where: string): OperatingHours => ({
  openTime: reqTime(v.open_time, `${where} 시작 시각`),
  closeTime: reqTime(v.close_time, `${where} 종료 시각`),
  breakStart: optTime(v.break_start, `${where} 브레이크 시작`),
  breakEnd: optTime(v.break_end, `${where} 브레이크 종료`),
  closeDayOffset: Number(v.close_day_offset ?? 0),
  closed: Boolean(v.closed),
});

/**
 * 지금 적용 중인 영업시간과 **예약된** 영업시간(0131).
 *
 * ⚠ 왜 `useStoreSettings` 로 안 되는가 — 그건 **입력 폼**이라 저장하는 순간 새 값이 된다.
 *   그런데 영업 중에 바꾸면 실제 적용은 **다음 영업일**부터다(0130). 둘을 같은 값으로
 *   보여 주면 화면이 "오늘부터 바뀌었다"고 거짓말한다.
 */
export function useHoursStatus() {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.storeSettings, 'hours-status'],
    enabled: Boolean(storeId),
    queryFn: async (): Promise<HoursStatus> => {
      const { data, error } = await supabase.rpc('operating_hours_status', { p_store: storeId });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;

      const localDate = typeof r.local_date === 'string' ? r.local_date : '';
      if (!YMD_RE.test(localDate)) throw failed('오늘 날짜');

      // ⚠ 조용한 기본값 금지(0132·0156). 없으면 던져야 배포 어긋남이 화면에 보인다.
      const timezone = typeof r.timezone === 'string' && r.timezone !== '' ? r.timezone : null;
      if (timezone === null) throw failed('매장 시간대');
      if (typeof r.timezone_confirmed !== 'boolean') throw failed('시간대 확정 여부');

      const cr = r.current_rule as Record<string, unknown> | null | undefined;
      let currentRule: HoursStatus['currentRule'] = null;
      if (cr) {
        const wh = cr.weekly_hours;
        const wb = cr.weekly_breaks;
        if (typeof wh !== 'object' || wh === null || typeof wb !== 'object' || wb === null) {
          throw failed('주간 규칙');
        }
        currentRule = {
          effectiveFrom: typeof cr.effective_from === 'string' && YMD_RE.test(cr.effective_from)
            ? cr.effective_from : null,
          weeklyHours: wh as Record<string, unknown>,
          weeklyBreaks: wb as Record<string, unknown>,
        };
      }

      const today = r.today as Record<string, unknown> | null;
      if (!today) throw failed('오늘 영업시간');

      const p = r.pending as Record<string, unknown> | null;
      let pending: HoursStatus['pending'] = null;
      if (p) {
        const from = typeof p.effective_from === 'string' ? p.effective_from : '';
        if (!YMD_RE.test(from)) throw failed('영업시간 적용 시작일');
        pending = {
          effectiveFrom: from,
          hours: hoursOf((p.hours ?? {}) as Record<string, unknown>, '예약된'),
        };
      }

      return {
        localDate, timezone, timezoneConfirmed: r.timezone_confirmed,
        today: hoursOf(today, '오늘'), currentRule, pending,
      };
    },
  });
}

/**
 * 요일별 영업시간 저장(0156) — `set_operating_hours` 직행.
 *
 * ⚠ `useSaveSettings` 가 아니다. 그쪽(settings)은 요일 구분이 없는 옛 입력 폼이라
 *   월~일 공통값만 실을 수 있다. 요일별 규칙은 이 문으로만 온전히 간다.
 */
export function useSetOperatingHours() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: {
      weeklyHours: Record<string, unknown>;
      weeklyBreaks: Record<string, unknown>;
    }): Promise<{ effectiveFrom: string; appliesToday: boolean }> => {
      const { data, error } = await supabase.rpc('set_operating_hours', {
        p_store: storeId,
        p_weekly_hours: asJson(input.weeklyHours),
        p_weekly_breaks: asJson(input.weeklyBreaks),
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      // 언제부터인지는 화면이 반드시 말해야 한다(0130) — 없으면 계약 위반이다.
      const from = typeof r.effective_from === 'string' ? r.effective_from : '';
      if (!YMD_RE.test(from)) throw failed('적용 시작일');
      if (typeof r.applies_today !== 'boolean') throw failed('오늘 적용 여부');
      return { effectiveFrom: from, appliesToday: r.applies_today };
    },
    // 영업시간은 상태 카드(business_day_state)에도 실린다 — 같이 다시 그린다.
    onSuccess: () => invalidate(qc, [...invalidateOn.settingsSaved(), ...invalidateOn.businessDay()]),
  });
}

/**
 * 매장 시간대 변경(0156) — 유일한 문. 영업 중이면 서버가 45011 로 거부한다.
 * 최초 제안은 화면이 기기 시간대(Intl)로 하고, 확정은 이 RPC 가 confirmed 로 남긴다.
 */
export function useSetStoreTimezone() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (timezone: string): Promise<void> => {
      const { error } = await supabase.rpc('set_store_timezone', {
        p_store: storeId, p_timezone: timezone,
      });
      if (error) throw new Error(error.message);
    },
    // 시간대가 바뀌면 '오늘'이 움직인다 — 날짜를 쓰는 화면 전부가 대상이다.
    onSuccess: () => invalidate(qc, [...invalidateOn.settingsSaved(), ...invalidateOn.businessDay()]),
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
