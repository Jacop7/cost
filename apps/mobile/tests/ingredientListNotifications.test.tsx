import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { IngredientListScreen } from '@/features/ingredients/screens/IngredientListScreen';

const mock = vi.hoisted(() => ({ list: vi.fn(), push: vi.fn(), action: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mock.push }) }));
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
