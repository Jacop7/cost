/** F2 acceptance under development. Real hook/form; transport is controlled.
 * No product write-intent implementation is mocked. No skip/expected-failure.
 * CONTRACT_UNAVAILABLE labels new protocol assertions, not observed DB defects.
 */
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSaveRecipe } from '@/features/recipes/hooks';
import { emptyDraft, useRecipeDraft } from '@/features/recipes/draftStore';
import RecipeAddScreen from '@/features/recipes/screens/RecipeAddScreen';
import { supabase } from '@/lib/supabase';
import { Alert } from 'react-native';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), replace: vi.fn(), routeId: undefined as string | undefined, storeId: 'store-owner-a' }));
// Load the real rpcError adapter; replace only client construction/native storage.
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mock.rpc }) }));
vi.mock('expo-secure-store', () => ({}));
vi.mock('@/lib/supabase', async original => await original<typeof import('@/lib/supabase')>());
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => mock.storeId }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mock.routeId }),
  useRouter: () => ({ push: vi.fn(), replace: mock.replace }),
  router: { canGoBack: () => false, replace: mock.replace },
}));
vi.mock('@/features/master-data/hooks', () => ({ useSettingsLists: () => ({ data: { recipeCategories: [{ id: 'category', name: '시험 분류' }] } }) }));
vi.mock('@/features/settings/hooks', () => ({ useStoreSettings: () => ({ data: { taxItems: [] } }) }));
vi.mock('react-native', async original => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? createElement('div', null, children) : null }));

const aId = '00000000-0000-4000-8000-000000000001';
const bId = '00000000-0000-4000-8000-000000000002';
const raw = (id: string) => ({ id, name: id === aId ? '메뉴 A' : '메뉴 B', price: 12000, base_servings: 10,
  target_profit_rate: 30, category_id: 'category', fixed_month: '2026-09', fixed_items: [],
  last_change: { display_state: null, has_history: false }, lines: [], extras: [], tax_items: [],
  // Proposed server input only: the real mapper must adopt this; no mapper stub.
  edit_revision: '1' });
const input = () => ({ id: aId, name: '메뉴 A', price: 12000, baseServings: 10, targetProfitRate: 30 });
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mock.routeId = undefined; mock.storeId = 'store-owner-a'; mock.rpc.mockReset(); mock.replace.mockClear();
  vi.spyOn(supabase, 'rpc' as never).mockImplementation(mock.rpc as never);
});
afterEach(() => { cleanup(); client.clear(); useRecipeDraft.getState().reset(emptyDraft()); });

describe('F2 current observable hook integrity', () => {
  it('keeps SQLSTATE 40001 and details so the UI can distinguish a conflict', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'conflict', details: 'REVISION_CONFLICT' } });
    const hook = renderHook(() => useSaveRecipe(), { wrapper });
    let caught: unknown;
    await act(async () => { try { await hook.result.current.mutateAsync(input()); } catch (e) { caught = e; } });
    expect(caught, 'OBSERVED_DEFECT: real hook stripped conflict code/details').toMatchObject({ code: '40001', detail: 'REVISION_CONFLICT' });
  });
  it.each([null, '', 'null', 'not-a-uuid', 123, { id: aId }])('rejects an invalid save result %j instead of turning it into a recipe identifier', async (data) => {
    mock.rpc.mockResolvedValue({ data, error: null });
    const hook = renderHook(() => useSaveRecipe(), { wrapper });
    let caught: unknown; let saved: unknown;
    await act(async () => { try { saved = await hook.result.current.mutateAsync(input()); } catch (e) { caught = e; } });
    expect(caught, `OBSERVED_DEFECT: invalid RPC UUID accepted as ${String(saved)}`).toBeInstanceOf(Error);
  });
  it('does not navigate to an old recipe when that save completes after changing targets', async () => {
    const pending = deferred<{ data: string; error: null }>();
    mock.routeId = aId;
    mock.rpc.mockImplementation((name: string, args: { p_recipe?: string }) => name === 'save_recipe'
      ? pending.promise : Promise.resolve({ data: raw(args.p_recipe!), error: null }));
    const tree = render(createElement(RecipeAddScreen), { wrapper });
    await waitFor(() => expect(useRecipeDraft.getState().draft.id).toBe(aId));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(mock.rpc.mock.calls.some(([name]) => name === 'save_recipe')).toBe(true));
    mock.routeId = bId; tree.rerender(createElement(RecipeAddScreen));
    await waitFor(() => expect(useRecipeDraft.getState().draft.id).toBe(bId));
    await act(async () => { pending.resolve({ data: aId, error: null }); await pending.promise; });
    expect(mock.replace, 'OBSERVED_DEFECT: old target completion caused navigation').not.toHaveBeenCalled();
    expect(useRecipeDraft.getState().draft.id).toBe(bId);
  });
  it('does not navigate after the active store changes while a save is pending', async () => {
    const pending = deferred<{ data: string; error: null }>();
    mock.routeId = aId;
    mock.rpc.mockImplementation((name: string, args: { p_recipe?: string }) => name === 'save_recipe'
      ? pending.promise : Promise.resolve({ data: raw(args.p_recipe!), error: null }));
    const tree = render(createElement(RecipeAddScreen), { wrapper });
    await waitFor(() => expect(useRecipeDraft.getState().draft.id).toBe(aId));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(mock.rpc.mock.calls.some(([name]) => name === 'save_recipe')).toBe(true));
    const call = mock.rpc.mock.calls.find(([name]) => name === 'save_recipe')!;
    expect(call[1].p_store).toBe('store-owner-a');
    mock.storeId = 'store-owner-b'; tree.rerender(createElement(RecipeAddScreen));
    fireEvent.change(screen.getByRole('textbox', { name: '판매가' }), { target: { value: '18000' } });
    await act(async () => { pending.resolve({ data: aId, error: null }); await pending.promise; });
    expect(mock.replace, 'OBSERVED_DEFECT: previous store completion caused navigation').not.toHaveBeenCalled();
    expect(useRecipeDraft.getState().draft.price).toBe('18000');
  });
  it('keeps a new editing generation even when the user returns to the same recipe ID', async () => {
    const pending = deferred<{ data: string; error: null }>();
    mock.routeId = aId;
    mock.rpc.mockImplementation((name: string, args: { p_recipe?: string }) => name === 'save_recipe'
      ? pending.promise : Promise.resolve({ data: raw(args.p_recipe!), error: null }));
    const tree = render(createElement(RecipeAddScreen), { wrapper });
    await waitFor(() => expect(useRecipeDraft.getState().draft.id).toBe(aId));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(mock.rpc.mock.calls.some(([name]) => name === 'save_recipe')).toBe(true));
    mock.routeId = bId; tree.rerender(createElement(RecipeAddScreen));
    await waitFor(() => expect(useRecipeDraft.getState().draft.id).toBe(bId));
    mock.routeId = aId; tree.rerender(createElement(RecipeAddScreen));
    await waitFor(() => expect(useRecipeDraft.getState().draft.id).toBe(aId));
    fireEvent.change(screen.getByRole('textbox', { name: '판매가' }), { target: { value: '18000' } });
    expect(useRecipeDraft.getState().draft.price).toBe('18000');
    await act(async () => { pending.resolve({ data: aId, error: null }); await pending.promise; });
    expect(mock.replace, 'OBSERVED_DEFECT: matching ID hid an obsolete editing generation').not.toHaveBeenCalled();
    expect(useRecipeDraft.getState().draft.price).toBe('18000');
  });
  it.each(['target', 'store', 'generation'] as const)('ignores a late error and settlement after changing %s', async (change) => {
    const pending = deferred<{ data: null; error: { message: string; code: string } }>();
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    mock.routeId = aId;
    mock.rpc.mockImplementation((name: string, args: { p_recipe?: string }) => name === 'save_recipe'
      ? pending.promise : Promise.resolve({ data: raw(args.p_recipe!), error: null }));
    const tree = render(createElement(RecipeAddScreen), { wrapper });
    await waitFor(() => expect(useRecipeDraft.getState().draft.id).toBe(aId));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', true));
    if (change === 'store') mock.storeId = 'store-owner-b';
    else mock.routeId = bId;
    tree.rerender(createElement(RecipeAddScreen));
    await waitFor(() => expect(useRecipeDraft.getState().draft.id).toBe(mock.routeId));
    if (change === 'generation') {
      mock.routeId = aId; tree.rerender(createElement(RecipeAddScreen));
      await waitFor(() => expect(useRecipeDraft.getState().draft.id).toBe(aId));
    }
    fireEvent.change(screen.getByRole('textbox', { name: '판매가' }), { target: { value: '18000' } });
    await act(async () => { pending.resolve({ data: null, error: { message: 'old save failed', code: '40001' } }); await pending.promise; });
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
    expect(alert).not.toHaveBeenCalled();
    expect(mock.replace).not.toHaveBeenCalled();
    expect(useRecipeDraft.getState().draft.price).toBe('18000');
  });
  it('keeps normal current-generation success and resets the draft before navigating', async () => {
    const pending = deferred<{ data: string; error: null }>();
    mock.routeId = aId;
    mock.rpc.mockImplementation((name: string, args: { p_recipe?: string }) => name === 'save_recipe'
      ? pending.promise : Promise.resolve({ data: raw(args.p_recipe!), error: null }));
    render(createElement(RecipeAddScreen), { wrapper });
    await waitFor(() => expect(useRecipeDraft.getState().draft.id).toBe(aId));
    let resetObserved = false;
    const unsubscribe = useRecipeDraft.subscribe(({ draft }) => { if (draft.id === undefined && draft.name === '') resetObserved = true; });
    try {
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
      await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', true));
      await act(async () => { pending.resolve({ data: aId, error: null }); await pending.promise; });
      await waitFor(() => expect(mock.replace).toHaveBeenCalledWith(`/recipes/${aId}`));
      expect(mock.replace).toHaveBeenCalledTimes(1);
      expect(resetObserved).toBe(true);
    } finally { unsubscribe(); }
  });
  it('shows a current-generation error, preserves input and releases the pending state', async () => {
    const pending = deferred<{ data: null; error: { message: string; code: string } }>();
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    mock.routeId = aId;
    mock.rpc.mockImplementation((name: string, args: { p_recipe?: string }) => name === 'save_recipe'
      ? pending.promise : Promise.resolve({ data: raw(args.p_recipe!), error: null }));
    render(createElement(RecipeAddScreen), { wrapper });
    await waitFor(() => expect(useRecipeDraft.getState().draft.id).toBe(aId));
    fireEvent.change(screen.getByRole('textbox', { name: '판매가' }), { target: { value: '18000' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', true));
    await act(async () => { pending.resolve({ data: null, error: { message: 'current save failed', code: '40001' } }); await pending.promise; });
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
    expect(alert).toHaveBeenCalledWith('저장하지 못했어요', 'current save failed');
    expect(alert).toHaveBeenCalledTimes(1);
    expect(mock.replace).not.toHaveBeenCalled();
    expect(useRecipeDraft.getState().draft.price).toBe('18000');
  });
});
