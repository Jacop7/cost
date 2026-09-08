import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeHistoryScreen } from '@/features/changes/screens/ChangeHistoryScreen';
import type { ChangeEntity, ChangeEvent, ChangeSummary } from '@/features/changes/hooks';

const mock = vi.hoisted(() => ({ history: vi.fn(), subject: vi.fn(), historyRetry: vi.fn(), subjectRetry: vi.fn() }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'query-fixture' }),
  useRouter: () => ({ push: vi.fn() }),
  router: { canGoBack: () => false, back: vi.fn(), replace: vi.fn() },
}));
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
    visible ? <div data-testid="change-query-modal">{children}</div> : null };
});
vi.mock('@/features/changes/hooks', async (original) => ({
  ...await original<typeof import('@/features/changes/hooks')>(),
  useChangeHistory: mock.history, useChangeSubject: mock.subject,
}));

const event: ChangeEvent = {
  id: 'event-query', occurredAt: '2030-07-15T01:00:00Z', title: '검수 기준단가 변경', summary: '기준단가 변경 요약',
  sourceType: 'direct', sourceName: null,
  changes: [{ key: 'base_price', label: '기준 단가', before: 3, after: 4, unit: '원/g', kind: 'derived' }],
  affectsSales: true, state: 'reflected', affectedRecipes: 0, hasHistory: true,
};
const summary: ChangeSummary = {
  days: 7, count: 21, directCount: 1, autoCount: 20, lastAt: event.occurredAt,
  latestReflectedId: event.id, latestUnreflectedId: null, latestUnreflectedState: null,
};
const historyState = (overrides: Record<string, unknown> = {}) => ({
  data: { pages: [{ items: [event], summary, nextCursor: null }] }, isLoading: false, error: null,
  hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: mock.historyRetry, ...overrides,
});
const subjectState = (overrides: Record<string, unknown> = {}) => ({
  data: '조회 대상 대파', isLoading: false, error: null, refetch: mock.subjectRetry, ...overrides,
});
const rowName = `${event.title} 자세히 보기`;
function expectSuccessfulContent() {
  expect(screen.getByText('조회 대상 대파')).toBeTruthy();
  expect(screen.getByRole('button', { name: rowName })).toBeTruthy();
  expect(screen.getByText('21건')).toBeTruthy(); // Server count, not one loaded row.
  expect(screen.queryByText('정보를 불러오지 못했어요')).toBeNull();
  expect(screen.queryByText('불러오는 중이에요')).toBeNull();
}

// Real shared ChangeHistoryScreen, SummaryCard and QueryState. Domain reads are
// fixtures and common setup blocks Supabase. No actual RPC/React Query retry,
// pagination, rendered geometry, native or external review claim is made here.
describe('수정 내역 실제 host의 이름·이력 혼합 조회 상태', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.historyRetry.mockResolvedValue(undefined); mock.subjectRetry.mockResolvedValue(undefined);
    mock.history.mockReturnValue(historyState()); mock.subject.mockReturnValue(subjectState());
  });
  for (const entity of ['ingredient', 'recipe'] as ChangeEntity[]) {
    it(`${entity}: 이름과 이력이 모두 성공해야 대상 이름·서버 요약·목록을 함께 표시한다`, () => {
      render(<ChangeHistoryScreen entity={entity} />); expectSuccessfulContent();
      expect(mock.history).toHaveBeenCalledWith(entity, 'query-fixture', 7);
      expect(mock.subject).toHaveBeenCalledWith(entity, 'query-fixture');
      expect(mock.historyRetry).not.toHaveBeenCalled(); expect(mock.subjectRetry).not.toHaveBeenCalled();
    });
    for (const pending of ['subject', 'history'] as const) {
      it(`${entity} ${pending}만 loading: 빈 이름/정상 목록 대신 로딩, 성공 재조회 후 정상 복구`, () => {
        if (pending === 'subject') mock.subject.mockReturnValue(subjectState({ data: undefined, isLoading: true }));
        else mock.history.mockReturnValue(historyState({ data: undefined, isLoading: true }));
        const { rerender } = render(<ChangeHistoryScreen entity={entity} />);
        expect(screen.queryByText('불러오는 중이에요')).not.toBeNull();
        expect(screen.queryByRole('button', { name: rowName })).toBeNull();
        expect(screen.queryByText('최근 7일 동안 수정한 적이 없어요')).toBeNull();
        expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull();
        mock.history.mockReturnValue(historyState()); mock.subject.mockReturnValue(subjectState());
        rerender(<ChangeHistoryScreen entity={entity} />); expectSuccessfulContent();
        expect(mock.historyRetry).not.toHaveBeenCalled(); expect(mock.subjectRetry).not.toHaveBeenCalled();
      });
    }
    for (const failed of ['subject', 'history', 'both'] as const) {
      it(`${entity} ${failed} 오류: 공용 오류 표시·양쪽 재시도, 실제 성공 응답을 공급해야 복구`, () => {
        if (failed !== 'history') mock.subject.mockReturnValue(subjectState({ data: undefined, error: new Error('이름 조회 fixture 실패') }));
        if (failed !== 'subject') mock.history.mockReturnValue(historyState({ error: new Error('이력 조회 fixture 실패') }));
        const { rerender } = render(<ChangeHistoryScreen entity={entity} />);
        expect(screen.queryByText('정보를 불러오지 못했어요')).not.toBeNull();
        expect(screen.queryByRole('button', { name: rowName })).toBeNull();
        expect(screen.queryByText('최근 7일 동안 수정한 적이 없어요')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
        expect(mock.historyRetry).toHaveBeenCalledOnce(); expect(mock.subjectRetry).toHaveBeenCalledOnce();
        // A click alone is not a successful query. Keep the supplied error until
        // new domain results arrive, then check that the target and list return.
        expect(screen.getByText('정보를 불러오지 못했어요')).toBeTruthy();
        mock.history.mockReturnValue(historyState()); mock.subject.mockReturnValue(subjectState());
        rerender(<ChangeHistoryScreen entity={entity} />); expectSuccessfulContent();
        expect(mock.historyRetry).toHaveBeenCalledOnce(); expect(mock.subjectRetry).toHaveBeenCalledOnce();
      });
    }
    for (const pending of ['subject', 'history'] as const) {
      it(`${entity} ${pending} loading+반대 조회 error: 공용 Loading > Error > Empty 순서 유지`, () => {
        const empty = { pages: [{ items: [], summary: { ...summary, count: 0 }, nextCursor: null }] };
        mock.history.mockReturnValue(historyState({ data: empty, isLoading: pending === 'history',
          error: pending === 'subject' ? new Error('이력 오류 fixture') : null }));
        mock.subject.mockReturnValue(subjectState({ data: undefined, isLoading: pending === 'subject',
          error: pending === 'history' ? new Error('이름 오류 fixture') : null }));
        const { rerender } = render(<ChangeHistoryScreen entity={entity} />);
        expect(screen.queryByText('불러오는 중이에요')).not.toBeNull();
        expect(screen.queryByText('정보를 불러오지 못했어요')).toBeNull();
        expect(screen.queryByText('최근 7일 동안 수정한 적이 없어요')).toBeNull();
        // Once loading ends, an outstanding error must precede the empty state.
        if (pending === 'history') mock.history.mockReturnValue(historyState({ data: empty }));
        else mock.subject.mockReturnValue(subjectState());
        rerender(<ChangeHistoryScreen entity={entity} />);
        expect(screen.queryByText('정보를 불러오지 못했어요')).not.toBeNull();
        expect(screen.queryByText('최근 7일 동안 수정한 적이 없어요')).toBeNull();
        expect(mock.historyRetry).not.toHaveBeenCalled(); expect(mock.subjectRetry).not.toHaveBeenCalled();
      });
    }
    it(`${entity}: 양쪽 조회 성공 후 0개일 때만 기존 빈 내역 문구 표시`, () => {
      mock.history.mockReturnValue(historyState({ data: { pages: [{ items: [], summary: { ...summary, count: 0 }, nextCursor: null }] } }));
      render(<ChangeHistoryScreen entity={entity} />);
      expect(screen.getByText('최근 7일 동안 수정한 적이 없어요')).toBeTruthy();
      expect(screen.queryByText('불러오는 중이에요')).toBeNull();
      expect(screen.queryByText('정보를 불러오지 못했어요')).toBeNull();
      expect(mock.historyRetry).not.toHaveBeenCalled(); expect(mock.subjectRetry).not.toHaveBeenCalled();
    });
  }
});
