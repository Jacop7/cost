import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

import type { BulkInboundItemInput } from './hooks';

export type BulkInboundScope = Readonly<{ actorId: string; storeId: string }>;
export type BulkInboundPending = Readonly<{
  version: 1;
  scope: BulkInboundScope;
  requestKey: string;
  payloadHash: string;
  cardCount: number;
}>;

const encode = (value: string) => Array.from(value)
  .map(character => character.codePointAt(0)!.toString(16)).join('-');
const storageKey = (scope: BulkInboundScope) =>
  `ingredient.bulk-inbound.v1.${encode(scope.actorId)}.${encode(scope.storeId)}`;
type ScopeLockManager = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
};
const scopeLockTails = new Map<string, Promise<void>>();

async function withProcessScopeLock<T>(key: string, callback: () => Promise<T>): Promise<T> {
  const predecessor = scopeLockTails.get(key) ?? Promise.resolve();
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const tail = predecessor.catch(() => undefined).then(() => gate);
  scopeLockTails.set(key, tail);
  await predecessor.catch(() => undefined);
  try {
    return await callback();
  } finally {
    release();
    if (scopeLockTails.get(key) === tail) scopeLockTails.delete(key);
  }
}

async function withScopeLock<T>(scope: BulkInboundScope, callback: () => Promise<T>): Promise<T> {
  const key = storageKey(scope);
  const manager = Platform.OS === 'web'
    ? (globalThis.navigator as typeof globalThis.navigator & { locks?: ScopeLockManager } | undefined)?.locks
    : undefined;
  if (manager) return manager.request(`costkeep:${key}`, callback);
  return withProcessScopeLock(key, callback);
}
const read = async (key: string) => Platform.OS === 'web'
  ? globalThis.localStorage.getItem(key)
  : (await import('expo-secure-store')).getItemAsync(key);
const write = async (key: string, value: string) => {
  if (Platform.OS === 'web') globalThis.localStorage.setItem(key, value);
  else await (await import('expo-secure-store')).setItemAsync(key, value);
};
const remove = async (key: string) => {
  if (Platform.OS === 'web') globalThis.localStorage.removeItem(key);
  else await (await import('expo-secure-store')).deleteItemAsync(key);
};

const isUuid = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

export function createBulkInboundKey(): string { return Crypto.randomUUID(); }

export async function bulkInboundPayloadHash(items: readonly BulkInboundItemInput[]): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(items));
}

function parsePending(raw: string, scope: BulkInboundScope): BulkInboundPending {
  const value = JSON.parse(raw) as BulkInboundPending;
  if (!value || value.version !== 1
    || Object.keys(value).sort().join() !== 'cardCount,payloadHash,requestKey,scope,version'
    || !value.scope || Object.keys(value.scope).sort().join() !== 'actorId,storeId'
    || value.scope.actorId !== scope.actorId || value.scope.storeId !== scope.storeId
    || !isUuid(value.requestKey) || !/^[0-9a-f]{64}$/i.test(value.payloadHash)
    || !Number.isInteger(value.cardCount) || value.cardCount < 1 || value.cardCount > 20) {
    throw new Error('이전 일괄 입고 확인 정보를 읽지 못했어요.');
  }
  return value;
}

export async function readBulkInboundPending(scope: BulkInboundScope): Promise<BulkInboundPending | null> {
  const raw = await read(storageKey(scope));
  return raw === null ? null : parsePending(raw, scope);
}

async function keepBulkInboundPendingUnlocked(scope: BulkInboundScope, items: readonly BulkInboundItemInput[], requestKey: string) {
  const payloadHash = await bulkInboundPayloadHash(items);
  const previous = await readBulkInboundPending(scope);
  if (previous) {
    if (previous.payloadHash !== payloadHash || previous.cardCount !== items.length) {
      throw new Error('이전 일괄 입고 결과를 먼저 확인해 주세요.');
    }
    return previous;
  }
  const pending: BulkInboundPending = {
    version: 1,
    scope,
    requestKey,
    payloadHash,
    cardCount: items.length,
  };
  const encoded = JSON.stringify(pending);
  await write(storageKey(scope), encoded);
  if (await read(storageKey(scope)) !== encoded) throw new Error('일괄 입고 확인 정보를 보관하지 못했어요.');
  return pending;
}

async function clearBulkInboundPendingUnlocked(expected: BulkInboundPending) {
  const key = storageKey(expected.scope);
  const current = await read(key);
  if (current === null || JSON.stringify(parsePending(current, expected.scope)) !== JSON.stringify(expected)) {
    throw new Error('다른 일괄 입고 확인이 진행 중이에요.');
  }
  await remove(key);
  if (await read(key) !== null) throw new Error('일괄 입고 확인 정보를 정리하지 못했어요.');
}

export type BulkInboundJournal = Readonly<{
  read: () => Promise<BulkInboundPending | null>;
  keep: (items: readonly BulkInboundItemInput[], requestKey: string) => Promise<BulkInboundPending>;
  clear: (expected: BulkInboundPending) => Promise<void>;
}>;

/** 같은 사용자·매장의 journal 확인부터 서버 결과 확인·정리까지 한 임계 구역으로 묶는다. */
export async function withBulkInboundJournal<T>(
  scope: BulkInboundScope,
  callback: (journal: BulkInboundJournal) => Promise<T>,
): Promise<T> {
  return withScopeLock(scope, () => callback({
    read: () => readBulkInboundPending(scope),
    keep: (items, requestKey) => keepBulkInboundPendingUnlocked(scope, items, requestKey),
    clear: clearBulkInboundPendingUnlocked,
  }));
}

export async function keepBulkInboundPending(scope: BulkInboundScope, items: readonly BulkInboundItemInput[], requestKey: string) {
  return withBulkInboundJournal(scope, journal => journal.keep(items, requestKey));
}

export async function clearBulkInboundPending(expected: BulkInboundPending) {
  return withBulkInboundJournal(expected.scope, journal => journal.clear(expected));
}
