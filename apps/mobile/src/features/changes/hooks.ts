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
  /** direct 사장님이 친 값 · derived 그 결과로 계산된 값(0078). */
  kind: 'direct' | 'derived';
}

export interface ChangeEvent {
  id: string | null;
  occurredAt: string;
  title: string;
  /** 목록 한 줄 요약 — `판매가 외 3개 항목 변경`. 서버가 기록할 때 적는다(0078). */
  summary: string;
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
    summary: String(r.summary ?? r.title ?? ''),
    sourceType: (r.source_type ?? 'direct') as ChangeSource,
    sourceName: str(r.source_name),
    changes: ((r.changes ?? []) as Record<string, unknown>[]).map((c) => ({
      key: String(c.key ?? ''),
      label: String(c.label ?? ''),
      before: (c.before ?? null) as string | number | null,
      after: (c.after ?? null) as string | number | null,
      unit: str(c.unit),
      kind: c.change_kind === 'derived' ? 'derived' : 'direct',
    })),
    affectsSales: r.affects_sales === true,
    state: (r.state ?? 'irrelevant') as ChangeState,
    affectedRecipes: num(r.affected_recipes),
    hasHistory: r.has_history !== false,
  };
}

/**
 * 상세 화면 한 줄이 쓰는 마지막 변경(기획 §10).
 *
 * ⚠ 목록의 사건과 **모양이 다르다.** 여기는 시각·상태만 필요하다.
 *   ChangeEvent 로 읽으면 `display_state` 를 못 봐서 상태가 조용히 '무관'이 된다.
 */
export interface LastChange {
  occurredAt: string;
  eventId: string | null;
  displayState: ChangeState;
  /** 한 번도 안 고쳤으면 false — 그때 occurredAt 은 생성일이다. */
  hasHistory: boolean;
}

export function parseLastChange(raw: unknown): LastChange {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    occurredAt: String(r.occurred_at ?? ''),
    eventId: str(r.event_id),
    displayState: (r.display_state ?? 'irrelevant') as ChangeState,
    hasHistory: r.has_history === true,
  };
}

/** 기간 창. null 이면 전체 — 좁히면 그 밖의 기록이 닿을 수 없게 되므로 고를 수 있어야 한다. */
export type ChangeWindow = 7 | 30 | null;

export interface ChangeSummary {
  days: number | null;
  count: number;
  directCount: number;
  autoCount: number;
  lastAt: string | null;
  /**
   * 배지를 달 **두 건**의 id — 서버가 정한다(0078).
   * 과거 사건마다 '현재 매출 반영'을 붙이면 현재 값이 여러 개인 것처럼 보인다.
   * 앱이 고르면 식재료 화면과 레시피 화면이 다르게 고를 수 있다.
   */
  latestReflectedId: string | null;
  latestUnreflectedId: string | null;
  latestUnreflectedState: 'not_reflected' | 'partial' | null;
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
          directCount: num(sm.direct_count),
          autoCount: num(sm.auto_count),
          lastAt: str(sm.last_at),
          latestReflectedId: str(sm.latest_reflected_event_id),
          latestUnreflectedId: str(sm.latest_unreflected_event_id),
          latestUnreflectedState: (str(sm.latest_unreflected_state) as
            'not_reflected' | 'partial' | null) ?? null,
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
 * 변경이 어디서 왔는가 — 상세 시트의 부제.
 *
 * ⚠ 화면 문구는 **직접 수정 / 자동 갱신** 둘뿐이다(기획 §2).
 *   '자동 반영'·'자동 전파'·'연관 변경'은 쓰지 않는다.
 */
export function sourceLabel(e: ChangeEvent): string {
  switch (e.sourceType) {
    case 'inbound':
      return e.title === '입고 취소 반영' ? '입고 취소' : '입고 확정';
    case 'ingredient':
      return e.sourceName ? `${e.sourceName} 단가 변경` : '식재료 단가 변경';
    case 'fixed_cost':
      return '고정지출 설정';
    default:
      return '직접 수정';
  }
}

/**
 * 목록에서 이 사건에 배지를 달까. 매출에 영향을 주는 사건은 **최대 두 건**만 단다.
 * 과거 사건마다 '현재 매출 반영'이 붙으면 현재 값이 여러 개인 것처럼 보인다(기획 §5).
 */
export function badgeFor(e: ChangeEvent, s: ChangeSummary | undefined): ChangeState | null {
  // 매출과 무관한 사건은 언제나 그렇게 밝힌다 — 헷갈릴 여지가 없다.
  if (!e.affectsSales) return 'irrelevant';
  if (!s || !e.id) return null;
  if (e.id === s.latestUnreflectedId) return s.latestUnreflectedState ?? 'not_reflected';
  if (e.id === s.latestReflectedId) return 'reflected';
  return null;
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
