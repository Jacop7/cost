import * as SecureStore from 'expo-secure-store';
import type { SocialProvider } from './socialAuthTypes';

const KEY = 'costkeep_auth_method_v1';
type Marker = { ownerId: string; provider: SocialProvider };

/** 계정 ID와 이 기기 세션의 진입 방식만 기록한다. 토큰·이메일은 기록하지 않는다. */
export async function rememberLoginMethod(ownerId: string, provider: SocialProvider): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify({ ownerId, provider } satisfies Marker));
}

export async function isAppleLoginSession(ownerId: string): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return false;
    const marker = JSON.parse(raw) as Partial<Marker>;
    return marker.ownerId === ownerId && marker.provider === 'apple';
  } catch { return false; }
}

export async function clearLoginMethod(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
