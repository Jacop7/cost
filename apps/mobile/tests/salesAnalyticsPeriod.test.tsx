import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SalesAnalyticsScreen from '@/features/sales/screens/SalesAnalyticsScreen';

const mock = vi.hoisted(() => ({ range: vi.fn(), push: vi.fn() }));
vi.mock('react-native', async (original) => ({
  ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div data-testid="period-modal">{children}</div> : null,
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mock.push }) }));
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
function custom() {
  fireEvent.click(screen.getByRole('button', { name: /오늘, / }));
  fireEvent.click(modal().getByRole('button', { name: '직접 설정하기' }));
}

it('기간 기본 선택은 공용 선택 행으로 즉시 적용하며 서버 날짜를 사용한다', () => {
  render(<SalesAnalyticsScreen />);
  fireEvent.click(screen.getByRole('button', { name: /오늘, / }));
  fireEvent.click(modal().getByRole('button', { name: /^어제 / }));
  expect(screen.queryByTestId('period-modal')).toBeNull();
  expect(mock.range).toHaveBeenCalledWith('2026-09-08', '2026-09-08');
});

it('직접 설정은 두 날짜 칸부터 보이고 날짜 선택 후 적용할 때만 조회 범위를 바꾼다', () => {
  render(<SalesAnalyticsScreen />); custom();
  expect(modal().queryByRole('button', { name: '이전 달' })).toBeNull();
  fireEvent.click(modal().getByRole('button', { name: '종료일 2026-09-09 고르기' }));
  expect(modal().getByRole('button', { name: '10일 선택' }).getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(modal().getByRole('button', { name: '6일 선택' }));
  expect(modal().queryByRole('button', { name: '이전 달' })).toBeNull();
  expect(mock.range).not.toHaveBeenCalledWith('2026-09-03', '2026-09-06');
  fireEvent.click(modal().getByRole('button', { name: '적용' }));
  expect(mock.range).toHaveBeenCalledWith('2026-09-03', '2026-09-06');
});

it('직접 설정을 닫으면 임시 날짜가 적용되지 않으며 다시 열면 초기 범위다', () => {
  render(<SalesAnalyticsScreen />); custom();
  fireEvent.click(modal().getByRole('button', { name: '시작일 2026-09-03 고르기' }));
  fireEvent.click(modal().getByRole('button', { name: '5일 선택' }));
  fireEvent.click(modal().getByRole('button', { name: '닫기' }));
  expect(mock.range).not.toHaveBeenCalledWith('2026-09-05', '2026-09-09');
  custom();
  expect(modal().getByRole('button', { name: '시작일 2026-09-03 고르기' })).toBeTruthy();
});
