import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';
import { resolvePendingOrderInbound, submitOrderInbound } from '@/features/orders/orderInboundOperation';
const native = vi.hoisted(() => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn() }));
vi.mock('expo-secure-store', () => native);
const scope = { actorId: 'actor', storeId: 'store', orderId: 'order' };
const originalOS = Platform.OS;
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
afterEach(() => { Platform.OS = originalOS; });

it.each(['recorded', 'not_recorded'] as const)('응답 유실 후 %s 확인은 수량을 재전송하지 않고 다음 명시적 입고를 분리한다', async status => {
  const execute = vi.fn(async () => { expect(localStorage.length).toBe(1); throw Error('lost'); });
  const resolve = vi.fn(async () => status);
  await expect(submitOrderInbound(scope, 'old', execute, resolve)).rejects.toThrow('lost');
  expect(JSON.parse(localStorage.getItem(localStorage.key(0)!)!)).toEqual({ version: 1, scope, key: 'old' });
  const newInput = vi.fn(async () => ({ quantity: 2 }));
  await expect(submitOrderInbound(scope, 'new', newInput, resolve)).resolves.toEqual({ resolved: status });
  expect(newInput).not.toHaveBeenCalled(); expect(resolve).toHaveBeenCalledWith('old');
  await expect(submitOrderInbound(scope, 'confirmed-new', newInput, resolve)).resolves.toEqual({ quantity: 2 });
  expect(newInput).toHaveBeenCalledOnce(); expect(localStorage.length).toBe(0);
});
it('재열기 조회 실패는 키를 보존하고 다음 입력도 실행하지 않는다', async () => {
  const execute = vi.fn(async () => { throw Error('lost'); });
  const resolve = vi.fn(async () => { throw Error('lookup'); });
  await expect(submitOrderInbound(scope, 'old', execute, resolve)).rejects.toThrow();
  await expect(resolvePendingOrderInbound(scope, resolve)).rejects.toThrow('lookup');
  await expect(submitOrderInbound(scope, 'changed', execute, resolve)).rejects.toThrow('lookup');
  expect(execute).toHaveBeenCalledOnce(); expect(localStorage.length).toBe(1);
});
it('키 없는 재열기는 서버에 요청하지 않는다', async () => {
  const resolve = vi.fn(async () => 'recorded' as const);
  await expect(resolvePendingOrderInbound(scope, resolve)).resolves.toBeNull(); expect(resolve).not.toHaveBeenCalled();
});
it.each(['actorId', 'storeId', 'orderId'] as const)('%s가 다른 입고는 대기 요청과 격리한다', async field => {
  const resolve = vi.fn(async () => 'recorded' as const);
  await expect(submitOrderInbound(scope, 'old', async () => { throw Error('lost'); }, resolve)).rejects.toThrow();
  await expect(submitOrderInbound({ ...scope, [field]: 'other' }, 'new', async () => true, resolve)).resolves.toBe(true);
  expect(resolve).not.toHaveBeenCalled(); expect(localStorage.length).toBe(1);
});
it('명시적 서버 거절은 키를 정리하지만 일반 오류는 보존한다', async () => {
  await expect(submitOrderInbound(scope, 'key', async () => { throw Object.assign(Error('conflict'), { orderInboundRejected: true }); }, async () => 'recorded')).rejects.toThrow();
  expect(localStorage.length).toBe(0);
  await expect(submitOrderInbound(scope, 'key2', async () => { throw Error('unknown'); }, async () => 'recorded')).rejects.toThrow();
  expect(localStorage.length).toBe(1);
});
it('저장 실패는 E1 전송 전에 멈춘다', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
  const execute = vi.fn(async () => true);
  await expect(submitOrderInbound(scope, 'key', execute, async () => 'recorded')).rejects.toThrow('quota'); expect(execute).not.toHaveBeenCalled();
});
it('손상된 저널은 확인 없이 덮거나 전송하지 않는다', async () => {
  await expect(submitOrderInbound(scope, 'old', async () => { throw Error('lost'); }, async () => 'recorded')).rejects.toThrow();
  localStorage.setItem(localStorage.key(0)!, '{invalid');
  const execute = vi.fn(async () => true); const resolve = vi.fn(async () => 'recorded' as const);
  await expect(submitOrderInbound(scope, 'new', execute, resolve)).rejects.toThrow();
  expect(execute).not.toHaveBeenCalled(); expect(resolve).not.toHaveBeenCalled(); expect(localStorage.length).toBe(1);
});
it('지연 중인 입고와 동시에 새 입고를 실행하지 않는다', async () => {
  let release!: () => void;
  const pending = submitOrderInbound(scope, 'old', () => new Promise<void>(resolve => { release = resolve; }), async () => 'recorded');
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  const execute = vi.fn(async () => true);
  await expect(submitOrderInbound(scope, 'new', execute, async () => 'recorded')).rejects.toThrow('확인하고');
  release(); await pending; expect(execute).not.toHaveBeenCalled();
});
it('네이티브 저장소도 수량 없이 키만 보존·확인한다', async () => {
  Platform.OS = 'ios'; let saved: string | null = null;
  native.getItemAsync.mockImplementation(async () => saved);
  native.setItemAsync.mockImplementation(async (_key, value) => { saved = value; });
  native.deleteItemAsync.mockImplementation(async () => { saved = null; });
  await expect(submitOrderInbound(scope, 'native', async () => { expect(saved).not.toBeNull(); throw Error('lost'); }, async () => 'recorded')).rejects.toThrow();
  await expect(resolvePendingOrderInbound(scope, async () => 'recorded')).resolves.toEqual({ resolved: 'recorded' });
  expect(saved).toBeNull();
});
