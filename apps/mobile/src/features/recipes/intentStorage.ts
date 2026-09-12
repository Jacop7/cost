import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { freezeRecipeValue, recipeRequestId, validRecipeId, validateRecipePayload, type RecipePayload, type RecipeScope } from './writeContract';

export interface RecipeIntent {
  version: 1;
  scope: RecipeScope;
  payload: RecipePayload;
}
const keyOf = (scope: RecipeScope) => 'recipe.intent.v1.' + [scope.actorId, scope.storeId]
  .map(s => Array.from(s).map(c => c.codePointAt(0)!.toString(16)).join('-')).join('.');
const listeners = new Map<string, Set<() => void>>();
const busy = new Set<string>();
const emit = (scope: RecipeScope) => listeners.get(keyOf(scope))?.forEach(fn => fn());
type ChunkIndex = { format: 'recipe-chunks-v1'; id: string; count: number };
const chunkIndex = (raw: string): ChunkIndex | null => {
  const value = JSON.parse(raw) as ChunkIndex;
  if (value?.format !== 'recipe-chunks-v1') return null;
  if (!validRecipeId(value.id) || !Number.isInteger(value.count) || value.count < 1 || value.count > 1024) throw new Error('저장 확인 정보가 올바르지 않아요.');
  return value;
};
const chunkKey = (key: string, index: ChunkIndex, part: number) => `${key}.${index.id}.${part}`;
const read = async (key: string) => {
  if (Platform.OS === 'web') return globalThis.localStorage.getItem(key);
  const raw = await SecureStore.getItemAsync(key); if (raw === null) return null;
  const index = chunkIndex(raw); if (!index) return raw; // Previous single-value journal.
  const parts: string[] = [];
  for (let part = 0; part < index.count; part++) {
    const value = await SecureStore.getItemAsync(chunkKey(key, index, part));
    if (value === null) throw new Error('이전 저장 확인 정보 일부를 읽지 못했어요.');
    parts.push(value);
  }
  return parts.join('');
};
const write = async (key: string, value: string) => {
  if (Platform.OS === 'web') { globalThis.localStorage.setItem(key, value); return; }
  // SecureStore limits each value to 2048 bytes. ASCII JSON chunks stay below
  // that limit even with Korean text. Publish the index only after all parts exist.
  const ascii = value.replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const index: ChunkIndex = { format: 'recipe-chunks-v1', id: recipeRequestId(), count: Math.ceil(ascii.length / 1024) };
  if (index.count > 1024) throw new Error('저장할 메뉴 구성이 너무 커요.');
  for (let part = 0; part < index.count; part++) await SecureStore.setItemAsync(chunkKey(key, index, part), ascii.slice(part * 1024, (part + 1) * 1024));
  await SecureStore.setItemAsync(key, JSON.stringify(index));
};
const remove = async (key: string) => {
  if (Platform.OS === 'web') { globalThis.localStorage.removeItem(key); return; }
  const raw = await SecureStore.getItemAsync(key); const index = raw === null ? null : chunkIndex(raw);
  await SecureStore.deleteItemAsync(key);
  // Once the index is removed the confirmed request is complete. Orphan cleanup
  // cannot turn a confirmed write back into an unresolved product request.
  if (index) for (let part = 0; part < index.count; part++) {
    try { await SecureStore.deleteItemAsync(chunkKey(key, index, part)); } catch { /* Unreferenced storage only. */ }
  }
};
export async function readRecipeIntent(scope: RecipeScope): Promise<RecipeIntent | null> {
  const raw = await read(keyOf(scope)); if (raw === null) return null;
  const value = JSON.parse(raw) as RecipeIntent;
  if (value?.version !== 1 || value.scope?.actorId !== scope.actorId || value.scope?.storeId !== scope.storeId) {
    throw new Error('이전 저장 확인 정보를 읽지 못했어요. 새 저장을 잠시 멈췄어요.');
  }
  validateRecipePayload(value.payload);
  return freezeRecipeValue(value);
}
export async function keepRecipeIntent(intent: RecipeIntent): Promise<void> {
  validateRecipePayload(intent.payload);
  await write(keyOf(intent.scope), JSON.stringify(intent)); emit(intent.scope);
}
export async function clearRecipeIntent(scope: RecipeScope, requestId: string): Promise<void> {
  const saved = await readRecipeIntent(scope);
  if (saved && saved.payload.request_id !== requestId) throw new Error('다른 저장 확인이 진행 중이에요.');
  await remove(keyOf(scope)); emit(scope);
}
/** A damaged journal is only removed after the owner explicitly acknowledges it. */
export async function discardUnreadableRecipeIntent(scope: RecipeScope): Promise<void> {
  const key = keyOf(scope);
  if (Platform.OS === 'web') globalThis.localStorage.removeItem(key);
  else {
    // Do not parse a damaged index. Removing its pointer releases this device;
    // unreferenced SecureStore chunks cannot be replayed.
    await SecureStore.deleteItemAsync(key);
  }
  emit(scope);
}
export function subscribeRecipeIntent(scope: RecipeScope, listener: () => void): () => void {
  const key = keyOf(scope); const list = listeners.get(key) ?? new Set<() => void>(); list.add(listener); listeners.set(key, list);
  return () => { list.delete(listener); if (!list.size) listeners.delete(key); };
}
/** Also covers the interval before React can render isPending on a second click. */
export async function withRecipeIntentLock<T>(scope: RecipeScope, action: () => Promise<T>): Promise<T> {
  const key = keyOf(scope);
  if (busy.has(key)) throw new Error('이전 저장을 확인하고 있어요. 잠시 기다려 주세요.');
  busy.add(key); emit(scope);
  try { return await action(); } finally { busy.delete(key); emit(scope); }
}
export function recipeIntentBusy(scope: RecipeScope): boolean { return busy.has(keyOf(scope)); }
