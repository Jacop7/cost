/** Expo 웹에서는 네이티브 제공자 SDK를 로드하지 않는다. */
import type { SocialAvailability, SocialCredentialResult, SocialProvider } from './socialAuthTypes';

export async function socialAvailability(): Promise<SocialAvailability> {
  return { google: false, apple: false };
}

export async function acquireSocialCredential(_provider: SocialProvider): Promise<SocialCredentialResult> {
  throw new Error('이 기기에서는 소셜 로그인을 사용할 수 없어요.');
}

export function watchAppleCredential(
  _current: () => Promise<{ ownerId: string; appleUserId: string; sessionGeneration: number } | null>,
  _onRevoked: (identity: { ownerId: string; sessionGeneration: number }) => void,
): { check: () => Promise<void>; stop: () => void } {
  return { check: async () => undefined, stop: () => undefined };
}
