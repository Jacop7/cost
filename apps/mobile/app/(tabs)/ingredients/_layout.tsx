import { Stack } from 'expo-router';

/** 식재료 탭 스택 (ING-01 리스트 → ING-02 상세 등). 화면이 자체 헤더를 그리므로 헤더 숨김. */
export default function IngredientsStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
