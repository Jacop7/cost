import { beforeEach, expect, it, vi } from 'vitest';
import { clearInboundIntent, keepInboundIntent, readInboundIntent, withInboundIntentLock,
  type InboundIntent } from '@/features/ingredients/inboundIntentStorage';

const m = vi.hoisted(() => ({ platform: 'web', native: new Map<string, string>(), write: vi.fn(), remove: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { get OS() { return m.platform; } } }));
vi.mock('expo-secure-store', () => ({ getItemAsync: async (key: string) => m.native.get(key) ?? null,
  setItemAsync: m.write, deleteItemAsync: m.remove }));
const scope = { actorId: 'actor-a', storeId: 'store-a', ingredientId: 'ingredient-a' };
const original = (): InboundIntent => ({ version: 1, scope: { ...scope }, payload: {
  ingredientId: scope.ingredientId, volume: 1000, amount: 4000, qty: 1, vendorId: 'vendor-a',
  occurredAt: '2030-07-15', idempotencyKey: 'qi-original',
} });
beforeEach(() => {
  m.platform = 'web'; localStorage.clear(); m.native.clear(); m.write.mockReset(); m.remove.mockReset();
  m.write.mockImplementation(async (key: string, value: string) => {
    expect(new TextEncoder().encode(value).length).toBeLessThan(2048); m.native.set(key, value);
  });
  m.remove.mockImplementation(async (key: string) => { m.native.delete(key); });
});

it.each(['web', 'ios'])('%s: 새 모듈 인스턴스에서도 정확한 원 요청/날짜를 복원한다', async platform => {
  m.platform = platform; const intent = original(); await keepInboundIntent(intent);
  vi.resetModules();
  const restarted = await import('@/features/ingredients/inboundIntentStorage');
  expect(await restarted.readInboundIntent(scope)).toEqual(intent);
  const restored = (await restarted.readInboundIntent(scope))!;
  expect(Object.isFrozen(restored.payload)).toBe(true);
  await restarted.clearInboundIntent(restored); expect(await restarted.readInboundIntent(scope)).toBeNull();
});
it.each(['actorId', 'storeId', 'ingredientId'] as const)('%s 범위는 다른 미확인 입고를 읽거나 지우지 않는다', async field => {
  const intent = original(); await keepInboundIntent(intent);
  const other = { ...scope, [field]: 'other' };
  expect(await readInboundIntent(other)).toBeNull();
  await expect(clearInboundIntent({ ...intent, scope: other })).rejects.toThrow();
  expect(await readInboundIntent(scope)).toEqual(intent);
});
it('확인 전 K2나 수정 payload로 덮어쓰거나 다른 K2의 성공으로 삭제할 수 없다', async () => {
  const intent = original(); await keepInboundIntent(intent);
  for (const payload of [{ ...intent.payload, idempotencyKey: 'qi-new' }, { ...intent.payload, amount: 9000 }]) {
    await expect(keepInboundIntent({ ...intent, payload })).rejects.toThrow();
    await expect(clearInboundIntent({ ...intent, payload })).rejects.toThrow();
    expect(await readInboundIntent(scope)).toEqual(intent);
  }
});
it.each(['web', 'ios'])('%s: 쓰기 실패 및 확인정보 삭제 실패는 성공으로 처리하지 않는다', async platform => {
  m.platform = platform;
  const writer = platform === 'web' ? vi.spyOn(Storage.prototype, 'setItem') : m.write;
  writer.mockImplementation(() => { throw new Error('storage unavailable'); });
  await expect(keepInboundIntent(original())).rejects.toThrow('storage unavailable');
  expect(await readInboundIntent(scope)).toBeNull();
  if (platform === 'web') writer.mockRestore(); else m.write.mockImplementation(async (key: string, value: string) => { m.native.set(key, value); });
  await keepInboundIntent(original());
  const remover = platform === 'web' ? vi.spyOn(Storage.prototype, 'removeItem') : m.remove;
  remover.mockImplementation(() => { throw new Error('cannot clear'); });
  await expect(clearInboundIntent(original())).rejects.toThrow('cannot clear');
  expect(await readInboundIntent(scope)).toEqual(original());
});
it('손상·범위 변조·유효하지 않은 원 payload를 자동 제거하거나 새 요청으로 바꾸지 않는다', async () => {
  await keepInboundIntent(original()); const key = localStorage.key(0)!;
  for (const raw of ['{broken', JSON.stringify({ ...original(), scope: { ...scope, actorId: 'other' } }),
    JSON.stringify({ ...original(), payload: { ...original().payload, occurredAt: '2030-02-30' } }),
    JSON.stringify({ ...original(), payload: { ...original().payload, volume: null } })]) {
    localStorage.setItem(key, raw);
    await expect(readInboundIntent(scope)).rejects.toThrow();
    await expect(keepInboundIntent(original())).rejects.toThrow();
    expect(localStorage.getItem(key)).toBe(raw);
  }
});
it('동일 범위는 비동기 저장 확인 동안 잠기고 실패 뒤 잠금이 풀린다', async () => {
  let release!: () => void;
  const first = withInboundIntentLock(scope, () => new Promise<void>(resolve => { release = resolve; }));
  await expect(withInboundIntentLock(scope, async () => {})).rejects.toThrow('이전 입고');
  await withInboundIntentLock({ ...scope, ingredientId: 'other' }, async () => {});
  release(); await first;
  await expect(withInboundIntentLock(scope, async () => { throw new Error('network failure'); })).rejects.toThrow('network failure');
  await withInboundIntentLock(scope, async () => {});
});
