vi.mock('@/features/recipes/useRecipeCostSettings', () => ({ useRecipeCostSettings: () => ({ month: '2026-09', fixedPresence: 'configured', taxPresence: 'configured', fixedData: undefined, retry: vi.fn() }) }));
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Simulation from '@/features/recipes/screens/RecipePriceSimulationScreen';
import { useRecipeDraft } from '@/features/recipes/draftStore';
import { draftPreviewInput } from '@/features/recipes/draftPreviewInput';
import { actor, store, recipe, previewRaw, previewInput } from './fixtures/recipeDraftPreview';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), id: undefined as string | undefined, actor: '', back: vi.fn(), legacy: false }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mock.rpc }, rpcError: (e: { message: string }) => new Error(e.message) }));
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => store, useSessionState: () => ({ userId: mock.actor }) }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }), useLocalSearchParams: () => ({ id: mock.id, draft: '1' }), router: { canGoBack: () => false, replace: mock.back } }));
vi.mock('@/features/international-tax', () => ({ useAppCapabilities: () => ({ data: { internationalTax: { readEnabled: !mock.legacy } }, isLoading: false }) }));
vi.mock('@/features/settings/hooks', () => ({ useStoreSettings: () => ({ data: { taxItems: [] }, isLoading: false }) }));
vi.mock('@/features/recipes/hooks', () => ({ useRecipeDetail: () => ({ data: mock.id ? { fixedRate: 0.313 } : undefined, isLoading: false, isFetched: true }) }));
let client: QueryClient;
const show = () => render(<QueryClientProvider client={client}><Simulation /></QueryClientProvider>);
beforeEach(() => {
  mock.rpc.mockReset(); mock.back.mockReset(); mock.actor = actor; mock.id = undefined; mock.legacy = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useRecipeDraft.getState().reset({ scopeKey: JSON.stringify({ actorId: actor, storeId: store }), price: '12.34', baseServings: '2', targetProfitRate: '30',
    lines: [{ ingredientId: store, subRecipeId: null, name: '현재 재료', unit: 'g', inputQty: 100, unitPrice: 0.02 }],
    extras: [{ materialId: null, name: '현재 부자재', unitCost: 1, amountPerServing: 1, qty: 1 }] });
  mock.rpc.mockImplementation((_name, { p_input }) => Promise.resolve({ data: previewRaw(p_input), error: null }));
});
afterEach(() => { cleanup(); client.clear(); useRecipeDraft.getState().reset(); });
it.each(['create', 'edit'])('%s: unsaved values feed draft RPC; simulation inputs and back never change the form', async mode => {
  if (mode === 'edit') { mock.id = recipe; useRecipeDraft.getState().patch({ id: recipe, loaded: true }); }
  const before = structuredClone(useRecipeDraft.getState().draft);
  show(); await screen.findByText('$15.74');
  expect(mock.rpc).toHaveBeenCalledWith('recipe_draft_preview', { p_store: store, p_input: draftPreviewInput(before) });
  expect(screen.getByRole('textbox', { name: '시뮬레이션 판매량' })).toHaveProperty('value', '2');
  fireEvent.change(screen.getByRole('textbox', { name: '시뮬레이션 판매가' }), { target: { value: '20' } });
  await waitFor(() => expect(mock.rpc).toHaveBeenLastCalledWith('recipe_draft_preview', { p_store: store, p_input: { ...draftPreviewInput(before), price: 20 } }));
  fireEvent.change(screen.getByRole('textbox', { name: '시뮬레이션 판매량' }), { target: { value: '3' } });
  await screen.findByText('$23.62');
  expect(mock.rpc).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('button', { name: /적용|저장/ })).toBeNull();
  expect(screen.queryByRole('tab')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
  expect(mock.back).toHaveBeenCalledWith(`/recipes/add${mock.id ? `?id=${mock.id}` : ''}`);
  expect(useRecipeDraft.getState().draft).toEqual(before);
});
it('rejects a draft owned by another actor or a different edit route before any read', () => {
  mock.actor = 'another-actor'; const view = show();
  expect(screen.getByText('메뉴 등록·수정 화면에서 다시 열어 주세요.')).toBeTruthy(); expect(mock.rpc).not.toHaveBeenCalled();
  mock.actor = actor; mock.id = recipe; view.rerender(<QueryClientProvider client={client}><Simulation /></QueryClientProvider>);
  expect(screen.queryByRole('textbox')).toBeNull(); expect(mock.rpc).not.toHaveBeenCalled();
});
it('invalid input clears results and a late old price cannot replace the current result', async () => {
  let resolve!: (data: unknown) => void;
  mock.rpc.mockImplementation((_name, { p_input }) => p_input.price === 12.34 ? new Promise(r => { resolve = r; }) : Promise.resolve({ data: previewRaw(p_input, 15), error: null }));
  show(); await waitFor(() => expect(mock.rpc).toHaveBeenCalledTimes(1));
  const price = screen.getByRole('textbox', { name: '시뮬레이션 판매가' });
  fireEvent.change(price, { target: { value: '20' } }); await screen.findByText('$30.00');
  await act(async () => resolve({ data: previewRaw(previewInput()), error: null }));
  expect(screen.queryByText('$15.74')).toBeNull();
  fireEvent.change(price, { target: { value: '' } });
  expect(screen.queryByText('$30.00')).toBeNull(); expect(mock.rpc).toHaveBeenCalledTimes(2);
});
it('missing extra costs stay unknown at different quantities', async () => {
  mock.rpc.mockImplementation((_name, { p_input }) => { const raw = previewRaw(p_input); return Promise.resolve({ error: null, data: {
    ...raw, basis: { ...raw.basis, extra_per_serving: null },
    one: { ...raw.one, extra: null, profit: null, profit_rate: null, meets_target: null },
    batch: { ...raw.batch, extra: null, profit: null, profit_rate: null, meets_target: null },
    recommendation: { status: 'basis_missing', price: null, quote: null, profit: null, profit_rate: null },
  } }); });
  show(); await screen.findByText('순이익률 산출 전');
  fireEvent.change(screen.getByRole('textbox', { name: '시뮬레이션 판매량' }), { target: { value: '5' } });
  expect(screen.getAllByText('산출 전').length).toBeGreaterThanOrEqual(2);
});
it('explicit legacy mode uses draft amounts without write or international RPC', () => {
  mock.legacy = true; useRecipeDraft.getState().patch({ price: '1000' }); const before = structuredClone(useRecipeDraft.getState().draft);
  show(); expect(screen.getByRole('textbox', { name: '시뮬레이션 판매량' })).toHaveProperty('value', '2');
  fireEvent.change(screen.getByRole('textbox', { name: '시뮬레이션 판매가' }), { target: { value: '2000' } });
  expect(useRecipeDraft.getState().draft).toEqual(before); expect(mock.rpc).not.toHaveBeenCalled();
});


it.each([['create', false], ['edit', false], ['create', true], ['edit', true]] as const)(
  '%s legacy=%s: incomplete inputs show zero rows without quoting or changing the draft', (mode, legacy) => {
    mock.legacy = legacy;
    if (mode === 'edit') { mock.id = recipe; useRecipeDraft.getState().patch({ id: recipe, loaded: true }); }
    useRecipeDraft.getState().patch({ price: '', baseServings: '', targetProfitRate: '' });
    const before = structuredClone(useRecipeDraft.getState().draft);
    show();
    for (const label of ['(−) 세금', '(−) 재료', '(−) 고정 지출', '순이익', '권장 판매가']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(within(screen.getByTestId('simulation-summary')).getAllByText('0원')).toHaveLength(5);
    expect(within(screen.getByTestId('simulation-summary')).getAllByText('0%')).toHaveLength(5);
    expect(screen.queryByText(/입력을 확인|판매량을 1인분/)).toBeNull();
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(useRecipeDraft.getState().draft).toEqual(before);
  },
);
it('clearing and restoring quantity switches between initial zeros and the server result', async () => {
  show(); await screen.findByText('$15.74');
  const quantity = screen.getByRole('textbox', { name: '시뮬레이션 판매량' });
  fireEvent.change(quantity, { target: { value: '' } });
  expect(within(screen.getByTestId('simulation-summary')).getAllByText('0원')).toHaveLength(5);
  expect(screen.queryByText('$15.74')).toBeNull();
  fireEvent.change(quantity, { target: { value: '2' } });
  await screen.findByText('$15.74');
  expect(mock.rpc).toHaveBeenCalledTimes(1);
});
