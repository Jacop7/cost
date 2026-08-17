import { Stack } from 'expo-router';

/** 매출관리 탭 스택 (SALES-01 홈 → 분석·일 손익 상세). */
export default function SalesStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
