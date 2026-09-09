import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IngredientFormScreen } from '@/features/ingredients/screens/IngredientFormScreen';

const mock = vi.hoisted(() => ({
  detail: vi.fn(), save: vi.fn(), saveVendor: vi.fn(), replace: vi.fn(), push: vi.fn(), back: vi.fn(),
  canGoBack: vi.fn(), pending: false,
}));
// Real screen, fields, pickers, Sheet and ConfirmSheet. Modal visibility alone is
// substituted; this suite does not prove browser/native animations, geometry or IME.
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
    visible ? <div data-testid="ingredient-form-modal">{children}</div> : null };
});
vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: mock.replace, push: mock.push }),
  router: { canGoBack: mock.canGoBack, back: mock.back, replace: mock.replace },
}));
vi.mock('@/features/ingredients/hooks', () => ({
  useIngredientDetail: mock.detail, useSaveIngredient: () => ({ mutate: mock.save, isPending: mock.pending }),
}));
vi.mock('@/features/master-data/hooks', () => ({
  useSettingsLists: () => ({ data: {
    categories: [{ id: 'c1', name: '농산', kind: 'ingredient' }, { id: 'c2', name: '검수 카테고리', kind: 'ingredient' }],
    vendors: [{ id: 'v1', name: '기존 거래처', usedCount: 1 }, { id: 'v2', name: '검수 거래처', usedCount: 0 }],
  }, isLoading: false, error: null, refetch: vi.fn() }),
  useSaveVendor: () => ({ mutate: mock.saveVendor, isPending: false }),
}));

const ingredient = { id: 'g1', name: '기존 대파', baseUnit: 'g', categoryId: 'c1', categoryName: '농산',
  defaultVendorId: 'v1', vendorName: '기존 거래처', perVolume: 1000, safetyStock: 2000,
  minOrderQty: 3, memo: '기존 메모', options: [] };
type Callbacks = { onError: (error: unknown) => void; onSuccess: (savedId: string) => void };
const modal = () => within(screen.getByTestId('ingredient-form-modal'));
const read = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const saveButton = (id?: string) => screen.getByRole('button', { name: id ? '저장' : '추가' });
function chooseUnit(unit: string) {
  fireEvent.click(screen.getByRole('button', { name: /^단위 .+ 변경$/ }));
  fireEvent.click(modal().getByRole('button', { name: new RegExp(`^${unit}(, 현재 선택됨)?$`) }));
}
function fill(id?: string, unit = 'kg') {
  render(<IngredientFormScreen id={id} />);
  change('식재료명', '  검수 대파  ');
  fireEvent.click(screen.getByRole('button', { name: /^카테고리 변경,/ }));
  fireEvent.click(modal().getByRole('button', { name: '검수 카테고리' }));
  chooseUnit(unit);
  change('개당 용량', unit === '박스' ? '9' : '2.5');
  if (unit === '박스') change('박스당 수량', '12');
  change('구매 가격', '12500');
  change('안전재고', '4.25');
  change('최소 발주', '2');
}
function expectedPayload(id?: string, unit = 'kg') {
  return { id, ...(id ? { expected: { name: '기존 대파', category_id: 'c1', base_unit: 'g',
    per_volume: 1000, purchase_price: null, safety_stock: 2000, min_order_qty: 3,
    default_vendor_id: 'v1', memo: '기존 메모' } } : {}),
    name: '검수 대파', categoryId: 'c2', baseUnit: unit === '박스' ? 'ea' : unit === 'L' ? 'ml' : 'g',
    perVolume: unit === '박스' ? 12 : 2500, safetyStock: unit === '박스' ? 4.25 : 4250, purchasePrice: 12500,
    minOrderQty: 2, defaultVendorId: id ? 'v1' : null, memo: id ? '기존 메모' : null };
}
function expectDraftPreserved(id?: string) {
  expect(read('식재료명')).toBe('  검수 대파  ');
  expect(read('개당 용량')).toBe('2.5');
  expect(read('구매 가격')).toBe('12500');
  expect(read('안전재고')).toBe('4.25');
  expect(read('최소 발주')).toBe('2');
  expect(screen.queryByLabelText('메모')).toBeNull();
  expect(screen.getByRole('button', { name: '카테고리 변경, 검수 카테고리' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^기본 거래처 변경,/ })).toBeNull();
  expect(screen.getByRole('button', { name: '단위 kg 변경' })).toBeTruthy();
  expect(screen.getByText('5원/g')).toBeTruthy();
  expect(mock.replace).not.toHaveBeenCalled();
  expect(mock.back).not.toHaveBeenCalled();
  expect(mock.saveVendor).not.toHaveBeenCalled();
}

describe('실제 ING02/04 저장 실패와 기존 폼 계약', () => {
  beforeEach(() => {
    vi.resetAllMocks(); mock.pending = false; mock.canGoBack.mockReturnValue(false);
    mock.detail.mockReturnValue({ data: ingredient, isLoading: false, error: null, isFetched: true, refetch: vi.fn() });
  });
  for (const id of [undefined, 'g1']) {
    const host = id ? 'ING04' : 'ING02';
    for (const kind of ['Error', 'nonError'] as const) {
      it(`${host} ${kind}: 실패 안내 확인 후 입력·선택·미저장 구매가격 유지, 같은 payload 재시도`, () => {
        mock.save.mockImplementation((_payload: unknown, callbacks: Callbacks) =>
          callbacks.onError(kind === 'Error' ? new Error('검수 저장 실패') : { code: 'FIXTURE' }));
        fill(id);
        fireEvent.click(saveButton(id));
        expect(mock.save).toHaveBeenCalledOnce();
        expect(mock.save.mock.calls[0]?.[0]).toEqual(expectedPayload(id));
        expect(screen.queryByText('저장하지 못했어요')).not.toBeNull();
        expect(screen.getAllByTestId('ingredient-form-modal')).toHaveLength(1);
        expect(modal().getByText(kind === 'Error' ? '검수 저장 실패' : '잠시 후 다시 시도해 주세요')).toBeTruthy();
        fireEvent.click(modal().getByRole('button', { name: '확인' }));
        expect(screen.queryByTestId('ingredient-form-modal')).toBeNull();
        expectDraftPreserved(id);
        expect(mock.save).toHaveBeenCalledOnce();
        fireEvent.click(saveButton(id));
        expect(mock.save).toHaveBeenCalledTimes(2);
        expect(mock.save.mock.calls[1]?.[0]).toEqual(expectedPayload(id));
      });
    }
    for (const dismiss of ['닫기 버튼', 'backdrop'] as const) {
      it(`${host} ${dismiss}: 오류 취소 후 draft·선택 보존, 같은 payload로만 재시도`, () => {
        mock.save.mockImplementation((_payload: unknown, callbacks: Callbacks) =>
          callbacks.onError(new Error('취소 경로 검수 실패')));
        fill(id); fireEvent.click(saveButton(id));
        expect(mock.save).toHaveBeenCalledOnce();
        expect(mock.save.mock.calls[0]?.[0]).toEqual(expectedPayload(id));
        expect(modal().getByText('취소 경로 검수 실패')).toBeTruthy();
        // Both have the same accessible name. Distinguish the visible footer label
        // from the empty backdrop, not DOM order, so each public path is exercised.
        const closes = modal().getAllByRole('button', { name: '닫기' });
        expect(closes).toHaveLength(2);
        const target = closes.find((button) => dismiss === '닫기 버튼'
          ? button.textContent?.trim() === '닫기' : button.textContent?.trim() === '');
        expect(target).toBeDefined();
        fireEvent.click(target!);
        expect(screen.queryByTestId('ingredient-form-modal')).toBeNull();
        expect(screen.queryByText('저장하지 못했어요')).toBeNull();
        expectDraftPreserved(id);
        expect(mock.save).toHaveBeenCalledOnce();
        fireEvent.click(saveButton(id));
        expect(mock.save).toHaveBeenCalledTimes(2);
        expect(mock.save.mock.calls[1]?.[0]).toEqual(expectedPayload(id));
      });
    }
    for (const unit of id ? ['kg'] : ['kg', 'L']) {
      it(`${host} ${unit}: 순수 환산·trim payload, 참고 구매 가격 저장`, () => {
        fill(id, unit); fireEvent.click(saveButton(id));
        expect(mock.save).toHaveBeenCalledOnce();
        // Reference price is metadata; no confirmed price or inventory write is included.
        expect(mock.save.mock.calls[0]?.[0]).toEqual(expectedPayload(id, unit));
        expect(mock.saveVendor).not.toHaveBeenCalled();
        expect(mock.replace).not.toHaveBeenCalled(); expect(mock.back).not.toHaveBeenCalled();
      });
    }
    it(`${host}: 빈 안전재고/최소발주는 저장하지 않으며 명시적 0/1만 허용한다`, () => {
      fill(id); change('안전재고', ''); change('최소 발주', '');
      fireEvent.click(saveButton(id));
      expect(mock.save).not.toHaveBeenCalled();
      change('안전재고', '0'); change('최소 발주', '0'); fireEvent.click(saveButton(id));
      expect(mock.save).not.toHaveBeenCalled();
      change('최소 발주', '1'); fireEvent.click(saveButton(id));
      expect(mock.save.mock.calls[0]?.[0]).toEqual({ ...expectedPayload(id), safetyStock: 0, minOrderQty: 1 });
      expect(screen.queryByLabelText('메모')).toBeNull();
      expect(screen.queryByRole('button', { name: /^기본 거래처 변경,/ })).toBeNull();
    });
    for (const invalid of ['name', 'volume', 'pending'] as const) {
      it(`${host} ${invalid}: 유효하지 않거나 저장 중이면 저장 비활성·mutation 없음`, () => {
        if (invalid === 'pending') mock.pending = true;
        fill(id);
        if (invalid === 'name') change('식재료명', '   ');
        if (invalid === 'volume') change('개당 용량', '0');
        expect(saveButton(id).getAttribute('aria-disabled')).toBe('true');
        fireEvent.click(saveButton(id)); expect(mock.save).not.toHaveBeenCalled();
      });
    }
    for (const field of ['안전재고', '최소 발주']) it(`${host} ${field}: 음수 입력/붙여넣기를 양수로 바꾸지 않는다`, () => {
      fill(id);
      for (const negative of ['-1', '−1', '-0.5']) {
        change(field, negative);
        expect(read(field).startsWith('-')).toBe(true);
        fireEvent.click(saveButton(id)); expect(mock.save).not.toHaveBeenCalled();
      }
    });
  }
  it('ING02: 미입력→이름·용량만 입력해도 카테고리 없이는 저장 불가', () => {
    render(<IngredientFormScreen />);
    expect(saveButton().getAttribute('aria-disabled')).toBe('true');
    change('식재료명', '대파'); change('개당 용량', '1');
    expect(saveButton().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(saveButton()); expect(mock.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^카테고리 변경,/ }));
    fireEvent.click(modal().getByRole('button', { name: '농산' }));
    expect(saveButton().getAttribute('aria-disabled')).toBe('true');
    change('안전재고', '0');
    expect(saveButton().getAttribute('aria-disabled')).not.toBe('true');
  });
  it('ING02: 프로토타입 필드 순서·항상 보이는 구매 단가, 제거한 입력 없음', () => {
    render(<IngredientFormScreen />);
    expect(screen.getByPlaceholderText('식재료명을 입력하세요')).toBeTruthy();
    expect(screen.getByText('0원/g')).toBeTruthy();
    expect(read('최소 발주')).toBe('1');
    expect(screen.queryByText('기본 거래처')).toBeNull();
    expect(screen.queryByLabelText('메모')).toBeNull();
    const preview = screen.getByText('구매 단가');
    const price = screen.getByLabelText('구매 가격');
    expect(preview.compareDocumentPosition(price) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    change('구매 가격', '4000');
    expect(screen.getByText('계산 불가')).toBeTruthy();
    change('개당 용량', '1');
    expect(screen.getByText('4원/g')).toBeTruthy();
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('ING04: 저장된 구매가격을 불러오고 refetch가 편집을 덮지 않는다', () => {
    mock.detail.mockReturnValue({ data: { ...ingredient, purchasePrice: 4000 }, isLoading: false, error: null, isFetched: true });
    const { rerender } = render(<IngredientFormScreen id="g1" />);
    expect(read('식재료명')).toBe('기존 대파'); expect(read('개당 용량')).toBe('1000');
    expect(read('안전재고')).toBe('2000'); expect(read('최소 발주')).toBe('3');
    expect(screen.queryByLabelText('메모')).toBeNull(); expect(read('구매 가격')).toBe('4000');
    expect(screen.getByRole('button', { name: '단위 g 변경' })).toBeTruthy();
    change('식재료명', '편집 중'); change('구매 가격', '9999');
    mock.detail.mockReturnValue({ data: { ...ingredient, name: '나중 서버값' }, isLoading: false, error: null, isFetched: true });
    rerender(<IngredientFormScreen id="g1" />);
    expect(read('식재료명')).toBe('편집 중'); expect(read('구매 가격')).toBe('9999');
    expect(mock.save).not.toHaveBeenCalled();
  });
  for (const mode of ['add', 'edit-back', 'edit-fallback'] as const) {
    it(`${mode}: 성공 때만 기존 상세 이동 정책 실행`, () => {
      const id = mode === 'add' ? undefined : 'g1';
      mock.canGoBack.mockReturnValue(mode === 'edit-back');
      let callbacks: Callbacks | undefined;
      mock.save.mockImplementation((_payload: unknown, next: Callbacks) => { callbacks = next; });
      fill(id); fireEvent.click(saveButton(id));
      expect(mock.back).not.toHaveBeenCalled(); expect(mock.replace).not.toHaveBeenCalled();
      expect(callbacks).toBeDefined(); callbacks!.onSuccess('saved-g2');
      if (mode === 'edit-back') {
        expect(mock.back).toHaveBeenCalledOnce(); expect(mock.replace).not.toHaveBeenCalled();
      } else {
        expect(mock.replace).toHaveBeenCalledOnce();
        expect(mock.replace).toHaveBeenCalledWith(`/ingredients/${id ?? 'saved-g2'}`);
        expect(mock.back).not.toHaveBeenCalled();
      }
      expect(mock.push).not.toHaveBeenCalled();
    });
  }
});
