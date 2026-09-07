import { Stack } from 'expo-router';
import { ObservedTabBarHeightProvider } from '@/components/layout/TabBarMetrics';

/** 매출관리 탭 스택 (SALES-01 홈 → 분석·일 손익 상세). */
export default function SalesStack() {
  return <ObservedTabBarHeightProvider><Stack screenOptions={{ headerShown: false }} /></ObservedTabBarHeightProvider>;
}
