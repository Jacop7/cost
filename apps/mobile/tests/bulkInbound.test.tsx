import { createElement, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BulkInboundScreen } from '@/features/ingredients/screens/BulkInboundScreen';

const mock = vi.hoisted(() => ({
  list: vi.fn(), detail: vi.fn(), preview: vi.fn(), save: vi.fn(), resolve: vi.fn(),
  push: vi.fn(), replace: vi.fn(), uuid: 0,
}));
vi.mock('react-native', async original => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
    visible ? <div data-testid="bulk-modal">{children}</div> : null };
});
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: mock.push, replace: mock.replace }),
  router: { canGoBack: () => false, replace: mock.replace, back: vi.fn() },
}));
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

  it('카드는 재료·구매처·2열 금액/단가·입고량 순서이며 구매 옵션 기본값을 수정할 수 있다', async () => {
    render(<BulkInboundScreen />);
    expect(screen.getByText('재료 일괄 입고')).toBeTruthy();
    expect(screen.getByText('재료명')).toBeTruthy();
    expect(screen.getByText('구매처 (선택)')).toBeTruthy();
    expect(screen.getByText('결제금액')).toBeTruthy();
    expect(screen.getByText('입고 후 단가')).toBeTruthy();
    expect(screen.getByText('입고량')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '재료명, 재료 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '대파' }));
    fireEvent.click(screen.getByRole('button', { name: '구매처 (선택), 미선택' }));
    fireEvent.click(screen.getByRole('button', { name: '시장상회' }));
    expect((screen.getByRole('textbox', { name: '1번째 결제금액' }) as HTMLInputElement).value).toBe('4,000');
    expect((screen.getByRole('textbox', { name: '1번째 입고량' }) as HTMLInputElement).value).toBe('1,000');
    expect(screen.getByText('입고 후 재고 2kg · 연결 메뉴 2')).toBeTruthy();

    fireEvent.change(screen.getByRole('textbox', { name: '1번째 결제금액' }), { target: { value: '4500' } });
    expect((screen.getByRole('textbox', { name: '1번째 결제금액' }) as HTMLInputElement).value).toBe('4,500');
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

  it('카드를 최대 20개까지 추가하고 각 카드 아래 삭제할 수 있다', () => {
    render(<BulkInboundScreen />);
    fireEvent.click(screen.getByRole('button', { name: '＋ 입고 카드 추가' }));
    expect(screen.getAllByRole('button', { name: /번째 입고 카드 삭제/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '2번째 입고 카드 삭제' }));
    expect(screen.getAllByRole('button', { name: /번째 입고 카드 삭제/ })).toHaveLength(1);
  });
});
