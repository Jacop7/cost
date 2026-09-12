/** Opt-in real PostgreSQL -> real recipe hooks -> real form/draft -> save_recipe.
 * Run alone with RECIPE_ROUNDTRIP_DB=fresh_...; never use a shared development DB.
 * Transport is docker/psql with the application's JWT/RLS role, not HTTP/PostgREST.
 */
import { recipeRequestId } from '@/features/recipes/writeContract';
vi.mock('expo-secure-store', () => ({}));
import { spawnSync } from 'node:child_process';
import { env } from 'node:process';
import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RecipeAddScreen from '@/features/recipes/screens/RecipeAddScreen';
import { emptyDraft, useRecipeDraft } from '@/features/recipes/draftStore';
import { useRecipeDetail } from '@/features/recipes/hooks';

const transport = vi.hoisted(() => ({ rpc: vi.fn(), id: '', categories: [] as { id: string; name: string }[], replace: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: transport.rpc } }));
vi.mock('@/lib/SessionProvider', () => ({ useSessionState: () => ({ userId: 'recipe-actor-a' }), useStoreId: () => '00000000-0000-0000-0000-0000000000b1' }));
vi.mock('expo-router', () => ({ useFocusEffect: (fn: () => void | (() => void)) => useEffect(fn, [fn]),
  useLocalSearchParams: () => ({ id: transport.id }),
  useRouter: () => ({ push: vi.fn(), replace: transport.replace }),
  router: { canGoBack: () => false, replace: transport.replace },
}));
vi.mock('@/features/master-data/hooks', () => ({ useSettingsLists: () => ({ data: { recipeCategories: transport.categories } }) }));
vi.mock('@/features/settings/hooks', () => ({ useStoreSettings: () => ({ data: { taxItems: [] } }) }));
vi.mock('react-native', async (original) => ({
  ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div data-testid="sheet">{children}</div> : null,
}));

const testEnv: Record<string, string | undefined> = env;
const db = testEnv['RECIPE_ROUNDTRIP_DB'];
const store = '00000000-0000-0000-0000-0000000000b1';
const literal = (value: unknown) => `'${String(value).replace(/'/g, "''")}'`;
function query(sql: string) {
  if (!db || !/^fresh_[a-z0-9_]+$/.test(db)) throw new Error('An explicit isolated fresh_* database is required');
  const result = spawnSync('docker', ['exec', '-i', testEnv['SUPABASE_DB_CONTAINER'] ?? 'supabase_db_margincook',
    'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-qAt'], {
    input: `begin; set local role margincook_rpc_executor;
      set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
      ${sql}; commit;`, encoding: 'utf8', timeout: 15000,
  });
  if (result.status !== 0) throw new Error(result.stderr || String(result.error));
  return JSON.parse(result.stdout.trim());
}
function rpc(name: string, args: Record<string, unknown>): unknown {
  if (name === 'recipe_detail') return query(`select public.recipe_detail(${literal(args.p_recipe)}::uuid)`);
  if (name === 'save_recipe') return query(`select to_jsonb(public.save_recipe(${literal(store)}::uuid,${literal(JSON.stringify(args.p_payload))}::jsonb))`);
  throw new Error(`Unexpected RPC ${name}`);
}
function snapshot() {
  return query(`select jsonb_build_object(
    'inventory', (select md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'')) from inventory_events e where store_id=${literal(store)}::uuid),
    'days', (select md5(coalesce(jsonb_agg(jsonb_build_array(id,snapshot) order by id)::text,'')) from business_days where store_id=${literal(store)}::uuid))`);
}
function fixture(qty: number, linked: boolean) {
  const suffix = `${Date.now()}-${Math.random()}`;
  const category = query(`select to_jsonb(save_category(${literal(store)}::uuid,${literal(JSON.stringify({ name: `F1 ${suffix}`, kind: 'recipe' }))}::jsonb))`) as string;
  const material = query(`select to_jsonb(save_material(${literal(store)}::uuid,${literal(JSON.stringify({ name: `용기 ${suffix}`, unit_cost: 300, unit_label: '개' }))}::jsonb))`) as string;
  const name = `F1 메뉴 ${suffix}`;
  const id = rpc('save_recipe', { p_payload: { contract_version: 2, patch: 'create', request_id: recipeRequestId(), name, price: 12000, base_servings: 10,
    category_id: category, target_profit_rate: 30, extras: [{ material_id: linked ? material : '', name: '독립 비용', qty, amount: 100 }] } }) as string;
  return { id, name, category, material, suffix };
}
let client: QueryClient | undefined;
afterEach(() => { localStorage.clear(); cleanup(); client?.clear(); useRecipeDraft.getState().reset(emptyDraft()); vi.clearAllMocks(); });

describe('F1 raw response safety (transport fixture, no DB)', () => {
  const raw = () => ({ id: 'recipe', edit_revision: '1', name: '메뉴', category_id: null, fixed_month: '2026-09', fixed_items: [],
    last_change: { display_state: null, has_history: false },
    extras: [{ id: 'extra', name: '기존 비용', material_id: null, qty: 0, amount: 100 }] });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client!}>{children}</QueryClientProvider>;
  it('shows the held basis in detail while keeping saved edits in their separate cache', async () => {
    const saved = { ...raw(), price: 15000, application_mode: 'after_close' };
    transport.rpc.mockResolvedValue({ data: { ...saved, effective: { ...saved, price: 12000 } }, error: null });
    client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const view = renderHook(() => useRecipeDetail('recipe', { readOnly: true }), { wrapper });
    const edit = renderHook(() => useRecipeDetail('recipe'), { wrapper });
    await waitFor(() => expect(view.result.current.data?.price).toBe(12000));
    await waitFor(() => expect(edit.result.current.data?.price).toBe(15000));
    expect(view.result.current.data?.applicationMode).toBe('after_close');
    transport.rpc.mockResolvedValue({ data: { ...saved, application_mode: 'immediate' }, error: null });
    await client.invalidateQueries();
    await waitFor(() => expect(view.result.current.data?.price).toBe(15000));
    expect(view.result.current.data?.applicationMode).toBe('immediate');
  });
  it('preserves explicit null category/material and zero quantity instead of defaulting to one', async () => {
    transport.rpc.mockResolvedValue({ data: raw(), error: null });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const hook = renderHook(() => useRecipeDetail('recipe'), { wrapper });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(hook.result.current.data).toMatchObject({ categoryId: null, extras: [{ materialId: null, qty: 0, amount: 100 }] });
  });
  it.each(['category_id', 'material_id', 'qty', 'amount'])('rejects missing %s instead of silently losing edit data', async (field) => {
    const data = raw();
    if (field === 'category_id') Reflect.deleteProperty(data, field);
    else Reflect.deleteProperty(data.extras[0]!, field);
    transport.rpc.mockResolvedValue({ data, error: null });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const hook = renderHook(() => useRecipeDetail('recipe'), { wrapper });
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(hook.result.current.error?.message).toContain('편집 정보');
    expect(hook.result.current.data).toBeUndefined();
  });
  it('preserves a legacy total without inventing quantity/revision, and isolates it from editing cache', async () => {
    const data = raw(); Reflect.deleteProperty(data, 'category_id'); Reflect.deleteProperty(data, 'edit_revision');
    Reflect.deleteProperty(data.extras[0]!, 'material_id'); Reflect.deleteProperty(data.extras[0]!, 'qty');
    transport.rpc.mockResolvedValue({ data, error: null });
    client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const view = renderHook(() => useRecipeDetail('recipe', { readOnly: true }), { wrapper });
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(view.result.current.data).toMatchObject({ editRevision: null, extras: [{ amount: 100, qty: null }] });
    const edit = renderHook(() => useRecipeDetail('recipe'), { wrapper });
    await waitFor(() => expect(edit.result.current.isError).toBe(true));
    expect(edit.result.current.data).toBeUndefined();
    expect(transport.rpc).toHaveBeenCalledTimes(2);
  });
  it('keeps the original total on unchanged quantity and preserves an unknown zero-quantity unit cost', () => {
    const state = useRecipeDraft.getState();
    state.addExtra({ materialId: null, name: '분할 비용', qty: 3, unitCost: 100 / 3, amountPerServing: 100 });
    state.updateExtra(0, { qty: 3 });
    expect(useRecipeDraft.getState().draft.extras[0]!.amountPerServing).toBe(100);
    state.addExtra({ materialId: null, name: '기존 비용', qty: 0, unitCost: null, amountPerServing: 100 });
    state.updateExtra(1, { qty: 2 });
    expect(useRecipeDraft.getState().draft.extras[1]).toMatchObject({ qty: 2, unitCost: 50, amountPerServing: 100 });
  });
});

describe.skipIf(!db)(`F1 real database form round trip (${db ?? 'explicit DB not supplied'})`, () => {
  it('keeps linked and independent rows distinct through a real form round trip and an independent quantity edit', async () => {
    const f = fixture(0.25, true);
    const unchanged = snapshot();
    rpc('save_recipe', { p_payload: { contract_version: 2, patch: 'full', request_id: recipeRequestId(), expected_revision: String((rpc('recipe_detail', { p_recipe: f.id }) as { edit_revision: string }).edit_revision), id: f.id, name: f.name, price: 12000, base_servings: 10, target_profit_rate: 30,
      category_id: f.category, extras: [{ material_id: f.material, qty: 0.25 }, { name: '독립 혼합 비용', qty: 2, amount: 123.5 }] } });
    transport.id = f.id; transport.categories = [{ id: f.category, name: '테스트 분류' }];
    transport.rpc.mockImplementation(async (name, args) => ({ data: rpc(name, args), error: null }));
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><RecipeAddScreen /></QueryClientProvider>);
    await waitFor(() => expect(useRecipeDraft.getState().draft.loaded).toBe(true));
    expect(useRecipeDraft.getState().draft.extras).toEqual(expect.arrayContaining([
      expect.objectContaining({ materialId: f.material, qty: 0.25, amountPerServing: 75 }),
      expect.objectContaining({ materialId: null, name: '독립 혼합 비용', qty: 2, amountPerServing: 123.5 }),
    ]));
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(transport.replace).toHaveBeenCalled());
    const read = () => rpc('recipe_detail', { p_recipe: f.id }) as { category_id: string; extras: { id: string; material_id: string | null; name: string; qty: number; amount: number }[] };
    const after = read();
    expect(after.category_id).toBe(f.category);
    expect(after.extras).toHaveLength(2);
    expect(new Set(after.extras.map(e => e.id)).size).toBe(2);
    expect(after.extras.find(e => e.material_id === f.material)).toMatchObject({ qty: 0.25, amount: 75 });
    expect(after.extras.find(e => e.material_id === null)).toMatchObject({ name: '독립 혼합 비용', qty: 2, amount: 123.5 });
    cleanup(); client.clear(); useRecipeDraft.getState().reset(emptyDraft()); transport.replace.mockClear();
    render(<QueryClientProvider client={client}><RecipeAddScreen /></QueryClientProvider>);
    await waitFor(() => expect(useRecipeDraft.getState().draft.loaded).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: '독립 혼합 비용 부자재 사용량 수정' }));
    const sheet = within(screen.getByTestId('sheet'));
    fireEvent.change(sheet.getByRole('textbox'), { target: { value: '3' } });
    fireEvent.click(sheet.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(transport.replace).toHaveBeenCalled());
    expect(read().extras.find(e => e.material_id === f.material)).toMatchObject({ qty: 0.25, amount: 75 });
    expect(read().extras.find(e => e.material_id === null)).toMatchObject({ name: '독립 혼합 비용', qty: 3, amount: 185.25 });
    expect(snapshot()).toEqual(unchanged);
  }, 30000);

  it.each([0.5, 2, 0.25])('preserves linked category, qty %s, amount and later master propagation', async (qty) => {
    const f = fixture(qty, true);
    const unchanged = snapshot();
    transport.id = f.id; transport.categories = [{ id: f.category, name: '테스트 분류' }];
    transport.rpc.mockImplementation(async (name, args) => ({ data: rpc(name, args), error: null }));
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><RecipeAddScreen /></QueryClientProvider>);
    await waitFor(() => expect(useRecipeDraft.getState().draft.loaded).toBe(true));
    // On the baseline the live response reaches the real hook/form but loses these fields.
    expect(useRecipeDraft.getState().draft.categoryId).toBe(f.category);
    expect(useRecipeDraft.getState().draft.extras[0]).toMatchObject({ materialId: f.material, qty });
    fireEvent.change(screen.getByRole('textbox', { name: '판매가' }), { target: { value: '13000' } });
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(transport.replace).toHaveBeenCalled());
    const result = rpc('recipe_detail', { p_recipe: f.id }) as { category_id: string; extras: Record<string, unknown>[] };
    expect(result.category_id).toBe(f.category);
    expect(result.extras[0]).toMatchObject({ material_id: f.material, qty, amount: 300 * qty });
    const payload = transport.rpc.mock.calls.find(([name]) => name === 'save_recipe')![1].p_payload;
    expect(payload.extras[0]).toMatchObject({ material_id: f.material, qty });
    expect(payload.extras[0]).not.toHaveProperty('amount');
    const usedBefore = query(`select to_jsonb(count(*)) from recipe_extra_costs where material_id=${literal(f.material)}::uuid`);
    query(`select to_jsonb(save_material(${literal(store)}::uuid,${literal(JSON.stringify({ id: f.material, name: `용기 ${f.suffix}`, unit_cost: 400, unit_label: '개' }))}::jsonb))`);
    expect((rpc('recipe_detail', { p_recipe: f.id }) as { extras: { amount: number }[] }).extras[0]!.amount).toBe(400 * qty);
    expect(query(`select to_jsonb(count(*)) from recipe_extra_costs where material_id=${literal(f.material)}::uuid`)).toBe(usedBefore);
    expect(usedBefore).toBe(1);
    expect(snapshot()).toEqual(unchanged);
  }, 30000);

  it.each([{ qty: 2, nextQty: 3, nextTotal: 150 }, { qty: 3, nextQty: 6, nextTotal: 200 },
    { qty: 1 / 3, nextQty: 1, nextTotal: 300 }])('preserves independent qty=$qty total=100, then changes qty=$nextQty as total=$nextTotal', async ({ qty, nextQty, nextTotal }) => {
    const f = fixture(qty, false);
    const unchanged = snapshot();
    transport.id = f.id; transport.categories = [{ id: f.category, name: '테스트 분류' }];
    transport.rpc.mockImplementation(async (name, args) => ({ data: rpc(name, args), error: null }));
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><RecipeAddScreen /></QueryClientProvider>);
    await waitFor(() => expect(useRecipeDraft.getState().draft.loaded).toBe(true));
    expect(useRecipeDraft.getState().draft.extras[0]).toMatchObject({ qty, materialId: null });
    fireEvent.click(screen.getByRole('button', { name: '독립 비용 부자재 사용량 수정' }));
    fireEvent.click(within(screen.getByTestId('sheet')).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(transport.replace).toHaveBeenCalled());
    expect((rpc('recipe_detail', { p_recipe: f.id }) as { extras: { qty: number; amount: number }[] }).extras[0]).toMatchObject({ qty, amount: 100 });
    cleanup(); client.clear(); useRecipeDraft.getState().reset(emptyDraft()); transport.replace.mockClear();
    render(<QueryClientProvider client={client}><RecipeAddScreen /></QueryClientProvider>);
    await waitFor(() => expect(useRecipeDraft.getState().draft.loaded).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: '독립 비용 부자재 사용량 수정' }));
    const sheet = within(screen.getByTestId('sheet'));
    fireEvent.change(sheet.getByRole('textbox'), { target: { value: String(nextQty) } });
    fireEvent.click(sheet.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(transport.replace).toHaveBeenCalled());
    expect((rpc('recipe_detail', { p_recipe: f.id }) as { extras: { qty: number; amount: number }[] }).extras[0]).toMatchObject({ qty: nextQty, amount: nextTotal });
    expect(snapshot()).toEqual(unchanged);
  }, 30000);
});
