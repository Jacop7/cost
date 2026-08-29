/** MY-10 계정 탈퇴 — 원장 보존 안내·명시 확인·중복 제출·오류 표시 계약. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  const Modal = ({ visible, children }: { visible?: boolean; children?: React.ReactNode }) => (visible ? <>{children}</> : null);
  return { ...rn, Modal };
});

vi.mock('expo-router', () => ({
  router: { canGoBack: () => true, back: vi.fn(), replace: vi.fn() },
}));

const mutate = vi.fn();
let pending = false;
vi.mock('@/features/my/hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRetireAccount: () => ({ mutate, isPending: pending }),
}));

import MyAccountScreen from '@/features/my/screens/MyAccountScreen';
import { parseRetireAccountResult } from '@/features/my/hooks';

const disabled = (label: string) => screen.getByLabelText(label).getAttribute('aria-disabled') === 'true';

beforeEach(() => {
  mutate.mockReset();
  pending = false;
});

describe('계정 관리 화면', () => {
  it('접근 종료와 원장 보존을 탈퇴 전에 함께 알린다', () => {
    render(<MyAccountScreen />);
    expect(screen.getByText(/접근이 즉시 종료/)).toBeTruthy();
    expect(screen.getByText(/매출·입고·재고 원장.*물리 삭제하지 않고 보존/)).toBeTruthy();
  });

  it('정확히 탈퇴라고 입력하기 전에는 확정할 수 없다', () => {
    render(<MyAccountScreen />);
    fireEvent.click(screen.getByRole('button', { name: '계정 탈퇴' }));
    expect(screen.getByText('계정을 탈퇴할까요?')).toBeTruthy();
    expect(disabled('계정 탈퇴 확정')).toBe(true);
    fireEvent.change(screen.getByLabelText('탈퇴 확인 문구'), { target: { value: '탈 퇴' } });
    expect(disabled('계정 탈퇴 확정')).toBe(true);
    fireEvent.change(screen.getByLabelText('탈퇴 확인 문구'), { target: { value: '탈퇴' } });
    expect(disabled('계정 탈퇴 확정')).toBe(false);
  });

  it('저장 중에는 닫기와 연타를 막는다', () => {
    const { rerender } = render(<MyAccountScreen />);
    fireEvent.click(screen.getByRole('button', { name: '계정 탈퇴' }));
    fireEvent.change(screen.getByLabelText('탈퇴 확인 문구'), { target: { value: '탈퇴' } });
    fireEvent.click(screen.getByLabelText('계정 탈퇴 확정'));
    expect(mutate).toHaveBeenCalledTimes(1);

    pending = true;
    rerender(<MyAccountScreen />);
    expect(disabled('계정 탈퇴 확정')).toBe(true);
    fireEvent.click(screen.getByLabelText('닫기'));
    expect(screen.getByText('계정을 탈퇴할까요?')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('계정 탈퇴 확정'));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('실패하면 시트에 이유를 보여 주고 입력을 다시 열어 둔다', () => {
    render(<MyAccountScreen />);
    fireEvent.click(screen.getByRole('button', { name: '계정 탈퇴' }));
    fireEvent.change(screen.getByLabelText('탈퇴 확인 문구'), { target: { value: '탈퇴' } });
    fireEvent.click(screen.getByLabelText('계정 탈퇴 확정'));
    const callbacks = mutate.mock.calls[0]![1] as { onError: (error: unknown) => void };
    act(() => callbacks.onError(new Error('계정 탈퇴를 완료하지 못했어요')));
    expect(screen.getByRole('alert').textContent).toContain('계정 탈퇴를 완료하지 못했어요');
    expect(disabled('계정 탈퇴 확정')).toBe(false);
  });
});

describe('계정 탈퇴 응답 계약', () => {
  it('삭제 완료와 보존 매장 수를 엄격하게 읽는다', () => {
    expect(parseRetireAccountResult({ deleted: true, archived_store_count: '1' }))
      .toEqual({ deleted: true, archivedStoreCount: 1 });
  });

  it.each([
    null,
    {},
    { deleted: false, archived_store_count: 1 },
    { deleted: true, archived_store_count: -1 },
    { deleted: true, archived_store_count: 1.5 },
  ])('불완전한 응답을 성공으로 위장하지 않는다: %j', (value) => {
    expect(() => parseRetireAccountResult(value)).toThrow(/계정 탈퇴 결과/);
  });
});
