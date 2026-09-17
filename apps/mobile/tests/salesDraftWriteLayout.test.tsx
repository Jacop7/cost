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
    expect(within(row).getByText('총 6 · 매장 2 · 배달 1 · 포장 3 · 폐기 1')).toBeTruthy();
    expect(within(row).queryByText('+ 판매')).toBeNull();

    const circleStyle = row.querySelector('svg')?.parentElement?.getAttribute('style') ?? '';
    expect(circleStyle).toContain('width: 32px');
    expect(circleStyle).toContain('height: 32px');
    expect(circleStyle).toContain('border-top-left-radius: 16px');
    expect(circleStyle).toContain('border-bottom-right-radius: 16px');
  });

  it('작성 상태와 메뉴 목록 사이에 기타 매출·지출 추가를 원형 추가 버튼이 있는 2행 카드로 둔다', async () => {
    render(<SalesDraftWriteScreen />);
    const etc = await waitFor(() => screen.getByRole('button', { name: '기타 매출 추가' }));
    const expense = screen.getByRole('button', { name: '지출 추가' });
    const menu = screen.getByRole('button', { name: '제육볶음 판매 수량 6개' });

    expect(within(etc).getByText('등록 0')).toBeTruthy();
    expect(within(expense).getByText('등록 0')).toBeTruthy();
    expect(etc.compareDocumentPosition(expense) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(expense.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    for (const row of [etc, expense]) {
      const circleStyle = row.querySelector('svg')?.parentElement?.getAttribute('style') ?? '';
      expect(circleStyle).toContain('width: 32px');
      expect(circleStyle).toContain('height: 32px');
      expect(circleStyle).toContain('border-top-left-radius: 16px');
    }
  });
});
