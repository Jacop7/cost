import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SalesAnalyticsScreen from '@/features/sales/screens/SalesAnalyticsScreen';

const mock = vi.hoisted(() => ({ range: vi.fn(), push: vi.fn() }));
vi.mock('react-native', async (original) => ({
  ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div data-testid="period-modal">{children}</div> : null,
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mock.push, replace: mock.push }) }));
vi.mock('@/lib/nav', () => ({ safeBack: vi.fn() }));
vi.mock('@/features/business-day/businessDay', () => ({
  useSalesBusinessDate: () => ({ date: '2026-09-09', isLoading: false, error: null, refetch: vi.fn() }),
}));
vi.mock('@/features/sales/hooks', () => ({ useSalesRange: mock.range }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.range.mockReturnValue({ data: { summary: null, daily: [], menu: [], channels: [] }, isLoading: false, error: null, refetch: vi.fn() });
});
afterEach(cleanup);
const modal = () => within(screen.getByTestId('period-modal'));
const open = () => fireEvent.click(screen.getByRole('button', { name: /일간, / }));

it('중복 요약 없이 손익 계산에 총 지출을 표시하고 채널별 매출을 그 아래에 둔다', () => {
  mock.range.mockReturnValue({
    data: {
      summary: {
        from: '2026-09-09', to: '2026-09-09', days: 1, revenue: 1_000, etcRevenue: 0, qty: 2,
        materialCost: 200, extraMaterialCost: 20, tax: 100, wasteLoss: 30, wasteIngredient: 10,
        wasteMenu: 20, dailyExtra: 50, fixedCost: 200, fixedRate: 0.2,
        fixedRateProvisional: false, profit: 400,
      },
      daily: [], menu: [], channels: [],
    },
    isLoading: false, error: null, refetch: vi.fn(),
  });

  render(<SalesAnalyticsScreen />);

  // 상단 내비게이션 탭 이름은 유지하고, 같은 이름의 중복 섹션 제목은 제거한다.
  expect(screen.getAllByText('매출 분석')).toHaveLength(1);
  expect(screen.getByText('총 지출')).toBeTruthy();
  expect(screen.getByText('600원')).toBeTruthy();
  expect(screen.getByText('60%')).toBeTruthy();
  const text = document.body.textContent ?? '';
  expect(text.indexOf('손익 계산')).toBeLessThan(text.indexOf('채널별 매출'));
});

it('메뉴별 판매량 행을 누르면 중간 팝업 없이 메뉴 손익 상세로 바로 이동한다', () => {
  mock.range.mockReturnValue({
    data: {
      summary: {
        from: '2026-09-09', to: '2026-09-09', days: 1, revenue: 12_000, etcRevenue: 0, qty: 1,
        materialCost: 2_806, extraMaterialCost: 0, tax: 1_091, wasteLoss: 0, wasteIngredient: 0,
        wasteMenu: 0, dailyExtra: 0, fixedCost: 3_756, fixedRate: 0.313,
        fixedRateProvisional: false, profit: 4_347,
      },
      daily: [],
      menu: [{
        recipeId: 'recipe-1', menuName: '제육볶음', isDeleted: false,
        qty: 1, qtyHall: 1, qtyDelivery: 0, qtyTakeout: 0, qtyWaste: 0,
        revenue: 12_000, unitPrice: 12_000, unitMaterialCost: 2_806, material: 2_806,
        channels: [],
      }],
      channels: [],
    },
    isLoading: false, error: null, refetch: vi.fn(),
  });

  render(<SalesAnalyticsScreen />);
  fireEvent.click(screen.getByRole('button', { name: '제육볶음 손익 보기' }));

  expect(mock.push).toHaveBeenCalledWith('/sales/menu?recipe=recipe-1&from=2026-09-09&to=2026-09-09');
  expect(screen.queryByRole('button', { name: '메뉴 손익 자세히 보기' })).toBeNull();
});

it('기간 팝업 상단은 월간·일간 탭만 보여 주고 일간 기본값은 서버 날짜다', () => {
  render(<SalesAnalyticsScreen />);
  expect(screen.getByRole('tab', { name: '매출 분석' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('sales-period-filter-touch-boundary').getAttribute('style')).toContain('padding-top: 6px');
  open();
  expect(modal().getByText('기간선택 - 일간')).toBeTruthy();
  expect(modal().getByRole('tab', { name: '월간' })).toBeTruthy();
  expect(modal().getByRole('tab', { name: '일간' }).getAttribute('style')).toContain('background-color: rgb(255, 255, 255)');
  expect(modal().getByRole('tab', { name: '월간' }).getAttribute('style')).toContain('background-color: rgba(0, 0, 0, 0)');
  expect(modal().queryByText('오늘')).toBeNull();
  expect(modal().queryByText('직접 설정하기')).toBeNull();
  expect(modal().queryByText(/· 1일$/)).toBeNull();
  expect(modal().queryByText('시작일')).toBeNull();
  expect(modal().queryByText('종료일')).toBeNull();
  const rangeField = modal().getByLabelText('선택 기간 2026-09-09 ~ 2026-09-09');
  expect(rangeField).toBeTruthy();
  expect(within(rangeField.parentElement as HTMLElement).getByRole('button', { name: '적용' })).toBeTruthy();
});

it('월간은 4열 블록에서 시작·종료 월과 사이 범위를 구분해 선택한다', () => {
  render(<SalesAnalyticsScreen />); open();
  fireEvent.click(modal().getByRole('tab', { name: '월간' }));
  expect(modal().getByText('기간선택 - 월간')).toBeTruthy();
  expect(modal().getByLabelText('선택 기간 2026-09 ~ 2026-09')).toBeTruthy();
  const months = modal().getAllByRole('button', { name: /^202[56]년 \d+월 선택$/ });
  expect(months).toHaveLength(24);
  expect(modal().getByLabelText('연도별 월간 달력')).toBeTruthy();
  expect(modal().getByRole('button', { name: '2025년 1월 선택' })).toBeTruthy();
  expect(modal().getByRole('button', { name: '2025년 12월 선택' })).toBeTruthy();
  expect(modal().getByRole('button', { name: '2026년 9월 선택' })).toBeTruthy();
  expect(modal().getByRole('button', { name: '2026년 10월 선택' }).getAttribute('aria-disabled')).toBe('true');
  expect(modal().getByText('2025년')).toBeTruthy();
  expect(modal().getByText('2026년')).toBeTruthy();
  expect(modal().getByRole('button', { name: '2026년 8월 선택' }).textContent).toBe('8월');
  expect(months[0]?.parentElement?.getAttribute('style')).toContain('width: 25%');
  fireEvent.click(modal().getByRole('button', { name: '2026년 6월 선택' }));
  fireEvent.click(modal().getByRole('button', { name: '2026년 8월 선택' }));
  expect(modal().getByRole('button', { name: '2026년 6월 선택' }).getAttribute('style')).toContain('background-color: rgb(25, 31, 40)');
  expect(modal().getByRole('button', { name: '2026년 7월 선택' }).getAttribute('style')).toContain('background-color: rgb(242, 244, 246)');
  expect(modal().getByRole('button', { name: '2026년 8월 선택' }).getAttribute('style')).toContain('background-color: rgb(25, 31, 40)');
  expect(modal().getByLabelText('선택 기간 2026-06 ~ 2026-08')).toBeTruthy();
  fireEvent.click(modal().getByRole('button', { name: '적용' }));
  expect(mock.range).toHaveBeenCalledWith('2026-06-01', '2026-08-31');
  expect(screen.getByRole('button', { name: /월간, / })).toBeTruthy();
});

it('월간에서 같은 월을 두 번 선택하면 한 달 범위가 된다', () => {
  render(<SalesAnalyticsScreen />); open();
  fireEvent.click(modal().getByRole('tab', { name: '월간' }));
  fireEvent.click(modal().getByRole('button', { name: '2026년 8월 선택' }));
  fireEvent.click(modal().getByRole('button', { name: '2026년 8월 선택' }));
  expect(modal().getByLabelText('선택 기간 2026-08 ~ 2026-08')).toBeTruthy();
  fireEvent.click(modal().getByRole('button', { name: '적용' }));
  expect(mock.range).toHaveBeenCalledWith('2026-08-01', '2026-08-31');
});

it('일간은 시작일·종료일을 달력에서 지정하고 적용할 때만 조회 범위를 바꾼다', () => {
  render(<SalesAnalyticsScreen />); open();
  fireEvent.click(modal().getByRole('button', { name: '2026년 9월 3일 선택' }));
  fireEvent.click(modal().getByRole('button', { name: '2026년 9월 6일 선택' }));
  expect(modal().getByLabelText('선택 기간 2026-09-03 ~ 2026-09-06')).toBeTruthy();
  expect(mock.range).not.toHaveBeenCalledWith('2026-09-03', '2026-09-06');
  fireEvent.click(modal().getByRole('button', { name: '적용' }));
  expect(mock.range).toHaveBeenCalledWith('2026-09-03', '2026-09-06');
});

it('일간 달력은 오늘 기준 1년 전부터 오늘까지만 선택할 수 있다', () => {
  render(<SalesAnalyticsScreen />); open();
  expect(modal().getByLabelText('최근 1년 일간 달력')).toBeTruthy();
  expect(modal().getByText('2025년 9월')).toBeTruthy();
  expect(modal().getByText('2026년 9월')).toBeTruthy();
  expect(modal().queryByText(/선택해 주세요 · 최근 1년/)).toBeNull();
  expect(modal().queryByRole('button', { name: '이전 달' })).toBeNull();
  expect(modal().queryByRole('button', { name: '다음 달' })).toBeNull();
  expect(modal().getByRole('button', { name: '2026년 9월 10일 선택' }).getAttribute('aria-disabled')).toBe('true');
  expect(modal().getByRole('button', { name: '2025년 9월 8일 선택' }).getAttribute('aria-disabled')).toBe('true');
  expect(modal().getByRole('button', { name: '2025년 9월 9일 선택' }).hasAttribute('disabled')).toBe(false);
});

it('기간 팝업을 닫으면 적용하지 않은 임시 선택을 버린다', () => {
  render(<SalesAnalyticsScreen />); open();
  fireEvent.click(modal().getByRole('button', { name: '2026년 9월 3일 선택' }));
  fireEvent.click(modal().getByRole('button', { name: '닫기' }));
  expect(mock.range).not.toHaveBeenCalledWith('2026-09-03', '2026-09-09');
  open();
  expect(modal().getByLabelText('선택 기간 2026-09-09 ~ 2026-09-09')).toBeTruthy();
});
