import { Stack } from 'expo-router';

/** 마이페이지 탭 스택 (MY-01 홈 → MY-02 고정지출 등). */
export default function MyStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
