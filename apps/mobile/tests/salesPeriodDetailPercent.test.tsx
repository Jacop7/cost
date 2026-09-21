import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SalesExpenseReadScreen from '@/features/sales/screens/SalesExpenseReadScreen';
import SalesFixedScreen from '@/features/sales/screens/SalesFixedScreen';

const mock = vi.hoisted(() => ({
  params: { from: '2026-09-01', to: '2026-09-02' },
  push: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => mock.params,
  useRouter: () => ({ push: mock.push }),
}));
vi.mock('@/lib/nav', () => ({ safeBack: vi.fn() }));
vi.mock('@/features/business-day/businessDay', () => ({
  useSalesBusinessDate: () => ({ date: '2026-09-02', isLoading: false, error: null, refetch: mock.refetch }),
}));
vi.mock('@/features/sales/hooks', () => ({
  useSalesRange: () => ({
    data: { summary: { revenue: 1_000, dailyExtra: 150 } },
    isLoading: false, error: null, refetch: mock.refetch,
  }),
  useFixedBreakdown: () => ({
    data: {
      month: '2026-09', rate: 0.99, provisional: false, total: 300,
      items: [{ key: 'labor', monthTotal: 2_000, amount: 200, lines: [] }],
    },
    isLoading: false, error: null, refetch: mock.refetch,
  }),
  useSalesDay: () => ({ data: null, isLoading: false, error: null, refetch: mock.refetch }),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('매출 상세 기간 비율', () => {
  it('고정 지출 합계와 항목을 각각 기간 총매출로 계산한다', () => {
    render(<SalesFixedScreen />);
    expect(screen.getByText('30%')).toBeTruthy();
    expect(screen.getByText('월 2,000원 · 기간 매출의 20%')).toBeTruthy();
    expect(screen.queryByText('99%')).toBeNull();
  });

  it('추가 지출도 기간 금액 합계를 기간 총매출로 계산한다', () => {
    render(<SalesExpenseReadScreen />);
    expect(screen.getByText('추가 지출 합계')).toBeTruthy();
    expect(screen.getAllByText('150원').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('15%')).toBeTruthy();
  });
});
