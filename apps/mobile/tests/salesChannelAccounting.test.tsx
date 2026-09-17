import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SalesChannelScreen from '@/features/sales/screens/SalesChannelScreen';
const state = vi.hoisted(() => ({
  net: 11000 as number | null,
  fixed: 1000 as number | null,
  error: null as Error | null,
  retry: vi.fn(),
  unallocated: 0,
}));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({ date: '2026-09-14' }), router: { canGoBack: () => false, replace: vi.fn() } }));
vi.mock('@/features/business-day/businessDay', () => ({ useSalesBusinessDate: () => ({ date: '2026-09-14', isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock('@/features/sales/hooks', () => ({
  useSalesRange: () => ({ data: { summary: { wasteLoss: 0, dailyExtra: 0, extraMaterialCost: 0 }, fixedCostUnallocated: state.unallocated, channels: [{ code: 'hall', name: '매장', qty: 2, amount: 11000, material: 2000, tax: 1100, netSales: state.net, fixedCost: state.fixed }, { code: 'delivery', name: '배달앱', qty: 0, amount: 0, material: 0, tax: 0, netSales: 0, fixedCost: state.fixed == null ? null : 0 }] }, isLoading: false, error: null, refetch: state.retry }),
  useEtcByChannel: () => ({ data: { byChannel: { hall: { amount: 1000, tax: 100, netSales: 1000 } }, unassigned: 0 }, isLoading: false, error: state.error, refetch: state.retry }),
}));
beforeEach(() => {
  state.net = 11000;
  state.fixed = 1000;
  state.error = null;
  state.unallocated = 0;
  state.retry.mockClear();
});
afterEach(cleanup);
it('서버가 합산한 메뉴·기타 매출을 화면에서 다시 더하지 않는다', () => {
  render(<SalesChannelScreen />);
  expect(screen.getByText('8,000원')).toBeTruthy();
  expect(screen.queryByText('12,000원')).toBeNull();
  expect(screen.queryByText('6,900원')).toBeNull();
  expect(screen.getByText('세금 (참고)')).toBeTruthy();
  expect(screen.queryByText('(−) 세금')).toBeNull();
});
it('세금 포함 매출은 서버 순매출을 사용한다', () => {
  state.net = 10000;
  render(<SalesChannelScreen />);
  expect(screen.getByText('7,000원')).toBeTruthy();
});
it('구 서버 순매출 누락을 0이나 세금 차감 추정으로 대체하지 않는다', () => {
  state.net = null;
  render(<SalesChannelScreen />);
  expect(screen.queryByText('순이익')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(state.retry).toHaveBeenCalledTimes(2);
});
it('기타매출 조회가 실패하면 불완전한 손익을 숨긴다', () => {
  state.error = new Error('조회 실패');
  render(<SalesChannelScreen />);
  expect(screen.queryByText('순이익')).toBeNull();
});
it('매출이 0이어도 배분된 고정 지출이 있는 채널과 미지정 몫을 숨기지 않는다', () => {
  state.fixed = 1000;
  state.unallocated = 200;
  render(<SalesChannelScreen />);
  expect(screen.getByText('채널 미지정 고정 지출')).toBeTruthy();
  expect(screen.getByText('200원')).toBeTruthy();
});

it('고정 지출이 미산출이어도 매출·수량은 유지하고 고정 지출과 순이익만 미산출로 표시한다', () => {
  state.fixed = null;
  render(<SalesChannelScreen />);
  expect(screen.getByText('11,000원')).toBeTruthy();
  expect(screen.getByText('판매 수량')).toBeTruthy();
  expect(screen.getByText('(−) 고정 지출 배분')).toBeTruthy();
  expect(screen.getAllByText('미산출').length).toBeGreaterThanOrEqual(2);
});
