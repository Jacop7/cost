import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  randomUUID: () => firstKey,
  digestStringAsync: async (_algorithm: string, value: string) =>
    'a'.repeat(63) + (value.includes('4500') ? 'b' : 'a'),
}));

import {
  clearBulkInboundPending,
  keepBulkInboundPending,
  readBulkInboundPending,
} from '@/features/ingredients/bulkInboundOperation';

const originalOS = Platform.OS;
const scope = { actorId: 'actor-a', storeId: 'store-a' };
const firstKey = '00000000-0000-4000-8000-000000000001';
const secondKey = '00000000-0000-4000-8000-000000000002';
const items = [{
  clientItemId: 'card-a', ingredientId: 'ingredient-a', vendorId: null,
  receivedQuantity: 1_000, paidAmount: 4_000,
}];

beforeEach(() => {
  Platform.OS = 'web';
  localStorage.clear();
});

afterEach(() => {
  Platform.OS = originalOS;
});

it('응답 유실 뒤 같은 payload는 최초 요청 키를 재사용하고 성공 확인 뒤에만 지운다', async () => {
  const first = await keepBulkInboundPending(scope, items, firstKey);
  const replay = await keepBulkInboundPending(scope, items, secondKey);

  expect(replay).toEqual(first);
  expect(replay.requestKey).toBe(firstKey);
  expect(await readBulkInboundPending(scope)).toEqual(first);

  await clearBulkInboundPending(first);
  expect(await readBulkInboundPending(scope)).toBeNull();
});

it('미확인 요청이 있으면 바뀐 카드 payload로 새 입고를 보내지 않는다', async () => {
  const pending = await keepBulkInboundPending(scope, items, firstKey);
  await expect(keepBulkInboundPending(scope, [{ ...items[0]!, paidAmount: 4_500 }], secondKey))
    .rejects.toThrow('이전 일괄 입고 결과를 먼저 확인해 주세요.');
  expect(await readBulkInboundPending(scope)).toEqual(pending);
});

it('actor와 store가 다른 대기 요청은 같은 슬롯으로 섞이지 않는다', async () => {
  const first = await keepBulkInboundPending(scope, items, firstKey);
  const otherScope = { actorId: 'actor-b', storeId: 'store-a' };
  const other = await keepBulkInboundPending(otherScope, items, secondKey);

  expect(await readBulkInboundPending(scope)).toEqual(first);
  expect(await readBulkInboundPending(otherScope)).toEqual(other);
});
