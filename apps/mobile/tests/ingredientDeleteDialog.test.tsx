import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IngredientDeleteDialog } from '@/features/ingredients/components/IngredientDeleteDialog';
const check = vi.hoisted(() => vi.fn());
vi.mock('@/features/ingredients/deleteCheck', () => ({ checkIngredientDeletion: check }));
vi.mock('react-native', async original => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div>{children}</div> : null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('연결 확인 중에는 삭제 버튼이 없다', () => {
  check.mockReturnValue(new Promise(() => {}));
  render(<IngredientDeleteDialog id="i" name="대파" onCancel={vi.fn()} onConfirm={vi.fn()} />);
  expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
});
it('연결된 메뉴 이름과 제거 안내만 보이고 삭제는 실행하지 않는다', async () => {
  check.mockResolvedValue({ canDelete: false, menuNames: ['제육볶음', '판매 중지 메뉴'] });
  const remove = vi.fn();
  render(<IngredientDeleteDialog id="i" name="대파" onCancel={vi.fn()} onConfirm={remove} />);
  await screen.findByText('현재, 삭제가 불가능한 식재료입니다');
  expect(screen.getByText('사용 중인 메뉴')).toBeTruthy();
  expect(screen.getByText('2개')).toBeTruthy();
  expect(screen.getByText('제육볶음')).toBeTruthy();
  expect(screen.getByText('판매 중지 메뉴')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '확인' }));
  expect(remove).not.toHaveBeenCalled();
});
it('조회 실패도 삭제를 허용하지 않는다', async () => {
  check.mockRejectedValue(new Error('offline'));
  render(<IngredientDeleteDialog id="i" name="대파" onCancel={vi.fn()} onConfirm={vi.fn()} />);
  await screen.findByText(/연결된 메뉴를 확인하지 못했어요/);
  expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
});
it('연결이 없을 때만 복구 불가 문구와 삭제 버튼을 제공한다', async () => {
  check.mockResolvedValue({ canDelete: true, menuNames: [] });
  const remove = vi.fn();
  render(<IngredientDeleteDialog id="i" name="대파" onCancel={vi.fn()} onConfirm={remove} />);
  await screen.findByText('삭제하시겠습니까?');
  expect(screen.getByText(/삭제 시, 복구가 불가합니다/)).toBeTruthy();
  const deletes = screen.getAllByRole('button', { name: '삭제' });
  const confirm = deletes.at(-1);
  if (!confirm) throw new Error('삭제 확인 버튼이 없습니다');
  fireEvent.click(confirm);
  await waitFor(() => expect(remove).toHaveBeenCalledOnce());
});
