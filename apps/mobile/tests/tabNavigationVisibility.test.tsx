import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import TabsLayout from '../app/(tabs)/_layout';
vi.mock('@/features/business-day/businessDay', () => ({ useBusinessDay: () => ({ data: undefined }) }));
import { isTabRootPath } from '@/lib/tabNavigation';

const state = vi.hoisted(() => ({ pathname: '/ingredients', platform: 'web', style: {} as Record<string, unknown> }));
vi.mock('expo-router', () => {
  const Tabs = ({ screenOptions }: { children?: ReactNode; screenOptions: { tabBarStyle: Record<string, unknown> } }) => {
    state.style = screenOptions.tabBarStyle;
    return <div data-testid="tabs" />;
  };
  Tabs.Screen = () => null;
  return { Tabs, usePathname: () => state.pathname };
});
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }) }));
vi.mock('react-native', async original => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Platform: { ...rn.Platform, get OS() { return state.platform; } } };
});
beforeEach(() => { state.pathname = '/ingredients'; state.platform = 'web'; });

it.each(['ingredients', 'recipes', 'orders', 'sales', 'my'])('%s 메인은 표시하고 하위 화면에서는 숨긴다', tab => {
  expect(isTabRootPath(`/${tab}`)).toBe(true);
  expect(isTabRootPath(`/${tab}/`)).toBe(true);
  expect(isTabRootPath(`/${tab}/detail`)).toBe(false);
});
it.each(['/ingredients/ingredient-id', '/ingredients/edit/ingredient-id', '/ingredients/add-stock/ingredient-id',
  '/recipes/recipe-id', '/recipes/add', '/recipes/tax', '/orders/complete', '/sales/day-detail', '/sales/menu', '/my/tax'])('%s 직접 진입에서도 탭과 탭 높이를 없앤다', pathname => {
  state.pathname = pathname; render(<TabsLayout />);
  expect(state.style).toMatchObject({ display: 'none', height: 0, paddingTop: 0, paddingBottom: 0, borderTopWidth: 0 });
});
it('메인→상세→메인 전환 시 기존 탭 높이를 복원하고 웹은 추가 하단 여백이 없다', () => {
  const view = render(<TabsLayout />); const rootHeight = state.style.height;
  expect(state.style.display).toBe('flex'); expect(rootHeight).toBeGreaterThan(0);
  state.pathname = '/ingredients/id'; view.rerender(<TabsLayout />);
  expect(state.style.display).toBe('none');
  expect(screen.getByTestId('tabs').parentElement!.style.paddingBottom).toBe('0px');
  state.pathname = '/recipes'; view.rerender(<TabsLayout />);
  expect(state.style).toMatchObject({ display: 'flex', height: rootHeight });
});
it('네이티브 상세에서는 탭 대신 홈 인디케이터 안전 여백만 확보한다', () => {
  state.platform = 'ios'; state.pathname = '/recipes/id';
  const view = render(<TabsLayout />);
  expect(state.style.height).toBe(0);
  expect(screen.getByTestId('tabs').parentElement!.style.paddingBottom).toBe('34px');
  state.pathname = '/recipes'; view.rerender(<TabsLayout />);
  expect(state.style.paddingBottom).toBe(34);
  expect(screen.getByTestId('tabs').parentElement!.style.paddingBottom).toBe('0px');
});
