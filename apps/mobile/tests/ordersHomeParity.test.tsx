import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrdersHomeScreen from '@/features/orders/screens/OrdersHomeScreen';
import BulkOrderScreen from '@/features/orders/screens/BulkOrderScreen';
import { CandidateOrderForm } from '@/features/orders/components/CandidateOrderForm';
import { InboundOrderForm } from '@/features/orders/components/InboundOrderForm';
import type { ConfirmInboundResult, OrderBoard, OrderCandidate, OrderRecord } from '@/features/orders/hooks';
import type { PurchaseOption } from '@/features/ingredients/hooks';

const mock = vi.hoisted(() => ({
  board: vi.fn(), detail: vi.fn(), date: vi.fn(), ingredients: vi.fn(), preview: vi.fn(),
  place: vi.fn(), confirmInbound: vi.fn(), resolvePending: vi.fn(), cancel: vi.fn(), revert: vi.fn(),
  saved: vi.fn(), openURL: vi.fn().mockResolvedValue(undefined), push: vi.fn(), replace: vi.fn(), alert: vi.fn(), makeInboundKey: vi.fn(),
  placePending: false, inboundPending: false,
  dimensions: { width: 390, height: 844, scale: 1, fontScale: 1 },
}));

vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => mock.dimensions,
    Alert: { ...rn.Alert, alert: mock.alert },
    Linking: { ...rn.Linking, openURL: mock.openURL },
    // Native Modal visibility alone is adapted for jsdom. The actual
    // OrdersHomeScreen and kit Sheet/Input/Button hosts remain in the test.
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
      visible ? <div data-testid="orders-modal">{children}</div> : null,
  };
});
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mock.push, replace: mock.replace }), useLocalSearchParams: () => ({}) }));
vi.mock('@/features/business-day/businessDay', () => ({ useStoreLocalDate: mock.date, useBusinessDay: () => ({ data: { timezone: 'Asia/Seoul' } }) }));
vi.mock('@/features/orders/hooks', () => ({
  useOrderBoard: mock.board,
  usePlaceOrders: () => ({ mutate: mock.place, isPending: mock.placePending }),
  useConfirmInbound: () => ({ mutate: mock.confirmInbound, resolvePending: mock.resolvePending, isPending: mock.inboundPending }),
  useCancelOrder: () => ({ mutate: mock.cancel, isPending: false }),
  useRevertInbound: () => ({ mutate: mock.revert, isPending: false }),
}));
vi.mock('@/features/ingredients/hooks', () => ({ useIngredientDetail: mock.detail,
  useIngredientList: mock.ingredients, useQuickInboundPreview: mock.preview,
  useInventoryOccurrenceContext: () => ({ data: { requiresConfirmation: false, serverNow: '2030-07-14T05:30:00Z', timezone: 'Asia/Seoul' }, isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock('@/lib/supabase', () => ({ makeInboundKey: mock.makeInboundKey }));

const today = '2030-07-14';
const candidates: OrderCandidate[] = [
  { ingredientId: 'ingredient-onion', name: '양파', reasons: ['safety_stock'], recommendedQty: 2.2,
    status: 'pending', stockTotal: 500, safetyTotal: 1000, baseUnit: 'g', perVolume: 1000 },
  { ingredientId: 'ingredient-green-onion', name: '대파', reasons: ['soon_out'], recommendedQty: 1,
    status: 'pending', stockTotal: -100, safetyTotal: 500, baseUnit: 'g', perVolume: 1000 },
];
const waiting: OrderRecord[] = [
  { id: 'order-waiting', ingredientId: 'ingredient-onion', name: '양파', vendorName: '중앙상회',
    volume: 1000, amount: 3000, qty: 5, receivedQty: 2, status: 'partial',
    orderedAt: '2030-07-10T04:00:00Z', expectedAt: '2030-07-13', unitPrice: 3 },
];
const received: OrderRecord[] = [
  { id: 'order-received', ingredientId: 'ingredient-green-onion', name: '대파', vendorName: null,
    volume: 1000, amount: 4000, qty: 2, receivedQty: 2, status: 'received',
    orderedAt: '2030-07-12T04:00:00Z', receivedAt: '2030-07-14T16:00:00Z', expectedAt: '2030-07-13', unitPrice: 4 },
];
const options: PurchaseOption[] = [
  { editRevision: '1', id: 'option-one', url: null, name: '양파 1kg', volume: 1000, amount: 3000,
    vendorId: 'vendor-one', vendorName: '중앙상회', brandId: null, brandName: null },
  { editRevision: '1', id: 'option-two', url: null, name: '양파 2kg', volume: 2000, amount: 5500,
    vendorId: 'vendor-two', vendorName: '농산물직송', brandId: null, brandName: null },
];

const query = <T,>(data: T) => ({ data, isLoading: false, error: null, refetch: vi.fn() });
const boardState = (data: OrderBoard = { candidates, waiting, received }) => ({ ...query(data), refetch: vi.fn(async () => ({ data, isError: false })) });
const detailState = (liveOptions: PurchaseOption[] = options) => query({
  id: 'ingredient-onion', name: '양파', baseUnit: 'g', safetyStock: 1200, options: liveOptions,
});
const modalForTitle = (title: string) => {
  const node = screen.getAllByTestId('orders-modal').find((candidate) =>
    within(candidate).queryAllByText(title).length > 0,
  );
  if (!node) throw new Error(`${title} modal not found`);
  return within(node);
};
const input = (host: ReturnType<typeof modalForTitle>, name: string) =>
  host.getByRole('textbox', { name }) as HTMLInputElement;
const fill = (host: ReturnType<typeof modalForTitle>, name: string, value: string) =>
  fireEvent.change(input(host, name), { target: { value } });

const chooseOption = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: '구매처 선택' }));
  fireEvent.click(screen.getByRole('button', { name }));
};
const chooseArrivalDay = (day: number) => {
  fireEvent.click(screen.getByRole('button', { name: /도착일 .* 고르기/ }));
  fireEvent.click(modalForTitle('도착일 선택').getByRole('button', { name: `${day}일 선택` }));
};

type MutationCallbacks<T = unknown> = {
  onSuccess: (result: T) => void;
  onError: (error: unknown) => void;
};

// Domain hooks, server date, RPC mutations, router effects, Alert delivery and
// native Modal are mocked. These RNW/jsdom host tests do not execute Supabase
// RPCs or certify native gestures, device layout, visual QA, or DB idempotency.
describe('ORD-01 실제 발주 홈·kit·서버 날짜 연결', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.openURL.mockResolvedValue(undefined);
    mock.placePending = false; mock.inboundPending = false;
    mock.dimensions = { width: 390, height: 844, scale: 1, fontScale: 1 };
    mock.date.mockReturnValue({ date: today, isLoading: false, error: null, refetch: vi.fn() });
    mock.board.mockReturnValue(boardState());
    mock.detail.mockReturnValue(detailState());
    mock.ingredients.mockReturnValue(query(candidates.map((c) => ({ id: c.ingredientId, baseUnit: c.baseUnit }))));
    mock.preview.mockReturnValue(query({ stockAfter: 3500, basePriceBefore: 3, basePriceAfter: 3.25, inboundUnitPrice: 4 }));
    mock.makeInboundKey.mockReturnValue('inbound-key-order-waiting');
    mock.resolvePending.mockResolvedValue(null);
  });

  afterEach(cleanup);

  it('발주판 조회 실패와 실제 0건을 구분하고 재시도·탭 상태에서 쓰기를 만들지 않는다', () => {
    const refetch = vi.fn();
    mock.board.mockReturnValue({ data: undefined, isLoading: false, error: new Error('발주판 조회 실패'), refetch });
    const host = render(<OrdersHomeScreen />);
    expect(screen.getByText('정보를 불러오지 못했어요')).toBeTruthy();
    expect(screen.queryByText('지금 발주할 것이 없어요')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(mock.place).not.toHaveBeenCalled();
    expect(mock.confirmInbound).not.toHaveBeenCalled();

    mock.board.mockReturnValue(boardState({ candidates: [], waiting: [], received: [] }));
    host.rerender(<OrdersHomeScreen />);
    expect(screen.getByText('지금 발주할 것이 없어요')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '입고 예정 0건' }));
    expect(screen.getByText('입고 예정인 발주가 없어요')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '입고 완료 0건' }));
    expect(screen.getByText('입고 완료된 발주가 없어요')).toBeTruthy();
    expect(mock.cancel).not.toHaveBeenCalled();
    expect(mock.revert).not.toHaveBeenCalled();
  });


  it('세 탭은 별도 목록 보기 없이 카드에서 주문·입고·상세로 연결한다', async () => {
    render(<OrdersHomeScreen />);
    expect(screen.queryByRole('button', { name: /목록 보기/ })).toBeNull();
    expect(screen.queryByText('부족량')).toBeNull();
    expect(screen.getAllByText('현재 / 최소 재고')).toHaveLength(2);
    expect(screen.getByText('/ 1,000 g')).toBeTruthy();
    expect(screen.getByText('/ 500 g')).toBeTruthy();
    expect(screen.getByText('−100')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '양파 상세 보기' }));
    expect(mock.push).toHaveBeenCalledWith('/ingredients/ingredient-onion');
    fireEvent.click(screen.getAllByRole('button', { name: '발주완료' })[0]!);
    expect(mock.push).toHaveBeenCalledWith('/orders/place?ingredient=ingredient-onion');
    expect(screen.queryByTestId('orders-modal')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: '입고 예정 1건' }));
    expect(screen.queryByRole('button', { name: /목록 보기/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '양파 상세 보기' }));
    expect(mock.push).toHaveBeenCalledWith('/ingredients/ingredient-onion');
    fireEvent.click(screen.getByRole('button', { name: '입고 완료' }));
    expect(mock.push).toHaveBeenCalledWith('/orders/receive?order=order-waiting');
    expect(screen.queryByTestId('orders-modal')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: '입고 완료 1건' }));
    expect(screen.queryByRole('button', { name: /목록 보기/ })).toBeNull();
    expect(screen.queryByText('입고일')).toBeNull();
    expect(screen.getByText('7/15 입고')).toBeTruthy();
    expect(screen.queryByText('입고 단가')).toBeNull();
    expect(screen.queryByText('4.00원/g')).toBeNull();
    expect(screen.getByText('8,000원')).toBeTruthy();
    expect(screen.getByText('총 2kg')).toBeTruthy();
    expect(screen.queryByText('1kg × 2개')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '대파 상세 보기' }));
    expect(mock.push).toHaveBeenCalledWith('/ingredients/ingredient-green-onion');
    expect(mock.place).not.toHaveBeenCalled();
    expect(mock.confirmInbound).not.toHaveBeenCalled();
    expect(mock.revert).not.toHaveBeenCalled();
  });

  it('후보의 구매링크 버튼은 페이지 이동 없이 구매처 팝업을 열고 행 클릭만 링크를 연다', () => {
    mock.detail.mockReturnValue(detailState([{ ...options[0]!, url: 'https://example.com/onion' }]));
    render(<OrdersHomeScreen />);
    fireEvent.click(screen.getAllByRole('button', { name: '구매링크 열기' })[0]!);
    const popup = modalForTitle('구매처 선택');
    expect(mock.detail).toHaveBeenLastCalledWith('ingredient-onion');
    expect(popup.getByText('중앙상회')).toBeTruthy();
    expect(popup.getByText('3,000원')).toBeTruthy();
    expect(popup.getByText('1kg')).toBeTruthy();
    expect(mock.push).not.toHaveBeenCalled();
    expect(mock.openURL).not.toHaveBeenCalled();
    fireEvent.click(popup.getByRole('button', { name: '양파 1kg 구매 링크 열기' }));
    expect(mock.openURL).toHaveBeenCalledWith('https://example.com/onion');
    expect(mock.place).not.toHaveBeenCalled();
    expect(mock.confirmInbound).not.toHaveBeenCalled();
    fireEvent.click(popup.getByRole('button', { name: '닫기' }));
    expect(screen.queryByTestId('orders-modal')).toBeNull();
  });

  it('후보 구매링크 팝업은 빈 옵션과 잘못된 주소로 외부 이동하지 않는다', () => {
    mock.detail.mockReturnValue(detailState([]));
    const view = render(<OrdersHomeScreen />);
    fireEvent.click(screen.getAllByRole('button', { name: '구매링크 열기' })[0]!);
    expect(modalForTitle('구매처 선택').getByText('등록된 구매 링크가 없어요')).toBeTruthy();
    mock.detail.mockReturnValue(detailState([{ ...options[0]!, url: 'javascript:alert(1)' }]));
    view.rerender(<OrdersHomeScreen />);
    fireEvent.click(modalForTitle('구매처 선택').getByRole('button', { name: '양파 1kg 구매 링크 열기' }));
    expect(mock.openURL).not.toHaveBeenCalled();
    expect(mock.alert).toHaveBeenCalledWith('링크를 열 수 없어요', expect.any(String));
  });

  it('후보 주문 페이지는 재고 요약과 2열 입력, 별도 하단 등록 버튼을 둔다', () => {
    render(<CandidateOrderForm candidate={candidates[0]!} localDate={today} onSaved={vi.fn()} presentation="page" />);
    expect(screen.getByText('양파')).toBeTruthy();
    expect(screen.queryByText('부족량')).toBeNull();
    expect(screen.getByText('최소재고 미달')).toBeTruthy();
    expect(screen.queryByText('단가')).toBeNull();
    expect(screen.getByText('500g')).toBeTruthy();
    expect(screen.getByRole('button', { name: '구매처 선택' }).textContent).toContain('미 선택');
    expect(screen.queryByText('구매 링크')).toBeNull();
    expect(screen.queryByText('용량')).toBeNull();
    expect(screen.queryByRole('textbox', { name: '발주 수량' })).toBeNull();
    expect(screen.queryByText('총 발주량')).toBeNull();
    expect(screen.queryByText('발주 금액')).toBeNull();
    expect(screen.queryByText('도착일')).toBeNull();
    chooseOption('양파 1kg');
    expect(screen.getByText('도착일')).toBeTruthy();
    expect(screen.getByRole('button', { name: '도착일 2030-07-15 고르기' })).toBeTruthy();
    expect(getComputedStyle(screen.getByTestId('ORD-01/order-fields')).flexDirection).toBe('column');
    const footer = screen.getByTestId('ORD-02b/footer');
    expect(within(footer).getByRole('button', { name: '발주 완료' })).toBeTruthy();
    expect(within(footer).queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('textbox', { name: '발주 수량' }).closest('[data-testid="ORD-02b/footer"]')).toBeNull();
    expect(mock.place).not.toHaveBeenCalled();
  });

  it('구매처 목록 행은 옵션만 선택하고 링크 열기 버튼을 눌러야 외부 링크를 연다', () => {
    mock.detail.mockReturnValue(detailState([
      { ...options[0]!, url: 'example.com/onion' },
      { ...options[1]!, url: 'https://example.com/box' },
    ]));
    render(<CandidateOrderForm candidate={candidates[0]!} localDate={today} onSaved={mock.saved} />);
    expect(screen.queryByText('https://example.com/onion')).toBeNull();
    expect(mock.openURL).not.toHaveBeenCalled();
    chooseOption('양파 2kg');
    expect(screen.queryByText('https://example.com/onion')).toBeNull();
    expect(screen.getByText('https://example.com/box')).toBeTruthy();
    expect(mock.openURL).not.toHaveBeenCalled();
    expect(mock.alert).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '구매 링크 열기' }));
    expect(mock.openURL).toHaveBeenCalledWith('https://example.com/box');
    expect(mock.openURL).toHaveBeenCalledTimes(1);
    expect(mock.place).not.toHaveBeenCalled();
    expect(mock.confirmInbound).not.toHaveBeenCalled();
  });

  it('구매처 팝업의 미 선택을 누르면 선택을 해제하고 발주 입력을 다시 숨긴다', () => {
    render(<CandidateOrderForm candidate={candidates[0]!} localDate={today} onSaved={mock.saved} />);
    fireEvent.click(screen.getByRole('button', { name: '구매처 선택' }));
    expect(screen.getByRole('button', { name: '미 선택' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '양파 1kg' }));
    expect(screen.getByRole('textbox', { name: '발주 수량' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '구매처 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '미 선택' }));
    expect(screen.getByRole('button', { name: '구매처 선택' }).textContent).toContain('미 선택');
    expect(screen.queryByRole('textbox', { name: '발주 수량' })).toBeNull();
    expect(screen.queryByText('도착일')).toBeNull();
    expect(screen.getByRole('button', { name: '발주 완료' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('실행 가능한 웹 링크가 아니어도 외부 이동하지 않고 달력에서 고른 도착일로 발주한다', () => {
    mock.detail.mockReturnValue(detailState([{ ...options[0]!, url: 'javascript:alert(1)' }]));
    render(<CandidateOrderForm candidate={candidates[0]!} localDate={today} onSaved={mock.saved} />);
    chooseOption('양파 1kg');
    expect(screen.getByRole('button', { name: '구매 링크 열기' }).getAttribute('aria-disabled')).toBe('true');
    expect(mock.alert).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '도착일 2030-07-15 고르기' }));
    const calendar = modalForTitle('도착일 선택');
    expect(calendar.getByRole('button', { name: '13일 선택' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(calendar.getByRole('button', { name: '14일 선택' }));
    expect(screen.getByRole('button', { name: '도착일 2030-07-14 고르기' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '발주 완료' }));
    expect(mock.place.mock.calls[0]![0][0].expectedAt).toBe(today);
  });

  it('발주 등록 연타는 한 번만 전송하고 실패 후에만 재시도할 수 있다', () => {
    const saved = vi.fn();
    render(<CandidateOrderForm candidate={candidates[0]!} localDate={today} onSaved={saved} />);
    chooseOption('양파 1kg');
    const submit = screen.getByRole('button', { name: '발주 완료' });
    fireEvent.click(submit); fireEvent.click(submit);
    expect(mock.place).toHaveBeenCalledTimes(1);
    expect(saved).not.toHaveBeenCalled();
    act(() => mock.place.mock.calls[0]![1].onError(new Error('통신 실패')));
    fireEvent.click(submit);
    expect(mock.place).toHaveBeenCalledTimes(2);
    act(() => mock.place.mock.calls[1]![1].onSuccess());
    expect(saved).toHaveBeenCalledOnce();
  });

  it('응답 유실 확인에서 미기록이면 화면을 닫지 않고 현재 입력의 재확인을 요구한다', () => {
    const saved = vi.fn();
    render(<CandidateOrderForm candidate={candidates[0]!} localDate={today} onSaved={saved} />);
    chooseOption('양파 1kg');
    fireEvent.click(screen.getByRole('button', { name: '발주 완료' }));
    act(() => mock.place.mock.calls[0]![1].onSuccess({ resolved: 'not_recorded', orderIds: [] }));
    expect(saved).not.toHaveBeenCalled();
    expect(mock.alert).toHaveBeenCalledWith('이전 발주는 저장되지 않았어요',
      '현재 내용을 확인한 뒤 발주 완료를 다시 눌러 주세요.');
  });

  it('구매 링크 조회 실패 시 캐시에 옵션이 남아도 등록하지 않는다', () => {
    mock.detail.mockReturnValue({ ...detailState(), error: new Error('조회 실패') });
    render(<CandidateOrderForm candidate={candidates[0]!} localDate={today} onSaved={vi.fn()} presentation="page" />);
    fireEvent.click(screen.getByRole('button', { name: '발주 완료' }));
    expect(mock.place).not.toHaveBeenCalled();
  });

  it('발주 취소는 확인 전 mutation이 없고 지정 orderId만 보내며 실패를 알린다', () => {
    mock.board.mockReturnValue(boardState({ candidates, waiting: [{ ...waiting[0]!, receivedQty: 0, status: 'ordered' }], received }));
    render(<OrdersHomeScreen />);
    fireEvent.click(screen.getByRole('tab', { name: '입고 예정 1건' }));
    fireEvent.click(screen.getByRole('button', { name: '발주 취소' }));
    expect(mock.cancel).not.toHaveBeenCalled();
    let host = modalForTitle('발주 취소');
    expect(host.getByText('취소 시, 발주후보 페이지로 이동합니다.')).toBeTruthy();
    fireEvent.click(host.getByRole('button', { name: '닫기' }));
    expect(mock.cancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '발주 취소' }));
    host = modalForTitle('발주 취소');
    fireEvent.click(host.getByRole('button', { name: '발주취소' }));
    fireEvent.click(host.getByRole('button', { name: '발주취소' }));
    expect(mock.cancel).toHaveBeenCalledTimes(1);
    expect(mock.cancel).toHaveBeenCalledWith({ orderId: 'order-waiting' }, expect.any(Object));
    mock.cancel.mock.calls[0]![1].onError(new Error('취소 거절'));
    expect(mock.alert).toHaveBeenLastCalledWith('취소하지 못했어요', '취소 거절');
    expect(mock.revert).not.toHaveBeenCalled(); expect(mock.confirmInbound).not.toHaveBeenCalled();
  });

  it('발주 취소 성공 시 팝업을 닫고 발주 후보 탭으로 이동한다', () => {
    render(<OrdersHomeScreen />);
    fireEvent.click(screen.getByRole('tab', { name: '입고 예정 1건' }));
    fireEvent.click(screen.getByRole('button', { name: '발주 취소' }));
    fireEvent.click(modalForTitle('발주 취소').getByRole('button', { name: '발주취소' }));
    act(() => mock.cancel.mock.calls[0]![1].onSuccess());
    expect(screen.queryByTestId('orders-modal')).toBeNull();
    expect(screen.getByRole('tab', { name: '발주 후보 2건' }).getAttribute('aria-selected')).toBe('true');
  });

  it('입고 취소는 영향 안내와 별도 확인 뒤 해당 orderId/ingredientId만 보낸다', () => {
    render(<OrdersHomeScreen />);
    fireEvent.click(screen.getByRole('tab', { name: '입고 완료 1건' }));
    fireEvent.click(screen.getByRole('button', { name: '입고 취소' }));
    expect(mock.revert).not.toHaveBeenCalled();
    let host = modalForTitle('입고 취소');
    expect(host.getByText('취소 시, 입고된 재고 수량이 다시 차감됩니다.')).toBeTruthy();
    fireEvent.click(host.getByRole('button', { name: '닫기' }));
    expect(mock.revert).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '입고 취소' }));
    host = modalForTitle('입고 취소');
    fireEvent.click(host.getByRole('button', { name: '입고취소' }));
    fireEvent.click(host.getByRole('button', { name: '입고취소' }));
    expect(mock.revert).toHaveBeenCalledTimes(1);
    expect(mock.revert).toHaveBeenCalledWith({ orderId: 'order-received', ingredientId: 'ingredient-green-onion' }, expect.any(Object));
    mock.revert.mock.calls[0]![1].onError(new Error('되돌림 거절'));
    expect(mock.alert).toHaveBeenLastCalledWith('되돌리지 못했어요', '되돌림 거절');
    expect(mock.cancel).not.toHaveBeenCalled(); expect(mock.confirmInbound).not.toHaveBeenCalled();
  });


  it.each([[390, 1, 'column'], [320, 1, 'column'], [390, 2, 'column']] as const)(
    '주문 입력은 width=%s/fontScale=%s에서 %s이고 값·라벨을 유지한다', (width, fontScale, direction) => {
      mock.dimensions = { ...mock.dimensions, width, fontScale };
      render(<CandidateOrderForm candidate={candidates[0]!} localDate={today} onSaved={mock.saved} />);
      const host = screen;
      chooseOption('양파 1kg');
      expect(getComputedStyle(host.getByTestId('ORD-01/order-fields')).flexDirection).toBe(direction);
      expect(input(host, '발주 수량').value).toBe('1');
      expect(host.getByRole('button', { name: '도착일 2030-07-15 고르기' })).toBeTruthy();
    },
  );

  it('부족량을 선택 옵션 용량으로 환산하고 수동 입력은 재조회로 덮지 않는다', () => {
    const candidate = { ...candidates[0]!, stockTotal: 0, safetyTotal: 3000, perVolume: 1, recommendedQty: 100 };
    mock.detail.mockReturnValue(detailState([{ ...options[0]!, volume: 300 }, options[1]!]));
    const view = render(<CandidateOrderForm candidate={candidate} localDate={today} onSaved={vi.fn()} />);
    const qty = () => screen.getByRole('textbox', { name: '발주 수량' }) as HTMLInputElement;
    chooseOption('양파 1kg');
    expect(qty().value).toBe('10');
    fireEvent.change(qty(), { target: { value: '12' } });
    view.rerender(<CandidateOrderForm candidate={candidate} localDate={today} onSaved={vi.fn()} />);
    expect(qty().value).toBe('12');
    chooseOption('양파 2kg');
    expect(qty().value).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: '발주 완료' }));
    expect(mock.place.mock.calls[0]![0]).toEqual([expect.objectContaining({ volume: 2000, qty: 2, amount: 5500 })]);
  });

  it('옵션이 없거나 미선택이면 입력을 숨기고 부족량 0은 발주하지 않는다', () => {
    mock.detail.mockReturnValue(detailState([]));
    const candidate = { ...candidates[0]!, stockTotal: 3000, safetyTotal: 3000 };
    const view = render(<CandidateOrderForm candidate={candidate} localDate={today} onSaved={vi.fn()} />);
    expect(screen.queryByRole('textbox', { name: '발주 수량' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '발주 완료' }));
    expect(mock.place).not.toHaveBeenCalled();
    mock.detail.mockReturnValue(detailState());
    view.rerender(<CandidateOrderForm candidate={candidate} localDate={today} onSaved={vi.fn()} />);
    expect(screen.queryByRole('textbox', { name: '발주 수량' })).toBeNull();
    chooseOption('양파 1kg');
    expect((screen.getByRole('textbox', { name: '발주 수량' }) as HTMLInputElement).value).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: '발주 완료' }));
    expect(mock.place).not.toHaveBeenCalled();
  });



  it('개수·부피 재료의 발주량에 g 단위를 붙이지 않는다', () => {
    mock.ingredients.mockReturnValue(query([{ id: 'ingredient-onion', baseUnit: 'ea' }]));
    mock.board.mockReturnValue(boardState({ candidates: [], waiting: [{ ...waiting[0]!, name: '계란', volume: 30, amount: 9000, qty: 3, unitPrice: 300 }], received: [] }));
    render(<OrdersHomeScreen />);
    fireEvent.click(screen.getByRole('tab', { name: '입고 예정 1건' }));
    expect(screen.getByText(/총 90개/)).toBeTruthy();
    expect(screen.queryByText(/30g|90g|원\/g/)).toBeNull();
  });

  it('헤더 검색 버튼으로 닫아도 숨은 검색 조건을 남기지 않고 전체 후보를 복원한다', () => {
    render(<OrdersHomeScreen />);
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    fireEvent.change(screen.getByRole('textbox', { name: '재료 이름으로 검색' }), { target: { value: '대파' } });
    expect(screen.queryByRole('button', { name: '양파 상세 보기' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    expect(screen.queryByRole('textbox', { name: '재료 이름으로 검색' })).toBeNull();
    expect(screen.getByRole('button', { name: '양파 상세 보기' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '발주 후보 2건' })).toBeTruthy();
  });

  it('서버 현지 날짜로 3탭·전체 건수를 그리고 검색은 현재 목록만 걸러도 건수는 보존한다', () => {
    render(<OrdersHomeScreen />);
    expect(mock.date).toHaveBeenCalledOnce();
    expect(screen.getByRole('tab', { name: '발주 후보 2건' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '입고 예정 1건' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '입고 완료 1건' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    fireEvent.change(screen.getByRole('textbox', { name: '재료 이름으로 검색' }), { target: { value: '대파' } });
    expect(screen.getByRole('button', { name: '대파 상세 보기' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '양파 상세 보기' })).toBeNull();
    expect(screen.getByRole('tab', { name: '발주 후보 2건' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '검색 닫기' }));
    fireEvent.click(screen.getByRole('tab', { name: '입고 예정 1건' }));
    expect(screen.queryByText('도착일')).toBeNull();
    expect(screen.getByText('7/13 (1일 지연)')).toBeTruthy();
    expect(screen.getByText('중앙상회')).toBeTruthy();
    expect(screen.queryByText('3.00원/g')).toBeNull();
    expect(screen.getByText('15,000원')).toBeTruthy();
    expect(screen.getByText('총 5kg')).toBeTruthy();
    expect(screen.queryByText('1kg × 5개')).toBeNull();
    expect(screen.getByText('부분입고 2/5')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '입고 완료 1건' }));
    expect(screen.getByRole('button', { name: '대파 상세 보기' })).toBeTruthy();
  });

  it('선택한 구매 옵션·수량·서버 날짜를 정확한 발주 payload로 보내고 성공 후에만 입고 예정으로 이동한다', () => {
    render(<CandidateOrderForm candidate={candidates[0]!} localDate={today} onSaved={mock.saved} />);
    const host = screen;
    expect(host.queryByRole('textbox', { name: '발주 수량' })).toBeNull();
    chooseOption('양파 2kg');
    fill(host, '발주 수량', '4');
    chooseArrivalDay(16);
    fireEvent.click(host.getByRole('button', { name: '발주 완료' }));

    expect(mock.place).toHaveBeenCalledWith([{
      ingredientId: 'ingredient-onion', vendorId: 'vendor-two', volume: 2000,
      amount: 5500, qty: 4, expectedAt: '2030-07-16',
    }], expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }));
    expect(mock.saved).not.toHaveBeenCalled();
    const callbacks = mock.place.mock.calls[0]![1] as MutationCallbacks<void>;
    act(() => callbacks.onSuccess(undefined));
    expect(screen.queryByTestId('orders-modal')).toBeNull();
    expect(mock.saved).toHaveBeenCalledOnce();
  });

  it('선택한 o2가 refetch에서 사라지면 o1으로 fallback하지 않고 선택 없음으로 발주를 막는다', () => {
    let liveOptions = options;
    mock.detail.mockImplementation(() => detailState(liveOptions));
    const view = render(<CandidateOrderForm candidate={candidates[0]!} localDate={today} onSaved={mock.saved} />);
    let host = screen;
    chooseOption('양파 2kg');
    expect(host.getByText('5,500원')).toBeTruthy();

    liveOptions = [options[0]!];
    view.rerender(<CandidateOrderForm candidate={candidates[0]!} localDate={today} onSaved={mock.saved} />);
    host = screen;
    expect(host.queryByRole('button', { name: '양파 2kg' })).toBeNull();
    expect(host.getByRole('button', { name: '구매처 선택' }).textContent).toContain('미 선택');
    const submit = host.getByRole('button', { name: '발주 완료' });
    expect(submit.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(submit);
    expect(mock.place).not.toHaveBeenCalled();
    expect(host.getByRole('alert').textContent).toContain('구매 링크를 다시 선택');
    expect(host.queryByText('3,000원')).toBeNull();
    chooseOption('양파 1kg');
    expect(host.queryByRole('alert')).toBeNull();
    expect(host.getByText('3,000원')).toBeTruthy();
    fireEvent.click(host.getByRole('button', { name: '발주 완료' }));
    expect(mock.place.mock.calls[0]![0]).toEqual([{
      ingredientId: 'ingredient-onion', vendorId: 'vendor-one', volume: 1000,
      amount: 3000, qty: 1, expectedAt: '2030-07-15',
    }]);
  });

  it('초기에는 미선택이고 명시적으로 고른 옵션의 갱신값을 사용한다', () => {
    let liveOptions = options;
    mock.detail.mockImplementation(() => detailState(liveOptions));
    const view = render(<CandidateOrderForm candidate={candidates[0]!} localDate={today} onSaved={mock.saved} />);
    let host = screen;
    expect(host.getByRole('button', { name: '구매처 선택' }).textContent).toContain('미 선택');
    expect(host.queryByText('3,000원')).toBeNull();
    chooseOption('양파 2kg');
    liveOptions = [options[0]!, { ...options[1]!, amount: 6000 }];
    view.rerender(<CandidateOrderForm candidate={candidates[0]!} localDate={today} onSaved={mock.saved} />);
    host = screen;
    expect(host.getByRole('button', { name: '구매처 선택' }).textContent).toContain('양파 2kg');
    expect(host.getByText('6,000원')).toBeTruthy();
    fireEvent.click(host.getByRole('button', { name: '발주 완료' }));
    expect(mock.place.mock.calls[0]![0][0]).toMatchObject({ vendorId: 'vendor-two', amount: 6000, volume: 2000 });
  });





  it('입고 완료 페이지는 발주값을 그대로 채우고 구매 링크 없이 수량·도착일을 수정한다', async () => {
    const saved = vi.fn();
    await act(async () => render(<InboundOrderForm initialOrder={waiting[0]!} localDate={today} onSaved={saved} />));
    expect(screen.getByText('중앙상회')).toBeTruthy();
    expect(screen.getByText('1kg')).toBeTruthy();
    expect(screen.getByText('9,000원')).toBeTruthy();
    expect(screen.queryByText('구매 링크')).toBeNull();
    expect((screen.getByRole('textbox', { name: '입고 수량' }) as HTMLInputElement).value).toBe('3');
    expect(screen.getByRole('button', { name: '도착일 2030-07-13 고르기' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: '입고 수량' }), { target: { value: '2' } });
    expect(screen.getByText('2kg')).toBeTruthy();
    expect(screen.getByText('6,000원')).toBeTruthy();
    const results = screen.getByTestId('ORD-03/results');
    expect(getComputedStyle(results).flexDirection).toBe('column');
    expect(results.textContent).toMatch(/총 입고량.*입고 후 재고.*입고 금액.*입고 후 단가/);
    expect(within(results).getByText('입고 후 재고')).toBeTruthy();
    expect(within(results).getByText('3.5kg')).toBeTruthy();
    expect(within(results).getByText('입고 후 단가')).toBeTruthy();
    expect(within(results).getByText('3.25원/g')).toBeTruthy();
    expect(screen.getByText('현재 재고')).toBeTruthy();
    expect(screen.getByText('최소재고')).toBeTruthy();
    expect(screen.getByText('1.2kg')).toBeTruthy();
    expect(screen.queryByText('단가')).toBeNull();
    expect(screen.queryByText(/13\.00원\/g → 13\.00원\/g/)).toBeNull();
    expect(screen.queryByText('저장하면 재고와 단가가 바뀌고 연결된 메뉴 원가도 다시 계산돼요.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '입고 완료' }));
    expect(mock.confirmInbound).toHaveBeenCalledWith({
      orderId: 'order-waiting', ingredientId: 'ingredient-onion', actualQty: 2,
      idempotencyKey: 'inbound-key-order-waiting', occurredDate: '2030-07-13', occurredTime: '14:30',
    }, expect.any(Object));
    const callbacks = mock.confirmInbound.mock.calls[0]![1] as MutationCallbacks<ConfirmInboundResult>;
    act(() => callbacks.onSuccess({
      orderId: 'order-waiting', receivedQty: 2, unitPrice: 3,
      priceSpike: true, duplicate: false, alreadyReceived: false,
    }));
    expect(mock.alert).not.toHaveBeenCalled();
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('입고 완료 페이지는 잔여량 초과를 막고 미래 도착일을 달력에서 비활성화한다', async () => {
    await act(async () => render(<InboundOrderForm initialOrder={waiting[0]!} localDate={today} onSaved={vi.fn()} />));
    fireEvent.change(screen.getByRole('textbox', { name: '입고 수량' }), { target: { value: '4' } });
    expect(screen.getByText('남은 입고 수량 3개 이하로 입력해 주세요.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '도착일 2030-07-13 고르기' }));
    expect(modalForTitle('도착일 선택').getByRole('button', { name: '15일 선택' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '입고 완료' }));
    expect(mock.confirmInbound).not.toHaveBeenCalled();
    expect(mock.preview.mock.calls.at(-1)![3]).toBe(0);
  });

  it('일괄 발주는 선택한 구매 옵션과 각 카드 수량·도착일을 한 E7 요청에 담는다', async () => {
    await act(async () => render(<BulkOrderScreen />));
    expect(screen.getByText('2건')).toBeTruthy();
    expect(screen.getByRole('button', { name: '양파 발주 카드 삭제' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '대파 발주 카드 삭제' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '양파 구매처 선택' }));
    fireEvent.click(modalForTitle('구매처 선택').getByRole('button', { name: '양파 1kg 구매처 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '대파 구매처 선택' }));
    fireEvent.click(modalForTitle('구매처 선택').getByRole('button', { name: '양파 2kg 구매처 선택' }));
    fireEvent.change(screen.getByRole('textbox', { name: '대파 발주 수량' }), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: '공통 도착일 하루 늦추기' }));
    fireEvent.click(screen.getByRole('button', { name: '2건 일괄 발주' }));
    expect(mock.place).toHaveBeenCalledWith([
      { ingredientId: 'ingredient-onion', vendorId: 'vendor-one', volume: 1000, amount: 3000, qty: 1, expectedAt: '2030-07-16' },
      { ingredientId: 'ingredient-green-onion', vendorId: 'vendor-two', volume: 2000, amount: 5500, qty: 2, expectedAt: '2030-07-16' },
    ], expect.any(Object));
  });

  it('일괄 발주는 옵션 재조회 뒤 화면·합계·저장에 같은 최신 값을 사용한다', async () => {
    let liveOptions = options;
    mock.board.mockReturnValue(boardState({ candidates: [candidates[0]!], waiting, received }));
    mock.detail.mockImplementation(() => detailState(liveOptions));
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<BulkOrderScreen />); });
    fireEvent.click(screen.getByRole('button', { name: '양파 구매처 선택' }));
    fireEvent.click(modalForTitle('구매처 선택').getByRole('button', { name: '양파 1kg 구매처 선택' }));

    liveOptions = [{ ...options[0]!, amount: 4200, volume: 1200 }, options[1]!];
    await act(async () => { view.rerender(<BulkOrderScreen />); });
    expect(screen.getByText('1.2kg')).toBeTruthy();
    expect(screen.getAllByText('4,200원').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '1건 일괄 발주' }));
    expect(mock.place).toHaveBeenCalledWith([
      { ingredientId: 'ingredient-onion', vendorId: 'vendor-one', volume: 1200, amount: 4200, qty: 1, expectedAt: '2030-07-15' },
    ], expect.any(Object));
  });

  it('재조회에서 발주 후보가 사라지면 보이지 않는 초안도 함께 제거한다', async () => {
    let liveBoard: OrderBoard = { candidates, waiting, received };
    mock.board.mockImplementation(() => boardState(liveBoard));
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<BulkOrderScreen />); });
    expect(screen.getByText('2건')).toBeTruthy();

    liveBoard = { candidates: [candidates[0]!], waiting, received };
    await act(async () => { view.rerender(<BulkOrderScreen />); });
    expect(screen.getByText('1건')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '대파 발주 카드 삭제' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '양파 구매처 선택' }));
    fireEvent.click(modalForTitle('구매처 선택').getByRole('button', { name: '양파 1kg 구매처 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '1건 일괄 발주' }));
    expect(mock.place).toHaveBeenCalledWith([
      { ingredientId: 'ingredient-onion', vendorId: 'vendor-one', volume: 1000, amount: 3000, qty: 1, expectedAt: '2030-07-15' },
    ], expect.any(Object));
  });

  it('발주 후보가 20개를 넘으면 한 번에 표시하는 제한을 안내한다', async () => {
    const manyCandidates = Array.from({ length: 21 }, (_, index) => ({
      ...candidates[0]!, ingredientId: `ingredient-${index}`, name: `재료 ${index + 1}`,
    }));
    mock.board.mockReturnValue(boardState({ candidates: manyCandidates, waiting, received }));
    await act(async () => render(<BulkOrderScreen />));
    expect(screen.getByRole('alert').textContent).toContain('후보 21개 중 20개까지');
    expect(screen.getByText('20건')).toBeTruthy();
  });

});
