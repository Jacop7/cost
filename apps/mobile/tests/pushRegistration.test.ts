import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  secureGet: vi.fn(), secureSet: vi.fn(), rpc: vi.fn(), getPermissions: vi.fn(), requestPermissions: vi.fn(),
  getToken: vi.fn(), setChannel: vi.fn(), randomUUID: vi.fn(),
}));

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-device', () => ({ isDevice: true }));
vi.mock('expo-constants', () => ({ default: {
  easConfig: { projectId: 'project-1' }, expoConfig: { version: '0.2.0', extra: {} },
} }));
vi.mock('expo-crypto', () => ({ randomUUID: m.randomUUID }));
vi.mock('expo-secure-store', () => ({ getItemAsync: m.secureGet, setItemAsync: m.secureSet }));
vi.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 }, getPermissionsAsync: m.getPermissions,
  requestPermissionsAsync: m.requestPermissions, getExpoPushTokenAsync: m.getToken,
  setNotificationChannelAsync: m.setChannel,
}));
vi.mock('@/lib/supabase', () => ({
  rpcError: (e: { message?: string }) => new Error(e.message ?? 'rpc error'),
  supabase: { rpc: m.rpc },
}));

import {
  deactivateCurrentPushDevice,
  enablePushDevice,
  getOrCreateInstallationId,
  synchronizePushDevice,
} from '@/features/notifications/pushRegistration';

beforeEach(() => {
  vi.clearAllMocks();
  m.randomUUID.mockReturnValue('11111111-1111-4111-8111-111111111111');
  m.secureGet.mockResolvedValue(null);
  m.secureSet.mockResolvedValue(undefined);
  m.getPermissions.mockResolvedValue({ granted: true, status: 'granted' });
  m.requestPermissions.mockResolvedValue({ granted: true, status: 'granted' });
  m.getToken.mockResolvedValue({ data: 'ExponentPushToken[abcdefghijklmnopqrstuvwxyz123456]' });
  m.setChannel.mockResolvedValue(null);
  m.rpc.mockResolvedValue({ data: { registered: true, active: true, fingerprint_suffix: 'abcdef123456' }, error: null });
});

describe('푸시 기기 등록', () => {
  it('설치 ID를 SecureStore에 한 번 만들고 다시 사용한다', async () => {
    expect(await getOrCreateInstallationId()).toBe('11111111-1111-4111-8111-111111111111');
    expect(m.secureSet).toHaveBeenCalledWith('costkeep.push.installation-id.v1', '11111111-1111-4111-8111-111111111111');
    m.secureGet.mockResolvedValue('saved-installation');
    expect(await getOrCreateInstallationId()).toBe('saved-installation');
    expect(m.randomUUID).toHaveBeenCalledOnce();
  });

  it('이미 허용된 권한은 팝업 없이 현재 token을 서버에 동기화한다', async () => {
    const state = await synchronizePushDevice('store-1');
    expect(state).toEqual({ kind: 'registered', fingerprintSuffix: 'abcdef123456' });
    expect(m.requestPermissions).not.toHaveBeenCalled();
    expect(m.rpc).toHaveBeenCalledWith('register_push_device', {
      p_store: 'store-1', p_installation_id: '11111111-1111-4111-8111-111111111111',
      p_platform: 'android', p_expo_push_token: 'ExponentPushToken[abcdefghijklmnopqrstuvwxyz123456]', p_app_version: '0.2.0',
    });
  });

  it('미결정 권한은 화면 진입만으로 요청하지 않는다', async () => {
    m.getPermissions.mockResolvedValue({ granted: false, status: 'undetermined' });
    expect(await synchronizePushDevice('store-1')).toEqual({ kind: 'undetermined' });
    expect(m.requestPermissions).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it('명시 버튼에서 거절되면 token을 만들거나 등록하지 않는다', async () => {
    m.getPermissions.mockResolvedValue({ granted: false, status: 'undetermined' });
    m.requestPermissions.mockResolvedValue({ granted: false, status: 'denied' });
    expect(await enablePushDevice('store-1')).toEqual({ kind: 'denied' });
    expect(m.getToken).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it('로그아웃 폐기는 현재 설치 ID만 서버에 보낸다', async () => {
    m.secureGet.mockResolvedValue('saved-installation');
    m.rpc.mockResolvedValue({ data: { changed: true, active: false }, error: null });
    await deactivateCurrentPushDevice('store-1');
    expect(m.rpc).toHaveBeenCalledWith('deactivate_push_device', {
      p_store: 'store-1', p_installation_id: 'saved-installation',
    });
  });

  it('서버가 등록 여부를 생략하면 성공으로 위장하지 않는다', async () => {
    m.rpc.mockResolvedValue({ data: { active: true }, error: null });
    await expect(synchronizePushDevice('store-1')).rejects.toThrow('등록 상태 형식');
  });
});
