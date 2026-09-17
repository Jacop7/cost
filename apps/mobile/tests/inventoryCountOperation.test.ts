import { beforeEach, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';
import {
  clearInventoryCountIntent,
  discardUnreadableInventoryCountIntent,
  keepInventoryCountIntent,
  readInventoryCountIntent,
  type InventoryCountIntent,
} from '@/features/sales/inventoryCountOperation';

vi.mock('expo-secure-store', () => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn() }));
const scope = { actorId: 'actor-a', storeId: 'store-a' };
const intent: InventoryCountIntent = {
  version: 1, scope,
  sessionId: '11111111-1111-4111-8111-111111111111',
  requestKey: '22222222-2222-4222-8222-222222222222',
  targetIds: ['33333333-3333-4333-8333-333333333333'],
  counts: { '33333333-3333-4333-8333-333333333333': '12.5' },
  prepared: false,
};

beforeEach(() => { Platform.OS = 'web'; localStorage.clear(); });

it('실사 세션·수량·요청 키를 함께 복구하고 완료 준비 상태를 보존한다', async () => {
  await keepInventoryCountIntent(intent);
  await expect(readInventoryCountIntent(scope)).resolves.toEqual(intent);
  await keepInventoryCountIntent({ ...intent, prepared: true });
  await expect(readInventoryCountIntent(scope)).resolves.toMatchObject({ prepared: true, requestKey: intent.requestKey });
  await clearInventoryCountIntent(scope, intent.sessionId);
  await expect(readInventoryCountIntent(scope)).resolves.toBeNull();
});

it('다른 세션은 진행 중인 실사 기록을 지우지 못한다', async () => {
  await keepInventoryCountIntent(intent);
  await expect(clearInventoryCountIntent(scope, '99999999-9999-4999-8999-999999999999')).rejects.toThrow('다른 재고 실사');
  await expect(readInventoryCountIntent(scope)).resolves.toEqual(intent);
});

it('손상 포인터는 명시적 격리 뒤 새 서버 세션 복구를 허용한다', async () => {
  await keepInventoryCountIntent(intent);
  const key = localStorage.key(0)!;
  localStorage.setItem(key, '{broken');
  await expect(readInventoryCountIntent(scope)).rejects.toThrow();
  await discardUnreadableInventoryCountIntent(scope);
  await expect(readInventoryCountIntent(scope)).resolves.toBeNull();
});
