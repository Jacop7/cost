import { Platform } from 'react-native';

export type OrderInboundScope = { actorId: string; storeId: string; orderId: string };
export type OrderInboundResolution = { resolved: 'recorded' | 'not_recorded' };
type Pending = { version: 1; scope: OrderInboundScope; key: string };
type Resolver = (key: string) => Promise<OrderInboundResolution['resolved']>;
const busy = new Set<string>();
const storageKey = (scope: OrderInboundScope) => 'order.inbound.v1.' + [scope.actorId, scope.storeId, scope.orderId]
  .map(value => Array.from(value).map(c => c.codePointAt(0)!.toString(16)).join('-')).join('.');
const read = async (key: string) => Platform.OS === 'web' ? localStorage.getItem(key) : (await import('expo-secure-store')).getItemAsync(key);
const write = async (key: string, value: string) => {
  if (Platform.OS === 'web') localStorage.setItem(key, value);
  else await (await import('expo-secure-store')).setItemAsync(key, value);
};
const remove = async (key: string) => {
  if (Platform.OS === 'web') localStorage.removeItem(key);
  else await (await import('expo-secure-store')).deleteItemAsync(key);
};
const validText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256;
export const isOrderInboundRejected = (error: unknown) =>
  (error as { orderInboundRejected?: unknown } | null)?.orderInboundRejected === true;

function decode(raw: string, scope: OrderInboundScope): Pending {
  const pending = JSON.parse(raw) as Pending;
  if (!pending || Object.keys(pending).sort().join() !== 'key,scope,version' || pending.version !== 1
    || !pending.scope || Object.keys(pending.scope).sort().join() !== 'actorId,orderId,storeId'
    || pending.scope.actorId !== scope.actorId || pending.scope.storeId !== scope.storeId
    || pending.scope.orderId !== scope.orderId || !validText(pending.key)) throw Error('이전 입고 확인 정보를 읽지 못했어요.');
  return pending;
}

async function run<T>(scope: OrderInboundScope, resolve: Resolver, request?: { key: string; execute: () => Promise<T> }): Promise<T | OrderInboundResolution | null> {
  if (![scope.actorId, scope.storeId, scope.orderId].every(validText) || (request && !validText(request.key)))
    throw Error('입고 처리 대상을 확인해 주세요.');
  const slot = storageKey(scope);
  const action = async () => {
    if (busy.has(slot)) throw Error('이전 입고를 확인하고 있어요. 잠시 기다려 주세요.');
    busy.add(slot);
    try {
      const clearExact = async (expected: string) => {
        const current = await read(slot);
        if (current !== expected) throw Error('다른 입고 확인이 진행 중이에요.');
        await remove(slot);
        if (await read(slot) !== null) throw Error('입고 확인 정보를 정리하지 못했어요.');
      };
      const old = await read(slot);
      if (old !== null) {
        const pending = decode(old, scope);
        const status = await resolve(pending.key);
        if (status !== 'recorded' && status !== 'not_recorded') throw Error('입고 결과를 확인하지 못했어요.');
        await clearExact(old);
        return { resolved: status } satisfies OrderInboundResolution;
      }
      if (!request) return null;
      // Keep only the scoped request identifier. Recovery never replays quantities.
      const encoded = JSON.stringify({ version: 1, scope, key: request.key } satisfies Pending);
      if (encoded.length > 1900) throw Error('입고 확인 정보를 보관할 수 없어요.');
      await write(slot, encoded);
      if (await read(slot) !== encoded) throw Error('입고 확인 정보를 보관하지 못했어요.');
      try {
        const result = await request.execute();
        await clearExact(encoded);
        return result;
      } catch (error) {
        if (isOrderInboundRejected(error)) await clearExact(encoded);
        throw error;
      }
    } finally { busy.delete(slot); }
  };
  // A second browser tab must wait for the first request and then read its journal.
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request(slot, action);
  return action();
}
export const resolvePendingOrderInbound = (scope: OrderInboundScope, resolve: Resolver) => run<never>(scope, resolve);
export async function submitOrderInbound<T>(scope: OrderInboundScope, key: string, execute: () => Promise<T>, resolve: Resolver): Promise<T | OrderInboundResolution> {
  return (await run(scope, resolve, { key, execute }))!;
}
