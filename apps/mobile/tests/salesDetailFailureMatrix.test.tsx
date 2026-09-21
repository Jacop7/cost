import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SalesAnalyticsScreen from '@/features/sales/screens/SalesAnalyticsScreen';
import SalesRevenueScreen from '@/features/sales/screens/SalesRevenueScreen';
import SalesMaterialScreen from '@/features/sales/screens/SalesMaterialScreen';
import SalesFixedScreen from '@/features/sales/screens/SalesFixedScreen';
import SalesExpenseReadScreen from '@/features/sales/screens/SalesExpenseReadScreen';
import SalesWasteScreen from '@/features/sales/screens/SalesWasteScreen';
import SalesTaxScreen from '@/features/sales/screens/SalesTaxScreen';

type QueryKey = 'range' | 'day' | 'material' | 'legacy' | 'fixed' | 'waste' | 'tax' | 'international';

const mock = vi.hoisted(() => ({
  failing: 'range' as QueryKey,
  params: { from: '2026-09-01', to: '2026-09-02' },
  retry: Object.fromEntries(['range', 'day', 'material', 'legacy', 'fixed', 'waste', 'tax', 'international']
    .map((key) => [key, vi.fn()])) as Record<QueryKey, ReturnType<typeof vi.fn>>,
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => mock.params,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/nav', () => ({ safeBack: vi.fn() }));
vi.mock('@/lib/unitPriceFormat', () => ({ useUnitPriceFormat: () => () => '1원/g' }));
vi.mock('@/features/business-day/businessDay', () => ({
  useSalesBusinessDate: () => ({ date: '2026-09-02', isLoading: false, error: null, refetch: vi.fn() }),
}));

const query = <T,>(key: QueryKey, data: T) => ({
  data,
  isLoading: false,
  error: mock.failing === key ? new Error(`${key} 조회 실패`) : null,
  refetch: mock.retry[key],
});

vi.mock('@/features/sales/hooks', () => ({
  useSalesRange: () => query('range', {
    summary: { revenue: 987_654, dailyExtra: 12_345 }, daily: [], menu: [], channels: [],
  }),
  useSalesDay: () => query('day', {
    hasLedger: true, editable: true, dailyExtra: 12_345, extraItems: [], summary: { revenue: 987_654 },
  }),
  useMaterialUsage: () => query('material', { total: 222_222, items: [] }),
  useExtraUsage: () => query('legacy', { total: 0, items: [] }),
  useFixedBreakdown: () => query('fixed', {
    month: '2026-09', rate: 0.31, provisional: false, total: 333_333, items: [],
  }),
  useWasteBreakdown: () => query('waste', { total: 444_444, ingredientTotal: 0, menuTotal: 444_444, menu: [], ingredient: [] }),
  useTaxBreakdown: () => query('tax', { total: 555_555, items: [] }),
}));

vi.mock('@/features/international-tax', () => ({
  useAppCapabilities: () => ({ data: { internationalTax: { readEnabled: true } }, isLoading: false, error: null }),
  useSalesTaxDetail: () => query('international', { from: '2026-09-01', to: '2026-09-02', lines: [], etcLines: [] }),
}));

beforeEach(() => {
  mock.params = { from: '2026-09-01', to: '2026-09-02' };
  for (const retry of Object.values(mock.retry)) retry.mockClear();
});
afterEach(cleanup);

function assertErrorAndRetry(hiddenText: string, expectedRetries: QueryKey[]) {
  expect(screen.getByText('정보를 불러오지 못했어요')).toBeTruthy();
  expect(screen.queryByText(hiddenText)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  for (const key of expectedRetries) expect(mock.retry[key]).toHaveBeenCalledOnce();
}

describe('매출 상세 조회 실패 행렬', () => {
  it('기간 분석은 실패한 기간 집계를 정상 합계로 표시하지 않는다', () => {
    mock.failing = 'range';
    render(<SalesAnalyticsScreen />);
    assertErrorAndRetry('987,654원', ['range']);
  });

  it('매출 상세는 실패한 기간 집계를 정상 합계로 표시하지 않는다', () => {
    mock.failing = 'range';
    render(<SalesRevenueScreen />);
    assertErrorAndRetry('987,654원', ['range']);
  });

  it('재료 원가는 세 조회 중 하나라도 실패하면 전부 다시 조회한다', () => {
    mock.failing = 'material';
    render(<SalesMaterialScreen />);
    assertErrorAndRetry('222,222원', ['material', 'legacy', 'range']);
  });

  it('고정 지출은 구성 조회 실패를 정상 합계로 표시하지 않는다', () => {
    mock.failing = 'fixed';
    render(<SalesFixedScreen />);
    assertErrorAndRetry('333,333원', ['fixed', 'range']);
  });

  it('추가 지출은 기간 조회 실패를 정상 합계로 표시하지 않는다', () => {
    mock.failing = 'range';
    render(<SalesExpenseReadScreen />);
    assertErrorAndRetry('12,345원', ['day', 'range']);
  });

  it('폐기 손실은 구성 조회 실패 시 기간 합계도 함께 다시 조회한다', () => {
    mock.failing = 'waste';
    render(<SalesWasteScreen />);
    assertErrorAndRetry('444,444원', ['waste', 'range']);
  });

  it('국제 세금 조회 실패 시 국내 세금만으로 성공처럼 표시하지 않는다', () => {
    mock.failing = 'international';
    render(<SalesTaxScreen />);
    assertErrorAndRetry('555,555원', ['international', 'tax', 'range']);
  });
});
