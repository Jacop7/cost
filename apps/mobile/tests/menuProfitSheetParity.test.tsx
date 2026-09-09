import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MenuProfitSheet } from '@/features/sales/components/MenuProfitSheet';
import type { RangeMenu, SalesSummary } from '@/features/sales/hooks';

const push = vi.hoisted(() => vi.fn());
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

describe('메뉴 손익 요약 배치', () => {
  it('금액·비율은 같은 세로 열에, 배분은 항목 아래에 둔다(기존 배분 계산 보존)', () => {
    render(<MenuProfitSheet sel={menu} summary={summary} periodLabel="9월" from={summary.from} to={summary.to} onClose={vi.fn()} />);
    const fixed = within(screen.getByTestId('menu-profit/(−) 고정 지출'));
    const amount = fixed.getByText('10,000원'); const percent = fixed.getByText('10%');
    expect(amount.parentElement).toBe(percent.parentElement);
    expect(getComputedStyle(amount.parentElement!).flexDirection).toBe('column');
    expect(fixed.getByText('배분').parentElement).toBe(fixed.getByText('(−) 고정 지출').parentElement);
    const profit = within(screen.getByTestId('menu-profit/순이익'));
    expect(profit.getByText('50,409원')).toBeTruthy(); expect(profit.getByText('50.4%')).toBeTruthy();
    expect(profit.getByText('목표 달성')).toBeTruthy();
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
    render(<MenuProfitSheet sel={{ ...menu, revenue: 0, material: 0 }} summary={{ ...summary, revenue: 0 }}
      periodLabel="9월" from={summary.from} to={summary.to} onClose={vi.fn()} />);
    expect(within(screen.getByTestId('menu-profit/매출')).getByText('0%')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|100%/);
  });
});
