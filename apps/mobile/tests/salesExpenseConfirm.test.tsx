import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SalesExpenseScreen from '@/features/sales/screens/SalesExpenseScreen';
const mock = vi.hoisted(() => ({ mutate: vi.fn(), amend: vi.fn(), revision: 1, dayStatus: 'open', editable: true }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), router: { canGoBack: () => false, replace: vi.fn() } }));
vi.mock('react-native', async original => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div>{children}</div> : null }));
vi.mock('@/features/business-day/businessDay', () => ({
  useSalesBusinessDate: () => ({ date: '2026-09-11', isLoading: false, error: null }), isRevisionConflict: () => false }));
vi.mock('@/features/sales/hooks', () => ({
  useSalesDay: () => ({ data: { revision: mock.revision, hasLedger: true, editable: mock.editable, dayStatus: mock.dayStatus, items: [], extraItems: [{ name: '얼음', amount: 2000 }], dailyExtra: 2000 }, isLoading: false, error: null }),
  useSalesRange: () => ({}), useSaveSale: () => ({ mutate: mock.mutate, isPending: false }),
  useAmendPastSale: () => ({ mutate: mock.amend, isPending: false }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mock.revision = 1; mock.dayStatus = 'open'; mock.editable = true; });
it('opens a confirmation without writes and cancel preserves the expense', () => {
  render(<SalesExpenseScreen />);
  fireEvent.click(screen.getByRole('button', { name: '얼음 삭제' }));
  expect(screen.getByText('지출을 삭제할까요?')).toBeTruthy();
  expect(mock.mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  expect(mock.mutate).not.toHaveBeenCalled();
});
it('only confirmed deletion submits the observed revision', () => {
  render(<SalesExpenseScreen />);
  fireEvent.click(screen.getByRole('button', { name: '얼음 삭제' }));
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  expect(mock.mutate).toHaveBeenCalledTimes(1);
  expect(mock.mutate.mock.calls[0]![0]).toMatchObject({ date: '2026-09-11', extraItems: [], baseRevision: 1 });
});
it('does not delete a replaced row when the revision changes while confirming', () => {
  const view = render(<SalesExpenseScreen />);
  fireEvent.click(screen.getByRole('button', { name: '얼음 삭제' }));
  mock.revision = 2; view.rerender(<SalesExpenseScreen />);
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  expect(mock.mutate).not.toHaveBeenCalled();
  expect(screen.getByText('내역이 변경됐어요. 최신 목록에서 삭제할 항목을 다시 선택해 주세요.')).toBeTruthy();
});
function fillExpense() {
  fireEvent.click(screen.getByRole('button', { name: '지출 추가' }));
  fireEvent.change(screen.getByPlaceholderText('예: 얼음·소모품'), { target: { value: '봉투' } });
  fireEvent.change(screen.getByPlaceholderText('15000'), { target: { value: '1500' } });
}
it('adds directly from the detail, preserving existing expenses and revision', () => {
  render(<SalesExpenseScreen />); fillExpense();
  expect(mock.mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  expect(mock.mutate.mock.calls[0]![0]).toMatchObject({ baseRevision: 1, extraItems: [{ name: '얼음', amount: 2000 }, { name: '봉투', amount: 1500 }] });
});
it('blocks stale additions instead of rebasing silently', () => {
  const view = render(<SalesExpenseScreen />); fillExpense();
  mock.revision = 2; view.rerender(<SalesExpenseScreen />);
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  expect(mock.mutate).not.toHaveBeenCalled(); expect(mock.amend).not.toHaveBeenCalled();
});
it('amends a closed ledger without reopening it or changing sales quantities', () => {
  mock.dayStatus = 'closed'; render(<SalesExpenseScreen />); fillExpense();
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  expect(mock.mutate).not.toHaveBeenCalled();
  expect(mock.amend.mock.calls[0]![0]).toMatchObject({ items: [], baseRevision: 1, extraItems: [{ name: '얼음', amount: 2000 }, { name: '봉투', amount: 1500 }] });
});
it('honors the server editing window', () => {
  mock.editable = false; render(<SalesExpenseScreen />);
  fireEvent.click(screen.getByRole('button', { name: '지출 추가' }));
  expect(screen.queryByPlaceholderText('15000')).toBeNull();
  expect(mock.mutate).not.toHaveBeenCalled();
});
