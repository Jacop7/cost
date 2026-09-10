import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StockRevertAction } from '@/features/ingredients/components/StockRevertAction';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), toast: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mock.rpc } }));
vi.mock('@/lib/toast', () => ({ showToast: mock.toast }));
vi.mock('react-native', async original => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <>{children}</> : null };
});
function mount(action: '입고' | '차감' | '폐기') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidated = vi.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}><StockRevertAction action={action} eventId="event-exact" ingredientId="ingredient-exact" quantity="100g" /></QueryClientProvider>);
  return invalidated;
}
describe('기록 하단 취소 버튼과 실제 훅', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.rpc.mockResolvedValue({ data: {}, error: null }); });
  for (const action of ['입고', '차감', '폐기'] as const) {
    it(`${action}: 확인 전에는 쓰지 않고 정확한 원장 ID 한 번만 전송`, async () => {
      let finish!: (value: { data: object; error: null }) => void;
      mock.rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
      const invalidated = mount(action);
      const actionButton = screen.getByRole('button', { name: `${action} 취소` });
      expect(getComputedStyle(actionButton).alignSelf).toBe('stretch');
      expect(getComputedStyle(actionButton.parentElement!).paddingLeft).toBe('15px');
      expect(getComputedStyle(actionButton.parentElement!).paddingRight).toBe('15px');
      fireEvent.click(actionButton);
      expect(screen.getByText(`${action}${action === '차감' ? '을' : '를'} 취소할까요?`)).toBeTruthy();
      const messages = {
        입고: '재고와 기준 단가가 다시 계산됩니다.',
        차감: '차감한 수량이 재고로 돌아옵니다.',
        폐기: '폐기한 수량이 재고로 돌아오고, 해당 폐기 손실이 취소됩니다.',
      };
      expect(screen.getByText(messages[action])).toBeTruthy();
      for (const other of ['입고', '차감', '폐기'] as const) {
        if (other !== action) expect(screen.queryByText(messages[other])).toBeNull();
      }
      expect(screen.queryByText(/100g.*기록을 취소합니다/)).toBeNull();
      expect(mock.rpc).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: /^닫기$/ }));
      expect(screen.queryByText(messages[action])).toBeNull();
      expect(mock.rpc).not.toHaveBeenCalled();
      fireEvent.click(actionButton);
      const buttons = screen.getAllByRole('button', { name: `${action} 취소` });
      fireEvent.click(buttons.at(-1)!);
      fireEvent.click(buttons.at(-1)!);
      await waitFor(() => expect(mock.rpc).toHaveBeenCalledTimes(1));
      expect(mock.rpc).toHaveBeenCalledWith('revert_latest_stock_event', { p_event: 'event-exact' });
      fireEvent.click(buttons.at(-1)!);
      fireEvent.click(screen.getByRole('button', { name: /^닫기$/ }));
      expect(screen.getByText(messages[action])).toBeTruthy();
      expect(mock.rpc).toHaveBeenCalledTimes(1);
      expect(mock.toast).not.toHaveBeenCalled();
      await act(async () => { finish({ data: {}, error: null }); });
      await waitFor(() => expect(mock.toast).toHaveBeenCalledWith(`${action} 취소가 완료됐어요.`));
      expect(mock.toast).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(messages[action])).toBeNull();
      expect(mock.rpc).toHaveBeenCalledTimes(1);
      expect(invalidated).toHaveBeenCalledWith({ queryKey: ['ingredients', 'ingredient-exact', 'history'] });
    });
  }
  it('닫기는 쓰기를 호출하지 않는다', () => {
    mount('차감'); fireEvent.click(screen.getByRole('button', { name: '차감 취소' }));
    fireEvent.click(screen.getByRole('button', { name: /^닫기$/ }));
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(screen.queryByText('차감을 취소할까요?')).toBeNull();
  });
  it('서버의 최신성 거부를 표시하고 성공 토스트를 보내지 않는다', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: '새 기록이 있어 취소할 수 없습니다' } });
    mount('폐기'); fireEvent.click(screen.getByRole('button', { name: '폐기 취소' }));
    fireEvent.click(screen.getAllByRole('button', { name: '폐기 취소' }).at(-1)!);
    await screen.findByText('새 기록이 있어 취소할 수 없습니다');
    expect(mock.toast).not.toHaveBeenCalled();
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc).toHaveBeenCalledWith('revert_latest_stock_event', { p_event: 'event-exact' });
    expect(screen.queryByText('폐기를 취소할까요?')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^확인$/ }));
    expect(screen.queryByText('새 기록이 있어 취소할 수 없습니다')).toBeNull();
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });
});
