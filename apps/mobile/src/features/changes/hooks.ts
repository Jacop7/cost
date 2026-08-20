/**
 * 수정 내역 — 식재료·레시피가 **같은 원장, 같은 판정**을 쓴다.
 *
 * 기획: docs/식재료-레시피-수정내역-최종기획.md
 *
 * 사장님이 상세에서 세 가지를 바로 알아야 한다.
 *   ① 마지막으로 언제 바뀌었나
 *   ② 내가 고친 건가, 다른 데서 자동으로 반영된 건가
 *   ③ 그 값이 지금 영업의 매출 계산에 들어갔나
 *
 * ⚠ ③은 시간이 지나면 달라진다. 서버가 읽을 때 계산하고 앱은 받아서 그린다 —
 *   앱이 따로 판정하면 두 곳이 어긋난다.
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useStoreId } from '@/lib/SessionProvider';

export type ChangeEntity = 'ingredient' | 'recipe';

/** 서버가 계산한 매출 반영 상태. 화면 문구는 `stateLabel` 이 맡는다. */
export type ChangeState = 'reflected' | 'not_reflected' | 'partial' | 'irrelevant';

export type ChangeSource = 'direct' | 'inbound' | 'ingredient' | 'fixed_cost';

export interface ChangeLine {
  key: string;
  label: string;
  before: string | number | null;
  after: string | number | null;
  unit: string | null;
}

export interface ChangeEvent {
  id: string | null;
  occurredAt: string;
  title: string;
  sourceType: ChangeSource;
  sourceName: string | null;
  changes: ChangeLine[];
  affectsSales: boolean;
  state: ChangeState;
  /** 같은 변경이 퍼진 다른 메뉴 수. 식재료 카드의 마지막 줄이 된다. */
  affectedRecipes: number;
  /** 아직 한 번도 안 고쳤으면 false — 목록에는 '최초 등록'만 있다. */
  hasHistory: boolean;
}

const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export function parseChangeEvent(raw: unknown): ChangeEvent {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(r.id),
    occurredAt: String(r.occurred_at ?? ''),
    title: String(r.title ?? ''),
    sourceType: (r.source_type ?? 'direct') as ChangeSource,
    sourceName: str(r.source_name),
    changes: ((r.changes ?? []) as Record<string, unknown>[]).map((c) => ({
      key: String(c.key ?? ''),
      label: String(c.label ?? ''),
      before: (c.before ?? null) as string | number | null,
      after: (c.after ?? null) as string | number | null,
      unit: str(c.unit),
    })),
    affectsSales: r.affects_sales === true,
    state: (r.state ?? 'irrelevant') as ChangeState,
    affectedRecipes: num(r.affected_recipes),
    hasHistory: r.has_history !== false,
  };
}

/** 기간 창. null 이면 전체 — 좁히면 그 밖의 기록이 닿을 수 없게 되므로 고를 수 있어야 한다. */
export type ChangeWindow = 7 | 30 | null;

export interface ChangeSummary {
  days: number | null;
  count: number;
  direct: number;
  auto: number;
  lastAt: string | null;
}

/**
 * 목록 한 페이지. 20건씩 받고 커서로 이어 받는다.
 *
 * ⚠ 요약(건수·직접/자동)은 **서버가 창 전체를 세서** 준다. 받은 페이지에서 세면
 *   20건까지만 센 값인데 사장님은 전체라고 읽는다.
 */
export function useChangeHistory(entity: ChangeEntity, id: string | undefined, days: ChangeWindow = 7) {
  const storeId = useStoreId();
  return useInfiniteQuery({
    queryKey: [...qk.changeHistory(entity, id ?? ''), days ?? 'all'],
    enabled: Boolean(storeId && id),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('entity_change_history', {
        p_store: storeId,
        p_entity_type: entity,
        p_entity_id: id as string,
        p_cursor: pageParam ?? undefined,
        p_limit: 20,
        p_days: days ?? undefined,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      const sm = (r.summary ?? {}) as Record<string, unknown>;
      return {
        items: ((r.items ?? []) as unknown[]).map(parseChangeEvent),
        nextCursor: str(r.next_cursor),
        summary: {
          days: sm.days === null || sm.days === undefined ? null : Number(sm.days),
          count: num(sm.count),
          direct: num(sm.direct),
          auto: num(sm.auto),
          lastAt: str(sm.last_at),
        } satisfies ChangeSummary,
      };
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** 상세 화면 헤더에 쓸, 그 항목의 이름. 목록 화면이 부제로 쓴다. */
export function useChangeSubject(entity: ChangeEntity, id: string | undefined) {
  return useQuery({
    queryKey: [...qk.changeHistory(entity, id ?? ''), 'subject'],
    enabled: Boolean(id),
    queryFn: async (): Promise<string> => {
      const table = entity === 'ingredient' ? 'ingredients' : 'recipes';
      const { data, error } = await supabase.from(table).select('name').eq('id', id as string).single();
      if (error) throw new Error(error.message);
      return String((data as { name?: unknown } | null)?.name ?? '');
    },
  });
}

// ── 표기 ──────────────────────────────────────────────────────

/**
 * 매출 반영 상태 문구. 기획 §2 표 그대로다.
 * `일부 메뉴 미반영` 은 식재료 변경이 여러 메뉴에 퍼졌는데 반영 상태가 섞였을 때다.
 */
export function stateLabel(s: ChangeState): { text: string; tone: 'green' | 'amber' | 'neutral' } {
  switch (s) {
    case 'reflected': return { text: '현재 매출 반영', tone: 'green' };
    case 'not_reflected': return { text: '현재 매출 미반영', tone: 'amber' };
    case 'partial': return { text: '일부 메뉴 미반영', tone: 'amber' };
    default: return { text: '매출 계산과 무관', tone: 'neutral' };
  }
}

/** 변경이 어디서 왔는지. 카드 둘째 줄이 된다. */
export function sourceLabel(e: ChangeEvent): string {
  switch (e.sourceType) {
    case 'inbound': return '입고 확정으로 자동 계산';
    case 'ingredient': return '식재료 변경에서 자동 전파';
    case 'fixed_cost': return '고정 지출 변경에서 자동 전파';
    default: return '직접 수정';
  }
}

/**
 * 오늘이면 `방금` · `14:32`, 이전 날짜면 `08.20 14:32`.
 * 기획 §2 의 축약 규칙이다.
 */
export function changeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) {
    // 1분 안쪽은 시각보다 '방금'이 읽기 쉽다.
    if (now.getTime() - d.getTime() < 60_000) return '방금';
    return `${hh}:${mm}`;
  }
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${hh}:${mm}`;
}

/** 전후값 한 줄. 숫자는 천단위 구분과 단위를 붙인다. */
export function formatChangeValue(v: string | number | null, unit: string | null): string {
  if (v === null || v === '') return '없음';
  if (typeof v === 'number' || (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v)))) {
    const n = Number(v);
    // 소수점은 의미 있을 때만 — 4.00원/g 처럼 단가는 살리고 12,000원은 정수로.
    const s = Number.isInteger(n) ? n.toLocaleString('ko-KR') : n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
    return unit ? `${s}${unit}` : s;
  }
  return String(v);
}

// ── 목록 한 줄이 보여 줄 것 ───────────────────────────────────

/**
 * 줄의 부제. 자동 변경은 **어디서 왔는지**가, 직접 수정은 **무엇이 어떻게 바뀌었는지**가
 * 궁금하다 — 물음이 다르므로 문구도 다르다.
 */
export function changeSubtitle(e: ChangeEvent): string {
  if (e.sourceType !== 'direct') {
    return e.sourceName ? `${sourceLabel(e)} · ${e.sourceName}` : sourceLabel(e);
  }
  const only = e.changes.length === 1 ? e.changes[0] : undefined;
  if (only) {
    return `${formatChangeValue(only.before, only.unit)}에서 ${formatChangeValue(only.after, only.unit)}로 변경`;
  }
  return `${e.changes.length}개 항목 수정`;
}

/**
 * 줄 오른쪽의 대표값 — 그 변경의 결과 한 숫자.
 * 숫자가 아니면(거래처·이름 등) 값 대신 '변경'이라고만 한다. 이름을 좁은 자리에
 * 욱여넣으면 잘려서 무엇으로 바뀌었는지 오히려 모른다.
 */
export function changeHeadline(e: ChangeEvent): string {
  const c = e.changes[0];
  if (!c) return '변경';
  const n = typeof c.after === 'number' ? c.after : Number(c.after);
  if (c.after === null || c.after === '' || Number.isNaN(n)) return '변경';
  return formatChangeValue(c.after, c.unit);
}

/**
 * 이 변경이 무엇을 뜻하는지 한 문장. 상세 시트 맨 아래에 붙는다.
 *
 * ⚠ 상태(반영/미반영)만으로는 부족하다. 사장님이 알고 싶은 건 "그래서 뭐가 달라지나"다 —
 *   안전재고는 발주 후보만, 거래처는 다음 구매의 기본값만 바뀐다.
 */
export function changeImpact(e: ChangeEvent, entity: ChangeEntity): string {
  const keys = e.changes.map((c) => c.key);

  if (e.state === 'irrelevant') {
    if (keys.includes('safety_stock')) return '발주 후보 판정 기준만 바뀌었어요.';
    if (keys.includes('default_vendor_id')) return '다음 구매 옵션 선택의 기본값만 바뀌었어요.';
    if (keys.includes('min_order_qty')) return '발주 추천 수량만 바뀌었어요.';
    if (keys.includes('memo')) return '메모는 계산에 들어가지 않아요.';
    return '매출 금액 계산에는 들어가지 않는 변경이에요.';
  }

  if (e.state === 'reflected') {
    return '영업 시작 전에 바뀌어서 오늘 매출 기준에 이미 들어가 있어요.';
  }

  // 미반영 — 지금 값은 갱신됐지만 오늘 장부는 영업 시작 시점 값을 쓴다.
  if (entity === 'ingredient') {
    return e.affectedRecipes > 0
      ? `연결된 메뉴 ${e.affectedRecipes}개의 현재 원가는 다시 계산됐어요. 오늘 매출 장부에는 다음 영업일부터 적용돼요.`
      : '현재 단가는 갱신됐어요. 오늘 매출 장부에는 다음 영업일부터 적용돼요.';
  }
  if (e.sourceType !== 'direct') {
    return '메뉴의 현재 원가는 갱신됐고, 오늘 매출 장부는 영업 시작 시점 값을 그대로 써요.';
  }
  if (e.state === 'partial') {
    return '일부 메뉴만 오늘 기준에 들어가 있어요. 나머지는 다음 영업일부터예요.';
  }
  return '바뀐 값은 다음 영업일부터 매출에 적용돼요.';
}

/** `2026년 8월` — 월 묶음 머리말. */
export function monthLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

/** `08/20 · 03:56` — 줄 왼쪽 위 시각. */
export function changeStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}
