import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSaveIngredient, useDeactivateIngredient } from '@/features/ingredients/hooks';
import { useSettingsLists } from '@/features/master-data/hooks';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => 'store-1' }));
let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
beforeEach(() => { qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false }, mutations: { retry: false } } }); });
afterEach(() => { qc.clear(); vi.restoreAllMocks(); });

it.each(['ingredient-move', 'ingredient-delete', 'recipe-save'] as const)('%s 후 카테고리 삭제 가능 여부를 최신 사용 수로 읽는다', async operation => {
  let changed = false;
  const initial = { categories: [{ id: 'old', name: '이전', kind: 'ingredient', sortOrder: 0, usedCount: 1 }],
    recipeCategories: [{ id: 'old', name: '이전', kind: 'recipe', sortOrder: 0, usedCount: 1 }], materialCategories: [], materials: [], vendors: [], channels: [] };
  qc.setQueryData(qk.settingsLists, initial);
  const transport = vi.spyOn(supabase, 'rpc').mockImplementation(name => {
    if (name === 'settings_lists') return Promise.resolve({ data: {
      categories: [{ id: 'old', name: '이전', kind: 'ingredient', sort_order: 0, used_count: changed ? 0 : 1 }],
      recipe_categories: [{ id: 'old', name: '이전', kind: 'recipe', sort_order: 0, used_count: changed ? 0 : 1 }],
    }, error: null }) as never;
    changed = true;
    return Promise.resolve({ data: 'ingredient-1', error: null }) as never;
  });
  const { result } = renderHook(() => ({ lists: useSettingsLists(), save: useSaveIngredient(), remove: useDeactivateIngredient() }), { wrapper });
  expect(result.current.lists.data?.categories[0]?.usedCount).toBe(1);
  await act(async () => {
    if (operation === 'ingredient-move') await result.current.save.mutateAsync({ id: 'ingredient-1', name: '재료', categoryId: 'new', baseUnit: 'g', perVolume: 1, safetyStock: 0, profileOnly: true, defaultVendorId: null, memo: '' });
    else if (operation === 'ingredient-delete') await result.current.remove.mutateAsync('ingredient-1');
    else { changed = true; invalidate(qc, invalidateOn.e3('recipe-1')); }
  });
  await waitFor(() => expect((operation === 'recipe-save' ? result.current.lists.data?.recipeCategories : result.current.lists.data?.categories)?.[0]?.usedCount).toBe(0));
  expect(transport.mock.calls.filter(([name]) => name === 'settings_lists')).toHaveLength(1);
});
