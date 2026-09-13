import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RecipePreviewCostCards } from '@/features/recipes/components/RecipePreviewCostCards';
import { recipeMasterDataPatch } from '@/features/recipes/recipeMasterData';
import { emptyDraft } from '@/features/recipes/draftStore';
import type { SettingsLists } from '@/features/master-data/hooks';

const m = vi.hoisted(() => ({ fixed: vi.fn(), tax: vi.fn(), date: vi.fn(), push: vi.fn(), retry: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock('@/features/my/hooks', () => ({ useFixedCosts: m.fixed }));
vi.mock('@/features/business-day/businessDay', () => ({ useStoreLocalDate: m.date }));
vi.mock('@/features/international-tax', () => ({
  useAppCapabilities: () => ({ data: { internationalTax: { readEnabled: true } }, refetch: m.retry }),
  useInternationalTaxState: m.tax,
}));
vi.mock('@/features/settings/hooks', () => ({ useStoreSettings: () => ({ refetch: m.retry }) }));
const cards = () => <RecipePreviewCostCards scope="linked-test" source={emptyDraft()} row={null} money={n => `${n}원`}
  sections={['fixed', 'tax']} comparison="one" onComparisonChange={vi.fn()} />;
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  m.date.mockReturnValue({ date: '2026-09-13', refetch: m.retry });
  m.fixed.mockReturnValue({ data: { month: '2026-09', items: [], totalRevenue: 0, rate: null }, refetch: m.retry });
  m.tax.mockReturnValue({ data: { taxProfile: null }, refetch: m.retry });
});
afterEach(cleanup);
it('uses MY settings presence, hides empty bodies and navigates to the existing editors', () => {
  render(cards());
  expect(screen.queryByText('0원')).toBeNull(); expect(screen.queryByRole('tab')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '고정 지출 설정 추가' }));
  expect(m.push).toHaveBeenLastCalledWith('/recipes/fixed-cost-edit?month=2026-09');
  fireEvent.click(screen.getByRole('button', { name: '세금 설정 추가' }));
  expect(m.push).toHaveBeenLastCalledWith('/recipes/tax?settings=1');
});
it('keeps zero-rate profiles and zero-value fixed items configured even without a menu price', () => {
  m.fixed.mockReturnValue({ data: { items: [{ key: 'labor', total: 0 }], rate: 0 }, refetch: m.retry });
  m.tax.mockReturnValue({ data: { taxProfile: { defaultTreatment: 'exempt', components: [] } }, refetch: m.retry });
  render(cards());
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  expect(screen.queryByText('세율 적용')).toBeNull(); expect(screen.getByText('인건비')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '고정 지출 자세히 보기' }));
  expect(m.push).toHaveBeenLastCalledWith('/recipes/fixed-cost');
});
it('does not treat failed or refreshing reads as missing settings', () => {
  m.fixed.mockReturnValue({ data: { items: [] }, isFetching: true, refetch: m.retry });
  m.tax.mockReturnValue({ error: new Error('offline'), refetch: m.retry });
  render(cards());
  expect(screen.queryByText('세율 적용')).toBeNull(); expect(screen.queryByText('고정 지출 추가')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '세금 설정 다시 확인' }));
  expect(m.retry).toHaveBeenCalled(); expect(m.push).not.toHaveBeenCalled();
});
it('never constructs a fixed-cost month from the device date', () => {
  m.date.mockReturnValue({ date: null, error: new Error('offline'), refetch: m.retry });
  render(cards()); expect(m.fixed).toHaveBeenCalledWith('', false);
  expect(screen.queryByText('고정 지출 추가')).toBeNull();
});
it('refreshes master names and prices without losing entered fields, quantities or deleted rows', () => {
  const draft = { ...emptyDraft(), name: '작성 중', categoryId: 'c', categoryName: '이전 이름', price: '12000',
    extras: [{ materialId: 'm', name: '이전 용기', qty: 2, unitCost: 100, amountPerServing: 200 },
      { materialId: 'deleted', name: '삭제된 항목', qty: 3, unitCost: 10, amountPerServing: 30 }] };
  const lists = { recipeCategories: [{ id: 'c', name: '새 분류' }], materials: [{ id: 'm', name: '새 용기', unitCost: 150 }] } as SettingsLists;
  const before = structuredClone(draft), next = { ...draft, ...recipeMasterDataPatch(draft, lists) };
  expect(draft).toEqual(before); expect(next.name).toBe('작성 중'); expect(next.price).toBe('12000');
  expect(next.categoryName).toBe('새 분류'); expect(next.extras[0]).toMatchObject({ qty: 2, unitCost: 150, amountPerServing: 300 });
  expect(next.extras[1]).toEqual(draft.extras[1]); expect(recipeMasterDataPatch(next, lists)).toBeNull();
});
