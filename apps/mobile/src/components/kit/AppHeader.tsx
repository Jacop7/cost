/**
 * AppHeader — kit.jsx 헤더 이식. 프로토타입의 paddingTop:50(노치) 은
 * RN useSafeAreaInsets().top 으로 대체. large=대형 타이틀(리스트 상단).
 */
import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { T } from '@/theme/tokens';

export function AppHeader({ title, large, onBack, right, sub, bg = T.bg }: {
  title: string;
  large?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  sub?: string;
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
        {!large ? <Text style={{ flex: 1, fontSize: 19, fontWeight: '700', color: T.ink, letterSpacing: -0.3 }}>{title}</Text> : <View style={{ flex: 1 }} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 6 }}>{right}</View>
      </View>
      {large ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 12 }}>
          <Text style={{ fontSize: 27, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }}>{title}</Text>
          {sub ? <Text style={{ marginTop: 4, fontSize: 14.5, color: T.sub2, fontWeight: '500' }}>{sub}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
