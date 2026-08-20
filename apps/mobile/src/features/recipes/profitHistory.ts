/**
 * RCP-16 손익 변동 — `recipe_profit_history()` 한 개만 쓴다.
 *
 * 수정 내역(0063)과 질문이 다르다.
 *   수정 내역 — 누가 무엇을 고쳤나 · 오늘 매출에 반영됐나   (화면 7일 · 서버 30일)
 *   손익 변동 — 그래서 순이익이 얼마에서 얼마로 움직였나   (영구)
 * 그래서 여기에는 직접 수정/자동 갱신도, 매출 반영 배지도 없다.
 *
 * ⚠ 금액은 **서버 스냅샷 그대로** 쓴다. 화면에서 다시 빼고 더하지 않는다 —
 *   판매가를 500원 올려도 순이익은 500원 오르지 않는다(세금·고정지출이 따라 움직인다).
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import type { ProfitCauseKey } from '@sikjae/core';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';

export interface ProfitCauseRow {
  key: ProfitCauseKey;
  label: string;
  before: number;
  after: number;
}

export interface ProfitChange {
  id: string;
  occurredAt: string;
  /** `고춧가루 단가 반영` · `고정지출 반영` · `레시피 수정` */
  title: string;
  /** `재료비 32원 감소` — 대표 원인 한 줄. */
  summary: string | null;
  /** 시트 부제 — 재료 이름 · `고정지출 설정` · `직접 수정`. */
  sourceLabel: string | null;
  cause: ProfitCauseRow | null;
  profitBefore: number | null;
  profitAfter: number;
  /** 직전 대비 증감. 비교 대상이 없으면 null. */
  profitDelta: number | null;
  rateBefore: number | null;
  rateAfter: number;
}

export interface ProfitCursor {
  occurredAt: string;
  id: string;
}

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);

/**
 * ⚠ 빠진 금액을 0원으로 메꾸지 않는다. 사장님은 순이익이 진짜 그만큼 떨어진 줄 안다.
 *   서버도 반쪽 스냅샷이면 거절한다(0083) — 여기는 그 계약의 앱 쪽 절반이다.
 */
function parseChange(raw: unknown): ProfitChange {
  const r = (raw ?? {}) as Record<string, unknown>;
  const after = num(r.profit_after);
  const rate = num(r.rate_after);
  if (after === null || rate === null) {
    throw new Error('손익 스냅샷에 순이익이 없습니다. 서버 recipe_profit_history() 와 어긋났습니다.');
  }

  const causeKey = r.cause_key === null || r.cause_key === undefined ? null : String(r.cause_key);
  const before = num(r.cause_before);
  const causeAfter = num(r.cause_after);

  return {
    id: String(r.id),
    occurredAt: String(r.occurred_at),
    title: String(r.title ?? ''),
    summary: r.summary === null || r.summary === undefined ? null : String(r.summary),
    sourceLabel:
      r.source_label === null || r.source_label === undefined ? null : String(r.source_label),
    cause:
      causeKey !== null && before !== null && causeAfter !== null
        ? {
            key: causeKey as ProfitCauseKey,
            label: String(r.cause_label ?? ''),
            before,
            after: causeAfter,
          }
        : null,
    profitBefore: num(r.profit_before),
    profitAfter: after,
    profitDelta: num(r.profit_delta),
    rateBefore: num(r.rate_before),
    rateAfter: rate,
  };
}

/** 20건씩. 커서는 (시각, id) 다 — 같은 날 세 번 고친 순서를 날짜만으로는 못 지킨다. */
export function useProfitHistory(recipeId: string | undefined, pageSize = 20) {
  return useInfiniteQuery({
    queryKey: [...qk.recipe(recipeId ?? ''), 'profit-history', pageSize],
    enabled: Boolean(recipeId),
    initialPageParam: null as ProfitCursor | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('recipe_profit_history', {
        p_recipe: recipeId as string,
        p_before: pageParam?.occurredAt ?? undefined,
        p_before_id: pageParam?.id ?? undefined,
        p_limit: pageSize,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      const next = (r.next ?? null) as Record<string, unknown> | null;
      return {
        items: ((r.rows ?? []) as unknown[]).map(parseChange),
        next: next
          ? ({ occurredAt: String(next.occurred_at), id: String(next.id) } satisfies ProfitCursor)
          : null,
      };
    },
    getNextPageParam: (last) => last.next,
  });
}

/** 증감 한 줄의 색과 문구. 0원은 `변동 없음` 이다 — `+0원`은 아무 말도 아니다. */
export function deltaTone(delta: number | null): 'up' | 'down' | 'flat' {
  if (delta === null || Math.abs(delta) < 0.005) return 'flat';
  return delta > 0 ? 'up' : 'down';
}
