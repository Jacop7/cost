import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert } from 'react-native';
import { installWebAlert } from '@/lib/webAlert';

// Browser API responses are mocked, not native/browser dialog pixel evidence.
const patched = Alert as typeof Alert & { __webPatched?: boolean };
const originalAlert = Alert.alert;
describe('공용 웹 Alert 확인/취소 경계', () => {
  beforeEach(() => {
    delete patched.__webPatched; Alert.alert = originalAlert;
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
  });
  afterEach(() => { vi.restoreAllMocks(); delete patched.__webPatched; Alert.alert = originalAlert; });

  it.each([false, true])('취소/진행 선택=%s에서 선택한 callback 하나만 호출한다', (accepted) => {
    vi.mocked(window.confirm).mockReturnValue(accepted);
    const cancel = vi.fn(), proceed = vi.fn();
    installWebAlert();
    Alert.alert('양파 발주 취소', '안내', [
      { text: '닫기', style: 'cancel', onPress: cancel },
      { text: '발주 취소', style: 'destructive', onPress: proceed },
    ]);
    expect(window.confirm).toHaveBeenCalledWith('양파 발주 취소\n\n안내');
    expect(window.alert).not.toHaveBeenCalled();
    expect(proceed).toHaveBeenCalledTimes(accepted ? 1 : 0);
    expect(cancel).toHaveBeenCalledTimes(accepted ? 0 : 1);
  });

  it('단일 확인 알림은 confirm 없이 alert 뒤 확인 callback만 실행한다', () => {
    const confirm = vi.fn(); installWebAlert();
    Alert.alert('입고 단가가 크게 올랐어요', '20% 이상', [{ text: '확인', onPress: confirm }]);
    expect(window.alert).toHaveBeenCalledWith('입고 단가가 크게 올랐어요\n\n20% 이상');
    expect(window.confirm).not.toHaveBeenCalled(); expect(confirm).toHaveBeenCalledOnce();
  });

  it('중복 설치는 함수를 다시 감싸지 않으며 오류 알림에 mutation callback을 만들지 않는다', () => {
    installWebAlert(); const once = Alert.alert; installWebAlert(); expect(Alert.alert).toBe(once);
    Alert.alert('취소하지 못했어요', '시험 오류');
    expect(window.alert).toHaveBeenCalledOnce(); expect(window.confirm).not.toHaveBeenCalled();
  });
});
