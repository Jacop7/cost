import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrderCompleteScreen from '@/features/orders/screens/OrderCompleteScreen';

const mock = vi.hoisted(() => ({
  detail: vi.fn(), list: vi.fn(), date: vi.fn(), place: vi.fn(), saveVendor: vi.fn(),
  back: vi.fn(), alert: vi.fn(), pending: false,
  dimensions: { width: 390, height: 844, scale: 1, fontScale: 1 },
}));
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, useWindowDimensions: () => mock.dimensions,
    Alert: { ...rn.Alert, alert: mock.alert },
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
      visible ? <div data-testid="direct-modal">{children}</div> : null,
  };
});
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({}) }));
vi.mock('@/lib/nav', () => ({ safeBack: mock.back }));
vi.mock('@/features/business-day/businessDay', () => ({ useStoreLocalDate: mock.date }));
vi.mock('@/features/orders/hooks', () => ({ usePlaceOrders: () => ({ mutate: mock.place, isPending: mock.pending }) }));
vi.mock('@/features/ingredients/hooks', () => ({ useIngredientList: mock.list, useIngredientDetail: mock.detail }));
vi.mock('@/features/master-data/hooks', () => ({
  useSettingsLists: () => ({ data: { vendors: [{ id: 'vendor-two', name: '선택 거래처', usedCount: 2 }] }, isLoading: false, error: null, refetch: vi.fn() }),
  useSaveVendor: () => ({ mutate: mock.saveVendor, isPending: false }),
}));

const ingredientName = '국내산 고춧가루 업소용 대용량 장기 보관 식재료';
const optionName = '국내산 고춧가루 업소용 대용량 밀봉 포장 구매 옵션';
const query = <T,>(data: T) => ({ data, isLoading: false, error: null, refetch: vi.fn() });
const modal = () => within(screen.getByTestId('direct-modal'));
const input = (name: string) => screen.getByRole('textbox', { name }) as HTMLInputElement;
const fill = (name: string, value: string) => fireEvent.change(input(name), { target: { value } });
const selectIngredient = () => {
  fireEvent.click(screen.getByRole('button', { name: '식재료 선택' }));
  fireEvent.click(modal().getByRole('button', { name: ingredientName }));
};
const selectOption = () => fireEvent.click(screen.getByRole('button', { name: optionName }));

// Actual screen, kit and VendorPickerSheet are rendered. Hooks, server date,
// navigation, native Modal and mutations are isolated. No DB/native proof.
describe('ORD-02 직접 발주·식재료/거래처 선택 실제 호스트', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.pending = false;
    mock.dimensions = { width: 390, height: 844, scale: 1, fontScale: 1 };
    mock.date.mockReturnValue({ date: '2030-07-14', isLoading: false, error: null, refetch: vi.fn() });
    mock.list.mockReturnValue(query([{ id: 'ingredient-one', name: ingredientName, categoryName: '향신료', baseUnit: 'g', stockTotal: -750, perVolume: 1000 }]));
    mock.detail.mockImplementation((id: string | undefined) => query(id ? {
      id, name: ingredientName, baseUnit: 'g', options: [{ id: 'option-one', name: optionName, volume: 1000, amount: 28000, vendorId: null, vendorName: null }],
    } : undefined));
  });
  afterEach(cleanup);

  it.each([[390, 1, 'row', '0px'], [320, 1, 'column', '40%'], [390, 2, 'column', '40%']] as const)(
    'width=%s fontScale=%s 입력 %s·날짜 폭 %s, 값·공통 입력 유지', (width, fontScale, direction, basis) => {
      mock.dimensions = { ...mock.dimensions, width, fontScale };
      render(<OrderCompleteScreen />); selectIngredient(); selectOption(); fill('수량', '3');
      expect(getComputedStyle(screen.getByTestId('ORD-02/order-fields')).flexDirection).toBe(direction);
      expect(input('개당 용량').value).toBe('1000');
      expect(input('개당 금액').value).toBe('28000');
      expect(input('수량').value).toBe('3');
      const days = within(screen.getByTestId('ORD-02/arrival-options')).getAllByRole('button');
      expect(days).toHaveLength(5);
      for (const day of days) expect(getComputedStyle(day).flexBasis).toBe(basis);
      expect(screen.getByText('84,000원')).toBeTruthy();
      expect(screen.getByRole('button', { name: optionName }).getAttribute('aria-pressed')).toBe('true');
    },
  );

  it('식재료 검색·빈 결과·닫기는 발주하지 않고 선택 후 공용 입력을 연다', () => {
    render(<OrderCompleteScreen />);
    expect(screen.getByRole('button', { name: '발주 등록' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '식재료 선택' }));
    fireEvent.change(modal().getByRole('textbox', { name: '식재료 이름으로 검색' }), { target: { value: '없는재료' } });
    expect(modal().getByText("'없는재료' 검색 결과가 없어요")).toBeTruthy();
    fireEvent.change(modal().getByRole('textbox', { name: '식재료 이름으로 검색' }), { target: { value: '향신료' } });
    expect(modal().getByRole('button', { name: ingredientName })).toBeTruthy();
    fireEvent.click(modal().getByRole('button', { name: '닫기' }));
    expect(screen.queryByTestId('direct-modal')).toBeNull();
    expect(mock.place).not.toHaveBeenCalled();
    selectIngredient(); expect(input('개당 용량').value).toBe('1000');
    expect(input('개당 금액').value).toBe('');
  });

  it('거래처 선택/미지정과 서버 날짜를 E7 payload에 그대로 보낸다', () => {
    render(<OrderCompleteScreen />); selectIngredient(); selectOption(); fill('수량', '3');
    fireEvent.click(screen.getByRole('button', { name: '지정 안 함' }));
    fireEvent.click(modal().getByRole('button', { name: '선택 거래처' }));
    expect(screen.queryByTestId('direct-modal')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '선택 거래처' }));
    fireEvent.click(modal().getByRole('button', { name: '거래처 없음' }));
    fireEvent.click(screen.getByRole('button', { name: '7일 후' }));
    expect(screen.getByRole('button', { name: '7일 후' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '발주 등록' }));
    expect(mock.place).toHaveBeenCalledWith([{ ingredientId: 'ingredient-one', vendorId: null, volume: 1000, amount: 28000, qty: 3, expectedAt: '2030-07-21' }], expect.any(Object));
    const callbacks = mock.place.mock.calls[0]![1];
    callbacks.onError(new Error('시험 실패')); expect(mock.alert).toHaveBeenCalledWith('발주하지 못했어요', '시험 실패');
    expect(mock.back).not.toHaveBeenCalled();
    callbacks.onSuccess(); expect(mock.back).toHaveBeenCalledWith('/orders');
    expect(mock.saveVendor).not.toHaveBeenCalled();
  });

  it('공용 거래처 추가 입력을 열고 취소해도 발주·거래처를 저장하지 않는다', () => {
    render(<OrderCompleteScreen />); selectIngredient(); selectOption();
    fireEvent.click(screen.getByRole('button', { name: '지정 안 함' }));
    fireEvent.click(modal().getByRole('button', { name: '거래처 추가' }));
    fireEvent.change(modal().getByRole('textbox', { name: '새 거래처 이름' }), { target: { value: '새 이름' } });
    fireEvent.click(modal().getByRole('button', { name: '취소' }));
    expect(modal().queryByRole('textbox', { name: '새 거래처 이름' })).toBeNull();
    expect(mock.place).not.toHaveBeenCalled(); expect(mock.saveVendor).not.toHaveBeenCalled();
  });
});
