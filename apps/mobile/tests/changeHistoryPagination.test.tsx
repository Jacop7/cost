import { createElement, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeHistoryScreen } from '@/features/changes/screens/ChangeHistoryScreen';
import { type ChangeEntity, type ChangeEvent, type ChangeSummary } from '@/features/changes/hooks';

// 서버가 제공한 매장 시간대 fixture. 기기 시간대는 사용하지 않는다.
vi.mock('@/features/business-day/businessDay', () => ({
  useBusinessDay: () => ({ data: { timezone: 'Asia/Seoul' } }),
}));

const mock = vi.hoisted(() => ({
  history: vi.fn(), subject: vi.fn(), next: vi.fn(), push: vi.fn(),
  endReached: undefined as undefined | ((info: { distanceFromEnd: number }) => void),
  threshold: undefined as number | null | undefined,
}));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'page-fixture' }), useRouter: () => ({ push: mock.push }),
  router: { canGoBack: () => false, back: vi.fn(), replace: vi.fn() },
}));
vi.mock('@/features/changes/hooks', async (original) => ({
  ...await original<typeof import('@/features/changes/hooks')>(),
  useChangeHistory: mock.history, useChangeSubject: mock.subject,
}));
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn,
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <>{children}</> : null,
    FlatList: (props: React.ComponentProps<typeof rn.FlatList>) => {
      // Preserve the real RNW FlatList and all supplied props/rows/footer.
      // Capture only its callback boundary; no fake scroll/layout event is used.
      mock.endReached = props.onEndReached ?? undefined; mock.threshold = props.onEndReachedThreshold;
      return createElement(rn.FlatList, props);
    },
  };
});

const event = (id: string, occurredAt: string): ChangeEvent => ({
  id, occurredAt, title: `수정 사건 ${id}`, summary: `변경 요약 ${id}`, sourceType: 'direct', sourceName: null,
  changes: [{ key: 'name', label: '이름', before: '대파', after: `대파 ${id}`, unit: null, kind: 'direct' }],
  affectsSales: true, state: 'reflected', affectedRecipes: 0, hasHistory: true,
});
const firstItems = [event('a', '2030-09-02T12:00:00Z'), event('b', '2030-09-01T12:00:00Z')];
const secondItems = [event('c', '2030-09-01T11:00:00Z'), event('d', '2030-08-31T12:00:00Z')];
const summary: ChangeSummary = { days: 7, count: 44, directCount: 11, autoCount: 33,
  lastAt: firstItems[0]!.occurredAt, latestReflectedId: 'a', latestUnreflectedId: 'c', latestUnreflectedState: 'not_reflected' };
const firstPage = { items: firstItems, summary, nextCursor: 'server-cursor-first' };
// Deliberately conflicting page-two metadata checks which page owns the header.
// This is not a claim that the real server emits conflicting summaries.
const secondPage = { items: secondItems, summary: { ...summary, count: 999, directCount: 998, autoCount: 1,
  latestReflectedId: 'd', latestUnreflectedId: null }, nextCursor: null };
const query = (overrides: Record<string, unknown> = {}) => ({
  data: { pages: [firstPage] }, isLoading: false, error: null, hasNextPage: true,
  isFetchingNextPage: false, fetchNextPage: mock.next, refetch: vi.fn(), ...overrides,
});
const reachEnd = () => {
  expect(mock.endReached).toBeTypeOf('function');
  act(() => mock.endReached!({ distanceFromEnd: 0 }));
};
const endNotice = () => screen.queryByText(/최근 7일 수정 내역만 표시합니다/);

// Unit-level host wiring only: supplied hook results and an invoked onEndReached
// callback. The real FlatList renders a small fixture within its initial window.
// No actual scrolling, virtualization reachability, native, cursor RPC execution,
// server ordering/atomic snapshot or complete history coverage is certified.
describe('공용 수정 내역 FlatList 페이지 연결 계약', () => {
  beforeEach(() => {
    vi.resetAllMocks(); mock.endReached = undefined; mock.threshold = undefined;
    mock.next.mockResolvedValue(undefined); mock.history.mockReturnValue(query());
    mock.subject.mockReturnValue({ data: '검수 대상', isLoading: false, error: null, refetch: vi.fn() });
  });
  for (const hasNextPage of [false, true]) for (const isFetchingNextPage of [false, true]) {
    it(`hasNext=${hasNextPage}/fetching=${isFetchingNextPage}: 현재 hook 상태의 끝 도달 guard`, () => {
      mock.history.mockReturnValue(query({ hasNextPage, isFetchingNextPage }));
      render(<ChangeHistoryScreen entity="ingredient" />);
      expect(mock.threshold).toBe(0.4);
      // Do not count any mount-time FlatList callback as the manually tested event.
      mock.next.mockClear(); reachEnd();
      expect(mock.next).toHaveBeenCalledTimes(hasNextPage && !isFetchingNextPage ? 1 : 0);
      expect(screen.getByRole('button', { name: '수정 사건 a 자세히 보기' })).toBeTruthy();
    });
  }
  it('추가 요청 중인 상태를 공급하면 기존 행을 유지하고 다음 끝 도달 호출을 막는다', () => {
    const { rerender } = render(<ChangeHistoryScreen entity="ingredient" />);
    mock.next.mockClear(); reachEnd(); expect(mock.next).toHaveBeenCalledOnce();
    mock.history.mockReturnValue(query({ isFetchingNextPage: true })); rerender(<ChangeHistoryScreen entity="ingredient" />);
    reachEnd(); expect(mock.next).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '수정 사건 a 자세히 보기' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '수정 사건 b 자세히 보기' })).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(endNotice()).toBeNull();
    expect(screen.queryByRole('button', { name: '재고 변동' })).toBeNull();
    expect(screen.queryByRole('button', { name: '구매 이력' })).toBeNull();
  });
  for (const entity of ['ingredient', 'recipe'] as ChangeEntity[]) {
    it(`${entity}: 둘째 페이지 append·월경계·첫 페이지 서버 요약과 배지·마지막 안내/링크`, () => {
      const { rerender } = render(<ChangeHistoryScreen entity={entity} />);
      expect(mock.history).toHaveBeenCalledWith(entity, 'page-fixture', 7);
      expect(screen.getByText(entity === 'ingredient' ? '총 44건' : '44건')).toBeTruthy(); expect(endNotice()).toBeNull();
      expect(screen.queryByRole('button', { name: '재고 변동' })).toBeNull();
      expect(screen.queryByRole('button', { name: '구매 이력' })).toBeNull();
      mock.history.mockReturnValue(query({ data: { pages: [firstPage, secondPage] }, hasNextPage: false }));
      rerender(<ChangeHistoryScreen entity={entity} />);
      expect(screen.getAllByRole('button', { name: /^수정 사건 [a-d] 자세히 보기$/ }).map(node => node.getAttribute('aria-label')))
        .toEqual(['a', 'b', 'c', 'd'].map(id => `수정 사건 ${id} 자세히 보기`));
      expect(screen.getAllByText('최근 7일간')).toHaveLength(1);
      expect(screen.getByText(entity === 'ingredient' ? '총 44건' : '44건')).toBeTruthy(); expect(screen.getByText('11건')).toBeTruthy(); expect(screen.getByText('33건')).toBeTruthy();
      expect(screen.queryByText('999건')).toBeNull(); expect(screen.queryByText('998건')).toBeNull();
      expect(screen.getByRole('button', { name: '수정 사건 a 자세히 보기' }).textContent).toContain('현재 매출에 반영 중');
      expect(screen.getByRole('button', { name: '수정 사건 c 자세히 보기' }).textContent).toContain('현재 매출 미반영');
      expect(screen.getByRole('button', { name: '수정 사건 d 자세히 보기' }).textContent).not.toContain('현재 매출에 반영 중');
      if (entity === 'ingredient') expect(endNotice()).toBeNull();
      else expect(endNotice()?.textContent).toContain('메모 변경은 포함하지 않습니다.');
      mock.next.mockClear(); reachEnd(); expect(mock.next).not.toHaveBeenCalled();
      if (entity === 'ingredient') {
        expect(screen.queryByRole('button', { name: '재고 변동' })).toBeNull();
        expect(screen.queryByRole('button', { name: '구매 이력' })).toBeNull();
        expect(screen.getByText('검수 대상')).toBeTruthy();
        expect(mock.push).not.toHaveBeenCalled();
      } else {
        expect(screen.queryByRole('button', { name: '재고 변동' })).toBeNull();
        expect(screen.queryByRole('button', { name: '구매 이력' })).toBeNull(); expect(mock.push).not.toHaveBeenCalled();
      }
    });
  }
});
