import { beforeEach, expect, it, vi } from 'vitest';
import { keepRecipeIntent, readRecipeIntent, clearRecipeIntent, type RecipeIntent } from '@/features/recipes/intentStorage';
import { recipePayload } from '@/features/recipes/writeContract';

const m = vi.hoisted(() => ({ values: new Map<string, string>(), write: vi.fn(), remove: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-secure-store', () => ({ getItemAsync: async (key: string) => m.values.get(key) ?? null,
  setItemAsync: m.write, deleteItemAsync: m.remove }));
const scope = { actorId: 'actor-a', storeId: 'store-a' };
const requestId = '00000000-0000-4000-8000-000000000011';
const intent = (): RecipeIntent => ({ version: 1, scope, payload: recipePayload({ patch: 'create', requestId,
  name: '한글 메뉴 🍲', memo: '메모'.repeat(100), price: 12000, baseServings: 10, targetProfitRate: 30,
  lines: Array.from({ length: 80 }, (_, i) => ({ ingredientId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, inputQty: i + 1 })) }) });
beforeEach(() => {
  m.values.clear(); m.write.mockReset(); m.remove.mockReset();
  m.write.mockImplementation(async (key: string, value: string) => {
    if (new TextEncoder().encode(value).length > 2048) throw new Error('native size limit');
    m.values.set(key, value);
  });
  m.remove.mockImplementation(async (key: string) => { m.values.delete(key); });
});

it('stores a large Korean recipe in bounded chunks and reassembles exactly the same payload after a fresh read', async () => {
  const original = intent(); await keepRecipeIntent(original);
  expect(m.write.mock.calls.length).toBeGreaterThan(2);
  expect(m.write.mock.calls.at(-1)![1]).toContain('recipe-chunks-v1');
  expect(await readRecipeIntent(scope)).toEqual(original);
  await clearRecipeIntent(scope, requestId); expect(await readRecipeIntent(scope)).toBeNull(); expect(m.values.size).toBe(0);
});
it('never publishes a partially persisted request', async () => {
  const write = m.write.getMockImplementation()!; let calls = 0;
  m.write.mockImplementation(async (key: string, value: string) => { if (++calls === 3) throw new Error('device storage failed'); await write(key, value); });
  await expect(keepRecipeIntent(intent())).rejects.toThrow('device storage failed');
  expect(await readRecipeIntent(scope)).toBeNull();
});
it('fails closed when a published chunk is unavailable', async () => {
  await keepRecipeIntent(intent()); m.values.delete(m.write.mock.calls[0]![0]);
  await expect(readRecipeIntent(scope)).rejects.toThrow('일부');
});
it('keeps the journal when index removal fails and permits completion if only orphan cleanup fails', async () => {
  await keepRecipeIntent(intent()); const indexKey = m.write.mock.calls.at(-1)![0];
  m.remove.mockRejectedValue(new Error('storage failure'));
  await expect(clearRecipeIntent(scope, requestId)).rejects.toThrow('storage failure');
  expect(await readRecipeIntent(scope)).toEqual(intent());
  m.remove.mockImplementation(async (key: string) => { if (key !== indexKey) throw new Error('orphan'); m.values.delete(key); });
  await clearRecipeIntent(scope, requestId); expect(await readRecipeIntent(scope)).toBeNull();
});
