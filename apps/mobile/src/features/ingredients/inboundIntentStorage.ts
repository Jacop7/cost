import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type InboundScope = Readonly<{ actorId: string; storeId: string; ingredientId: string }>;
export type InboundPayload = Readonly<{
  ingredientId: string; volume: number; amount: number; qty: number;
  vendorId: string | null; occurredAt: string; idempotencyKey: string;
}>;
export type InboundIntent = Readonly<{ version: 1; scope: InboundScope; payload: InboundPayload }>;
const keyOf = (scope: InboundScope) => 'ingredient.inbound.v1.' + [scope.actorId, scope.storeId, scope.ingredientId]
  .map(value => Array.from(value).map(c => c.codePointAt(0)!.toString(16)).join('-')).join('.');
const busy = new Set<string>();
const listeners = new Map<string, Set<() => void>>();
const emit = (scope: InboundScope) => listeners.get(keyOf(scope))?.forEach(listener => listener());
const read = (key: string) => Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage.getItem(key)) : SecureStore.getItemAsync(key);
const write = async (key: string, value: string) => {
  if (Platform.OS === 'web') globalThis.localStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
};
const remove = async (key: string) => {
  if (Platform.OS === 'web') globalThis.localStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
};
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256;
function validate(value: unknown, scope: InboundScope): asserts value is InboundIntent {
  const intent = value as InboundIntent | null;
  const p = intent?.payload;
  if (!intent || intent.version !== 1 || Object.keys(intent).sort().join() !== 'payload,scope,version'
    || !intent.scope || Object.keys(intent.scope).sort().join() !== 'actorId,ingredientId,storeId'
    || ![scope.actorId, scope.storeId, scope.ingredientId].every(text)
    || intent.scope.actorId !== scope.actorId || intent.scope.storeId !== scope.storeId || intent.scope.ingredientId !== scope.ingredientId
    || !p || Object.keys(p).sort().join() !== 'amount,idempotencyKey,ingredientId,occurredAt,qty,vendorId,volume'
    || p.ingredientId !== scope.ingredientId || !text(p.idempotencyKey)
    || ![p.volume, p.amount, p.qty].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)
    || !(p.vendorId === null || text(p.vendorId)) || typeof p.occurredAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(p.occurredAt)
    || new Date(`${p.occurredAt}T00:00:00Z`).toISOString().slice(0, 10) !== p.occurredAt) {
    throw new Error('이전 입고 확인 정보를 읽지 못했어요. 새 입고를 잠시 멈췄어요.');
  }
}
const frozen = (intent: InboundIntent): InboundIntent => Object.freeze({ version: 1,
  scope: Object.freeze({ ...intent.scope }), payload: Object.freeze({ ...intent.payload }) });
export async function readInboundIntent(scope: InboundScope): Promise<InboundIntent | null> {
  const raw = await read(keyOf(scope));
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw); validate(value, scope); return frozen(value);
}
/** Caller holds the scope lock. Never replace an unresolved request with a new key or edited data. */
export async function keepInboundIntent(intent: InboundIntent): Promise<void> {
  validate(intent, intent.scope);
  const previous = await readInboundIntent(intent.scope);
  if (previous && (previous.payload.idempotencyKey !== intent.payload.idempotencyKey
    || JSON.stringify(previous.payload) !== JSON.stringify(intent.payload))) throw new Error('이전 입고를 먼저 확인해 주세요.');
  if (previous) return;
  // A quick inbound has only fixed scalar fields. Bound the native value below
  // SecureStore's per-value limit rather than publishing a partial request.
  const encoded = JSON.stringify(intent).replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  if (encoded.length > 1900) throw new Error('입고 확인 정보를 보관할 수 없어요.');
  await write(keyOf(intent.scope), encoded);
  if (await read(keyOf(intent.scope)) !== encoded) throw new Error('입고 확인 정보를 보관하지 못했어요.');
  emit(intent.scope);
}
/** Only a confirmed response for this exact request can clear the journal. */
export async function clearInboundIntent(intent: InboundIntent): Promise<void> {
  const saved = await readInboundIntent(intent.scope);
  if (!saved || JSON.stringify(saved) !== JSON.stringify(intent)) throw new Error('다른 입고 확인이 진행 중이에요.');
  await remove(keyOf(intent.scope));
  if (await read(keyOf(intent.scope)) !== null) throw new Error('입고 확인 정보 정리를 완료하지 못했어요.');
  emit(intent.scope);
}
export function inboundIntentBusy(scope: InboundScope): boolean { return busy.has(keyOf(scope)); }
export function subscribeInboundIntent(scope: InboundScope, listener: () => void): () => void {
  const key = keyOf(scope), group = listeners.get(key) ?? new Set<() => void>();
  group.add(listener); listeners.set(key, group);
  const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) listener(); };
  if (Platform.OS === 'web') globalThis.addEventListener('storage', onStorage);
  return () => {
    group.delete(listener); if (!group.size) listeners.delete(key);
    if (Platform.OS === 'web') globalThis.removeEventListener('storage', onStorage);
  };
}
export async function withInboundIntentLock<T>(scope: InboundScope, action: () => Promise<T>): Promise<T> {
  const key = keyOf(scope);
  if (busy.has(key)) throw new Error('이전 입고를 확인하고 있어요. 잠시 기다려 주세요.');
  busy.add(key); emit(scope);
  try { return await action(); } finally { busy.delete(key); emit(scope); }
}
