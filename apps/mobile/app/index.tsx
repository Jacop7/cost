import { Redirect } from 'expo-router';

/** 루트 진입 → 첫 탭(식재료)로 리다이렉트. */
export default function Index() {
  return <Redirect href="/ingredients" />;
}
