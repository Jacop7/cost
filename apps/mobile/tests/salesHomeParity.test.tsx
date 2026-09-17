import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SalesHomeScreen from '@/features/sales/screens/SalesHomeScreen';
import { COMPONENT } from '@/theme/tokens';
import { RpcError } from '@/lib/supabase';

const mock = vi.hoisted(() => ({
  recipes: vi.fn(), day: vi.fn(), basis: vi.fn(), push: vi.fn(), save: vi.fn(), check: vi.fn(),
  storeId: 'store-a', today: '2030-07-14',
  dimensions: { width: 390, height: 844, scale: 1, fontScale: 1 },
}));
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => mock.storeId }));
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, useWindowDimensions: () => mock.dimensions,
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div data-testid="sales-modal">{children}</div> : null };
});
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock('@/features/recipes/hooks', () => ({ useRecipeList: mock.recipes }));
vi.mock('@/features/sales/hooks', async (original) => ({
  ...await original<Record<string, unknown>>(), useSalesDay: mock.day,
  useSaveSale: () => ({ mutate: mock.save, isPending: false }),
  useRecipeShortages: () => ({ data: { ingredientCount: 0 }, isLoading: false }),
  useCheckSaleShortages: () => mock.check,
}));
vi.mock('@/features/business-day/businessDay', async (original) => ({
  ...await original<Record<string, unknown>>(),
  useSalesBusinessDate: () => ({ date: mock.today, isLoading: false, error: null, refetch: vi.fn() }),
  useBusinessDay: () => ({ data: { status: 'open', timezone: 'Asia/Seoul' } }),
  useDayMenuBasis: mock.basis,
}));
// This batch covers the menu list and actual kit/SortSheet/SaleStepper. Business
// transitions have their own tests and are not simulated as device evidence here.
vi.mock('@/features/sales/components/BusinessDayBar', () => ({ BusinessDayBar: () => null }));
const query = <T,>(data: T) => ({ data, isLoading: false, error: null, refetch: vi.fn() });
const longName = '국내산 두부와 바지락을 넣은 순두부찌개 정식';
const rows = [
  { id: 'one', name: longName, active: true, blockedBy: '두부', price: 14000, materialCost: 4000, profit: 9000 },
  { id: 'two', name: '계란말이', active: true, blockedBy: null, price: 7000, materialCost: 1000, profit: 1000 },
  { id: 'stopped', name: '김치찌개', active: false, blockedBy: null, price: 9000, materialCost: 2000, profit: 2000 },
];
const modal = () => within(screen.getByTestId('sales-modal'));
describe('SALES-01 메뉴 목록 실제 host·공용 선택', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.dimensions = { width: 390, height: 844, scale: 1, fontScale: 1 };
    mock.storeId = 'store-a'; mock.today = '2030-07-14';
    mock.recipes.mockReturnValue(query(rows));
    mock.day.mockReturnValue(query({ revision: 7, etcRevenue: 0, dailyExtra: 0, etcItems: [], extraItems: [],
      items: [{ recipeId: 'one', qtyHall: 2, qtyDelivery: 1, qtyTakeout: 1, qtyWaste: 2 }],
      summary: { revenue: 48000, profit: 20000 },
    }));
    mock.basis.mockReturnValue(query(new Map([
      ['one', { price: 12000, materialCost: 3000, profit: 500, changed: true, currentPrice: 14000, currentMaterialCost: 4000 }],
      ['two', { price: 7000, materialCost: 1000, profit: 3000, changed: false }],
    ])));
    mock.check.mockResolvedValue([]);
  });
  afterEach(cleanup);

  const stoppedDay = () => ({ ...mock.day().data, items: [
    ...mock.day().data.items, { recipeId: 'stopped', qtyHall: 5, qtyDelivery: 0, qtyTakeout: 0, qtyWaste: 0 },
  ] });
  const fillAddition = (kind: 'etc' | 'expense') => {
    fireEvent.click(screen.getByRole('button', { name: kind === 'etc' ? '기타 매출' : '지출 추가' }));
    fireEvent.change(modal().getByPlaceholderText(kind === 'etc' ? '예: 음료' : '예: 얼음·소모품'), { target: { value: '시험 항목' } });
    fireEvent.change(modal().getByPlaceholderText(kind === 'etc' ? '2000' : '15000'), { target: { value: '2000' } });
  };
  it('이미 판 중지 메뉴를 재전송하지 않아 정상 메뉴 판매가 그 메뉴 때문에 막히지 않는다', async () => {
    mock.day.mockReturnValue(query(stoppedDay()));
    render(<SalesHomeScreen />);
    fireEvent.click(screen.getByRole('button', { name: '계란말이 판매 입력' }));
    fireEvent.click(modal().getByRole('button', { name: '매장 판매량 늘리기' }));
    await act(async () => fireEvent.click(modal().getByRole('button', { name: '저장' })));
    expect(mock.save.mock.calls[0]![0].items).toEqual([{ recipeId: 'two', qtyHall: 1, qtyDelivery: 0, qtyTakeout: 0, qtyWaste: 0 }]);
  });
  it.each(['etc', 'expense'] as const)('%s만 추가할 때 이미 판 중지 메뉴의 수량을 다시 저장하지 않는다', kind => {
    mock.day.mockReturnValue(query(stoppedDay()));
    render(<SalesHomeScreen />); fillAddition(kind);
    fireEvent.click(modal().getByRole('button', { name: '추가' }));
    expect(mock.save.mock.calls[0]![0].items).toEqual([]);
  });
  it.each(['etc', 'expense'] as const)('%s 추가 응답 유실 후 최신 조회와 재시도가 같은 금액을 두 번 더하지 않는다', kind => {
    const original = mock.day().data;
    const view = render(<SalesHomeScreen />); fillAddition(kind);
    fireEvent.click(modal().getByRole('button', { name: '추가' }));
    const request = mock.save.mock.calls[0]![0];
    act(() => mock.save.mock.calls[0]![1].onError(new Error('응답 연결이 끊겼어요')));
    const key = kind === 'etc' ? 'etcItems' : 'extraItems';
    mock.day.mockReturnValue(query({ ...original, [key]: request[key], revision: original.revision + 1 }));
    view.rerender(<SalesHomeScreen />);
    const retry = screen.queryByRole('button', { name: '추가' });
    if (retry) fireEvent.click(retry);
    // A resolved operation may close the form or repeat the original target, but
    // must not construct a new target by appending its own committed row again.
    expect(mock.save.mock.calls.at(-1)![0][key]).toEqual(request[key]);
  });
  it('수량 편집 중 장부가 재조회돼도 오래된 초안에 새 판본을 붙이지 않는다', async () => {
    const original = mock.day().data;
    const view = render(<SalesHomeScreen />);
    fireEvent.click(screen.getByRole('button', { name: `${longName} 판매 입력` }));
    fireEvent.click(modal().getByRole('button', { name: '매장 판매량 늘리기' }));
    mock.day.mockReturnValue(query({ ...original, revision: 8, items: [{ ...original.items[0], qtyHall: 7 }] }));
    view.rerender(<SalesHomeScreen />);
    const save = screen.queryByRole('button', { name: '저장' });
    if (save) await act(async () => fireEvent.click(save));
    expect(mock.save.mock.calls.every(([input]) => input.baseRevision === 7)).toBe(true);
  });
  it.each(['etc', 'expense'] as const)('%s 추가를 빠르게 두 번 눌러도 한 요청만 전송한다', kind => {
    render(<SalesHomeScreen />); fillAddition(kind);
    const add = modal().getByRole('button', { name: '추가' });
    fireEvent.click(add); fireEvent.click(add);
    expect(mock.save).toHaveBeenCalledTimes(1);
  });
  it('부족 조회 중 수량 시트를 닫으면 늦은 응답으로 판매를 저장하지 않는다', async () => {
    let finish!: (value: unknown) => void;
    mock.check.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<SalesHomeScreen />);
    fireEvent.click(screen.getByRole('button', { name: '계란말이 판매 입력' }));
    fireEvent.click(modal().getByRole('button', { name: '매장 판매량 늘리기' }));
    fireEvent.click(modal().getByRole('button', { name: '저장' }));
    fireEvent.click(modal().getByRole('button', { name: '닫기' }));
    await act(async () => finish({ hasBasis: true, ingredientCount: 0, recipes: [] }));
    expect(mock.save).not.toHaveBeenCalled();
    expect(screen.queryByTestId('sales-modal')).toBeNull();
  });
  it.each(['store', 'date'] as const)('%s 변경 전 시작한 부족 조회는 새 범위에서 저장을 시작하지 않는다', async scope => {
    let finish!: (value: unknown) => void;
    mock.check.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const view = render(<SalesHomeScreen />);
    fireEvent.click(screen.getByRole('button', { name: '계란말이 판매 입력' }));
    fireEvent.click(modal().getByRole('button', { name: '매장 판매량 늘리기' }));
    fireEvent.click(modal().getByRole('button', { name: '저장' }));
    if (scope === 'store') mock.storeId = 'store-b'; else mock.today = '2030-07-15';
    view.rerender(<SalesHomeScreen />);
    await act(async () => finish({ hasBasis: true, ingredientCount: 0, recipes: [] }));
    expect(mock.save).not.toHaveBeenCalled();
    expect(screen.queryByTestId('sales-modal')).toBeNull();
  });
  it.each(['success', 'error'] as const)('취소·재열기 후 늦은 %s가 새 초안을 닫거나 영업 시작 확인을 띄우지 않는다', result => {
    render(<SalesHomeScreen />); fillAddition('expense');
    fireEvent.click(modal().getByRole('button', { name: '추가' }));
    const callbacks = mock.save.mock.calls[0]![1];
    fireEvent.click(modal().getByRole('button', { name: '취소' }));
    fireEvent.click(screen.getByRole('button', { name: '지출 추가' }));
    expect((modal().getByPlaceholderText('예: 얼음·소모품') as HTMLInputElement).value).toBe('');
    fireEvent.change(modal().getByPlaceholderText('예: 얼음·소모품'), { target: { value: '새 초안' } });
    act(() => result === 'success' ? callbacks.onSuccess({ shortages: [], dayOpened: false })
      : callbacks.onError(new RpcError('영업 전', '45001', null)));
    expect((modal().getByPlaceholderText('예: 얼음·소모품') as HTMLInputElement).value).toBe('새 초안');
    expect(screen.queryByText('오늘 영업을 시작할까요?')).toBeNull();
    expect(mock.save).toHaveBeenCalledTimes(1);
  });
  it('성공한 추가를 닫고 최신 내역에서 새로 입력하면 같은 이름도 의도적으로 두 번 추가할 수 있다', () => {
    const original = mock.day().data;
    const view = render(<SalesHomeScreen />); fillAddition('expense');
    fireEvent.click(modal().getByRole('button', { name: '추가' }));
    const request = mock.save.mock.calls[0]![0];
    mock.day.mockReturnValue(query({ ...original, revision: 8, extraItems: request.extraItems }));
    view.rerender(<SalesHomeScreen />);
    act(() => mock.save.mock.calls[0]![1].onSuccess({ shortages: [], dayOpened: false }));
    fillAddition('expense');
    fireEvent.click(modal().getByRole('button', { name: '추가' }));
    expect(mock.save).toHaveBeenCalledTimes(2);
    expect(mock.save.mock.calls[1]![0]).toMatchObject({ baseRevision: 8, extraItems: [request.extraItems[0], request.extraItems[0]] });
  });

  it('정렬 칩의 직접 부모가 위아래 hitSlop을 잘라내지 않는다', () => {
    render(<SalesHomeScreen />);
    const chip = screen.getByRole('button', { name: '정렬 기준: 판매량순' });
    const boundary = screen.getByTestId('sales-sort-touch-boundary');
    expect(chip.parentElement).toBe(boundary);
    const style = getComputedStyle(boundary);
    expect(parseFloat(style.paddingTop)).toBe(COMPONENT.filterChip.hitSlop);
    expect(parseFloat(style.paddingBottom)).toBe(COMPONENT.filterChip.hitSlop);
  });

  it.each([[390, 1, 'row'], [320, 1, 'column'], [390, 2, 'column']] as const)(
    'width=%s/fontScale=%s에서 %s이면서 긴 이름·판매량·장부 금액 보존', (width, fontScale, direction) => {
      mock.dimensions = { ...mock.dimensions, width, fontScale };
      render(<SalesHomeScreen />);
      const row = screen.getByTestId('SALES-01/menu-one');
      expect(getComputedStyle(row).flexDirection).toBe(direction);
      expect(within(row).getByText(longName)).toBeTruthy();
      expect(getComputedStyle(within(row).getByText(longName)).whiteSpace).not.toBe('nowrap');
      expect(within(row).getByText('4개 · 폐기 2')).toBeTruthy();
      expect(within(row).getByText('48,000원')).toBeTruthy();
      expect(within(row).getByText('판매가 14,000원은 다음 영업일부터 적용돼요')).toBeTruthy();
      expect(within(row).getByRole('button', { name: `${longName} 판매 입력` }).getAttribute('aria-disabled')).not.toBe('true');
    },
  );

  it('수량·판매 양쪽이 같은 현재 수량 시트를 열며 닫기에는 저장이 없다', () => {
    render(<SalesHomeScreen />);
    for (const action of ['판매 수량 수정', '판매 입력']) {
      fireEvent.click(screen.getByRole('button', { name: `${longName} ${action}` }));
      expect(modal().getByText('오늘의 판매 수량')).toBeTruthy();
      expect(modal().getByText('판매 4개 · 폐기 2개')).toBeTruthy();
      fireEvent.click(modal().getByRole('button', { name: '매장 판매량 늘리기' }));
      expect(modal().getByText('판매 5개 · 폐기 2개')).toBeTruthy();
      fireEvent.click(modal().getByRole('button', { name: '닫기' }));
      expect(screen.queryByTestId('sales-modal')).toBeNull();
      expect(mock.save).not.toHaveBeenCalled(); expect(mock.check).not.toHaveBeenCalled();
    }
  });

  it('공용 정렬은 오늘 장부 profit으로 재배열하고 메뉴관리는 기존 route로 이동한다', () => {
    render(<SalesHomeScreen />);
    fireEvent.click(screen.getByRole('button', { name: '정렬 기준: 판매량순' }));
    fireEvent.click(modal().getByText('순이익순', { exact: true }));
    expect(screen.queryByTestId('sales-modal')).toBeNull();
    expect(screen.getByRole('button', { name: '정렬 기준: 순이익순' })).toBeTruthy();
    const ids = screen.getAllByTestId(/^SALES-01\/menu-/).map(el => el.getAttribute('data-testid'));
    expect(ids).toEqual(['SALES-01/menu-two', 'SALES-01/menu-stopped', 'SALES-01/menu-one']);
    fireEvent.click(screen.getByRole('button', { name: '메뉴 관리' }));
    expect(mock.push).toHaveBeenCalledWith('/recipes');
  });

  it('재료 부족은 판매 가능, 사용자 판매 중지만 양쪽 진입을 막는다', () => {
    render(<SalesHomeScreen />);
    expect(within(screen.getByTestId('SALES-01/menu-one')).getByText('재료 부족')).toBeTruthy();
    const row = within(screen.getByTestId('SALES-01/menu-stopped'));
    for (const name of ['김치찌개 판매 중지', '김치찌개 판매 수량 수정']) {
      const button = row.getByRole('button', { name });
      expect(button.getAttribute('aria-disabled')).toBe('true'); fireEvent.click(button);
    }
    expect(screen.queryByTestId('sales-modal')).toBeNull(); expect(mock.save).not.toHaveBeenCalled();
  });

  it.each([[390, 1, 'row'], [320, 1, 'column'], [390, 2, 'column']] as const)(
    '세 입력 시트는 width=%s/fontScale=%s에서 %s 배치와 본문 설명·취소 계약을 공유한다', (width, fontScale, direction) => {
      mock.dimensions = { ...mock.dimensions, width, fontScale };
      render(<SalesHomeScreen />);
      fireEvent.click(screen.getByRole('button', { name: `${longName} 판매 입력` }));
      expect(screen.getByTestId('sales-quantity-description').textContent).toBe(longName);
      expect(getComputedStyle(screen.getByTestId('sales-waste-input')).flexDirection).toBe(direction);
      fireEvent.click(modal().getByRole('button', { name: '닫기' }));
      fireEvent.click(screen.getByRole('button', { name: '기타 매출' }));
      expect(screen.getByTestId('sales-other-description').textContent).toBe('메뉴에 등록하지 않은 음료·기타 매출');
      expect(getComputedStyle(screen.getByTestId('sales-other-inputs')).flexDirection).toBe(direction);
      for (const button of ['취소', '추가']) expect(getComputedStyle(modal().getByRole('button', { name: button })).flexGrow).toBe('1');
      fireEvent.click(modal().getByRole('button', { name: '취소' }));
      fireEvent.click(screen.getByRole('button', { name: '지출 추가' }));
      expect(screen.getByTestId('sales-expense-description').textContent).toBe('재료 원가 외 당일 현금 지출');
      for (const button of ['취소', '추가']) expect(getComputedStyle(modal().getByRole('button', { name: button })).flexGrow).toBe('1');
      fireEvent.click(modal().getByRole('button', { name: '취소' }));
      expect(screen.queryByTestId('sales-modal')).toBeNull();
      expect(mock.save).not.toHaveBeenCalled(); expect(mock.check).not.toHaveBeenCalled();
    },
  );

  it('기타매출 미리보기는 저장과 같은 숫자 변환을 쓰며 취소·재열기 초안과 실제 payload를 보존한다', () => {
    render(<SalesHomeScreen />);
    fireEvent.click(screen.getByRole('button', { name: '기타 매출' }));
    expect(screen.getByTestId('sales-other-result').textContent).toContain('—');
    fireEvent.change(modal().getByPlaceholderText('예: 음료'), { target: { value: '  검수 음료  ' } });
    fireEvent.change(modal().getByPlaceholderText('2000'), { target: { value: '28,000' } });
    fireEvent.change(modal().getByRole('textbox', { name: '기타 매출 수량' }), { target: { value: '3' } });
    fireEvent.click(modal().getByRole('radio', { name: '배달' }));
    expect(screen.getByTestId('sales-other-result').textContent).toContain('84,000원');
    fireEvent.click(modal().getByRole('button', { name: '취소' }));
    expect(mock.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '기타 매출' }));
    expect(screen.getByTestId('sales-other-result').textContent).toContain('84,000원');
    fireEvent.click(modal().getByRole('button', { name: '추가' }));
    expect(mock.save).toHaveBeenCalledTimes(1);
    expect(mock.save.mock.calls[0]![0]).toMatchObject({ date: '2030-07-14', baseRevision: 7,
      etcItems: [{ name: '검수 음료', price: 28000, qty: 3, channel: 'delivery' }],
      items: [],
    });
  });

  it('지출 미리보기는 입력금액만 표시하고 저장의 메모·판본·기존 판매수량을 보존한다', () => {
    render(<SalesHomeScreen />);
    fireEvent.click(screen.getByRole('button', { name: '지출 추가' }));
    expect(screen.getByTestId('sales-expense-result').textContent).toContain('—');
    fireEvent.change(modal().getByPlaceholderText('예: 얼음·소모품'), { target: { value: '  얼음  ' } });
    fireEvent.change(modal().getByPlaceholderText('15000'), { target: { value: '15,000' } });
    fireEvent.change(modal().getByPlaceholderText('간단 메모'), { target: { value: '  당일  ' } });
    expect(screen.getByTestId('sales-expense-result').textContent).toContain('15,000원');
    fireEvent.click(modal().getByRole('button', { name: '추가' }));
    expect(mock.save).toHaveBeenCalledTimes(1);
    expect(mock.save.mock.calls[0]![0]).toMatchObject({ date: '2030-07-14', baseRevision: 7,
      extraItems: [{ name: '얼음', amount: 15000, memo: '당일' }],
      items: [],
    });
  });
});
