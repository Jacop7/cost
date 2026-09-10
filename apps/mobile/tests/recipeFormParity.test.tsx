import { useEffect, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeAddScreen from '@/features/recipes/screens/RecipeAddScreen';
import { emptyDraft, useRecipeDraft, type RecipeDraft } from '@/features/recipes/draftStore';
import type { RecipeDetail } from '@/features/recipes/hooks';

const mock = vi.hoisted(() => ({
  detail: vi.fn(), save: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn(), refetch: vi.fn(),
  routeId: undefined as string | undefined, pending: false,
}));

vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return {
    ...rn,
    // Native Modal visibility alone is adapted for jsdom. RecipeAddScreen,
    // draftStore, kit fields/buttons/sheets and their callbacks stay real.
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
      visible ? <div data-testid="recipe-form-modal">{children}</div> : null,
  };
});
vi.mock('expo-router', () => ({ useFocusEffect: (fn: () => void | (() => void)) => useEffect(fn, [fn]),
  useLocalSearchParams: () => ({ id: mock.routeId }),
  useRouter: () => ({ push: mock.push, replace: mock.replace }),
  router: { canGoBack: () => false, replace: mock.replace, back: mock.back },
}));
vi.mock('@/features/recipes/hooks', () => ({
  useRecipeDetail: mock.detail,
  useSaveRecipe: () => ({ mutate: mock.save, isPending: mock.pending }),
}));
vi.mock('@/lib/SessionProvider', () => ({ useSessionState: () => ({ userId: 'recipe-actor-a' }), useStoreId: () => 'store-recipe-form-parity' }));
vi.mock('@/features/master-data/hooks', () => ({
  useSettingsLists: () => ({ data: { recipeCategories: [{ id: 'cat-ko', name: '한식' }] }, isLoading: false, error: null }),
}));
vi.mock('@/features/settings/hooks', () => ({
  useStoreSettings: () => ({ data: { taxItems: [] }, isLoading: false, error: null }),
}));
vi.mock('@/features/international-tax', () => ({
  useAppCapabilities: () => ({ data: { internationalTax: { readEnabled: false } }, isLoading: false, error: null, refetch: vi.fn() }),
}));

const detail: RecipeDetail = {
  id: 'recipe-edit', editRevision: '1', name: '서버 제육볶음', price: 12_000, active: true,
  sales30d: { qty: 10, revenue: 120_000, waste: 0 }, memo: '서버 메모',
  lastChange: { occurredAt: '2030-07-15T01:00:00Z', eventId: null, displayState: null, hasHistory: false },
  taxMode: 'included', taxItems: [], taxBreakdown: [], tax: 0, baseServings: 10,
  targetProfitRate: 30, avgMonthlySales: 42, materialCost: 500, extraCost: 300,
  fixedRate: 0, fixedMonth: '2030-07', fixedItems: [], categoryId: 'cat-ko',
  lines: [
    { id: 'line-green-onion', ingredientId: 'ingredient-green-onion', subRecipeId: null, name: '대파',
      baseUnit: 'g', inputQty: 1_000, perServing: 100, unitPrice: 4, stockTotal: 8_000,
      safetyStock: 1_000, soonOut: false },
    { id: 'line-sauce', ingredientId: 'ingredient-sauce', subRecipeId: null, name: '소스',
      baseUnit: 'ml', inputQty: 500, perServing: 50, unitPrice: 2, stockTotal: 2_000,
      safetyStock: 200, soonOut: false },
  ],
  extras: [{ id: 'extra-box', materialId: 'material-box', name: '용기', amount: 300, qty: 1 }],
};

const state = <T,>(data: T) => ({ data, isLoading: false, isFetched: true, error: null, refetch: mock.refetch });
const input = (name: string) => screen.getByRole('textbox', { name }) as HTMLInputElement;
const fill = (name: string, value: string) => fireEvent.change(input(name), { target: { value } });
const modal = () => within(screen.getByTestId('recipe-form-modal'));
const subtotalRow = () => screen.getByText('재료비 소계').parentElement!;

const addDraft = (): Partial<RecipeDraft> => ({
  scopeKey: JSON.stringify({ actorId: 'recipe-actor-a', storeId: 'store-recipe-form-parity' }),
  name: '  새 메뉴  ', categoryId: 'cat-ko', categoryName: '한식', price: '15000', memo: '  초안 메모  ',
  baseServings: '10', avgMonthlySales: '25', targetProfitRate: '35.5', loaded: false,
  lines: [
    { ingredientId: 'ingredient-green-onion', subRecipeId: null, name: '대파', unit: 'g', inputQty: 1_000, unitPrice: 4 },
    { ingredientId: 'ingredient-sauce', subRecipeId: null, name: '소스', unit: 'ml', inputQty: 500, unitPrice: 2 },
  ],
  extras: [{ materialId: 'material-box', name: '용기', unitCost: 300, amountPerServing: 600, qty: 2 }],
});

// Domain reads/writes and router effects are mocks. These tests cover the real
// screen + Zustand draft + kit host wiring, not save_recipe RPC/server formulas,
// native keyboard/gesture/layout geometry, or visual approval.
describe('RCP-03/04 실제 레시피 폼 배치·초안·저장 계약', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.routeId = undefined; mock.pending = false;
    useRecipeDraft.getState().reset(emptyDraft());
    mock.detail.mockReturnValue(state(undefined));
  });

  afterEach(() => {
    cleanup();
    useRecipeDraft.getState().reset(emptyDraft());
  });

  it('추가 초안은 재료 검색으로 이동해도 돌아온 폼에서 유지된다', () => {
    const view = render(<RecipeAddScreen />);
    fill('메뉴명', '작성 중인 신규 메뉴'); fill('판매가', '13500');
    fireEvent.click(screen.getByRole('button', { name: '식재료 추가' }));
    expect(mock.push).toHaveBeenLastCalledWith('/recipes/ingredient-search');
    view.unmount();
    render(<RecipeAddScreen />);
    expect(input('메뉴명').value).toBe('작성 중인 신규 메뉴');
    expect(input('판매가').value).toBe('13500');
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('수정 진입은 서버로 한 번만 채우고 같은 ID 재렌더·재진입에서 작성 중 값을 유지한다', () => {
    mock.routeId = detail.id; mock.detail.mockReturnValue(state(detail));
    const view = render(<RecipeAddScreen />);
    expect(input('메뉴명').value).toBe('서버 제육볶음');
    expect(screen.getByRole('button', { name: '카테고리 선택: 한식' })).toBeTruthy();
    fill('메뉴명', '작성 중인 수정 메뉴');
    mock.detail.mockReturnValue(state({ ...detail, name: '재조회로 바뀐 서버명' }));
    view.rerender(<RecipeAddScreen />);
    expect(input('메뉴명').value).toBe('작성 중인 수정 메뉴');
    fireEvent.click(screen.getByRole('button', { name: '식재료 추가' }));
    expect(mock.push).toHaveBeenLastCalledWith('/recipes/ingredient-search?exclude=recipe-edit');
    view.unmount(); render(<RecipeAddScreen />);
    expect(input('메뉴명').value).toBe('작성 중인 수정 메뉴');
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('공용 검색 액션 이름을 유지하고 재료·부자재 route로 이동한다', () => {
    useRecipeDraft.getState().reset(addDraft());
    render(<RecipeAddScreen />);
    fireEvent.click(screen.getByRole('button', { name: '식재료 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '부자재 추가' }));
    expect(mock.push.mock.calls.map(([href]) => href)).toEqual([
      '/recipes/ingredient-search', '/recipes/material-search',
    ]);
  });

  it('재료비 소계는 서버 단가 초안의 1인분 값이고 DOM에서 재료 검색보다 먼저다', () => {
    useRecipeDraft.getState().reset(addDraft());
    render(<RecipeAddScreen />);
    expect(within(subtotalRow()).getByText('500원')).toBeTruthy();
    const subtotal = screen.getByText('재료비 소계');
    const search = screen.getByRole('button', { name: '식재료 추가' });
    expect(subtotal.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('공용 ScrollTabs의 기준 인분·1인분 전환이 재료 줄과 소계 금액에 같이 반영된다', () => {
    useRecipeDraft.getState().reset(addDraft());
    render(<RecipeAddScreen />);
    const one = screen.getAllByRole('tab', { name: '1인분' })[0]!;
    const batch = screen.getAllByRole('tab', { name: '10인분' })[0]!;
    expect(one.getAttribute('aria-selected')).toBe('true');
    expect(within(subtotalRow()).getByText('500원')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: '대파 사용량 수정' })).getByText('400원')).toBeTruthy();
    fireEvent.click(batch);
    expect(batch.getAttribute('aria-selected')).toBe('true');
    expect(within(subtotalRow()).getByText('5,000원')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: '대파 사용량 수정' })).getByText('4,000원')).toBeTruthy();
    fireEvent.click(one);
    expect(one.getAttribute('aria-selected')).toBe('true');
    expect(within(subtotalRow()).getByText('500원')).toBeTruthy();
  });

  it('legacy 월평균 초안값이 있어도 입력과 월평균 손익 탭을 다시 노출하지 않는다', () => {
    useRecipeDraft.getState().reset(addDraft());
    render(<RecipeAddScreen />);
    expect(screen.queryByRole('textbox', { name: '월 평균 판매량' })).toBeNull();
    expect(screen.queryByRole('tab', { name: '월평균 기준' })).toBeNull();
    expect(screen.getAllByRole('tab', { name: /인분$/ })).toHaveLength(4);
    expect(useRecipeDraft.getState().draft.avgMonthlySales).toBe('25');
  });

  it('카테고리 Select는 현재값·expanded를 알리고 선택하면 초안을 바꿄 즉시 닫힌다', () => {
    render(<RecipeAddScreen />);
    const emptySelect = screen.getByRole('button', { name: '카테고리 선택: 선택 안 됨' });
    expect(emptySelect.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(emptySelect);
    expect(emptySelect.getAttribute('aria-expanded')).toBe('true');
    expect(modal().getByText('카테고리 선택')).toBeTruthy();
    fireEvent.click(modal().getByRole('button', { name: '한식' }));
    expect(screen.queryByTestId('recipe-form-modal')).toBeNull();
    const selected = screen.getByRole('button', { name: '카테고리 선택: 한식' });
    expect(selected.getAttribute('aria-expanded')).toBe('false');
    expect(within(selected).getByText('한식')).toBeTruthy();
    expect(useRecipeDraft.getState().draft).toMatchObject({ categoryId: 'cat-ko', categoryName: '한식' });
  });

  it('사용량 수정 시트는 기준 인분 전체 수량과 소계를 같이 바꾼다', () => {
    useRecipeDraft.getState().reset(addDraft());
    render(<RecipeAddScreen />);
    fireEvent.click(screen.getByRole('button', { name: '대파 사용량 수정' }));
    expect(modal().getByText('사용량 수정')).toBeTruthy();
    fireEvent.change(modal().getByRole('textbox', { name: '사용량' }), { target: { value: '1500' } });
    fireEvent.click(modal().getByRole('button', { name: '저장' }));
    expect(screen.queryByTestId('recipe-form-modal')).toBeNull();
    expect(useRecipeDraft.getState().draft.lines[0]?.inputQty).toBe(1_500);
    expect(within(screen.getByRole('button', { name: '대파 사용량 수정' })).getByText('150g / 4.0%')).toBeTruthy();
    expect(within(subtotalRow()).getByText('700원')).toBeTruthy();
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('추가 저장은 기존 숫자 변환·trim·line·extra payload를 그대로 도메인 hook에 넘긴다', () => {
    useRecipeDraft.getState().reset(addDraft());
    render(<RecipeAddScreen />);
    fireEvent.click(screen.getByRole('button', { name: '레시피 추가' }));
    expect(mock.save).toHaveBeenCalledOnce();
    expect(mock.save).toHaveBeenCalledWith({
      patch: 'create', requestId: expect.any(String), name: '새 메뉴', price: 15_000, memo: '초안 메모', baseServings: 10,
      targetProfitRate: 35.5, categoryId: 'cat-ko',
      lines: [
        { ingredientId: 'ingredient-green-onion', subRecipeId: null, inputQty: 1_000 },
        { ingredientId: 'ingredient-sauce', subRecipeId: null, inputQty: 500 },
      ],
      extras: [{ materialId: 'material-box', name: '용기', amountPerServing: 600, qty: 2 }],
    }, expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function), onSettled: expect.any(Function) }), expect.any(Function));
    expect(mock.save.mock.calls[0]![0]).not.toHaveProperty('avgMonthlySales');
  });

  it('수정은 서버의 legacy 월평균 값을 draft에 보존하되 저장 payload에는 키를 보내지 않는다', () => {
    mock.routeId = detail.id; mock.detail.mockReturnValue(state(detail));
    render(<RecipeAddScreen />);
    expect(useRecipeDraft.getState().draft.avgMonthlySales).toBe('42');
    expect(screen.queryByRole('textbox', { name: '월 평균 판매량' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(mock.save).toHaveBeenCalledOnce();
    expect(mock.save.mock.calls[0]![0]).not.toHaveProperty('avgMonthlySales');
    expect(useRecipeDraft.getState().draft.avgMonthlySales).toBe('42');
  });

  it('추가 페이지 전체의 기본 입력·재료·부자재·손익·하단 행동이 확정안 순서다', () => {
    render(<RecipeAddScreen />);
    expect(screen.getAllByRole('textbox').map(el => el.getAttribute('aria-label')))
      .toEqual(['메뉴명', '판매가', '기준 인분', '목표 순이익률']);
    expect(screen.queryByRole('textbox', { name: '메모' })).toBeNull();
    expect(screen.queryByRole('button', { name: '설명 보기' })).toBeNull();
    expect(screen.queryByText('한 번에 만드는 양')).toBeNull();
    expect(screen.queryByText(/고정지출률은 저장 후/)).toBeNull();
    expect(screen.queryByText(/검색해서만 담을/)).toBeNull();
    expect(screen.queryByText(/부자재 단가는 마스터/)).toBeNull();
    expect(screen.getByText('등록된 식재료가 없습니다.')).toBeTruthy();
    expect(screen.getByText('등록된 부자재가 없습니다.')).toBeTruthy();
    const ordered = [screen.getByText('재료비 소계'), screen.getByRole('button', { name: '식재료 추가' }),
      screen.getByText('부자재비 소계'), screen.getByRole('button', { name: '부자재 추가' }),
      screen.getByText('판매 손익'), screen.getByRole('button', { name: '레시피 추가' })];
    ordered.slice(1).forEach((el, i) => expect(ordered[i]!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0));
    for (const label of ['식재료 추가', '부자재 추가']) {
      const button = screen.getByRole('button', { name: label });
      for (const corner of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'] as const)
        expect(getComputedStyle(button)[corner]).toBe('0px');
      expect(button.parentElement!.lastElementChild).toBe(button);
      // Body padding must not inset the card-wide action.
      expect(getComputedStyle(button.parentElement!).paddingLeft).toBe('0px');
    }
    expect(screen.getByRole('button', { name: '레시피 추가' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('등록 카테고리만 선택하며 필수 항목이 준비돼야 저장한다', () => {
    render(<RecipeAddScreen />);
    fill('메뉴명', '검수 메뉴'); fill('판매가', '12000');
    const submit = screen.getByRole('button', { name: '레시피 추가' });
    fireEvent.click(submit); expect(mock.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '카테고리 선택: 선택 안 됨' }));
    expect(modal().queryByRole('button', { name: '지정 안 함' })).toBeNull();
    expect(modal().queryByRole('button', { name: '카테고리 관리' })).toBeNull();
    fireEvent.click(modal().getByRole('button', { name: '한식' }));
    expect(submit.getAttribute('aria-disabled')).not.toBe('true');
    fill('기준 인분', ''); expect(submit.getAttribute('aria-disabled')).toBe('true');
    fill('기준 인분', '10'); fill('목표 순이익률', '');
    expect(submit.getAttribute('aria-disabled')).toBe('true');
    fill('목표 순이익률', '40'); fireEvent.click(submit);
    expect(mock.save).toHaveBeenCalledOnce();
    expect(mock.save.mock.calls[0]![0]).toMatchObject({ name: '검수 메뉴', categoryId: 'cat-ko', memo: null });
  });

  it('부자재 소계는 수량을 반영한 1인분 금액·판매가 대비 비율이며 메모 데이터는 숨겨도 보존한다', () => {
    useRecipeDraft.getState().reset(addDraft()); render(<RecipeAddScreen />);
    const subtotal = within(screen.getByText('부자재비 소계').parentElement!);
    expect(subtotal.getByText('600원')).toBeTruthy();
    expect(subtotal.getByText('4.0%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '용기 부자재 사용량 수정' }));
    fireEvent.change(modal().getByRole('textbox', { name: '부자재 1인분 사용량' }), { target: { value: '3' } });
    fireEvent.click(modal().getByRole('button', { name: '저장' }));
    expect(subtotal.getByText('900원')).toBeTruthy();
    expect(subtotal.getByText('6.0%')).toBeTruthy();
    expect(useRecipeDraft.getState().draft.memo).toBe('  초안 메모  ');
  });

  it('재료 행은 사용량·비율과 화살표를 표시하고 삭제는 팝업 안에서만 초안에 반영한다', () => {
    useRecipeDraft.getState().reset(addDraft()); render(<RecipeAddScreen />);
    const row = screen.getByRole('button', { name: '대파 사용량 수정' });
    expect(within(row).getByText('100g / 2.6%')).toBeTruthy();
    expect(row.querySelector('svg')).not.toBeNull();
    expect(screen.queryByRole('button', { name: '대파 삭제' })).toBeNull();
    fireEvent.click(row);
    fireEvent.click(modal().getByRole('button', { name: '삭제' }));
    expect(useRecipeDraft.getState().draft.lines.map(l => l.name)).toEqual(['소스']);
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('부자재 소수 사용량은 1인분 기준이며 닫기·삭제·저장이 실제 레시피 저장과 분리된다', () => {
    useRecipeDraft.getState().reset(addDraft()); render(<RecipeAddScreen />);
    fireEvent.click(screen.getByRole('button', { name: '용기 부자재 사용량 수정' }));
    fireEvent.change(modal().getByRole('textbox', { name: '부자재 1인분 사용량' }), { target: { value: '0.25' } });
    expect(modal().getByText('75원')).toBeTruthy(); expect(modal().getByText('750원')).toBeTruthy();
    fireEvent.click(modal().getByRole('button', { name: '닫기' }));
    expect(useRecipeDraft.getState().draft.extras[0]?.qty).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: '용기 부자재 사용량 수정' }));
    fireEvent.change(modal().getByRole('textbox', { name: '부자재 1인분 사용량' }), { target: { value: '0' } });
    expect(modal().getByRole('button', { name: '저장' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.change(modal().getByRole('textbox', { name: '부자재 1인분 사용량' }), { target: { value: '0.25' } });
    fireEvent.click(modal().getByRole('button', { name: '저장' }));
    expect(useRecipeDraft.getState().draft.extras[0]?.qty).toBe(0.25);
    fireEvent.click(screen.getByRole('button', { name: '용기 부자재 사용량 수정' }));
    fireEvent.click(modal().getByRole('button', { name: '삭제' }));
    expect(useRecipeDraft.getState().draft.extras).toEqual([]);
    expect(mock.save).not.toHaveBeenCalled();
  });
});
