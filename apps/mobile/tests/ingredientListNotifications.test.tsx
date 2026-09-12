import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { IngredientListScreen } from '@/features/ingredients/screens/IngredientListScreen';

const mock = vi.hoisted(() => ({ list: vi.fn(), push: vi.fn(), action: vi.fn() }));
vi.mock('expo-router', () => ({ useNavigation: () => ({ getParent: () => undefined }), useLocalSearchParams: () => ({}), useRouter: () => ({ push: mock.push }) }));
vi.mock('@/features/ingredients/hooks', () => ({ useIngredientList: mock.list }));
vi.mock('@/features/master-data/hooks', () => ({
  useSettingsLists: () => ({ data: { categories: [] } }),
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

describe('식재료 메인 알림 설정 진입', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('미입력 0은 회색 표시·소진 합계 제외, 입고 후 0과 음수는 소진을 유지한다', () => {
    const base = { categoryName: null, baseUnit: 'g', perVolume: 1, safetyStock: 1000,
      vendorName: null, memo: null, basePrice: null, soonOut: false };
    mock.list.mockReturnValue({ data: [
      { ...base, id: 'new', name: '새 식재료', stockTotal: 0, lastInboundAt: null },
      { ...base, id: 'used', name: '배추', stockTotal: 0, lastInboundAt: '2026-09-12' },
      { ...base, id: 'negative', name: '양파', stockTotal: -10, lastInboundAt: null },
    ], isLoading: false, error: null, refetch: vi.fn() });
    render(<IngredientListScreen />);
    expect(screen.getAllByText('재고 미입력')).toHaveLength(1);
    expect(screen.getAllByText('소진')).toHaveLength(2);
    expect(screen.getByText('소진 식재료 2개 - 배추, 양파')).toBeTruthy();
    expect(screen.getByText('총 −10g')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '소진 식재료 2개, 발주 페이지로 이동' }));
    expect(mock.push).toHaveBeenCalledWith('/orders');
    fireEvent.click(screen.getByRole('button', { name: '새 식재료 재고 입력' }));
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
    });
  }
});
