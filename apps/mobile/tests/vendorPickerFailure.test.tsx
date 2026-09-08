import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IngredientFormScreen } from '@/features/ingredients/screens/IngredientFormScreen';
import { PurchaseOptionScreen } from '@/features/ingredients/screens/PurchaseOptionScreen';
import OrderCompleteScreen from '@/features/orders/screens/OrderCompleteScreen';

const mock = vi.hoisted(() => ({
  params: {} as { ingredient?: string; option?: string },
  detail: vi.fn(), lists: vi.fn(), ingredientList: vi.fn(),
  saveVendor: vi.fn(), saveIngredient: vi.fn(), saveOption: vi.fn(), deleteOption: vi.fn(), placeOrders: vi.fn(),
}));

// Real hosts, VendorPickerSheet, Input, Sheet and ConfirmSheet. Only Modal visibility
// is substituted: jsdom cannot finish native/web modal animation or measure geometry.
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
    visible ? <div data-testid="vendor-modal">{children}</div> : null };
});
vi.mock('expo-router', () => ({ useLocalSearchParams: () => mock.params,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  router: { canGoBack: () => false, back: vi.fn(), replace: vi.fn() } }));
vi.mock('@/features/master-data/hooks', () => ({
  useSettingsLists: mock.lists, useSaveVendor: () => ({ mutate: mock.saveVendor, isPending: false }),
}));
vi.mock('@/features/ingredients/hooks', () => ({
  useIngredientDetail: mock.detail, useIngredientList: mock.ingredientList,
  useSaveIngredient: () => ({ mutate: mock.saveIngredient, isPending: false }),
  useSavePurchaseOption: () => ({ mutate: mock.saveOption, isPending: false }),
  useDeletePurchaseOption: () => ({ mutate: mock.deleteOption, isPending: false }),
}));
vi.mock('@/features/orders/hooks', () => ({ usePlaceOrders: () => ({ mutate: mock.placeOrders, isPending: false }) }));
vi.mock('@/features/business-day/businessDay', () => ({
  useStoreLocalDate: () => ({ date: '2026-09-08', isLoading: false, error: null, refetch: vi.fn() }),
}));

const vendors = [{ id: 'v1', name: '첫 거래처', usedCount: 1 }, { id: 'v2', name: '선택한 거래처', usedCount: 2 }];
const ingredient = {
  id: 'g1', name: '대파', baseUnit: 'g', categoryId: 'c1', categoryName: '농산',
  defaultVendorId: 'v1', vendorName: '첫 거래처', perVolume: 1000, safetyStock: 2000,
  minOrderQty: 1, stockTotal: 3000, memo: '기존 메모',
  options: [{ id: 'o1', name: '대파 1kg', vendorId: 'v1', vendorName: '첫 거래처',
    brandId: null, brandName: null, volume: 1000, amount: 4000, url: null }],
};
type Host = 'ING02' | 'ING04' | 'ING06' | 'ORD02';
type Callbacks = { onError: (error: unknown) => void; onSuccess: () => void };
const modal = () => within(screen.getByTestId('vendor-modal'));
const inputValue = () => (modal().getByLabelText('새 거래처 이름') as HTMLInputElement).value;
const draft = '  새 거래처 초안  ';

function renderHost(host: Host) {
  mock.params = { ingredient: 'g1', ...(host === 'ING06' ? { option: 'o1' } : {}) };
  if (host === 'ING02' || host === 'ING04') render(<IngredientFormScreen id={host === 'ING04' ? 'g1' : undefined} />);
  else if (host === 'ING06') render(<PurchaseOptionScreen />);
  else render(<OrderCompleteScreen />);
}
function openPicker(host: Host, selected = false) {
  const name = host === 'ING06' ? /^구매처 변경,/ : host === 'ORD02'
    ? (selected ? '선택한 거래처' : '지정 안 함') : /^기본 거래처 변경,/;
  fireEvent.click(screen.getByRole('button', { name }));
  expect(modal().getByText('거래처 선택')).toBeTruthy();
}
function prepareDraft(host: Host) {
  renderHost(host);
  openPicker(host);
  fireEvent.click(modal().getByRole('button', { name: '선택한 거래처' }));
  expect(screen.queryByTestId('vendor-modal')).toBeNull();
  openPicker(host, true);
  expect(modal().getByRole('button', { name: '선택한 거래처, 현재 선택됨' })).toBeTruthy();
  fireEvent.click(modal().getByRole('button', { name: '거래처 추가' }));
  fireEvent.change(modal().getByLabelText('새 거래처 이름'), { target: { value: draft } });
}
function expectRestored() {
  expect(screen.getAllByTestId('vendor-modal')).toHaveLength(1);
  expect(modal().getByText('거래처 선택')).toBeTruthy();
  expect(inputValue()).toBe(draft);
  expect(modal().getByRole('button', { name: '선택한 거래처, 현재 선택됨' })).toBeTruthy();
  expect(screen.queryByText('추가하지 못했어요')).toBeNull();
}
function expectSuccessPolicy() {
  // Existing success policy clears only add mode/name. It does not auto-select a new
  // vendor, close the picker, or save any enclosing ingredient/option/order form.
  expect(modal().getByText('거래처 선택')).toBeTruthy();
  expect(modal().queryByLabelText('새 거래처 이름')).toBeNull();
  expect(modal().getByRole('button', { name: '선택한 거래처, 현재 선택됨' })).toBeTruthy();
  fireEvent.click(modal().getByRole('button', { name: '거래처 추가' }));
  expect(inputValue()).toBe('');
  expect(mock.saveIngredient).not.toHaveBeenCalled();
  expect(mock.saveOption).not.toHaveBeenCalled();
  expect(mock.deleteOption).not.toHaveBeenCalled();
  expect(mock.placeOrders).not.toHaveBeenCalled();
}

describe('실제 소비 화면의 거래처 추가 실패 복구', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.detail.mockReturnValue({ data: ingredient, isLoading: false, error: null, isFetched: true, refetch: vi.fn() });
    mock.ingredientList.mockReturnValue({ data: [ingredient], isLoading: false, error: null, refetch: vi.fn() });
    mock.lists.mockReturnValue({ data: { vendors, categories: [{ id: 'c1', name: '농산', kind: 'ingredient' }] },
      isLoading: false, error: null, refetch: vi.fn() });
  });

  for (const host of ['ING02', 'ING04'] as const) {
    it(`${host}: 폐기된 기본 거래처 선택/추가 기능은 노출하지 않는다`, () => {
      renderHost(host);
      expect(screen.queryByRole('button', { name: /^기본 거래처 변경,/ })).toBeNull();
      expect(screen.queryByText('거래처 선택')).toBeNull();
      expect(mock.saveVendor).not.toHaveBeenCalled();
    });
  }
  for (const host of ['ING06', 'ORD02'] as const) {
    for (const kind of ['Error', 'nonError'] as const) {
      it(`${host} ${kind}: 오류 시트 단독 노출 → 확인/닫기 복원 → 재시도 성공`, () => {
        const error = kind === 'Error' ? new Error('검수용 추가 실패') : { code: 'FIXTURE_FAILURE' };
        mock.saveVendor.mockImplementationOnce((_payload: unknown, callbacks: Callbacks) => callbacks.onError(error))
          .mockImplementationOnce((_payload: unknown, callbacks: Callbacks) => callbacks.onSuccess());
        prepareDraft(host);
        fireEvent.click(modal().getByRole('button', { name: '추가' }));
        expect(mock.saveVendor).toHaveBeenNthCalledWith(1, { name: draft.trim() },
          expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }));
        expect(screen.getAllByTestId('vendor-modal')).toHaveLength(1);
        expect(modal().getByText('추가하지 못했어요')).toBeTruthy();
        expect(modal().getByText(kind === 'Error' ? '검수용 추가 실패' : '잠시 후 다시 시도해 주세요')).toBeTruthy();
        expect(screen.queryByText('거래처 선택')).toBeNull();
        expect(screen.queryByLabelText('새 거래처 이름')).toBeNull();
        // Confirmation action and Sheet backdrop dismiss are distinct public paths.
        const dismiss = modal().getAllByRole('button', { name: kind === 'Error' ? '확인' : '닫기' })[0];
        if (!dismiss) throw new Error('오류 시트 닫기 경로 없음');
        fireEvent.click(dismiss);
        expectRestored();
        expect(mock.saveVendor).toHaveBeenCalledTimes(1);
        fireEvent.click(modal().getByRole('button', { name: '추가' }));
        expect(mock.saveVendor).toHaveBeenNthCalledWith(2, { name: draft.trim() }, expect.any(Object));
        expectSuccessPolicy();
      });
    }
    it(`${host}: 첫 시도 성공도 기존 선택 유지·추가 입력 초기화`, () => {
      mock.saveVendor.mockImplementation((_payload: unknown, callbacks: Callbacks) => callbacks.onSuccess());
      prepareDraft(host);
      fireEvent.click(modal().getByRole('button', { name: '추가' }));
      expect(mock.saveVendor).toHaveBeenCalledTimes(1);
      expectSuccessPolicy();
    });
    it(`${host}: 부모가 picker를 닫은 후 도착한 오류는 숨겨진 시트를 노출하지 않는다`, () => {
      let callbacks: Callbacks | undefined;
      mock.saveVendor.mockImplementation((_payload: unknown, next: Callbacks) => { callbacks = next; });
      prepareDraft(host);
      fireEvent.click(modal().getByRole('button', { name: '추가' }));
      fireEvent.click(modal().getByRole('button', { name: '닫기' }));
      expect(screen.queryByTestId('vendor-modal')).toBeNull();
      expect(callbacks).toBeDefined();
      act(() => callbacks!.onError(new Error('닫은 뒤 도착한 오류')));
      expect(screen.queryByTestId('vendor-modal')).toBeNull();
      expect(screen.queryByText('추가하지 못했어요')).toBeNull();
      expect(screen.queryByText('닫은 뒤 도착한 오류')).toBeNull();
      expect(mock.saveVendor).toHaveBeenCalledTimes(1);
    });
  }
});
