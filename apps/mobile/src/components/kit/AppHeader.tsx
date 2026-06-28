/**
 * AppHeader — kit.jsx 헤더 이식. 프로토타입의 paddingTop:50(노치) 은
 * RN useSafeAreaInsets().top 으로 대체. (대형 타이틀이 필요한 리스트는 자체 헤더 사용)
 */
import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { T } from '@/theme/tokens';

export function AppHeader({ title, onBack, right, bg = T.bg }: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  bg?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingLeft: 4, paddingRight: 8 }}>
        {onBack ? (
          <Pressable onPress={onBack} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" size={26} color={T.ink} sw={2.1} />
          </Pressable>
        ) : (
          <View style={{ width: 12 }} />
        )}
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: T.ink, letterSpacing: -0.3 }}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 6 }}>{right}</View>
      </View>
    </View>
  );
}
