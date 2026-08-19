/**
 * 영업일 훅 — 오늘 값을 언제 굳히고 언제 푸는가.
 *
 * 사장님 결정: **영업 시작 시점의 판매가·재료 구성·단가·부자재·고정지출·세금으로
 * 하루가 고정된다.** 영업 중에 레시피를 고쳐도 오늘 매출·원가·손익은 안 움직이고,
 * 레시피 화면에는 새 값이 보인다("지금 팔면 얼마 남나"는 다른 질문이라서다).
 * 고친 값은 **다음 영업일 기준**부터 매출에 들어간다.
 *
 * 그래서 매출 등록 전에 영업이 시작돼 있어야 한다. 시작 전이면 서버가 P0003 으로
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

/** 서버가 "아직 영업을 시작하지 않았어요"로 막았는가(P0003). 화면이 시작을 먼저 묻는다. */
export const isNotOpenError = (e: unknown): boolean =>
  e instanceof Error && e.message.includes('아직 영업을 시작하지 않았어요');

/** 서버가 "종료된 영업일"로 막았는가(P0004). 되돌리기를 권한다. */
export const isClosedError = (e: unknown): boolean =>
  e instanceof Error && e.message.includes('영업은 종료됐어요');

/** '2026-08-20T13:00:00+00:00' → '22:00'. 자정을 넘기면 '02:00' 처럼 그대로 나온다. */
export function hhmm(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
