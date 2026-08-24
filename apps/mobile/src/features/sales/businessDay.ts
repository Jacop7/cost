/**
 * 영업일 훅 — 오늘 값을 언제 굳히고 언제 푸는가.
 *
 * 사장님 결정: **영업 시작 시점의 판매가·재료 구성·단가·부자재·고정지출·세금으로
 * 하루가 고정된다.** 영업 중에 레시피를 고쳐도 오늘 매출·원가·손익은 안 움직이고,
 * 레시피 화면에는 새 값이 보인다("지금 팔면 얼마 남나"는 다른 질문이라서다).
 * 고친 값은 **다음 영업일 기준**부터 매출에 들어간다.
 *
 * 그래서 매출 등록 전에 영업이 시작돼 있어야 한다. 시작 전이면 서버가 45001 으로
 * 막고, 화면은 "오늘 영업을 시작할까요?"를 먼저 묻는다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useStoreId } from '@/lib/SessionProvider';

/** 'none' = 오늘 아직 시작 전 · 'closed' = 오늘 이미 끝냄. 화면이 다른 것을 그린다. */
export type BusinessDayStatus = 'none' | 'open' | 'break' | 'closed';

export interface AutoCloseNotice {
  businessDayId: string;
  businessDate: string;
  closedAt: string | null;
  plannedCloseAt: string | null;
  lastActivityAt: string | null;
}

export interface BusinessDayState {
  today: string;
  status: BusinessDayStatus;
  businessDayId: string | null;
  businessDate: string;
  openedAt: string | null;
  plannedCloseAt: string | null;
  closedAt: string | null;
  closeMethod: 'manual' | 'auto' | null;
  lastActivityAt: string | null;
  /** 마지막 활동 뒤로 미뤄진 **실제** 자동 종료 시각. 예정 시각과 다를 수 있다. */
  autoCloseAt: string | null;
  /** 예정 종료를 지났다 → "영업을 종료할까요?" */
  pastPlanned: boolean;
  /** 자동 종료 10분 전 → "10분 후 자동 종료돼요" */
  warnSoon: boolean;
  due: boolean;
  /** 아직 확인 안 한 자동 종료. 다음 앱 실행 때 알린다. */
  unacked: AutoCloseNotice | null;
  /**
   * 열려 있는 영업일이 **오늘이 아니다**(businessDate ≠ today).
   * 이때 오늘 매출은 서버가 45001 로 막는다 — 바가 '영업 중'만 말하면 안 된다.
   */
  staleDay: boolean;
  hours: {
    openTime: string | null;
    closeTime: string | null;
    breakStart: string | null;
    breakEnd: string | null;
    /** 종료가 시작보다 이르면 자정을 넘긴다(10:00~02:00). */
    overnight: boolean;
  };
}

const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

function parse(raw: unknown): BusinessDayState {
  const r = (raw ?? {}) as Record<string, unknown>;
  const h = (r.hours ?? {}) as Record<string, unknown>;
  const u = r.unacked as Record<string, unknown> | null;
  return {
    today: String(r.today ?? ''),
    status: (r.status ?? 'none') as BusinessDayStatus,
    businessDayId: str(r.business_day_id),
    businessDate: String(r.business_date ?? r.today ?? ''),
    openedAt: str(r.opened_at),
    plannedCloseAt: str(r.planned_close_at),
    closedAt: str(r.closed_at),
    closeMethod: (str(r.close_method) as 'manual' | 'auto' | null) ?? null,
    lastActivityAt: str(r.last_activity_at),
    autoCloseAt: str(r.auto_close_at),
    pastPlanned: r.past_planned === true,
    warnSoon: r.warn_soon === true,
    due: r.due === true,
    // 열린 날이 오늘이 아니면 오늘 매출은 서버가 막는다. 화면이 알아야 한다.
    staleDay:
      (r.status === 'open' || r.status === 'break') &&
      String(r.business_date ?? '') !== String(r.today ?? ''),
    unacked: u
      ? {
          businessDayId: String(u.business_day_id),
          businessDate: String(u.business_date),
          closedAt: str(u.closed_at),
          plannedCloseAt: str(u.planned_close_at),
          lastActivityAt: str(u.last_activity_at),
        }
      : null,
    hours: {
      openTime: str(h.open_time),
      closeTime: str(h.close_time),
      breakStart: str(h.break_start),
      breakEnd: str(h.break_end),
      overnight: h.overnight === true,
    },
  };
}

export function useBusinessDay() {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.businessDay,
    enabled: Boolean(storeId),
    queryFn: async (): Promise<BusinessDayState> => {
      /*
       * ⚠ 자동 종료는 **저절로 일어나지 않는다.** 서버에 스케줄러가 없어서
       *   누군가 불러 줘야 하고, 상태를 보는 이 순간이 그 자리다.
       *
       *   안 부르면 어제 영업이 열린 채로 굳는다. 그러면 오늘 매출 등록이
       *   `아직 영업을 시작하지 않았어요`(45001)로 막히는데, 화면 위 바는
       *   '영업 중'이라고 말한다 — 사장님은 왜 저장이 안 되는지 알 길이 없다.
       *   (실제로 이틀 열려 있었고 메뉴 판매 저장이 막혔다.)
       *
       * ⚠ 실패해도 조회는 계속한다. 종료를 못 했다고 화면까지 막을 이유는 없다.
       */
      const closed = await supabase.rpc('close_if_due', { p_store: storeId });
      if (closed.error && __DEV__) {
        console.warn('[businessDay] close_if_due:', closed.error.message);
      }

      const { data, error } = await supabase.rpc('business_day_state', { p_store: storeId });
      if (error) throw new Error(error.message);
      return parse(data);
    },
    // 자동 종료가 다가오는지는 시간이 지나야 바뀐다 — 화면을 열어 둔 채로도 알려면 주기적으로 본다.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

/** 영업 시작 — 이 시점 값으로 오늘이 굳는다. */
export function useOpenBusinessDay() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc('open_business_day', { p_store: storeId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.businessDay()),
  });
}

/** 브레이크타임 — 같은 영업일을 유지한다. 오늘 기준값도 그대로다. */
export function useSetBreak() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (on: boolean): Promise<void> => {
      const { error } = await supabase.rpc('set_break', { p_store: storeId, p_on: on });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.businessDay()),
  });
}

/** 영업 종료 — 그날 장부를 집계해 함께 남기고 잠근다. */
export function useCloseBusinessDay() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc('close_business_day', { p_store: storeId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.businessDay()),
  });
}

/**
 * 어제 걸 닫고 오늘을 연다 — **한 번에**.
 *
 * 안 닫힌 날이 남아 있으면 오늘 매출이 서버에서 45001 로 막힌다. 예전엔 사장님이
 * `종료` 누르고 `영업 시작` 을 또 눌러야 했는데, 화면은 그때 초록 '영업중' 배지를
 * 달고 있었다 — 뭘 눌러야 하는지 알 길이 없었다. 버튼 하나로 끝낸다.
 *
 * ⚠ 어제 기준값은 어제 것 그대로 잠긴 채로 닫힌다. 오늘 것만 지금 값으로 굳는다.
 */
export function useCloseStaleAndOpen() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const closed = await supabase.rpc('close_business_day', { p_store: storeId });
      if (closed.error) throw new Error(closed.error.message);
      const opened = await supabase.rpc('open_business_day', { p_store: storeId });
      if (opened.error) throw new Error(opened.error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.businessDay()),
  });
}

/** 종료 되돌리기 — 끝낸 뒤에 빠뜨린 판매를 넣을 때. 기준값(스냅샷)은 그대로다. */
export function useReopenBusinessDay() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (date: string): Promise<void> => {
      const { error } = await supabase.rpc('reopen_business_day', { p_store: storeId, p_date: date });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.businessDay()),
  });
}

/** 자동 종료 알림 확인 — 한 번 알리고 다시 알리지 않는다. */
export function useAckAutoClose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (businessDayId: string): Promise<void> => {
      const { error } = await supabase.rpc('ack_auto_close', { p_business_day: businessDayId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.businessDay()),
  });
}

/**
 * 서버가 "아직 영업을 시작하지 않았어요"로 막았는가(45001). 화면이 시작을 먼저 묻는다.
 *
 * ⚠ 코드가 아니라 **문구**로 가려낸다. PostgREST 응답에 SQLSTATE 가 그대로 오지 않는
 *   경우가 있어서다. 문구를 바꾸면 여기도 함께 고쳐야 한다.
 */
export const isNotOpenError = (e: unknown): boolean =>
  e instanceof Error && e.message.includes('아직 영업을 시작하지 않았어요');

/** 서버가 "종료된 영업일"로 막았는가(45002). 되돌리기를 권한다. */
export const isClosedError = (e: unknown): boolean =>
  e instanceof Error && e.message.includes('영업은 종료됐어요');

/** '2026-08-20T13:00:00+00:00' → '22:00'. 자정을 넘기면 '02:00' 처럼 그대로 나온다. */
export function hhmm(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 판매 입력 카드가 쓰는 **오늘 기준** 메뉴 값(0061).
 *
 * 여기가 마지막으로 남아 있던 구멍이었다. 돈 숫자는 전부 그날 기준으로 고정했는데
 * 판매를 입력하는 카드만 현재 레시피를 보고 있어서, 판매가를 고치면 카드는 새 값을
 * 보여 주고 장부에는 옛 값이 박혔다. 화면이 거짓말을 한 셈이다.
 *
 * 영업 전이면 스냅샷이 없고, 그때는 지금 값이 곧 오늘 값이 된다.
 */
export interface DayMenuBasis {
  recipeId: string;
  name: string;
  /** 오늘 팔면 이 값으로 잡힌다. */
  price: number;
  materialCost: number;
  extraCost: number;
  tax: number;
  fixedCost: number;
  profit: number;
  /** 지금 레시피 값. 달라졌으면 화면이 "내일부터"라고 알린다. */
  currentPrice: number;
  currentMaterialCost: number;
  currentProfit: number;
  changed: boolean;
  /** 오늘 기준에 없는 메뉴 — 오늘 만든 메뉴다. 서버가 판매를 막는다. */
  inBasis: boolean;
  active: boolean;
  blockedBy: string | null;
}

export function useDayMenuBasis(date: string | undefined) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.businessDay, 'menus', date ?? ''],
    enabled: Boolean(storeId && date),
    queryFn: async (): Promise<Map<string, DayMenuBasis>> => {
      const { data, error } = await supabase.rpc('day_menu_basis', {
        p_store: storeId, p_date: date as string,
      });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      const m = new Map<string, DayMenuBasis>();
      for (const r of rows) {
        m.set(String(r.recipe_id), {
          recipeId: String(r.recipe_id),
          name: String(r.name ?? ''),
          price: Number(r.price ?? 0),
          materialCost: Number(r.material_cost ?? 0),
          extraCost: Number(r.extra_cost ?? 0),
          tax: Number(r.tax ?? 0),
          fixedCost: Number(r.fixed_cost ?? 0),
          profit: Number(r.profit ?? 0),
          currentPrice: Number(r.current_price ?? 0),
          currentMaterialCost: Number(r.current_material_cost ?? 0),
          currentProfit: Number(r.current_profit ?? 0),
          changed: r.changed === true,
          inBasis: r.in_basis !== false,
          active: r.active !== false,
          blockedBy: r.blocked_by === null || r.blocked_by === undefined ? null : String(r.blocked_by),
        });
      }
      return m;
    },
  });
}
