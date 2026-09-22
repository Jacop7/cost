import { AppState, Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { SocialAvailability, SocialCredentialResult, SocialProvider } from './socialAuthTypes';

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? '';
const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim() ?? '';
// Apple 토큰 철회 서비스와 실기기 탈퇴 시험이 준비되기 전에는 버튼을 열지 않는다.
const appleDeletionReady = process.env.EXPO_PUBLIC_APPLE_ACCOUNT_DELETION_READY === 'true';

// 앱 플러그인과 버튼 노출 조건을 동일하게 유지한다. Android만 값이 채워진
// 개발 빌드에서 네이티브 모듈 없이 버튼이 나타나면 런타임에서 충돌한다.
const googleConfigured = googleWebClientId !== '' && googleIosClientId !== '' && googleIosUrlScheme !== '';

export async function socialAvailability(): Promise<SocialAvailability> {
  const apple = Platform.OS === 'ios' && appleDeletionReady && await AppleAuthentication.isAvailableAsync();
  // iOS에서 Google을 제공하면 Apple도 제공해야 한다.
  return { google: googleConfigured && (Platform.OS !== 'ios' || apple), apple };
}

async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}

export async function acquireSocialCredential(provider: SocialProvider): Promise<SocialCredentialResult> {
  const available = await socialAvailability();
  if (!available[provider]) throw new Error('이 기기에서는 해당 로그인 방식을 아직 사용할 수 없어요.');
  const { raw, hashed } = await makeNonce();

  if (provider === 'google') {
    // Nitro HybridObject는 import 시점에 네이티브 모듈을 찾는다. Expo Go와
    // 설정 전 개발 빌드의 앱 부팅은 유지하고 실제 Google 사용 시에만 로드한다.
    const { GoogleOneTapSignIn, isCancelledResponse, isSuccessResponse } =
      await import('react-native-nitro-google-signin');
    GoogleOneTapSignIn.configure({ webClientId: googleWebClientId, iosClientId: googleIosClientId || undefined, nonce: hashed });
    if (Platform.OS === 'android') await GoogleOneTapSignIn.checkPlayServices();
    const result = await GoogleOneTapSignIn.presentExplicitSignIn();
    if (isCancelledResponse(result)) return { type: 'cancelled' };
    if (!isSuccessResponse(result) || !result.data?.idToken) throw new Error('Google 로그인 정보를 받지 못했어요.');
    return { type: 'success', credential: { provider, token: result.data.idToken, nonce: raw } };
  }

  try {
    const result = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
    if (!result.identityToken || !result.authorizationCode) {
      throw new Error('Apple 로그인 정보를 받지 못했어요.');
    }
    return { type: 'success', credential: {
      provider, token: result.identityToken, nonce: raw, authorizationCode: result.authorizationCode,
    } };
  } catch (error) {
    if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') {
      return { type: 'cancelled' };
    }
    throw error;
  }
}

/** Apple 설정에서 앱 접근을 철회하면 보유한 Supabase 세션도 닫는다. */
export function watchAppleCredential(
  current: () => Promise<{ ownerId: string; appleUserId: string; sessionGeneration: number } | null>,
  onRevoked: (identity: { ownerId: string; sessionGeneration: number }) => void,
): { check: () => Promise<void>; stop: () => void } {
  if (Platform.OS !== 'ios') return { check: async () => undefined, stop: () => undefined };
  let disposed = false;
  let checking = false;
  let pendingRevoke = false;
  const check = async (eventRevoked = false) => {
    if (disposed) return;
    if (checking) {
      if (eventRevoked) pendingRevoke = true;
      return;
    }
    checking = true;
    try {
      const identity = await current();
      if (!identity || disposed) return;
      if (eventRevoked) { onRevoked(identity); return; }
      const state = await AppleAuthentication.getCredentialStateAsync(identity.appleUserId);
      if (!disposed && (state === AppleAuthentication.AppleAuthenticationCredentialState.REVOKED ||
        state === AppleAuthentication.AppleAuthenticationCredentialState.NOT_FOUND)) {
        onRevoked(identity);
      }
    } catch {
      // 일시적 Apple 상태 조회 오류를 계정 철회로 오판해 기존 세션을 끊지 않는다.
    } finally {
      checking = false;
      if (pendingRevoke && !disposed) {
        pendingRevoke = false;
        void check(true);
      }
    }
  };
  const revoke = AppleAuthentication.addRevokeListener(() => { void check(true); });
  const foreground = AppState.addEventListener('change', (state) => {
    if (state === 'active') void check();
  });
  return { check: () => check(), stop: () => { disposed = true; revoke.remove(); foreground.remove(); } };
}
