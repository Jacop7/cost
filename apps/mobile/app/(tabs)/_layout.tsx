import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '@/components/kit/Icon';
import { T } from '@/theme/tokens';

/**
 * 하단 네비게이션 5탭 — 프로토타입 kit.jsx TabBar 순서: 식재료·레시피·발주·매출관리·MY.
 * 콤팩트 고정 높이(캐치테이블 스타일). 웹은 안전영역 패딩을 넣지 않아 브라우저 하단바에 잘리지 않음.
 */
const tabIcon =
  (name: IconName) =>
  ({ color, focused }: { color: string; focused: boolean }) =>
    <Icon name={name} size={24} color={color} fill={focused} sw={1.8} />;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // 웹: 하단 패딩 0으로 라벨 공간 확보(패딩을 키우면 라벨이 숨겨짐). 총 높이 60.
  const bottomPad = Platform.OS === 'web' ? 0 : insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: T.blue,
        tabBarInactiveTintColor: '#B0B8C1',
        tabBarLabelStyle: { fontSize: 12.5, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: T.line2,
          borderTopWidth: 1,
          height: 60 + bottomPad,
          paddingTop: 2,
          paddingBottom: bottomPad,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="ingredients" options={{ title: '식재료', tabBarIcon: tabIcon('box') }} />
      <Tabs.Screen name="recipes" options={{ title: '레시피', tabBarIcon: tabIcon('receipt') }} />
      <Tabs.Screen name="orders" options={{ title: '발주', tabBarIcon: tabIcon('clipboard') }} />
      <Tabs.Screen name="sales" options={{ title: '매출관리', tabBarIcon: tabIcon('bars') }} />
      <Tabs.Screen name="my" options={{ title: 'MY', tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}
