import { createContext, type ReactNode, useContext } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

/**
 * 현재 탭바의 실제 높이를 관측해 중첩 Stack 아래로 전달한다.
 * 일반-flow 탭바에서는 스크롤 끝 여백 계산에 이 값을 더하지 않는다. absolute/overlay로
 * 계약이 바뀌는 날에만 소비자가 이 값을 사용한다(결정 7-2). 이 Provider는 Tabs 아래의
 * nested Stack 전용이다. Tabs 밖의 단독 렌더에서는 useBottomTabBarHeight를 호출하지 않는다.
 */
const ObservedTabBarHeightContext = createContext(0);

export function ObservedTabBarHeightProvider({ children }: { children: ReactNode }) {
  const height = useBottomTabBarHeight();
  return <ObservedTabBarHeightContext.Provider value={height}>{children}</ObservedTabBarHeightContext.Provider>;
}

export const useObservedTabBarHeight = () => useContext(ObservedTabBarHeightContext);
