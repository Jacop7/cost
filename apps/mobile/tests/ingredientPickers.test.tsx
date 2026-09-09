import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { Select } from '@/components/kit';
import { UnitPickerSheet } from '@/features/ingredients/components/UnitPickerSheet';
import { CategoryPickerSheet } from '@/features/ingredients/components/CategoryPickerSheet';
import { VendorPickerSheet } from '@/features/ingredients/components/VendorPickerSheet';
import { IngredientFormScreen } from '@/features/ingredients/screens/IngredientFormScreen';

const mock = vi.hoisted(() => ({ lists: vi.fn(), saveVendor: vi.fn(), saveIngredient: vi.fn(), detail: vi.fn(), retry: vi.fn() }));
// jsdom does not finish CSS slide animations. Test parent visible wiring here;
// the separate browser capture exercises the real Modal, animation and backdrop.
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <>{children}</> : null };
});
vi.mock('@/features/master-data/hooks', () => ({
  useSettingsLists: mock.lists, useSaveVendor: () => ({ mutate: mock.saveVendor, isPending: false }),
}));
vi.mock('@/features/ingredients/hooks', () => ({
  useIngredientDetail: mock.detail, useSaveIngredient: () => ({ mutate: mock.saveIngredient, isPending: false }),
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  router: { canGoBack: () => false, back: vi.fn(), replace: vi.fn() } }));
const categories = [{ id: 'cat1', name: '농산', kind: 'ingredient' }, { id: 'cat2', name: '긴 카테고리 이름', kind: 'ingredient' }];
const vendors = [{ id: 'vendor1', name: '첫 거래처', usedCount: 2 }, { id: 'vendor2', name: '긴 거래처 이름', usedCount: 3 }];
const listState = { data: { categories, vendors }, isLoading: false, error: null, refetch: mock.retry };

// Real shared Sheet/Select/Pressable; mocked Modal visibility, data and mutations. Geometry, fonts,
// VoiceOver/TalkBack and physical touch bounds require separate runtime evidence.
describe('식재료 공용 선택 시트', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.lists.mockReturnValue(listState);
    mock.detail.mockReturnValue({ data: { name: '대파', baseUnit: 'g', categoryId: 'cat1', categoryName: '농산',
      defaultVendorId: 'vendor1', vendorName: '첫 거래처', perVolume: 1000, safetyStock: 2000, minOrderQty: 1, memo: '', options: [] },
    isLoading: false, error: null, isFetched: true, refetch: vi.fn() });
  });

  it('Select는 공용 button 역할과 현재값 이름, 선택적 펼침 상태를 제공한다', () => {
    const press = vi.fn();
    const { rerender } = render(<Select placeholder="카테고리 선택" onPress={press} />);
    fireEvent.click(screen.getByRole('button', { name: '카테고리 선택' })); expect(press).toHaveBeenCalledOnce();
    rerender(<Select value="농산" onPress={press} accessibilityLabel="카테고리 변경, 농산" expanded />);
    expect(screen.getByRole('button', { name: '카테고리 변경, 농산', expanded: true })).toBeTruthy();
    rerender(<Select value="농산" onPress={press} />);
    expect(screen.getByRole('button', { name: '농산' }).hasAttribute('aria-expanded')).toBe(false);
  });

  it('단위값은 선택적으로 우측 정렬하며 카테고리 기본 정렬은 바꾸지 않는다', () => {
    const { rerender } = render(<Select variant="stacked" value="kg" textAlign="right" />);
    expect(getComputedStyle(screen.getByText('kg')).textAlign).toBe('right');
    rerender(<Select variant="stacked" value="농산" />);
    expect(getComputedStyle(screen.getByText('농산')).textAlign).toBe('left');
  });

  for (const [base, choices] of [[undefined, ['kg', 'g', 'L', 'ml', '박스', '개']], ['g', ['kg', 'g']], ['ml', ['L', 'ml']], ['개', ['박스', '개']]] as const) {
    it(`단위 ${base ?? '전체'}: 기존 그룹 제한과 선택 후 닫기 순서를 유지한다`, async () => {
      const order: string[] = [], select = vi.fn((value: string) => order.push(value)), close = vi.fn(() => order.push('close'));
      render(<UnitPickerSheet visible unit={choices[0]} base={base} onSelect={select} onClose={close} />);
      await waitFor(() => expect(screen.getByRole('button', { name: `${choices[0]}, 현재 선택됨` })).toBeTruthy());
      for (const heading of ['무게', '부피', '개수']) expect(screen.queryByText(heading, { exact: true })).toBeNull();
      for (const choice of choices) {
        const row = screen.getByRole('button', { name: choice === choices[0] ? `${choice}, 현재 선택됨` : choice });
        expect(getComputedStyle(row).minHeight).toBe('60px');
        expect(getComputedStyle(row).borderTopWidth).toBe('0px');
      }
      expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label')?.replace(/, 현재 선택됨$/, '')).filter((n) => n !== '닫기')).toEqual(choices);
      fireEvent.click(screen.getByRole('button', { name: choices[1] }));
      expect(select).toHaveBeenCalledWith(choices[1]); expect(order).toEqual([choices[1], 'close']);
    });
  }

  for (const state of ['loading', 'error', 'empty'] as const) {
    it(`카테고리 ${state}: 잘못된 선택 목록을 노출하지 않고 공용 상태를 쓴다`, () => {
      mock.lists.mockReturnValue({ ...listState, data: { categories: [] }, isLoading: state === 'loading', error: state === 'error' ? new Error('fixture') : null });
      render(<CategoryPickerSheet visible onSelect={vi.fn()} onClose={vi.fn()} />);
      expect(screen.getByText(state === 'loading' ? '불러오는 중이에요' : state === 'error' ? '정보를 불러오지 못했어요' : '등록된 카테고리가 없어요')).toBeTruthy();
      expect(screen.queryByRole('button', { name: '농산' })).toBeNull();
      if (state === 'error') { fireEvent.click(screen.getByRole('button', { name: '다시 시도' })); expect(mock.retry).toHaveBeenCalledOnce(); }
    });
  }

  it('거래처 없음은 null을 전달하며 allowNone=false에서는 숨긴다', () => {
    const select = vi.fn(), close = vi.fn();
    const { rerender } = render(<VendorPickerSheet visible value={null} onSelect={select} onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: '거래처 없음, 현재 선택됨' }));
    expect(select).toHaveBeenCalledWith(null, null); expect(close).toHaveBeenCalledOnce();
    rerender(<VendorPickerSheet visible allowNone={false} onSelect={select} onClose={close} />);
    expect(screen.queryByRole('button', { name: /^거래처 없음/ })).toBeNull(); expect(mock.saveVendor).not.toHaveBeenCalled();
  });

  it('거래처 추가 입력은 취소하면 지워지고 실제 저장을 호출하지 않는다', () => {
    render(<VendorPickerSheet visible onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '거래처 추가' }));
    const cancel = screen.getByRole('button', { name: '취소' });
    const add = screen.getByRole('button', { name: '추가' });
    expect(getComputedStyle(cancel.parentElement!).flex).toBe(getComputedStyle(add.parentElement!).flex);
    expect(getComputedStyle(cancel.parentElement!).flexGrow).toBe('1');
    fireEvent.change(screen.getByLabelText('새 거래처 이름'), { target: { value: '미저장 입력' } });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    fireEvent.click(screen.getByRole('button', { name: '거래처 추가' }));
    expect((screen.getByLabelText('새 거래처 이름') as HTMLInputElement).value).toBe('');
    expect(mock.saveVendor).not.toHaveBeenCalled();
  });

  for (const id of [undefined, 'ingredient-fixture']) {
    it(`ING${id ? '04' : '02'}: 세 선택을 폼에 반영하고 재열기 상태·닫기를 유지한다`, async () => {
      render(<IngredientFormScreen id={id} />);
      const waitClosed = () => waitFor(() => expect(screen.queryByRole('button', { name: '닫기' })).toBeNull());
      const categoryTrigger = () => screen.getByRole('button', { name: /^카테고리 변경,/ });
      fireEvent.click(categoryTrigger());
      fireEvent.click(await screen.findByRole('button', { name: '긴 카테고리 이름' }));
      await waitClosed();
      await waitFor(() => expect(categoryTrigger().getAttribute('aria-expanded')).toBe('false'));
      expect(categoryTrigger().textContent).toBe('긴 카테고리 이름');
      fireEvent.click(categoryTrigger());
      expect(await screen.findByRole('button', { name: '긴 카테고리 이름, 현재 선택됨' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: '닫기' }));
      await waitClosed();
      await waitFor(() => expect(categoryTrigger().getAttribute('aria-expanded')).toBe('false'));
      expect(screen.queryByRole('button', { name: /^기본 거래처 변경,/ })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /^단위 .+ 변경$/ }));
      const nextUnit = id ? 'kg' : 'g';
      fireEvent.click(await screen.findByRole('button', { name: nextUnit }));
      await waitClosed();
      const unitTrigger = await screen.findByRole('button', { name: `단위 ${nextUnit} 변경` });
      fireEvent.click(unitTrigger);
      expect(await screen.findByRole('button', { name: `${nextUnit}, 현재 선택됨` })).toBeTruthy();
      expect(mock.saveIngredient).not.toHaveBeenCalled(); expect(mock.saveVendor).not.toHaveBeenCalled();
      expect(within(screen.getByRole('button', { name: `${nextUnit}, 현재 선택됨` })).getByText(nextUnit)).toBeTruthy();
    });
  }
});
