import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SalesExpenseScreen from '@/features/sales/screens/SalesExpenseScreen';
const mock = vi.hoisted(() => ({ mutate: vi.fn(), amend: vi.fn(), revision: 1, dayStatus: 'open', editable: true, pending: false }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), router: { canGoBack: () => false, replace: vi.fn() } }));
vi.mock('react-native', async original => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div data-testid="modal-content">{children}</div> : null }));
vi.mock('@/features/business-day/businessDay', () => ({
  useSalesBusinessDate: () => ({ date: '2026-09-11', isLoading: false, error: null }), isRevisionConflict: () => false }));
vi.mock('@/features/sales/hooks', () => ({
  useSalesDay: () => ({ data: { revision: mock.revision, hasLedger: true, editable: mock.editable, dayStatus: mock.dayStatus, items: [], extraItems: [{ name: '얼음', amount: 2000 }], dailyExtra: 2000 }, isLoading: false, error: null }),
  useSalesRange: () => ({}), useSaveSale: () => ({ mutate: mock.mutate, isPending: mock.pending }),
  useAmendPastSale: () => ({ mutate: mock.amend, isPending: false }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mock.revision = 1; mock.dayStatus = 'open'; mock.editable = true; mock.pending = false; });
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
it.each(['-1', 'abc', '0', 'Infinity'])('rejects invalid expense amount %s without writing', value => {
  render(<SalesExpenseScreen />); fillExpense();
  fireEvent.change(screen.getByPlaceholderText('15000'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  expect(mock.mutate).not.toHaveBeenCalled(); expect(mock.amend).not.toHaveBeenCalled();
  expect(within(screen.getByTestId('modal-content')).getByRole('alert').textContent).toBe('항목명과 0보다 큰 금액을 입력해 주세요.');
});
it('uses the correction RPC for a confirmed closed-day deletion', () => {
  mock.dayStatus = 'closed'; render(<SalesExpenseScreen />);
  fireEvent.click(screen.getByRole('button', { name: '얼음 삭제' }));
  expect(mock.amend).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  expect(mock.mutate).not.toHaveBeenCalled();
  expect(mock.amend.mock.calls[0]![0]).toMatchObject({ items: [], extraItems: [], baseRevision: 1 });
});
it('keeps a save failure visible inside the modal and preserves the draft', () => {
  render(<SalesExpenseScreen />); fillExpense();
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  act(() => mock.mutate.mock.calls[0]![1].onError(new Error('연결을 확인해 주세요.')));
  expect(within(screen.getByTestId('modal-content')).getByRole('alert').textContent).toBe('연결을 확인해 주세요.');
  expect((screen.getByPlaceholderText('15000') as HTMLInputElement).value).toBe('1500');
  expect((screen.getByPlaceholderText('예: 얼음·소모품') as HTMLInputElement).value).toBe('봉투');
});
it('locks all draft fields while the submitted expense is pending', () => {
  const view = render(<SalesExpenseScreen />); fillExpense();
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  mock.pending = true; view.rerender(<SalesExpenseScreen />);
  for (const placeholder of ['15000', '예: 얼음·소모품', '간단 메모'])
    expect(screen.getByPlaceholderText(placeholder).getAttribute('readonly')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  expect(mock.mutate).toHaveBeenCalledTimes(1);
});
