import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { rpcError, supabase } from '@/lib/supabase';

const INSTALLATION_KEY = 'costkeep.push.installation-id.v1';

export type PushDeviceState =
  | { kind: 'unsupported-web' }
  | { kind: 'simulator' }
  | { kind: 'undetermined' }
  | { kind: 'denied' }
  | { kind: 'granted-unregistered' }
  | { kind: 'registered'; fingerprintSuffix: string | null };

function projectId(): string {
  const fromEas = Constants.easConfig?.projectId;
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const fromExtra = extra?.eas?.projectId;
  const id = typeof fromEas === 'string' && fromEas !== ''
    ? fromEas
    : typeof fromExtra === 'string' && fromExtra !== '' ? fromExtra : null;
  if (id === null) throw new Error('푸시 프로젝트 설정을 확인하지 못했어요.');
  return id;
}

export async function getOrCreateInstallationId(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const saved = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (saved) return saved;
  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(INSTALLATION_KEY, created);
  return created;
}

function parseRegistration(value: unknown): { registered: boolean; fingerprintSuffix: string | null } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('서버가 푸시 등록 상태를 주지 않았어요.');
  }
  const row = value as Record<string, unknown>;
  if (typeof row.registered !== 'boolean') throw new Error('서버 푸시 등록 상태 형식이 달라요.');
  const suffix = row.fingerprint_suffix;
  if (suffix !== undefined && suffix !== null && (typeof suffix !== 'string' || !/^[0-9a-f]{12}$/.test(suffix))) {
    throw new Error('서버 푸시 기기 식별값 형식이 달라요.');
  }
  return { registered: row.registered, fingerprintSuffix: typeof suffix === 'string' ? suffix : null };
}

async function registerGrantedDevice(storeId: string, installationId: string): Promise<PushDeviceState> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return { kind: 'unsupported-web' };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('work-alerts', {
      name: '업무 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const token = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  const version = Constants.expoConfig?.version ?? 'unknown';
  const { data, error } = await supabase.rpc('register_push_device', {
    p_store: storeId,
    p_installation_id: installationId,
    p_platform: Platform.OS,
    p_expo_push_token: token.data,
    p_app_version: version,
  });
  if (error) throw rpcError(error);
  const parsed = parseRegistration(data);
  if (!parsed.registered) throw new Error('이 기기의 푸시 연결이 완료되지 않았어요.');
  return { kind: 'registered', fingerprintSuffix: parsed.fingerprintSuffix };
}

/** 화면 진입 시 권한 팝업은 띄우지 않는다. 이미 허용된 기기만 token 회전을 동기화한다. */
export async function synchronizePushDevice(storeId: string): Promise<PushDeviceState> {
  if (Platform.OS === 'web') return { kind: 'unsupported-web' };
  if (!Device.isDevice) return { kind: 'simulator' };
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return { kind: permission.status === 'undetermined' ? 'undetermined' : 'denied' };
  const installationId = await getOrCreateInstallationId();
  if (installationId === null) return { kind: 'unsupported-web' };
  return registerGrantedDevice(storeId, installationId);
}

/** 사용자의 명시적 버튼에서만 OS 권한을 요청한다. */
export async function enablePushDevice(storeId: string): Promise<PushDeviceState> {
  if (Platform.OS === 'web') return { kind: 'unsupported-web' };
  if (!Device.isDevice) return { kind: 'simulator' };
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return { kind: 'denied' };
  const installationId = await getOrCreateInstallationId();
  if (installationId === null) return { kind: 'unsupported-web' };
  return registerGrantedDevice(storeId, installationId);
}

/** 로그아웃 전에 현재 설치만 폐기한다. 다른 기기의 등록은 유지한다. */
export async function deactivateCurrentPushDevice(storeId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const installationId = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (!installationId) return;
  const { error } = await supabase.rpc('deactivate_push_device', {
    p_store: storeId,
    p_installation_id: installationId,
  });
  if (error) throw rpcError(error);
}
