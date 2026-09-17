import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuProfitSheet } from '@/features/sales/components/MenuProfitSheet';
import type { RangeMenu, SalesSummary } from '@/features/sales/hooks';

const push = vi.hoisted(() => vi.fn());
const ledger = vi.hoisted(() => ({ data: {} as Record<string, unknown>, error: null as Error | null, retry: vi.fn() }));
vi.mock('@/features/sales/hooks', () => ({ useRangeMenuDetail: () => ({ data: ledger.data, isLoading: false, error: ledger.error, refetch: ledger.retry }) }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('react-native', async (original) => ({
  ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible: boolean; children: ReactNode }) => visible ? <div>{children}</div> : null,
}));
const summary: SalesSummary = {
  from: '2026-09-01', to: '2026-09-09', days: 9, revenue: 600000, etcRevenue: 0, qty: 60,
  materialCost: 180000, extraMaterialCost: 12000, tax: 54545, wasteLoss: 0,
  wasteIngredient: 0, wasteMenu: 0, dailyExtra: 3000, fixedCost: 60000,
  fixedRate: 0.1, fixedRateProvisional: false, profit: 290455,
};
const menu: RangeMenu = { recipeId: 'recipe-1', menuName: '제육볶음', qty: 10, qtyHall: 6,
  qtyDelivery: 3, qtyTakeout: 1, qtyWaste: 0, revenue: 100000, unitPrice: 10000,
  unitMaterialCost: 3000, material: 30000 };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
beforeEach(() => { ledger.data = { sold: true, name: '제육볶음', qtyHall: 6, qtyDelivery: 3, qtyTakeout: 1, qtyWaste: 0, revenue: 100000, qty: 10, materialCost: 30000, extraCost: 2000,
  fixedCost: 10000, tax: 9091, unitProfit: 4890.9 }; ledger.error = null; });

describe('메뉴 손익 요약 배치', () => {
  it('금액·비율은 같은 세로 열에, 공통 비용 배분은 항목 아래에 둔다', () => {
    render(<MenuProfitSheet sel={menu} summary={summary} periodLabel="9월" from={summary.from} to={summary.to} onClose={vi.fn()} />);
    const fixed = within(screen.getByTestId('menu-profit/(−) 고정 지출'));
    const amount = fixed.getByText('10,000원'); const percent = fixed.getByText('10%');
    expect(fixed.getByText('영업일별 배분')).toBeTruthy();
    expect(amount.parentElement).toBe(percent.parentElement);
    expect(getComputedStyle(amount.parentElement!).flexDirection).toBe('column');
    const daily = within(screen.getByTestId('menu-profit/(−) 추가 지출'));
    expect(daily.getByText('배분').parentElement).toBe(daily.getByText('(−) 추가 지출').parentElement);
    expect(screen.getByText('32,000원')).toBeTruthy();
    const profit = within(screen.getByTestId('menu-profit/순이익'));
    expect(profit.getByText('48,409원')).toBeTruthy(); expect(profit.getByText('48.4%')).toBeTruthy();
    expect(profit.queryByText('목표 달성')).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
  it('상세 이동은 원래 메뉴와 기간을 유지하고 닫은 다음에만 이동한다', () => {
    const close = vi.fn();
    render(<MenuProfitSheet sel={menu} summary={summary} periodLabel="9월" from={summary.from} to={summary.to} onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: '메뉴 손익 자세히 보기' }));
    expect(close).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith('/sales/menu?recipe=recipe-1&from=2026-09-01&to=2026-09-09');
  });
  it('매출 0에서 NaN·Infinity 또는 잘못된 100%를 표시하지 않는다', () => {
    ledger.data = { sold: true, revenue: 0, qty: 0, materialCost: 0, extraCost: 0, fixedCost: 0, tax: 0, unitProfit: 0 };
    render(<MenuProfitSheet sel={{ ...menu, revenue: 0, material: 0 }} summary={{ ...summary, revenue: 0 }}
      periodLabel="9월" from={summary.from} to={summary.to} onClose={vi.fn()} />);
    expect(within(screen.getByTestId('menu-profit/매출')).getByText('0%')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|100%/);
  });
  it('메뉴별 실제 세금과 서버 순이익을 사용해 별도 세금을 다시 빼지 않는다', () => {
    ledger.data = { ...ledger.data, tax: 10000, unitProfit: 5800 };
    render(<MenuProfitSheet sel={menu} summary={summary} periodLabel="9월" from={summary.from} to={summary.to} onClose={vi.fn()} />);
    expect(within(screen.getByTestId('menu-profit/순이익')).getByText('57,500원')).toBeTruthy();
    expect(within(screen.getByTestId('menu-profit/세금 (참고)')).getByText('10,000원')).toBeTruthy();
    expect(screen.queryByText('(−) 세금')).toBeNull();
  });
  it('장부 조회 실패 때 추정 이익으로 대신 표시하지 않는다', () => {
    ledger.error = new Error('장부 조회 실패');
    render(<MenuProfitSheet sel={menu} summary={summary} periodLabel="9월" from={summary.from} to={summary.to} onClose={vi.fn()} />);
    expect(screen.queryByTestId('menu-profit/순이익')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(ledger.retry).toHaveBeenCalledOnce();
  });
  it('목록이 오래되어도 수량·채널·명칭은 금액과 같은 상세 응답을 표시한다', () => {
    ledger.data = { ...ledger.data, name: '판매 당시 메뉴', qty: 12, qtyHall: 7, qtyDelivery: 3, qtyTakeout: 2, qtyWaste: 1, revenue: 120000 };
    render(<MenuProfitSheet sel={menu} summary={summary} periodLabel="9월" from={summary.from} to={summary.to} onClose={vi.fn()} />);
    expect(screen.getByText('판매 당시 메뉴 손익')).toBeTruthy();
    expect(within(screen.getByTestId('menu-profit/판매 수량')).getByText('12개')).toBeTruthy();
    expect(within(screen.getByTestId('menu-profit/채널 구성')).getByText('매장 7 · 배달 3 · 포장 2')).toBeTruthy();
    expect(within(screen.getByTestId('menu-profit/조리 후 폐기')).getByText('1개 · 매출 0')).toBeTruthy();
    expect(screen.getByText('9월 · 12개 판매')).toBeTruthy();
    expect(screen.queryByText('매장 6 · 배달 3 · 포장 1')).toBeNull();
  });
});
