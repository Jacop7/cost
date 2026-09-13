import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import RecipeManageScreen from '@/features/recipes/screens/RecipeManageScreen';

const mock = vi.hoisted(() => ({ list: vi.fn(), push: vi.fn(), business: vi.fn() }));
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => 'menu-manage-tests' }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock('@/lib/nav', () => ({ safeBack: vi.fn() }));
vi.mock('@/features/recipes/hooks', () => ({ useRecipeList: mock.list }));
vi.mock('@/features/master-data/hooks', () => ({ useSettingsLists: () => ({ data: { recipeCategories: [
  { id: 'soup', name: '찌개' }, { id: 'rice', name: '밥' },
] }, isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock('@/features/business-day/businessDay', () => ({ useBusinessDay: mock.business }));
vi.mock('react-native', async original => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div>{children}</div> : null,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mock.list.mockReturnValue({ data: [
    { id: 'kimchi', name: '김치찌개', categoryId: 'soup', categoryName: '찌개', price: 9000, baseServings: 10, active: true, editRevision: '1' },
    { id: 'rice', name: '공기밥', categoryId: 'rice', categoryName: '밥', price: 1000, baseServings: 1, active: false, editRevision: '2' },
  ], isLoading: false, error: null, refetch: vi.fn() });
  mock.business.mockReturnValue({ data: { status: 'closed' }, isError: false, refetch: vi.fn() });
});
afterEach(cleanup);

it('판매 중지 메뉴도 포함하고 카테고리·이름 교차 검색과 등록을 연결한다', () => {
  render(<RecipeManageScreen />);
  expect(screen.getByText('등록된 메뉴 2')).toBeTruthy();
  expect(screen.getByText('판매중지')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: '찌개' }));
  expect(screen.queryByText('공기밥')).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: '메뉴 이름으로 검색' }), { target: { value: '김치 찌개' } });
  expect(screen.getByText('김치찌개')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '메뉴 등록' }));
  expect(mock.push).toHaveBeenCalledWith('/recipes/add');
});
it('행 메뉴는 기존 상세·수정으로 연결하고 금지된 삭제를 노출하지 않는다', () => {
  render(<RecipeManageScreen />);
  fireEvent.click(screen.getByRole('button', { name: '김치찌개 관리 메뉴 열기' }));
  expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '자세히 보기' }));
  expect(mock.push).toHaveBeenCalledWith('/recipes/kimchi');
  fireEvent.click(screen.getByRole('button', { name: '김치찌개 관리 메뉴 열기' }));
  fireEvent.click(screen.getByRole('button', { name: '수정' }));
  expect(mock.push).toHaveBeenCalledWith('/recipes/add?id=kimchi');
});
it.each(['open', 'break'])('%s 중에는 기존 수정 확인을 거친다', status => {
  mock.business.mockReturnValue({ data: { status }, isError: false, refetch: vi.fn() });
  render(<RecipeManageScreen />);
  fireEvent.click(screen.getByRole('button', { name: '김치찌개 관리 메뉴 열기' }));
  fireEvent.click(screen.getByRole('button', { name: '수정' }));
  expect(mock.push).not.toHaveBeenCalled();
  expect(screen.getByText('현재 영업 중이므로, 수정 사항은 영업 종료 후 반영됩니다.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '수정' }));
  expect(mock.push).toHaveBeenCalledWith('/recipes/add?id=kimchi');
});
it('헤더 더보기에서 메뉴 목록 편집 페이지를 연다', () => {
  render(<RecipeManageScreen />);
  fireEvent.click(screen.getByRole('button', { name: '메뉴 관리 메뉴 열기' }));
  expect(screen.getByRole('button', { name: '카테고리 편집' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '메뉴 목록 편집' }));
  expect(mock.push).toHaveBeenCalledWith('/recipes/manage-order?kind=recipe&target=item');
});
it('조회 실패를 빈 목록으로 표시하지 않는다', () => {
  mock.list.mockReturnValue({ data: undefined, isLoading: false, error: new Error('offline'), refetch: vi.fn() });
  render(<RecipeManageScreen />);
  expect(screen.getByText('정보를 불러오지 못했어요')).toBeTruthy();
  expect(screen.queryByText('등록된 메뉴가 없어요')).toBeNull();
});
