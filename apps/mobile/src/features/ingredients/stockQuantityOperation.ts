import { Platform } from 'react-native';
import { isIngredientRevisionConflict } from './revisionConflict';

export const isStockQuantityRejected = (error: unknown): boolean =>
  (error as { stockQuantityRejected?: unknown } | null)?.stockQuantityRejected === true || isIngredientRevisionConflict(error);

export type StockScope = { actorId: string; storeId: string; ingredientId: string };
type Pending = { version: 1; scope: StockScope; key: string; kind: 'deduct' | 'discard' };
export type StockResolution = { resolved: 'recorded' | 'not_recorded'; previousKind: Pending['kind'] };
const busy = new Set<string>();
const storageKey = (scope: StockScope) => 'ingredient.stock.v1.' + [scope.actorId,scope.storeId,scope.ingredientId]
  .map(value => Array.from(value).map(c => c.codePointAt(0)!.toString(16)).join('-')).join('.');
const read = async (key: string) => Platform.OS === 'web' ? localStorage.getItem(key) : (await import('expo-secure-store')).getItemAsync(key);
const write = async (key: string,value: string) => {
  if (Platform.OS === 'web') localStorage.setItem(key,value); else await (await import('expo-secure-store')).setItemAsync(key,value);
};
const remove = async (key: string) => {
  if (Platform.OS === 'web') localStorage.removeItem(key); else await (await import('expo-secure-store')).deleteItemAsync(key);
};
function decode(raw: string,scope: StockScope): Pending {
  const p = JSON.parse(raw) as Pending;
  if (!p || p.version !== 1 || p.scope?.actorId !== scope.actorId || p.scope.storeId !== scope.storeId
    || p.scope.ingredientId !== scope.ingredientId || typeof p.key !== 'string' || !p.key || p.key.length > 256
    || !['deduct','discard'].includes(p.kind)) throw Error('이전 재고 처리 확인 정보를 읽지 못했어요.');
  return p;
}
function validateScope(scope: StockScope) {
  if (![scope.actorId,scope.storeId,scope.ingredientId].every(v => typeof v === 'string' && v.length > 0 && v.length <= 256))
    throw Error('재고 처리 대상을 확인해 주세요.');
}
async function withStockQuantityLock<T>(scope: StockScope, action: (slot: string) => Promise<T>): Promise<T> {
  validateScope(scope);
  const slot = storageKey(scope);
  if (busy.has(slot)) throw Error('이전 재고 처리를 확인하고 있어요. 잠시 기다려 주세요.');
  const run = async () => {
    busy.add(slot);
    try { return await action(slot); } finally { busy.delete(slot); }
  };
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request(slot,run);
  return run();
}
async function clearExact(slot: string, expected: string) {
  const current = await read(slot);
  if (current === null) return;
  if (current !== expected) throw Error('다른 재고 처리 확인이 진행 중이에요.');
  await remove(slot);
  if (await read(slot) !== null) throw Error('재고 처리 확인 정보를 정리하지 못했어요.');
}
async function resolveSaved(scope: StockScope,slot: string,raw: string,
  resolve: (key: string) => Promise<'recorded' | 'not_recorded'>): Promise<StockResolution> {
  const pending = decode(raw,scope);
  const status = await resolve(pending.key);
  if (status !== 'recorded' && status !== 'not_recorded') throw Error('재고 처리 결과를 확인하지 못했어요.');
  await clearExact(slot,raw);
  return { resolved: status, previousKind: pending.kind };
}
/** A local presence check only; the resolver rechecks the exact record under the write lock. */
export async function hasPendingStockQuantity(scope: StockScope): Promise<boolean> {
  validateScope(scope);
  const raw = await read(storageKey(scope));
  if (raw === null) return false;
  decode(raw,scope);
  return true;
}
/** Recovery needs no new quantity, reason or request key, including at zero/negative stock. */
export function resolvePendingStockQuantity(scope: StockScope,
  resolve: (key: string) => Promise<'recorded' | 'not_recorded'>): Promise<StockResolution | null> {
  return withStockQuantityLock(scope,async slot => {
    const raw = await read(slot);
    return raw === null ? null : resolveSaved(scope,slot,raw,resolve);
  });
}
/** Only a request identifier is persisted. Recovery never replays old quantities or reasons. */
export async function submitStockQuantity<T>(scope: StockScope,key: string,kind: Pending['kind'],
  execute: () => Promise<T>, resolve: (key: string) => Promise<'recorded' | 'not_recorded'>): Promise<T | StockResolution> {
  if (typeof key !== 'string' || key.length < 1 || key.length > 256) throw Error('재고 처리 대상을 확인해 주세요.');
  return withStockQuantityLock(scope,async slot => {
    const old = await read(slot);
    if (old !== null) return resolveSaved(scope,slot,old,resolve);
    const encoded = JSON.stringify({ version: 1,scope,key,kind } satisfies Pending);
    if (encoded.length > 1900) throw Error('재고 처리 확인 정보를 보관할 수 없어요.');
    await write(slot,encoded);
    if (await read(slot) !== encoded) throw Error('재고 처리 확인 정보를 보관하지 못했어요.');
    try {
      const result = await execute();
      await clearExact(slot,encoded);
      return result;
    } catch (error) {
      // Exact server transaction rejection is definitive. Unknown responses retain the key.
      if (isStockQuantityRejected(error)) await clearExact(slot,encoded);
      throw error;
    }
  });
}
