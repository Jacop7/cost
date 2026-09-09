import { Pressable, View } from 'react-native';
import { COLOR, COMPONENT, T, radius, shadow } from '@/theme/tokens';

/** 알림 설정의 기존 스위치를 공용화. 상태 의미와 저장은 호출 화면이 소유한다. */
export function Toggle({ on, disabled, onPress, label }: {
  on: boolean; disabled?: boolean; onPress: () => void; label: string;
}) {
  const token = COMPONENT.switch;
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="switch" accessibilityLabel={label}
    accessibilityState={{ checked: on, disabled: Boolean(disabled) }} hitSlop={8}
    style={{ width: token.width, height: token.height, borderRadius: radius.full,
      backgroundColor: on ? COLOR.action.primary : token.offTrack, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}>
    <View style={{ position: 'absolute', left: on ? token.width - token.inset - token.thumbSize : token.inset,
      width: token.thumbSize, height: token.thumbSize, borderRadius: radius.full, backgroundColor: T.onColor, ...shadow.switchThumb }} />
  </Pressable>;
}
