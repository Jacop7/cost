import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SalesMenuDetailScreen from '@/features/sales/screens/SalesMenuDetailScreen';

const state = vi.hoisted(() => ({ rangeMode: false, recipeDeleted: false, ledger: {} as Record<string, unknown>, loading: false, error: null as Error | null, retry: vi.fn() }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ recipe: 'r', from: '2026-09-10', to: state.rangeMode ? '2026-09-12' : '2026-09-10' }),
  useRouter: () => ({ push: vi.fn() }),
  router: { canGoBack: () => false, replace: vi.fn() },
}));
vi.mock('@/features/business-day/businessDay', () => ({ useSalesBusinessDate: () => ({ date: '2026-09-12', isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock('@/features/recipes/hooks', () => ({ useRecipeDetail: () => ({ data: state.recipeDeleted ? null : { name: '현재 이름', price: 10000, materialCost: 2000, extraCost: 0, fixedRate: 0.2, tax: 700, taxMode: 'included', taxBreakdown: [], targetProfitRate: 40, lines: [], extras: [] }, isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock('@/features/sales/hooks', () => ({
  useSalesRange: () => ({ data: {
    summary: {
      from: '2026-09-10', to: state.rangeMode ? '2026-09-12' : '2026-09-10', days: state.rangeMode ? 3 : 1,
      revenue: 802000, etcRevenue: 0, qty: 118, materialCost: 222496, extraMaterialCost: 0,
      tax: 72909, wasteLoss: 0, wasteIngredient: 0, wasteMenu: 0, dailyExtra: 45000,
      fixedCost: 251026, fixedRate: 0.313, fixedRateProvisional: false, profit: 214024,
    },
    menu: state.ledger.sold ? [{ recipeId: 'r', isDeleted: state.recipeDeleted, qty: 3, revenue: 30000, qtyHall: 3, qtyDelivery: 0, qtyTakeout: 0 }] : [],
  }, isLoading: false, error: null, refetch: vi.fn() }),
  useDayMenuDetail: () => ({ data: state.ledger, isLoading: state.loading, error: state.error, refetch: state.retry }),
  useRangeMenuDetail: () => {
    const detail = state.ledger;
    const sold = detail.sold === true;
    const qty = Number(detail.qty ?? 0);
    const unitPrice = Number(detail.unitPrice ?? detail.price ?? 0);
    const unitMaterialCost = Number(detail.unitMaterialCost ?? detail.materialCost ?? 0);
    const unitExtraCost = Number(detail.unitExtraCost ?? detail.extraCost ?? 0);
    const unitFixedCost = Number(detail.unitFixedCost ?? detail.fixedCost ?? 0);
    const unitTax = Number(detail.unitTax ?? detail.tax ?? 0);
    const unitProfit = Number(detail.unitProfit ?? detail.profit ?? 0);
    return {
      data: sold ? {
        ...detail,
        days: state.rangeMode ? 3 : 1,
        unitPrice,
        unitMaterialCost,
        unitExtraCost,
        unitFixedCost,
        unitTax,
        unitProfit,
        revenue: Number(detail.revenue ?? unitPrice * qty),
        materialCost: unitMaterialCost * qty,
        extraCost: unitExtraCost * qty,
        fixedCost: unitFixedCost * qty,
        tax: unitTax * qty,
        wasteMenu: Number(detail.wasteMenu ?? 0),
        profit: unitProfit * qty,
      } : detail,
      isLoading: state.loading,
      error: state.error,
      refetch: state.retry,
    };
  },
}));
beforeEach(() => { state.rangeMode = false; state.recipeDeleted = false; state.ledger = { sold: false }; state.loading = false; state.error = null; state.retry.mockClear(); });
afterEach(cleanup);

it('판매 없음은 서버 현재 세액을 사용하며 10%로 다시 계산하지 않는다', () => {
  render(<SalesMenuDetailScreen />);
  expect(screen.getAllByText('700원').length).toBeGreaterThan(0);
  expect(screen.getAllByText('5,300원').length).toBeGreaterThan(0);
  expect(screen.queryByText(/10\/110/)).toBeNull();
});

it.each([false, true])('세금 별도 판매의 서버 순이익과 당시 이름을 유지한다 (기간=%s)', rangeMode => {
  state.rangeMode = rangeMode;
  state.ledger = { sold: true, name: '판매 당시 이름', qty: 3, price: 10000, materialCost: 2000, extraCost: 100,
    fixedRate: 0.1, fixedCost: 1000, tax: 1000, profit: 6900, taxMode: 'separate', taxItems: [],
    unitPrice: 10000, unitMaterialCost: 2000, unitExtraCost: 100, unitFixedCost: 1000, unitTax: 1000, unitProfit: 6900,
    pricePoints: [], lines: [], extras: [{ name: '과거 포장', amount: 100 }] };
  render(<SalesMenuDetailScreen />);
  expect(screen.getByText('판매 당시 이름')).toBeTruthy();
  expect(screen.queryByText('현재 이름')).toBeNull();
  expect(screen.getAllByText('30,000원').length).toBeGreaterThan(0);
  expect(screen.getByText('20,700원')).toBeTruthy();
  expect(screen.getByText('9,300원')).toBeTruthy();
  expect(screen.getAllByText('6,300원').length).toBeGreaterThan(0);
  expect(screen.getAllByText('3,000원').length).toBeGreaterThan(0);
  expect(screen.queryByText('(−) 추가 지출')).toBeNull();
  expect(screen.queryByText('802,000원')).toBeNull();
  expect(screen.queryByText(/판매량 기준/)).toBeNull();
  expect(screen.getByText('300원')).toBeTruthy();
  expect(screen.queryByText('900원')).toBeNull();
  expect(screen.queryByText('고정 지출 · 세금')).toBeNull();
});

it('선택 메뉴의 조리 후 폐기가 있을 때만 폐기 손실 근거 카드를 표시한다', () => {
  state.ledger = { sold: true, name: '판매 당시 이름', qty: 3, qtyWaste: 2, price: 10000,
    materialCost: 2000, extraCost: 0, fixedRate: 0.1, fixedCost: 1000, tax: 900, profit: 6100,
    unitPrice: 10000, unitMaterialCost: 2000, unitExtraCost: 0, unitFixedCost: 1000,
    unitTax: 900, unitProfit: 6100, wasteMenu: 4000, pricePoints: [], lines: [], extras: [] };
  render(<SalesMenuDetailScreen />);
  expect(screen.getByText('폐기 손실')).toBeTruthy();
  expect(screen.getByText('조리 후 폐기')).toBeTruthy();
  expect(screen.getByText('판매하지 못한 메뉴 2개')).toBeTruthy();
  expect(screen.getAllByText('4,000원').length).toBeGreaterThan(0);
  expect(screen.queryByText('고정 지출 · 세금')).toBeNull();
});

it('삭제된 메뉴는 현재 메뉴 조회 없이 판매 원장으로 상세를 열고 삭제 표기를 유지한다', () => {
  state.rangeMode = true;
  state.recipeDeleted = true;
  state.ledger = { sold: true, name: '제육볶음', qty: 3, revenue: 30000, unitPrice: 10000,
    unitMaterialCost: 2000, unitExtraCost: 100, unitFixedCost: 1000, unitTax: 900, unitProfit: 6000,
    tax: 2700, lines: [], extras: [], pricePoints: [] };
  render(<SalesMenuDetailScreen />);
  expect(screen.getByText('(삭제 메뉴)')).toBeTruthy();
  expect(screen.getAllByText('30,000원').length).toBeGreaterThan(0);
  expect(screen.queryByText('802,000원')).toBeNull();
  expect(screen.queryByText('메뉴를 찾을 수 없어요')).toBeNull();
});

it.each([false, true])('장부 조회 오류에서 현재 값으로 대신 표시하지 않고 재조회한다 (기간=%s)', rangeMode => {
  state.rangeMode = rangeMode;
  state.error = new Error('장부 조회 실패');
  render(<SalesMenuDetailScreen />);
  expect(screen.queryByText('현재 이름')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(state.retry).toHaveBeenCalledOnce();
});

it('장부 로딩 중 현재 순이익을 노출하지 않는다', () => {
  state.loading = true;
  render(<SalesMenuDetailScreen />);
  expect(screen.queryByText('현재 순이익률')).toBeNull();
});

it('복수 판매가의 기간 채널에는 평균가로 만든 매출 대신 확정 수량을 표시한다', () => {
  state.rangeMode = true;
  state.ledger = { sold: true, name: '기간 메뉴', qty: 3, unitPrice: 12000,
    unitMaterialCost: 2000, unitExtraCost: 0, unitFixedCost: 1000, unitTax: 1000, unitProfit: 8000,
    tax: 3000, lines: [], extras: [], pricePoints: [{ price: 10000, qty: 2 }, { price: 16000, qty: 1 }] };
  render(<SalesMenuDetailScreen />);
  const channelRow = screen.getByText('매장').parentElement!.parentElement!;
  expect(within(channelRow).getByText('3개')).toBeTruthy();
  expect(within(channelRow).queryByText('36,000원')).toBeNull();
  expect(screen.getByText('목표 달성')).toBeTruthy();
});
