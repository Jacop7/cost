import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireSocialCredential } from '@/lib/socialAuth';
import { linkSocialIdentity, signInWithSocial } from '@/lib/socialAuthService';

vi.mock('@/lib/socialAuth', () => ({ acquireSocialCredential: vi.fn() }));

const credential = { type: 'success' as const, credential: {
  provider: 'google' as const, token: 'id-token', nonce: 'original-nonce',
} };

function authClient() {
  return {
    signInWithIdToken: vi.fn().mockResolvedValue({ data: { user: { id: 'existing-owner' } }, error: null }),
    linkIdentity: vi.fn().mockResolvedValue({ error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'existing-owner' } }, error: null }),
  };
}

describe('소셜 인증과 기존 매장 소유자 연결', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(acquireSocialCredential).mockResolvedValue(credential);
  });

  it('사용자 취소는 새 Supabase 로그인이나 identity 연결을 시작하지 않는다', async () => {
    vi.mocked(acquireSocialCredential).mockResolvedValue({ type: 'cancelled' });
    const auth = authClient();
    expect(await signInWithSocial(auth as never, 'google')).toBeNull();
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
    expect(await linkSocialIdentity(auth as never, 'google')).toBeNull();
    expect(auth.linkIdentity).not.toHaveBeenCalled();
  });

  it('제공자 ID 토큰과 원문 nonce를 Supabase에 넘기고 서버 세션 판정을 기다린다', async () => {
    const auth = authClient();
    expect(await signInWithSocial(auth as never, 'google')).toBeNull();
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google', token: 'id-token', nonce: 'original-nonce', access_token: undefined,
    });
  });

  it('기존 계정 연결은 전후 Auth 사용자 ID가 같을 때만 성공한다', async () => {
    const auth = authClient();
    expect(await linkSocialIdentity(auth as never, 'google')).toBeNull();
    expect(auth.linkIdentity).toHaveBeenCalledWith({
      provider: 'google', token: 'id-token', nonce: 'original-nonce', access_token: undefined,
    });
    expect(auth.getUser).toHaveBeenCalledTimes(3);
  });

  it('제공자 응답 전에 사용자 ID가 바뀌면 다른 계정에 연결하지 않는다', async () => {
    const auth = authClient();
    auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'existing-owner' } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'other-owner' } }, error: null });
    expect(await linkSocialIdentity(auth as never, 'apple')).toContain('로그인 계정이 바뀌었어요');
    expect(auth.linkIdentity).not.toHaveBeenCalled();
  });

  it('같은 ID로 다시 로그인해도 세션 세대가 바뀌면 연결하지 않는다', async () => {
    const auth = authClient();
    let release!: (value: typeof credential) => void;
    vi.mocked(acquireSocialCredential).mockReturnValue(new Promise((resolve) => { release = resolve; }));
    let current = true;
    const linking = linkSocialIdentity(auth as never, 'google', () => current);
    await vi.waitFor(() => expect(auth.getUser).toHaveBeenCalledOnce());
    current = false;
    release(credential);
    expect(await linking).toContain('로그인 계정이 바뀌었어요');
    expect(auth.linkIdentity).not.toHaveBeenCalled();
  });

  it('이미 다른 계정에 연결된 identity는 현재 세션을 덮어쓰지 않는다', async () => {
    const auth = authClient();
    auth.linkIdentity.mockResolvedValue({ error: new Error('identity already exists') });
    expect(await linkSocialIdentity(auth as never, 'google')).toContain('이미 다른 계정');
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
  });
});
