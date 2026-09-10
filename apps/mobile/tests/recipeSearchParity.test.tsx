import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeIngredientSearchScreen from '@/features/recipes/screens/RecipeIngredientSearchScreen';
import MaterialSearchScreen from '@/features/recipes/screens/MaterialSearchScreen';
import { emptyDraft, useRecipeDraft } from '@/features/recipes/draftStore';
import type { IngredientRow } from '@/features/ingredients/hooks';
import type { MaterialRow } from '@/features/master-data/hooks';
import { COLOR, T } from '@/theme/tokens';

const mock = vi.hoisted(() => ({
  ingredients: vi.fn(), lists: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn(),
  canGoBack: false,
}));

vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return {
    ...rn,
    // Only native Modal visibility is adapted. Both screens, safeBack, Zustand
    // draftStore and kit SearchBar/Input/Button/Sheet are real.
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
      visible ? <div data-testid="recipe-search-modal">{children}</div> : null,
  };
});
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ exclude: 'editing-recipe' }),
  useRouter: () => ({ push: mock.push }),
  router: { canGoBack: () => mock.canGoBack, back: mock.back, replace: mock.replace },
}));
vi.mock('@/features/ingredients/hooks', () => ({ useIngredientList: mock.ingredients }));
vi.mock('@/features/master-data/hooks', () => ({ useSettingsLists: mock.lists }));

const ingredient = (next: Partial<IngredientRow>): IngredientRow => ({
  id: 'green-onion', name: '대파', categoryName: '농산 신선', baseUnit: 'g', perVolume: 1,
  safetyStock: 100, stockTotal: 750, basePrice: 4, soonOut: false,
  vendorName: null, memo: null, lastInboundAt: null, ...next,
});
const ingredients: IngredientRow[] = [
  ingredient({ stockTotal: -750 }),
  ingredient({ id: 'sauce', name: 'BBQ 소스', categoryName: '양념 소스', baseUnit: 'ml', basePrice: 2, stockTotal: 900 }),
  ingredient({ id: 'egg', name: '계란', categoryName: '축산', baseUnit: 'ea', basePrice: 300, stockTotal: 12, safetyStock: 1 }),
];
const materials: MaterialRow[] = [
  { id: 'box', name: '포장 용기', categoryId: 'packing', categoryName: '포장 소모품', unitCost: 300, unitLabel: '개', memo: null, usedCount: 2 },
  { id: 'gas', name: 'BBQ 가스', categoryId: 'heat', categoryName: '가열 연료', unitCost: 120.5, unitLabel: '회', memo: null, usedCount: 1 },
];
const state = <T,>(data: T) => ({ data, isLoading: false, error: null, refetch: vi.fn() });
const draft = () => useRecipeDraft.getState().draft;
const modal = () => within(screen.getByTestId('recipe-search-modal'));
const fill = (name: string, value: string) => fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
const choose = (name: string) => fireEvent.click(screen.getByRole('button', { name: `${name} 담기` }));
const cssColor = (color: string) => { const node = document.createElement('span'); node.style.color = color; return node.style.color; };

// Hook reads and navigation effects are mocked; global setup rejects direct RPC.
// These assertions cover host text/actions and local drafts, not actual navigation,
// save_recipe, browser geometry, native scrolling/keyboard, or visual approval.
describe('RCP-10/11 실제 검색 화면과 공유 초안 연결', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.canGoBack = false;
    useRecipeDraft.getState().reset({ ...emptyDraft(), name: '작성 중 메뉴', memo: '보존 메모', baseServings: '10' });
    mock.ingredients.mockReturnValue(state(ingredients));
    mock.lists.mockReturnValue(state({ materials }));
  });
  afterEach(() => { cleanup(); useRecipeDraft.getState().reset(emptyDraft()); });

  it.each([
    ['대 파', '대파'], ['농 산 신 선', '대파'], ['bbq소스', 'BBQ 소스'],
  ])('재료 검색은 이름·카테고리의 공백/대소문자를 정규화한다: %s', (query, name) => {
    render(<RecipeIngredientSearchScreen />);
    fill('식재료 이름으로 검색', query);
    expect(screen.getAllByRole('button', { name: / 담기$/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: `${name} 담기` })).toBeTruthy();
    expect(draft().lines).toEqual([]);
  });

  it.each([
    ['포 장용기', '포장 용기'], ['가 열 연 료', 'BBQ 가스'], ['bbq가스', 'BBQ 가스'],
  ])('부자재 검색은 이름·카테고리의 공백/대소문자를 정규화한다: %s', (query, name) => {
    render(<MaterialSearchScreen />);
    fill('부자재 이름으로 검색', query);
    expect(screen.getAllByRole('button', { name: / 담기$/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: `${name} 담기` })).toBeTruthy();
    expect(draft().extras).toEqual([]);
  });

  it.each([
    ['재료', RecipeIngredientSearchScreen, '식재료 이름으로 검색', 3],
    ['부자재', MaterialSearchScreen, '부자재 이름으로 검색', 2],
  ] as const)('%s 검색 결과 없음과 검색어 지우기가 기존 목록을 복구한다', (_label, Host, placeholder, count) => {
    render(<Host />);
    fill(placeholder, '일치없음');
    expect(screen.getByText("'일치없음' 검색 결과가 없어요")).toBeTruthy();
    expect(screen.queryByRole('button', { name: / 담기$/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(screen.getAllByRole('button', { name: / 담기$/ })).toHaveLength(count);
  });

  it.each(['취소', '닫기'])('재료 사용량 %s는 미확정 입력을 초안에 반영하지 않고 재열면 초기화한다', (close) => {
    render(<RecipeIngredientSearchScreen />);
    const before = structuredClone(draft());
    choose('대파'); fill('사용량', '250.5');
    expect(draft()).toEqual(before);
    fireEvent.click(modal().getByRole('button', { name: close }));
    expect(screen.queryByTestId('recipe-search-modal')).toBeNull();
    expect(draft()).toEqual(before);
    expect(mock.replace).not.toHaveBeenCalled(); expect(mock.back).not.toHaveBeenCalled();
    choose('대파');
    expect((modal().getByRole('textbox', { name: '사용량' }) as HTMLInputElement).value).toBe('');
  });

  it.each(['', '0'])('양수가 아닌 사용량 %s는 담기 disabled이며 초안을 바꾸지 않는다', (qty) => {
    render(<RecipeIngredientSearchScreen />); choose('대파'); fill('사용량', qty);
    const button = modal().getByRole('button', { name: '담기' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(draft().lines).toEqual([]); expect(mock.replace).not.toHaveBeenCalled();
  });

  it.each([
    ['대파', 'green-onion', 'g', 4], ['BBQ 소스', 'sauce', 'ml', 2], ['계란', 'egg', '개', 300],
  ] as const)('%s 확정은 기준 인분 전체량과 단가·ID·표시 단위를 실제 draftStore에 전달한다', (name, id, unit, price) => {
    render(<RecipeIngredientSearchScreen />); choose(name);
    expect(modal().getByText('10인분 사용량')).toBeTruthy();
    fill('사용량', '250.5');
    expect(draft().lines).toEqual([]);
    fireEvent.click(modal().getByRole('button', { name: '담기' }));
    expect(draft().lines).toEqual([{ ingredientId: id, subRecipeId: null, name, unit, unitPrice: price, inputQty: 250.5 }]);
    expect(draft()).toMatchObject({ name: '작성 중 메뉴', memo: '보존 메모', baseServings: '10' });
    expect(screen.queryByTestId('recipe-search-modal')).toBeNull();
    expect(within(screen.getByRole('button', { name: `${name} 담기` })).getByText('담김')).toBeTruthy();
    expect(mock.replace).toHaveBeenCalledWith('/recipes/add'); expect(mock.back).not.toHaveBeenCalled();
  });

  it('이미 담긴 재료는 현재량을 보여주며 명시한 추가량은 기존 한 줄에 합산한다', () => {
    useRecipeDraft.getState().addLine({ ingredientId: 'green-onion', subRecipeId: null, name: '대파', unit: 'g', inputQty: 100, unitPrice: 4 });
    render(<RecipeIngredientSearchScreen />);
    expect(within(screen.getByRole('button', { name: '대파 담기' })).getByText('담김')).toBeTruthy();
    choose('대파');
    expect((modal().getByRole('textbox', { name: '사용량' }) as HTMLInputElement).value).toBe('100');
    fill('사용량', '25'); fireEvent.click(modal().getByRole('button', { name: '담기' }));
    expect(draft().lines).toHaveLength(1); expect(draft().lines[0]?.inputQty).toBe(125);
  });

  it('단가 미산출 재료는 0으로 치환하지 않고 null 단가로 담긴다', () => {
    mock.ingredients.mockReturnValue(state([ingredient({ basePrice: null })]));
    render(<RecipeIngredientSearchScreen />);
    expect(screen.getByText(/단가 산출 전/)).toBeTruthy(); choose('대파');
    expect(modal().getAllByText('단가 산출 전')).toHaveLength(2);
    fill('사용량', '5'); fireEvent.click(modal().getByRole('button', { name: '담기' }));
    expect(draft().lines[0]).toMatchObject({ unitPrice: null, inputQty: 5 });
  });

  it('서버 음수 재고를 −750g 그대로 음수 색·강조로 보여주고 양수 대조군과 구분한다', () => {
    mock.ingredients.mockReturnValue(state([ingredients[0], ingredient({ id: 'positive', name: '양수 대파' })]));
    render(<RecipeIngredientSearchScreen />);
    const negative = within(screen.getByRole('button', { name: '대파 담기' }));
    expect(negative.getByText('소진')).toBeTruthy();
    const negValue = negative.getByText('−750g');
    expect(getComputedStyle(negValue).color).toBe(cssColor(COLOR.status.negative));
    expect(getComputedStyle(negValue).fontWeight).toBe('800');
    const positive = within(screen.getByRole('button', { name: '양수 대파 담기' }));
    expect(getComputedStyle(positive.getByText('750g')).color).toBe(cssColor(T.sub2));
    expect(positive.queryByText('소진')).toBeNull();
  });

  it('부자재 단가·단위 표기와 수량 1의 실제 초안 전달을 보존한다', () => {
    render(<MaterialSearchScreen />);
    // Existing won() display rounds to a whole won; the draft keeps raw unitCost.
    expect(within(screen.getByRole('button', { name: 'BBQ 가스 담기' })).getByText('121원/회')).toBeTruthy();
    choose('BBQ 가스');
    expect(draft().extras).toEqual([]);
    fill('부자재 사용량', '10');
    fireEvent.click(modal().getByRole('button', { name: '담기' }));
    expect(draft().extras).toEqual([{ materialId: 'gas', name: 'BBQ 가스', unitCost: 120.5, amountPerServing: 120.5, qty: 1 }]);
    expect(draft().lines).toEqual([]); expect(draft().memo).toBe('보존 메모');
    expect(within(screen.getByRole('button', { name: 'BBQ 가스 담기' })).getByText('담김')).toBeTruthy();
    expect(mock.replace).toHaveBeenCalledWith('/recipes/add');
  });

  it('이미 담긴 부자재는 10인분 10개 확정 시 기존 한 줄의 1인분 수량만 1 증가한다', () => {
    useRecipeDraft.getState().addExtra({ materialId: 'box', name: '포장 용기', unitCost: 300, amountPerServing: 600, qty: 2 });
    render(<MaterialSearchScreen />);
    expect(within(screen.getByRole('button', { name: '포장 용기 담기' })).getByText('담김')).toBeTruthy();
    choose('포장 용기');
    fill('부자재 사용량', '10');
    fireEvent.click(modal().getByRole('button', { name: '담기' }));
    expect(draft().extras).toEqual([{ materialId: 'box', name: '포장 용기', unitCost: 300, amountPerServing: 900, qty: 3 }]);
  });

  it('부자재 팝업은 취소 시 무변경, 확정 시 배치→1인분 환산과 비용을 일치시킨다', () => {
    render(<MaterialSearchScreen />);
    choose('포장 용기');
    fill('부자재 사용량', '2');
    expect(modal().getByText('600원')).toBeTruthy();
    expect(modal().getByText('60원')).toBeTruthy();
    fireEvent.click(modal().getByRole('button', { name: '취소' }));
    expect(draft().extras).toEqual([]);
    expect(mock.replace).not.toHaveBeenCalled();
    choose('포장 용기');
    fill('부자재 사용량', '0');
    expect(modal().getByRole('button', { name: '담기' }).getAttribute('aria-disabled')).toBe('true');
    fill('부자재 사용량', '2');
    fireEvent.click(modal().getByRole('button', { name: '담기' }));
    expect(draft().extras[0]?.qty).toBe(0.2);
  });

  it('부자재 관리 이동은 초안을 변경하지 않고 기존 관리 route를 연다', () => {
    const before = structuredClone(draft()); render(<MaterialSearchScreen />);
    fireEvent.click(screen.getByRole('button', { name: '부자재 관리로 이동' }));
    expect(mock.push).toHaveBeenCalledWith('/recipes/materials'); expect(draft()).toEqual(before);
  });

  it.each([
    ['재료', RecipeIngredientSearchScreen, false], ['재료', RecipeIngredientSearchScreen, true],
    ['부자재', MaterialSearchScreen, false], ['부자재', MaterialSearchScreen, true],
  ] as const)('%s 뒤로는 기존 safeBack 정책을 따른다 (case %#)', (_label, Host, hasHistory) => {
    mock.canGoBack = hasHistory; const before = structuredClone(draft()); render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
    if (hasHistory) { expect(mock.back).toHaveBeenCalledOnce(); expect(mock.replace).not.toHaveBeenCalled(); }
    else { expect(mock.replace).toHaveBeenCalledWith('/recipes/add'); expect(mock.back).not.toHaveBeenCalled(); }
    expect(draft()).toEqual(before);
  });
});
