import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SalesDayFullScreen from '@/features/sales/screens/SalesDayFullScreen';
const mock = vi.hoisted(() => ({ range: vi.fn(), material: vi.fn(), extra: vi.fn(), fixed: vi.fn(), retries: [vi.fn(), vi.fn(), vi.fn(), vi.fn()] }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({ date: '2030-01-02' }) }));
vi.mock('@/lib/nav', () => ({ safeBack: vi.fn() }));
vi.mock('@/features/business-day/businessDay', () => ({ useSalesBusinessDate: () => ({ date: '2030-01-03', isLoading: false, error: null }) }));
vi.mock('@/features/sales/hooks', () => ({ useSalesRange: mock.range, useMaterialUsage: mock.material,
  useExtraUsage: mock.extra, useFixedBreakdown: mock.fixed }));
const summary = { revenue: 10000, qty: 1, materialCost: 3000, extraMaterialCost: 200, fixedCost: 1000,
  wasteLoss: 0, wasteIngredient: 0, wasteMenu: 0, dailyExtra: 100, tax: 909, profit: 4791 };
const query = (data: unknown, index: number) => ({ data, isLoading: false, error: null, refetch: mock.retries[index] });

describe('일 손익 자세히 실제 데이터 조회·표시', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.range.mockReturnValue(query({ summary, menu: [{ recipeId: 'r1', menuName: '제육볶음', qty: 1, revenue: 10000 }] }, 0));
    mock.material.mockReturnValue(query({ items: [{ name: '돼지고기', amount: 3000 }] }, 1));
    mock.extra.mockReturnValue(query({ items: [{ name: '포장 용기', amount: 200 }] }, 2));
    mock.fixed.mockReturnValue(query({ items: [{ key: 'rent', amount: 1000 }] }, 3));
  });
  afterEach(cleanup);
  it('서버 합계와 실제 하위 항목을 표시하며 같은 날짜 범위를 조회한다', () => {
    render(<SalesDayFullScreen />);
    expect(screen.getByText('· 돼지고기')).toBeTruthy();
    expect(screen.getByText('· 포장 용기')).toBeTruthy();
    expect(screen.getByText('· 임대료')).toBeTruthy();
    expect(screen.getByText('4,791원')).toBeTruthy();
    for (const hook of [mock.range, mock.material, mock.extra, mock.fixed]) expect(hook).toHaveBeenCalledWith('2030-01-02', '2030-01-02');
  });
  it('하위 내역 조회 오류를 빈 정상 목록으로 감추지 않고 네 조회를 재시도한다', () => {
    mock.material.mockReturnValue({ ...query(undefined, 1), error: new Error('재료 조회 실패') });
    render(<SalesDayFullScreen />);
    expect(screen.queryByText('4,791원')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /다시/ }));
    for (const retry of mock.retries) expect(retry).toHaveBeenCalledOnce();
  });
  it('매출이 0인 날을 100%로 표시하지 않고 음수 손익은 그대로 보존한다', () => {
    mock.range.mockReturnValue(query({ summary: { ...summary, revenue: 0, qty: 0, profit: -100 }, menu: [] }, 0));
    render(<SalesDayFullScreen />);
    expect(screen.queryByText('100%')).toBeNull();
    expect(screen.getByText('-100원')).toBeTruthy();
  });
});
