import { describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  revokeListener: null as (() => void) | null,
  credentialState: vi.fn(),
}));
vi.mock('react-native', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Platform: { OS: 'ios' },
  AppState: { addEventListener: () => ({ remove: () => undefined }) },
}));
vi.mock('expo-apple-authentication', () => ({
  AppleAuthenticationCredentialState: { AUTHORIZED: 1, REVOKED: 2, NOT_FOUND: 3 },
  getCredentialStateAsync: mock.credentialState,
  addRevokeListener: (listener: () => void) => {
    mock.revokeListener = listener;
    return { remove: () => { mock.revokeListener = null; } };
  },
}));
vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(), digestStringAsync: vi.fn(), CryptoDigestAlgorithm: { SHA256: 'SHA256' } }));
vi.mock('react-native-nitro-google-signin', () => ({ GoogleOneTapSignIn: {}, isCancelledResponse: vi.fn(), isSuccessResponse: vi.fn() }));

import { watchAppleCredential } from '@/lib/socialAuth.native';

describe('Apple 인증 철회 감시', () => {
  it('이전 상태 조회 중 도착한 철회 알림을 버리지 않는다', async () => {
    let resolveState!: (value: number) => void;
    mock.credentialState.mockReset().mockReturnValue(new Promise<number>((resolve) => { resolveState = resolve; }));
    const revoked = vi.fn();
    const watcher = watchAppleCredential(async () => ({ ownerId: 'owner', appleUserId: 'apple-sub', sessionGeneration: 7 }), revoked);
    const first = watcher.check();
    await vi.waitFor(() => expect(mock.credentialState).toHaveBeenCalledOnce());
    mock.revokeListener?.();
    resolveState(1);
    await first;
    await vi.waitFor(() => expect(revoked).toHaveBeenCalledWith({ ownerId: 'owner', appleUserId: 'apple-sub', sessionGeneration: 7 }));
    watcher.stop();
  });
});
