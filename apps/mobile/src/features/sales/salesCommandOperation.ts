import { Platform } from 'react-native';

export type SalesCommandScope = {
  actorId: string;
  storeId: string;
  businessDate: string;
  draftId: string;
};
export type SalesCommandRecoveryScope = Omit<SalesCommandScope, 'draftId'>;

export type SalesFinalizeCommand = {
  requestKey: string;
  payloadHash: string;
  baseRevision: number;
};

export type SalesCommandResolution = {
  resolved: 'none' | 'recorded' | 'not_recorded';
  result?: Record<string, unknown>;
};

type Pending = {
  version: 1;
  scope: SalesCommandScope;
  command: SalesFinalizeCommand;
  kind: 'finalize_sales_draft';
};

const busy = new Set<string>();
const validText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256;
const encodedPart = (value: string) => Array.from(value).map(c => c.codePointAt(0)!.toString(16)).join('-');
const storageKey = (scope: SalesCommandRecoveryScope) => `sales.command.v1.${[scope.actorId, scope.storeId, scope.businessDate].map(encodedPart).join('.')}`;
const read = async (key: string) => Platform.OS === 'web' ? globalThis.localStorage.getItem(key) : (await import('expo-secure-store')).getItemAsync(key);
const write = async (key: string, value: string) => {
  if (Platform.OS === 'web') globalThis.localStorage.setItem(key, value);
  else await (await import('expo-secure-store')).setItemAsync(key, value);
};
const remove = async (key: string) => {
  if (Platform.OS === 'web') globalThis.localStorage.removeItem(key);
  else await (await import('expo-secure-store')).deleteItemAsync(key);
};

function validateRecoveryScope(scope: SalesCommandRecoveryScope) {
  if (![scope.actorId, scope.storeId, scope.businessDate].every(validText))
    throw Error('매출 작성 대상을 확인해 주세요.');
}

function validateScope(scope: SalesCommandScope) {
  validateRecoveryScope(scope);
  if (!validText(scope.draftId)) throw Error('매출 작성 대상을 확인해 주세요.');
}

function decode(raw: string, scope: SalesCommandRecoveryScope): Pending {
  let value: Pending;
  try { value=JSON.parse(raw) as Pending; }
  catch { throw Error('이전 매출 작성 확인 정보를 읽지 못했어요.'); }
  const sameScope = value?.scope?.actorId === scope.actorId && value.scope.storeId === scope.storeId
    && value.scope.businessDate === scope.businessDate && validText(value.scope.draftId);
  const command = value?.command;
  if (value?.version !== 1 || value.kind !== 'finalize_sales_draft' || !sameScope
    || !validText(command?.requestKey) || !/^[0-9a-f]{64}$/.test(command?.payloadHash ?? '')
    || !Number.isSafeInteger(command?.baseRevision) || command.baseRevision < 0)
    throw Error('이전 매출 작성 확인 정보를 읽지 못했어요.');
  return value;
}

async function decodeOrDiscard(raw: string, scope: SalesCommandRecoveryScope, slot: string): Promise<Pending | null> {
  try { return decode(raw, scope); }
  catch {
    // 손상된 로컬 봉투에는 재실행할 수 있는 신뢰 가능한 request key가 없다.
    // 서버 초안/영수증 조회가 다시 기준이 되도록 포인터를 제거한다.
    await remove(slot);
    return null;
  }
}

async function clearExact(slot: string, expected: string) {
  const current = await read(slot);
  if (current !== expected) throw Error('다른 매출 작성 확인이 진행 중이에요.');
  await remove(slot);
  if (await read(slot) !== null) throw Error('매출 작성 확인 정보를 정리하지 못했어요.');
}

const definitelyRejected = (error: unknown) => {
  const value = error as { code?: unknown; details?: unknown } | null;
  return typeof value?.code === 'string' && ['22000', '42501', '45009', '45021', '45040', '45041', '45042', '45043'].includes(value.code);
};

async function locked<T>(scope: SalesCommandRecoveryScope, action: (slot: string) => Promise<T>): Promise<T> {
  validateRecoveryScope(scope);
  const slot = storageKey(scope);
  const run = async () => {
    if (busy.has(slot)) throw Error('이전 매출 작성을 확인하고 있어요. 잠시 기다려 주세요.');
    busy.add(slot);
    try { return await action(slot); } finally { busy.delete(slot); }
  };
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request(slot, run);
  return run();
}

export async function submitSalesFinalize<T>(
  scope: SalesCommandScope,
  command: SalesFinalizeCommand,
  execute: (command: SalesFinalizeCommand, scope: SalesCommandScope) => Promise<T>,
  resolve: (command: SalesFinalizeCommand, scope: SalesCommandScope) => Promise<SalesCommandResolution>,
): Promise<T | SalesCommandResolution> {
  validateScope(scope);
  return locked(scope, async slot => {
    const old = await read(slot);
    if (old !== null) {
      const pending = await decodeOrDiscard(old, scope, slot);
      if (pending) {
        const resolution = await resolve(pending.command, pending.scope);
        if (!['recorded', 'not_recorded'].includes(resolution.resolved)) throw Error('매출 작성 결과를 확인하지 못했어요.');
        if (resolution.resolved === 'recorded') { await clearExact(slot, old); return resolution; }
        try {
          const result = await execute(pending.command, pending.scope);
          await clearExact(slot, old);
          return result;
        } catch (error) {
          if (definitelyRejected(error)) await clearExact(slot, old);
          throw error;
        }
      }
    }
    const pending: Pending = { version: 1, scope, command, kind: 'finalize_sales_draft' };
    const encoded = JSON.stringify(pending);
    if (encoded.length > 1900) throw Error('매출 작성 확인 정보를 보관할 수 없어요.');
    await write(slot, encoded);
    if (await read(slot) !== encoded) throw Error('매출 작성 확인 정보를 보관하지 못했어요.');
    try {
      const result = await execute(command, scope);
      await clearExact(slot, encoded);
      return result;
    } catch (error) {
      if (definitelyRejected(error)) await clearExact(slot, encoded);
      throw error;
    }
  });
}

export async function recoverSalesFinalize(
  scope: SalesCommandRecoveryScope,
  resolve: (command: SalesFinalizeCommand, pendingScope: SalesCommandScope) => Promise<SalesCommandResolution>,
): Promise<SalesCommandResolution> {
  return locked(scope, async slot => {
    const raw=await read(slot);
    if (raw===null) return { resolved:'none' };
    const pending=await decodeOrDiscard(raw,scope,slot);
    if (!pending) return { resolved:'none' };
    const result=await resolve(pending.command,pending.scope);
    if (!['recorded','not_recorded'].includes(result.resolved)) throw Error('매출 작성 결과를 확인하지 못했어요.');
    if (result.resolved==='recorded') await clearExact(slot,raw);
    return result;
  });
}
