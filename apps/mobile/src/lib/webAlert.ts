/**
 * 웹에서 `Alert.alert()` 을 되살린다.
 *
 * ⚠ `react-native-web` 의 구현은 **빈 함수**다 —
 *       class Alert { static alert() {} }
 *   그래서 확인창이 필요한 버튼이 전부 죽은 것처럼 보인다. 실제로 그랬다 —
 *   사장님: "영업시작 버튼 안눌림". 매출 저장(45001), 발주·입고 취소, 각종 삭제까지
 *   **35곳**이 같은 상태였다.
 *
 * 여기서는 브라우저 기본 대화상자로 되살린다. 앱 디자인과 다르지만
 * **죽어 있는 것보다는 낫다.** 눈에 자주 띄는 자리는 kit 의 `ConfirmSheet` 로
 * 하나씩 옮기고 있고(영업 상태 바·매출 저장), 그때마다 여기 의존이 줄어든다.
 *
 * ⚠ 네이티브(Expo Go)에서는 손대지 않는다. 거기선 원래 잘 뜬다.
 */
import { Alert, Platform } from 'react-native';

type Btn = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

export function installWebAlert(): void {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;
  // 두 번 덮지 않는다 — 개발 중 새로고침으로 모듈이 다시 돌 수 있다.
  if ((Alert as unknown as { __webPatched?: boolean }).__webPatched) return;

  (Alert as unknown as { alert: (t?: string, m?: string, b?: Btn[]) => void }).alert = (
    title?: string,
    message?: string,
    buttons?: Btn[],
  ) => {
    const body = [title, message].filter(Boolean).join('\n\n');
    const list = buttons ?? [];
    const cancel = list.find((b) => b.style === 'cancel');
    // 취소가 아닌 마지막 버튼이 '진행'이다 — RN 관례상 확인이 뒤에 온다.
    const go = [...list].reverse().find((b) => b.style !== 'cancel');

    // 버튼이 없거나 하나뿐이면 알리기만 하면 된다.
    if (list.length <= 1 || !cancel) {
      window.alert(body);
      go?.onPress?.();
      return;
    }
    if (window.confirm(body)) go?.onPress?.();
    else cancel.onPress?.();
  };

  (Alert as unknown as { __webPatched?: boolean }).__webPatched = true;
}
