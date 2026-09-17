import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SalesFeedScreen from '@/features/sales/screens/SalesFeedScreen';

const mock = vi.hoisted(() => ({
  push: vi.fn(), feed: vi.fn(), setCalendar: vi.fn().mockResolvedValue({}), today: '2026-09-16',
}));

vi.mock('expo-router', () => ({ useRouter: () => ({ push: mock.push, replace: mock.push }) }));
vi.mock('@/features/business-day/businessDay', () => ({
  useSalesBusinessDate: () => ({ date: mock.today, isLoading: false, error: null, refetch: vi.fn() }),
}));
vi.mock('@/features/sales/lifecycle', async original => ({
  ...await original<Record<string, unknown>>(),
  useSalesFeed: mock.feed,
  useSalesInventoryCountRequirement: () => ({ data: { required: false }, isLoading: false, error: null, refetch: vi.fn() }),
  useSetSalesCalendarDay: () => ({ mutateAsync: mock.setCalendar, isPending: false, error: null }),
}));

const summary = {
  from: '2026-09-01', to: '2026-09-16', days: 3, revenue: 150000, etcRevenue: 0, qty: 12,
  materialCost: 30000, extraMaterialCost: 0, tax: 10000, wasteLoss: 0, wasteIngredient: 0,
  wasteMenu: 0, dailyExtra: 5000, fixedCost: 20000, fixedRate: 0.2, fixedRateProvisional: false,
  profit: 85000,
};

describe('매출관리 작성 수명주기 피드', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.setCalendar.mockResolvedValue({});
    mock.feed.mockReturnValue({
      data: {
        from: '2026-09-01', to: '2026-09-16', summary,
        counts: { missing: 1, editing: 1, completed: 2, closed: 1 },
        items: [
          { businessDate: '2026-09-16', status: 'missing', draftId: null, versionId: null, sales: 0, netSales: 0, qty: 0, expense: null, profit: null, profitRate: null, canEdit: true, canClassify: true, calendarRevision: 0, blockedReason: null, action: 'write' },
          { businessDate: '2026-09-15', status: 'editing', draftId: 'draft', versionId: null, sales: 0, netSales: 0, qty: 0, expense: null, profit: null, profitRate: null, canEdit: true, canClassify: false, calendarRevision: 0, blockedReason: null, action: 'resume' },
          { businessDate: '2026-09-14', status: 'completed', draftId: null, versionId: 'v1', sales: 100000, netSales: 90000, qty: 8, expense: 40000, profit: 50000, profitRate: 55.6, canEdit: true, canClassify: false, calendarRevision: 0, blockedReason: null, action: 'detail' },
          { businessDate: '2026-07-01', status: 'completed', draftId: null, versionId: 'v0', sales: 50000, netSales: 45000, qty: 4, expense: 25000, profit: 20000, profitRate: 44.4, canEdit: false, canClassify: false, calendarRevision: 0, blockedReason: '수정 가능한 기간이 지났어요.', action: 'detail' },
          { businessDate: '2026-09-13', status: 'closed', draftId: null, versionId: null, sales: 0, netSales: 0, qty: 0, expense: null, profit: null, profitRate: null, canEdit: false, canClassify: true, calendarRevision: 2, blockedReason: null, action: 'detail' },
        ],
        clock: { serverNow: '', recommendedSalesDate: '2026-09-16', editableFrom: '2026-08-01', editableTo: '2026-09-16' },
      },
      isLoading: false, error: null, refetch: vi.fn(),
    });
  });
  afterEach(cleanup);

  it('밑줄형 매출 보기 탭과 독립된 캡슐형 작성 상태 탭을 보여 주고 기간 필터는 숨긴다', () => {
    render(<SalesFeedScreen />);
    expect(screen.queryByText('기간 핵심 요약')).toBeNull();
    expect(screen.getByRole('tab', { name: '매출 작성' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: '매출 분석' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tab', { name: '전체' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '미작성' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '작성 중' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '작성 완료' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '정렬 기준: 최신순' })).toBeTruthy();
    expect(screen.queryByText('영업일 · 최신순')).toBeNull();
    expect(screen.queryByRole('button', { name: '9월 1일 ~ 16일 변경' })).toBeNull();
    expect(screen.queryByText('12개 / 150,000원')).toBeNull();
    expect(screen.queryByRole('button', { name: '자세히 보기' })).toBeNull();
  });

  it('최신순과 오래된순으로 영업일 목록을 정렬한다', () => {
    render(<SalesFeedScreen />);
    expect(screen.getAllByRole('button', { name: /상세 보기/ })[0]?.getAttribute('aria-label')).toContain('9월 16일');
    fireEvent.click(screen.getByRole('button', { name: '정렬 기준: 최신순' }));
    fireEvent.click(screen.getByRole('button', { name: '오래된순' }));
    expect(screen.getAllByRole('button', { name: /상세 보기/ })[0]?.getAttribute('aria-label')).toContain('7월 1일');
  });

  it('작성 상태 뱃지를 월일·요일 왼쪽에 표시한다', () => {
    render(<SalesFeedScreen />);
    const row = screen.getByRole('button', { name: /9월 16일 .* 상세 보기/ });
    const badge = within(row).getByText('미작성');
    const date = within(row).getByText(/9월 16일/);
    expect(badge.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('작성 완료 카드의 순이익 열을 절반 너비에서 좌측 정렬한다', () => {
    render(<SalesFeedScreen />);
    const profitColumnStyle = screen.getAllByText('순이익')[0]?.parentElement?.getAttribute('style') ?? '';
    expect(profitColumnStyle).toContain('flex: 1 1 0%');
    expect(profitColumnStyle).not.toContain('align-items: flex-end');
    expect(screen.getByText('50,000원 · 55.6%')).toBeTruthy();
  });

  it('작성 완료 내역을 수정 임시저장 중이면 작성 중 카드와 필터로 표시한다', () => {
    const value = mock.feed();
    value.data.items[2] = { ...value.data.items[2], draftId: 'amendment-draft', action: 'resume' };
    mock.feed.mockReturnValue(value);
    render(<SalesFeedScreen />);

    const row = screen.getByRole('button', { name: /9월 14일 .* 상세 보기/ });
    expect(within(row).getByText('작성 중')).toBeTruthy();
    expect(within(row).queryByText('작성 완료')).toBeNull();
    expect(within(row).getByText('임시저장한 내역이 있어요.')).toBeTruthy();
    expect(within(row).queryByText('매출')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: '작성 완료' }));
    expect(screen.queryByRole('button', { name: /9월 14일 .* 상세 보기/ })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: '작성 중' }));
    expect(screen.getByRole('button', { name: /9월 14일 .* 상세 보기/ })).toBeTruthy();
  });

  it('매출 분석 탭으로 이동한다', () => {
    render(<SalesFeedScreen />);
    fireEvent.click(screen.getByRole('tab', { name: '매출 분석' }));
    expect(mock.push).toHaveBeenLastCalledWith('/sales/analytics');
  });

  it('헤더 검색으로 날짜·작성 상태를 찾고 알림 화면으로 이동한다', () => {
    render(<SalesFeedScreen />);
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    fireEvent.change(screen.getByRole('textbox', { name: '날짜·작성 상태 검색' }), { target: { value: '작성 중' } });
    expect(screen.getByRole('button', { name: /9월 15일 .* 상세 보기/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /9월 16일 .* 상세 보기/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '알림' }));
    expect(mock.push).toHaveBeenLastCalledWith('/my/notifications');
  });

  it('작성 상태 탭을 누르면 해당 상태의 영업일만 표시한다', () => {
    render(<SalesFeedScreen />);
    fireEvent.click(screen.getByRole('tab', { name: '미작성' }));
    expect(screen.getByRole('button', { name: /9월 16일 .* 상세 보기/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /9월 15일 .* 상세 보기/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /9월 14일 .* 상세 보기/ })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: '작성 완료' }));
    expect(screen.queryByRole('button', { name: /9월 16일 .* 상세 보기/ })).toBeNull();
    expect(screen.getByRole('button', { name: /9월 14일 .* 상세 보기/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /7월 1일 .* 상세 보기/ })).toBeTruthy();
  });

  it('상태별 작성 동작과 읽기 상세 진입을 분리하고 편집 기간 밖에는 수정 버튼을 숨긴다', () => {
    render(<SalesFeedScreen />);
    fireEvent.click(screen.getByRole('button', { name: '작성하기' }));
    expect(mock.push).toHaveBeenLastCalledWith('/sales/write?date=2026-09-16');
    fireEvent.click(screen.getByRole('button', { name: '이어서 작성' }));
    expect(mock.push).toHaveBeenLastCalledWith('/sales/write?date=2026-09-15');
    expect(screen.getAllByRole('button', { name: '수정' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /7월 1일 .* 상세 보기/ }));
    expect(mock.push).toHaveBeenLastCalledWith('/sales/day?date=2026-07-01');
  });

  it('완료일의 고정 지출 기준이 없으면 순이익을 0원으로 꾸미지 않는다', () => {
    const value = mock.feed();
    value.data.items[2] = { ...value.data.items[2], profit: null, profitRate: null };
    mock.feed.mockReturnValue(value);
    render(<SalesFeedScreen />);
    expect(screen.getByText('미산출 · 미산출')).toBeTruthy();
  });

  it('미작성 날짜를 휴무로 확정하고 휴무일은 다시 영업일로 분류할 수 있다', async () => {
    render(<SalesFeedScreen />);
    fireEvent.click(screen.getByRole('button', { name: '휴무로 확정' }));
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(mock.setCalendar).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'closed', item: expect.objectContaining({ businessDate: '2026-09-16', calendarRevision: 0 }),
    }));
  });
});
