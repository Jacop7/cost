import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Alert, Linking } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IngredientDetailScreen } from '@/features/ingredients/screens/IngredientDetailScreen';
import type { IngredientDetail } from '@/features/ingredients/hooks';

// 서버가 제공한 매장 시간대 fixture. 기기 시간대는 사용하지 않는다.
vi.mock('@/features/business-day/businessDay', () => ({
  useBusinessDay: () => ({ data: { timezone: 'Asia/Seoul' } }),
}));

const mock = vi.hoisted(() => ({
  detail: vi.fn(), history: vi.fn(), save: vi.fn(), stock: vi.fn(), deactivate: vi.fn(),
  push: vi.fn(), replace: vi.fn(), back: vi.fn(), pending: false, routeId: 'g1',
}));
// Actual host, MemoEditSheet, ActionSheet and kit controls. Modal visibility alone
// is stubbed; jsdom does not certify native/web animation, geometry, focus or IME.
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
    visible ? <div data-testid="detail-memo-modal">{children}</div> : null };
});
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mock.routeId }), useRouter: () => ({ push: mock.push }),
  router: { canGoBack: () => false, replace: mock.replace, back: mock.back },
}));
vi.mock('@/features/ingredients/hooks', () => ({
  useIngredientDetail: mock.detail, useStockHistory: mock.history,
  useSaveIngredientMemo: () => ({ mutate: mock.save, isPending: mock.pending }),
  useStockChange: () => ({ mutate: mock.stock, isPending: false }),
  useDeactivateIngredient: () => ({ mutate: mock.deactivate, isPending: false }),
}));

const ingredient: IngredientDetail = {
  id: 'g1', name: '검수 대파', categoryId: 'c1', categoryName: '농산', baseUnit: 'g',
  perVolume: 1250, safetyStock: 2300, vendorName: '검수 거래처', defaultVendorId: 'v1',
  minOrderQty: 3, memo: '서버 원본 메모', stockTotal: 5000, basePrice: 4, soonOut: false,
  lastInboundAt: null, options: [], orders: [], priceTrends: [],
  lastChange: { occurredAt: '2030-07-15T01:00:00Z', eventId: null, displayState: null, hasHistory: false },
  purchase: { avg: null, low: null, high: null, count: 0 },
  loss: { purchased: 0, storageAmount: 0, cookingAmount: 0, storageCount: 0, cookingCount: 0,
    totalAmount: 0, totalCost: null, rate: null, storageRate: null, cookingRate: null },
};
const state = (data: IngredientDetail) => ({ data, isLoading: false, isFetched: true, error: null, refetch: vi.fn() });
const payload = (memo: string | null, expectedMemo: string | null = ingredient.memo) =>
  ({ id: 'g1', memo: memo ?? '', expectedMemo });
type Callbacks = { onSuccess: () => void; onError: (error: unknown) => void };
type Entry = 'direct' | 'menu';
const modal = () => within(screen.getByTestId('detail-memo-modal'));
const input = () => modal().getByRole('textbox', { name: '메모' }) as HTMLTextAreaElement;
function open(entry: Entry) {
  if (entry === 'menu') {
    fireEvent.click(screen.getByRole('button', { name: '수정 메뉴 열기' }));
    fireEvent.click(modal().getByRole('button', { name: '메모 수정' }));
  } else fireEvent.click(screen.getByRole('button', { name: '메모 수정' }));
  expect(screen.getAllByTestId('detail-memo-modal')).toHaveLength(1);
  expect(modal().getByText('메모 수정')).toBeTruthy();
  expect(modal().queryByRole('button', { name: '식재료 삭제' })).toBeNull();
}
function expectNoOtherActions() {
  expect(mock.stock).not.toHaveBeenCalled(); expect(mock.deactivate).not.toHaveBeenCalled();
  expect(mock.push).not.toHaveBeenCalled(); expect(mock.replace).not.toHaveBeenCalled(); expect(mock.back).not.toHaveBeenCalled();
}

describe('ING03 실제 상세 화면의 공용 메모 저장 계약', () => {
  it('최신 캐시가 없는 충돌도 재조회·명시적 확인 후 같은 초안을 저장한다', async () => {
    const refetch = vi.fn().mockResolvedValue({ data: { ...ingredient, memo: '서버의 새 메모' }, error: null });
    mock.detail.mockReturnValue({ ...state(ingredient), refetch });
    mock.save.mockImplementationOnce((_next: unknown, cb: Callbacks) => cb.onError(Object.assign(new Error('충돌'), { code: '40001' })));
    render(<IngredientDetailScreen />); open('direct');
    fireEvent.change(input(), { target: { value: '내 초안' } });
    fireEvent.click(modal().getByRole('button', { name: '완료' }));
    await waitFor(() => expect(refetch).toHaveBeenCalledOnce());
    await screen.findByText('서버의 새 메모');
    expect(mock.save).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '확인 후 계속 수정' }));
    expect(input().value).toBe('내 초안');
    fireEvent.click(modal().getByRole('button', { name: '완료' }));
    expect(mock.save.mock.calls[1]?.[0]).toEqual(payload('내 초안', '서버의 새 메모'));
  });
  beforeEach(() => {
    vi.resetAllMocks(); mock.pending = false; mock.routeId = 'g1';
    mock.detail.mockReturnValue(state(ingredient));
    mock.history.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() });
    // Observe the Alert API contract only. The root installWebAlert bridge and
    // browser dialogs are intentionally not executed or declared working/broken.
    vi.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  for (const action of ['열기', '수정'] as const) {
    it(`구매 링크 행은 먼저 팝업을 열고 명시적 ${action}만 실행한다`, () => {
      const openUrl = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      mock.detail.mockReturnValue(state({ ...ingredient, options: [{ id: 'o1', name: '대파 1kg', vendorId: 'v1', vendorName: '검수 구매처', brandId: null, brandName: null, volume: 1000, amount: 4000, url: 'example.com/item' }] }));
      render(<IngredientDetailScreen />);
      fireEvent.click(screen.getByRole('button', { name: '검수 구매처 구매 링크 메뉴' }));
      expect(openUrl).not.toHaveBeenCalled(); expect(mock.push).not.toHaveBeenCalled();
      expect(modal().getByRole('button', { name: '구매 링크 열기' })).toBeTruthy();
      expect(modal().getByRole('button', { name: '구매 링크 수정' })).toBeTruthy();
      fireEvent.click(modal().getByRole('button', { name: `구매 링크 ${action}` }));
      if (action === '열기') expect(openUrl).toHaveBeenCalledWith('https://example.com/item');
      else expect(mock.push).toHaveBeenCalledWith('/ingredients/option?ingredient=g1&option=o1');
      expect(mock.save).not.toHaveBeenCalled();
    });
  }

  it('상단 수정 메뉴는 텍스트 없이 아이콘만 표시하고 접근성 이름과 메뉴 동작을 유지한다', () => {
    render(<IngredientDetailScreen />);
    const button = screen.getByRole('button', { name: '수정 메뉴 열기' });
    expect(button.textContent).toBe('');
    fireEvent.click(button);
    expect(modal().getByRole('button', { name: '식재료 수정' })).toBeTruthy();
  });

  it('수정 메뉴 5행 순서, 재고 페이지 연결, 삭제 확인 취소/명시적 확정', () => {
    render(<IngredientDetailScreen />);
    const openMenu = () => fireEvent.click(screen.getByRole('button', { name: '수정 메뉴 열기' }));
    openMenu();
    expect(modal().getAllByRole('button').map(b => b.textContent).filter(Boolean)).toEqual(['식재료 수정', '재고 수정', '메모 수정', '구매 링크 수정', '식재료 삭제', '닫기']);
    fireEvent.click(modal().getByRole('button', { name: '재고 수정' }));
    expect(mock.push).toHaveBeenCalledWith('/ingredients/add-stock/g1'); expect(mock.stock).not.toHaveBeenCalled();
    openMenu(); fireEvent.click(modal().getByRole('button', { name: '식재료 삭제' }));
    expect(modal().getByText('삭제하시겠습니까?')).toBeTruthy();
    expect(modal().getByText('삭제 시, 복구가 불가합니다.')).toBeTruthy(); expect(mock.deactivate).not.toHaveBeenCalled();
    fireEvent.click(modal().getByRole('button', { name: '취소' })); expect(mock.deactivate).not.toHaveBeenCalled();
    openMenu(); fireEvent.click(modal().getByRole('button', { name: '식재료 삭제' }));
    fireEvent.click(modal().getByRole('button', { name: '삭제' })); expect(mock.deactivate).toHaveBeenCalledWith('g1', expect.any(Object));
  });

  for (const memo of [null, '', '   ', '서버 원본 메모']) it(`메모 행: ${JSON.stringify(memo)}는 안내 문구 없이 꺾쇠와 입력 진입을 제공한다`, () => {
    mock.detail.mockReturnValue(state({ ...ingredient, memo }));
    render(<IngredientDetailScreen />);
    const row = screen.getByRole('button', { name: '메모 수정' });
    expect(row.textContent).toBe(memo?.trim() ? `메모${memo}` : '메모');
    // 공통 setup은 SVG 속성을 생략한다. 실제 꺾쇠 경로는 브라우저에서 별도 확인.
    expect(row.querySelectorAll('svg')).toHaveLength(2);
    expect(within(row).queryByText('메모를 입력하세요')).toBeNull();
    fireEvent.click(row);
    expect(input().value).toBe(memo ?? '');
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('프로토타입 순서와 3건 미리보기·전체보기 경로를 실제 상세에서 유지한다', () => {
    const options = Array.from({ length: 4 }, (_, i) => ({ id: `option${i}`, name: `상품${i}`, vendorId: null,
      vendorName: `구매처${i}`, brandId: null, brandName: null, url: null, amount: 4000, volume: 1000 }));
    mock.detail.mockReturnValue(state({ ...ingredient, options }));
    mock.history.mockReturnValue({ data: Array.from({ length: 4 }, (_, i) => ({ id: `e${i}`, date: `2030-07-${15-i}`,
      type: 'consume', countDelta: -100, volumeDelta: null, note: `판매${i}`, balance: 5000 - i*100, waste: false, reverted: false })),
      isLoading: false, error: null, refetch: vi.fn() });
    const { container } = render(<IngredientDetailScreen />);
    const text = container.textContent!;
    expect(text.indexOf('구매 링크')).toBeLessThan(text.indexOf('실입고 기준'));
    expect(text.indexOf('실입고 기준')).toBeLessThan(text.indexOf('재고 내역'));
    expect(screen.queryByText('로스율')).toBeNull();
    expect(screen.queryByText('검수 거래처')).toBeNull();
    expect(screen.queryByText('구매처3')).toBeNull();
    expect(screen.queryByText('판매3')).toBeNull();
    expect(screen.queryByRole('button', { name: '상품0 수정' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '구매 링크 자세히보기' }));
    expect(mock.push).toHaveBeenLastCalledWith('/ingredients/option?ingredient=g1');
    fireEvent.click(screen.getByRole('button', { name: '재고 내역 자세히보기' }));
    expect(mock.push).toHaveBeenLastCalledWith('/ingredients/history/g1');
    fireEvent.click(screen.getByRole('button', { name: '구매 이력 자세히보기' }));
    expect(mock.push).toHaveBeenLastCalledWith('/ingredients/purchases/g1');
    expect(mock.stock).not.toHaveBeenCalled(); expect(mock.save).not.toHaveBeenCalled();
  });

  for (const count of [1, 3, 4]) it(`구매 링크 ${count}개도 자세히보기를 표시하고 관리 화면으로 이동한다`, () => {
    mock.detail.mockReturnValue(state({ ...ingredient, options: Array.from({ length: count }, (_, i) => ({
      id: `o${i}`, name: `옵션${i}`, vendorId: null, vendorName: '구매처', brandId: null, brandName: null,
      url: null, volume: 1000, amount: 64000,
    })) }));
    render(<IngredientDetailScreen />);
    const button = screen.getByRole('button', { name: '구매 링크 자세히보기' });
    expect(button.textContent).toBe('자세히보기');
    expect(screen.queryByText('전체보기')).toBeNull();
    fireEvent.click(button);
    expect(mock.push).toHaveBeenCalledWith('/ingredients/option?ingredient=g1');
  });

  for (const count of [0, 1, 2, 3, 4]) it(`재고 내역 ${count}건: 1건부터 자세히보기를 표시한다`, () => {
    mock.history.mockReturnValue({ data: Array.from({ length: count }, (_, i) => ({
      id: `e${i}`, date: `2030-07-${15-i}`, type: 'consume', countDelta: -100,
      volumeDelta: null, note: `판매${i}`, balance: 5000 - i*100, waste: false, reverted: false,
    })), isLoading: false, error: null, refetch: vi.fn() });
    render(<IngredientDetailScreen />);
    const button = screen.queryByRole('button', { name: '재고 내역 자세히보기' });
    if (count === 0) {
      expect(button).toBeNull();
      expect(screen.getByText('아직 변동 기록이 없어요')).toBeTruthy();
    } else {
      expect(button!.textContent).toBe('자세히보기');
      fireEvent.click(button!);
      expect(mock.push).toHaveBeenCalledWith('/ingredients/history/g1');
    }
    expect(screen.queryByText('판매3')).toBeNull();
    expect(mock.stock).not.toHaveBeenCalled();
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('구매 링크 없음은 추가 진입을 제공하고 음수 재고·0단가를 그대로 표시한다', () => {
    mock.detail.mockReturnValue(state({ ...ingredient, stockTotal: -750, basePrice: 0 }));
    render(<IngredientDetailScreen />);
    expect(screen.getByText('−750g')).toBeTruthy();
    expect(screen.getAllByText('0.00원/g').length).toBeGreaterThan(0);
    expect(screen.getByText('소진')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '구매 링크 추가' }));
    expect(mock.push).toHaveBeenCalledWith('/ingredients/option?ingredient=g1');
    expect(screen.queryByRole('button', { name: '구매 링크 자세히보기' })).toBeNull();
  });

  it('재고 조회 실패를 빈 이력으로 숨기지 않으며 재시도할 수 있다', () => {
    const retry = vi.fn();
    mock.history.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fixture'), refetch: retry });
    render(<IngredientDetailScreen />);
    expect(screen.getByText('정보를 불러오지 못했어요')).toBeTruthy();
    expect(screen.queryByText('아직 변동 기록이 없어요')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  for (const memo of ['서버 원본 메모', '두번째 대상 메모']) {
    it(`대상 ID 변경 (${memo}): 이전 초안을 다른 식재료에 전달하지 않는다`, () => {
      const { rerender } = render(<IngredientDetailScreen />);
      open('direct');
      fireEvent.change(input(), { target: { value: '첫 식재료의 초안' } });
      mock.routeId = 'g2';
      mock.detail.mockReturnValue(state({ ...ingredient, id: 'g2', memo }));
      rerender(<IngredientDetailScreen />);
      expect(screen.queryByTestId('detail-memo-modal')).toBeNull();
      open('direct');
      expect(input().value).toBe(memo);
      fireEvent.click(modal().getByRole('button', { name: '완료' }));
      expect(mock.save).toHaveBeenCalledOnce();
      expect(mock.save.mock.calls[0]?.[0]).toEqual({ ...payload(memo, memo), id: 'g2' });
    });
  }

  for (const entry of ['direct', 'menu'] as const) {
    it(`${entry}: 재조회로 다른 필드·메모가 바뀌어도 편집 시작 CAS값을 유지하며 충돌 초안을 보존한다`, async () => {
      const { rerender } = render(<IngredientDetailScreen />);
      open(entry);
      fireEvent.change(input(), { target: { value: '작성 중 초안' } });
      mock.detail.mockReturnValue(state({ ...ingredient, name: '다른 기기 수정', safetyStock: 9000, memo: '다른 기기 메모' }));
      rerender(<IngredientDetailScreen />);
      mock.save.mockImplementation((_next: unknown, callbacks: Callbacks) => callbacks.onError(
        Object.assign(new Error('다른 곳에서 메모가 변경됐어요. 다시 열어 확인해 주세요.'), { code: '40001' }),
      ));
      fireEvent.click(modal().getByRole('button', { name: '완료' }));
      expect(mock.save.mock.calls[0]?.[0]).toEqual(payload('작성 중 초안'));
      expect(Object.keys(mock.save.mock.calls[0]![0]).sort()).toEqual(['expectedMemo', 'id', 'memo']);
      expect(input().value).toBe('작성 중 초안');
      expect(screen.getByText('다른 곳에서 수정됐어요')).toBeTruthy();
      expect(Alert.alert).not.toHaveBeenCalled();
      await waitFor(() => expect(modal().getByRole('button', { name: '취소' }).getAttribute('aria-disabled')).not.toBe('true'));
      fireEvent.click(modal().getByRole('button', { name: '취소' }));
      open(entry);
      expect(input().value).toBe('다른 기기 메모');
      fireEvent.change(input(), { target: { value: '재확인 후 메모' } });
      fireEvent.click(modal().getByRole('button', { name: '완료' }));
      expect(mock.save.mock.calls[1]?.[0]).toEqual(payload('재확인 후 메모', '다른 기기 메모'));
    });
    it(`${entry}: 배경 재조회가 열린 초안을 덮지 않고 다음 진입에는 최신 메모를 표시한다`, () => {
      const { rerender } = render(<IngredientDetailScreen />);
      open(entry);
      fireEvent.change(input(), { target: { value: '작성 중인 내 메모' } });
      mock.detail.mockReturnValue(state({ ...ingredient, memo: '재조회된 메모' }));
      rerender(<IngredientDetailScreen />);
      expect(input().value).toBe('작성 중인 내 메모');
      expect(mock.save).not.toHaveBeenCalled(); expectNoOtherActions();
      fireEvent.click(modal().getByRole('button', { name: '취소' }));
      open(entry === 'direct' ? 'menu' : 'direct');
      expect(input().value).toBe('재조회된 메모');
    });
    for (const draft of ['  첫 줄\n둘째 줄  ', '   ']) {
      it(`${entry} ${draft.trim() ? 'trim' : 'empty'}: 메모와 편집 시작값만 전송, 성공 때만 닫고 서버 새 값으로 재열기`, () => {
        let callbacks: Callbacks | undefined;
        mock.save.mockImplementation((_next: unknown, next: Callbacks) => { callbacks = next; });
        const { rerender } = render(<IngredientDetailScreen />);
        open(entry); expect(input().value).toBe('서버 원본 메모');
        fireEvent.change(input(), { target: { value: draft } });
        fireEvent.click(modal().getByRole('button', { name: '완료' }));
        expect(mock.save).toHaveBeenCalledOnce();
        expect(mock.save.mock.calls[0]?.[0]).toEqual(payload(draft.trim() || null));
        expect(input().value).toBe(draft); // Completion click alone is not success.
        expect(callbacks).toBeDefined(); act(() => callbacks!.onSuccess());
        expect(screen.queryByTestId('detail-memo-modal')).toBeNull();
        expect(Alert.alert).not.toHaveBeenCalled(); expectNoOtherActions();
        // No local imitation of server persistence: explicitly supply the refetched value.
        mock.detail.mockReturnValue(state({ ...ingredient, memo: draft.trim() || null }));
        rerender(<IngredientDetailScreen />); open(entry);
        expect(input().value).toBe(draft.trim()); expect(mock.save).toHaveBeenCalledOnce();
      });
    }
    for (const kind of ['Error', 'nonError'] as const) {
      it(`${entry} ${kind}: 기존 Alert 인자 관측, 실패 시 draft 유지·동일 payload 재시도`, () => {
        const error = kind === 'Error' ? new Error('검수 메모 저장 실패') : { code: 'FIXTURE' };
        mock.save.mockImplementation((_next: unknown, callbacks: Callbacks) => callbacks.onError(error));
        render(<IngredientDetailScreen />); open(entry);
        const draft = '  실패 후에도 남는 메모  ';
        fireEvent.change(input(), { target: { value: draft } });
        fireEvent.click(modal().getByRole('button', { name: '완료' }));
        expect(Alert.alert).toHaveBeenCalledOnce();
        expect(Alert.alert).toHaveBeenCalledWith('저장하지 못했어요', kind === 'Error' ? '검수 메모 저장 실패' : '잠시 후 다시 시도해 주세요');
        expect(screen.getAllByTestId('detail-memo-modal')).toHaveLength(1);
        expect(input().value).toBe(draft); expectNoOtherActions();
        expect(mock.save.mock.calls[0]?.[0]).toEqual(payload(draft.trim()));
        fireEvent.click(modal().getByRole('button', { name: '완료' }));
        expect(mock.save).toHaveBeenCalledTimes(2);
        expect(mock.save.mock.calls[1]?.[0]).toEqual(payload(draft.trim()));
      });
    }
    for (const dismiss of ['취소', '닫기']) {
      it(`${entry} ${dismiss}: 시트 취소는 mutation 없이 draft를 버리고 반대 진입에서 원본 복원`, () => {
        render(<IngredientDetailScreen />); open(entry);
        fireEvent.change(input(), { target: { value: '미저장 초안' } });
        fireEvent.click(modal().getByRole('button', { name: dismiss }));
        expect(screen.queryByTestId('detail-memo-modal')).toBeNull();
        open(entry === 'direct' ? 'menu' : 'direct'); expect(input().value).toBe('서버 원본 메모');
        expect(mock.save).not.toHaveBeenCalled(); expect(Alert.alert).not.toHaveBeenCalled(); expectNoOtherActions();
      });
    }
    it(`${entry}: 실제 host의 isPending이 공용 footer 두 행동을 막고 draft를 보존한다`, () => {
      const { rerender } = render(<IngredientDetailScreen />); open(entry);
      fireEvent.change(input(), { target: { value: '저장 중 초안' } });
      mock.pending = true; rerender(<IngredientDetailScreen />);
      for (const name of ['취소', '완료']) {
        const button = modal().getByRole('button', { name });
        expect(button.getAttribute('aria-disabled')).toBe('true'); fireEvent.click(button);
      }
      expect(input().value).toBe('저장 중 초안'); expect(mock.save).not.toHaveBeenCalled(); expectNoOtherActions();
    });
  }
});
