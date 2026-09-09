import { createElement, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IngredientDetailScreen } from '@/features/ingredients/screens/IngredientDetailScreen';
import { StockHistoryScreen } from '@/features/ingredients/screens/StockHistoryScreen';
import type { IngredientDetail, LedgerEntry } from '@/features/ingredients/hooks';
import { COLOR } from '@/theme/tokens';

const mock = vi.hoisted(() => ({
  detail: vi.fn(), history: vi.fn(), mutate: vi.fn(),
  textStyles: new Map<string, Record<string, unknown>>(),
}));
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return {
    ...rn,
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <>{children}</> : null,
    // Preserve the real RNW Text render and inspect the style contract it receives.
    // jsdom's atomic CSS cascade is not evidence of real browser/native typography.
    Text: (props: React.ComponentProps<typeof rn.Text>) => {
      if (typeof props.children === 'string' && props.children.startsWith('잔량 '))
        mock.textStyles.set(props.children, rn.StyleSheet.flatten(props.style) as Record<string, unknown>);
      return createElement(rn.Text, props);
    },
  };
});
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'balance-ingredient' }),
  useRouter: () => ({ push: vi.fn() }),
  router: { canGoBack: () => false, replace: vi.fn(), back: vi.fn() },
}));
vi.mock('@/features/business-day/businessDay', () => ({
  useBusinessDay: () => ({ data: { timezone: 'Asia/Seoul' } }),
  useStoreLocalDate: () => ({ date: '2030-07-15', isLoading: false, error: null, refetch: vi.fn() }),
}));
vi.mock('@/features/ingredients/hooks', () => ({
  useIngredientDetail: mock.detail, useStockHistory: mock.history,
  useStockChange: () => ({ mutate: mock.mutate, isPending: false }),
  useSaveIngredient: () => ({ mutate: mock.mutate, isPending: false }),
  useDeactivateIngredient: () => ({ mutate: mock.mutate, isPending: false }),
}));

const ingredient: IngredientDetail = {
  id: 'balance-ingredient', name: '대파', categoryId: null, categoryName: null,
  baseUnit: 'g', perVolume: 1000, safetyStock: 100, vendorName: null, memo: null,
  stockTotal: 5000, basePrice: 4, soonOut: false, lastInboundAt: null,
  defaultVendorId: null, minOrderQty: 1, options: [], orders: [], priceTrends: [],
  lastChange: { occurredAt: '2030-07-15T01:00:00Z', eventId: null, displayState: null, hasHistory: false },
  purchase: { avg: null, low: null, high: null, count: 0 },
  loss: { purchased: 0, storageAmount: 0, cookingAmount: 0, storageCount: 0, cookingCount: 0,
    totalAmount: 0, totalCost: null, rate: null, storageRate: null, cookingRate: null },
};
const entry = (id: string, balance: number, countDelta: number): LedgerEntry => ({
  id, balance, countDelta, date: '2030-07-15', type: countDelta > 0 ? 'inbound' : 'consume',
  note: `잔량검수-${id}`, volumeDelta: countDelta, reverted: false, waste: false,
});
const result = <T,>(data: T) => ({ data, isLoading: false, isFetched: true, error: null, refetch: vi.fn() });

// Real IngredientDetailScreen/StockHistoryScreen -> real toLedgerView -> real
// LedgerRow. No host/ledger/formatter stub or AST substitute. Domain reads are
// fixtures and the shared setup blocks Supabase; this does not certify RPC math,
// actual rendered pixels/fonts, screen readers, touch, or native behavior.
describe('실제 식재료 이력 host의 서버 잔량 표시 역할', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.textStyles.clear();
    mock.detail.mockReturnValue(result(ingredient));
    mock.history.mockReturnValue(result([
      entry('negative', -750, 100), // Inbound can leave a still-negative balance.
      entry('positive', 750, -100), // Consumption does not imply negative balance.
      entry('zero', 0, -100),
    ]));
    mock.mutate.mockImplementation(() => { throw new Error('잔량 표시 시험은 쓰기를 호출하지 않습니다'); });
  });

  for (const [label, Host] of [['ING-03', IngredientDetailScreen], ['ING-07', StockHistoryScreen]] as const) {
    it(`${label}: −750g 원문은 보정하지 않고 음수 색·800 굵기를 공용 LedgerRow에 전달한다`, () => {
      render(<Host />);
      expect(screen.getByText('잔량 −750g')).toBeTruthy();
      expect(mock.textStyles.get('잔량 −750g')).toMatchObject({ color: COLOR.status.negative, fontWeight: '800', fontSize: 14 });
      expect(mock.detail).toHaveBeenCalledWith('balance-ingredient');
      expect(mock.history.mock.calls[0]?.[0]).toBe('balance-ingredient');
      expect(mock.mutate).not.toHaveBeenCalled();
    });

    it(`${label}: 양수와 0은 증감 부호가 아니라 서버 잔량에 따라 기존 중립 색·400 굵기를 유지한다`, () => {
      render(<Host />);
      for (const text of ['잔량 750g', '잔량 0g']) {
        expect(screen.getByText(text)).toBeTruthy();
        expect(mock.textStyles.get(text)).toMatchObject({ color: COLOR.text.tertiary, fontWeight: '400', fontSize: 14 });
      }
      expect(mock.mutate).not.toHaveBeenCalled();
    });
  }
});
