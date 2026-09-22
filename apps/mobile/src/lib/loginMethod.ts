import type { SocialProvider } from './socialAuthTypes';

/** 웹 미리보기는 네이티브 소셜 세션을 만들지 않는다. */
export async function rememberLoginMethod(_ownerId: string, _provider: SocialProvider): Promise<void> {}
export async function isAppleLoginSession(_ownerId: string): Promise<boolean> { return false; }
export async function clearLoginMethod(): Promise<void> {}
