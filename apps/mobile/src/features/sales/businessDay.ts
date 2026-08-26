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
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import { supabase, RpcError } from '@/lib/supabase';
import { useStoreId } from '@/lib/SessionProvider';

/** 'none' = 오늘 아직 시작 전 · 'closed' = 오늘 이미 끝냄. 화면이 다른 것을 그린다. */
export type BusinessDayStatus = 'none' | 'open' | 'break' | 'closed';

/*
 * ⚠ 여기 있던 `AutoCloseNotice` 와 `BusinessDayState.unacked` 를 지웠다(0141).
 *   자동 종료 확인 배너는 기획에서 삭제됐다 — §5-4 "예정 종료는 정상 동작이므로
 *   매일 확인 배너를 띄우지 않는다". 서버의 `unacked` 키·`ack_auto_close`·
 *   `unacked_auto_close`·`auto_close_ack` 컬럼도 같이 걷어냈다.
 *   직접 종료와 자동 종료는 `closeMethod` 로만 구분한다(§6.1).
 */


export interface BusinessDayState {
  /**
   * 판매 영업일 기준의 오늘(cutoff 반영). 3단계에서 정리된다.
   * ⚠ `localDate` 와 다른 값이다 — 지금은 cutoff 가 0 이라 같아 보일 뿐이다.
   */
  today: string;
  /**
   * **매장 달력의 오늘**(0125). 영업시간과 무관하다.
   * 발주·입고·재고·레시피 화면이 쓸 날짜다 — 거기서는 판매 영업일이 아니라 달력 날짜가 맞다.
   * ⚠ 앱이 직접 계산하지 않는다. 예전엔 `+09:00` 고정 오프셋으로 만들었고,
   *   그래서 앱과 DB 가 각자 오늘을 계산했다(기획서 §2.1).
   */
  localDate: string;
  status: BusinessDayStatus;
  businessDayId: string | null;
  businessDate: string;
  openedAt: string | null;
  plannedCloseAt: string | null;
  closedAt: string | null;
  closeMethod: 'manual' | 'auto' | null;
  lastActivityAt: string | null;
  /*
   * ⚠ `autoCloseAt`·`pastPlanned`·`warnSoon`·`due` 를 지웠다(0142).
   *   타입 선언과 파싱만 있고 **그리는 자리가 하나도 없었다.** 기획서 §6.1 의
   *   `영업 중` 규격에도 그런 예고가 없다 — 카드는 `영업일 + 시간 + 상태/행동`
   *   한 줄뿐이다. 서버의 `auto_close_due()` 도 이 응답을 만들려고만 있어 같이 지웠다.
   *   §5-4 가 확인 배너를 없앤 것과 같은 결정이다.
   *
   *   자동으로 닫혔다는 사실은 `closeMethod` 로 안다. 마감 시각을 미리 알리는 UI 를
   *   만들게 되면 그때 다시 세운다 — 껍데기로 남겨 두지 않는다.
   */
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
  return {
    today: reqDate(r.today, 'today'),
    /*
     * ⚠ **`today` 로 대신 메우지 않는다.** 예전엔 `r.local_date ?? r.today` 였는데,
     *   그러면 서버가 필드를 빠뜨려도 정상처럼 보이고 세 날짜를 가른 의미가 사라진다.
     *
     * ⚠ 빈 문자열로 넘기지도 않는다. 그러면 `error` 가 null 인 채 날짜만 없어서
     *   게이트가 **오류도 로딩도 아닌 빈 화면**을 그린다 — 사장님은 다시 시도할
     *   길이 없다. 없거나 모양이 틀리면 **던진다.**
     */
    localDate: reqDate(r.local_date, 'local_date'),
    status: (r.status ?? 'none') as BusinessDayStatus,
    businessDayId: str(r.business_day_id),
    businessDate: reqDate(r.business_date, 'business_date'),
    openedAt: str(r.opened_at),
    plannedCloseAt: str(r.planned_close_at),
    closedAt: str(r.closed_at),
    closeMethod: (str(r.close_method) as 'manual' | 'auto' | null) ?? null,
    lastActivityAt: str(r.last_activity_at),
    // 열린 날이 오늘이 아니면 오늘 매출은 서버가 막는다. 화면이 알아야 한다.
    staleDay:
      (r.status === 'open' || r.status === 'break') &&
      String(r.business_date ?? '') !== String(r.today ?? ''),
    hours: {
      openTime: str(h.open_time),
      closeTime: str(h.close_time),
      breakStart: str(h.break_start),
      breakEnd: str(h.break_end),
      overnight: h.overnight === true,
    },
  };
}

/** 'YYYY-MM-DD' 만 통과시킨다. 날짜 권위를 서버로 옮겼으므로 모양이 틀리면 그건 사고다. */
const YMD = /^\d{4}-\d{2}-\d{2}$/;
function reqDate(v: unknown, field: string): string {
  const t = typeof v === 'string' ? v : '';
  if (!YMD.test(t)) {
    throw new Error(`서버가 날짜를 주지 않았어요 (${field}). 잠시 후 다시 시도해 주세요`);
  }
  return t;
}

export function useBusinessDay() {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.businessDay,
    enabled: Boolean(storeId),
    queryFn: async (): Promise<BusinessDayState> => {
      /*
       * ⚠ **조회만 한다.** 예전엔 여기서 `close_if_due()` 를 같이 불렀다 —
       *   서버에 스케줄러가 없어 누군가 불러 줘야 했고, 상태를 보는 이 순간을
       *   그 자리로 삼았다.
       *
       *   그런데 날짜 권위를 서버로 옮기면서 이 훅이 **날짜 조회의 통로**가 됐다.
       *   그러면 폐기 내역·입고 등록·발주 화면을 **여는 것만으로 영업이 종료된다.**
       *   "날짜를 묻는 것" 과 "영업을 끝내는 것" 은 같은 문으로 들어오면 안 된다.
       *
       *   지금 자동 종료는 **서버 pg_cron 만** 실행한다(0137·0139). 앱은 관여하지 않는다 —
       *   `useAutoCloseSweep()` 도 지웠다. 앱이 실행 주체이던 시절의 흔적이 없어야
       *   "화면을 여니 영업이 끝났다" 가 다시 생기지 않는다.
       */
      const { data, error } = await supabase.rpc('business_day_state', { p_store: storeId });
      if (error) throw new Error(error.message);
      return parse(data);
    },
    /*
     * 화면을 열어 둔 채로도 상태가 바뀐다 — **크론이 닫기 때문이다.**
     * ⚠ 예전엔 "자동 종료가 다가오는지" 를 갱신하려던 것이었는데, 그 예고
     *   (`auto_close_at`·`warn_soon` 등)는 그리는 자리가 없어 지웠다(0142).
     *   지금 이 주기의 목적은 하나다 — 크론이 바꾼 종료 상태를 따라잡는 것.
     */
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

/*
 * ⚠ 여기 있던 `useAutoCloseSweep()` 을 지웠다(0137).
 *
 *   그건 서버에 스케줄러가 없던 시절의 임시방편이었다 — 앱이 1분마다 `close_if_due` 를
 *   불러 줘야 어제 영업일이 닫혔고, 앱을 안 열면 안 닫혔다(기획서 §2.4).
 *   실제로 8/22 장부에 `8/23 08:25` 가 찍혀 있었다.
 *
 *   이제 `close_due_business_days()` 를 pg_cron 이 1분마다 돈다. 앱은 관여하지 않는다.
 *
 *   ⚠ 남겨 뒀다면 **판정이 두 곳**이 됐을 것이다. 그때는 규칙까지 서로 달랐다 —
 *     앱 경로는 `마지막 활동 + 1시간` 이라 활동이 있으면 밀렸고, 서버 스윕은
 *     `예정 종료 + 고정 유예` 라 안 밀렸다. (0139 에서 서버 쪽도 한 식으로 통일했고,
 *      앱 경로는 여기서 아예 없앴다.)
 */

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
 * ⚠ 이제 **RPC 도 한 번이다**(0154). 예정 종료가 지난 옛 날은 `open_business_day` 가
 *   같은 트랜잭션에서 닫고 연다 — close → open 두 번이던 시절엔 사이에 다른 기기가
 *   끼어들 수 있었다. 기한(유예)까지 지난 날은 auto(예정 시각 기록), 유예 안이면
 *   manual(지금 시각)로 닫힌다.
 * ⚠ 어제 기준값은 어제 것 그대로 잠긴 채로 닫힌다. 오늘 것만 지금 값으로 굳는다.
 */
export function useCloseStaleAndOpen() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const opened = await supabase.rpc('open_business_day', { p_store: storeId });
      if (opened.error) throw new Error(opened.error.message);
    },
    onSuccess: () => invalidate(qc, invalidateOn.businessDay()),
  });
}

/*
 * ⚠ 여기 있던 `useReopenBusinessDay()` 와 `useAckAutoClose()` 를 지웠다(0140).
 *
 *   **되열기** — 기획서 §6.4 가 "종료된 장부를 다시 열지 않는다" 로 정했고, 0139 에서
 *   서버가 실제로 그렇게 됐다. 화면에 되열기 버튼이 없는데 훅만 남아 있으면
 *   다음 사람이 "이미 있는 기능" 으로 읽고 다시 붙인다.
 *   과거 판매 수정은 정정 RPC(`amend_ended_business_day`)가 맡는다(0145·0146).
 *
 *   **자동 종료 확인** — `BusinessDayBar` 가 선언만 해 두고 한 번도 안 썼다.
 *   기획서 §5-4 가 "예정 종료는 정상 동작이므로 매일 확인 배너를 띄우지 않는다" 로
 *   정했으므로 서버의 `ack_auto_close`·`unacked_auto_close` 와 `auto_close_ack`
 *   컬럼도 **같이 지웠다**(0141). 되살릴 자리를 남기지 않는다.
 */

/*
 * 서버가 왜 막았는가 — **코드로** 가른다(0145).
 *
 * ⚠ 예전엔 한국어 문구를 검사했다. 그래서 0140 에서 문구를 고칠 때 여기도 같이 고쳐야
 *   했고, 한쪽만 고치면 화면이 오류를 못 알아봤다. 문구는 사람이 읽는 것이고 코드는
 *   화면이 읽는 것이다 — 둘을 묶어 두면 문구를 못 고친다.
 *
 * ⚠ 여기엔 "PostgREST 응답에 SQLSTATE 가 그대로 오지 않는 경우가 있다" 고 적혀 있었다.
 *   **실측해 보니 틀렸다.** 그대로 온다 —
 *       {"code":"45010","details":"SALE_DATE_OUT_OF_RANGE","hint":null,"message":"…"}
 *   `code` 가 SQLSTATE, `details` 는 서버가 붙인 이름이다(0144). 분기는 SQLSTATE 로
 *   한다 — 그쪽이 PostgreSQL 이 보장하는 값이다.
 */
const codeOf = (e: unknown): string | null => (e instanceof RpcError ? e.code : null);

/** 45001 BEFORE_OPEN — 아직 영업 전. 화면이 시작을 먼저 묻는다. */
export const isNotOpenError = (e: unknown): boolean => codeOf(e) === '45001';

/** 45002 DAY_CLOSED — 종료됐거나 자동 마감 기한이 지났다. 되돌릴 길은 없다(§6.4). */
export const isClosedError = (e: unknown): boolean => codeOf(e) === '45002';

/**
 * 서버가 정한 **매장 달력의 오늘**(0125). 발주·입고·재고·레시피 화면이 쓴다.
 *
 * ⚠ 못 받았으면 `null` 이다. **직접 계산해서 메우지 않는다** —
 *   앱이 계산하면 그게 곧 앱과 DB 가 각자 오늘을 계산하는 상태다(기획서 §2.1).
 *   부르는 쪽이 로딩을 다뤄야 한다.
 */
export interface ServerDate {
  /** 서버가 정한 날짜. 아직 못 받았거나 서버가 안 줬으면 `null`. */
  date: string | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

/*
 * ⚠ 날짜만 돌려주면 **로딩과 오류를 구별할 수 없다.** 예전엔 `string | null` 이라
 *   RPC 가 실패해도 화면은 "아직 안 왔다" 로 읽고 영원히 로딩만 그렸다.
 *   부르는 쪽이 재시도를 붙일 수 있어야 한다.
 */
export function useStoreLocalDate(): ServerDate {
  const q = useBusinessDay();
  return { date: q.data?.localDate || null, isLoading: q.isLoading, error: q.error, refetch: () => void q.refetch() };
}

/**
 * 서버가 정한 **지금 장부의 날짜**(business_date). 판매 화면이 쓴다.
 *
 * ⚠ 새벽 영업 중이면 **전날**일 수 있다. 그게 이 값의 존재 이유다 —
 *   앱이 자정으로 날짜를 넘겨 버리면 새벽 판매가 다음 날 장부로 샌다.
 */
export function useSalesBusinessDate(): ServerDate {
  const q = useBusinessDay();
  return { date: q.data?.businessDate || null, isLoading: q.isLoading, error: q.error, refetch: () => void q.refetch() };
}

/**
 * 서버가 "낡은 화면"으로 막았는가(45009 · 0117).
 *
 * 다른 기기가 먼저 저장해서 판본이 올라간 경우다. 오류가 아니라 **다음에 할 일**이다 —
 * 다시 받아서 보여 주면 된다. 조용히 덮어쓰면 남이 적은 판매가 사라진다(실측).
 */
export const isRevisionConflict = (e: unknown): boolean => codeOf(e) === '45009';

/** 45010 SALE_DATE_OUT_OF_RANGE — 지난달 1일~오늘 밖이다(0144). */
export const isDateOutOfRange = (e: unknown): boolean => codeOf(e) === '45010';

/** 45011 DAY_IS_LIVE — 그날은 아직 살아 있다. 보통 저장 경로로 가야 한다(0145). */
export const isDayLive = (e: unknown): boolean => codeOf(e) === '45011';

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
