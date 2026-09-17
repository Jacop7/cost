vi.mock('@/features/recipes/useRecipeCostSettings', () => ({ useRecipeCostSettings: () => ({ month: '2026-09', fixedPresence: 'configured', taxPresence: 'configured', fixedData: undefined, retry: vi.fn() }) }));
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
  const result = spawnSync('docker', ['exec', '-i', testEnv['SUPABASE_DB_CONTAINER'] ?? 'supabase_db_costkeep',
    'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-qAt'], {
    input: `begin; set local role costkeep_rpc_executor;
      set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
      ${sql}; commit;`, encoding: 'utf8', timeout: 15000,
  });
  if (result.status !== 0) throw new Error(result.stderr || String(result.error));
  return JSON.parse(result.stdout.trim());
}
function rpc(name: string, args: Record<string, unknown>): unknown {
  if (name === 'app_capabilities') return query('select app_capabilities()');
  if (name === 'recipe_draft_preview') return query(`select recipe_draft_preview(${literal(store)}::uuid,${literal(JSON.stringify(args.p_payload))}::jsonb)`);
  if (name === 'recipe_detail') return query(`select public.recipe_detail(${literal(args.p_recipe)}::uuid)`);
  if (name === 'save_recipe') return query(`select to_jsonb(public.save_recipe(${literal(store)}::uuid,${literal(JSON.stringify(args.p_payload))}::jsonb))`);
  throw new Error(`Unexpected RPC ${name}`);
}
function snapshot() {
  return query(`select jsonb_build_object(
    'inventory', (select md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'')) from inventory_events e where store_id=${literal(store)}::uuid),
    'days', (select md5(coalesce(jsonb_agg(jsonb_build_array(id,snapshot) order by id)::text,'')) from business_days where store_id=${literal(store)}::uuid))`);
}
function fixture(qty: number) {
  const suffix = `${Date.now()}-${Math.random()}`;
  const category = query(`select to_jsonb(save_category(${literal(store)}::uuid,${literal(JSON.stringify({ name: `F1 ${suffix}`, kind: 'recipe' }))}::jsonb))`) as string;
  const material = query(`select to_jsonb(save_ingredient(${literal(store)}::uuid,${literal(JSON.stringify({ name: `용기 ${suffix}`, base_unit: 'ea', per_volume: 1, purchase_price: 300, stock_tracking: true }))}::jsonb))`) as string;
  const name = `F1 메뉴 ${suffix}`;
  const id = rpc('save_recipe', { p_payload: { contract_version: 2, patch: 'create', request_id: recipeRequestId(), name, price: 12000, base_servings: 10,
    category_id: category, target_profit_rate: 30, lines: [{ ingredient_id: material, input_qty: qty * 10 }], extras: [] } }) as string;
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
    expect(hook.result.current.error?.message).toContain('수정 정보');
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

describe.skipIf(!db)(`Unified material real form round trip (${db ?? 'explicit DB not supplied'})`, () => {
  it.each([0.5, 2, 0.25])('preserves fractional quantity %s, edits through the usage sheet, and propagates price', async (qty) => {
    const f = fixture(qty); const unchanged = snapshot();
    transport.id = f.id; transport.categories = [{ id: f.category, name: '테스트 분류' }];
    transport.rpc.mockImplementation(async (name, args) => ({ data: rpc(name, args), error: null }));
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const mount = () => render(<QueryClientProvider client={client!}><RecipeAddScreen /></QueryClientProvider>);
    mount();
    await waitFor(() => expect(useRecipeDraft.getState().draft.loaded).toBe(true));
    expect(useRecipeDraft.getState().draft.categoryId).toBe(f.category);
    expect(useRecipeDraft.getState().draft.lines[0]).toMatchObject({ ingredientId: f.material, inputQty: qty * 10 });
    expect(useRecipeDraft.getState().draft.extras).toEqual([]);
    fireEvent.change(screen.getByRole('textbox', { name: '판매가' }), { target: { value: '13000' } });
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(transport.replace).toHaveBeenCalled());
    const read = () => rpc('recipe_detail', { p_recipe: f.id }) as { category_id: string; material_cost: number; extras: unknown[]; lines: { ingredient_id: string; per_serving: number }[] };
    expect(read()).toMatchObject({ category_id: f.category, material_cost: 300 * qty, extras: [] });
    expect(read().lines[0]).toMatchObject({ ingredient_id: f.material, per_serving: qty });
    const payload = transport.rpc.mock.calls.find(c => c[0] === 'save_recipe')![1].p_payload;
    expect(payload.extras).toEqual([]); expect(payload.lines[0]).toMatchObject({ ingredient_id: f.material, input_qty: qty * 10 });
    cleanup(); client.clear(); useRecipeDraft.getState().reset(emptyDraft()); transport.replace.mockClear();
    mount(); await waitFor(() => expect(useRecipeDraft.getState().draft.loaded).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: `용기 ${f.suffix} 재료 사용량 수정` }));
    const sheet = within(screen.getByTestId('sheet'));
    fireEvent.change(sheet.getByRole('textbox', { name: '사용량' }), { target: { value: String(qty * 20) } });
    fireEvent.click(sheet.getByRole('button', { name: '저장' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(transport.replace).toHaveBeenCalled());
    expect(read().material_cost).toBe(600 * qty);
    query(`select to_jsonb(save_ingredient(${literal(store)}::uuid,${literal(JSON.stringify({ id: f.material, name: `용기 ${f.suffix}`, base_unit: 'ea', per_volume: 1, purchase_price: 400 }))}::jsonb))`);
    expect(read().material_cost).toBe(800 * qty);
    expect(query(`select to_jsonb(count(*)) from recipe_lines where ingredient_id=${literal(f.material)}::uuid`)).toBe(1);
    expect(snapshot()).toEqual(unchanged);
  }, 30000);
  it('rejects old freeform extras instead of silently dropping their cost', () => {
    expect(() => rpc('save_recipe', { p_payload: { contract_version: 2, patch: 'create', request_id: recipeRequestId(), name: 'old extras', price: 1000, base_servings: 1,
      extras: [{ name: 'old fee', qty: 2, amount: 100 }] } })).toThrow();
  });
});
