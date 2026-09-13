vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/recipes/useRecipeCostSettings', () => ({ useRecipeCostSettings: () => ({ month: '2026-09', fixedPresence: 'configured', taxPresence: 'configured', fixedData: undefined, retry: vi.fn() }) }));
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RecipePreviewCostCards, type RecipeCostSource } from '@/features/recipes/components/RecipePreviewCostCards';
import type { PreviewRow } from '@/features/recipes/draftPreviewContract';
import { previewCostDetails } from '@/features/recipes/previewCostDetails';
const mock = vi.hoisted(() => ({ fixed: vi.fn() }));
vi.mock('@/features/my/hooks', () => ({ useFixedCosts: mock.fixed }));
const source: RecipeCostSource = { baseServings: '10', lines: [
  { ingredientId: 'a', subRecipeId: null, name: '대파', unit: 'g', inputQty: 1000, unitPrice: 4 },
  { ingredientId: 'b', subRecipeId: null, name: '양파', unit: 'g', inputQty: 100, unitPrice: 1 },
], extras: [{ materialId: 'c', name: '용기', qty: 1, unitCost: 300, amountPerServing: 300 }] };
const row: PreviewRow = { servings: 1, listedTotal: 1000, tax: 100, material: 410, extra: 300, fixed: 50,
  netSales: 900, customerTotal: 1000, profit: 140, profitRate: .14, meetsTarget: false };
const money = (n: number | null) => n === null ? '산출 전' : `${n}원`;
beforeEach(() => { localStorage.clear(); mock.fixed.mockReset(); });
afterEach(cleanup);
it('keeps item editing, persists collapse, and shows one extra without subtotal or toggle', () => {
  const edit = vi.fn(), before = structuredClone(source);
  const view = render(<RecipePreviewCostCards scope="store-actor" source={source} row={row} sections={['material', 'extra']} money={money} onIngredientPress={edit} />);
  expect(screen.getAllByText('소계')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: '부자재 접기' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '대파 재료 사용량 수정' })); expect(edit).toHaveBeenCalledWith(0);
  fireEvent.click(screen.getByRole('button', { name: '재료 접기' }));
  expect(screen.getByText('대파 외 2개')).toBeTruthy(); expect(screen.queryByText('양파')).toBeNull();
  expect(screen.getByText('710원')).toBeTruthy(); expect(source).toEqual(before);
  view.unmount(); render(<RecipePreviewCostCards scope="store-actor" source={source} row={row} sections={['material']} money={money} />);
  expect(screen.getByRole('button', { name: '재료 펼치기' }).getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: '재료 펼치기' })); expect(screen.getByText('양파')).toBeTruthy();
});
it('initial empty cards have no subtotal or disclosure controls', () => {
  render(<RecipePreviewCostCards scope="empty" source={{ ...source, lines: [], extras: [] }} row={null} money={money} />);
  expect(screen.getByText('등록된 재료가 없습니다.')).toBeTruthy();
  expect(screen.queryByText('등록된 부자재가 없습니다.')).toBeNull();
  expect(screen.queryByText('소계')).toBeNull(); expect(screen.getAllByRole('button', { name: /자세히 보기/ })).toHaveLength(2);
});
it('synchronizes the last action with an already mounted form without crossing account scope', () => {
  render(<>
    <div data-testid="form"><RecipePreviewCostCards scope="same" source={source} row={row} sections={['material']} money={money} /></div>
    <div data-testid="simulation"><RecipePreviewCostCards scope="same" source={source} row={row} sections={['material']} money={money} /></div>
    <div data-testid="other"><RecipePreviewCostCards scope="other" source={source} row={row} sections={['material']} money={money} /></div>
  </>);
  const form = within(screen.getByTestId('form')), simulation = within(screen.getByTestId('simulation')), other = within(screen.getByTestId('other'));
  fireEvent.click(form.getByRole('button', { name: '재료 접기' }));
  expect(simulation.getByRole('button', { name: '재료 펼치기' })).toBeTruthy();
  fireEvent.click(simulation.getByRole('button', { name: '재료 펼치기' }));
  expect(form.getByText('양파')).toBeTruthy();
  expect(other.getByRole('button', { name: '재료 접기' })).toBeTruthy();
});
it('uses selected quantity without simulation tabs and refuses stale per-item costs', () => {
  const view = render(<RecipePreviewCostCards scope="quantity" source={source} row={{ ...row, servings: 2, listedTotal: 2000, material: 820, extra: 600 }} sections={['material', 'extra']} money={money} />);
  expect(screen.getByText('200g · 4.00원/g')).toBeTruthy(); expect(screen.getByText('1420원')).toBeTruthy();
  expect(screen.getByText('용기 ×2')).toBeTruthy(); expect(screen.getByText('600원')).toBeTruthy();
  expect(screen.queryByRole('tab')).toBeNull();
  view.rerender(<RecipePreviewCostCards scope="quantity" source={source} row={{ ...row, material: 900 }} sections={['material']} money={money} />);
  expect(screen.queryByText('400원')).toBeNull(); expect(screen.getByText('1200원')).toBeTruthy();
  expect(screen.getAllByText('산출 전').length).toBeGreaterThan(0);
});
it('tax components must add up to the server total, otherwise retain only the aggregate', () => {
  const basis = { fixed_month: '2026-09', fixed_revenue: 1000, fixed_total: 50 };
  const details = previewCostDetails({ tax_total: 100, components: [{ name: '부가세', rounded_amount: 70 }, { name: '추가 세금', rounded_amount: 30 }] }, basis);
  const view = render(<RecipePreviewCostCards scope="tax" row={{ ...row, servings: 2, tax: 200, listedTotal: 2000 }} details={details} sections={['tax']} money={money} />);
  expect(screen.getByText('140원')).toBeTruthy(); expect(screen.getByText('60원')).toBeTruthy();
  expect(screen.getByRole('button', { name: '세금 접기' })).toBeTruthy();
  const invalid = previewCostDetails({ tax_total: 100, components: [{ name: '낡은 세율', rounded_amount: 90 }] }, basis);
  expect(invalid.taxItems).toBeNull();
  view.rerender(<RecipePreviewCostCards scope="tax" row={row} details={invalid} sections={['tax']} money={money} />);
  expect(screen.queryByText('낡은 세율')).toBeNull(); expect(screen.getByText('100원')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /자세히 보기/ })).toHaveLength(1);
});
it('fixed allocations require the same server month, revenue and total; stale reads keep the aggregate', () => {
  const details = { taxItems: [], fixedMonth: '2026-09', fixedRevenue: 1000, fixedTotal: 50 };
  mock.fixed.mockReturnValue({ data: { month: '2026-09', totalRevenue: 1000, items: [{ key: 'labor', total: 30 }, { key: 'rent', total: 20 }] }, isFetching: false });
  const view = render(<RecipePreviewCostCards scope="fixed" row={row} details={details} sections={['fixed']} money={money} />);
  expect(mock.fixed).toHaveBeenCalledWith('2026-09');
  expect(screen.getByText('30원')).toBeTruthy(); expect(screen.getByText('20원')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '고정 지출 접기' })); expect(screen.getByText('인건비 외 1개')).toBeTruthy();
  mock.fixed.mockReturnValue({ data: { month: '2026-08', totalRevenue: 1000, items: [{ key: 'labor', total: 50 }] }, isFetching: false });
  view.rerender(<RecipePreviewCostCards scope="fixed" row={row} details={details} sections={['fixed']} money={money} />);
  expect(screen.queryByText('인건비 외 1개')).toBeNull(); expect(screen.queryByText('30원')).toBeNull(); expect(screen.getByText('50원')).toBeTruthy();
});
