import { useEffect, useState } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '@/components/kit/Icon';
import { COLOR, COMPONENT, T, TYPE } from '@/theme/tokens';
import { MENU_ITEM_TERM } from '@/lib/productTerms';
import { isTabRootPath } from '@/lib/tabNavigation';
import { useBusinessDay } from '@/features/business-day/businessDay';

/**
 * 하단 네비게이션 5탭 — 프로토타입 kit.jsx TabBar 순서: 식재료·메뉴·발주·매출관리·MY.
 * 콤팩트 고정 높이(캐치테이블 스타일). 웹은 안전영역 패딩을 넣지 않아 브라우저 하단바에 잘리지 않음.
 */
const tabIcon =
  (name: IconName) =>
  ({ color, focused }: { color: string; focused: boolean }) =>
    <Icon name={name} size={24} color={color} fill={focused} sw={1.8} />;

export default function TabsLayout() {
  // Keep current menu settings in sync even when the sales tab has never been opened.
  useBusinessDay();
  const showTabBar = isTabRootPath(usePathname());
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [labelHeight, setLabelHeight] = useState<number>(COMPONENT.tabBar.labelBaseLineHeight);
  // 웹: 하단 패딩 0으로 라벨 공간 확보(패딩을 키우면 라벨이 숨겨짐). 총 높이 60.
  const bottomPad = Platform.OS === 'web' ? 0 : insets.bottom;
  useEffect(() => setLabelHeight(COMPONENT.tabBar.labelBaseLineHeight), [bottomPad, fontScale]);
  const height = COMPONENT.tabBar.baseHeight
    + Math.max(0, labelHeight - COMPONENT.tabBar.labelBaseLineHeight)
    + bottomPad;
  const tabLabel = (label: string) => ({ color }: { color: string }) => (
    <Text
      key={`${label}-${fontScale}`}
      numberOfLines={2}
      maxFontSizeMultiplier={2}
      onLayout={(event) => {
        const measured = Math.ceil(event.nativeEvent.layout.height);
        setLabelHeight((current) => Math.max(current, measured));
      }}
      style={{ color, fontSize: TYPE.captionSm.fontSize, lineHeight: TYPE.captionSm.lineHeight, fontWeight: '700', textAlign: 'center' }}
    >
      {label}
    </Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg, paddingBottom: showTabBar ? 0 : bottomPad }}>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLOR.action.primary,
        // 비활성 탭도 누를 수 있는 행동이므로 disabled 색이 아니라 보조 텍스트 역할을 쓴다.
        tabBarInactiveTintColor: COLOR.text.tertiary,
        tabBarStyle: {
          display: showTabBar ? 'flex' : 'none',
          backgroundColor: '#FFFFFF',
          borderTopColor: T.line2,
          borderTopWidth: showTabBar ? 1 : 0,
          height: showTabBar ? height : 0,
          paddingTop: showTabBar ? 2 : 0,
          paddingBottom: showTabBar ? bottomPad : 0,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="ingredients" options={{ title: '식재료', tabBarLabel: tabLabel('식재료'), tabBarIcon: tabIcon('box') }} />
      <Tabs.Screen name="recipes" options={{ title: MENU_ITEM_TERM.ko, tabBarLabel: tabLabel(MENU_ITEM_TERM.ko), tabBarIcon: tabIcon('receipt') }} />
      <Tabs.Screen name="orders" options={{ title: '발주', tabBarLabel: tabLabel('발주'), tabBarIcon: tabIcon('clipboard') }} />
      <Tabs.Screen name="sales" options={{ title: '매출관리', tabBarLabel: tabLabel('매출관리'), tabBarIcon: tabIcon('bars') }} />
      <Tabs.Screen name="my" options={{ title: 'MY', tabBarLabel: tabLabel('MY'), tabBarIcon: tabIcon('user') }} />
    </Tabs>
    </View>
  );
}
