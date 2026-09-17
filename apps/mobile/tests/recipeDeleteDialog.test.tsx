import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RecipeDeleteDialog } from '@/features/recipes/components/RecipeDeleteDialog';

const mock = vi.hoisted(() => ({ status: 'closed', unavailable: false, remove: vi.fn() }));
vi.mock('@/features/business-day/businessDay', () => ({ useBusinessDay: () => ({
  data: mock.unavailable ? undefined : { status: mock.status }, isError: mock.unavailable,
}) }));
vi.mock('@/features/recipes/hooks', () => ({ useDeleteRecipe: () => ({ mutateAsync: mock.remove, isPending: false }) }));
vi.mock('react-native', async original => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div>{children}</div> : null }));
const target = { id: 'recipe', name: '김치찌개', revision: '7' };
const close = vi.fn(); const deleted = vi.fn();
beforeEach(() => { mock.status = 'closed'; mock.unavailable = false; mock.remove.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const mount = () => render(<RecipeDeleteDialog target={target} onClose={close} onDeleted={deleted} />);

it.each(['open', 'break'])('%s 상태에서는 삭제할 수 없다', status => {
  mock.status = status; mount();
  expect(screen.getByText(/영업 종료 후 삭제/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '확인' }));
  expect(mock.remove).not.toHaveBeenCalled();
});
it('영업 상태를 확인하지 못하면 삭제를 차단한다', () => {
  mock.unavailable = true; mount();
  expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
});
it('삭제 취소는 원장을 변경하지 않는다', () => {
  mount(); fireEvent.click(screen.getByRole('button', { name: '취소' }));
  expect(close).toHaveBeenCalledOnce(); expect(mock.remove).not.toHaveBeenCalled();
});
it.each(['none', 'closed'])('%s 상태에서 확인 시 해당 메뉴와 판본으로 삭제한다', async status => {
  mock.status = status;
  mount(); expect(screen.getByText(/삭제 시, 복구가 불가합니다/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  await waitFor(() => expect(deleted).toHaveBeenCalledOnce());
  expect(mock.remove).toHaveBeenCalledWith({ id: 'recipe', revision: '7' });
});
it('서버가 영업 시작 또는 판본 변경으로 거절하면 이동하지 않는다', async () => {
  mock.remove.mockRejectedValue(new Error('영업 종료 후 삭제할 수 있어요.')); mount();
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  await screen.findByText('삭제하지 못했어요');
  expect(deleted).not.toHaveBeenCalled();
});
it('처리 중 중복 클릭과 화면을 떠난 뒤의 이동을 막는다', async () => {
  let resolve!: () => void;
  mock.remove.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  const view = mount(); const button = screen.getByRole('button', { name: '삭제' });
  fireEvent.click(button); fireEvent.click(button); expect(mock.remove).toHaveBeenCalledOnce();
  view.unmount(); resolve(); await Promise.resolve();
  expect(deleted).not.toHaveBeenCalled();
});
