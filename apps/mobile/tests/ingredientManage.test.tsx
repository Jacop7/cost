vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => 'test-store-order' }));
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import IngredientManageScreen from '@/features/ingredients/screens/IngredientManageScreen';
import { checkIngredientDeletion } from '@/features/ingredients/deleteCheck';
vi.mock('@/features/ingredients/deleteCheck', () => ({ checkIngredientDeletion: vi.fn() }));

const mock = vi.hoisted(() => ({ list: vi.fn(), mutate: vi.fn(), push: vi.fn(), business: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mock.push }), router: { canGoBack: () => false, replace: vi.fn() } }));
vi.mock('@/features/ingredients/hooks', () => ({ useIngredientDetail: () => ({ data: { stockTracking: true } }), useIngredientList: mock.list, useDeactivateIngredient: () => ({ mutate: mock.mutate, isPending: false }) }));
vi.mock('@/features/master-data/hooks', () => ({ useReorderCategories: () => ({ mutateAsync: vi.fn() }), useSettingsLists: () => ({ data: { categories: [{ id: 'veg', name: '채소' }, { id: 'animal', name: '축산' }] }, isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock('@/features/business-day/businessDay', () => ({ useBusinessDay: mock.business }));
vi.mock('react-native', async original => ({
  ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div>{children}</div> : null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkIngredientDeletion).mockResolvedValue({ canDelete: true, menuNames: [] });
  mock.list.mockReturnValue({ data: [
    { id: 'onion', name: '대파', categoryName: '채소', baseUnit: 'g', basePrice: 4 },
    { id: 'egg', name: '계란', categoryName: '축산', baseUnit: 'ea', basePrice: null },
  ], isLoading: false, error: null, refetch: vi.fn() });
  mock.business.mockReturnValue({ data: { status: 'open' }, isError: false, refetch: vi.fn() });
});
afterEach(cleanup);

it('이름·분류로 검색하고 산출 전 단가를 보존하며 기존 등록 화면으로 연결한다', () => {
  render(<IngredientManageScreen />);
  expect(screen.getByText('재료 설정')).toBeTruthy();
  expect(screen.getByRole('button', { name: '재료 설정 메뉴 열기' })).toBeTruthy();
  expect(screen.getByText('등록된 재료 2')).toBeTruthy();
  expect(screen.getByText('산출 전')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: '재료 이름으로 검색' }), { target: { value: '채 소' } });
  expect(screen.queryByText('계란')).toBeNull();
  expect(screen.getByText('대파')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '재료 등록' }));
  expect(mock.push).toHaveBeenCalledWith('/ingredients/add');
});

it.each(['open', 'break'])('%s에서는 기존 확인창을 승인해야 수정 화면을 연다', status => {
  mock.business.mockReturnValue({ data: { status }, isError: false, refetch: vi.fn() });
  render(<IngredientManageScreen />);
  fireEvent.click(screen.getByRole('button', { name: '대파 관리 메뉴 열기' }));
  fireEvent.click(screen.getByRole('button', { name: '수정' }));
  expect(mock.push).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '기본 정보 수정' }));
  expect(screen.getByText('현재 영업 중이므로, 수정 사항은 영업 종료 후 반영됩니다.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '수정' }));
  expect(mock.push).toHaveBeenCalledWith('/ingredients/edit/onion');
});

it('삭제 취소는 쓰지 않고 확인 시 선택한 재료만 한 번 비활성화한다', async () => {
  render(<IngredientManageScreen />);
  fireEvent.click(screen.getByRole('button', { name: '계란 관리 메뉴 열기' }));
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  fireEvent.click(await screen.findByRole('button', { name: '취소' }));
  expect(mock.mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '대파 관리 메뉴 열기' }));
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  await screen.findByText('삭제하시겠습니까?');
  const confirm = screen.getAllByRole('button', { name: '삭제' }).at(-1)!;
  fireEvent.click(confirm); fireEvent.click(confirm);
  expect(mock.mutate).toHaveBeenCalledTimes(1);
  expect(mock.mutate).toHaveBeenCalledWith('onion', expect.any(Object));
});

it('관리 팝업 닫기는 수정 이동이나 삭제를 실행하지 않는다', () => {
  render(<IngredientManageScreen />);
  fireEvent.click(screen.getByRole('button', { name: '대파 관리 메뉴 열기' }));
  expect(screen.getByRole('button', { name: '수정' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '삭제' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
  expect(mock.push).not.toHaveBeenCalled(); expect(mock.mutate).not.toHaveBeenCalled();
});

it('자세히 보기는 선택한 재료 상세로 이동한다', () => {
  render(<IngredientManageScreen />);
  fireEvent.click(screen.getByRole('button', { name: '계란 관리 메뉴 열기' }));
  fireEvent.click(screen.getByRole('button', { name: '자세히 보기' }));
  expect(mock.push).toHaveBeenCalledWith('/ingredients/egg');
});

it.each([
  ['재고 조정', '/ingredients/add-stock/onion?mode=deduct'],
  ['구매 링크 수정', '/ingredients/option?ingredient=onion'],
])('수정 하위 %s는 선택한 재료에 연결된다', (label, route) => {
  render(<IngredientManageScreen />);
  fireEvent.click(screen.getByRole('button', { name: '대파 관리 메뉴 열기' }));
  fireEvent.click(screen.getByRole('button', { name: '수정' }));
  expect(screen.queryByRole('button', { name: '메모 수정' })).toBeNull();
  expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: label }));
  expect(mock.push).toHaveBeenCalledWith(route);
});

it('카테고리 선택과 검색을 함께 적용한다', () => {
  render(<IngredientManageScreen />);
  fireEvent.click(screen.getByRole('tab', { name: '축산' }));
  expect(screen.queryByText('대파')).toBeNull();
  expect(screen.getByText('계란')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: '재료 이름으로 검색' }), { target: { value: '대파' } });
  expect(screen.queryByText('계란')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: '전체' }));
  expect(screen.getByText('대파')).toBeTruthy();
});
