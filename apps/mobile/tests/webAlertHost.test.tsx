import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Alert } from 'react-native';
import { WebAlertHost } from '@/components/kit/WebAlertHost';
import { getWebAlert, installWebAlert, respondWebAlert } from '@/lib/webAlert';

afterEach(() => { act(() => { while (getWebAlert()) respondWebAlert(getWebAlert()!.id); }); });
it('실제 공용 Sheet가 문구/세 버튼을 표시하고 누른 버튼만 실행한다', () => {
  installWebAlert(); const save = vi.fn(), remove = vi.fn(); render(<WebAlertHost />);
  act(() => Alert.alert('선택 확인', '기존 내용', [
    { text: '취소', style: 'cancel' }, { text: '보관', onPress: save }, { text: '삭제 확정', style: 'destructive', onPress: remove },
  ]));
  expect(screen.getByText('기존 내용')).toBeTruthy();
  expect(save).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  expect(getWebAlert()).toBe(null); expect(save).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
});
