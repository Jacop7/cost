import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SalesDraftWriteScreen from '@/features/sales/screens/SalesDraftWriteScreen';

const draft = {
  id: 'draft-1', businessDate: '2026-09-17', kind: 'initial', status: 'editing', revision: 0,
  payloadHash: 'hash',
  items: [{ id: 'line-1', recipeId: 'recipe-1', menuName: '제육볶음', price: 12000,
    qtyHall: 2, qtyDelivery: 1, qtyTakeout: 3, qtyWaste: 1, deleted: false }],
  etcItems: [], extraItems: [],
};

const mock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: mock.push, replace: mock.replace, back: vi.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ date: '2026-09-17' }),
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
vi.mock('@/features/business-day/businessDay', () => ({ useSalesBusinessDate: () => ({ date: '2026-09-17' }) }));
vi.mock('@/features/business-day/components/BusinessDateGate', () => ({
  BusinessDateGate: ({ children }: { children: (today: string) => React.ReactNode }) => children('2026-09-17'),
}));
vi.mock('@/features/sales/lifecycle', async original => ({
  ...await original<Record<string, unknown>>(),
  createSalesRequestKey: () => 'request-1',
  useRecoverSalesFinalize: () => ({ mutate: (_date: string, options: { onSuccess: (value: { resolved: string }) => void }) => options.onSuccess({ resolved: 'not_recorded' }), isPending: false, error: null }),
  useOpenSalesDraft: () => ({ mutate: (_date: string, options: { onSuccess: (value: typeof draft) => void }) => options.onSuccess(draft), isPending: false, error: null }),
  useSalesDraft: () => ({ data: undefined, isLoading: false, error: null }),
  useSaveSalesDraft: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useFinalizeSalesDraft: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDiscardSalesDraft: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('매출 작성 메뉴 행', () => {
  afterEach(cleanup);

  it('메뉴 아래에 총·채널·폐기 수량을 표시하고 우측에 원형 추가 버튼을 둔다', async () => {
    render(<SalesDraftWriteScreen />);
    const row = await waitFor(() => screen.getByRole('button', { name: '제육볶음 판매 수량 6개' }));

    expect(within(row).getByText('제육볶음')).toBeTruthy();
    expect(within(row).getByText('총 6개 · 매장 2개 · 배달 1개 · 포장 3개 · 폐기 1개')).toBeTruthy();
    expect(within(row).queryByText('+ 판매')).toBeNull();

    const circleStyle = row.querySelector('svg')?.parentElement?.getAttribute('style') ?? '';
    expect(circleStyle).toContain('width: 32px');
    expect(circleStyle).toContain('height: 32px');
    expect(circleStyle).toContain('border-top-left-radius: 16px');
    expect(circleStyle).toContain('border-bottom-right-radius: 16px');
  });
});
