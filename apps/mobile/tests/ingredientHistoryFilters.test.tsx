import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StockHistoryScreen } from '@/features/ingredients/screens/StockHistoryScreen';
import PurchaseHistoryScreen from '@/features/ingredients/screens/PurchaseHistoryScreen';
import DiscardHistoryScreen from '@/features/ingredients/screens/DiscardHistoryScreen';
import type { LedgerEntry, PurchaseRow } from '@/features/ingredients/hooks';

const mock = vi.hoisted(() => ({ localDate: vi.fn(), detail: vi.fn(), stock: vi.fn(), purchases: vi.fn(), deleteDiscard: vi.fn() }));
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  // Only visibility is stubbed: the real host, BusinessDateGate, Sheet, filter
  // components, Pressables and callbacks remain in the rendered tree.
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
    visible ? <div data-testid="visible-history-modal">{children}</div> : null };
});
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'ingredient-fixture' }),
  router: { canGoBack: () => false, back: vi.fn(), replace: vi.fn() },
}));
vi.mock('@/features/business-day/businessDay', () => ({ useStoreLocalDate: mock.localDate }));
vi.mock('@/features/ingredients/hooks', () => ({
  useIngredientDetail: mock.detail, useStockHistory: mock.stock, usePurchaseHistory: mock.purchases,
  DISCARD_DELETE_DAYS: 7, useDeleteDiscard: () => ({ mutate: mock.deleteDiscard, isPending: false }),
}));

const today = '2030-07-15'; // Server fixture, deliberately unrelated to the machine date.
const defaultRange = { from: '2030-04-16', to: today };
const monthRange = { from: '2030-06-15', to: today };
type DateRange = { from?: string; to?: string };
const state = <T,>(data: T) => ({ data, isLoading: false, isFetched: true, error: null, refetch: vi.fn() });
const inRange = (date: string, range: DateRange) => (!range.from || date >= range.from) && (!range.to || date <= range.to);
const entry = (id: string, date: string, type: LedgerEntry['type'], extra: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id, date, type, note: `stock-${id}`, countDelta: type === 'inbound' ? 100 : -10,
  volumeDelta: null, balance: 987, reverted: false, waste: false, ...extra,
});
// Read fixtures are already newest-first, like the server contract. The date
// filter below emulates a read response; it does NOT test SQL/RPC filtering.
const ledger: LedgerEntry[] = [
  entry('future', '2030-07-16', 'inbound'),
  entry('pre-today', today, 'discard'),
  entry('in-today', today, 'inbound'),
  entry('cooked-today', today, 'discard', { waste: true }),
  entry('reverted', '2030-07-14', 'discard', { reverted: true }),
  entry('sale', '2030-07-14', 'consume'),
  entry('count', '2030-07-13', 'stocktake'),
  entry('in-month', '2030-06-20', 'inbound'),
  entry('cooked-month', '2030-06-19', 'discard', { waste: true }),
  entry('adjust', '2030-05-20', 'adjust'),
  entry('in-quarter', '2030-05-01', 'inbound'),
  entry('old', '2030-03-01', 'discard'),
];
const purchase = (id: string, orderedAt: string): PurchaseRow => ({
  id, orderedAt, expectedAt: null, status: 'received', vendorName: `purchase-${id}`,
  volume: 1000, amount: 4000, qty: 1, receivedQty: 1, unitPrice: 4,
});
const purchases = [purchase('future', '2030-07-16'), purchase('today', today),
  purchase('month', '2030-06-20'), purchase('quarter', '2030-05-01'), purchase('old', '2030-03-01')];
const modal = () => within(screen.getByTestId('visible-history-modal'));
const open = (label: string) => fireEvent.click(screen.getByRole('button', { name: `${label} 변경` }));
const choiceName = (label: string) => new RegExp(`^${label}(, 현재 선택됨)?$`);
const choose = (label: string) => fireEvent.click(modal().getByRole('button', { name: choiceName(label) }));
const chooseKind = (label: string) => fireEvent.click(within(modal().getByText('유형', { exact: true }).parentElement!)
  .getByRole('button', { name: choiceName(label) }));
const notes = (prefix = 'stock-') => screen.queryAllByText(new RegExp(`^${prefix}`)).map((el) => el.textContent);
const defaultNotes = ledger.filter((e) => inRange(e.date, defaultRange)).map((e) => e.note);

// Host integration, not a fake filter host. No real DB/network, native animation,
// touch geometry, large-font layout or screen-reader behavior is certified here.
describe('ING-07/08/09/10 실제 이력 화면과 공용 필터 시트 연결', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.localDate.mockReturnValue({ date: today, isLoading: false, error: null, refetch: vi.fn() });
    mock.detail.mockReturnValue(state({ id: 'ingredient-fixture', name: '대파', baseUnit: 'g', stockTotal: 987, basePrice: 4 }));
    mock.stock.mockImplementation((_id: string, range: DateRange) => state(ledger.filter((e) => inRange(e.date, range))));
    mock.purchases.mockImplementation((_id: string, range: DateRange) => state(purchases.filter((e) => inRange(e.orderedAt, range))));
    mock.deleteDiscard.mockImplementation(() => { throw new Error('이 시험에서 폐기를 삭제하면 안 됩니다'); });
  });

  it('구매이력: 괄호 없이 팩 구성, 총 수량, 단가 순서로 표시한다', () => {
    mock.purchases.mockReturnValue(state([{ ...purchase('three', today), qty: 3, receivedQty: 3 }]));
    render(<PurchaseHistoryScreen />);
    const pack = screen.getByText('1kg × 3개');
    expect(Array.from(pack.parentElement!.children).map(node => node.textContent)).toEqual([
      '1kg × 3개', '총 3kg', '4.00원/g',
    ]);
    expect(screen.queryByText('(1kg × 3개)')).toBeNull();
    expect(screen.queryByText(/원 지출/)).toBeNull();
  });

  for (const [chip, title, options] of [
    ['최근 3개월', '조회 기간', ['최근 1개월','최근 3개월','최근 6개월','전체']],
    ['전체', '유형', ['전체','입고','판매 소진','차감','폐기']],
    ['최신순', '정렬 기준', ['최신순','오래된순']],
  ] as const) {
    it(`ING-07/08: ${title}만 별도로 열고 닫기는 적용값을 유지한다`, () => {
      render(<StockHistoryScreen />);
      expect(mock.stock).toHaveBeenLastCalledWith('ingredient-fixture', defaultRange);
      expect(notes()).toEqual(defaultNotes);
      open(chip);
      expect(modal().getByText(title)).toBeTruthy();
      expect(modal().queryByText('조회 설정')).toBeNull();
      expect(modal().queryByRole('button', { name: '조회' })).toBeNull();
      for (const option of options) expect(modal().getByRole('button', { name: choiceName(option) })).toBeTruthy();
      expect(modal().getAllByRole('button').map((button) => button.getAttribute('aria-label'))
        .filter((label) => label?.endsWith(', 현재 선택됨')))
        .toEqual([`${chip}, 현재 선택됨`]);
      expect(notes()).toEqual(defaultNotes);
      const closeButtons = modal().getAllByRole('button', { name: '닫기' });
      expect(closeButtons).toHaveLength(1);
      fireEvent.click(closeButtons[0]!);
      expect(screen.queryByTestId('visible-history-modal')).toBeNull();
      expect(mock.stock).toHaveBeenLastCalledWith('ingredient-fixture', defaultRange);
      expect(notes()).toEqual(defaultNotes);
      expect(screen.getByRole('button', { name: '전체 변경' })).toBeTruthy();
      expect(screen.getByRole('button', { name: '최신순 변경' })).toBeTruthy();
    });
  }

  it('ING-07/08: 각 선택 즉시 적용하고 다른 조건과 서버 잔량을 보존한다', () => {
    render(<StockHistoryScreen />);
    open('최근 3개월'); choose('최근 1개월');
    expect(screen.queryByTestId('visible-history-modal')).toBeNull();
    open('전체'); choose('입고');
    open('최신순'); choose('오래된순');
    expect(screen.queryByTestId('visible-history-modal')).toBeNull();
    expect(mock.stock).toHaveBeenLastCalledWith('ingredient-fixture', monthRange);
    expect(notes()).toEqual(['stock-in-month', 'stock-in-today']);
    expect(screen.getAllByText('잔량 987g')).toHaveLength(2);
    open('입고');
    fireEvent.click(modal().getAllByRole('button', { name: '닫기' })[0]!);
    expect(mock.stock).toHaveBeenLastCalledWith('ingredient-fixture', monthRange);
    expect(notes()).toEqual(['stock-in-month', 'stock-in-today']);
    expect(screen.getByRole('button', { name: '오래된순 변경' })).toBeTruthy();
  });

  for (const [kind, expected] of [
    ['입고', ['stock-in-today', 'stock-in-month', 'stock-in-quarter']],
    ['판매 소진', ['stock-sale']],
    ['폐기', ['stock-pre-today', 'stock-cooked-today', 'stock-reverted', 'stock-cooked-month']],
    ['차감', ['stock-count', 'stock-adjust']],
  ] as const) {
    it(`ING-07/08: ${kind} 필터가 실제 목록에서 원장 종류를 고르고 최신순을 유지한다`, () => {
      render(<StockHistoryScreen />);
      open('전체'); choose(kind);
      expect(notes()).toEqual(expected);
      expect(mock.stock).toHaveBeenLastCalledWith('ingredient-fixture', defaultRange);
    });
  }

  it('ING-09: 공통 조회 기간 목록은 선택 즉시 적용하고 닫기는 기존 값을 유지한다', () => {
    render(<PurchaseHistoryScreen />);
    open('최근 3개월');
    expect(modal().getByText('조회 기간')).toBeTruthy();
    for (const label of ['최근 1개월', '최근 3개월', '최근 6개월', '전체'])
      expect(modal().getByRole('button', { name: choiceName(label) })).toBeTruthy();
    expect(modal().queryByRole('button', { name: '적용' })).toBeNull();
    expect(modal().queryByRole('button', { name: '오늘' })).toBeNull();
    choose('닫기');
    expect(mock.purchases).toHaveBeenLastCalledWith('ingredient-fixture', defaultRange);
    open('최근 3개월'); choose('최근 1개월');
    expect(screen.queryByTestId('visible-history-modal')).toBeNull();
    expect(mock.purchases).toHaveBeenLastCalledWith('ingredient-fixture', monthRange);
    expect(notes('purchase-')).toEqual(['purchase-today', 'purchase-month']);
    open('최근 1개월'); choose('전체');
    expect(mock.purchases).toHaveBeenLastCalledWith('ingredient-fixture', { to: today });
    expect(notes('purchase-')).toEqual(['purchase-today', 'purchase-month', 'purchase-quarter', 'purchase-old']);
  });

  for (const host of ['discard'] as ('purchase' | 'discard')[]) {
    it(`${host === 'purchase' ? 'ING-09' : 'ING-10'}: PeriodSheet draft/닫기/오늘 적용/전체 적용이 실제 읽기 인자와 목록에 연결된다`, () => {
      render(host === 'purchase' ? <PurchaseHistoryScreen /> : <DiscardHistoryScreen />);
      const read = host === 'purchase' ? mock.purchases : mock.stock;
      const prefix = host === 'purchase' ? 'purchase-' : 'stock-';
      const baseline = notes(prefix);
      expect(read).toHaveBeenLastCalledWith('ingredient-fixture', defaultRange);
      open('최근 3개월');
      expect(modal().getByRole('button', { name: '최근 3개월, 현재 선택됨' })).toBeTruthy();
      const calls = read.mock.calls.length;
      choose('오늘');
      expect(modal().getByRole('button', { name: '오늘, 현재 선택됨' })).toBeTruthy();
      expect(modal().queryByRole('button', { name: '최근 3개월, 현재 선택됨' })).toBeNull();
      expect(modal().getAllByText('2030.07.15')).toHaveLength(2);
      expect(read).toHaveBeenCalledTimes(calls);
      expect(notes(prefix)).toEqual(baseline);
      choose('닫기'); open('최근 3개월');
      expect(modal().getByText('2030.04.16')).toBeTruthy();
      choose('적용');
      expect(read).toHaveBeenLastCalledWith('ingredient-fixture', defaultRange);
      expect(notes(prefix)).toEqual(baseline);
      open('최근 3개월'); choose('오늘'); choose('적용');
      expect(read).toHaveBeenLastCalledWith('ingredient-fixture', { from: today, to: today });
      expect(notes(prefix)).toEqual(host === 'purchase' ? ['purchase-today'] : ['stock-pre-today', 'stock-cooked-today']);
      open('오늘'); choose('전체');
      expect(modal().getByText('처음')).toBeTruthy();
      choose('적용');
      expect(read).toHaveBeenLastCalledWith('ingredient-fixture', { to: today });
      expect(notes(prefix)).toEqual(host === 'purchase'
        ? ['purchase-today', 'purchase-month', 'purchase-quarter', 'purchase-old']
        : ['stock-pre-today', 'stock-cooked-today', 'stock-cooked-month', 'stock-old']);
      expect(screen.queryByText(`${prefix}future`)).toBeNull();
      expect(mock.deleteDiscard).not.toHaveBeenCalled();
    });
  }

  it('ING-10: 유형 시트는 폐기만 세며 선택 즉시 닫히고 기간과 조리 전/후 필터를 함께 유지한다', () => {
    render(<DiscardHistoryScreen />);
    expect(notes()).toEqual(['stock-pre-today', 'stock-cooked-today', 'stock-cooked-month']);
    open('전체');
    expect(modal().getByRole('button', { name: '전체 3건, 현재 선택됨' })).toBeTruthy();
    expect(modal().getByRole('button', { name: '조리 전 폐기 1건' })).toBeTruthy();
    choose('조리 후 폐기 2건');
    expect(screen.queryByTestId('visible-history-modal')).toBeNull();
    expect(notes()).toEqual(['stock-cooked-today', 'stock-cooked-month']);
    expect(screen.getByText('조리 후 폐기 합계')).toBeTruthy();
    expect(mock.stock).toHaveBeenLastCalledWith('ingredient-fixture', defaultRange);
    open('최근 3개월'); choose('오늘'); choose('적용');
    expect(notes()).toEqual(['stock-cooked-today']);
    open('조리 후 폐기');
    expect(modal().getByRole('button', { name: '조리 후 폐기 1건, 현재 선택됨' })).toBeTruthy();
    expect(modal().getByRole('button', { name: '전체 2건' })).toBeTruthy();
    choose('조리 전 폐기 1건');
    expect(notes()).toEqual(['stock-pre-today']);
    expect(mock.stock).toHaveBeenLastCalledWith('ingredient-fixture', { from: today, to: today });
    open('조리 전 폐기'); choose('닫기');
    expect(notes()).toEqual(['stock-pre-today']);
    expect(mock.deleteDiscard).not.toHaveBeenCalled();
  });

  for (const [label, Host] of [['ING-07', StockHistoryScreen], ['ING-09', PurchaseHistoryScreen], ['ING-10', DiscardHistoryScreen]] as const) {
    it(`${label}: 서버 localDate가 없으면 실제 날짜 게이트가 이력 읽기를 막는다`, () => {
      mock.localDate.mockReturnValue({ date: null, isLoading: true, error: null, refetch: vi.fn() });
      const view = render(<Host />);
      expect(mock.stock).not.toHaveBeenCalled(); expect(mock.purchases).not.toHaveBeenCalled();
      expect(mock.detail).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: '최근 3개월 변경' })).toBeNull();
      mock.localDate.mockReturnValue({ date: today, isLoading: false, error: null, refetch: vi.fn() });
      view.rerender(<Host />);
      expect(label === 'ING-09' ? mock.purchases : mock.stock).toHaveBeenLastCalledWith('ingredient-fixture', defaultRange);
    });
  }

  for (const [label, Host] of [['ING-09', PurchaseHistoryScreen], ['ING-10', DiscardHistoryScreen]] as const) {
    for (const detailStatus of ['ready', 'loading', 'error'] as const) {
      it(`${label}: mixed-detail ${detailStatus} — 상세 성공은 ml 표시, 로딩/오류는 이력 차단`, () => {
        const detailRetry = vi.fn(), historyRetry = vi.fn();
        const detail = { id: 'ingredient-fixture', name: '우유', baseUnit: 'ml', stockTotal: 987, basePrice: 4 };
        mock.detail.mockReturnValue({ ...state(detailStatus === 'ready' ? detail : undefined),
          isLoading: detailStatus === 'loading', error: detailStatus === 'error' ? new Error('detail fixture failure') : null,
          refetch: detailRetry });
        const read = label === 'ING-09' ? mock.purchases : mock.stock;
        const rows = label === 'ING-09' ? purchases.filter((e) => inRange(e.orderedAt, defaultRange))
          : ledger.filter((e) => inRange(e.date, defaultRange));
        read.mockReturnValue({ ...state(rows), refetch: historyRetry });
        render(<Host />);
        if (detailStatus === 'ready') {
          expect(notes(label === 'ING-09' ? 'purchase-' : 'stock-').length).toBeGreaterThan(0);
          expect(screen.getAllByText(label === 'ING-09' ? '4.00원/ml' : '−10ml').length).toBeGreaterThan(0);
          expect(screen.queryByText('4.00원/g')).toBeNull();
          expect(screen.queryByText('−10g')).toBeNull();
        } else {
          expect(notes(label === 'ING-09' ? 'purchase-' : 'stock-')).toEqual([]);
          expect(screen.queryByText('4.00원/g')).toBeNull();
          expect(screen.queryByText('−10g')).toBeNull();
          expect(screen.getByText(detailStatus === 'loading' ? '불러오는 중이에요' : '정보를 불러오지 못했어요')).toBeTruthy();
          if (detailStatus === 'error') {
            fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
            expect(detailRetry).toHaveBeenCalledOnce();
            expect(historyRetry).toHaveBeenCalledOnce();
          }
        }
        expect(mock.deleteDiscard).not.toHaveBeenCalled();
      });
    }
    it(`${label}: history 오류의 다시 시도도 상세와 이력 읽기를 모두 재시도한다`, () => {
      const detailRetry = vi.fn(), historyRetry = vi.fn();
      mock.detail.mockReturnValue({ ...state({ baseUnit: 'ml', basePrice: 4 }), refetch: detailRetry });
      const read = label === 'ING-09' ? mock.purchases : mock.stock;
      read.mockReturnValue({ ...state([]), error: new Error('history fixture failure'), refetch: historyRetry });
      render(<Host />);
      expect(screen.getByText('정보를 불러오지 못했어요')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
      expect(detailRetry).toHaveBeenCalledOnce();
      expect(historyRetry).toHaveBeenCalledOnce();
    });
  }
});
