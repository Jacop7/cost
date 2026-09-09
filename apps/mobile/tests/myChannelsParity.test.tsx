import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MyChannelsScreen from '@/features/my/screens/MyChannelsScreen';

const mock = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('react-native', async (original) => ({
  ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div data-testid="channel-modal">{children}</div> : null,
}));
vi.mock('@/lib/nav', () => ({ safeBack: vi.fn() }));
vi.mock('@/features/master-data/hooks', () => ({
  useSettingsLists: () => ({ data: { channels: [{ id: 'delivery', name: '배달앱', active: true }] }, isLoading: false, error: null, refetch: vi.fn() }),
  useSaveChannel: () => ({ mutate: mock.save, isPending: false }),
}));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
const modal = () => within(screen.getByTestId('channel-modal'));

it('채널 비활성 확인은 취소하면 무변경, 확정하면 해당 ID만 한 번 보낸다', () => {
  render(<MyChannelsScreen />);
  fireEvent.click(screen.getByRole('button', { name: '배달앱 사용 안 함으로 바꾸기' }));
  expect(modal().getByText('판매 채널 사용 안 함')).toBeTruthy();
  expect(mock.save).not.toHaveBeenCalled();
  fireEvent.click(modal().getByRole('button', { name: '취소' }));
  expect(mock.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '배달앱 사용 안 함으로 바꾸기' }));
  const confirm = modal().getByRole('button', { name: '사용 안 함' });
  fireEvent.click(confirm); fireEvent.click(confirm);
  expect(mock.save).toHaveBeenCalledTimes(1);
  expect(mock.save).toHaveBeenCalledWith({ id: 'delivery', name: '배달앱', active: false }, expect.any(Object));
});

it('이름 입력은 공통 크기이며 취소/저장 버튼 너비가 같다', () => {
  render(<MyChannelsScreen />);
  fireEvent.click(screen.getByRole('button', { name: '배달앱 이름 수정' }));
  const input = modal().getByRole('textbox');
  fireEvent.change(input, { target: { value: '직접 배달' } });
  const cancel = modal().getByRole('button', { name: '취소' });
  const save = modal().getByRole('button', { name: '저장' });
  expect(getComputedStyle(cancel.parentElement!).flexGrow).toBe(getComputedStyle(save.parentElement!).flexGrow);
  fireEvent.click(save);
  expect(mock.save).toHaveBeenCalledWith({ id: 'delivery', name: '직접 배달' }, expect.any(Object));
});
