import { createElement, useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSaveRecipe, RecipeOutcomeUnknownError, type RecipeDetail } from '@/features/recipes/hooks';
import { recipePayload, recipeRevision, isRecipeRevisionConflict } from '@/features/recipes/writeContract';
import { readRecipeIntent } from '@/features/recipes/intentStorage';
import { draftFromRecipe, mergeRecipeDraft } from '@/features/recipes/draftStore';
import { useRecipeEditorSession, useRecipeEditRecovery } from '@/features/recipes/editRecovery';

const m = vi.hoisted(() => ({ rpc: vi.fn(), actor: 'actor-a', store: 'store-a', focused: true }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: m.rpc }) }));
vi.mock('expo-secure-store', () => ({}));
vi.mock('@/lib/supabase', async original => await original<typeof import('@/lib/supabase')>());
vi.mock('@/lib/SessionProvider', () => ({ useSessionState: () => ({ userId: m.actor }), useStoreId: () => m.store }));
vi.mock('expo-router', () => ({ useFocusEffect: (fn: () => void | (() => void)) => useEffect(() => m.focused ? fn() : undefined, [fn, m.focused]) }));
const id = '00000000-0000-4000-8000-000000000001';
const requestId = '00000000-0000-4000-8000-000000000011';
const scope = { actorId: 'actor-a', storeId: 'store-a' };
const input = () => ({ patch: 'full' as const, requestId, id, expectedRevision: '9007199254740993', name: '원본', price: 12000,
  baseServings: 1, targetProfitRate: 30, lines: [{ ingredientId: id, inputQty: 100 }] });
const detail = (revision = '9007199254740994'): RecipeDetail => ({ id, editRevision: revision, name: '서버 최신', price: 15000, active: true,
  memo: '서버 메모', categoryId: null, baseServings: 1, targetProfitRate: 30, avgMonthlySales: null, lines: [], extras: [],
  sales30d: { qty: 0, revenue: 0, waste: 0 }, lastChange: { occurredAt: '2026-09-10T00:00:00Z', eventId: null, displayState: null, hasHistory: false },
  taxMode: 'included', taxItems: [], taxBreakdown: [], tax: 0, materialCost: 0, extraCost: 0, fixedRate: 0, fixedMonth: '2026-09', fixedItems: [] });
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
beforeEach(() => { localStorage.clear(); m.rpc.mockReset(); m.actor = 'actor-a'; m.store = 'store-a'; m.focused = true;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 1, retryDelay: 0 } } }); });
afterEach(() => { cleanup(); client.clear(); });

it('persists an unknown outcome across remount and retries the exact original body/key/basis before permitting a new intent', async () => {
  m.rpc.mockRejectedValueOnce(new Error('response lost'));
  const h = renderHook(() => useSaveRecipe(), { wrapper });
  await act(async () => { await expect(h.result.current.mutateAsync(input())).rejects.toBeInstanceOf(RecipeOutcomeUnknownError); });
  const original = m.rpc.mock.calls[0]![1]; expect(m.rpc).toHaveBeenCalledTimes(1);
  h.unmount(); client.clear();
  const restored = renderHook(() => useSaveRecipe(), { wrapper });
  await waitFor(() => expect(restored.result.current.pendingIntent?.payload.request_id).toBe(requestId));
  await act(async () => { await expect(restored.result.current.mutateAsync({ ...input(), requestId: id, price: 99999 })).rejects.toBeInstanceOf(RecipeOutcomeUnknownError); });
  expect(m.rpc).toHaveBeenCalledTimes(1);
  m.rpc.mockResolvedValueOnce({ data: id, error: null });
  await act(async () => { await expect(restored.result.current.mutateAsync({ resumeRequestId: requestId })).resolves.toBe(id); });
  expect(m.rpc.mock.calls[1]![1]).toEqual(original);
  expect(await readRecipeIntent(scope)).toBeNull();
});

it('freezes the submitted nested input at mutate call time and rejects an immediate duplicate', async () => {
  const pending = deferred<{ data: string; error: null }>(); m.rpc.mockReturnValue(pending.promise);
  const h = renderHook(() => useSaveRecipe(), { wrapper }); const mutable = input();
  let first!: Promise<string>; let second!: Promise<unknown>;
  act(() => { first = h.result.current.mutateAsync(mutable); second = h.result.current.mutateAsync(input()).catch(e => e);
    mutable.price = 99999; mutable.lines[0]!.inputQty = 999; });
  await waitFor(() => expect(m.rpc).toHaveBeenCalledTimes(1));
  expect(m.rpc.mock.calls[0]![1].p_payload).toMatchObject({ price: 12000, lines: [{ input_qty: 100 }] });
  expect(await second).toBeInstanceOf(Error);
  await act(async () => { pending.resolve({ data: id, error: null }); await first; });
});

it('does not send when durable storage fails and keeps an intent when successful-result cleanup fails', async () => {
  const h = renderHook(() => useSaveRecipe(), { wrapper });
  const fail = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
  await act(async () => { await expect(h.result.current.mutateAsync(input())).rejects.toThrow('full'); });
  expect(m.rpc).not.toHaveBeenCalled(); fail.mockRestore();
  m.rpc.mockResolvedValue({ data: id, error: null });
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage unavailable'); });
  await act(async () => { await expect(h.result.current.mutateAsync(input())).rejects.toBeInstanceOf(RecipeOutcomeUnknownError); });
  remove.mockRestore(); expect((await readRecipeIntent(scope))?.payload.request_id).toBe(requestId);
});

it('clears an unresolved intent only when receipt replay proves an exact revision conflict', async () => {
  m.rpc.mockRejectedValueOnce(new Error('lost')); const h = renderHook(() => useSaveRecipe(), { wrapper });
  await act(async () => { await h.result.current.mutateAsync(input()).catch(() => {}); });
  m.rpc.mockResolvedValueOnce({ data: null, error: { code: '45009', details: 'REVISION_CONFLICT', message: 'later conflict' } });
  await act(async () => { await expect(h.result.current.mutateAsync({ resumeRequestId: requestId })).rejects.toMatchObject({ code: '45009', detail: 'REVISION_CONFLICT' }); });
  expect(await readRecipeIntent(scope)).toBeNull();
});

it('blocks new writes and replay when a persisted envelope is corrupted without deleting it', async () => {
  m.rpc.mockRejectedValue(new Error('lost')); const h = renderHook(() => useSaveRecipe(), { wrapper });
  await act(async () => { await h.result.current.mutateAsync(input()).catch(() => {}); }); h.unmount();
  const key = localStorage.key(0)!; const corrupted = JSON.parse(localStorage.getItem(key)!);
  corrupted.payload.expected_revision = 9007199254740992; localStorage.setItem(key, JSON.stringify(corrupted));
  const restored = renderHook(() => useSaveRecipe(), { wrapper });
  await waitFor(() => expect(restored.result.current.intentError).toBeTruthy());
  await act(async () => { await expect(restored.result.current.mutateAsync(input())).rejects.toThrow();
    await expect(restored.result.current.mutateAsync({ resumeRequestId: requestId })).rejects.toThrow(); });
  expect(m.rpc).toHaveBeenCalledTimes(1); expect(localStorage.getItem(key)).not.toBeNull();
  await act(async () => { await restored.result.current.discardUnreadableIntent(); });
  await waitFor(() => expect(restored.result.current.intentReady).toBe(true));
  expect(localStorage.getItem(key)).toBeNull();
});

it.each(['actor', 'store'] as const)('isolates pending state and late cache effects across %s A→B→A', async field => {
  const pending = deferred<{ data: string; error: null }>(); m.rpc.mockReturnValue(pending.promise);
  const invalidate = vi.spyOn(client, 'invalidateQueries'); const h = renderHook(() => useSaveRecipe(), { wrapper });
  let done!: Promise<string>; act(() => { done = h.result.current.mutateAsync(input()); });
  await waitFor(() => expect(m.rpc).toHaveBeenCalledTimes(1));
  m[field] = `${field}-b`; h.rerender();
  await waitFor(() => expect(h.result.current.intentReady).toBe(true));
  expect(h.result.current.isPending).toBe(false); expect(h.result.current.pendingIntent).toBeNull();
  m[field] = `${field}-a`; h.rerender();
  await act(async () => { pending.resolve({ data: id, error: null }); await done; });
  expect(invalidate).not.toHaveBeenCalled(); expect(await readRecipeIntent(scope)).toBeNull();
});

it.each(['22000', '40001', '40P01'])('clears a known initial %s failure without entering revision recovery or automatic retry', async code => {
  m.rpc.mockResolvedValue({ data: null, error: { code, details: 'REVISION_CONFLICT', message: 'native DB error' } });
  const h = renderHook(() => useSaveRecipe(), { wrapper }); let error: unknown;
  await act(async () => { try { await h.result.current.mutateAsync(input()); } catch (e) { error = e; } });
  expect(isRecipeRevisionConflict(error)).toBe(false); expect(m.rpc).toHaveBeenCalledTimes(1); expect(await readRecipeIntent(scope)).toBeNull();
});

it.each(['08007', '40003', 'ZZ999', 'PGRST999'])('keeps the receipt for an unclassified initial %s failure', async code => {
  m.rpc.mockResolvedValue({ data: null, error: { code, details: 'unclassified failure', message: 'transport or gateway error' } });
  const h = renderHook(() => useSaveRecipe(), { wrapper }); let error: unknown;
  await act(async () => { try { await h.result.current.mutateAsync(input()); } catch (e) { error = e; } });
  expect(error).toBeInstanceOf(RecipeOutcomeUnknownError);
  expect((await readRecipeIntent(scope))?.payload.request_id).toBe(requestId);
  await act(async () => { await expect(h.result.current.mutateAsync(input())).rejects.toBeInstanceOf(RecipeOutcomeUnknownError); });
  expect(m.rpc).toHaveBeenCalledTimes(1);
});

it.each(['full', 'memo', 'active'] as const)('keeps the receipt when a %s save acknowledges a different valid recipe id', async patch => {
  const otherId = '00000000-0000-4000-8000-000000000099';
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  m.rpc.mockResolvedValue({ data: otherId, error: null });
  const h = renderHook(() => useSaveRecipe(), { wrapper });
  const write = patch === 'full' ? input() : patch === 'memo'
    ? { patch, requestId, id, expectedRevision: '9007199254740993', memo: '수정 메모' }
    : { patch, requestId, id, expectedRevision: '9007199254740993', active: false };
  await act(async () => { await expect(h.result.current.mutateAsync(write)).rejects.toBeInstanceOf(RecipeOutcomeUnknownError); });
  expect((await readRecipeIntent(scope))?.payload.request_id).toBe(requestId);
  expect(invalidate).not.toHaveBeenCalled();
});

it.each([1, 9007199254740992, '0', '01', '-1', '9223372036854775808', '1e3', null])('rejects unsafe revision %j', value => {
  expect(() => recipeRevision(value)).toThrow();
});
it('uses exact narrow active keys and rejects create identity/basis/state keys', () => {
  expect(recipePayload({ ...input(), patch: 'active', active: false })).toEqual({ contract_version: 2, patch: 'active', id,
    request_id: requestId, expected_revision: '9007199254740993', active: false });
  const { id: _id, expectedRevision: _revision, ...create } = input();
  for (const forbidden of [{ id }, { expectedRevision: '1' }, { active: true }]) expect(() => recipePayload({ ...create, ...forbidden, patch: 'create' })).toThrow();
  expect(isRecipeRevisionConflict({ code: '45009', details: 'REVISION_CONFLICT' })).toBe(false);
});

it('requires latest review before a three-way merge and preserves only edited fields', async () => {
  const read = vi.fn().mockResolvedValue({ data: detail() });
  const h = renderHook(() => useRecipeEditRecovery(useRecipeEditorSession(id), read));
  const initial = { ...detail('9007199254740993'), name: '처음', price: 12000, memo: '처음 메모' };
  const draft = draftFromRecipe(initial, JSON.stringify(scope)); draft.name = '내 수정';
  let merged = draft;
  await act(async () => { expect(h.result.current.handleError({ code: '45009', detail: 'REVISION_CONFLICT' }, initial.editRevision)).toBe(true); });
  expect(h.result.current.isBlocked()).toBe(true); expect(merged.editRevision).toBe(initial.editRevision);
  act(() => { h.result.current.accept(latest => { merged = mergeRecipeDraft(draft, latest); }); });
  expect(merged).toMatchObject({ name: '내 수정', price: '15000', memo: '서버 메모', editRevision: '9007199254740994' });
  expect(h.result.current.isBlocked()).toBe(false); expect(m.rpc).not.toHaveBeenCalled();
});

it.each(['equal', 'older', 'wrong-target', 'error'] as const)('never unlocks conflict after a %s refetch', async failure => {
  const result = failure === 'error' ? { error: new Error('offline') } : { data: {
    ...detail(failure === 'equal' ? '9007199254740993' : failure === 'older' ? '1' : '9007199254740994'),
    id: failure === 'wrong-target' ? requestId : id } };
  const read = vi.fn().mockResolvedValue(result); const apply = vi.fn();
  const h = renderHook(() => useRecipeEditRecovery(useRecipeEditorSession(id), read));
  await act(async () => { await h.result.current.refresh('9007199254740993'); });
  act(() => h.result.current.accept(apply));
  expect(h.result.current.isBlocked()).toBe(true); expect(h.result.current.conflict?.error).toBeTruthy(); expect(apply).not.toHaveBeenCalled();
});

it('ignores a conflict read completing after blur and refocus', async () => {
  const pending = deferred<{ data: RecipeDetail }>(); const read = vi.fn().mockReturnValue(pending.promise);
  const h = renderHook(() => useRecipeEditRecovery(useRecipeEditorSession(id), read));
  let done!: Promise<void>; act(() => { done = h.result.current.refresh('1'); });
  m.focused = false; h.rerender(); m.focused = true; h.rerender();
  await act(async () => { pending.resolve({ data: detail() }); await done; });
  expect(h.result.current.conflict).toBeNull();
});
