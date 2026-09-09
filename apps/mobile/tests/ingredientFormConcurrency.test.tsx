import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IngredientFormScreen } from '@/features/ingredients/screens/IngredientFormScreen';

const mock = vi.hoisted(() => ({ detail: vi.fn(), save: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
    visible ? <div data-testid="form-concurrency-modal">{children}</div> : null };
});
vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: mock.replace }),
  router: { canGoBack: () => false, back: mock.back, replace: mock.replace },
}));
vi.mock('@/features/ingredients/hooks', () => ({
  useIngredientDetail: mock.detail,
  useSaveIngredient: () => ({ mutate: mock.save, isPending: false }),
}));
vi.mock('@/features/master-data/hooks', () => ({
  useSettingsLists: () => ({ data: { categories: [{ id: 'c1', name: '농산' }], vendors: [] }, isLoading: false }),
}));

const original = {
  id: 'g1', name: '대파', baseUnit: 'g', categoryId: 'c1', categoryName: '농산',
  perVolume: 1000, purchasePrice: 4000, safetyStock: 2000, minOrderQty: 1,
  defaultVendorId: null, memo: null,
};
const originalExpected = {
  name: '대파', category_id: 'c1', base_unit: 'g', per_volume: 1000, purchase_price: 4000,
  safety_stock: 2000, min_order_qty: 1, default_vendor_id: null, memo: null,
};
const state = (data: typeof original | undefined) => ({ data, isLoading: !data, isFetched: !!data, error: null, refetch: vi.fn() });
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: '저장' }));

describe('식재료 수정 CAS 기준값', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.detail.mockReturnValue(state(original)); });

  it('늦은 최초 조회가 도착한 뒤의 저장은 입력 전 서버값 전체를 기준값으로 보낸다', () => {
    mock.detail.mockReturnValue(state(undefined));
    const view = render(<IngredientFormScreen id="g1" />);
    expect(screen.getByRole('button', { name: '저장' }).getAttribute('aria-disabled')).toBe('true');
    mock.detail.mockReturnValue(state(original));
    view.rerender(<IngredientFormScreen id="g1" />);
    change('식재료명', '수정 대파');
    change('구매 가격', '5000');
    submit();
    expect(mock.save.mock.calls[0]?.[0]).toMatchObject({ id: 'g1', name: '수정 대파', purchasePrice: 5000, expected: originalExpected });
  });

  it('배경 재조회로 서버값이 바뀌어도 사용자 초안과 최초 CAS 기준을 덮지 않는다', () => {
    const view = render(<IngredientFormScreen id="g1" />);
    change('식재료명', '내 초안');
    change('구매 가격', '6000');
    mock.detail.mockReturnValue(state({ ...original, name: '다른 기기의 수정', purchasePrice: 9000, safetyStock: 4000 }));
    view.rerender(<IngredientFormScreen id="g1" />);
    expect((screen.getByLabelText('식재료명') as HTMLInputElement).value).toBe('내 초안');
    expect((screen.getByLabelText('구매 가격') as HTMLInputElement).value).toBe('6000');
    submit();
    expect(mock.save.mock.calls[0]?.[0]).toMatchObject({ name: '내 초안', purchasePrice: 6000, expected: originalExpected });
  });

  it('충돌 안내를 닫고 재시도해도 새 기준을 몰래 채택하거나 성공 이동하지 않는다', () => {
    mock.save.mockImplementation((_input, callbacks) => callbacks.onError(new Error('다른 기기에서 식재료가 변경됐어요.')));
    const view = render(<IngredientFormScreen id="g1" />);
    change('식재료명', '보존할 초안');
    submit();
    const first = mock.save.mock.calls[0]?.[0];
    expect(screen.getByText('다른 기기에서 식재료가 변경됐어요.')).toBeTruthy();
    mock.detail.mockReturnValue(state({ ...original, name: '새 서버값' }));
    view.rerender(<IngredientFormScreen id="g1" />);
    fireEvent.click(within(screen.getByTestId('form-concurrency-modal')).getByRole('button', { name: '확인' }));
    expect((screen.getByLabelText('식재료명') as HTMLInputElement).value).toBe('보존할 초안');
    submit();
    expect(mock.save).toHaveBeenCalledTimes(2);
    expect(mock.save.mock.calls[1]?.[0]).toEqual(first);
    expect(mock.replace).not.toHaveBeenCalled();
    expect(mock.back).not.toHaveBeenCalled();
  });
});
