// nav.ts — 안전한 뒤로가기.
// 웹 브라우저는 router.back()이 히스토리에 의존해, 히스토리가 없으면(새로고침·딥링크·스택 첫 화면)
// 아무 동작도 하지 않는다. 그럴 때는 fallback 경로로 replace 해 항상 뒤로가기가 동작하도록 한다.
import { router, type Href } from 'expo-router';

export function safeBack(fallback: Href = '/ingredients' as Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
