/**
 * MY가 소유하는 고정 지출·매장명·매출 검산 훅.
 * 공용 설정과 마스터 데이터는 각각 features/settings, features/master-data가 소유한다.
 */
import { menuSystemError } from '@/lib/productTerms';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import { createSessionBoundClient, rpcError, supabase } from '@/lib/supabase';
import { asJson } from '@/lib/json';
import { useStoreId } from '@/lib/SessionProvider';
import { rpcNumber as num } from '@/lib/rpcValue';
import { acquireSocialCredential } from '@/lib/socialAuth';
import { clearLoginMethod } from '@/lib/loginMethod';

// ── 계정 관리 (MY-10) ────────────────────────────────────────
/** 제공자 이름은 로그인 표시용이며 매장 소유권 판단에는 사용하지 않는다. */
export function useLinkedAuthMethods(userId: string | null) {
  return useQuery({
    queryKey: ['auth-identities', userId],
    enabled: userId !== null,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      return [...new Set((data.identities ?? []).map((identity) => identity.provider))];
    },
  });
}

export interface RetireAccountResult {
  deleted: true;
  archivedStoreCount: number;
}

export class AppleRetirementPreparationError extends Error {
  constructor(message: string, readonly manualAllowed = false) { super(message); }
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
    mutationFn: async (options?: { allowManualAppleRevocation?: boolean }): Promise<RetireAccountResult & {
      retiredOwnerId: string;
      retiredAccessToken: string;
    }> => {
      const initial = await supabase.auth.getSession();
      const session = initial.data.session;
      if (initial.error || !session?.user.id || !session.access_token) {
        throw new Error('로그인 정보를 확인하지 못했어요. 다시 로그인해 주세요.');
      }
      const retiredOwnerId = session.user.id;
      const retiredAccessToken = session.access_token;
      const bound = createSessionBoundClient(retiredAccessToken);
      const verified = await bound.auth.getUser(retiredAccessToken);
      if (verified.error || verified.data.user?.id !== retiredOwnerId) {
        throw new Error('로그인 정보가 바뀌었어요. 다시 확인해 주세요.');
      }
      const identities = verified.data.user.identities ?? session.user.identities ?? [];
      if (identities.some((identity) => identity.provider === 'apple') &&
        !options?.allowManualAppleRevocation) {
        // Apple 계정은 새 인증 코드로 제공자 토큰을 철회한 뒤에만 기존 탈퇴 RPC를 호출한다.
        // 취소·철회 실패 시 계정과 매장 접근은 그대로 유지한다.
        let credential;
        try {
          const result = await acquireSocialCredential('apple');
          if (result.type === 'cancelled') {
            throw new AppleRetirementPreparationError('Apple 확인이 취소되어 탈퇴하지 않았어요.');
          }
          credential = result.credential;
        } catch (cause) {
          if (cause instanceof AppleRetirementPreparationError) throw cause;
          throw new AppleRetirementPreparationError(
            'Apple 계정을 자동으로 확인할 수 없어요. 직접 연결 해제 후 탈퇴할 수 있어요.',
            true,
          );
        }
        if (!credential.authorizationCode) {
          throw new AppleRetirementPreparationError('Apple 확인 코드를 받지 못했어요. 직접 연결 해제 후 탈퇴할 수 있어요.', true);
        }
        const response = await bound.functions.invoke('retire-apple-account', {
          body: { authorizationCode: credential.authorizationCode },
        });
        if (response.error) {
          let code: unknown;
          const context = (response.error as { context?: unknown }).context;
          if (typeof Response !== 'undefined' && context instanceof Response) {
            try { code = (await context.json() as { error?: unknown }).error; } catch { /* 네트워크 오류 */ }
          }
          if (code === 'apple_revocation_failed') {
            throw new AppleRetirementPreparationError('Apple 연결을 자동으로 해제하지 못했어요. 직접 해제 후 탈퇴할 수 있어요.', true);
          }
          throw new AppleRetirementPreparationError('Apple 연결 해제나 계정 탈퇴를 완료하지 못했어요. 다시 시도해 주세요.');
        }
        return { ...parseRetireAccountResult(response.data), retiredOwnerId, retiredAccessToken };
      }
      const { data, error } = await bound.rpc('retire_my_account');
      if (error) throw rpcError(error);
      return { ...parseRetireAccountResult(data), retiredOwnerId, retiredAccessToken };
    },
    onSuccess: async ({ retiredOwnerId, retiredAccessToken }) => {
      // 요청 중 다른 계정이나 새 세션으로 바뀌었다면 그 세션의 캐시와 인증은 건드리지 않는다.
      const current = await supabase.auth.getSession();
      if (current.error || current.data.session?.user.id !== retiredOwnerId ||
        current.data.session.access_token !== retiredAccessToken) return;
      // 탈퇴한 계정의 매장 데이터가 다음 로그인 화면 뒤에 남지 않게 먼저 비운다.
      qc.clear();
      // 서버 계정은 이미 삭제됐다. 이 호출은 기기에 남은 세션만 정리해 SessionGate를 signed-out으로 보낸다.
      try { await supabase.auth.signOut({ scope: 'local' }); }
      finally { await clearLoginMethod(); }
    },
  });
}

// ── 고정지출 (MY-05) ──────────────────────────────────────────
export interface FixedCostLine {
  name: string;
  amount: number;
}
/** 이전 판본 호환용 채널 비중. 새 화면에서는 편집·표시하지 않는다. */
export type ChannelWeights = Record<string, number>;
export interface FixedCostItem {
  key: string;
  /** 설정에서 관리하는 표시명. 예전 월 데이터는 없을 수 있어 key 사전을 함께 사용한다. */
  label?: string;
  mode: 'total' | 'detail';
  total: number;
  lines: FixedCostLine[];
  weights: ChannelWeights | null;
}
export interface FixedCosts {
  month: string;
  /** 행이 없거나 금액 합계가 0인 상태를 구분한다. */
  entered: boolean;
  totalRevenue: number;
  items: FixedCostItem[];
  /** 고정지출률 = 합계 ÷ 월 매출. 서버 `fixed_cost_rate()` 와 같은 정의. */
  rate: number | null;
}

export type FixedCostBasisMonths = 1 | 2 | 3;
export interface FixedCostBasisMonth {
  month: string;
  entered: boolean;
  totalRevenue: number | null;
  totalFixed: number | null;
  rate: number | null;
  items: FixedCostItem[];
}
export interface FixedCostBasis {
  targetMonth: string;
  basisMonths: FixedCostBasisMonths;
  fromMonth: string;
  toMonth: string;
  enteredMonths: number;
  missingMonths: string[];
  applied: boolean;
  rate: number | null;
  averageRevenue: number | null;
  averageFixed: number | null;
  revision: number;
  months: FixedCostBasisMonth[];
}

const fixedItems = (value: unknown): FixedCostItem[] =>
  (Array.isArray(value) ? value : []).map((raw) => {
    const i = (raw ?? {}) as Record<string, unknown>;
    return {
      key: String(i.key ?? ''),
      label: i.label == null ? undefined : String(i.label),
      mode: i.mode === 'detail' ? 'detail' : 'total',
      total: num(i.total),
      lines: (Array.isArray(i.lines) ? i.lines : []).map((rawLine) => {
        const line = (rawLine ?? {}) as Record<string, unknown>;
        return { name: String(line.name ?? ''), amount: num(line.amount) };
      }),
      weights:
        i.weights && typeof i.weights === 'object' && !Array.isArray(i.weights)
          ? Object.fromEntries(
              Object.entries(i.weights as Record<string, unknown>).map(([k, v]) => [k, num(v)]),
            )
          : null,
    };
  });

export interface FixedCostConfiguration {
  requestedMonth: string;
  effectiveMonth: string;
  configured: boolean;
  currentRevision: number;
  sourceRevision: number;
  items: FixedCostItem[];
  reentry: FixedCostReentry | null;
}

export interface FixedCostReentry {
  id: string;
  active: boolean;
  status: 'active' | 'completed' | 'cancelled' | 'reverted';
  targetMonth: string;
  basisMonths: FixedCostBasisMonths;
  fromMonth: string;
  toMonth: string;
  targetMonths: string[];
  completedMonths: string[];
  completedCount: number;
  nextMonth: string | null;
  revision: number;
}

const fixedCostReentry = (value: unknown): FixedCostReentry | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const basisMonths = num(row.basis_months);
  if (![1, 2, 3].includes(basisMonths)) return null;
  const rawStatus = String(row.status ?? 'active');
  const status = ['active', 'completed', 'cancelled', 'reverted'].includes(rawStatus)
    ? (rawStatus as FixedCostReentry['status'])
    : 'active';
  return {
    id: String(row.id ?? ''),
    active: row.active === true,
    status,
    targetMonth: String(row.target_month ?? ''),
    basisMonths: basisMonths as FixedCostBasisMonths,
    fromMonth: String(row.from_month ?? ''),
    toMonth: String(row.to_month ?? ''),
    targetMonths: (Array.isArray(row.target_months) ? row.target_months : []).map(String),
    completedMonths: (Array.isArray(row.completed_months) ? row.completed_months : []).map(String),
    completedCount: num(row.completed_count),
    nextMonth: row.next_month == null ? null : String(row.next_month),
    revision: num(row.revision),
  };
};

export function parseFixedCostConfiguration(value: unknown): FixedCostConfiguration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('서버가 고정 지출 항목 설정을 주지 않았어요.');
  }
  const row = value as Record<string, unknown>;
  return {
    requestedMonth: String(row.requested_month ?? ''),
    effectiveMonth: String(row.effective_month ?? ''),
    configured: row.configured === true,
    currentRevision: num(row.current_revision),
    sourceRevision: num(row.source_revision),
    items: fixedItems(row.items),
    reentry: fixedCostReentry(row.reentry),
  };
}

/** 해당 월에 유효한 항목 구성. 월별 금액과 분리된 설정 판본이다. */
export function useFixedCostConfiguration(month: string, enabled = true) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.fixedCosts(month), 'configuration'],
    enabled: enabled && /^\d{4}-\d{2}$/.test(month),
    queryFn: async (): Promise<FixedCostConfiguration> => {
      const { data, error } = await supabase.rpc('get_fixed_cost_configuration', {
        p_store: storeId,
        p_month: month,
      });
      if (error) throw new Error(menuSystemError(error.message));
      return parseFixedCostConfiguration(data);
    },
  });
}

export function parseFixedCostBasis(value: unknown): FixedCostBasis {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('서버가 고정 지출 기준을 주지 않았어요.');
  }
  const r = value as Record<string, unknown>;
  const basisMonths = num(r.basis_months);
  const months = (Array.isArray(r.months) ? r.months : []).map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    return {
      month: String(row.month ?? ''),
      entered: row.entered === true,
      totalRevenue: row.total_revenue == null ? null : num(row.total_revenue),
      totalFixed: row.total_fixed == null ? null : num(row.total_fixed),
      rate: row.rate == null ? null : num(row.rate),
      items: fixedItems(row.items),
    };
  });
  if (![1, 2, 3].includes(basisMonths) || months.length !== basisMonths) {
    throw new Error('서버의 고정 지출 기준 형식이 올바르지 않아요.');
  }
  return {
    targetMonth: String(r.target_month ?? ''),
    basisMonths: basisMonths as FixedCostBasisMonths,
    fromMonth: String(r.from_month ?? ''),
    toMonth: String(r.to_month ?? ''),
    enteredMonths: num(r.entered_months),
    missingMonths: (Array.isArray(r.missing_months) ? r.missing_months : []).map(String),
    applied: r.applied === true,
    rate: r.rate == null ? null : num(r.rate),
    averageRevenue: r.average_revenue == null ? null : num(r.average_revenue),
    averageFixed: r.average_fixed == null ? null : num(r.average_fixed),
    revision: num(r.revision),
    months,
  };
}

/** 대상 월은 포함하지 않고, 직전 완료 1~3개월만 계산 기준으로 읽는다. */
export function useFixedCostBasis(targetMonth: string, enabled = true) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.fixedCosts(targetMonth), 'basis'],
    enabled: enabled && /^\d{4}-\d{2}$/.test(targetMonth),
    queryFn: async (): Promise<FixedCostBasis> => {
      const { data, error } = await supabase.rpc('get_fixed_cost_basis', {
        p_store: storeId,
        p_month: targetMonth,
      });
      if (error) throw new Error(menuSystemError(error.message));
      return parseFixedCostBasis(data);
    },
  });
}

export function useSaveFixedCostBasis() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: { months: FixedCostBasisMonths; baseRevision: number }) => {
      const { data, error } = await supabase.rpc('save_fixed_cost_basis', {
        p_store: storeId,
        p_months: input.months,
        p_base_revision: input.baseRevision,
      });
      if (error) throw rpcError(error);
      return data;
    },
    onSuccess: () => invalidate(qc, [...invalidateOn.e4(), qk.storeSettings]),
  });
}

export interface SaveFixedCostSettingsResult {
  changed: boolean;
  reentryRequired: boolean;
  reentry: FixedCostReentry | null;
}

/** 기간만 바뀌면 즉시 저장하고, 항목 변경은 완료 월 재입력 작업을 시작한다. */
export function useSaveFixedCostSettings() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: {
      months: FixedCostBasisMonths;
      items: FixedCostItem[];
      baseSettingsRevision: number;
      baseConfigurationRevision: number;
    }) => {
      const { data, error } = await supabase.rpc('save_fixed_cost_settings', {
        p_store: storeId,
        p_months: input.months,
        p_items: asJson(
          input.items.map((item) => ({
            key: item.key,
            label: item.label ?? item.key,
            mode: item.mode,
            lines: item.mode === 'detail' ? item.lines.map((line) => ({ name: line.name })) : [],
            ...(item.weights ? { weights: item.weights } : {}),
          })),
        ),
        p_base_settings_revision: input.baseSettingsRevision,
        p_base_configuration_revision: input.baseConfigurationRevision,
      });
      if (error) throw rpcError(error);
      const row = (data ?? {}) as Record<string, unknown>;
      return {
        changed: row.changed === true,
        reentryRequired: row.reentry_required === true,
        reentry: fixedCostReentry(row.reentry),
      } satisfies SaveFixedCostSettingsResult;
    },
    onSuccess: () =>
      invalidate(qc, [...invalidateOn.e4(), qk.storeSettings, qk.configurationHistory]),
  });
}

/** 진행 중인 항목 수정 초안만 취소한다. 확정 원장과 계산 기준은 바뀌지 않는다. */
export function useCancelFixedCostReentry() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: { sessionId: string; baseRevision: number }) => {
      const { data, error } = await supabase.rpc('cancel_fixed_cost_reentry', {
        p_store: storeId,
        p_session: input.sessionId,
        p_base_revision: input.baseRevision,
      });
      if (error) throw rpcError(error);
      return data;
    },
    onSuccess: () =>
      invalidate(qc, [...invalidateOn.e4(), qk.storeSettings, qk.configurationHistory]),
  });
}

/**
 * ⚠ `month` 에 기본값을 **두지 않는다**(0126). 예전엔 core 의 `currentBusinessMonth`
 *   였는데, 그건 기기 시계에서 나온 `+09:00` 고정 오프셋 값이다. 뉴욕 매장의
 *   8/31 22:00 은 서울로 9/1 이라 **서버는 8월 장부를 보는데 이 훅만 9월을 열었다.**
 *   부르는 쪽이 서버 월(`localDate.slice(0, 7)`)을 넘긴다.
 */
export function useFixedCosts(month: string, enabled = true) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.fixedCosts(month),
    enabled: enabled && /^\d{4}-\d{2}$/.test(month),
    queryFn: async (): Promise<FixedCosts> => {
      const { data, error } = await supabase
        .from('fixed_costs_monthly')
        .select('month, total_revenue, items')
        .eq('store_id', storeId)
        .eq('month', month)
        .maybeSingle();
      if (error) throw new Error(menuSystemError(error.message));

      const items = fixedItems(data?.items);
      const revenue = num(data?.total_revenue);
      const sum = items.reduce((a, i) => a + i.total, 0);
      return {
        month,
        entered: data != null,
        totalRevenue: revenue,
        items,
        rate: revenue > 0 ? sum / revenue : null,
      };
    },
  });
}

export function useSaveFixedCosts() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: { month: string; totalRevenue: number; items: FixedCostItem[] }) => {
      const { data, error } = await supabase.rpc('save_fixed_cost_amounts', {
        p_store: storeId,
        p_month: input.month,
        p_total_revenue: input.totalRevenue,
        // 합계 정규화는 서버가 한다(줄이 있으면 줄의 합이 진실). 여기서 또 계산하면 두 벌이 된다.
        p_items: asJson(
          input.items.map((i) => ({
            key: i.key,
            label: i.label,
            mode: i.mode,
            total: i.total,
            lines: i.lines,
            ...(i.weights ? { weights: i.weights } : {}),
          })),
        ),
      });
      if (error) throw new Error(menuSystemError(error.message));
      const row = (data ?? {}) as Record<string, unknown>;
      return {
        reentryActive: row.reentry_active === true,
        reentryCompleted: row.reentry_completed === true,
        completedCount: num(row.completed_count),
        requiredCount: num(row.required_count),
        nextMonth: row.next_month == null ? null : String(row.next_month),
      };
    },
    onSuccess: (_r, input) =>
      invalidate(qc, [...invalidateOn.e4(), qk.fixedCosts(input.month), qk.configurationHistory]),
  });
}

/** 매장 이름 — 마이페이지 헤더에 쓴다. 하드코딩하면 다른 매장에서 남의 상호가 보인다. */
export function useStoreName() {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.store, 'name'],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('stores')
        .select('name')
        .eq('id', storeId)
        .maybeSingle();
      if (error) throw new Error(menuSystemError(error.message));
      return data?.name ?? null;
    },
  });
}

/** 채널별 고정 지출 배분 (SALES-04). 서버가 영업일 스냅샷과 실제 채널 매출로 확정한다. */
export function useChannelFixed(from: string, to: string, enabled = true) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.salesRange(from, to), 'channel-fixed'],
    enabled: enabled && Boolean(from) && Boolean(to),
    queryFn: async (): Promise<{
      total: number;
      provisional: boolean;
      byChannel: Record<string, number>;
      unallocated: number;
    }> => {
      const { data, error } = await supabase.rpc('sales_channel_fixed', {
        p_store: storeId,
        p_from: from,
        p_to: to,
      });
      if (error) throw new Error(menuSystemError(error.message));
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      const ch = (r.channels ?? {}) as Record<string, unknown>;
      return {
        total: num(r.total),
        provisional: Boolean(r.provisional),
        byChannel: Object.fromEntries(Object.entries(ch).map(([k, v]) => [k, num(v)])),
        unallocated: num(r.unallocated),
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
    // 실적 비교는 판매 파생값이다. E10 판매/정정과 E4 고정지출 저장이
    // 모두 무효화하는 sales 루트에 두고, 수기 월 설정의 캐시와 분리한다.
    queryKey: [...qk.sales, 'fixed-cost-revenue-check', month],
    queryFn: async (): Promise<RevenueCheck> => {
      const { data, error } = await supabase.rpc('fixed_cost_revenue_check', {
        p_store: storeId,
        p_month: month,
      });
      if (error) throw new Error(menuSystemError(error.message));
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
