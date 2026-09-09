import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeHistoryScreen } from '@/features/changes/screens/ChangeHistoryScreen';
import { LedgerRow } from '@/features/ingredients/components/LedgerRow';
import { changeStamp, type ChangeEntity, type ChangeEvent, type ChangeSummary } from '@/features/changes/hooks';

// 서버가 제공한 매장 시간대 fixture. 기기 시간대는 사용하지 않는다.
vi.mock('@/features/business-day/businessDay', () => ({
  useBusinessDay: () => ({ data: { timezone: 'Asia/Seoul' } }),
}));

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
  for (const legacy of [false, true]) it(`입고 상세: ${legacy ? '옛 기록은 누락 명시' : '실입고량·결제금액·단가 세 항목'}`, async () => {
    const inbound = event('inbound', { title: '입고 단가 반영', changes: [
      ...(legacy ? [] : [
        { key: 'received_quantity', label: '실입고량', before: null, after: 1000, unit: 'g', kind: 'direct' as const },
        { key: 'paid_amount', label: '결제금액', before: null, after: 4000, unit: '원', kind: 'direct' as const },
      ]),
      { key: 'unit_price', label: '기준 단가', before: 0, after: 4, unit: '원/g', kind: 'derived' },
    ] });
    mock.history.mockReturnValue({ data: { pages: [{ items: [inbound], summary }] }, hasNextPage: false });
    render(<ChangeHistoryScreen entity="ingredient" />);
    fireEvent.click(screen.getByRole('button', { name: '입고 단가 반영 자세히 보기' }));
    await waitFor(() => expect(screen.getAllByTestId('change-history-value-row')).toHaveLength(3));
    expect(screen.getByText('실입고량')).toBeTruthy();
    expect(screen.getByText('결제금액')).toBeTruthy();
    if (legacy) {
      expect(screen.getByText('이전 기록에는 실입고량·결제금액이 저장되지 않았습니다.')).toBeTruthy();
      expect(screen.queryByText('1kg')).toBeNull();
    } else {
      expect(screen.getByText('1kg')).toBeTruthy();
      expect(screen.getByText('4,000원')).toBeTruthy();
      expect(screen.queryByText('기록 없음')).toBeNull();
    }
  });

  for (const entity of ['ingredient', 'recipe'] as ChangeEntity[]) {
    it(`${entity}: 월 경계에서도 최근 7일간 머리말을 한 번만 표시한다`, () => {
      mock.history.mockReturnValue({ data: { pages: [{ items: [
        event('september', { occurredAt: '2026-09-02T01:05:00Z' }),
        event('august', { occurredAt: '2026-08-31T01:05:00Z' }),
      ], summary }] }, hasNextPage: false });
      render(<ChangeHistoryScreen entity={entity} />);
      expect(screen.getAllByText('최근 7일간')).toHaveLength(1);
      expect(screen.queryByText('2026년 9월')).toBeNull();
      expect(screen.queryByText('2026년 8월')).toBeNull();
      expect(mock.history).toHaveBeenCalledWith(entity, 'entity-fixture', 7);
    });
    it(`${entity}: 긴 상세 값도 생략 없이 보존하고 직접/자동 그룹을 분리한다`, async () => {
      const longName = '국내산 손질 대파 냉동 소분 상품 대용량 1kg';
      const longEvent = event('long', { title: '기본 구매 정보와 단가 수정', sourceType: 'direct',
        changes: [
          { key: 'name', label: '기본 구매 상품명', before: '대파', after: longName, unit: null, kind: 'direct' },
          { key: 'price', label: '기준 단가', before: 12500, after: 23456.78, unit: '원/g', kind: 'derived' },
        ] });
      mock.history.mockReturnValue({ data: { pages: [{ items: [longEvent], summary: { ...summary, latestReflectedId: 'long', latestUnreflectedId: null } }] },
        isLoading: false, error: null, hasNextPage: false, isFetchingNextPage: false, refetch: vi.fn(), fetchNextPage: vi.fn() });
      render(<ChangeHistoryScreen entity={entity} />);
      fireEvent.click(screen.getByRole('button', { name: '기본 구매 정보와 단가 수정 자세히 보기' }));
      await waitFor(() => expect(screen.getByText(longName)).toBeTruthy());
      const rows = screen.getAllByTestId('change-history-value-row');
      expect(rows).toHaveLength(2);
      expect(within(rows[0]!).getByText('기본 구매 상품명')).toBeTruthy();
      expect(within(rows[0]!).getByText(longName)).toBeTruthy();
      expect(within(rows[1]!).getByText('12,500원/g')).toBeTruthy();
      expect(within(rows[1]!).getByText('23,456.78원/g')).toBeTruthy();
      for (const row of rows) {
        expect(getComputedStyle(row).flexWrap).toBe('wrap');
        for (const child of Array.from(row.children))
          expect(getComputedStyle(child).whiteSpace).not.toBe('nowrap');
      }
    });
    for (const pendingState of ['not_reflected', 'partial'] as const) {
      it(`${entity}/${pendingState}: 원래 표기·서버 배지 선택·상세 열기를 유지한다`, async () => {
        mock.history.mockReturnValue({ data: { pages: [{ items: events, summary: { ...summary, latestUnreflectedState: pendingState } }] },
          isLoading: false, error: null, hasNextPage: false, isFetchingNextPage: false, refetch: vi.fn(), fetchNextPage: vi.fn() });
        render(<ChangeHistoryScreen entity={entity} />);
        await waitFor(() => expect(screen.getByText('입고 단가 반영 reflected')).toBeTruthy());
        expect(mock.history).toHaveBeenCalledWith(entity, 'entity-fixture', 7);
        expect(mock.subject).toHaveBeenCalledWith(entity, 'entity-fixture');
        expect(screen.getByText(entity === 'ingredient' ? '총 44건' : '44건')).toBeTruthy(); // Not the four loaded events.
        expect(screen.getAllByText('현재 매출 반영')).toHaveLength(1);
        const pendingLabel = pendingState === 'partial' ? '일부 메뉴 미반영' : '현재 매출 미반영';
        expect(screen.getAllByText(pendingLabel)).toHaveLength(1);
        expect(screen.queryAllByText('매출 계산과 무관')).toHaveLength(entity === 'ingredient' ? 0 : 1);
        const olderRow = screen.getByRole('button', { name: '입고 단가 반영 older 자세히 보기' });
        expect(within(olderRow).queryByText('현재 매출 반영')).toBeNull();

        const row = screen.getByRole('button', { name: '입고 단가 반영 reflected 자세히 보기' });
        const title = within(row).getByText('입고 단가 반영 reflected');
        const copyStyle = getComputedStyle(title.parentElement!);
        expect(copyStyle.flexGrow).toBe('1'); expect(copyStyle.flexShrink).toBe('1');
        expect(copyStyle.flexBasis).not.toBe('0%');
        expect(getComputedStyle(title).whiteSpace).not.toBe('nowrap');
        if (entity === 'recipe') expect(getComputedStyle(within(row).getByText('기준 단가 변경 reflected')).whiteSpace).toBe('nowrap');
        const date = within(row).getByTestId('change-history-date');
        expect(date.textContent?.replace(/\u00a0/g, ' ')).toBe(changeStamp(events[0]!.occurredAt, 'Asia/Seoul'));
        expect(date.children).toHaveLength(2);
        expect(date.children[0]!.textContent).toMatch(/^\d{2}-\d{2}-\d{2}$/);
        expect(date.children[1]!.textContent).toMatch(/^\u00a0\d{2}:\d{2}$/);
        expect(getComputedStyle(date).flexWrap).toBe('wrap');
        if (entity === 'ingredient') {
          const reference = render(<LedgerRow date="비교 일시" act="비교 제목" memo="비교 설명" delta="+1g" bal="잔량 1g" up />);
          for (const [actual, expected] of [[date.children[0]!, screen.getByText('비교 일시')], [title, screen.getByText('비교 제목')], [within(row).getByText('기준 단가 변경 reflected'), screen.getByText('비교 설명')]]) {
            for (const key of ['fontSize', 'fontWeight', 'color'] as const)
              expect(getComputedStyle(actual!)[key]).toBe(getComputedStyle(expected!)[key]);
          }
          const ledger = screen.getByText('비교 일시').parentElement!.parentElement!;
          for (const key of ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'] as const)
            expect(getComputedStyle(row)[key]).toBe(getComputedStyle(ledger)[key]);
          reference.unmount();
        }
        const badgeText = within(row).getByText('현재 매출 반영');
        const listBadge = entity === 'ingredient' ? badgeText.parentElement!.parentElement! : badgeText.parentElement!;
        expect(getComputedStyle(listBadge).flexShrink).toBe('1');
        expect(getComputedStyle(listBadge).maxWidth).toBe('100%');

        fireEvent.click(row);
        await waitFor(() => expect(screen.getByText('기준 단가')).toBeTruthy());
        expect(screen.getAllByText('현재 매출 반영')).toHaveLength(entity === 'ingredient' ? 1 : 2);
        if (entity === 'recipe') {
          const detailBadge = screen.getAllByText('현재 매출 반영').find((node) => node.parentElement !== listBadge)!.parentElement!;
          expect(getComputedStyle(detailBadge).maxWidth).toBe('100%');
        }
        const valueRow = screen.getByTestId('change-history-value-row');
        expect(getComputedStyle(valueRow).flexWrap).toBe('wrap');
        for (const text of ['기준 단가', '3원/g', '4원/g'])
          expect(getComputedStyle(within(valueRow).getByText(text)).whiteSpace).not.toBe('nowrap');
        expect(screen.getByText('3원/g')).toBeTruthy();
        expect(screen.getByText('4원/g')).toBeTruthy();
        if (entity === 'ingredient') {
          expect(getComputedStyle(valueRow).minHeight).toBe('56px');
          // The sheet backdrop and the visible primary button both dismiss.
          const closeButtons = screen.getAllByRole('button', { name: '닫기' });
          fireEvent.click(closeButtons[closeButtons.length - 1]!);
          await waitFor(() => expect(screen.queryByTestId('change-history-value-row')).toBeNull());
        }
      });
    }
  }
});
