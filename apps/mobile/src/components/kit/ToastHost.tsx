import { useEffect, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dismissToast, getToast, subscribeToast } from '@/lib/toast';
import { T, TYPE, radius, space } from '@/theme/tokens';

/** 화면 전환 뒤에도 유지되는 앱 공용 성공 안내. 저장 결과를 스스로 만들지 않는다. */
export function ToastHost() {
  const toast = useSyncExternalStore(subscribeToast, getToast, () => null);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => dismissToast(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast]);
  if (!toast) return null;
  return <View pointerEvents="none" style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: 80 + insets.bottom, alignItems: 'center', zIndex: 1000 }}>
    <View style={{ backgroundColor: T.ink, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, maxWidth: '100%' }}>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ ...TYPE.caption, color: T.onColor, textAlign: 'center' }}>{toast.message}</Text>
    </View>
  </View>;
}
