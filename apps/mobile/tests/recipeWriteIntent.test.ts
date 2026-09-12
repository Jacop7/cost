/** F2 acceptance under development. Real hook/form; transport is controlled.
 * No product write-intent implementation is mocked. No skip/expected-failure.
 * CONTRACT_UNAVAILABLE labels new protocol assertions, not observed DB defects.
 */
import { createElement, useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSaveRecipe } from '@/features/recipes/hooks';
import { emptyDraft, useRecipeDraft } from '@/features/recipes/draftStore';
import RecipeAddScreen from '@/features/recipes/screens/RecipeAddScreen';
import { supabase } from '@/lib/supabase';
import { Alert } from 'react-native';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), replace: vi.fn(), focused: true, routeId: undefined as string | undefined, storeId: 'store-owner-a' }));
// Load the real rpcError adapter; replace only client construction/native storage.
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mock.rpc }) }));
vi.mock('expo-secure-store', () => ({}));
vi.mock('@/lib/supabase', async original => await original<typeof import('@/lib/supabase')>());
vi.mock('@/lib/SessionProvider', () => ({ useSessionState: () => ({ userId: 'recipe-actor-a' }), useStoreId: () => mock.storeId }));
vi.mock('expo-router', () => ({ useFocusEffect: (fn: () => void | (() => void)) => useEffect(() => mock.focused ? fn() : undefined, [fn, mock.focused]),
  useLocalSearchParams: () => ({ id: mock.routeId }),
  useRouter: () => ({ push: vi.fn(), replace: mock.replace }),
  router: { canGoBack: () => false, replace: mock.replace },
}));
vi.mock('@/features/master-data/hooks', () => ({ useSettingsLists: () => ({ data: { recipeCategories: [{ id: 'category', name: '시험 분류' }] } }) }));
vi.mock('@/features/settings/hooks', () => ({ useStoreSettings: () => ({ data: { taxItems: [] } }) }));
vi.mock('@/features/international-tax', () => ({
  useAppCapabilities: () => ({ data: { internationalTax: { readEnabled: false } }, isLoading: false, error: null, refetch: vi.fn() }),
}));
vi.mock('react-native', async original => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? createElement('div', null, children) : null }));

const aId = '00000000-0000-4000-8000-000000000001';
const bId = '00000000-0000-4000-8000-000000000002';
const raw = (id: string) => ({ id, name: id === aId ? '메뉴 A' : '메뉴 B', price: 12000, base_servings: 10,
  target_profit_rate: 30, category_id: 'category', fixed_month: '2026-09', fixed_items: [],
  last_change: { display_state: null, has_history: false }, lines: [], extras: [], tax_items: [],
  // Proposed server input only: the real mapper must adopt this; no mapper stub.
  edit_revision: '1' });
const input = () => ({ patch: 'full' as const, requestId: '00000000-0000-4000-8000-000000000011', expectedRevision: '1', id: aId, name: '메뉴 A', price: 12000, baseServings: 10, targetProfitRate: 30 });
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
beforeEach(() => {
  localStorage.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mock.routeId = undefined; mock.focused = true; mock.storeId = 'store-owner-a'; mock.rpc.mockReset(); mock.replace.mockClear();
  vi.spyOn(supabase, 'rpc' as never).mockImplementation(mock.rpc as never);
});

describe('F2 form recovery interactions with real hooks', () => {
  it('reviews a full conflict without writing, then uses a new key/latest basis with edited and untouched fields merged', async () => {
    mock.routeId = aId; let latest = raw(aId); let writes = 0;
    mock.rpc.mockImplementation(async (name: string) => {
      if (name !== 'save_recipe') return { data: latest, error: null };
      if (++writes === 1) { latest = { ...raw(aId), name: '다른 곳의 메뉴명', price: 15000, edit_revision: '2' };
        return { data: null, error: { code: '45009', details: 'REVISION_CONFLICT', message: 'conflict' } }; }
      return { data: aId, error: null };
    });
    render(createElement(RecipeAddScreen), { wrapper });
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
    fireEvent.change(screen.getByRole('textbox', { name: '메뉴명' }), { target: { value: '내 메뉴명' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    const review = await screen.findByRole('button', { name: '최신 내용 확인' });
    expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('textbox', { name: '판매가' })).toHaveProperty('value', '12000');
    fireEvent.click(review); expect(writes).toBe(1);
    expect(screen.getByRole('textbox', { name: '메뉴명' })).toHaveProperty('value', '내 메뉴명');
    expect(screen.getByRole('textbox', { name: '판매가' })).toHaveProperty('value', '15000');
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(writes).toBe(2));
    const bodies = mock.rpc.mock.calls.filter(([name]) => name === 'save_recipe').map(([, args]) => args.p_payload);
    expect(bodies[0]).toMatchObject({ expected_revision: '1', price: 12000, name: '내 메뉴명' });
    expect(bodies[1]).toMatchObject({ expected_revision: '2', price: 15000, name: '내 메뉴명' });
    expect(bodies[1].request_id).not.toBe(bodies[0].request_id);
    await waitFor(() => expect(mock.replace).toHaveBeenCalledTimes(1));
  });

  it('preserves typing after submission when success arrives and requires review before another write', async () => {
    mock.routeId = aId; let latest = raw(aId); const pending = deferred<{ data: string; error: null }>();
    mock.rpc.mockImplementation((name: string) => name === 'save_recipe' ? pending.promise : Promise.resolve({ data: latest, error: null }));
    render(createElement(RecipeAddScreen), { wrapper });
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(mock.rpc.mock.calls.some(([name]) => name === 'save_recipe')).toBe(true));
    fireEvent.change(screen.getByRole('textbox', { name: '판매가' }), { target: { value: '18000' } });
    latest = { ...raw(aId), edit_revision: '2' };
    await act(async () => { pending.resolve({ data: aId, error: null }); await pending.promise; });
    await screen.findByRole('button', { name: '최신 내용 확인' });
    expect(useRecipeDraft.getState().draft.price).toBe('18000'); expect(mock.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: '최신 내용 확인' }));
    expect(useRecipeDraft.getState().draft).toMatchObject({ price: '18000', editRevision: '2', needsReview: false });
    expect(mock.rpc.mock.calls.filter(([name]) => name === 'save_recipe')).toHaveLength(1);
  });

  it.each(['blur', 'unmount'] as const)('does not navigate or reset a draft after %s while the request completes', async leave => {
    mock.routeId = aId; const pending = deferred<{ data: string; error: null }>();
    mock.rpc.mockImplementation((name: string) => name === 'save_recipe' ? pending.promise : Promise.resolve({ data: raw(aId), error: null }));
    const tree = render(createElement(RecipeAddScreen), { wrapper });
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(mock.rpc.mock.calls.some(([name]) => name === 'save_recipe')).toBe(true));
    if (leave === 'unmount') tree.unmount(); else { mock.focused = false; tree.rerender(createElement(RecipeAddScreen)); }
    await act(async () => { pending.resolve({ data: aId, error: null }); await pending.promise; });
    expect(mock.replace).not.toHaveBeenCalled(); expect(useRecipeDraft.getState().draft.id).toBe(aId);
  });

  it('requires receipt replay after an off-screen create succeeds instead of issuing a second create', async () => {
    const pending = deferred<{ data: string; error: null }>();
    mock.rpc.mockImplementation((name: string) => name === 'save_recipe' ? pending.promise : Promise.resolve({ data: raw(aId), error: null }));
    const tree = render(createElement(RecipeAddScreen), { wrapper });
    await act(async () => { useRecipeDraft.getState().patch({ name: '늦은 생성', categoryId: 'category', price: '12000' }); });
    await waitFor(() => expect(screen.getByRole('button', { name: '메뉴 추가' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: '메뉴 추가' }));
    await waitFor(() => expect(mock.rpc.mock.calls.some(([name]) => name === 'save_recipe')).toBe(true));
    tree.unmount();
    await act(async () => { pending.resolve({ data: aId, error: null }); await pending.promise; });
    expect(useRecipeDraft.getState().draft.id).toBeUndefined();
    render(createElement(RecipeAddScreen), { wrapper });
    await screen.findByRole('button', { name: '이전 저장 결과 확인' });
    expect(screen.getByRole('button', { name: '메뉴 추가' })).toHaveProperty('disabled', true);
    expect(mock.rpc.mock.calls.filter(([name]) => name === 'save_recipe')).toHaveLength(1);
  });

  it('requires receipt replay after a blurred create succeeds instead of issuing a second create', async () => {
    const pending = deferred<{ data: string; error: null }>();
    mock.rpc.mockImplementation((name: string) => name === 'save_recipe' ? pending.promise : Promise.resolve({ data: raw(aId), error: null }));
    const tree = render(createElement(RecipeAddScreen), { wrapper });
    await act(async () => { useRecipeDraft.getState().patch({ name: '흐림 생성', categoryId: 'category', price: '12000' }); });
    await waitFor(() => expect(screen.getByRole('button', { name: '메뉴 추가' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: '메뉴 추가' }));
    await waitFor(() => expect(mock.rpc.mock.calls.some(([name]) => name === 'save_recipe')).toBe(true));
    mock.focused = false; tree.rerender(createElement(RecipeAddScreen));
    await act(async () => { pending.resolve({ data: aId, error: null }); await pending.promise; });
    mock.focused = true; tree.rerender(createElement(RecipeAddScreen));
    await screen.findByRole('button', { name: '이전 저장 결과 확인' });
    expect(screen.getByRole('button', { name: '메뉴 추가' })).toHaveProperty('disabled', true);
    expect(mock.rpc.mock.calls.filter(([name]) => name === 'save_recipe')).toHaveLength(1);
  });

  it('reconciles an unknown create as the saved target and keeps later input without issuing another create', async () => {
    let writes = 0;
    mock.rpc.mockImplementation(async (name: string) => {
      if (name !== 'save_recipe') return { data: raw(aId), error: null };
      if (++writes === 1) throw new Error('response lost');
      return { data: aId, error: null };
    });
    const tree = render(createElement(RecipeAddScreen), { wrapper });
    // Flush RN Web's passive PressResponder configuration as well as the DOM
    // enabled state before clicking. A synchronous act can expose enabled DOM
    // while the responder still holds its previous disabled configuration.
    await act(async () => { useRecipeDraft.getState().patch({ name: '신규 메뉴', categoryId: 'category', price: '12000' }); });
    await waitFor(() => expect(screen.getByRole('button', { name: '메뉴 추가' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: '메뉴 추가' }));
    const resume = await screen.findByRole('button', { name: '이전 저장 결과 확인' });
    await waitFor(() => expect(resume).toHaveProperty('disabled', false));
    fireEvent.change(screen.getByRole('textbox', { name: '메뉴명' }), { target: { value: '추가로 고친 이름' } });
    expect(screen.getByRole('button', { name: '메뉴 추가' })).toHaveProperty('disabled', true);
    fireEvent.click(resume);
    await waitFor(() => expect(mock.replace).toHaveBeenCalledWith(`/recipes/add?id=${aId}`));
    const bodies = mock.rpc.mock.calls.filter(([name]) => name === 'save_recipe').map(([, args]) => args.p_payload);
    expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0]);
    mock.routeId = aId; tree.rerender(createElement(RecipeAddScreen));
    await screen.findByRole('button', { name: '최신 내용 확인' });
    expect(useRecipeDraft.getState().draft).toMatchObject({ id: aId, name: '추가로 고친 이름', needsReview: true });
    fireEvent.click(screen.getByRole('button', { name: '최신 내용 확인' }));
    expect(useRecipeDraft.getState().draft.name).toBe('추가로 고친 이름'); expect(writes).toBe(2);
  });
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
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
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
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(mock.rpc.mock.calls.some(([name]) => name === 'save_recipe')).toBe(true));
    const call = mock.rpc.mock.calls.find(([name]) => name === 'save_recipe')!;
    expect(call[1].p_store).toBe('store-owner-a');
    mock.storeId = 'store-owner-b'; tree.rerender(createElement(RecipeAddScreen));
    await waitFor(() => expect(useRecipeDraft.getState().draft.scopeKey).toBe(JSON.stringify({ actorId: 'recipe-actor-a', storeId: mock.storeId })));
    fireEvent.change(await screen.findByRole('textbox', { name: '판매가' }), { target: { value: '18000' } });
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
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(mock.rpc.mock.calls.some(([name]) => name === 'save_recipe')).toBe(true));
    mock.routeId = bId; tree.rerender(createElement(RecipeAddScreen));
    await waitFor(() => expect(useRecipeDraft.getState().draft.id).toBe(bId));
    mock.routeId = aId; tree.rerender(createElement(RecipeAddScreen));
    await waitFor(() => expect(useRecipeDraft.getState().draft.id).toBe(aId));
    await waitFor(() => expect(useRecipeDraft.getState().draft.scopeKey).toBe(JSON.stringify({ actorId: 'recipe-actor-a', storeId: mock.storeId })));
    fireEvent.change(await screen.findByRole('textbox', { name: '판매가' }), { target: { value: '18000' } });
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
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
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
    await waitFor(() => expect(useRecipeDraft.getState().draft.scopeKey).toBe(JSON.stringify({ actorId: 'recipe-actor-a', storeId: mock.storeId })));
    fireEvent.change(await screen.findByRole('textbox', { name: '판매가' }), { target: { value: '18000' } });
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
      await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
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
    await waitFor(() => expect(useRecipeDraft.getState().draft.scopeKey).toBe(JSON.stringify({ actorId: 'recipe-actor-a', storeId: mock.storeId })));
    fireEvent.change(await screen.findByRole('textbox', { name: '판매가' }), { target: { value: '18000' } });
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
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
