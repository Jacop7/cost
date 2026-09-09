import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ToastHost } from '@/components/kit/ToastHost';
import { dismissToast, getToast, showToast } from '@/lib/toast';

afterEach(() => { const t = getToast(); if (t) act(() => dismissToast(t.id)); vi.useRealTimers(); });
it('공용 토스트가 표시되고 3초 뒤 사라진다', () => {
  vi.useFakeTimers(); render(<ToastHost />);
  act(() => showToast('입고 처리했어요.'));
  expect(screen.getByRole('alert').textContent).toBe('입고 처리했어요.');
  act(() => vi.advanceTimersByTime(3000)); expect(screen.queryByRole('alert')).toBeNull();
});
it('새 성공 안내를 이전 타이머나 이전 id가 지우지 않는다', () => {
  vi.useFakeTimers(); render(<ToastHost />);
  act(() => showToast('차감 처리했어요.')); const previous = getToast()!.id;
  act(() => vi.advanceTimersByTime(2000)); act(() => showToast('폐기 처리했어요.'));
  act(() => { dismissToast(previous); vi.advanceTimersByTime(1000); });
  expect(screen.getByRole('alert').textContent).toBe('폐기 처리했어요.');
  act(() => vi.advanceTimersByTime(2000)); expect(screen.queryByRole('alert')).toBeNull();
});
