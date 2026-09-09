import { act, fireEvent, render, screen, within } from '@testing-library/react';
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

  it('캐시가 오래된 충돌 후 확인하면 내 초안만 유지하고 나머지 최신값으로 저장한다', async () => {
    const latest = { ...original, name: '다른 이름', purchasePrice: 9000, safetyStock: 8000, memo: '다른 기기 메모' };
    const refetch = vi.fn().mockResolvedValue({ data: latest, error: null });
    mock.detail.mockReturnValue({ ...state(original), refetch });
    mock.save.mockImplementationOnce((_input, callbacks) => callbacks.onError(Object.assign(new Error('충돌'), { code: '40001' })));
    render(<IngredientFormScreen id="g1" />);
    change('식재료명', '내 초안'); submit();
    await screen.findByRole('button', { name: '확인 후 계속 수정' });
    expect(refetch).toHaveBeenCalledOnce(); expect(mock.save).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '저장' }).getAttribute('aria-disabled')).toBe('true');
    expect((screen.getByLabelText('식재료명') as HTMLInputElement).value).toBe('내 초안');
    fireEvent.click(screen.getByRole('button', { name: '확인 후 계속 수정' }));
    expect(mock.save).toHaveBeenCalledOnce(); submit();
    expect(mock.save.mock.calls[1]?.[0]).toMatchObject({
      name: '내 초안', purchasePrice: 9000, safetyStock: 8000, memo: latest.memo,
      expected: { ...originalExpected, name: latest.name, purchase_price: 9000, safety_stock: 8000, memo: latest.memo },
    });
  });

  it('재조회 실패와 지연 중에는 저장을 막고 초안 보존 후 재조회만 재시도한다', async () => {
    let resolve!: (value: unknown) => void;
    const refetch = vi.fn().mockResolvedValueOnce({ data: original, error: new Error('조회 실패') })
      .mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    mock.detail.mockReturnValue({ ...state(original), refetch });
    mock.save.mockImplementationOnce((_input, cb) => cb.onError(Object.assign(new Error('충돌'), { code: '40001' })));
    render(<IngredientFormScreen id="g1" />); change('식재료명', '보존 초안'); submit();
    await screen.findByText('조회 실패');
    expect(screen.queryByRole('button', { name: '확인 후 계속 수정' })).toBeNull(); submit();
    expect(mock.save).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '최신 내용 다시 불러오기' }));
    submit(); expect(mock.save).toHaveBeenCalledOnce();
    await act(async () => resolve({ data: { ...original, name: '최신' }, error: null }));
    await screen.findByRole('button', { name: '확인 후 계속 수정' });
    expect((screen.getByLabelText('식재료명') as HTMLInputElement).value).toBe('보존 초안');
  });

  it('대상 변경 후 늦은 충돌 조회는 새 대상 폼을 덮어쓰지 않는다', async () => {
    let resolve!: (value: unknown) => void;
    mock.detail.mockReturnValue({ ...state(original), refetch: () => new Promise(r => { resolve = r; }) });
    mock.save.mockImplementationOnce((_input, cb) => cb.onError(Object.assign(new Error('충돌'), { code: '40001' })));
    const view = render(<IngredientFormScreen id="g1" />); submit();
    mock.detail.mockReturnValue(state({ ...original, id: 'g2', name: '두 번째' }));
    view.rerender(<IngredientFormScreen id="g2" />);
    await act(async () => resolve({ data: { ...original, name: '늦게 도착' }, error: null }));
    expect(screen.queryByText('다른 곳에서 수정됐어요')).toBeNull();
    expect((screen.getByLabelText('식재료명') as HTMLInputElement).value).toBe('두 번째');
  });

  it('대상 없음 다음 조회 오류에도 복구 안내와 초안이 가려지지 않는다', async () => {
    const refetch = vi.fn().mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('복구 조회 실패') })
      .mockResolvedValueOnce({ data: original, error: null });
    mock.detail.mockReturnValue({ ...state(original), refetch });
    mock.save.mockImplementationOnce((_input, cb) => cb.onError(Object.assign(new Error('충돌'), { code: '40001' })));
    const view = render(<IngredientFormScreen id="g1" />); change('식재료명', '내 이름'); submit();
    await screen.findByText('식재료를 찾을 수 없어요. 삭제 여부를 확인해 주세요.');
    mock.detail.mockReturnValue({ data: null, isFetched: true, isLoading: false, error: new Error('조회 오류'), refetch });
    view.rerender(<IngredientFormScreen id="g1" />);
    fireEvent.click(screen.getByRole('button', { name: '최신 내용 다시 불러오기' }));
    await screen.findByText('복구 조회 실패');
    expect((screen.getByLabelText('식재료명') as HTMLInputElement).value).toBe('내 이름');
    expect(mock.save).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '최신 내용 다시 불러오기' }));
    await screen.findByRole('button', { name: '확인 후 계속 수정' });
  });

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
