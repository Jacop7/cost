import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { RecipeDraftPreview, RecipeRecommendation } from '@/features/recipes/RecipeDraftPreview';
import { actor, store, recipe, previewInput, previewRaw } from './fixtures/recipeDraftPreview';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), actor: '00000000-0000-4000-8000-000000000003' }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mock.rpc }, rpcError: (e: { message: string }) => new Error(e.message) }));
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => store, useSessionState: () => ({ userId: mock.actor }) }));
let client: QueryClient;
beforeEach(() => { mock.rpc.mockReset(); mock.actor = actor; client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); });
afterEach(() => { cleanup(); client.clear(); });
const wrap = (node: React.ReactNode) => <QueryClientProvider client={client}>{node}</QueryClientProvider>;
it('shows server quote, batch and recommendation; apply changes only parent input', async () => {
 const apply = vi.fn(); const input = previewInput(); mock.rpc.mockResolvedValue({ data: previewRaw(), error: null });
 render(wrap(<RecipeDraftPreview input={input} onApply={apply} />)); await screen.findByText('$7.87');
 expect(mock.rpc).toHaveBeenCalledWith('recipe_draft_preview', { p_store: store, p_input: input });
 fireEvent.click(screen.getByText('2인분')); await screen.findByText('$15.74');
 fireEvent.click(screen.getByRole('button', { name: '권장 판매가 적용' })); expect(apply).toHaveBeenCalledWith(4); expect(mock.rpc).toHaveBeenCalledTimes(1);
});
it('late ingredient/serving response cannot replace a changed draft', async () => {
 let resolve!: (v: unknown) => void; const first = previewInput(); const next = { ...first, base_servings: 5, lines: [{ ...first.lines[0]!, input_qty: 500 }] };
 mock.rpc.mockImplementation((_name, { p_input }) => p_input.base_servings === 2 ? new Promise(r => { resolve = r; }) : Promise.resolve({ data: previewRaw(next, 3), error: null }));
 const view = render(wrap(<RecipeDraftPreview input={first} />)); await waitFor(() => expect(mock.rpc).toHaveBeenCalledTimes(1));
 view.rerender(wrap(<RecipeDraftPreview input={next} />)); await screen.findByText('$3.00');
 await act(async () => resolve({ data: previewRaw(), error: null })); expect(screen.queryByText('$7.87')).toBeNull();
});
it('incomplete input disables query and clears the prior result', async () => {
 mock.rpc.mockResolvedValue({ data: previewRaw(), error: null }); const view = render(wrap(<RecipeDraftPreview input={previewInput()} />)); await screen.findByText('$7.87');
 view.rerender(wrap(<RecipeDraftPreview input={null} />)); expect(screen.queryByText('$7.87')).toBeNull(); expect(mock.rpc).toHaveBeenCalledTimes(1);
});
it('actor change isolates cache and rejects an old actor response', async () => {
 mock.rpc.mockResolvedValue({ data: previewRaw(), error: null }); const view = render(wrap(<RecipeDraftPreview input={previewInput()} />)); await screen.findByText('$7.87');
 mock.actor = store; view.rerender(wrap(<RecipeDraftPreview input={previewInput()} />)); await screen.findByText('정보를 불러오지 못했어요'); expect(screen.queryByText('$7.87')).toBeNull();
});
it('missing RPC and retry preserve the exact unsaved body', async () => {
 const input = previewInput(); mock.rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing rpc' } }).mockResolvedValue({ data: previewRaw(), error: null });
 render(wrap(<RecipeDraftPreview input={input} />)); await screen.findByText('정보를 불러오지 못했어요'); fireEvent.click(screen.getByText('다시 시도')); await screen.findByText('$7.87');
 expect(mock.rpc.mock.calls.every(([name, args]) => name === 'recipe_draft_preview' && args.p_input === input)).toBe(true);
});
it('saved recommendation uses its own read-only server snapshot endpoint', async () => {
 mock.rpc.mockResolvedValue({ data: previewRaw({ ...previewInput(), recipe_id: recipe }), error: null });
 render(wrap(<RecipeRecommendation recipeId={recipe} />)); await screen.findByText('$4.00'); expect(mock.rpc).toHaveBeenCalledWith('recipe_price_recommendation', { p_store: store, p_recipe: recipe });
});
