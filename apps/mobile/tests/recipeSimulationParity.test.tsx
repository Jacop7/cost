import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PriceSimSheet } from '@/features/recipes/components/PriceSimSheet';
import AvgSalesScreen from '@/features/recipes/screens/AvgSalesScreen';
import { emptyDraft, useRecipeDraft } from '@/features/recipes/draftStore';

const mock = vi.hoisted(() => ({
  date: vi.fn(), sales: vi.fn(), retryDate: vi.fn(), retrySales: vi.fn(),
  replace: vi.fn(), back: vi.fn(), close: vi.fn(), redirect: vi.fn(),
  params: { recipe: 'recipe-target' } as { recipe?: string },
  sliderX: 1,
}));

vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return {
    ...rn,
    // Native Modal visibility and responder coordinates are adapted for jsdom.
    // PriceSimSheet and the actual kit Slider calculation/render path stay real.
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
      visible ? <div data-testid="simulation-modal">{children}</div> : null,
    PanResponder: {
      create: (config: { onPanResponderGrant: (event: { nativeEvent: { locationX: number } }) => void }) => ({
        panHandlers: {
          testID: 'price-simulation-slider',
          onClick: () => config.onPanResponderGrant({ nativeEvent: { locationX: mock.sliderX } }),
        },
      }),
    },
  };
});
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => mock.params,
  Redirect: ({ href }: { href: string }) => {
    mock.redirect(href);
    return <div data-testid="legacy-route-redirect" data-href={href} />;
  },
  router: { canGoBack: () => false, replace: mock.replace, back: mock.back },
}));
vi.mock('@/features/business-day/businessDay', () => ({ useStoreLocalDate: mock.date }));
vi.mock('@/features/sales/hooks', () => ({ useSalesRange: mock.sales }));

const sim = () => within(screen.getByTestId('simulation-modal'));

// Domain reads, server date, router effects, native Modal and responder input are
// mocked. No RPC/save, device slider geometry, native gesture, font scaling or
// visual approval is certified by these RNW/jsdom assertions.
describe('RCP-05 판매가 시뮬레이션 실제 Sheet·kit 연결', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.sliderX = 1;
  });

  afterEach(cleanup);

  it('슬라이더 임시값으로만 손익을 다시 계산하고 닫은 뒤 재열면 현재 판매가로 reset한다', () => {
    const props = {
      onClose: mock.close, price: 10_000, material: 2_000, extra: 500,
      fixedRate: 0.2, target: 0.3, taxRatio: 0.1,
    };
    const view = render(<PriceSimSheet visible {...props} />);
    expect(sim().getByText('판매가 시뮬레이션')).toBeTruthy();
    expect(screen.getByTestId('simulation-modal').textContent).toContain('10,000원');
    expect(screen.getByTestId('simulation-modal').textContent).toContain('45.0%');
    expect(sim().queryByRole('button', { name: /저장|적용/ })).toBeNull();

    fireEvent.click(sim().getByTestId('price-simulation-slider'));
    const changed = screen.getByTestId('simulation-modal').textContent ?? '';
    expect(changed).toContain('16,700원');
    expect(changed).toContain('현재 10,000원에서 +6,700원');
    expect(changed).toContain('9,190원');
    expect(changed).toContain('55.0%');
    expect(changed).toContain('목표 30.0% 달성 권장가는 6,300원이에요');

    fireEvent.click(sim().getAllByRole('button', { name: '닫기' }).at(-1)!);
    expect(mock.close).toHaveBeenCalledOnce();
    view.rerender(<PriceSimSheet visible={false} {...props} />);
    expect(screen.queryByTestId('simulation-modal')).toBeNull();
    view.rerender(<PriceSimSheet visible {...props} />);
    const reopened = screen.getByTestId('simulation-modal').textContent ?? '';
    expect(reopened).toContain('임시 판매가10,000원');
    expect(reopened).toContain('현재 10,000원에서 +0원');
    expect(reopened).not.toContain('현재 10,000원에서 +6,700원');
  });
});

describe('PRT-131 제거된 평균 판매량 legacy route', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.params = { recipe: 'recipe-target' };
    mock.date.mockReturnValue({ date: '2030-03-01', isLoading: false, error: null, refetch: mock.retryDate });
    mock.sales.mockReturnValue({ data: { menu: [] }, isLoading: false, error: null, refetch: mock.retrySales });
    useRecipeDraft.getState().reset({ ...emptyDraft(), id: 'recipe-target', avgMonthlySales: '75' });
  });

  afterEach(() => {
    cleanup(); useRecipeDraft.getState().reset(emptyDraft());
  });

  it('옛 주소는 날짜·판매 조회나 draft 변경 없이 레시피 추가로 안전 redirect한다', () => {
    const before = structuredClone(useRecipeDraft.getState().draft);
    render(<AvgSalesScreen />);
    expect(screen.getByTestId('legacy-route-redirect').getAttribute('data-href')).toBe('/recipes/add');
    expect(mock.redirect).toHaveBeenCalledOnce();
    expect(mock.redirect).toHaveBeenCalledWith('/recipes/add');
    expect(mock.date).not.toHaveBeenCalled();
    expect(mock.sales).not.toHaveBeenCalled();
    expect(useRecipeDraft.getState().draft).toEqual(before);
  });
});
