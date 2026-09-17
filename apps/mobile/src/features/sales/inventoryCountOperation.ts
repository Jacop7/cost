import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type InventoryCountScope = { actorId: string; storeId: string };
export type InventoryCountIntent = {
  version: 1;
  scope: InventoryCountScope;
  sessionId: string;
  requestKey: string;
  targetIds: string[];
  counts: Record<string, string>;
  prepared: boolean;
};

type ChunkIndex = { format: 'inventory-count-chunks-v1'; id: string; count: number };
const validId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{16,64}$/i.test(value);
const encoded = (value: string) => Array.from(value).map(c => c.codePointAt(0)!.toString(16)).join('-');
const keyOf = (scope: InventoryCountScope) => `sales.inventory-count.v1.${encoded(scope.actorId)}.${encoded(scope.storeId)}`;
const partKey = (key: string, index: ChunkIndex, part: number) => `${key}.${index.id}.${part}`;
const parseIndex = (raw: string): ChunkIndex | null => {
  const value = JSON.parse(raw) as ChunkIndex;
  if (value?.format !== 'inventory-count-chunks-v1') return null;
  if (!validId(value.id) || !Number.isInteger(value.count) || value.count < 1 || value.count > 1024)
    throw Error('이전 재고 실사 정보를 읽지 못했어요.');
  return value;
};
const readRaw = async (key: string) => {
  if (Platform.OS === 'web') return globalThis.localStorage.getItem(key);
  const head = await SecureStore.getItemAsync(key);
  if (head === null) return null;
  const index = parseIndex(head);
  if (!index) return head;
  const parts: string[] = [];
  for (let part = 0; part < index.count; part++) {
    const value = await SecureStore.getItemAsync(partKey(key, index, part));
    if (value === null) throw Error('이전 재고 실사 정보 일부를 읽지 못했어요.');
    parts.push(value);
  }
  return parts.join('');
};
const writeRaw = async (key: string, value: string) => {
  if (Platform.OS === 'web') { globalThis.localStorage.setItem(key, value); return; }
  const ascii = value.replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const id = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  const index: ChunkIndex = { format: 'inventory-count-chunks-v1', id, count: Math.ceil(ascii.length / 1024) };
  if (index.count > 1024) throw Error('재고 실사 항목이 너무 많아 저장할 수 없어요.');
  for (let part = 0; part < index.count; part++)
    await SecureStore.setItemAsync(partKey(key, index, part), ascii.slice(part * 1024, (part + 1) * 1024));
  await SecureStore.setItemAsync(key, JSON.stringify(index));
};
const removeRaw = async (key: string) => {
  if (Platform.OS === 'web') { globalThis.localStorage.removeItem(key); return; }
  const head = await SecureStore.getItemAsync(key);
  const index = head === null ? null : parseIndex(head);
  await SecureStore.deleteItemAsync(key);
  if (index) for (let part = 0; part < index.count; part++) {
    try { await SecureStore.deleteItemAsync(partKey(key, index, part)); } catch { /* pointer is already gone */ }
  }
};
const queues = new Map<string, Promise<void>>();
const serialized = async <T>(key: string, action: () => Promise<T>): Promise<T> => {
  const before = queues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>(resolve => { release = resolve; });
  const tail = before.then(() => next);
  queues.set(key, tail);
  await before;
  try { return await action(); } finally { release(); if (queues.get(key) === tail) queues.delete(key); }
};

function validate(intent: InventoryCountIntent, scope: InventoryCountScope) {
  if (intent?.version !== 1 || intent.scope?.actorId !== scope.actorId || intent.scope?.storeId !== scope.storeId
    || !validId(intent.sessionId) || !validId(intent.requestKey) || !Array.isArray(intent.targetIds)
    || intent.targetIds.some(id => !validId(id)) || typeof intent.counts !== 'object' || intent.counts === null
    || typeof intent.prepared !== 'boolean') throw Error('이전 재고 실사 정보를 읽지 못했어요.');
  const keys = Object.keys(intent.counts).sort();
  if (keys.join('|') !== [...intent.targetIds].sort().join('|')
    || keys.some(id => typeof intent.counts[id] !== 'string')) throw Error('이전 재고 실사 정보를 읽지 못했어요.');
}

export async function readInventoryCountIntent(scope: InventoryCountScope): Promise<InventoryCountIntent | null> {
  const raw = await readRaw(keyOf(scope));
  if (raw === null) return null;
  const value = JSON.parse(raw) as InventoryCountIntent;
  validate(value, scope);
  return value;
}
export async function keepInventoryCountIntent(intent: InventoryCountIntent): Promise<void> {
  validate(intent, intent.scope);
  const key = keyOf(intent.scope);
  await serialized(key, () => writeRaw(key, JSON.stringify(intent)));
}
export async function clearInventoryCountIntent(scope: InventoryCountScope, sessionId: string): Promise<void> {
  const key = keyOf(scope);
  await serialized(key, async () => {
    const saved = await readInventoryCountIntent(scope);
    if (saved && saved.sessionId !== sessionId) throw Error('다른 재고 실사가 진행 중이에요.');
    await removeRaw(key);
  });
}
export async function discardUnreadableInventoryCountIntent(scope: InventoryCountScope): Promise<void> {
  const key = keyOf(scope);
  if (Platform.OS === 'web') globalThis.localStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}
