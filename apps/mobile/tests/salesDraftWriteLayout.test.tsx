import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SalesDraftWriteScreen from '@/features/sales/screens/SalesDraftWriteScreen';

const draft = {
  id: 'draft-1', businessDate: '2026-09-17', kind: 'initial', status: 'editing', revision: 0,
  payloadHash: 'hash',
  items: [{ id: 'line-1', recipeId: 'recipe-1', menuName: '제육볶음', price: 12000,
    qtyHall: 2, qtyDelivery: 1, qtyTakeout: 3, qtyWaste: 1, deleted: false }],
  etcItems: [
    { id: 'etc-1', name: '음료', price: 2000, qty: 3, channel: 'hall', deleted: false },
    { id: 'etc-2', name: '삭제 항목', price: 9999, qty: 9, channel: 'hall', deleted: true },
  ],
  extraItems: [
    { id: 'expense-1', name: '얼음', amount: 15000, deleted: false },
    { id: 'expense-2', name: '삭제 지출', amount: 9999, deleted: true },
  ],
  summary: { revenue: 78000, expense: 30000, profit: 48000, expenseRate: 0.3846, profitRate: 0.6154 },
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

  it('메뉴 아래에 총 매출액·총 판매량을 표시하고 우측에 원형 추가 버튼을 둔다', async () => {
    render(<SalesDraftWriteScreen />);
    const row = await waitFor(() => screen.getByRole('button', { name: '제육볶음 판매 수량 6개' }));

    expect(within(row).getByText('제육볶음')).toBeTruthy();
    expect(within(row).getByText('72,000원 · 6개')).toBeTruthy();
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

    expect(within(etc).getByText('6,000원 · 3개')).toBeTruthy();
    expect(within(expense).getByText('추가 지출')).toBeTruthy();
    expect(within(expense).getByText('15,000원')).toBeTruthy();
    expect(etc.compareDocumentPosition(expense) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(expense.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    for (const row of [etc, expense]) {
      const circleStyle = row.querySelector('svg')?.parentElement?.getAttribute('style') ?? '';
      expect(circleStyle).toContain('width: 32px');
      expect(circleStyle).toContain('height: 32px');
      expect(circleStyle).toContain('border-top-left-radius: 16px');
    }
  });

  it('상세 헤더는 매출 작성만 표시하고 상태 카드에 날짜·작성 중·초기화를 둔다', async () => {
    render(<SalesDraftWriteScreen />);
    await waitFor(() => expect(screen.getByText('9월 17일 (목)')).toBeTruthy());
    expect(screen.getByText('매출 작성')).toBeTruthy();
    expect(screen.getByText('작성 중')).toBeTruthy();
    expect(screen.getByRole('button', { name: '초기화' })).toBeTruthy();
    expect(screen.queryByText('작성 상태')).toBeNull();
    expect(screen.queryByText('새 매출 작성')).toBeNull();
    expect(screen.queryByText('초안 삭제')).toBeNull();
    expect(screen.getByText('78,000원')).toBeTruthy();
    expect(screen.getByText('30,000원')).toBeTruthy();
    expect(screen.getByText('48,000원')).toBeTruthy();
    expect(screen.getByText('61.5%')).toBeTruthy();
  });

  it('판매 수량 팝업은 메뉴명 헤더와 같은 높이의 판매·폐기 행을 한 카드에 표시한다', async () => {
    render(<SalesDraftWriteScreen />);
    const menu = await waitFor(() => screen.getByRole('button', { name: '제육볶음 판매 수량 6개' }));
    fireEvent.click(menu);

    expect(screen.getAllByText('제육볶음').length).toBeGreaterThan(1);
    expect(screen.getByText('매장')).toBeTruthy();
    expect(screen.getByText('배달')).toBeTruthy();
    expect(screen.getByText('포장')).toBeTruthy();
    expect(screen.getByText('조리 후 폐기')).toBeTruthy();
    expect(screen.queryByText('재료는 나가고 매출은 0')).toBeNull();
  });

  it('기타 매출 팝업은 불필요한 설명을 숨긴다', async () => {
    render(<SalesDraftWriteScreen />);
    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: '기타 매출 추가' })));
    expect(screen.queryByText('메뉴에 등록하지 않은 매출')).toBeNull();
  });

  it('추가 지출 팝업 헤더 명칭을 목록과 통일한다', async () => {
    render(<SalesDraftWriteScreen />);
    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: '지출 추가' })));
    expect(screen.getAllByText('추가 지출').length).toBeGreaterThan(1);
  });
});
