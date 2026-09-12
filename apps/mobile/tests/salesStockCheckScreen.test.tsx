import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SalesStockCheckScreen from '@/features/sales/screens/SalesStockCheckScreen';
import { IngredientListScreen } from '@/features/ingredients/screens/IngredientListScreen';
import type { IngredientRow } from '@/features/ingredients/hooks';
import type { ShortageIngredient, ShortageResult } from '@/features/sales/hooks';

const m = vi.hoisted(() => ({ mode: 'start', stock: undefined as string | undefined, pending: null as unknown,
  start: vi.fn(), sale: vi.fn(), list: vi.fn(), push: vi.fn(), replace: vi.fn(), retry: vi.fn(), back: vi.fn(),
  tabPress: undefined as (() => void) | undefined, setParams: vi.fn(), unsubscribe: vi.fn() }));
const navigation = vi.hoisted(() => ({ setParams: m.setParams, getParent: () => ({
  addListener: (event: string, callback: () => void) => {
    if (event !== 'tabPress') throw new Error(`Unexpected event: ${event}`);
    m.tabPress = callback;
    return () => { m.unsubscribe(); m.tabPress = undefined; };
  },
}) }));
vi.mock('expo-router', () => ({ useNavigation: () => navigation, useLocalSearchParams: () => ({ mode: m.mode, stock: m.stock }), useRouter: () => ({ push: m.push, replace: m.replace }) }));
vi.mock('@/lib/nav', () => ({ safeBack: (...args: unknown[]) => m.back(...args) }));
vi.mock('@/features/sales/hooks', () => ({ useRecipeShortages: (...args: unknown[]) => m.start(...args), useSaleShortages: (...args: unknown[]) => m.sale(...args) }));
vi.mock('@/features/sales/pendingSale', () => ({ getPendingSale: () => m.pending }));
vi.mock('@/features/ingredients/hooks', () => ({ useIngredientList: () => m.list() }));
vi.mock('@/features/master-data/hooks', () => ({ useSettingsLists: () => ({ data: { categories: [] } }) }));
const ingredient = (id: string, overrides: Partial<ShortageIngredient> = {}): ShortageIngredient => ({
  ingredientId: id, name: id, baseUnit: 'g', safetyStock: 10, safetyStockIsBase: true,
  perVolume: 1000, needPerServing: 40, need: 800, stock: 500, ...overrides,
});
const result = (mode: ShortageResult['mode'] = 'start'): ShortageResult => ({ mode, hasBasis: true, ingredientCount: 8,
  recipes: ['메뉴A', '메뉴B'].map(recipeId => ({ recipeId, name: recipeId,
    ingredients: [1, 2, 3, 4].map(n => ingredient(`${recipeId}-식재료${n}`)) })) });
const query = (data: ShortageResult | undefined, overrides = {}) => ({ data, isLoading: false, error: null, refetch: m.retry, ...overrides });
const row = (id: string, stockTotal: number, safetyStock: number, soonOut = false): IngredientRow => ({ id, name: id,
  stockTotal, safetyStock, soonOut, baseUnit: 'g', perVolume: 1000, basePrice: 4, categoryName: null,
  vendorName: null, memo: null, lastInboundAt: null });
const rows = () => [row('음수', -750, 0), row('소진', 0, 0), row('안전선동일', 100, 100), row('안전선미달', 50, 100),
  row('긴급표시만', 500, 100, true), row('판매부족만', 500, 10), row('안전선초과', 100.1, 100)];
const visibleRows = () => screen.getAllByRole('button', { name: / (상세|재고 입력)$/ }).map(x => x.getAttribute('aria-label'));

describe('부족 재고 전체 보기의 서버 판정 연결', () => {
  beforeEach(() => {
    vi.clearAllMocks(); m.mode = 'start'; m.stock = undefined; m.pending = null;
    m.tabPress = undefined; m.setParams.mockImplementation(({ stock }) => { m.stock = stock; });
    m.start.mockReturnValue(query(result())); m.sale.mockReturnValue(query(undefined));
    m.list.mockReturnValue({ data: rows(), isLoading: false, error: null, refetch: m.retry });
  });
  it('전체 부족 버튼은 안전재고 필터를 전달하고 도착 목록은 안전선 이하만 포함한다', () => {
    const view = render(<SalesStockCheckScreen />);
    expect(screen.queryByRole('button', { name: '메뉴A-식재료4 재고 추가' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '전체 부족 재고 보기' }));
    expect(m.push).toHaveBeenCalledOnce();
    expect(m.push).toHaveBeenCalledWith('/ingredients?stock=below-safety');
    const destination = new URL(m.push.mock.calls[0]![0], 'https://fixture.invalid');
    m.stock = destination.searchParams.get('stock') ?? undefined; view.unmount(); render(<IngredientListScreen />);
    expect(visibleRows()).toEqual(['음수 상세', '소진 재고 입력', '안전선동일 상세', '안전선미달 상세']);
    expect(screen.getByText('안전재고 이하인 식재료만 보고 있어요')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: '음수 상세' })).getByText(/−750g/)).toBeTruthy();
  });
  it('판매 묶음·서버 증가분 필요량을 유지하며 안전재고가 충분해도 판매 부족 식재료를 숨기지 않는다', () => {
    m.mode = 'sale'; m.pending = { date: '2026-09-11', items: [{ recipeId: '메뉴A', qtyHall: 20, qtyDelivery: 0, qtyTakeout: 0 }] };
    m.sale.mockReturnValue(query(result('sale')));
    render(<SalesStockCheckScreen />);
    fireEvent.click(screen.getAllByRole('button', { name: '식재료 1개 더 보기' })[0]!);
    const row = within(screen.getByRole('button', { name: '메뉴A-식재료4 재고 추가' }));
    expect(row.getByText(/필요 수량/).textContent).toContain('800g');
    expect(row.getByText(/현재 재고/).textContent).toContain('500g');
    expect(m.start).toHaveBeenLastCalledWith(false);
    expect(m.sale).toHaveBeenLastCalledWith('2026-09-11', (m.pending as { items: unknown[] }).items, true);
    expect(m.push).not.toHaveBeenCalled();
  });
  it('필터는 재조회한 서버 재고를 반영하고 전체 식재료 보기로 해제할 수 있다', () => {
    m.stock = 'below-safety'; const view = render(<IngredientListScreen />);
    m.list.mockReturnValue({ data: [row('입고완료', 200, 100), row('새부족', 20, 100)], isLoading: false, error: null, refetch: m.retry });
    view.rerender(<IngredientListScreen />); expect(visibleRows()).toEqual(['새부족 상세']);
    fireEvent.click(screen.getByRole('button', { name: '전체 식재료 보기' })); expect(m.replace).toHaveBeenCalledWith('/ingredients');
    m.stock = undefined; view.rerender(<IngredientListScreen />); expect(visibleRows()).toHaveLength(2);
  });
  it('안전재고를 두지 않은 0 기준은 음수·0만 포함하고 양수는 제외한다', () => {
    m.stock = 'below-safety';
    m.list.mockReturnValue({ data: [row('미설정음수', -1, 0), row('미설정소진', 0, 0), row('미설정양수', 1, 0)], isLoading: false, error: null, refetch: m.retry });
    render(<IngredientListScreen />);
    expect(visibleRows()).toEqual(['미설정음수 상세', '미설정소진 재고 입력']);
  });
  it('필터 진입은 유지하되 식재료 탭을 직접 누른 일반 재진입은 잔류 필터를 지운다', () => {
    m.stock = 'below-safety'; const view = render(<IngredientListScreen />);
    expect(visibleRows()).toHaveLength(4); expect(m.setParams).not.toHaveBeenCalled();
    act(() => m.tabPress!());
    expect(m.setParams).toHaveBeenCalledWith({ stock: undefined });
    view.rerender(<IngredientListScreen />);
    expect(visibleRows()).toHaveLength(7);
    expect(screen.queryByText('안전재고 이하인 식재료만 보고 있어요')).toBeNull();
    m.setParams.mockClear(); act(() => m.tabPress!()); expect(m.setParams).not.toHaveBeenCalled();
    view.unmount(); expect(m.tabPress).toBeUndefined(); expect(m.unsubscribe).toHaveBeenCalled();
  });
  it('여러 메뉴의 합산 부족은 메뉴별 필요량이 현재 재고보다 작아도 서버 결과를 그대로 표시한다', () => {
    m.mode = 'sale'; m.pending = { date: '2026-09-11', items: [{ recipeId: '메뉴A', qtyHall: 1, qtyDelivery: 0, qtyTakeout: 0 }] };
    const data = result('sale'); data.ingredientCount = 1;
    data.recipes = ['메뉴A', '메뉴B'].map(recipeId => ({ recipeId, name: recipeId,
      ingredients: [ingredient('공유식재료', { need: 300, stock: 500, safetyStock: 10 })] }));
    m.sale.mockReturnValue(query(data)); render(<SalesStockCheckScreen />);
    expect(screen.getAllByRole('button', { name: '공유식재료 재고 추가' })).toHaveLength(2);
    for (const button of screen.getAllByRole('button', { name: '공유식재료 재고 추가' })) {
      expect(within(button).getByText(/필요 수량/).textContent).toContain('300g');
    }
  });
  it('메뉴별 더보기·접기·재고 추가는 기존 필요량 판정을 유지한다', () => {
    render(<SalesStockCheckScreen />);
    fireEvent.click(screen.getAllByRole('button', { name: '식재료 1개 더 보기' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: '메뉴A-식재료4 재고 추가' }));
    expect(m.push).toHaveBeenCalledWith('/ingredients/add-stock/메뉴A-식재료4');
    fireEvent.click(screen.getByRole('button', { name: '접기' }));
    expect(screen.queryByRole('button', { name: '메뉴A-식재료4 재고 추가' })).toBeNull();
  });
  it('판매 기준이 없으면 부족 없음으로 성공 표시하지 않는다', () => {
    m.mode = 'sale'; m.pending = { date: '2026-09-11', items: [{ recipeId: '메뉴A', qtyHall: 1, qtyDelivery: 0, qtyTakeout: 0 }] };
    m.sale.mockReturnValue(query({ mode: 'sale', hasBasis: false, recipes: [], ingredientCount: 0 }));
    render(<SalesStockCheckScreen />);
    expect(screen.getByText('판매 재고를 확인할 기준이 없어요')).toBeTruthy();
    expect(screen.queryByText('확인이 필요한 재고가 없어요')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '전체 부족 재고 보기' }));
    expect(m.push).toHaveBeenCalledWith('/ingredients?stock=below-safety');
  });
  it('메뉴 부족이 없어도 안전재고 목록은 별도이며 로딩·오류는 빈 결과로 숨기지 않는다', () => {
    m.start.mockReturnValue(query({ ...result(), ingredientCount: 0, recipes: [] }));
    const view = render(<SalesStockCheckScreen />);
    expect(screen.getByText('확인이 필요한 재고가 없어요')).toBeTruthy();
    expect(screen.getByRole('button', { name: '전체 부족 재고 보기' })).toBeTruthy();
    m.start.mockReturnValue(query(undefined, { isLoading: true })); view.rerender(<SalesStockCheckScreen />);
    expect(screen.queryByText('확인이 필요한 재고가 없어요')).toBeNull();
    m.start.mockReturnValue(query(undefined, { error: new Error('조회 실패') })); view.rerender(<SalesStockCheckScreen />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' })); expect(m.retry).toHaveBeenCalledOnce();
    expect(m.push).not.toHaveBeenCalled();
  });
  it('판매 딥링크에 묶음이 없으면 시작 판정만 사용하고 음수 재고를 보존한다', () => {
    m.mode = 'sale'; const data = result(); data.recipes[0]!.ingredients[0] = ingredient('음수식재료', { stock: -750 });
    m.start.mockReturnValue(query(data)); render(<SalesStockCheckScreen />);
    expect(m.start).toHaveBeenLastCalledWith(true); expect(m.sale).toHaveBeenLastCalledWith('', [], false);
    expect(within(screen.getByRole('button', { name: '음수식재료 재고 추가' })).getByText(/현재 재고/).textContent).toContain('−750g');
  });
  it('기본 목록과 알 수 없는 필터는 기존 전체 목록을 유지하며 필터의 검색·빈 상태를 구분한다', () => {
    const view = render(<IngredientListScreen />); expect(visibleRows()).toHaveLength(7);
    m.stock = 'unknown'; view.rerender(<IngredientListScreen />); expect(visibleRows()).toHaveLength(7);
    m.stock = 'below-safety'; view.rerender(<IngredientListScreen />);
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    fireEvent.change(screen.getByPlaceholderText('식재료·카테고리·구매처 검색'), { target: { value: '안전선' } });
    expect(visibleRows()).toEqual(['안전선동일 상세', '안전선미달 상세']);
    fireEvent.change(screen.getByPlaceholderText('식재료·카테고리·구매처 검색'), { target: { value: '판매부족만' } });
    expect(screen.getByText("'판매부족만' 검색 결과가 없어요")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('식재료·카테고리·구매처 검색'), { target: { value: '' } });
    m.list.mockReturnValue({ data: [row('충분한재고', 200, 100)], isLoading: false, error: null, refetch: m.retry });
    view.rerender(<IngredientListScreen />);
    expect(screen.getByText('조건에 맞는 부족 재고가 없어요')).toBeTruthy();
  });
});
