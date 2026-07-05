import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/queryClient';
import { getFontAssets, initTextDirection, patchTextFonts } from '@/theme/fonts';

// 전역 폰트 적용(Text/TextInput 렌더 주입) + 로케일 방향 — 모듈 로드 시 1회.
patchTextFonts();
initTextDirection();

/** 루트 레이아웃 — 폰트 로드 + 쿼리 클라이언트 + 세이프에어리어. 탭은 (tabs) 그룹. */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(getFontAssets());

  // 로드 중에만 잠깐 보류. 실패(에러) 시엔 시스템 폰트로라도 진행 —
  // 폰트 로딩 때문에 앱이 영영 빈 화면이 되는 일을 막는다.
  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
