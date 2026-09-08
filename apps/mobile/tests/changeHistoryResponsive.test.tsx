import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeHistoryScreen } from '@/features/changes/screens/ChangeHistoryScreen';
import { changeStamp, type ChangeEntity, type ChangeEvent, type ChangeSummary } from '@/features/changes/hooks';

const mock = vi.hoisted(() => ({ history: vi.fn(), subject: vi.fn() }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'entity-fixture' }),
  useRouter: () => ({ push: vi.fn() }),
  router: { canGoBack: () => false, back: vi.fn(), replace: vi.fn() },
}));
vi.mock('@/features/changes/hooks', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/changes/hooks')>(),
  useChangeHistory: mock.history, useChangeSubject: mock.subject,
}));

const event = (id: string, overrides: Partial<ChangeEvent> = {}): ChangeEvent => ({
  id, occurredAt: '2026-09-08T01:05:00Z', title: `입고 단가 반영 ${id}`,
  summary: `기준 단가 변경 ${id}`, sourceType: 'inbound', sourceName: '시험 구매처',
  changes: [{ key: 'base_price', label: '기준 단가', before: 3, after: 4, unit: '원/g', kind: 'derived' }],
  affectsSales: true, state: 'reflected', affectedRecipes: 0, hasHistory: true, ...overrides,
});
const events = [event('reflected'), event('pending'), event('older'), event('irrelevant', { affectsSales: false })];
const summary: ChangeSummary = { days: 7, count: 44, directCount: 11, autoCount: 33,
  lastAt: events[0]!.occurredAt, latestReflectedId: 'reflected', latestUnreflectedId: 'pending', latestUnreflectedState: 'not_reflected' };

// Mocked data + real shared UI/selection helper. These are structure/interaction
// checks, NOT browser/native large-font geometry or server RPC correctness proofs.
describe('공유 수정 내역 목록의 반응형 구조', () => {
  beforeEach(() => {
    mock.history.mockReset(); mock.subject.mockReset();
    mock.subject.mockReturnValue({ data: '시험 대상' });
  });

  for (const entity of ['ingredient', 'recipe'] as ChangeEntity[]) {
    for (const pendingState of ['not_reflected', 'partial'] as const) {
      it(`${entity}/${pendingState}: 원래 표기·서버 배지 선택·상세 열기를 유지한다`, async () => {
        mock.history.mockReturnValue({ data: { pages: [{ items: events, summary: { ...summary, latestUnreflectedState: pendingState } }] },
          isLoading: false, error: null, hasNextPage: false, isFetchingNextPage: false, refetch: vi.fn(), fetchNextPage: vi.fn() });
        render(<ChangeHistoryScreen entity={entity} />);
        await waitFor(() => expect(screen.getByText('입고 단가 반영 reflected')).toBeTruthy());
        expect(mock.history).toHaveBeenCalledWith(entity, 'entity-fixture', 7);
        expect(mock.subject).toHaveBeenCalledWith(entity, 'entity-fixture');
        expect(screen.getByText('44건')).toBeTruthy(); // Not the four loaded events.
        expect(screen.getAllByText('현재 매출 반영')).toHaveLength(1);
        const pendingLabel = pendingState === 'partial' ? '일부 메뉴 미반영' : '현재 매출 미반영';
        expect(screen.getAllByText(pendingLabel)).toHaveLength(1);
        expect(screen.getAllByText('매출 계산과 무관')).toHaveLength(1);
        const olderRow = screen.getByRole('button', { name: '입고 단가 반영 older 자세히 보기' });
        expect(within(olderRow).queryByText('현재 매출 반영')).toBeNull();

        const row = screen.getByRole('button', { name: '입고 단가 반영 reflected 자세히 보기' });
        const title = within(row).getByText('입고 단가 반영 reflected');
        const copyStyle = getComputedStyle(title.parentElement!);
        expect(copyStyle.flexGrow).toBe('1'); expect(copyStyle.flexShrink).toBe('1');
        expect(copyStyle.flexBasis).not.toBe('0%');
        expect(getComputedStyle(title).whiteSpace).not.toBe('nowrap');
        expect(getComputedStyle(within(row).getByText('기준 단가 변경 reflected')).whiteSpace).toBe('nowrap');
        const date = within(row).getByTestId('change-history-date');
        expect(date.textContent).toBe(changeStamp(events[0]!.occurredAt));
        expect(date.children).toHaveLength(2);
        expect(date.children[0]!.textContent).toMatch(/^\d{2}\/\d{2}$/);
        expect(date.children[1]!.textContent).toMatch(/^ · \d{2}:\d{2}$/);
        expect(getComputedStyle(date).flexWrap).toBe('wrap');
        const listBadge = within(row).getByText('현재 매출 반영').parentElement!;
        expect(getComputedStyle(listBadge).flexShrink).toBe('1');
        expect(getComputedStyle(listBadge).maxWidth).toBe('100%');

        fireEvent.click(row);
        await waitFor(() => expect(screen.getByText('기준 단가')).toBeTruthy());
        expect(screen.getAllByText('현재 매출 반영')).toHaveLength(2); // selected row + selected detail only.
        const detailBadge = screen.getAllByText('현재 매출 반영').find((node) => node.parentElement !== listBadge)!.parentElement!;
        expect(getComputedStyle(detailBadge).maxWidth).not.toBe('100%');
        expect(screen.getByText('3원/g')).toBeTruthy();
        expect(screen.getByText('4원/g')).toBeTruthy();
      });
    }
  }
});
