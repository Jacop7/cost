import { Stack } from 'expo-router';

/** 레시피 탭 스택 (RCP-01 리스트 → RCP-02 상세 등). */
export default function RecipesStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
