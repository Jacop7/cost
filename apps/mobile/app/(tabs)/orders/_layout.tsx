import { Stack } from 'expo-router';

/** 발주 탭 스택 (ORD-01 홈 → ORD-02 등록 등). */
export default function OrdersStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
