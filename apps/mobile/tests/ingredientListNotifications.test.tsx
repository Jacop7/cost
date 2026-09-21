import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { IngredientListScreen } from '@/features/ingredients/screens/IngredientListScreen';

const mock = vi.hoisted(() => ({
  list: vi.fn(), push: vi.fn(), replace: vi.fn(), action: vi.fn(), setParams: vi.fn(),
  params: {} as { stock?: string }, categories: [] as { id: string; name: string }[],
  tabListener: undefined as undefined | (() => void),
}));
vi.mock('expo-router', () => ({
  useNavigation: () => ({
    setParams: mock.setParams,
    getParent: () => ({ addListener: (_event: string, listener: () => void) => { mock.tabListener = listener; return vi.fn(); } }),
  }),
  useLocalSearchParams: () => mock.params,
  useRouter: () => ({ push: mock.push, replace: mock.replace }),
}));
vi.mock('@/features/ingredients/hooks', () => ({ useIngredientList: mock.list }));
vi.mock('@/features/master-data/hooks', () => ({
  useSettingsLists: () => ({ data: { categories: mock.categories } }),
}));
vi.mock('@/components/kit', async (original) => {
  const kit = await original<typeof import('@/components/kit')>();
  return {
    ...kit,
    // Observe dot input while retaining the real accessible button and navigation.
    HubHeaderAction: (props: ComponentProps<typeof kit.HubHeaderAction>) => {
      mock.action(props);
      return <kit.HubHeaderAction {...props} />;
    },
  };
});

describe('재료 메인 알림 설정 진입', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.params = {}; mock.categories = []; mock.tabListener = undefined;
  });

  it('아이콘 없는 + 추가 메뉴에서 일괄 입고와 재료 등록으로 나뉜다', () => {
    mock.list.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() });
    render(<IngredientListScreen />);
    fireEvent.click(screen.getByRole('button', { name: '+ 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '재료 일괄 입고' }));
    expect(mock.push).toHaveBeenLastCalledWith('/ingredients/bulk-inbound');
    fireEvent.click(screen.getByRole('button', { name: '+ 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '재료 등록' }));
    expect(mock.push).toHaveBeenLastCalledWith('/ingredients/add');
  });

  it('검색 공백·카테고리·구매처와 등록 카테고리·4가지 정렬을 같은 목록에 조합한다', () => {
    mock.categories = [{ id: 'veg', name: '채소' }, { id: 'dairy', name: '축산' }];
    const base = { baseUnit: 'g', perVolume: 1, safetyStock: 100, memo: null, soonOut: false,
      stockTracking: true, lastInboundAt: '2026-09-12' };
    mock.list.mockReturnValue({ data: [
      { ...base, id: 'green', name: '대파', categoryName: '채소', vendorName: '중앙 상회', stockTotal: 5, basePrice: 4 },
      { ...base, id: 'onion', name: '양파', categoryName: '채소', vendorName: '농산 직송', stockTotal: 200, basePrice: null },
      { ...base, id: 'egg', name: '계란', categoryName: '축산', vendorName: '중앙상회', stockTotal: 0, basePrice: 300 },
    ], isLoading: false, error: null, refetch: vi.fn() });
    render(<IngredientListScreen />);
    expect(screen.getByRole('tab', { name: '채소' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '축산' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    const search = screen.getByRole('textbox', { name: '재료·카테고리·구매처 검색' });
    fireEvent.change(search, { target: { value: '대 파' } });
    expect(screen.getByRole('button', { name: '대파 상세' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '양파 상세' })).toBeNull();
    fireEvent.change(search, { target: { value: '중앙상회' } });
    expect(screen.getByRole('button', { name: '대파 상세' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '계란 상세' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '검색 닫기' }));

    fireEvent.click(screen.getByRole('tab', { name: '채소' }));
    expect(screen.getByRole('button', { name: '대파 상세' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '양파 상세' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '계란 상세' })).toBeNull();

    for (const label of ['잔여 적은 순', '단가 높은 순', '이름순', '추천순']) {
      fireEvent.click(screen.getByRole('button', { name: /^정렬 기준:/ }));
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('button', { name: `정렬 기준: ${label}` })).toBeTruthy();
    }
    expect(mock.push).not.toHaveBeenCalled();
  });

  it('최소재고 필터는 명시적인 탭 재선택에서만 해제하고 쓰기를 만들지 않는다', () => {
    mock.params = { stock: 'below-safety' };
    const base = { categoryName: null, baseUnit: 'g', perVolume: 1, safetyStock: 100,
      vendorName: null, memo: null, basePrice: 4, soonOut: false, stockTracking: true, lastInboundAt: '2026-09-12' };
    mock.list.mockReturnValue({ data: [
      { ...base, id: 'low', name: '부족', stockTotal: 50 },
      { ...base, id: 'ok', name: '여유', stockTotal: 200 },
    ], isLoading: false, error: null, refetch: vi.fn() });
    render(<IngredientListScreen />);
    expect(screen.getByRole('button', { name: '부족 상세' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '여유 상세' })).toBeNull();
    expect(mock.tabListener).toBeTypeOf('function');
    mock.tabListener!();
    expect(mock.setParams).toHaveBeenCalledWith({ stock: undefined });
    expect(mock.push).not.toHaveBeenCalled();
  });

  it('목록 오류·0건·null 단가와 설정에서 갱신된 카테고리를 서로 다른 상태로 표시한다', () => {
    const refetch = vi.fn();
    mock.list.mockReturnValue({ data: undefined, isLoading: false, error: new Error('목록 통신 실패'), refetch });
    const host = render(<IngredientListScreen />);
    expect(screen.getByText('정보를 불러오지 못했어요')).toBeTruthy();
    expect(screen.queryByText('해당 카테고리의 재료가 없어요')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledOnce();

    mock.categories = [{ id: 'new-category', name: '새 카테고리' }];
    mock.list.mockReturnValue({ data: [], isLoading: false, error: null, refetch });
    host.rerender(<IngredientListScreen />);
    expect(screen.getByRole('tab', { name: '새 카테고리' })).toBeTruthy();
    expect(screen.getByText('해당 카테고리의 재료가 없어요')).toBeTruthy();

    mock.list.mockReturnValue({ data: [{ id: 'unknown-price', name: '단가 미산출', categoryName: '새 카테고리',
      baseUnit: 'g', perVolume: 1, safetyStock: 0, vendorName: null, memo: null, basePrice: null,
      soonOut: false, stockTracking: true, lastInboundAt: null, stockTotal: 0 }], isLoading: false, error: null, refetch });
    host.rerender(<IngredientListScreen />);
    expect(screen.getByRole('button', { name: '단가 미산출 재고 입력' }).textContent).toContain('산출 전');
    expect(screen.queryByText('0원/g')).toBeNull();
    expect(mock.push).not.toHaveBeenCalled();
  });

  it('미입력 0은 회색 표시·소진 합계 제외, 입고 후 0과 음수는 소진을 유지한다', () => {
    const base = { categoryName: null, baseUnit: 'g', perVolume: 1, safetyStock: 1000,
      vendorName: null, memo: null, basePrice: null, soonOut: false };
    mock.list.mockReturnValue({ data: [
      { ...base, id: 'new', name: '새 재료', stockTotal: 0, lastInboundAt: null },
      { ...base, id: 'used', name: '배추', stockTotal: 0, lastInboundAt: '2026-09-12' },
      { ...base, id: 'negative', name: '양파', stockTotal: -10, lastInboundAt: null },
    ], isLoading: false, error: null, refetch: vi.fn() });
    const { container } = render(<IngredientListScreen />);
    expect(screen.getAllByText('재고 미입력')).toHaveLength(1);
    expect(screen.getAllByText('소진')).toHaveLength(2);
    expect(screen.getByText('소진 재료 2개 - 배추, 양파')).toBeTruthy();
    expect(container.textContent).toContain('양파−10g');
    fireEvent.click(screen.getByRole('button', { name: '소진 재료 2개, 발주 페이지로 이동' }));
    expect(mock.push).toHaveBeenCalledWith('/orders');
    fireEvent.click(screen.getByRole('button', { name: '새 재료 재고 입력' }));
    expect(mock.push).toHaveBeenLastCalledWith('/ingredients/add-stock/new?initial=1');
    fireEvent.click(screen.getByRole('button', { name: '배추 상세' }));
    expect(mock.push).toHaveBeenLastCalledWith('/ingredients/used');
    fireEvent.click(screen.getByRole('button', { name: '양파 상세' }));
    expect(mock.push).toHaveBeenLastCalledWith('/ingredients/negative');
  });

  for (const state of ['empty', 'loading', 'error'] as const) {
    it(`${state}: 미확인 알림을 꾸미지 않고 실제 알림 설정으로 이동한다`, () => {
      mock.list.mockReturnValue({
        data: [], isLoading: state === 'loading',
        error: state === 'error' ? new Error('offline') : null, refetch: vi.fn(),
      });
      render(<IngredientListScreen />);
      const settings = screen.getByRole('button', { name: '알림 설정' });
      const bellProps = mock.action.mock.calls.map(([props]) => props).filter(props => props.icon === 'bell');
      expect(bellProps.length).toBeGreaterThan(0);
      expect(bellProps.every(props => !props.dot)).toBe(true);
      expect(screen.queryByRole('button', { name: /^알림$/ })).toBeNull();
      fireEvent.click(settings);
      expect(mock.push).toHaveBeenCalledTimes(1);
      expect(mock.push).toHaveBeenCalledWith('/my/notifications');
      fireEvent.click(screen.getByRole('button', { name: '재료 설정 메뉴 열기' }));
      fireEvent.click(screen.getByRole('button', { name: '카테고리 편집' }));
      expect(mock.push).toHaveBeenLastCalledWith('/recipes/manage-order?kind=ingredient&target=category');
      fireEvent.click(screen.getByRole('button', { name: '재료 설정 메뉴 열기' }));
      fireEvent.click(screen.getByRole('button', { name: '재료 목록 편집' }));
      expect(mock.push).toHaveBeenLastCalledWith('/recipes/manage-order?kind=ingredient&target=item');
    });
  }
});
