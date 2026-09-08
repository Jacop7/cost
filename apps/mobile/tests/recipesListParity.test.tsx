import { createElement, type ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterButton } from '@/components/kit';
import RecipesListScreen from '@/features/recipes/screens/RecipesListScreen';
import type { RecipeRow } from '@/features/recipes/hooks';
import { T } from '@/theme/tokens';

const mock = vi.hoisted(() => ({
  recipes: vi.fn(), lists: vi.fn(), push: vi.fn(), refetch: vi.fn(), longFilterText: vi.fn(),
}));

vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return {
    ...rn,
    // Adapt Modal visibility for jsdom and observe one Text's props below.
    // Screen, kit filters/Sheets, tabs and callbacks remain real RNW hosts.
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
      visible ? <div data-testid="recipes-list-modal">{children}</div> : null,
    Text: (props: React.ComponentProps<typeof rn.Text>) => {
      if (props.children === '순이익률을 기준으로 매우 긴 검수용 필터 라벨') mock.longFilterText(props);
      return createElement(rn.Text, props);
    },
  };
});
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock('@/features/recipes/hooks', () => ({ useRecipeList: mock.recipes }));
vi.mock('@/features/master-data/hooks', () => ({ useSettingsLists: mock.lists }));

const row = ({ id, name, ...value }: Partial<RecipeRow> & Pick<RecipeRow, 'id' | 'name'>): RecipeRow => ({
  id,
  name,
  price: 10_000,
  active: true,
  categoryId: 'cat-ko',
  categoryName: '한식',
  taxMode: 'included',
  baseServings: 1,
  targetProfitRate: 10,
  avgMonthlySales: 0,
  materialCost: 2_000,
  extraCost: 500,
  tax: 909,
  fixedCost: 3_130,
  profit: 3_461,
  profitRate: 0.1,
  materialRate: 0.2,
  unknownCostLines: 0,
  blockedBy: null,
  ...value,
});

// Values are deliberately non-derived and distinct: assertions below prove that
// the list preserves recipe_list fields instead of silently recomputing them.
const rows: RecipeRow[] = [
  row({ id: 'stopped', name: '정지 메뉴', active: false, categoryId: 'cat-cafe', categoryName: '카페',
    profitRate: 0.01, targetProfitRate: 50, price: 25_000, avgMonthlySales: 999 }),
  row({ id: 'low', name: '제육볶음', profitRate: 0.05, targetProfitRate: 10, price: 12_345,
    avgMonthlySales: 10, profit: 4_321.6, materialRate: 0.6789, materialCost: 2_345.6,
    unknownCostLines: 2 }),
  row({ id: 'price', name: '파스타', categoryId: 'cat-west', categoryName: '양식', profitRate: 0.1,
    targetProfitRate: 5, price: 20_000, avgMonthlySales: 30 }),
  row({ id: 'equal', name: '비빔밥', profitRate: 0.2, targetProfitRate: 20,
    price: 7_000, avgMonthlySales: null }),
  row({ id: 'blocked', name: '판매량 메뉴', profitRate: 0.3, targetProfitRate: 35,
    price: 12_000, avgMonthlySales: 100, blockedBy: '대파' }),
  row({ id: 'high', name: '하이 메뉴', categoryId: 'cat-cafe', categoryName: '카페', profitRate: 0.4,
    targetProfitRate: 30, price: 15_000, avgMonthlySales: 5 }),
];

const state = <T,>(data: T) => ({ data, isLoading: false, error: null, refetch: mock.refetch });
const modal = () => within(screen.getByTestId('recipes-list-modal'));
const names = () => screen.getAllByRole('button', { name: / 상세$/ })
  .map((button) => button.getAttribute('aria-label')!.replace(/ 상세$/, ''));
const chooseStatus = (currentLabel: string, nextLabel: string) => {
  fireEvent.click(screen.getByRole('button', { name: `${currentLabel} 변경` }));
  fireEvent.click(modal().getByRole('button', { name: nextLabel }));
};
const chooseTarget = (currentLabel: string, nextLabel: string) => {
  fireEvent.click(screen.getByRole('button', { name: `${currentLabel} 변경` }));
  fireEvent.click(modal().getByRole('button', { name: nextLabel }));
};
const chooseSort = (label: string) => {
  fireEvent.click(screen.getByRole('button', { name: '순이익률 낮은순 변경' }));
  fireEvent.click(modal().getByRole('button', { name: label }));
};
const searchInput = () => screen.getByRole('textbox', { name: '메뉴·카테고리 검색' }) as HTMLInputElement;
const rgb = (hex: string) => {
  const value = hex.replace('#', '');
  return `rgb(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(value.slice(2, 4), 16)}, ${Number.parseInt(value.slice(4, 6), 16)})`;
};

// Actual RecipesListScreen + kit + RNW host integration. Hook responses and
// router effects are mocked, so these tests do not certify recipe_list SQL/RPC,
// native gesture/font/layout behavior, or visual approval.
describe('RCP-01 메뉴 목록 현재 동작 보존', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.recipes.mockReturnValue(state(rows));
    mock.lists.mockReturnValue(state({ recipeCategories: [
      { id: 'cat-ko', name: '한식' }, { id: 'cat-west', name: '양식' }, { id: 'cat-cafe', name: '카페' },
    ] }));
  });

  it('기본은 판매중만 순이익률 낮은순으로 보여준다', () => {
    render(<RecipesListScreen />);
    expect(names()).toEqual(['제육볶음', '파스타', '비빔밥', '판매량 메뉴', '하이 메뉴']);
    expect(screen.queryByRole('button', { name: '정지 메뉴 상세' })).toBeNull();
    expect(screen.getByRole('button', { name: '판매중 변경' })).toBeTruthy();
  });

  it('RCP-01 필터 3개는 공용 FilterButton의 접근성 이름·체버론과 표면을 쓴다', () => {
    render(<RecipesListScreen />);
    for (const label of ['순이익률 낮은순', '판매중', '목표']) {
      const button = screen.getByRole('button', { name: `${label} 변경` });
      expect(button.querySelector('svg')).toBeTruthy();
      expect(getComputedStyle(button).backgroundColor).toBe(rgb(T.surface));
      expect(getComputedStyle(button).backgroundColor).not.toBe(rgb(T.ink));
    }
  });

  it('공용 SortSheet는 월평균 기반 판매량 정렬 없이 실제 값의 4종 정렬만 제공한다', () => {
    render(<RecipesListScreen />);
    fireEvent.click(screen.getByRole('button', { name: '순이익률 낮은순 변경' }));
    const sheet = modal();
    expect(sheet.getByText('정렬 기준')).toBeTruthy();
    for (const label of ['순이익률 낮은순', '순이익률 높은순', '판매가 높은순', '판매가 낮은순']) {
      expect(sheet.getByRole('button', { name: label })).toBeTruthy();
    }
    expect(sheet.queryByRole('button', { name: '판매량 많은순' })).toBeNull();
  });

  it('긴 라벨의 FilterButton은 100% 너비 상한을 두고 Text를 줄 고정 없이 줄어들게 한다', () => {
    const label = '순이익률을 기준으로 매우 긴 검수용 필터 라벨';
    render(<FilterButton label={label} onPress={vi.fn()} />);
    const button = screen.getByRole('button', { name: `${label} 변경` });
    expect(getComputedStyle(button).maxWidth).toBe('100%');
    expect(mock.longFilterText).toHaveBeenCalledOnce();
    const props = mock.longFilterText.mock.calls[0]![0] as { numberOfLines?: number; style?: Record<string, unknown> };
    expect(props.numberOfLines).toBeUndefined();
    expect(props.style).toMatchObject({ flexShrink: 1 });
  });

  for (const [sort, expected] of [
    ['순이익률 낮은순', ['정지 메뉴', '제육볶음', '파스타', '비빔밥', '판매량 메뉴', '하이 메뉴']],
    ['순이익률 높은순', ['하이 메뉴', '판매량 메뉴', '비빔밥', '파스타', '제육볶음', '정지 메뉴']],
    ['판매가 높은순', ['정지 메뉴', '파스타', '하이 메뉴', '제육볶음', '판매량 메뉴', '비빔밥']],
    ['판매가 낮은순', ['비빔밥', '판매량 메뉴', '제육볶음', '하이 메뉴', '파스타', '정지 메뉴']],
  ] as const) {
    it(`${sort} 서버 필드 순서를 적용한다`, () => {
      render(<RecipesListScreen />);
      chooseStatus('판매중', '전체');
      chooseSort(sort);
      expect(names()).toEqual(expected);
    });
  }

  it('판매 상태 필터는 정지만 보이고 전체로 돌아온다', () => {
    render(<RecipesListScreen />);
    chooseStatus('판매중', '판매중지');
    expect(names()).toEqual(['정지 메뉴']);
    chooseStatus('판매중지', '전체');
    expect(names()).toEqual(['정지 메뉴', '제육볶음', '파스타', '비빔밥', '판매량 메뉴', '하이 메뉴']);
  });

  it('목표 필터는 실제비율×100을 비교하고 같은 값은 달성으로 분류한다', () => {
    render(<RecipesListScreen />);
    chooseTarget('목표', '목표 미달');
    expect(names()).toEqual(['제육볶음', '판매량 메뉴']);
    chooseTarget('목표 미달', '목표 달성');
    expect(names()).toEqual(['파스타', '비빔밥', '하이 메뉴']);
  });

  it('카테고리 탭과 공백을 제거한 메뉴명 검색을 함께 적용한다', () => {
    render(<RecipesListScreen />);
    fireEvent.click(screen.getByRole('tab', { name: '한식' }));
    expect(names()).toEqual(['제육볶음', '비빔밥', '판매량 메뉴']);
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    fireEvent.change(searchInput(), { target: { value: '제 육 볶 음' } });
    expect(names()).toEqual(['제육볶음']);
  });

  it('카테고리명도 검색하고 결과가 없으면 검색 문구를 보여준다', () => {
    render(<RecipesListScreen />);
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    fireEvent.change(searchInput(), { target: { value: '양 식' } });
    expect(names()).toEqual(['파스타']);
    fireEvent.change(searchInput(), { target: { value: ' 없는 메뉴 ' } });
    expect(screen.getByText("'없는 메뉴' 검색 결과가 없어요")).toBeTruthy();
    expect(screen.getByText('다른 이름으로 찾아보세요')).toBeTruthy();
  });

  it('검색 닫기는 값을 초기화하고 목록을 복구하며 재개하면 빈 입력이다', () => {
    render(<RecipesListScreen />);
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    fireEvent.change(searchInput(), { target: { value: '제육' } });
    expect(names()).toEqual(['제육볶음']);
    fireEvent.click(screen.getByRole('button', { name: '검색 닫기' }));
    expect(screen.queryByRole('textbox', { name: '메뉴·카테고리 검색' })).toBeNull();
    expect(names()).toEqual(['제육볶음', '파스타', '비빔밥', '판매량 메뉴', '하이 메뉴']);
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    expect(searchInput().value).toBe('');
  });

  it('헤더 검색 토글로 닫아도 숨은 필터를 남기지 않고 재개할 때 빈 값이다', () => {
    render(<RecipesListScreen />);
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    fireEvent.change(searchInput(), { target: { value: '제육' } });
    expect(names()).toEqual(['제육볶음']);
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    expect(screen.queryByRole('textbox', { name: '메뉴·카테고리 검색' })).toBeNull();
    expect(names()).toEqual(['제육볶음', '파스타', '비빔밥', '판매량 메뉴', '하이 메뉴']);
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    expect(searchInput().value).toBe('');
  });

  it('서버 금액·비율을 그대로 표시하고 단가 누락 경고를 숨기지 않는다', () => {
    render(<RecipesListScreen />);
    const card = within(screen.getByRole('button', { name: '제육볶음 상세' }));
    expect(card.getByText('12,345원')).toBeTruthy();
    expect(card.getByText('5.0%')).toBeTruthy();
    expect(card.getByText('4,322원')).toBeTruthy();
    expect(card.getByText('67.8%')).toBeTruthy();
    expect(card.getByText('2,346원')).toBeTruthy();
    expect(card.getByText('단가 없는 재료 2개가 원가에서 빠져 있어요')).toBeTruthy();
  });

  it('재료 부족과 판매중지 카드는 기존 opacity를 유지하고 정상 카드는 1이다', () => {
    render(<RecipesListScreen />);
    const blocked = screen.getByRole('button', { name: '판매량 메뉴 상세' }).firstElementChild as HTMLElement;
    const normal = screen.getByRole('button', { name: '제육볶음 상세' }).firstElementChild as HTMLElement;
    expect(getComputedStyle(blocked).opacity).toBe('0.55');
    expect(getComputedStyle(normal).opacity).toBe('1');
    expect(within(screen.getByRole('button', { name: '판매량 메뉴 상세' })).getByText('재료 부족')).toBeTruthy();
    chooseStatus('판매중', '전체');
    const stopped = screen.getByRole('button', { name: '정지 메뉴 상세' }).firstElementChild as HTMLElement;
    expect(getComputedStyle(stopped).opacity).toBe('0.55');
    expect(within(screen.getByRole('button', { name: '정지 메뉴 상세' })).getByText('판매중지')).toBeTruthy();
  });

  it('카드·알림·메뉴 추가를 각각 약속된 route로 이동시킨다', () => {
    render(<RecipesListScreen />);
    fireEvent.click(screen.getByRole('button', { name: '제육볶음 상세' }));
    fireEvent.click(screen.getByRole('button', { name: '알림' }));
    fireEvent.click(screen.getByRole('button', { name: '메뉴 추가' }));
    expect(mock.push.mock.calls.map(([href]) => href)).toEqual([
      '/recipes/low', '/my/notifications', '/recipes/add',
    ]);
  });
});
