import { createElement, useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Alert } from 'react-native';
import RecipeAddScreen from '@/features/recipes/screens/RecipeAddScreen';
import RecipeDetailScreen from '@/features/recipes/screens/RecipeDetailScreen';
import { emptyDraft, useRecipeDraft } from '@/features/recipes/draftStore';
import { keepRecipeIntent, readRecipeIntent } from '@/features/recipes/intentStorage';
import { recipePayload } from '@/features/recipes/writeContract';

// Real screens, hooks, rpcError and durable web journal. Only transport, native
// modal rendering, focus events and unrelated domain reads are controlled.
const m = vi.hoisted(() => ({ rpc: vi.fn(), replace: vi.fn(), focused: true, id: undefined as string | undefined }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: m.rpc }) }));
vi.mock('expo-secure-store', () => ({}));
vi.mock('@/lib/supabase', async original => await original<typeof import('@/lib/supabase')>());
vi.mock('@/lib/SessionProvider', () => ({ useSessionState: () => ({ userId: 'actor-boundary' }), useStoreId: () => 'store-boundary' }));
vi.mock('expo-router', () => ({ useFocusEffect: (fn: () => void | (() => void)) => useEffect(() => m.focused ? fn() : undefined, [fn, m.focused]),
  useLocalSearchParams: () => ({ id: m.id }), useRouter: () => ({ replace: m.replace, push: vi.fn() }),
  router: { canGoBack: () => false, replace: m.replace } }));
vi.mock('react-native', async original => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? createElement('div', { 'data-testid': 'boundary-modal' }, children) : null }));
vi.mock('@/features/master-data/hooks', () => ({ useSettingsLists: () => ({ data: { recipeCategories: [{ id: 'category', name: '분류' }] } }) }));
vi.mock('@/features/settings/hooks', () => ({ useStoreSettings: () => ({ data: { taxItems: [] } }) }));
vi.mock('@/features/business-day/businessDay', () => ({ useBusinessDay: () => ({ data: { timezone: 'Asia/Seoul' } }) }));
vi.mock('@/features/recipes/profitHistory', () => ({ deltaTone: () => 'flat', useProfitHistory: () => ({ data: { pages: [{ items: [] }] } }) }));
vi.mock('@/features/international-tax', () => ({ useAppCapabilities: () => ({ data: { internationalTax: { readEnabled: false, writeEnabled: false } } }),
  useRecipeTaxState: () => ({ data: null }) }));
vi.mock('@/features/international-tax/RecipeTaxStatusCard', () => ({ RecipeTaxStatusCard: () => null }));

const id = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const requestId = '00000000-0000-4000-8000-000000000011';
const scope = { actorId: 'actor-boundary', storeId: 'store-boundary' };
const raw = (target: string) => ({ id: target, edit_revision: '2', name: '현재 메뉴', price: 12000, base_servings: 1, target_profit_rate: 30,
  category_id: 'category', memo: '현재 메모', active: true, tax_items: [], fixed_month: '2026-09', fixed_items: [], lines: [], extras: [],
  last_change: { display_state: null, has_history: false } });
const conflict = { code: '45009', details: 'REVISION_CONFLICT', message: '다른 곳에서 메뉴가 수정됐어요. 최신 내용을 확인해 주세요.' };
const seed = (patch: 'full' | 'memo' | 'active', target = otherId) => keepRecipeIntent({ version: 1, scope,
  payload: recipePayload({ patch, requestId, id: target, expectedRevision: '1', name: '제출 메뉴', price: 10000, baseServings: 1,
    targetProfitRate: 30, memo: '제출 메모', active: false }) });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
beforeEach(() => { localStorage.clear(); useRecipeDraft.getState().reset(emptyDraft()); m.id = undefined; m.focused = true;
  m.rpc.mockReset(); m.replace.mockReset(); vi.spyOn(Alert, 'alert').mockImplementation(() => {});
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); });
afterEach(() => { cleanup(); client.clear(); useRecipeDraft.getState().reset(emptyDraft()); });
const wire = (write: () => unknown) => m.rpc.mockImplementation((name: string, args: { p_recipe?: string }) => name === 'save_recipe'
  ? write() : Promise.resolve({ data: raw(args.p_recipe!), error: null }));
async function resume() { const button = await screen.findByRole('button', { name: '이전 저장 결과 확인' });
  await waitFor(() => expect(button).toHaveProperty('disabled', false)); fireEvent.click(button); }

it('keeps a create receipt after blur and resolves the same key on refocus before a second create can be sent', async () => {
  const pending = deferred<{ data: string; error: null }>(); let calls = 0;
  wire(() => ++calls === 1 ? pending.promise : Promise.resolve({ data: id, error: null }));
  const tree = render(<RecipeAddScreen />, { wrapper });
  act(() => useRecipeDraft.getState().patch({ name: '새 메뉴', categoryId: 'category', price: '12000' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '레시피 추가' })).toHaveProperty('disabled', false));
  // RN Web configures PressResponder in a passive effect after the DOM enables
  // the button. Flush that effect before clicking, not only the mutation after it.
  await act(async () => {});
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '레시피 추가' })); });
  await waitFor(() => expect({ calls, alerts: vi.mocked(Alert.alert).mock.calls }).toEqual({ calls: 1, alerts: [] }));
  const original = (await readRecipeIntent(scope))!;
  m.focused = false; tree.rerender(<RecipeAddScreen />);
  await act(async () => { pending.resolve({ data: id, error: null }); await pending.promise; });
  await waitFor(() => expect(screen.getByRole('button', { name: '이전 저장 결과 확인' })).toHaveProperty('disabled', false));
  expect(await readRecipeIntent(scope)).toEqual(original); expect(m.replace).not.toHaveBeenCalled();
  m.focused = true; tree.rerender(<RecipeAddScreen />);
  expect(screen.getByRole('button', { name: '레시피 추가' })).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: '레시피 추가' })); expect(calls).toBe(1);
  await resume(); await waitFor(() => expect(m.replace).toHaveBeenCalledWith(`/recipes/add?id=${id}`));
  const bodies = m.rpc.mock.calls.filter(([name]) => name === 'save_recipe').map(([, args]) => args.p_payload);
  expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0]);
  expect(await readRecipeIntent(scope)).toBeNull();
});

it.each(['full', 'memo'] as const)('reports another target %s exact conflict as not applied without rebasing the current draft', async patch => {
  m.id = id; await seed(patch); wire(() => Promise.resolve({ data: null, error: conflict }));
  render(<RecipeAddScreen />, { wrapper }); await screen.findByRole('textbox', { name: '메뉴명' });
  fireEvent.change(screen.getByRole('textbox', { name: '메뉴명' }), { target: { value: '내 현재 초안' } });
  await resume(); await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('이전 저장은 적용되지 않았어요', expect.any(String)));
  expect(await readRecipeIntent(scope)).toBeNull(); expect(useRecipeDraft.getState().draft).toMatchObject({ id, name: '내 현재 초안', editRevision: '2' });
  expect(screen.queryByRole('button', { name: '최신 내용 확인' })).toBeNull(); expect(m.replace).not.toHaveBeenCalled();
});

it.each((['full', 'memo'] as const).flatMap(patch => ['transport', '40001', '40P01', 'wrong-detail', 'clear-failure'].map(failure => ({ patch, failure }))))(
  'does not claim another target $patch was rejected on $failure', async ({ patch, failure }) => {
  m.id = id; await seed(patch);
  if (failure === 'clear-failure') vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('cannot clear'); });
  wire(() => failure === 'transport' ? Promise.reject(new Error('network lost')) : Promise.resolve({ data: null,
    error: failure === 'clear-failure' ? conflict : { ...conflict, code: failure === 'wrong-detail' ? '45009' : failure,
      details: failure === 'wrong-detail' ? 'OTHER_CONFLICT' : 'REVISION_CONFLICT' } }));
  render(<RecipeAddScreen />, { wrapper }); await resume();
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('저장 확인을 마치지 못했어요', expect.any(String)));
  expect(Alert.alert).not.toHaveBeenCalledWith('이전 저장은 적용되지 않았어요', expect.anything());
  expect((await readRecipeIntent(scope))?.payload.request_id).toBe(requestId);
  expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', true);
});

it('keeps a current open memo conflict in visible recovery and requires separate acceptance and save', async () => {
  m.id = id; await seed('memo', id); wire(() => Promise.resolve({ data: null, error: conflict }));
  render(<RecipeDetailScreen />, { wrapper }); await screen.findByRole('button', { name: '메모 수정' });
  fireEvent.click(screen.getByRole('button', { name: '메모 수정' }));
  fireEvent.change(screen.getByRole('textbox', { name: '메모' }), { target: { value: '현재 입력' } });
  await resume(); await screen.findByRole('button', { name: '최신 내용 확인' });
  expect(Alert.alert).not.toHaveBeenCalled(); expect(await readRecipeIntent(scope)).toBeNull();
  expect(screen.getByRole('textbox', { name: '메모' })).toHaveProperty('value', '현재 입력');
  expect(within(screen.getByTestId('boundary-modal')).getByRole('button', { name: '완료' })).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: '최신 내용 확인' }));
  expect(m.rpc.mock.calls.filter(([name]) => name === 'save_recipe')).toHaveLength(1);
  expect(within(screen.getByTestId('boundary-modal')).getByRole('button', { name: '완료' })).toHaveProperty('disabled', false);
});

it.each(['memo', 'active'] as const)('does not report a closed %s replay as rejected on transport failure', async patch => {
  m.id = id; await seed(patch, id); wire(() => Promise.reject(new Error('lost')));
  render(<RecipeDetailScreen />, { wrapper }); await resume();
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('저장 확인을 마치지 못했어요', expect.any(String)));
  expect(Alert.alert).not.toHaveBeenCalledWith('이전 저장은 적용되지 않았어요', expect.anything());
  expect((await readRecipeIntent(scope))?.payload.request_id).toBe(requestId);
});

it.each(['memo', 'active'] as const)('explains that a closed %s editor replay conflict was not applied and asks to reopen it', async patch => {
  m.id = id; await seed(patch, id); wire(() => Promise.resolve({ data: null, error: conflict }));
  render(<RecipeDetailScreen />, { wrapper }); await resume();
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('이전 저장은 적용되지 않았어요', expect.stringContaining('다시')));
  expect(await readRecipeIntent(scope)).toBeNull(); expect(screen.queryByTestId('boundary-modal')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: patch === 'memo' ? '메모 수정' : '판매 중지' }));
  expect(screen.getByTestId('boundary-modal')).toBeTruthy();
});

it.each(['full', 'memo', 'active'] as const)('keeps another target %s conflict out of the current detail editor recovery', async patch => {
  m.id = id; await seed(patch); wire(() => Promise.resolve({ data: null, error: conflict }));
  render(<RecipeDetailScreen />, { wrapper }); await screen.findByRole('button', { name: '메모 수정' });
  if (patch === 'memo') fireEvent.click(screen.getByRole('button', { name: '메모 수정' }));
  await resume(); await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('이전 저장은 적용되지 않았어요', expect.stringContaining('해당 메뉴')));
  expect(await readRecipeIntent(scope)).toBeNull();
  expect(screen.queryByRole('button', { name: '최신 내용 확인' })).toBeNull();
});

it.each(['add', 'detail', 'memo'] as const)('surfaces unreadable journal discard failure in the %s UI and keeps writes blocked', async surface => {
  await seed('full'); const key = localStorage.key(0)!; localStorage.setItem(key, '{broken');
  wire(() => Promise.resolve({ data: id, error: null })); m.id = surface === 'add' ? undefined : id;
  render(surface === 'add' ? <RecipeAddScreen /> : <RecipeDetailScreen />, { wrapper });
  if (surface === 'memo') { await screen.findByRole('button', { name: '메모 수정' }); fireEvent.click(screen.getByRole('button', { name: '메모 수정' })); }
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage blocked'); });
  fireEvent.click(await screen.findByRole('button', { name: '확인 정보를 삭제하고 저장 계속하기' }));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('확인 정보를 삭제하지 못했어요', 'storage blocked'));
  expect(localStorage.getItem(key)).toBe('{broken'); expect(m.rpc.mock.calls.filter(([name]) => name === 'save_recipe')).toHaveLength(0);
  if (surface === 'add') expect(screen.getByRole('button', { name: '레시피 추가' })).toHaveProperty('disabled', true);
  if (surface === 'memo') expect(within(screen.getByTestId('boundary-modal')).getByRole('button', { name: '완료' })).toHaveProperty('disabled', true);
  remove.mockRestore();
});
