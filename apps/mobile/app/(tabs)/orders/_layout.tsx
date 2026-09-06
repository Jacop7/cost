import { Stack } from 'expo-router';
import { ObservedTabBarHeightProvider } from '@/components/layout/TabBarMetrics';

/** 발주 탭 스택 (ORD-01 홈 → ORD-02 등록 등). */
export default function OrdersStack() {
  return <ObservedTabBarHeightProvider><Stack screenOptions={{ headerShown: false }} /></ObservedTabBarHeightProvider>;
}
