import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useStoreId } from '@/lib/SessionProvider';

type Kind = 'ingredient' | 'material' | 'recipe';
const cache = new Map<string, string[]>();
const listeners = new Set<() => void>();
const reads = new Map<string, Promise<void>>();
const writes = new Map<string, Promise<void>>();
const parse = (raw: string | null): string[] => {
  try { const value: unknown = JSON.parse(raw ?? '[]'); return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))] : []; }
  catch { return []; }
};

export function orderItems<T extends { id: string }>(items: readonly T[], ids: readonly string[]): T[] {
  const ranks = new Map(ids.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (ranks.get(a.id) ?? ids.length) - (ranks.get(b.id) ?? ids.length));
}

/** 매장별 기기 표시 설정. 원장·계산 또는 서버의 마스터 데이터를 변경하지 않는다. */
export function useItemOrder(kind: Kind) {
  const storeId = useStoreId();
  const key = `master-item-order.v1.${storeId}.${kind}`;
  const [, refresh] = useState(0);
  if (!cache.has(key) && Platform.OS === 'web') {
    try { cache.set(key, parse(globalThis.localStorage.getItem(key))); } catch { cache.set(key, []); }
  }
  useEffect(() => {
    const update = () => refresh(n => n + 1);
    listeners.add(update);
    if (Platform.OS !== 'web' && !cache.has(key) && !reads.has(key)) {
      const read = import('expo-secure-store').then(storage => storage.getItemAsync(key)).then(raw => {
        if (!cache.has(key)) { cache.set(key, parse(raw)); listeners.forEach(notify => notify()); }
      }).catch(() => {}).finally(() => reads.delete(key));
      reads.set(key, read);
    }
    return () => { listeners.delete(update); };
  }, [key]);
  return {
    ids: cache.get(key) ?? [],
    save: async (ids: string[]) => {
      const value = [...new Set(ids)];
      const previous = writes.get(key) ?? Promise.resolve();
      const next = previous.catch(() => {}).then(async () => {
        const raw = JSON.stringify(value);
        if (Platform.OS === 'web') globalThis.localStorage.setItem(key, raw);
        else await (await import('expo-secure-store')).setItemAsync(key, raw);
        cache.set(key, value); listeners.forEach(notify => notify());
      });
      writes.set(key, next);
      try { await next; } finally { if (writes.get(key) === next) writes.delete(key); }
    },
  };
}
