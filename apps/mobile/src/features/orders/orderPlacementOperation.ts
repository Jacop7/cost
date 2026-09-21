import { Platform } from 'react-native';

export type OrderPlacementScope = { actorId: string; storeId: string };
export type OrderPlacementResolution = {
  resolved: 'recorded' | 'not_recorded';
  orderIds: string[];
};

type Pending = { version: 1; scope: OrderPlacementScope; key: string };
type Resolver = (key: string) => Promise<OrderPlacementResolution>;
const busy = new Set<string>();

const encodePart = (value: string) => Array.from(value)
  .map(character => character.codePointAt(0)!.toString(16)).join('-');
const storageKey = (scope: OrderPlacementScope) =>
  `order.placement.v1.${encodePart(scope.actorId)}.${encodePart(scope.storeId)}`;
const read = async (key: string) => Platform.OS === 'web'
  ? localStorage.getItem(key)
  : (await import('expo-secure-store')).getItemAsync(key);
const write = async (key: string, value: string) => {
  if (Platform.OS === 'web') localStorage.setItem(key, value);
  else await (await import('expo-secure-store')).setItemAsync(key, value);
};
const remove = async (key: string) => {
  if (Platform.OS === 'web') localStorage.removeItem(key);
  else await (await import('expo-secure-store')).deleteItemAsync(key);
};
const validText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 256;

export const isOrderPlacementRejected = (error: unknown) =>
  (error as { orderPlacementRejected?: unknown } | null)?.orderPlacementRejected === true;

export function createOrderPlacementKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 3) | 8).toString(16);
  });
}

function decode(raw: string, scope: OrderPlacementScope): Pending {
  let pending: Pending;
  try {
    pending = JSON.parse(raw) as Pending;
  } catch {
    throw Error('이전 발주 확인 정보를 읽지 못했어요.');
  }
  if (!pending || Object.keys(pending).sort().join() !== 'key,scope,version' || pending.version !== 1
    || !pending.scope || Object.keys(pending.scope).sort().join() !== 'actorId,storeId'
    || pending.scope.actorId !== scope.actorId || pending.scope.storeId !== scope.storeId
    || !validText(pending.key)) throw Error('이전 발주 확인 정보를 읽지 못했어요.');
  return pending;
}

async function run<T>(scope: OrderPlacementScope, resolve: Resolver,
  request?: { key: string; execute: () => Promise<T> }): Promise<T | OrderPlacementResolution | null> {
  if (![scope.actorId, scope.storeId].every(validText) || (request && !validText(request.key)))
    throw Error('발주 처리 대상을 확인해 주세요.');
  const slot = storageKey(scope);
  const action = async () => {
    if (busy.has(slot)) throw Error('이전 발주를 확인하고 있어요. 잠시 기다려 주세요.');
    busy.add(slot);
    try {
      const clearExact = async (expected: string) => {
        const current = await read(slot);
        if (current !== expected) throw Error('다른 발주 확인이 진행 중이에요.');
        await remove(slot);
        if (await read(slot) !== null) throw Error('발주 확인 정보를 정리하지 못했어요.');
      };
      const old = await read(slot);
      if (old !== null) {
        const pending = decode(old, scope);
        const resolution = await resolve(pending.key);
        if (!['recorded', 'not_recorded'].includes(resolution.resolved))
          throw Error('발주 결과를 확인하지 못했어요.');
        await clearExact(old);
        return resolution;
      }
      if (!request) return null;
      const encoded = JSON.stringify({ version: 1, scope, key: request.key } satisfies Pending);
      await write(slot, encoded);
      if (await read(slot) !== encoded) throw Error('발주 확인 정보를 보관하지 못했어요.');
      try {
        const result = await request.execute();
        await clearExact(encoded);
        return result;
      } catch (error) {
        if (isOrderPlacementRejected(error)) await clearExact(encoded);
        throw error;
      }
    } finally {
      busy.delete(slot);
    }
  };
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request(slot, action);
  return action();
}

export const resolvePendingOrderPlacement = (scope: OrderPlacementScope, resolve: Resolver) =>
  run<never>(scope, resolve);

export async function submitOrderPlacement<T>(scope: OrderPlacementScope, key: string,
  execute: () => Promise<T>, resolve: Resolver): Promise<T | OrderPlacementResolution> {
  return (await run(scope, resolve, { key, execute }))!;
}
