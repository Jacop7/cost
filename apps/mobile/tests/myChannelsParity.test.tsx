import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MyChannelsScreen from '@/features/my/screens/MyChannelsScreen';

const mock = vi.hoisted(() => ({ create: vi.fn(), remove: vi.fn(), restore: vi.fn(), lockedByDraft: false as boolean }));
vi.mock('react-native', async (original) => ({
  ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div>{children}</div> : null,
}));
vi.mock('@/lib/nav', () => ({ safeBack: vi.fn() }));
vi.mock('@/features/master-data/hooks', () => ({
  useSalesChannelSettings: () => ({ data: {
    revision: 4, maxActive: 5, activeCount: 4, lockedByDraft: mock.lockedByDraft,
    channels: [
      { id: 'hall', code: 'hall', name: '매장', active: true, sortOrder: 0, retiredAt: null, used: true },
      { id: 'delivery', code: 'delivery', name: '배달', active: true, sortOrder: 1, retiredAt: null, used: true },
      { id: 'takeout', code: 'takeout', name: '포장', active: true, sortOrder: 2, retiredAt: null, used: true },
      { id: 'custom', code: 'custom_1', name: '쿠팡이츠', active: true, sortOrder: 3, retiredAt: null, used: false },
      { id: 'retired', code: 'custom_2', name: '전화 주문', active: false, sortOrder: 4, retiredAt: '2026-09-18', used: true },
    ],
  }, isLoading: false, error: null, refetch: vi.fn() }),
  useCreateSalesChannel: () => ({ mutate: mock.create, isPending: false }),
  useDeleteSalesChannel: () => ({ mutate: mock.remove, isPending: false }),
  useRestoreSalesChannel: () => ({ mutate: mock.restore, isPending: false }),
}));

beforeEach(() => { vi.clearAllMocks(); mock.lockedByDraft = false; });
afterEach(cleanup);

it('이름 수정 없이 추가·삭제·복구와 활성 한도를 표시한다', () => {
  render(<MyChannelsScreen />);
  expect(screen.getByText('사용 중')).toBeTruthy();
  expect(screen.getByText('4/5')).toBeTruthy();
  expect(screen.queryByText('사용 중인 채널')).toBeNull();
  expect(screen.queryByText('추가 채널')).toBeNull();
  expect(screen.queryByRole('button', { name: /이름 수정/ })).toBeNull();
  expect(screen.queryByText('기본 채널')).toBeNull();
  expect(screen.queryByText('기본은 매장·배달·포장 3개예요')).toBeNull();
  expect(screen.queryByText(/채널 이름은 과거 원장과 연결되므로/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '쿠팡이츠 더보기' }));
  fireEvent.click(screen.getByRole('button', { name: '쿠팡이츠 삭제' }));
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  expect(mock.remove).toHaveBeenCalledWith({ id: 'custom', expectedRevision: 4 }, expect.any(Object));
  fireEvent.click(screen.getByRole('button', { name: '전화 주문 다시 사용' }));
  expect(mock.restore).toHaveBeenCalledWith({ id: 'retired', expectedRevision: 4 }, expect.any(Object));
});

it('새 채널 이름을 입력해 현재 revision으로 추가한다', () => {
  render(<MyChannelsScreen />);
  fireEvent.click(screen.getByRole('button', { name: '채널 추가' }));
  fireEvent.change(screen.getByRole('textbox', { name: '판매 채널 이름' }), { target: { value: '네이버 주문' } });
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  expect(mock.create).toHaveBeenCalledWith({ name: '네이버 주문', expectedRevision: 4 }, expect.any(Object));
});

it('작성 중이면 고정 지출 안내와 같은 필독사항으로 변경 제한을 설명한다', () => {
  mock.lockedByDraft = true;
  render(<MyChannelsScreen />);

  const toggle = screen.getByRole('button', { name: '필독사항 접기' });
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  const firstLine = screen.getByText('현재 입력 중인 매출 내역이 있어 판매 채널을 삭제하거나 추가할 수 없습니다.');
  const secondLine = screen.getByText('매출 등록을 완료하거나 초기화한 후 다시 시도해 주세요.');
  expect(screen.getAllByText('-')).toHaveLength(2);
  expect(firstLine.compareDocumentPosition(screen.getByText('사용 중')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(secondLine).toBeTruthy();
  fireEvent.click(toggle);
  expect(screen.getByRole('button', { name: '필독사항 펼치기' }).getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByText(/현재 입력 중인 매출 내역이 있어/)).toBeNull();
});
