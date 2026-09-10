vi.mock('expo-secure-store', () => ({}));
/** Real recipe mapper + QueryClient + screens/kit; other domains and transport are fixtures. */
import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RecipeAddScreen from '@/features/recipes/screens/RecipeAddScreen';
import RecipeDetailScreen from '@/features/recipes/screens/RecipeDetailScreen';
import SalesMenuDetailScreen from '@/features/sales/screens/SalesMenuDetailScreen';
import { emptyDraft, useRecipeDraft } from '@/features/recipes/draftStore';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), replace: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mock.rpc } }));
vi.mock('@/lib/SessionProvider', () => ({ useSessionState: () => ({ userId: 'recipe-actor-a' }), useStoreId: () => 'store' }));
vi.mock('expo-router', () => ({ useFocusEffect: (fn: () => void | (() => void)) => useEffect(fn, [fn]), useLocalSearchParams: () => ({ id: '00000000-0000-4000-8000-000000000001', recipe: '00000000-0000-4000-8000-000000000001', from: '2026-09-10', to: '2026-09-10' }),
  useRouter: () => ({ push: vi.fn(), replace: mock.replace }), router: { canGoBack: () => false, replace: mock.replace } }));
vi.mock('@/features/master-data/hooks', () => ({ useSettingsLists: () => ({ data: { recipeCategories: [{ id: 'category', name: '시험 분류' }] } }) }));
vi.mock('@/features/settings/hooks', () => ({ useStoreSettings: () => ({ data: { taxItems: [] } }) }));
vi.mock('@/features/recipes/profitHistory', () => ({ deltaTone: () => 'flat', useProfitHistory: () => ({ data: { pages: [{ items: [] }] }, isLoading: false, error: null }) }));
vi.mock('@/features/international-tax', () => ({
  useAppCapabilities: () => ({ data: { internationalTax: { readEnabled: false } }, isLoading: false, error: null, refetch: vi.fn() }),
  useRecipeTaxState: () => ({ data: null, isLoading: false, error: null, refetch: vi.fn() }),
}));
vi.mock('@/features/international-tax/RecipeTaxStatusCard', () => ({ RecipeTaxStatusCard: () => null }));
vi.mock('@/features/business-day/businessDay', () => ({
  useBusinessDay: () => ({ data: { timezone: 'Asia/Seoul' } }),
  useSalesBusinessDate: () => ({ date: '2026-09-10', isLoading: false, error: null, refetch: vi.fn() }),
}));
vi.mock('@/features/sales/hooks', () => ({
  useSalesRange: () => ({ data: { menu: [] }, isLoading: false, error: null, refetch: vi.fn() }),
  useDayMenuDetail: () => ({ data: { sold: false }, isLoading: false, error: null }),
  useRangeMenuDetail: () => ({ data: { sold: false }, isLoading: false, error: null }),
}));
vi.mock('react-native', async original => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div data-testid="sheet">{children}</div> : null }));

const raw = (qty = 1 / 3) => ({ edit_revision: '1', id: '00000000-0000-4000-8000-000000000001', name: '계약 시험 메뉴', price: 12000, base_servings: 10,
  target_profit_rate: 30, category_id: 'category', tax_mode: 'included', tax_items: [], fixed_month: '2026-09', fixed_items: [],
  last_change: { display_state: null, has_history: false }, lines: [],
  extras: [{ id: 'extra', name: '분할 비용', material_id: null, qty, amount: 100 }] });
let client: QueryClient;
function mount(Screen: typeof RecipeAddScreen, data: unknown) {
  mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'save_recipe' ? '00000000-0000-4000-8000-000000000001' : data, error: null }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><Screen /></QueryClientProvider>);
}
afterEach(() => { cleanup(); client?.clear(); useRecipeDraft.getState().reset(emptyDraft()); vi.clearAllMocks(); });

describe('F1 fractional display and unchanged source quantities', () => {
  it.each([{ qty: 1 / 3, display: '0.3333', unit: '300.00원/개' }, { qty: 3, display: '3', unit: '33.33원/개' }])(
    'formats qty $qty and keeps source quantity/total when the sheet is confirmed untouched', async ({ qty, display, unit }) => {
      mount(RecipeAddScreen, raw(qty));
      await waitFor(() => expect(useRecipeDraft.getState().draft.loaded).toBe(true));
      const row = screen.getByRole('button', { name: '분할 비용 부자재 사용량 수정' });
      expect(within(row).getByText(`${unit} × ${display}개`)).toBeTruthy();
      fireEvent.click(row);
      const sheet = within(screen.getByTestId('sheet'));
      expect((sheet.getByRole('textbox') as HTMLInputElement).value).toBe(display);
      fireEvent.click(sheet.getByRole('button', { name: '저장' }));
      expect(useRecipeDraft.getState().draft.extras[0]).toMatchObject({ qty, amountPerServing: 100 });
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
      await waitFor(() => expect(mock.replace).toHaveBeenCalled());
      const payload = mock.rpc.mock.calls.find(([name]) => name === 'save_recipe')![1].p_payload;
      expect(payload.extras[0]).toMatchObject({ qty, amount: 100 });
    });
  it('changes quantity deliberately and keeps a fractional unit cost without integer rounding', async () => {
    mount(RecipeAddScreen, raw(3));
    await waitFor(() => expect(useRecipeDraft.getState().draft.loaded).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: '분할 비용 부자재 사용량 수정' }));
    const sheet = within(screen.getByTestId('sheet'));
    fireEvent.change(sheet.getByRole('textbox'), { target: { value: '6' } });
    fireEvent.click(sheet.getByRole('button', { name: '저장' }));
    expect(useRecipeDraft.getState().draft.extras[0]).toMatchObject({ qty: 6, unitCost: 100 / 3, amountPerServing: 200 });
  });
  it('returns to the original source quantity after editing back to its initial rounded text', async () => {
    mount(RecipeAddScreen, raw());
    await waitFor(() => expect(useRecipeDraft.getState().draft.loaded).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: '분할 비용 부자재 사용량 수정' }));
    const sheet = within(screen.getByTestId('sheet'));
    fireEvent.change(sheet.getByRole('textbox'), { target: { value: '2' } });
    fireEvent.change(sheet.getByRole('textbox'), { target: { value: '0.3333' } });
    fireEvent.click(sheet.getByRole('button', { name: '저장' }));
    expect(useRecipeDraft.getState().draft.extras[0]).toMatchObject({ qty: 1 / 3, amountPerServing: 100 });
  });
});

describe('F1 old response deployment boundary on actual consumers', () => {
  it.each(['category_id', 'edit_revision', 'material_id', 'qty'])('keeps detail and memo readable without %s, but never sends a write', async field => {
    const data = { ...raw(), memo: '기존 메모' };
    if (field === 'category_id' || field === 'edit_revision') Reflect.deleteProperty(data, field);
    else Reflect.deleteProperty(data.extras[0]!, field);
    mount(RecipeDetailScreen, data);
    expect(await screen.findByText('계약 시험 메뉴')).toBeTruthy();
    expect(screen.queryByText('현재 연결에서는 레시피를 조회할 수 있어요. 수정·저장은 업데이트 후 사용할 수 있어요.')).toBeNull();
    expect(screen.queryByText('정보를 불러오지 못했어요')).toBeNull();
    expect(screen.queryByRole('button', { name: '레시피 수정' })).toBeNull();
    expect(screen.queryByRole('button', { name: '재료 편집' })).toBeNull();
    expect(screen.getByRole('button', { name: '판매 중지' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '판매 중지' }));
    fireEvent.click(screen.getByRole('button', { name: '메모 수정' }));
    const sheet = within(screen.getByTestId('sheet'));
    const memo = sheet.getByRole('textbox', { name: '메모' }) as HTMLTextAreaElement;
    expect(memo.value).toBe('기존 메모');
    expect(memo.readOnly).toBe(true);
    expect(sheet.getByRole('button', { name: '완료' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(sheet.getByRole('button', { name: '완료' }));
    expect(mock.rpc.mock.calls.some(([name]) => name === 'save_recipe')).toBe(false);
  });
  it('still rejects missing monetary data in the read-only detail', async () => {
    const data = raw(); Reflect.deleteProperty(data.extras[0]!, 'amount');
    mount(RecipeDetailScreen, data);
    expect(await screen.findByText('정보를 불러오지 못했어요')).toBeTruthy();
    expect(screen.queryByText('분할 비용')).toBeNull();
    expect(mock.rpc.mock.calls.some(([name]) => name === 'save_recipe')).toBe(false);
  });
  it.each([{ label: 'recipe edit', Screen: RecipeAddScreen },
    { label: 'sales menu detail without a sold snapshot', Screen: SalesMenuDetailScreen }])(
    '$label shows retry and hides invalid recipe values', async ({ Screen }) => {
      const data = raw(); Reflect.deleteProperty(data, 'category_id');
      Reflect.deleteProperty(data.extras[0]!, 'material_id'); Reflect.deleteProperty(data.extras[0]!, 'qty');
      mount(Screen, data);
      expect(await screen.findByText('정보를 불러오지 못했어요')).toBeTruthy();
      expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
      expect(screen.queryByText('분할 비용')).toBeNull();
      expect(screen.queryByText('12,000원')).toBeNull();
      expect(screen.queryByRole('textbox', { name: '판매가' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
      await waitFor(() => expect(mock.rpc.mock.calls.filter(([name]) => name === 'recipe_detail').length).toBeGreaterThan(1));
      expect(mock.rpc.mock.calls.some(([name]) => name === 'save_recipe')).toBe(false);
    });
});
