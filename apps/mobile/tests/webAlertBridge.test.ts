import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert } from 'react-native';
import { installWebAlert, getWebAlert, respondWebAlert, subscribeWebAlert } from '@/lib/webAlert';

const patched = Alert as typeof Alert & { __webPatched?: boolean };
const originalAlert = Alert.alert;
describe('공용 웹 Alert 확인/취소 경계', () => {
  beforeEach(() => { delete patched.__webPatched; Alert.alert = originalAlert; installWebAlert(); });
  afterEach(() => {
    while (getWebAlert()) respondWebAlert(getWebAlert()!.id);
    vi.restoreAllMocks(); delete patched.__webPatched; Alert.alert = originalAlert;
  });
  it.each([0, 1])('표시로 실행하지 않고 선택한 callback %s 하나만 호출', index => {
    const cancel = vi.fn(), proceed = vi.fn();
    Alert.alert('양파 발주 취소', '안내', [
      { text: '닫기', style: 'cancel', onPress: cancel },
      { text: '발주 취소', style: 'destructive', onPress: proceed },
    ]);
    expect(proceed).not.toHaveBeenCalled(); expect(cancel).not.toHaveBeenCalled();
    const entry = getWebAlert()!; expect(entry.title).toBe('양파 발주 취소');
    respondWebAlert(entry.id, index); respondWebAlert(entry.id, index);
    expect(proceed).toHaveBeenCalledTimes(index === 1 ? 1 : 0);
    expect(cancel).toHaveBeenCalledTimes(index === 0 ? 1 : 0);
  });
  it('배경/닫기는 취소일 뿐이며 단일 알림의 확인 callback을 실행하지 않음', () => {
    const confirm = vi.fn(), dismiss = vi.fn();
    Alert.alert('알림', '내용', [{ text: '확인', onPress: confirm }], { onDismiss: dismiss });
    respondWebAlert(getWebAlert()!.id);
    expect(confirm).not.toHaveBeenCalled(); expect(dismiss).toHaveBeenCalledOnce();
  });
  it('세 버튼과 큐를 보존하고 이전 확인 이벤트는 다음 알림을 실행하지 않음', () => {
    const one = vi.fn(), two = vi.fn(), three = vi.fn();
    Alert.alert('첫째', '', [{ text: '1', onPress: one }, { text: '2', onPress: two }, { text: '3', onPress: three }]);
    const id = getWebAlert()!.id; Alert.alert('둘째');
    respondWebAlert(id, 1); respondWebAlert(id, 2);
    expect(two).toHaveBeenCalledOnce(); expect(one).not.toHaveBeenCalled(); expect(three).not.toHaveBeenCalled();
    expect(getWebAlert()!.title).toBe('둘째'); expect(getWebAlert()!.buttons).toEqual([{ text: '확인' }]);
  });
  it('구독 해제와 중복 설치', () => {
    const fn = vi.fn(), unsubscribe = subscribeWebAlert(fn);
    const once = Alert.alert; installWebAlert(); expect(Alert.alert).toBe(once);
    Alert.alert('오류'); expect(fn).toHaveBeenCalledOnce();
    unsubscribe(); respondWebAlert(getWebAlert()!.id); expect(fn).toHaveBeenCalledOnce();
  });
});
