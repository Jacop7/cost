import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { rpcError, supabase } from '@/lib/supabase';

const INSTALLATION_KEY = 'costkeep.push.installation-id.v1';
const PENDING_DEACTIVATION_KEY = 'costkeep.push.pending-deactivation.v1';
let installationIdInFlight: Promise<string | null> | null = null;

export type PushDeviceState =
  | { kind: 'unsupported-web' }
  | { kind: 'simulator' }
  | { kind: 'undetermined' }
  | { kind: 'denied' }
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
  if (installationIdInFlight === null) {
    installationIdInFlight = (async () => {
      const saved = await SecureStore.getItemAsync(INSTALLATION_KEY);
      if (saved) return saved;
      const created = Crypto.randomUUID();
      await SecureStore.setItemAsync(INSTALLATION_KEY, created);
      return created;
    })().finally(() => { installationIdInFlight = null; });
  }
  return installationIdInFlight;
}

async function deactivateInstallation(storeId: string, installationId: string): Promise<void> {
  const { error } = await supabase.rpc('deactivate_push_device', {
    p_store: storeId,
    p_installation_id: installationId,
  });
  if (error) throw rpcError(error);
}

async function retryPendingDeactivation(storeId: string, installationId: string): Promise<void> {
  const pending = await SecureStore.getItemAsync(PENDING_DEACTIVATION_KEY);
  if (pending !== 'pending') return;
  await deactivateInstallation(storeId, installationId);
  await SecureStore.deleteItemAsync(PENDING_DEACTIVATION_KEY);
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
  const installationId = await getOrCreateInstallationId();
  if (installationId === null) return { kind: 'unsupported-web' };
  // 이전 로그아웃이 오프라인이었어도 새 세션의 사용자·매장 권한으로 이 물리 설치를 먼저 끈다.
  await retryPendingDeactivation(storeId, installationId);
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return { kind: permission.status === 'undetermined' ? 'undetermined' : 'denied' };
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
  // 화면의 재조회가 오프라인으로 실패한 뒤 사용자가 다시 켤 수도 있다. 이 경로에서도
  // 이전 로그아웃 보류를 먼저 끝내 stale 표식이 다음 로그인에서 새 등록을 끄지 않게 한다.
  await retryPendingDeactivation(storeId, installationId);
  return registerGrantedDevice(storeId, installationId);
}

/** 로그아웃 전에 현재 설치만 폐기한다. 다른 기기의 등록은 유지한다. */
export async function deactivateCurrentPushDevice(storeId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const installationId = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (!installationId) return;
  await deactivateInstallation(storeId, installationId);
  await SecureStore.deleteItemAsync(PENDING_DEACTIVATION_KEY);
}

/** 폐기 실패는 기록하고 로그아웃은 막지 않는다. 다음 인증 세션에서 먼저 재시도한다. */
export async function preparePushDeviceSignOut(storeId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await deactivateCurrentPushDevice(storeId);
  } catch {
    try {
      await SecureStore.setItemAsync(PENDING_DEACTIVATION_KEY, 'pending');
    } catch {
      // SecureStore 장애까지 로그아웃 차단 사유로 만들지 않는다.
    }
  }
}
