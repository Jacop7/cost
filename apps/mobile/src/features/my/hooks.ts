/**
 * MY가 소유하는 고정 지출·매장명·매출 검산 훅.
 * 공용 설정과 마스터 데이터는 각각 features/settings, features/master-data가 소유한다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import { rpcError, supabase } from '@/lib/supabase';
import { asJson } from '@/lib/json';
import { useStoreId } from '@/lib/SessionProvider';
import { rpcNumber as num } from '@/lib/rpcValue';

// ── 계정 관리 (MY-10) ────────────────────────────────────────
export interface RetireAccountResult {
  deleted: true;
  archivedStoreCount: number;
}

/** 탈퇴 성공은 계정 삭제와 원장 아카이브 수를 모두 확인해야 한다. 빈 응답을 성공으로 보지 않는다. */
export function parseRetireAccountResult(value: unknown): RetireAccountResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('서버가 계정 탈퇴 결과를 주지 않았어요.');
  }
  const row = value as Record<string, unknown>;
  const archived = Number(row.archived_store_count);
  if (row.deleted !== true || !Number.isSafeInteger(archived) || archived < 0) {
    throw new Error('서버의 계정 탈퇴 결과를 확인하지 못했어요.');
  }
  return { deleted: true, archivedStoreCount: archived };
}

/**
 * 인증 계정만 삭제하고 매장·판매·입고·재고 원장은 서버의 archive 상태로 보존한다.
 * 화면은 Supabase를 직접 부르지 않고 이 문만 사용한다.
 */
export function useRetireAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<RetireAccountResult> => {
      const { data, error } = await supabase.rpc('retire_my_account');
      if (error) throw rpcError(error);
      return parseRetireAccountResult(data);
    },
    onSuccess: async () => {
      // 탈퇴한 계정의 매장 데이터가 다음 로그인 화면 뒤에 남지 않게 먼저 비운다.
      qc.clear();
      // 서버 계정은 이미 삭제됐다. 이 호출은 기기에 남은 세션만 정리해 SessionGate를 signed-out으로 보낸다.
      await supabase.auth.signOut({ scope: 'local' });
    },
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

/** 채널별 고정지출 배분 (SALES-04). 항목 비중이 있으면 그대로, 없으면 매출 비중. */
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
