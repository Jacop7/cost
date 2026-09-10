import { createElement, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render as renderUI, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inboundIntentBusy } from '@/features/ingredients/inboundIntentStorage';
import { QuickInboundScreen } from '@/features/ingredients/screens/QuickInboundScreen';
import type { PurchaseOption, QuickInboundInput, QuickInboundPreview } from '@/features/ingredients/hooks';
import { COLOR } from '@/theme/tokens';
import { getToast, dismissToast } from '@/lib/toast';

const mock = vi.hoisted(() => ({
  date: vi.fn(), detail: vi.fn(), preview: vi.fn(), save: vi.fn(), ensureVendor: vi.fn(),
  push: vi.fn(), replace: vi.fn(), pending: false,
  textStyles: new Map<string, Record<string, unknown>>(),
}));
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn,
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
      visible ? <div data-testid="quick-inbound-modal">{children}</div> : null,
    // Real RNW Text is retained; supplied role styles are observed rather than
    // treating jsdom's incomplete atomic CSS cascade as actual font evidence.
    Text: (props: React.ComponentProps<typeof rn.Text>) => {
      if (typeof props.children === 'string')
        mock.textStyles.set(props.children, rn.StyleSheet.flatten(props.style) as Record<string, unknown>);
      return createElement(rn.Text, props);
    },
  };
});
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'quick-fixture' }),
  useRouter: () => ({ push: mock.push }),
  router: { canGoBack: () => false, replace: mock.replace, back: vi.fn() },
}));
vi.mock('@/features/business-day/businessDay', () => ({ useStoreLocalDate: mock.date }));
vi.mock('@/lib/SessionProvider', () => ({ useSessionState: () => ({
  phase: 'ready', userId: 'quick-user', storeId: 'quick-store', message: null, retry: vi.fn(),
}) }));
vi.mock('@/features/ingredients/hooks', () => ({
  useIngredientDetail: mock.detail, useQuickInboundPreview: mock.preview,
  useQuickInbound: () => ({ mutateAsync: (input: QuickInboundInput) => new Promise<void>((resolve, reject) => mock.save(input, { onSuccess: resolve, onError: reject })), isPending: mock.pending }),
}));
vi.mock('@/features/master-data/hooks', () => ({ useEnsureVendor: () => mock.ensureVendor }));

vi.mock("expo-secure-store", () => ({}));
const render = async (element: ReactNode) => { let view!: ReturnType<typeof renderUI>; await act(async () => { view = renderUI(element); }); return view; };
const today = '2030-07-15';
const options: PurchaseOption[] = [
  { editRevision: '1', id: 'option-a', name: '대파 1kg', volume: 1000, amount: 4000, vendorId: 'vendor-a',
    vendorName: '첫 구매처', brandId: null, brandName: null, url: null },
  { editRevision: '1', id: 'option-b', name: '대파 2kg', volume: 2000, amount: 9000, vendorId: 'vendor-b',
    vendorName: '둘째 구매처', brandId: null, brandName: null, url: null },
];
const ingredient = { id: 'quick-fixture', name: '대파', baseUnit: 'g', stockTotal: 5000, basePrice: 4, options };
const result = <T,>(data: T) => ({ data, isLoading: false, error: null, isFetched: true, refetch: vi.fn() });
const input = (name: string) => screen.getByRole('textbox', { name }) as HTMLInputElement;
const fill = (name: string, value: string) => fireEvent.change(input(name), { target: { value } });
const modal = () => within(screen.getByTestId('quick-inbound-modal'));
const openChoices = () => fireEvent.click(screen.getByRole('button', { name: /^구매한 곳 선택(?:,|$)/ }));
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const choose = (name: string) => {
  openChoices();
  fireEvent.click(modal().getByRole('button', { name: name === '직접 입력'
    ? /^직접 입력(?:, 현재 선택됨)?$/ : new RegExp(`(?:^| · )${escapeRegex(name)}(?:,|$)`) }));
};
const submit = () => screen.getByRole('button', { name: /^재고 .* 추가$|^재고 추가$/ });
const confirmInbound = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: '입고' })); }); };
type SaveCallbacks = { onSuccess: () => void; onError: (error: unknown) => void };

// Actual QuickInboundScreen, BusinessDateGate, kit fields, Sheet and ConfirmSheet.
// All domain reads/writes and router effects are mocks; common setup rejects
// direct Supabase access. No real save, vendor creation, RPC formula/idempotency,
// native/IME or visual-layout approval is implied by these host wiring tests.
describe('실제 QuickInboundScreen 입력·서버 미리보기·mock 저장 연결', () => {
  afterEach(async () => {
    cleanup();
    await act(async () => { for (const [, callbacks] of mock.save.mock.calls) callbacks.onError(new Error('test cleanup')); });
    await waitFor(() => expect(inboundIntentBusy({ actorId: 'quick-user', storeId: 'quick-store', ingredientId: 'quick-fixture' })).toBe(false));
  });
  beforeEach(() => {
    localStorage.clear(); vi.resetAllMocks(); mock.textStyles.clear(); mock.pending = false;
    const toast = getToast(); if (toast) dismissToast(toast.id);
    mock.date.mockReturnValue({ date: today, isLoading: false, error: null, refetch: vi.fn() });
    mock.detail.mockReturnValue(result(ingredient));
    mock.preview.mockReturnValue(result(undefined));
    mock.ensureVendor.mockResolvedValue('ensured-vendor');
  });

  it('수정 메뉴 입고 배치는 3탭과 미선택만 노출하고 선택 후 같은 E1 입력을 사용한다', async () => {
    await render(<QuickInboundScreen editLayout />);
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['입고', '차감', '폐기']);
    expect(screen.queryByRole('textbox', { name: '개당 용량' })).toBeNull();
    expect(screen.getByRole('button', { name: '재고 0g 입고' }).getAttribute('aria-disabled')).toBe('true');
    choose('대파 1kg');
    expect(input('개당 용량').value).toBe('1000'); expect(input('실제 결제금액').value).toBe('4000');
    expect(input('개당 용량').readOnly).toBe(true); expect(input('실제 결제금액').readOnly).toBe(true);
    expect(screen.getByText('총 입고량')).toBeTruthy(); expect(screen.getByText('입고 후 기준단가')).toBeTruthy();
    expect(screen.queryByText('반영 내용')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '재고 1kg 입고' }));
    expect(mock.save).not.toHaveBeenCalled();
    expect(screen.getByText('재고를 입고할까요?')).toBeTruthy();
    await confirmInbound();
    expect(mock.save).toHaveBeenCalledWith(expect.objectContaining({ ingredientId: 'quick-fixture', volume: 1000, amount: 4000, qty: 1, vendorId: 'vendor-a', occurredAt: today }), expect.any(Object));
  });

  it('읽기 전용 저장 옵션의 수량 변경은 총 결제금액과 서버 팩당 금액을 일치시킨다', async () => {
    await render(<QuickInboundScreen editLayout />); choose('대파 1kg');
    fireEvent.click(screen.getByRole('button', { name: '수량 늘리기' }));
    expect(input('실제 결제금액').value).toBe('8000');
    fireEvent.click(screen.getByRole('button', { name: '재고 2kg 입고' }));
    await confirmInbound();
    expect(mock.save).toHaveBeenCalledWith(expect.objectContaining({ qty: 2, amount: 4000, volume: 1000 }), expect.any(Object));
  });

  it('읽기 전용 옵션은 동일 ID 재조회 가격·용량 변경도 반영한다', async () => {
    const { rerender } = await render(<QuickInboundScreen editLayout />); choose('대파 1kg');
    mock.detail.mockReturnValue(result({ ...ingredient, options: [{ ...options[0]!, volume: 2000, amount: 7000 }] }));
    rerender(<QuickInboundScreen editLayout />);
    expect(input('개당 용량').value).toBe('2000'); expect(input('실제 결제금액').value).toBe('7000');
    fireEvent.click(screen.getByRole('button', { name: '재고 2kg 입고' }));
    await confirmInbound();
    expect(mock.save).toHaveBeenCalledWith(expect.objectContaining({ volume: 2000, amount: 7000, qty: 1 }), expect.any(Object));
  });

  it('수정 입고의 미선택 복귀와 확인 취소는 저장하지 않는다', async () => {
    await render(<QuickInboundScreen editLayout />); choose('대파 1kg');
    fireEvent.click(screen.getByRole('button', { name: '재고 1kg 입고' }));
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(mock.save).not.toHaveBeenCalled();
    openChoices(); fireEvent.click(modal().getByRole('button', { name: '미선택' }));
    expect(screen.queryByRole('textbox', { name: '개당 용량' })).toBeNull();
    expect(screen.getByRole('button', { name: /재고 .+ 입고/ }).getAttribute('aria-disabled')).toBe('true');
  });

  it('수정 입고 응답 실패는 원 입력을 보관하고 명시 재확인만 노출한다', async () => {
    mock.save.mockImplementation((_input: QuickInboundInput, callbacks: SaveCallbacks) => callbacks.onError(new Error('잠시 후 다시 시도해 주세요')));
    await render(<QuickInboundScreen editLayout />); choose('대파 1kg');
    fireEvent.click(screen.getByRole('button', { name: '재고 1kg 입고' }));
    await confirmInbound();
    expect(await screen.findByRole('button', { name: '이 입고 다시 확인' })).toBeTruthy();
    expect(screen.getByText('원 입고일: 2030-07-15')).toBeTruthy();
    expect(screen.getByText('1kg · 4,000원')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: '실제 결제금액' })).toBeNull();
    expect(mock.replace).not.toHaveBeenCalled(); expect(mock.save).toHaveBeenCalledOnce();
  });

  it('기본 미선택은 옵션을 자동 선택하지 않고 유효한 숫자를 적어도 저장하지 않는다', async () => {
    await render(<QuickInboundScreen />);
    expect(screen.getByText('미선택')).toBeTruthy();
    expect(mock.textStyles.get('미선택')).toMatchObject({ color: COLOR.text.tertiary, fontWeight: '600' });
    expect(input('개당 용량').value).toBe(''); expect(input('실제 결제금액').value).toBe('');
    expect(screen.queryByRole('textbox', { name: '입고일' })).toBeNull();
    fill('개당 용량', '1000'); fill('실제 결제금액', '4000');
    const disabled = screen.getByRole('button', { name: '구매한 곳을 골라 주세요' });
    expect(disabled.getAttribute('aria-disabled')).toBe('true'); fireEvent.click(disabled);
    openChoices();
    fireEvent.click(modal().getByRole('button', { name: '닫기' }));
    expect(screen.getByText('미선택')).toBeTruthy();
    expect(mock.save).not.toHaveBeenCalled(); expect(mock.ensureVendor).not.toHaveBeenCalled();
  });

  it('옵션 선택은 실제 시트를 닫고 용량·금액·구매처를 미리 채운다', async () => {
    await render(<QuickInboundScreen />); choose('대파 2kg');
    expect(screen.queryByTestId('quick-inbound-modal')).toBeNull();
    expect(input('개당 용량').value).toBe('2000'); expect(input('실제 결제금액').value).toBe('9000');
    expect(screen.getByText('둘째 구매처 · 대파 2kg')).toBeTruthy();
    expect(screen.getByText('추가 재고 2kg')).toBeTruthy();
    expect(mock.preview).toHaveBeenLastCalledWith('quick-fixture', 2000, 9000, 1);
    expect(submit().getAttribute('aria-disabled')).not.toBe('true');
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('F02: trigger는 현재값과 펼침 상태를 알리고 재진입 시 선택 옵션은 정확히 하나다', async () => {
    await render(<QuickInboundScreen />);
    expect(screen.getByRole('button', { name: '구매한 곳 선택, 미선택', expanded: false })).toBeTruthy();
    openChoices();
    expect(screen.getByRole('button', { name: '구매한 곳 선택, 미선택', expanded: true })).toBeTruthy();
    expect(modal().queryAllByRole('button', { name: /, 현재 선택됨$/ })).toHaveLength(0);
    fireEvent.click(modal().getByRole('button', { name: '첫 구매처 · 대파 1kg, 4,000원, 4.00원/g' }));
    expect(screen.getByRole('button', { name: '구매한 곳 선택, 첫 구매처 · 대파 1kg', expanded: false })).toBeTruthy();
    openChoices();
    expect(modal().getAllByRole('button', { name: /, 현재 선택됨$/ })).toHaveLength(1);
    expect(modal().getByRole('button', { name: '첫 구매처 · 대파 1kg, 4,000원, 4.00원/g, 현재 선택됨' })).toBeTruthy();
    for (const button of modal().getAllByRole('button')) expect(button.hasAttribute('aria-pressed')).toBe(false);
    fireEvent.click(modal().getByRole('button', { name: '닫기' }));
    expect(screen.getByRole('button', { name: '구매한 곳 선택, 첫 구매처 · 대파 1kg', expanded: false })).toBeTruthy();
    expect(input('실제 결제금액').value).toBe('4000');
    expect(mock.save).not.toHaveBeenCalled(); expect(mock.ensureVendor).not.toHaveBeenCalled();
  });

  it('F02: 동명 옵션도 구매처·금액·단가 이름으로 구분하고 선택한 옵션을 재진입 시 표시한다', async () => {
    mock.detail.mockReturnValue(result({ ...ingredient, options: options.map((option) => ({ ...option, name: '동명 상품' })) }));
    await render(<QuickInboundScreen />); openChoices();
    const first = modal().getByRole('button', { name: '첫 구매처 · 동명 상품, 4,000원, 4.00원/g' });
    const second = modal().getByRole('button', { name: '둘째 구매처 · 동명 상품, 9,000원, 4.50원/g' });
    expect(within(first).getByText('첫 구매처 · 동명 상품')).toBeTruthy();
    expect(within(second).getByText('둘째 구매처 · 동명 상품')).toBeTruthy();
    fireEvent.click(second);
    expect(input('개당 용량').value).toBe('2000'); expect(input('실제 결제금액').value).toBe('9000');
    openChoices();
    expect(modal().getAllByRole('button', { name: /, 현재 선택됨$/ })).toHaveLength(1);
    expect(modal().getByRole('button', { name: '둘째 구매처 · 동명 상품, 9,000원, 4.50원/g, 현재 선택됨' })).toBeTruthy();
    expect(modal().getByRole('button', { name: '첫 구매처 · 동명 상품, 4,000원, 4.00원/g' })).toBeTruthy();
    for (const button of modal().getAllByRole('button')) expect(button.hasAttribute('aria-pressed')).toBe(false);
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('F02: 직접 입력으로 전환한 뒤 시트를 닫아도 직접 선택과 편집한 입력은 보존된다', async () => {
    await render(<QuickInboundScreen />); choose('대파 1kg');
    fill('개당 용량', '1500'); fill('실제 결제금액', '7777'); choose('직접 입력');
    expect(screen.getByRole('button', { name: '구매한 곳 선택, 직접 입력', expanded: false })).toBeTruthy();
    fill('구매처', '직접 입력 보존 구매처');
    openChoices();
    expect(modal().getAllByRole('button', { name: /, 현재 선택됨$/ })).toHaveLength(1);
    expect(modal().getByRole('button', { name: '직접 입력, 현재 선택됨' })).toBeTruthy();
    for (const button of modal().getAllByRole('button')) expect(button.hasAttribute('aria-pressed')).toBe(false);
    fireEvent.click(modal().getByRole('button', { name: '닫기' }));
    expect(screen.getByRole('button', { name: '구매한 곳 선택, 직접 입력', expanded: false })).toBeTruthy();
    expect(input('구매처').value).toBe('직접 입력 보존 구매처');
    expect(input('개당 용량').value).toBe('1500'); expect(input('실제 결제금액').value).toBe('7777');
    expect(mock.save).not.toHaveBeenCalled(); expect(mock.ensureVendor).not.toHaveBeenCalled();
  });

  it('수량 변경은 수정한 총 결제금액을 보존하고 팩당 금액만 preview 인자로 나눈다', async () => {
    await render(<QuickInboundScreen />); choose('대파 1kg'); fill('실제 결제금액', '6500');
    fireEvent.click(screen.getByRole('button', { name: '수량 늘리기' }));
    expect(input('실제 결제금액').value).toBe('6500');
    expect(mock.preview).toHaveBeenLastCalledWith('quick-fixture', 1000, 3250, 2);
    expect(screen.getByText('추가 재고 2kg')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '수량 줄이기' }));
    fireEvent.click(screen.getByRole('button', { name: '수량 줄이기' }));
    expect(input('실제 결제금액').value).toBe('6500');
    expect(mock.preview).toHaveBeenLastCalledWith('quick-fixture', 1000, 6500, 1);
    expect(screen.getByRole('button', { name: '수량 줄이기' }).getAttribute('aria-disabled')).toBe('true');
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('입고일 입력 없이 재조회 뒤에도 서버 매장 날짜를 payload와 멱등 키에 쓴다', async () => {
    const view = await render(<QuickInboundScreen />); choose('대파 1kg');
    fill('실제 결제금액', '6500'); fireEvent.click(screen.getByRole('button', { name: '수량 늘리기' }));
    mock.detail.mockReturnValue(result({ ...ingredient })); view.rerender(<QuickInboundScreen />);
    expect(screen.queryByRole('textbox', { name: '입고일' })).toBeNull();
    fireEvent.click(submit()); await confirmInbound();
    await waitFor(() => expect(mock.save).toHaveBeenCalledOnce());
    expect(mock.save).toHaveBeenCalledWith({ ingredientId: 'quick-fixture', volume: 1000, amount: 3250, qty: 2,
      vendorId: 'vendor-a', occurredAt: today, idempotencyKey: expect.stringMatching(/^qi-/) },
    expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }));
    expect(mock.ensureVendor).not.toHaveBeenCalled();
  });

  for (const scenario of ['reorder', 'preceding-deleted'] as const) {
    it(`${scenario}: 옵션 배열 재조회는 고유 ID 선택과 편집한 입고 payload를 보존한다`, async () => {
      const selected = options[scenario === 'reorder' ? 0 : 1]!;
      const { rerender } = await render(<QuickInboundScreen />); choose(selected.name);
      fill('개당 용량', '1234'); fill('실제 결제금액', '6500');
      fireEvent.click(screen.getByRole('button', { name: '수량 늘리기' }));
      mock.detail.mockReturnValue(result({ ...ingredient,
        options: (scenario === 'reorder' ? [...options].reverse() : [selected]).map(o => ({ ...o })) }));
      rerender(<QuickInboundScreen />);
      expect(screen.getByRole('button', { name: `구매한 곳 선택, ${selected.vendorName} · ${selected.name}` })).toBeTruthy();
      expect(input('개당 용량').value).toBe('1234'); expect(input('실제 결제금액').value).toBe('6500');
      openChoices();
      expect(modal().getAllByRole('button', { name: /, 현재 선택됨$/ })).toHaveLength(1);
      expect(modal().getByRole('button', { name: new RegExp(`^${selected.vendorName} · ${selected.name},.*현재 선택됨$`) })).toBeTruthy();
      fireEvent.click(modal().getByRole('button', { name: '닫기' }));
      fireEvent.click(submit()); await confirmInbound();
      expect(mock.save).toHaveBeenCalledWith({ ingredientId: ingredient.id, volume: 1234, amount: 3250,
        qty: 2, vendorId: selected.vendorId, occurredAt: today,
        idempotencyKey: expect.stringMatching(/^qi-/) }, expect.any(Object));
      expect(mock.ensureVendor).not.toHaveBeenCalled();
    });
  }

  for (const remaining of ['other', 'empty'] as const) {
    it(`선택한 옵션 삭제 (${remaining}): 입력 보존·저장 차단, 자동 대체 없이 다시 선택한다`, async () => {
      const { rerender } = await render(<QuickInboundScreen />); choose('대파 1kg');
      fill('개당 용량', '1234'); fill('실제 결제금액', '6500');
      mock.detail.mockReturnValue(result({ ...ingredient, options: remaining === 'other' ? [options[1]] : [] }));
      rerender(<QuickInboundScreen />);
      const save = screen.getByRole('button', { name: /^(재고 .* 추가|재고 추가|구매한 곳을 골라 주세요)$/ });
      expect(save.getAttribute('aria-disabled')).toBe('true'); fireEvent.click(save);
      expect(mock.save).not.toHaveBeenCalled(); expect(mock.ensureVendor).not.toHaveBeenCalled();
      expect(input('개당 용량').value).toBe('1234'); expect(input('실제 결제금액').value).toBe('6500');
      expect(screen.getByRole('button', { name: '구매한 곳 선택, 다시 선택해 주세요' })).toBeTruthy();
      openChoices(); expect(modal().queryAllByRole('button', { name: /, 현재 선택됨$/ })).toHaveLength(0);
      fireEvent.click(modal().getByRole('button', { name: '직접 입력' }));
      fill('구매처', '명시적으로 다시 선택한 구매처');
      expect(submit().getAttribute('aria-disabled')).not.toBe('true');
    });
  }

  it('같은 옵션 ID의 구매처가 바뀌면 조용히 저장하지 않고 명시적 재선택을 요구한다', async () => {
    const { rerender } = await render(<QuickInboundScreen />); choose('대파 1kg');
    fill('개당 용량', '1234'); fill('실제 결제금액', '6500');
    const updated = { ...options[0]!, vendorId: 'vendor-new', vendorName: '변경된 구매처', volume: 2200, amount: 12000 };
    mock.detail.mockReturnValue(result({ ...ingredient, options: [updated, options[1]!] }));
    rerender(<QuickInboundScreen />);
    const save = screen.getByRole('button', { name: /^(재고 .* 추가|재고 추가|구매한 곳을 골라 주세요)$/ });
    expect(save.getAttribute('aria-disabled')).toBe('true'); fireEvent.click(save);
    expect(mock.save).not.toHaveBeenCalled(); expect(mock.ensureVendor).not.toHaveBeenCalled();
    expect(input('개당 용량').value).toBe('1234'); expect(input('실제 결제금액').value).toBe('6500');
    expect(screen.getByRole('button', { name: '구매한 곳 선택, 다시 선택해 주세요' })).toBeTruthy();
    openChoices(); expect(modal().queryAllByRole('button', { name: /, 현재 선택됨$/ })).toHaveLength(0);
    fireEvent.click(modal().getByRole('button', { name: /^변경된 구매처 · 대파 1kg,/ }));
    expect(input('개당 용량').value).toBe('2200'); expect(input('실제 결제금액').value).toBe('12000');
    fireEvent.click(submit()); await confirmInbound();
    expect(mock.save).toHaveBeenCalledWith({ ingredientId: ingredient.id, volume: 2200, amount: 12000,
      qty: 1, vendorId: 'vendor-new', occurredAt: today,
      idempotencyKey: expect.stringMatching(/^qi-/) }, expect.any(Object));
  });

  it('직접 입력은 구매처 공백을 허용하지 않고 ensureVendor 결과를 mock 저장에 사용한다', async () => {
    await render(<QuickInboundScreen />); choose('직접 입력');
    fill('개당 용량', '2000'); fill('실제 결제금액', '10000');
    expect(submit().getAttribute('aria-disabled')).toBe('true'); fireEvent.click(submit());
    fill('구매처', '   '); expect(submit().getAttribute('aria-disabled')).toBe('true');
    expect(mock.ensureVendor).not.toHaveBeenCalled(); expect(mock.save).not.toHaveBeenCalled();
    fill('구매처', '  직접 구매처  '); fireEvent.click(submit()); await confirmInbound();
    await waitFor(() => expect(mock.save).toHaveBeenCalledOnce());
    // Trimming belongs to the mocked domain helper, not this screen.
    expect(mock.ensureVendor).toHaveBeenCalledWith('  직접 구매처  ');
    expect(mock.save).toHaveBeenCalledWith({ ingredientId: 'quick-fixture', volume: 2000, amount: 10000, qty: 1,
      vendorId: 'ensured-vendor', occurredAt: today, idempotencyKey: expect.stringMatching(/^qi-/) }, expect.any(Object));
  });

  for (const failure of ['save', 'vendor'] as const) {
    it(`${failure} 실패는 입력 또는 미확인 요청을 보존하고 성공으로 처리하지 않는다`, async () => {
      if (failure === 'save') mock.save.mockImplementation((_payload: QuickInboundInput, callbacks: SaveCallbacks) => callbacks.onError(new Error('검수 저장 실패')));
      else mock.ensureVendor.mockRejectedValue(new Error('검수 구매처 실패'));
      await render(<QuickInboundScreen />); choose(failure === 'save' ? '대파 1kg' : '직접 입력');
      if (failure === 'vendor') { fill('구매처', '직접 구매처'); fill('개당 용량', '1000'); fill('실제 결제금액', '4000'); }
      fireEvent.click(submit()); await confirmInbound();
      if (failure === 'vendor') {
        await waitFor(() => expect(modal().getByText('넣지 못했어요')).toBeTruthy());
        expect(modal().getByText('검수 구매처 실패')).toBeTruthy();
        fireEvent.click(modal().getByRole('button', { name: '확인' }));
        expect(screen.queryByTestId('quick-inbound-modal')).toBeNull();
        expect(input('개당 용량').value).toBe('1000'); expect(input('실제 결제금액').value).toBe('4000');
        expect(mock.save).not.toHaveBeenCalled();
      } else {
        expect(await screen.findByRole('button', { name: '이 입고 다시 확인' })).toBeTruthy();
        expect(screen.getByText('검수 저장 실패')).toBeTruthy();
        expect(screen.getByText('1kg · 4,000원')).toBeTruthy();
        expect(mock.save).toHaveBeenCalledOnce();
      }
      expect(mock.replace).not.toHaveBeenCalled();
      expect(getToast()).toBeNull();
    });
  }

  it.each([false, true])('입고 editLayout=%s도 확인 전 저장하지 않고 성공 후 토스트를 낸다', async editLayout => {
    await render(<QuickInboundScreen editLayout={editLayout} />); choose('대파 1kg');
    expect(screen.queryByRole('textbox', { name: '입고일' })).toBeNull();
    fireEvent.click(editLayout ? screen.getByRole('button', { name: '재고 1kg 입고' }) : submit());
    expect(mock.save).not.toHaveBeenCalled(); expect(getToast()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(mock.save).not.toHaveBeenCalled();
    fireEvent.click(editLayout ? screen.getByRole('button', { name: '재고 1kg 입고' }) : submit());
    await confirmInbound(); expect(getToast()).toBeNull();
    await act(async () => { (mock.save.mock.calls[0]?.[1] as SaveCallbacks).onSuccess(); });
    await waitFor(() => expect(getToast()?.message).toBe('입고 처리했어요.'));
  });

  for (const [stockAfter, formatted, color] of [
    [-750, '−750g', COLOR.status.negative], [750, '750g', COLOR.text.accent], [0, '0g', COLOR.text.accent],
  ] as const) {
    it(`서버 stockAfter=${stockAfter} 원문과 부호별 색 역할을 사용한다`, async () => {
      const preview: QuickInboundPreview = { stockBefore: -1750, stockAfter, added: 1000, paid: 4000,
        inboundUnitPrice: 4, basePriceBefore: 3, basePriceAfter: 3.75, affectedRecipes: 2 };
      mock.preview.mockReturnValue(result(preview));
      await render(<QuickInboundScreen />); choose('대파 1kg');
      expect(screen.getByText(formatted)).toBeTruthy();
      expect(mock.textStyles.get(formatted)).toMatchObject({ color, fontWeight: '800' });
      expect(screen.getByText('−1.8kg')).toBeTruthy();
      expect(mock.textStyles.get('−1.8kg')).toMatchObject({ color: COLOR.status.negative, fontWeight: '800' });
      expect(screen.getByText('3.75원/g')).toBeTruthy();
      expect(mock.save).not.toHaveBeenCalled();
    });
  }

  it('서버 localDate가 없으면 실제 BusinessDateGate가 입력과 읽기 본체를 열지 않는다', async () => {
    mock.date.mockReturnValue({ date: null, isLoading: true, error: null, refetch: vi.fn() });
    await render(<QuickInboundScreen />);
    expect(screen.queryByRole('textbox', { name: '입고일' })).toBeNull();
    expect(mock.detail).not.toHaveBeenCalled(); expect(mock.preview).not.toHaveBeenCalled();
    expect(mock.save).not.toHaveBeenCalled(); expect(mock.ensureVendor).not.toHaveBeenCalled();
  });
});
