import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ prepare: vi.fn(), signOut: vi.fn() }));

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@/features/notifications/pushRegistration', () => ({ preparePushDeviceSignOut: m.prepare }));
vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { signOut: m.signOut } },
}));

import { signOutCurrentSession } from '@/lib/session';

beforeEach(() => {
  vi.clearAllMocks();
  m.prepare.mockResolvedValue(undefined);
  m.signOut.mockResolvedValue({ error: null });
});

describe('푸시 기기와 로그아웃', () => {
  it('기기 폐기 준비를 먼저 마친 뒤 로컬 로그아웃한다', async () => {
    await expect(signOutCurrentSession('store-1')).resolves.toBeNull();
    expect(m.prepare).toHaveBeenCalledWith('store-1');
    expect(m.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(m.prepare.mock.invocationCallOrder[0]).toBeLessThan(m.signOut.mock.invocationCallOrder[0]!);
  });

  it('기기 폐기 준비 자체가 실패해도 로컬 로그아웃을 계속한다', async () => {
    m.prepare.mockRejectedValue(new Error('secure storage unavailable'));
    await expect(signOutCurrentSession('store-1')).resolves.toBeNull();
    expect(m.signOut).toHaveBeenCalledOnce();
  });
});
