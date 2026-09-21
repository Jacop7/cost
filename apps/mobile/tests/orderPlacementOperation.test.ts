import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';
import {
  resolvePendingOrderPlacement,
  submitOrderPlacement,
} from '@/features/orders/orderPlacementOperation';

const native = vi.hoisted(() => ({
  getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn(),
}));
vi.mock('expo-secure-store', () => native);
const scope = { actorId: 'actor', storeId: 'store' };
const originalOS = Platform.OS;

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
afterEach(() => { Platform.OS = originalOS; });

it.each(['recorded', 'not_recorded'] as const)(
  '응답 유실 후 %s 확인은 새 발주를 보내지 않고 이전 요청만 판정한다', async status => {
    const execute = vi.fn(async () => { expect(localStorage.length).toBe(1); throw Error('lost'); });
    const resolve = vi.fn(async () => ({ resolved: status, orderIds: status === 'recorded' ? ['order-1'] : [] }));
    await expect(submitOrderPlacement(scope, 'old-key', execute, resolve)).rejects.toThrow('lost');
    expect(JSON.parse(localStorage.getItem(localStorage.key(0)!)!)).toEqual({ version: 1, scope, key: 'old-key' });
    const newRequest = vi.fn(async () => ['order-2']);
    await expect(submitOrderPlacement(scope, 'new-key', newRequest, resolve)).resolves.toEqual({
      resolved: status, orderIds: status === 'recorded' ? ['order-1'] : [],
    });
    expect(newRequest).not.toHaveBeenCalled();
    expect(resolve).toHaveBeenCalledWith('old-key');
    expect(localStorage.length).toBe(0);
    await expect(submitOrderPlacement(scope, 'confirmed-new', newRequest, resolve)).resolves.toEqual(['order-2']);
    expect(newRequest).toHaveBeenCalledOnce();
  },
);

it('명시적 서버 거절은 저널을 지우고 불명확한 오류는 보존한다', async () => {
  await expect(submitOrderPlacement(scope, 'rejected', async () => {
    throw Object.assign(Error('invalid'), { orderPlacementRejected: true });
  }, async () => ({ resolved: 'not_recorded', orderIds: [] }))).rejects.toThrow('invalid');
  expect(localStorage.length).toBe(0);
  await expect(submitOrderPlacement(scope, 'unknown', async () => { throw Error('offline'); },
    async () => ({ resolved: 'not_recorded', orderIds: [] }))).rejects.toThrow('offline');
  expect(localStorage.length).toBe(1);
});

it('재열기 조회 실패는 키를 보존하며 새 발주를 보내지 않는다', async () => {
  await expect(submitOrderPlacement(scope, 'old-key', async () => { throw Error('lost'); },
    async () => ({ resolved: 'recorded', orderIds: ['order-1'] }))).rejects.toThrow('lost');
  const execute = vi.fn(async () => ['order-2']);
  await expect(submitOrderPlacement(scope, 'new-key', execute, async () => { throw Error('lookup'); }))
    .rejects.toThrow('lookup');
  expect(execute).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(1);
});

it('손상된 저널은 덮어쓰거나 서버에 보내지 않는다', async () => {
  localStorage.setItem('order.placement.v1.61.73', '{invalid');
  // 실제 scope slot을 먼저 만든 뒤 그 값만 손상시킨다.
  await expect(submitOrderPlacement(scope, 'seed', async () => { throw Error('lost'); },
    async () => ({ resolved: 'recorded', orderIds: ['order-1'] }))).rejects.toThrow('lost');
  const key = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .find(candidate => candidate?.startsWith('order.placement.v1.') && candidate !== 'order.placement.v1.61.73')!;
  localStorage.setItem(key, '{invalid');
  const execute = vi.fn(async () => ['order-2']);
  const resolve = vi.fn(async () => ({ resolved: 'recorded' as const, orderIds: ['order-1'] }));
  await expect(submitOrderPlacement(scope, 'new-key', execute, resolve)).rejects.toThrow('읽지 못했어요');
  expect(execute).not.toHaveBeenCalled();
  expect(resolve).not.toHaveBeenCalled();
});

it('네이티브 저장소에서도 키만 보존하고 결과 확인 뒤 정리한다', async () => {
  Platform.OS = 'ios';
  let saved: string | null = null;
  native.getItemAsync.mockImplementation(async () => saved);
  native.setItemAsync.mockImplementation(async (_key, value) => { saved = value; });
  native.deleteItemAsync.mockImplementation(async () => { saved = null; });
  await expect(submitOrderPlacement(scope, 'native-key', async () => { throw Error('lost'); },
    async () => ({ resolved: 'recorded', orderIds: ['order-1'] }))).rejects.toThrow('lost');
  await expect(resolvePendingOrderPlacement(scope,
    async () => ({ resolved: 'recorded', orderIds: ['order-1'] }))).resolves.toEqual({
      resolved: 'recorded', orderIds: ['order-1'],
    });
  expect(saved).toBeNull();
});
