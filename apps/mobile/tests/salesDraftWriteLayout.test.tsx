import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SalesDraftWriteScreen from '@/features/sales/screens/SalesDraftWriteScreen';
import type { SalesDraft } from '@/features/sales/lifecycle';

const draft: SalesDraft = {
  id: 'draft-1', businessDate: '2026-09-17', kind: 'initial', status: 'editing', revision: 0,
  payloadHash: 'hash', expiresAt: '2026-09-18T00:00:00Z',
  channels: [
    { id: 'channel-hall', code: 'hall', name: '매장', sortOrder: 0 },
    { id: 'channel-delivery', code: 'delivery', name: '배달', sortOrder: 1 },
    { id: 'channel-takeout', code: 'takeout', name: '포장', sortOrder: 2 },
  ],
  items: [
    { id: 'line-1', recipeId: 'recipe-1', menuName: '제육볶음', price: 12000,
      qtyHall: 2, qtyDelivery: 1, qtyTakeout: 3, qtyWaste: 1, deleted: false,
      channels: [
        { id: 'channel-hall', code: 'hall', name: '매장', sortOrder: 0, quantity: 2 },
        { id: 'channel-delivery', code: 'delivery', name: '배달', sortOrder: 1, quantity: 1 },
        { id: 'channel-takeout', code: 'takeout', name: '포장', sortOrder: 2, quantity: 3 },
      ] },
    { id: 'line-2', recipeId: 'recipe-2', menuName: '김치찌개', price: 9000,
      qtyHall: 0, qtyDelivery: 0, qtyTakeout: 0, qtyWaste: 0, deleted: false,
      channels: [
        { id: 'channel-hall', code: 'hall', name: '매장', sortOrder: 0, quantity: 0 },
        { id: 'channel-delivery', code: 'delivery', name: '배달', sortOrder: 1, quantity: 0 },
        { id: 'channel-takeout', code: 'takeout', name: '포장', sortOrder: 2, quantity: 0 },
      ] },
    { id: 'line-3', recipeId: 'recipe-3', menuName: '분류 없는 메뉴', price: 5000,
      qtyHall: 0, qtyDelivery: 0, qtyTakeout: 0, qtyWaste: 0, deleted: false,
      channels: [
        { id: 'channel-hall', code: 'hall', name: '매장', sortOrder: 0, quantity: 0 },
        { id: 'channel-delivery', code: 'delivery', name: '배달', sortOrder: 1, quantity: 0 },
        { id: 'channel-takeout', code: 'takeout', name: '포장', sortOrder: 2, quantity: 0 },
      ] },
  ],
  etcItems: [
    { id: 'etc-1', name: '음료(캔)', price: 2000, qty: 7, salesChannelId: 'channel-hall', channel: 'hall', channelName: '매장', deleted: false },
    { id: 'etc-2', name: '소주·맥주', price: 5000, qty: 3, salesChannelId: 'channel-hall', channel: 'hall', channelName: '매장', deleted: false },
    { id: 'etc-3', name: '삭제 항목', price: 9999, qty: 9, salesChannelId: 'channel-hall', channel: 'hall', channelName: '매장', deleted: true },
  ],
  extraItems: [
    { id: 'expense-1', name: '얼음', amount: 15000, memo: '당일 추가 구매', deleted: false },
    { id: 'expense-2', name: '삭제 지출', amount: 9999, deleted: true },
  ],
  summary: {
    from: '2026-09-17', to: '2026-09-17', days: 1,
    revenue: 78000, etcRevenue: 29000, qty: 6,
    materialCost: 7000, extraMaterialCost: 1000, tax: 3000,
    wasteLoss: 1000, wasteIngredient: 0, wasteMenu: 1000,
    dailyExtra: 15000, fixedCost: 3000, fixedRate: 3000 / 78000,
    fixedRateProvisional: false,
    expense: 30000, profit: 48000, expenseRate: 0.3846, profitRate: 0.6154,
  },
};

const mock = vi.hoisted(() => ({
  push: vi.fn(), replace: vi.fn(), openDraft: vi.fn(), saveDraft: vi.fn(), discardDraft: vi.fn(),
  params: { date: '2026-09-17' } as { date?: string; start?: string },
  feedStatus: 'editing' as 'missing' | 'editing',
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: mock.push, replace: mock.replace, back: vi.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => mock.params,
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
vi.mock('@/features/business-day/businessDay', () => ({ useSalesBusinessDate: () => ({ date: '2026-09-17' }) }));
vi.mock('@/features/business-day/components/BusinessDateGate', () => ({
  BusinessDateGate: ({ children }: { children: (today: string) => React.ReactNode }) => children('2026-09-17'),
}));
vi.mock('@/features/recipes/hooks', () => ({
  useRecipeList: () => ({ data: [
    { id: 'recipe-1', categoryName: '볶음·구이', blockedBy: '돼지고기' },
    { id: 'recipe-2', categoryName: '찌개·전골' },
    { id: 'recipe-3', categoryName: null },
  ] }),
}));
vi.mock('@/features/master-data/hooks', () => ({
  useSettingsLists: () => ({ data: { recipeCategories: [
    { id: 'category-1', name: '찌개·전골' },
    { id: 'category-2', name: '볶음·구이' },
  ] } }),
}));
vi.mock('@/features/sales/lifecycle', async original => ({
  ...await original<Record<string, unknown>>(),
  createSalesRequestKey: () => 'request-1',
  useRecoverSalesFinalize: () => ({ mutate: (_date: string, options: { onSuccess: (value: { resolved: string }) => void }) => options.onSuccess({ resolved: 'not_recorded' }), isPending: false, error: null }),
  useOpenSalesDraft: () => ({ mutate: (date: string, options: { onSuccess: (value: typeof draft) => void }) => {
    mock.openDraft(date); options.onSuccess(draft);
  }, isPending: false, error: null }),
  useSalesDraft: () => ({ data: undefined, isLoading: false, error: null }),
  useSalesFeed: () => ({
    data: { items: [{ businessDate: '2026-09-17', status: mock.feedStatus,
      draftId: mock.feedStatus === 'editing' ? 'draft-1' : null, versionId: null,
      sales: 0, netSales: 0, qty: 0, expense: null, profit: null, profitRate: null,
      canEdit: true, canClassify: false, calendarRevision: 0, blockedReason: null,
      action: mock.feedStatus === 'editing' ? 'resume' : 'write' }] },
    isLoading: false, error: null, refetch: vi.fn(),
  }),
  useSetSalesCalendarDay: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useSaveSalesDraft: () => ({ mutateAsync: mock.saveDraft, isPending: false }),
  useFinalizeSalesDraft: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDiscardSalesDraft: () => ({ mutateAsync: mock.discardDraft, isPending: false }),
  useCloseSalesDraftAsHoliday: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('매출 작성 메뉴 행', () => {
  afterEach(() => {
    cleanup();
    mock.params = { date: '2026-09-17' };
    mock.feedStatus = 'editing';
    mock.openDraft.mockClear();
    mock.replace.mockClear();
    mock.saveDraft.mockReset();
    mock.saveDraft.mockImplementation(async (value: SalesDraft) => value);
    mock.discardDraft.mockReset();
    mock.discardDraft.mockResolvedValue({ status: 'discarded' });
    draft.summary = {
      from: '2026-09-17', to: '2026-09-17', days: 1,
      revenue: 78000, etcRevenue: 29000, qty: 6,
      materialCost: 7000, extraMaterialCost: 1000, tax: 3000,
      wasteLoss: 1000, wasteIngredient: 0, wasteMenu: 1000,
      dailyExtra: 15000, fixedCost: 3000, fixedRate: 3000 / 78000,
      fixedRateProvisional: false,
      expense: 30000, profit: 48000, expenseRate: 0.3846, profitRate: 0.6154,
    };
  });

  it('미작성 날짜는 명시적인 작성 확인 전까지 초안을 만들지 않는다', async () => {
    mock.feedStatus = 'missing';
    render(<SalesDraftWriteScreen />);

    await waitFor(() => expect(mock.replace).toHaveBeenCalledWith('/sales/day?date=2026-09-17'));
    expect(mock.openDraft).not.toHaveBeenCalled();
  });

  it('작성 확인을 거친 미작성 날짜만 초안을 연다', async () => {
    mock.feedStatus = 'missing';
    mock.params = { date: '2026-09-17', start: '1' };
    render(<SalesDraftWriteScreen />);

    await waitFor(() => expect(mock.openDraft).toHaveBeenCalledWith('2026-09-17'));
  });

  it('메뉴 아래에 총 매출액·총 판매량을 표시하고 우측에 원형 추가 버튼을 둔다', async () => {
    render(<SalesDraftWriteScreen />);
    const row = await waitFor(() => screen.getByRole('button', { name: '재료 부족 제육볶음 판매 수량 6개' }));

    expect(within(row).getByText('제육볶음')).toBeTruthy();
    const shortage = within(row).getByText('재료 부족');
    expect(shortage.compareDocumentPosition(within(row).getByText('제육볶음')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(row).getByText('72,000원 · 6개')).toBeTruthy();
    expect(within(row).queryByText('+ 판매')).toBeNull();

    const circleStyle = row.querySelector('svg')?.parentElement?.getAttribute('style') ?? '';
    expect(circleStyle).toContain('width: 32px');
    expect(circleStyle).toContain('height: 32px');
    expect(circleStyle).toContain('border-top-left-radius: 16px');
    expect(circleStyle).toContain('border-bottom-right-radius: 16px');
  });

  it('메뉴 목록 아래에 기타 매출·지출 추가를 원형 추가 버튼이 있는 2행 카드로 둔다', async () => {
    render(<SalesDraftWriteScreen />);
    const etc = await waitFor(() => screen.getByRole('button', { name: '기타 매출 추가' }));
    const expense = screen.getByRole('button', { name: '지출 추가' });
    const menu = screen.getByRole('button', { name: '재료 부족 제육볶음 판매 수량 6개' });

    const extraTitle = screen.getByText('기타 매출·지출');
    expect(extraTitle).toBeTruthy();
    expect(extraTitle.parentElement?.getAttribute('style')).toContain('background-color');
    expect(within(etc).getByText('29,000원 · 10개')).toBeTruthy();
    expect(within(expense).getByText('추가 지출')).toBeTruthy();
    expect(within(expense).getByText('15,000원')).toBeTruthy();
    expect(etc.compareDocumentPosition(expense) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(menu.compareDocumentPosition(etc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(extraTitle.compareDocumentPosition(etc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    for (const row of [etc, expense]) {
      const circleStyle = row.querySelector('svg')?.parentElement?.getAttribute('style') ?? '';
      expect(circleStyle).toContain('width: 32px');
      expect(circleStyle).toContain('height: 32px');
      expect(circleStyle).toContain('border-top-left-radius: 16px');
    }
  });

  it('작성 중 요약 카드 아래에서 메뉴 카테고리를 상태 필터와 같은 탭으로 전환한다', async () => {
    render(<SalesDraftWriteScreen />);
    const summary = await waitFor(() => screen.getByTestId('sales-draft-summary'));
    const all = screen.getByRole('tab', { name: '전체' });
    const stew = screen.getByRole('tab', { name: '찌개·전골' });
    const grilled = screen.getByRole('tab', { name: '볶음·구이' });
    const etc = screen.getByRole('button', { name: '기타 매출 추가' });

    expect(all.getAttribute('aria-selected')).toBe('true');
    expect(all.getAttribute('style')).toContain('border-top-left-radius: 999px');
    expect(all.getAttribute('style')).toContain('background-color: rgb(25, 31, 40)');
    expect(stew.getAttribute('style')).toContain('border-top-color: rgb(229, 232, 235)');
    expect(screen.getByText('찌개·전골').getAttribute('style')).toContain('color: rgb(25, 31, 40)');
    expect(screen.queryByRole('tab', { name: '미지정' })).toBeNull();
    expect(summary.compareDocumentPosition(all) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(all.compareDocumentPosition(etc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: '재료 부족 제육볶음 판매 수량 6개' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '김치찌개 판매 수량 0개' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '분류 없는 메뉴 판매 수량 0개' })).toBeTruthy();

    fireEvent.click(stew);
    expect(stew.getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('button', { name: '재료 부족 제육볶음 판매 수량 6개' })).toBeNull();
    expect(screen.getByRole('button', { name: '김치찌개 판매 수량 0개' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '분류 없는 메뉴 판매 수량 0개' })).toBeNull();

    fireEvent.click(grilled);
    expect(screen.getByRole('button', { name: '재료 부족 제육볶음 판매 수량 6개' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '김치찌개 판매 수량 0개' })).toBeNull();
  });

  it('상세 헤더 우측 세로 메뉴에 초기화를 두고 상태 카드에는 날짜와 매출·순이익 2열만 표시한다', async () => {
    render(<SalesDraftWriteScreen />);
    await waitFor(() => expect(screen.getByText('9월 17일 (목)')).toBeTruthy());
    const headerTitle = screen.getByText('매출 작성');
    const menu = screen.getByRole('button', { name: '매출 작성 메뉴 열기' });
    fireEvent.click(menu);
    const reset = screen.getByRole('button', { name: '초기화' });
    expect(headerTitle).toBeTruthy();
    expect(headerTitle.parentElement?.contains(menu)).toBe(true);
    expect(menu.querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('button', { name: '휴무 처리' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '닫기' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.getByText('작성 중')).toBeTruthy();
    const preview = screen.getByRole('button', { name: '매출 미리보기' });
    expect(within(preview).getByText('미리보기')).toBeTruthy();
    expect(preview.getAttribute('style')).toContain('min-height: 36px');
    expect(preview.getAttribute('style')).toContain('border-top-left-radius: 999px');
    expect(screen.queryByText('작성 상태')).toBeNull();
    expect(screen.queryByText('새 매출 작성')).toBeNull();
    expect(screen.queryByText('초안 삭제')).toBeNull();
    const summary = screen.getByTestId('sales-draft-summary');
    expect(within(summary).getByText('매출')).toBeTruthy();
    expect(within(summary).getByText('78,000원')).toBeTruthy();
    expect(within(summary).queryByText('지출')).toBeNull();
    expect(within(summary).getByText('순이익')).toBeTruthy();
    expect(within(summary).getByText('48,000원 · 61.5%')).toBeTruthy();
    expect(summary.getAttribute('style')).toContain('flex-direction: row');
    fireEvent.click(preview);
    expect(screen.getByText('손익 계산')).toBeTruthy();
    expect(screen.getByText('판매 수량')).toBeTruthy();
    expect(screen.getByText('6개')).toBeTruthy();
    expect(screen.getByText('총 지출')).toBeTruthy();
    expect(screen.getByText('(−) 재료')).toBeTruthy();
    expect(screen.getByText('(−) 폐기 손실')).toBeTruthy();
    expect(screen.getByText('(−) 고정 지출')).toBeTruthy();
    expect(screen.getByText('(−) 추가 지출')).toBeTruthy();
    expect(screen.getByText('(−) 세금')).toBeTruthy();
  });

  it('작성 중 초기화 뒤 새 초안을 자동 생성하지 않고 사용자가 작성하기를 선택할 때만 다시 연다', async () => {
    render(<SalesDraftWriteScreen />);
    await waitFor(() => expect(mock.openDraft).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: '매출 작성 메뉴 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    expect(screen.getByText('초기화를 진행하시겠습니까?')).toBeTruthy();
    expect(screen.getByText('작성 중인 모든 매출 데이터가 초기화됩니다.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));

    expect(await screen.findByText('초기화가 완료되었습니다.')).toBeTruthy();
    expect(screen.getByText('계속해서 매출을 작성하시겠습니까?')).toBeTruthy();
    expect(mock.openDraft).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '작성하기' }));
    expect(mock.openDraft).toHaveBeenCalledTimes(2);
  });

  it('작성 중 초기화 뒤 나중에를 선택하면 매출관리 목록으로 이동한다', async () => {
    render(<SalesDraftWriteScreen />);
    await waitFor(() => expect(mock.openDraft).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: '매출 작성 메뉴 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    expect(await screen.findByText('초기화가 완료되었습니다.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '나중에' }));

    expect(mock.replace).toHaveBeenCalledWith('/sales');
    expect(mock.openDraft).toHaveBeenCalledTimes(1);
  });

  it('고정 지출 기준이 비면 작성 카드와 미리보기 손익을 미산출로 유지한다', async () => {
    draft.summary = { ...draft.summary, fixedCost: null, fixedRate: null,
      fixedRateProvisional: true, expense: null, profit: null, expenseRate: null, profitRate: null };
    render(<SalesDraftWriteScreen />);
    const summary = await waitFor(() => screen.getByTestId('sales-draft-summary'));
    expect(within(summary).getByText('미산출')).toBeTruthy();
    expect(within(summary).queryByText(/0원 · 0/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '매출 미리보기' }));
    expect(screen.getAllByText('미산출').length).toBeGreaterThanOrEqual(2);
  });

  it('수정 후 미리보기는 서버에 임시저장한 최신 손익을 표시한다', async () => {
    mock.saveDraft.mockImplementation(async (value: SalesDraft) => ({
      ...value,
      revision: value.revision + 1,
      summary: { ...value.summary, revenue: 90000, profit: 54000, profitRate: 0.6 },
    }));
    render(<SalesDraftWriteScreen />);
    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: '김치찌개 판매 수량 0개' })));
    fireEvent.click(screen.getByRole('button', { name: '매장 판매량 늘리기' }));
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    fireEvent.click(screen.getByRole('button', { name: '매출 미리보기' }));

    await waitFor(() => expect(mock.saveDraft).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('손익 계산')).toBeTruthy();
    expect(screen.getAllByText('90,000원').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('54,000원')).toBeTruthy();
  });

  it('판매 수량 팝업은 메뉴명 헤더와 같은 높이의 판매·폐기 행을 한 카드에 표시한다', async () => {
    render(<SalesDraftWriteScreen />);
    const menu = await waitFor(() => screen.getByRole('button', { name: '재료 부족 제육볶음 판매 수량 6개' }));
    fireEvent.click(menu);

    expect(screen.getAllByText('제육볶음').length).toBeGreaterThan(1);
    expect(screen.getByText('12,000원')).toBeTruthy();
    expect(screen.getByText('매장')).toBeTruthy();
    expect(screen.getByText('배달')).toBeTruthy();
    expect(screen.getByText('포장')).toBeTruthy();
    expect(screen.getByText('조리 후 폐기')).toBeTruthy();
    expect(screen.queryByText('합계')).toBeNull();
    expect(screen.getByText('총 72,000원')).toBeTruthy();
    expect(screen.getByText('판매 6 · 폐기 1')).toBeTruthy();
    expect(screen.queryByText('재료는 나가고 매출은 0')).toBeNull();
  });

  it('기타 매출 팝업은 작성·매출내역을 나누고 채널별 내역 수량을 스테퍼로 수정한다', async () => {
    render(<SalesDraftWriteScreen />);
    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: '기타 매출 추가' })));
    expect(screen.queryByText('메뉴에 등록하지 않은 매출')).toBeNull();
    expect(screen.getByRole('tab', { name: '작성하기' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: '매출내역' })).toBeTruthy();
    expect(screen.getByText('판매 채널')).toBeTruthy();
    expect(screen.getByRole('button', { name: '매장 기타 매출 수량 줄이기' })).toBeTruthy();
    const hallIncrease = screen.getByRole('button', { name: '매장 기타 매출 수량 늘리기' });
    expect(hallIncrease).toBeTruthy();
    expect(screen.getByRole('button', { name: '배달 기타 매출 수량 늘리기' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '포장 기타 매출 수량 늘리기' })).toBeTruthy();
    fireEvent.click(hallIncrease);
    expect(screen.getByText('1')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: '매출내역' }));
    expect(screen.queryByText('판매 채널')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('음료(캔)')).toBeTruthy();
    expect(screen.getByText('소주·맥주')).toBeTruthy();
    expect(screen.getByText('14,000원')).toBeTruthy();
    expect(screen.getAllByText('15,000원').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: '음료(캔) 매장 기타 매출 수량 줄이기' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '음료(캔) 매장 기타 매출 수량 늘리기' })).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('총 29,000원')).toBeTruthy();
    expect(screen.getByText('판매 10')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '음료(캔) 매장 기타 매출 수량 늘리기' }));
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('16,000원')).toBeTruthy();
    expect(screen.getByText('총 31,000원')).toBeTruthy();
    expect(screen.getByText('판매 11')).toBeTruthy();

    for (let value = 8; value > 1; value -= 1) {
      fireEvent.click(screen.getByRole('button', { name: '음료(캔) 매장 기타 매출 수량 줄이기' }));
    }
    expect(screen.getByRole('button', { name: '음료(캔) 매장 기타 매출 수량 삭제' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '음료(캔) 매장 기타 매출 수량 삭제' }));
    expect(screen.getByText('선택한 메뉴를 삭제하시겠습니까?')).toBeTruthy();
    expect(screen.getByText('음료(캔)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(screen.queryByText('음료(캔)')).toBeNull();
    expect(screen.getByText('총 15,000원')).toBeTruthy();
    expect(screen.getByText('판매 3')).toBeTruthy();
  });

  it('추가 지출 팝업 헤더 명칭을 목록과 통일하고 작성·지출내역 탭을 제공한다', async () => {
    render(<SalesDraftWriteScreen />);
    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: '지출 추가' })));
    expect(screen.getAllByText('추가 지출').length).toBeGreaterThan(1);
    expect(screen.getByRole('tab', { name: '작성하기' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '지출내역' }));
    expect(screen.getByText('얼음')).toBeTruthy();
    expect(screen.getByText('당일 추가 구매')).toBeTruthy();
    expect(screen.getAllByText(/15,000원/).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('textbox', { name: '얼음 지출 금액' })).toBeNull();
    expect(screen.getByText('총 15,000원')).toBeTruthy();
    expect(screen.getByText('지출 1')).toBeTruthy();
    expect(screen.getByRole('button', { name: '얼음 삭제' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '얼음 삭제' }));
    expect(screen.getByText('선택한 메뉴를 삭제하시겠습니까?')).toBeTruthy();
    expect(screen.getByText('얼음')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(screen.queryByText('얼음')).toBeNull();
    expect(screen.getByText('총 0원')).toBeTruthy();
    expect(screen.getByText('지출 0')).toBeTruthy();
  });
});
