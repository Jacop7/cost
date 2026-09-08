import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrdersHomeScreen from '@/features/orders/screens/OrdersHomeScreen';
import type { OrderBoard, OrderCandidate, OrderRecord } from '@/features/orders/hooks';
import type { PurchaseOption } from '@/features/ingredients/hooks';

const mock = vi.hoisted(() => ({
  board: vi.fn(), detail: vi.fn(), date: vi.fn(),
  place: vi.fn(), confirmInbound: vi.fn(), cancel: vi.fn(), revert: vi.fn(),
  push: vi.fn(), alert: vi.fn(), makeInboundKey: vi.fn(),
  placePending: false, inboundPending: false,
  dimensions: { width: 390, height: 844, scale: 1, fontScale: 1 },
}));

vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => mock.dimensions,
    Alert: { ...rn.Alert, alert: mock.alert },
    // Native Modal visibility alone is adapted for jsdom. The actual
    // OrdersHomeScreen and kit Sheet/Input/Button hosts remain in the test.
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
      visible ? <div data-testid="orders-modal">{children}</div> : null,
  };
});
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock('@/features/business-day/businessDay', () => ({ useStoreLocalDate: mock.date }));
vi.mock('@/features/orders/hooks', () => ({
  useOrderBoard: mock.board,
  usePlaceOrders: () => ({ mutate: mock.place, isPending: mock.placePending }),
  useConfirmInbound: () => ({ mutate: mock.confirmInbound, isPending: mock.inboundPending }),
  useCancelOrder: () => ({ mutate: mock.cancel, isPending: false }),
  useRevertInbound: () => ({ mutate: mock.revert, isPending: false }),
}));
vi.mock('@/features/ingredients/hooks', () => ({ useIngredientDetail: mock.detail }));
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
    orderedAt: '2030-07-12T04:00:00Z', expectedAt: '2030-07-13', unitPrice: 4 },
];
const options: PurchaseOption[] = [
  { id: 'option-one', url: null, name: '양파 1kg', volume: 1000, amount: 3000,
    vendorId: 'vendor-one', vendorName: '중앙상회', brandId: null, brandName: null },
  { id: 'option-two', url: null, name: '양파 2kg', volume: 2000, amount: 5500,
    vendorId: 'vendor-two', vendorName: '농산물직송', brandId: null, brandName: null },
];

const query = <T,>(data: T) => ({ data, isLoading: false, error: null, refetch: vi.fn() });
const boardState = (data: OrderBoard = { candidates, waiting, received }) => query(data);
const detailState = (liveOptions: PurchaseOption[] = options) => query({
  id: 'ingredient-onion', name: '양파', baseUnit: 'g', options: liveOptions,
});
const modalForTitle = (title: string) => {
  const node = screen.getAllByTestId('orders-modal').find((candidate) =>
    within(candidate).queryByText(title) !== null,
  );
  if (!node) throw new Error(`${title} modal not found`);
  return within(node);
};
const input = (host: ReturnType<typeof modalForTitle>, name: string) =>
  host.getByRole('textbox', { name }) as HTMLInputElement;
const fill = (host: ReturnType<typeof modalForTitle>, name: string, value: string) =>
  fireEvent.change(input(host, name), { target: { value } });

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
    mock.placePending = false; mock.inboundPending = false;
    mock.dimensions = { width: 390, height: 844, scale: 1, fontScale: 1 };
    mock.date.mockReturnValue({ date: today, isLoading: false, error: null, refetch: vi.fn() });
    mock.board.mockReturnValue(boardState());
    mock.detail.mockReturnValue(detailState());
    mock.makeInboundKey.mockReturnValue('inbound-key-order-waiting');
  });

  afterEach(cleanup);

  it('발주 취소는 확인 전 mutation이 없고 지정 orderId만 보내며 실패를 알린다', () => {
    mock.board.mockReturnValue(boardState({ candidates, waiting: [{ ...waiting[0]!, receivedQty: 0, status: 'ordered' }], received }));
    render(<OrdersHomeScreen />);
    fireEvent.click(screen.getByRole('tab', { name: '입고 예정 1건' }));
    fireEvent.click(screen.getByRole('button', { name: '발주 취소' }));
    expect(mock.cancel).not.toHaveBeenCalled();
    expect(mock.alert.mock.calls[0]![0]).toBe('양파 발주 취소');
    const buttons = mock.alert.mock.calls[0]![2] as { text: string; style?: string; onPress?: () => void }[];
    expect(buttons.map(({ text, style }) => ({ text, style }))).toEqual([
      { text: '닫기', style: 'cancel' }, { text: '발주 취소', style: 'destructive' },
    ]);
    buttons[0]!.onPress?.(); expect(mock.cancel).not.toHaveBeenCalled();
    buttons[1]!.onPress!();
    expect(mock.cancel).toHaveBeenCalledWith({ orderId: 'order-waiting' }, expect.any(Object));
    mock.cancel.mock.calls[0]![1].onError(new Error('취소 거절'));
    expect(mock.alert).toHaveBeenLastCalledWith('취소하지 못했어요', '취소 거절');
    expect(mock.revert).not.toHaveBeenCalled(); expect(mock.confirmInbound).not.toHaveBeenCalled();
  });

  it('입고 취소는 영향 안내와 별도 확인 뒤 해당 orderId/ingredientId만 보낸다', () => {
    render(<OrdersHomeScreen />);
    fireEvent.click(screen.getByRole('tab', { name: '입고 완료 1건' }));
    fireEvent.click(screen.getByRole('button', { name: '입고 취소' }));
    expect(mock.revert).not.toHaveBeenCalled();
    expect(mock.alert.mock.calls[0]!.slice(0, 2)).toEqual([
      '대파 입고 취소', '재고와 기준단가가 입고 전으로 되돌아가요. 이 재료를 쓰는 메뉴 원가도 함께 바뀝니다.',
    ]);
    const buttons = mock.alert.mock.calls[0]![2] as { text: string; style?: string; onPress?: () => void }[];
    expect(buttons[0]).toMatchObject({ text: '닫기', style: 'cancel' });
    expect(buttons[1]).toMatchObject({ text: '입고 취소', style: 'destructive' });
    buttons[0]!.onPress?.(); expect(mock.revert).not.toHaveBeenCalled();
    buttons[1]!.onPress!();
    expect(mock.revert).toHaveBeenCalledWith({ orderId: 'order-received', ingredientId: 'ingredient-green-onion' }, expect.any(Object));
    mock.revert.mock.calls[0]![1].onError(new Error('되돌림 거절'));
    expect(mock.alert).toHaveBeenLastCalledWith('되돌리지 못했어요', '되돌림 거절');
    expect(mock.cancel).not.toHaveBeenCalled(); expect(mock.confirmInbound).not.toHaveBeenCalled();
  });

  it.each([[false, true, 1], [true, true, 0], [false, false, 0]] as const)(
    '입고 서버 응답 duplicate=%s/priceSpike=%s에서 단가 급등 알림 %s회, 시트 닫힘', (duplicate, priceSpike, alerts) => {
      render(<OrdersHomeScreen />);
      fireEvent.click(screen.getByRole('tab', { name: '입고 예정 1건' }));
      fireEvent.click(screen.getByRole('button', { name: '입고 완료' }));
      fireEvent.click(modalForTitle('입고 완료').getByRole('button', { name: '입고 확정' }));
      const callbacks = mock.confirmInbound.mock.calls[0]![1];
      act(() => callbacks.onSuccess({ duplicate, priceSpike }));
      expect(screen.queryByTestId('orders-modal')).toBeNull();
      expect(mock.alert).toHaveBeenCalledTimes(alerts);
      if (alerts) expect(mock.alert).toHaveBeenCalledWith('입고 단가가 크게 올랐어요', expect.stringContaining('양파 단가가 직전 평균보다 20% 이상'), [{ text: '확인' }]);
      expect(mock.confirmInbound).toHaveBeenCalledTimes(1);
      expect(mock.cancel).not.toHaveBeenCalled(); expect(mock.revert).not.toHaveBeenCalled();
    },
  );

  it.each([[390, 1, 'row'], [320, 1, 'column'], [390, 2, 'column']] as const)(
    '주문 입력은 width=%s/fontScale=%s에서 %s이고 값·라벨을 유지한다', (width, fontScale, direction) => {
      mock.dimensions = { ...mock.dimensions, width, fontScale };
      render(<OrdersHomeScreen />);
      fireEvent.click(screen.getAllByRole('button', { name: '주문하기' })[0]!);
      const host = modalForTitle('주문하기');
      expect(getComputedStyle(host.getByTestId('ORD-01/order-fields')).flexDirection).toBe(direction);
      expect(input(host, '발주 수량').value).toBe('3');
      expect(input(host, '도착까지 일수').value).toBe('1');
    },
  );

  it('입고 취소·확정은 동일 폭 슬롯이며 취소는 저장하지 않고 시트만 닫는다', () => {
    render(<OrdersHomeScreen />);
    fireEvent.click(screen.getByRole('tab', { name: '입고 예정 1건' }));
    fireEvent.click(screen.getByRole('button', { name: '입고 완료' }));
    const host = modalForTitle('입고 완료');
    const cancel = host.getByRole('button', { name: '취소' });
    const confirm = host.getByRole('button', { name: '입고 확정' });
    expect(cancel.parentElement).toBe(confirm.parentElement);
    expect(getComputedStyle(cancel).flexGrow).toBe('1');
    expect(getComputedStyle(confirm).flexGrow).toBe('1');
    expect(host.getByText('양파 · 발주 5개')).toBeTruthy();
    fireEvent.click(cancel);
    expect(screen.queryByTestId('orders-modal')).toBeNull();
    expect(mock.confirmInbound).not.toHaveBeenCalled();
  });

  it('헤더 검색 버튼으로 닫아도 숨은 검색 조건을 남기지 않고 전체 후보를 복원한다', () => {
    render(<OrdersHomeScreen />);
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    fireEvent.change(screen.getByRole('textbox', { name: '식재료 이름으로 검색' }), { target: { value: '대파' } });
    expect(screen.queryByRole('button', { name: '양파 상세' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    expect(screen.queryByRole('textbox', { name: '식재료 이름으로 검색' })).toBeNull();
    expect(screen.getByRole('button', { name: '양파 상세' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '발주 후보 2건' })).toBeTruthy();
  });

  it('서버 현지 날짜로 3탭·전체 건수를 그리고 검색은 현재 목록만 걸러도 건수는 보존한다', () => {
    render(<OrdersHomeScreen />);
    expect(mock.date).toHaveBeenCalledOnce();
    expect(screen.getByRole('tab', { name: '발주 후보 2건' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '입고 예정 1건' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '입고 완료 1건' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    fireEvent.change(screen.getByRole('textbox', { name: '식재료 이름으로 검색' }), { target: { value: '대파' } });
    expect(screen.getByRole('button', { name: '대파 상세' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '양파 상세' })).toBeNull();
    expect(screen.getByRole('tab', { name: '발주 후보 2건' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '검색 닫기' }));
    fireEvent.click(screen.getByRole('tab', { name: '입고 예정 1건' }));
    expect(screen.getByText('1일 지연 (7/13)')).toBeTruthy();
    expect(screen.getByText('부분입고 2/5')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '입고 완료 1건' }));
    expect(screen.getByRole('button', { name: '대파 상세' })).toBeTruthy();
  });

  it('선택한 구매 옵션·수량·서버 날짜를 정확한 발주 payload로 보내고 성공 후에만 입고 예정으로 이동한다', () => {
    render(<OrdersHomeScreen />);
    fireEvent.click(screen.getAllByRole('button', { name: '주문하기' })[0]!);
    const host = modalForTitle('주문하기');
    expect(input(host, '발주 수량').value).toBe('3');
    fireEvent.click(host.getByRole('button', { name: '양파 2kg' }));
    fill(host, '발주 수량', '4');
    fill(host, '도착까지 일수', '2');
    fireEvent.click(host.getByRole('button', { name: '발주 등록' }));

    expect(mock.place).toHaveBeenCalledWith([{
      ingredientId: 'ingredient-onion', vendorId: 'vendor-two', volume: 2000,
      amount: 5500, qty: 4, expectedAt: '2030-07-16',
    }], expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }));
    expect(screen.getByTestId('orders-modal')).toBeTruthy();
    const callbacks = mock.place.mock.calls[0]![1] as MutationCallbacks<void>;
    act(() => callbacks.onSuccess(undefined));
    expect(screen.queryByTestId('orders-modal')).toBeNull();
    expect(screen.getByRole('tab', { name: '입고 예정 1건' })).toBeTruthy();
    expect(screen.getByText('1일 지연 (7/13)')).toBeTruthy();
  });

  it('선택한 o2가 refetch에서 사라지면 o1으로 fallback하지 않고 선택 없음으로 발주를 막는다', () => {
    let liveOptions = options;
    mock.detail.mockImplementation(() => detailState(liveOptions));
    const view = render(<OrdersHomeScreen />);
    fireEvent.click(screen.getAllByRole('button', { name: '주문하기' })[0]!);
    let host = modalForTitle('주문하기');
    fireEvent.click(host.getByRole('button', { name: '양파 2kg' }));
    expect(host.getByText('16,500원')).toBeTruthy();

    liveOptions = [options[0]!];
    view.rerender(<OrdersHomeScreen />);
    host = modalForTitle('주문하기');
    expect(host.queryByRole('button', { name: '양파 2kg' })).toBeNull();
    expect(host.getByRole('button', { name: '양파 1kg' }).getAttribute('aria-pressed')).toBe('false');
    const submit = host.getByRole('button', { name: '발주 등록' });
    expect(submit.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(submit);
    expect(mock.place).not.toHaveBeenCalled();
    expect(host.getByRole('alert').textContent).toContain('구매 옵션을 다시 선택');
    expect(host.queryByText('9,000원')).toBeNull();
    fireEvent.click(host.getByRole('button', { name: '양파 1kg' }));
    expect(host.queryByRole('alert')).toBeNull();
    expect(host.getByText('9,000원')).toBeTruthy();
    fireEvent.click(host.getByRole('button', { name: '발주 등록' }));
    expect(mock.place.mock.calls[0]![0]).toEqual([{
      ingredientId: 'ingredient-onion', vendorId: 'vendor-one', volume: 1000,
      amount: 3000, qty: 3, expectedAt: '2030-07-15',
    }]);
  });

  it('초기 기본 옵션은 선택 표시·금액·payload가 같고 같은 ID의 갱신값을 사용한다', () => {
    let liveOptions = options;
    mock.detail.mockImplementation(() => detailState(liveOptions));
    const view = render(<OrdersHomeScreen />);
    fireEvent.click(screen.getAllByRole('button', { name: '주문하기' })[0]!);
    let host = modalForTitle('주문하기');
    expect(host.getByRole('button', { name: '양파 1kg' }).getAttribute('aria-pressed')).toBe('true');
    expect(host.getByText('9,000원')).toBeTruthy();
    fireEvent.click(host.getByRole('button', { name: '양파 2kg' }));
    liveOptions = [options[0]!, { ...options[1]!, amount: 6000 }];
    view.rerender(<OrdersHomeScreen />);
    host = modalForTitle('주문하기');
    expect(host.getByRole('button', { name: '양파 2kg' }).getAttribute('aria-pressed')).toBe('true');
    expect(host.getByText('18,000원')).toBeTruthy();
    fireEvent.click(host.getByRole('button', { name: '발주 등록' }));
    expect(mock.place.mock.calls[0]![0][0]).toMatchObject({ vendorId: 'vendor-two', amount: 6000, volume: 2000 });
  });

  it('입고 실패 후 같은 시트에서 재시도하면 실제 잔여 수량과 처음 발급한 멱등키를 그대로 재사용한다', () => {
    render(<OrdersHomeScreen />);
    fireEvent.click(screen.getByRole('tab', { name: '입고 예정 1건' }));
    fireEvent.click(screen.getByRole('button', { name: '입고 완료' }));
    let host = modalForTitle('입고 완료');
    expect(input(host, '실제 입고 수량').value).toBe('3');
    fireEvent.click(host.getByRole('button', { name: '입고 확정' }));
    expect(mock.makeInboundKey).toHaveBeenCalledTimes(1);
    expect(mock.makeInboundKey).toHaveBeenCalledWith('order-waiting');
    const expectedPayload = {
      orderId: 'order-waiting', ingredientId: 'ingredient-onion', actualQty: 3,
      idempotencyKey: 'inbound-key-order-waiting',
    };
    expect(mock.confirmInbound).toHaveBeenNthCalledWith(1, expectedPayload, expect.any(Object));

    const firstCallbacks = mock.confirmInbound.mock.calls[0]![1] as MutationCallbacks;
    act(() => firstCallbacks.onError(new Error('입고 실패 fixture')));
    expect(mock.alert).toHaveBeenLastCalledWith('입고하지 못했어요', '입고 실패 fixture');
    host = modalForTitle('입고 완료');
    expect(input(host, '실제 입고 수량').value).toBe('3');
    fireEvent.click(host.getByRole('button', { name: '입고 확정' }));
    expect(mock.confirmInbound).toHaveBeenNthCalledWith(2, expectedPayload, expect.any(Object));
    expect(mock.makeInboundKey).toHaveBeenCalledTimes(1);
  });
});
