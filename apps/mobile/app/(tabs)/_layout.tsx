import { Tabs } from 'expo-router';
import { Icon, IconName } from '@/components/kit/Icon';
import { T } from '@/theme/tokens';

/**
 * 하단 네비게이션 4탭 — 프로토타입 kit.jsx TabBar 순서: 식재료·레시피·발주·MY.
 * 활성 시 fill 아이콘 + 블루. 라우트 폴더명은 유지하되 표시 순서는 아래 선언 순서로 확정.
 */
const tabIcon =
  (name: IconName) =>
  ({ color, focused }: { color: string; focused: boolean }) =>
    <Icon name={name} size={26} color={color} fill={focused} sw={1.8} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: T.blue,
        tabBarInactiveTintColor: '#B0B8C1',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: { backgroundColor: 'rgba(255,255,255,0.96)', borderTopColor: T.line2 },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="ingredients" options={{ title: '식재료', tabBarIcon: tabIcon('box') }} />
      <Tabs.Screen name="recipes" options={{ title: '레시피', tabBarIcon: tabIcon('receipt') }} />
      <Tabs.Screen name="orders" options={{ title: '발주', tabBarIcon: tabIcon('clipboard') }} />
      <Tabs.Screen name="my" options={{ title: 'MY', tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}
