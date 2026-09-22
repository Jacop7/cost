import { createElement, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BulkInboundScreen } from '@/features/ingredients/screens/BulkInboundScreen';
import { keepBulkInboundPending } from '@/features/ingredients/bulkInboundOperation';

const mock = vi.hoisted(() => ({
  list: vi.fn(), detail: vi.fn(), preview: vi.fn(), save: vi.fn(), resolve: vi.fn(),
  push: vi.fn(), replace: vi.fn(), dispatch: vi.fn(), addListener: vi.fn(), preventRemove: vi.fn(),
  prevented: false, preventCallback: undefined as undefined | ((options: { data: { action: { type: string } } }) => void), uuid: 0,
}));
vi.mock('react-native', async original => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
    visible ? <div data-testid="bulk-modal">{children}</div> : null };
});
vi.mock('expo-router', () => {
  const router = { push: mock.push, replace: mock.replace };
  return {
    useRouter: () => router,
    useNavigation: () => ({ addListener: mock.addListener, dispatch: mock.dispatch }),
    router: { canGoBack: () => false, replace: mock.replace, back: vi.fn() },
  };
});
vi.mock('@react-navigation/native', () => ({ usePreventRemove: mock.preventRemove }));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  randomUUID: () => `00000000-0000-4000-8000-${String(++mock.uuid).padStart(12, '0')}`,
  digestStringAsync: async () => 'a'.repeat(64),
}));
vi.mock('expo-secure-store', () => ({}));
vi.mock('@/lib/SessionProvider', () => ({
  useSessionState: () => ({ userId: 'bulk-user', storeId: 'bulk-store' }),
  useStoreId: () => 'bulk-store',
}));
vi.mock('@/features/international-tax', () => ({
  useInternationalTaxState: () => ({ data: { marketProfile: { currencyCode: 'KRW' } }, isLoading: false, error: null }),
}));
vi.mock('@/features/ingredients/hooks', () => ({
  useIngredientList: mock.list,
  useIngredientDetail: mock.detail,
  useQuickInboundBatchPreview: mock.preview,
  useQuickInboundBatch: () => ({ mutateAsync: mock.save, isPending: false }),
  useResolveQuickInboundBatch: () => ({ mutateAsync: mock.resolve, isPending: false }),
}));

const ingredient = { id: 'ingredient-a', name: '대파', baseUnit: 'g', stockTotal: 1000, safetyStock: 500,
  categoryName: null, perVolume: 1000, vendorName: '시장상회', memo: null, basePrice: 4, soonOut: false,
  lastInboundAt: '2026-09-20', stockTracking: true };
const option = { id: 'option-a', name: '대파 1kg', volume: 1000, amount: 4000, vendorId: 'vendor-a',
  vendorName: '시장상회', editRevision: '1', brandId: null, brandName: null, url: null };
const result = <T,>(data: T) => ({ data, isLoading: false, isFetching: false, error: null, refetch: vi.fn() });

describe('재료 일괄 입고 화면', () => {
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks(); mock.uuid = 0;
    mock.addListener.mockReturnValue(vi.fn());
    mock.preventRemove.mockImplementation((prevented, callback) => {
      mock.prevented = prevented;
      mock.preventCallback = callback;
    });
    mock.list.mockReturnValue(result([ingredient]));
    mock.detail.mockImplementation((id?: string) => result(id ? { ...ingredient, options: [option] } : undefined));
    mock.preview.mockImplementation((items: { clientItemId: string; ingredientId: string }[]) => result(items.length && items[0]?.ingredientId ? [{
      clientItemId: items[0].clientItemId, ingredientId: 'ingredient-a', stockBefore: 1000, stockAfter: 2000,
      inboundUnitPrice: 4, basePriceAfter: 4, affectedRecipes: 2,
    }] : []));
    mock.save.mockResolvedValue({ items: [{ ingredientId: 'ingredient-a' }] });
    mock.resolve.mockResolvedValue({ status: 'not_recorded', items: [] });
  });
  afterEach(() => cleanup());

  it('카드는 재료 선택과 우측 삭제 아이콘·구매처·결제금액·2열 입고량/입고 후 재고 순서이며 구매 옵션 기본값을 수정할 수 있다', async () => {
    render(<BulkInboundScreen />);
    expect(screen.getByText('재료 일괄 입고')).toBeTruthy();
    expect(screen.queryByText('재료명')).toBeNull();
    expect(screen.getByRole('button', { name: '재료명, 재료 선택' }).parentElement?.parentElement)
      .toBe(screen.getByRole('button', { name: '1번째 입고 카드 삭제' }).parentElement);
    expect(screen.getByText('구매처 (선택)')).toBeTruthy();
    expect(screen.getByText('결제금액')).toBeTruthy();
    expect(screen.getByText('입고 후 재고')).toBeTruthy();
    expect(screen.getByText('입고량')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '재료명, 재료 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '대파' }));
    fireEvent.click(screen.getByRole('button', { name: '구매처 (선택), 미선택' }));
    fireEvent.click(screen.getByRole('button', { name: '시장상회' }));
    expect((screen.getByRole('textbox', { name: '1번째 결제금액' }) as HTMLInputElement).value).toBe('4,000');
    expect((screen.getByRole('textbox', { name: '1번째 입고량' }) as HTMLInputElement).value).toBe('1,000');
    expect(screen.getByText('2kg')).toBeTruthy();
    expect(screen.getByText('입고 후 단가 4.00원/g · 연결 메뉴 2')).toBeTruthy();

    fireEvent.change(screen.getByRole('textbox', { name: '1번째 결제금액' }), { target: { value: '4500' } });
    expect((screen.getByRole('textbox', { name: '1번째 결제금액' }) as HTMLInputElement).value).toBe('4,500');
  });

  it('입고 후 단가가 0이면 카드 하단에 0원/g으로 표시한다', () => {
    mock.preview.mockImplementation((items: { clientItemId: string; ingredientId: string }[]) => result(items.length && items[0]?.ingredientId ? [{
      clientItemId: items[0].clientItemId, ingredientId: 'ingredient-a', stockBefore: 1000, stockAfter: 2000,
      inboundUnitPrice: 0, basePriceAfter: 0, affectedRecipes: 2,
    }] : []));
    render(<BulkInboundScreen />);
    fireEvent.click(screen.getByRole('button', { name: '재료명, 재료 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '대파' }));
    fireEvent.click(screen.getByRole('button', { name: '구매처 (선택), 미선택' }));
    fireEvent.click(screen.getByRole('button', { name: '시장상회' }));

    expect(screen.getByText('입고 후 단가 0원/g · 연결 메뉴 2')).toBeTruthy();
    expect(screen.queryByText('0.00원/g')).toBeNull();
  });

  it('서버 미리보기가 준비된 카드들을 한 요청 키로 저장하고 성공 후 목록으로 돌아간다', async () => {
    render(<BulkInboundScreen />);
    fireEvent.click(screen.getByRole('button', { name: '재료명, 재료 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '대파' }));
    fireEvent.click(screen.getByRole('button', { name: '구매처 (선택), 미선택' }));
    fireEvent.click(screen.getByRole('button', { name: '시장상회' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '1건 일괄 입고' })); });
    await waitFor(() => expect(mock.save).toHaveBeenCalledOnce());
    expect(mock.save).toHaveBeenCalledWith({
      requestKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
      items: [expect.objectContaining({ ingredientId: 'ingredient-a', vendorId: 'vendor-a', paidAmount: 4000, receivedQuantity: 1000 })],
    });
    await waitFor(() => expect(mock.replace).toHaveBeenCalledWith('/ingredients'));
    expect(localStorage.length).toBe(0);
  });

  it('저장 응답이 끊겨도 서버에 기록된 요청이면 즉시 복구 확인하고 성공 처리한다', async () => {
    mock.save.mockRejectedValueOnce(new Error('응답을 받지 못했어요.'));
    mock.resolve.mockResolvedValueOnce({
      status: 'recorded',
      items: [{ ingredientId: 'ingredient-a' }],
    });
    render(<BulkInboundScreen />);
    fireEvent.click(screen.getByRole('button', { name: '재료명, 재료 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '대파' }));
    fireEvent.click(screen.getByRole('button', { name: '구매처 (선택), 미선택' }));
    fireEvent.click(screen.getByRole('button', { name: '시장상회' }));

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '1건 일괄 입고' })); });

    await waitFor(() => expect(mock.resolve).toHaveBeenCalledOnce());
    await waitFor(() => expect(mock.replace).toHaveBeenCalledWith('/ingredients'));
    expect(localStorage.length).toBe(0);
  });

  it('진입 복구가 실패하면 같은 화면에서 이전 요청을 다시 확인할 수 있다', async () => {
    await keepBulkInboundPending(
      { actorId: 'bulk-user', storeId: 'bulk-store' },
      [{ clientItemId: 'ingredient-card', ingredientId: 'ingredient-a', vendorId: null, receivedQuantity: 1000, paidAmount: 4000 }],
      'abababab-abab-4bab-8bab-abababababab',
    );
    mock.resolve.mockRejectedValueOnce(new Error('연결을 확인해 주세요.')).mockResolvedValueOnce({
      status: 'recorded',
      items: [{ ingredientId: 'ingredient-a' }],
    });

    render(<BulkInboundScreen />);

    expect(await screen.findByText('연결을 확인해 주세요.')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: '이전 요청 다시 확인' }));
    await waitFor(() => expect(mock.resolve).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mock.replace).toHaveBeenCalledWith('/ingredients'));
    expect(localStorage.length).toBe(0);
  });

  it('서버에 기록되지 않은 실패는 확인 정보를 지우고 같은 화면에서 다시 입력할 수 있게 한다', async () => {
    mock.save.mockRejectedValueOnce(new Error('입고량을 확인해 주세요.'));
    render(<BulkInboundScreen />);
    fireEvent.click(screen.getByRole('button', { name: '재료명, 재료 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '대파' }));
    fireEvent.click(screen.getByRole('button', { name: '구매처 (선택), 미선택' }));
    fireEvent.click(screen.getByRole('button', { name: '시장상회' }));

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '1건 일괄 입고' })); });

    expect(await screen.findByText('입고량을 확인해 주세요.')).toBeTruthy();
    expect(mock.replace).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it('카드를 추가하고 재료 선택 우측의 아이콘으로 삭제할 수 있다', () => {
    render(<BulkInboundScreen />);
    fireEvent.click(screen.getByRole('button', { name: '재료 추가' }));
    expect(screen.getAllByRole('button', { name: /번째 입고 카드 삭제/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '2번째 입고 카드 삭제' }));
    expect(screen.getAllByRole('button', { name: /번째 입고 카드 삭제/ })).toHaveLength(1);
  });

  it('저장을 빠르게 두 번 눌러도 같은 화면에서는 한 배치만 전송한다', async () => {
    let finishSave!: (value: { items: { ingredientId: string }[] }) => void;
    mock.save.mockReturnValueOnce(new Promise(resolve => { finishSave = resolve; }));
    render(<BulkInboundScreen />);
    fireEvent.click(screen.getByRole('button', { name: '재료명, 재료 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '대파' }));
    fireEvent.click(screen.getByRole('button', { name: '구매처 (선택), 미선택' }));
    fireEvent.click(screen.getByRole('button', { name: '시장상회' }));

    const submit = screen.getByRole('button', { name: '1건 일괄 입고' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(mock.save).toHaveBeenCalledOnce());

    await act(async () => { finishSave({ items: [{ ingredientId: 'ingredient-a' }] }); });
    await waitFor(() => expect(mock.replace).toHaveBeenCalledWith('/ingredients'));
  });

  it('미리보기 실패 원인과 재시도를 표시한다', async () => {
    const refetch = vi.fn();
    mock.preview.mockImplementation((items: unknown[]) => items.length
      ? { data: undefined, isLoading: false, isFetching: false, error: new Error('구매처 정보를 다시 확인해 주세요.'), refetch }
      : result([]));
    render(<BulkInboundScreen />);
    fireEvent.click(screen.getByRole('button', { name: '재료명, 재료 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '대파' }));
    fireEvent.click(screen.getByRole('button', { name: '구매처 (선택), 미선택' }));
    fireEvent.click(screen.getByRole('button', { name: '시장상회' }));

    expect((await screen.findByRole('alert')).textContent).toContain('구매처 정보를 다시 확인해 주세요.');
    fireEvent.click(screen.getByRole('button', { name: '미리보기 다시 시도' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('재고를 추적하지 않는 원가 전용 재료는 입고 선택 목록에서 제외한다', () => {
    mock.list.mockReturnValue(result([{ ...ingredient, id: 'cost-only', name: '포장 용기', stockTracking: false }]));
    render(<BulkInboundScreen />);
    expect(screen.getByText('입고할 재료가 없어요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '포장 용기' })).toBeNull();
  });

  it('입력한 카드가 있으면 헤더 뒤로가기 전에 이탈 확인을 표시한다', async () => {
    render(<BulkInboundScreen />);
    await act(async () => undefined);
    fireEvent.click(screen.getByRole('button', { name: '재료명, 재료 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '대파' }));
    fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(await screen.findByText('입고 작성을 나갈까요?')).toBeTruthy();
    expect(mock.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '나가기' }));
    await waitFor(() => expect(mock.replace).toHaveBeenCalledWith('/ingredients'));
  });

  it('저장 중 시스템 뒤로가기는 확인창과 이탈을 모두 차단한다', async () => {
    let finishSave!: (value: { items: { ingredientId: string }[] }) => void;
    mock.save.mockReturnValueOnce(new Promise(resolve => { finishSave = resolve; }));
    render(<BulkInboundScreen />);
    fireEvent.click(screen.getByRole('button', { name: '재료명, 재료 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '대파' }));
    fireEvent.click(screen.getByRole('button', { name: '구매처 (선택), 미선택' }));
    fireEvent.click(screen.getByRole('button', { name: '시장상회' }));
    fireEvent.click(screen.getByRole('button', { name: '1건 일괄 입고' }));
    await waitFor(() => expect(mock.save).toHaveBeenCalledOnce());

    act(() => mock.preventCallback?.({ data: { action: { type: 'GO_BACK' } } }));
    expect(screen.queryByText('입고 작성을 나갈까요?')).toBeNull();
    expect(mock.dispatch).not.toHaveBeenCalled();

    await act(async () => { finishSave({ items: [{ ingredientId: 'ingredient-a' }] }); });
    await waitFor(() => expect(mock.replace).toHaveBeenCalledWith('/ingredients'));
  });
});
