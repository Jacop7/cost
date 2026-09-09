import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Alert, type AlertButton } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PurchaseOptionScreen } from '@/features/ingredients/screens/PurchaseOptionScreen';

const mock = vi.hoisted(() => ({
  params: {} as { ingredient?: string; option?: string }, detail: vi.fn(), save: vi.fn(), remove: vi.fn(),
  deleteHook: vi.fn(), saveVendor: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn(),
}));
// Real screen/ActionSheet/kit. Modal visibility only is substituted. Alert is
// observed at its API boundary, not treated as evidence about root installWebAlert.
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
    visible ? <div data-testid="option-lifecycle-modal">{children}</div> : null };
});
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => mock.params, useRouter: () => ({ push: mock.push }),
  router: { canGoBack: () => false, replace: mock.replace, back: mock.back },
}));
vi.mock('@/features/ingredients/hooks', () => ({
  useIngredientDetail: mock.detail, useSavePurchaseOption: () => ({ mutate: mock.save, isPending: false }),
  useDeletePurchaseOption: (id: string) => { mock.deleteHook(id); return { mutate: mock.remove, isPending: false }; },
}));
vi.mock('@/features/master-data/hooks', () => ({
  useSettingsLists: () => ({ data: { vendors: [{ id: 'v1', name: '첫 거래처' }, { id: 'v2', name: '검수 거래처' }] },
    isLoading: false, error: null, refetch: vi.fn() }),
  useSaveVendor: () => ({ mutate: mock.saveVendor, isPending: false }),
}));

const options = [
  { id: 'o1', name: '대파 1kg', vendorId: 'v1', vendorName: '첫 거래처', brandName: null, volume: 1000, amount: 4000, url: 'https://example.invalid/one' },
  { id: 'o2', name: '대파 박스', vendorId: null, vendorName: null, brandName: null, volume: 2000, amount: 10000, url: null },
];
type Option = typeof options[number];
type Callbacks = { onSuccess: () => void; onError: (error: unknown) => void };
const state = (rows: Option[]) => ({ data: { id: 'g1', baseUnit: 'g', options: rows }, isLoading: false, error: null, isFetched: true, refetch: vi.fn() });
const modal = () => within(screen.getByTestId('option-lifecycle-modal'));
const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;
const change = (label: string, text: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: text } });
function openNew() { fireEvent.click(screen.getByRole('button', { name: '구매 옵션 추가' })); }
function openExisting(name: string) {
  fireEvent.click(screen.getByRole('button', { name: `${name} 구매 링크 메뉴 열기` }));
  fireEvent.click(screen.getByRole('button', { name: '구매 링크 수정' }));
}
function expectBlank() {
  for (const label of ['옵션 이름', '용량', '금액', '구매 링크']) expect(value(label)).toBe('');
  expect(screen.getByRole('button', { name: '구매처 변경, 지정 안 함' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '단위 g 변경' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '더보기' })).toBeNull();
  expect(screen.getByRole('button', { name: '추가' }).getAttribute('aria-disabled')).toBe('true');
}
function fillDraft() {
  change('옵션 이름', '  검수 옵션  '); change('용량', '2'); change('금액', '10000');
  change('구매 링크', '  https://example.invalid/draft  ');
  fireEvent.click(screen.getByRole('button', { name: /^단위 .+ 변경$/ }));
  fireEvent.click(modal().getByRole('button', { name: 'kg' }));
  fireEvent.click(screen.getByRole('button', { name: /^구매처 변경,/ }));
  fireEvent.click(modal().getByRole('button', { name: '검수 거래처' }));
}
function expectDraft() {
  expect(value('옵션 이름')).toBe('  검수 옵션  '); expect(value('용량')).toBe('2');
  expect(value('금액')).toBe('10000'); expect(value('구매 링크')).toBe('  https://example.invalid/draft  ');
  expect(screen.getByRole('button', { name: '구매처 변경, 검수 거래처' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '단위 kg 변경' })).toBeTruthy();
}
function expectServerOption(option: Option) {
  expect(value('옵션 이름')).toBe(option.name);
  expect(value('용량')).toBe(String(option.volume));
  expect(value('금액')).toBe(String(option.amount));
  expect(value('구매 링크')).toBe(option.url ?? '');
  expect(screen.getByRole('button', { name: `구매처 변경, ${option.vendorName ?? '지정 안 함'}` })).toBeTruthy();
  expect(screen.getByRole('button', { name: '단위 g 변경' })).toBeTruthy();
}
const expectedPayload = (id?: string) => ({ id, ingredientId: 'g1', name: '검수 옵션', vendorId: 'v2',
  volume: 2000, amount: 10000, url: 'https://example.invalid/draft' });
function expectNoNavigation() {
  expect(mock.push).not.toHaveBeenCalled(); expect(mock.replace).not.toHaveBeenCalled(); expect(mock.back).not.toHaveBeenCalled();
  expect(mock.saveVendor).not.toHaveBeenCalled();
}
function beginDelete(): AlertButton[] {
  const name = value('옵션 이름');
  fireEvent.click(screen.getByRole('button', { name: '더보기' }));
  fireEvent.click(modal().getByRole('button', { name: '구매 옵션 삭제' }));
  expect(screen.queryByTestId('option-lifecycle-modal')).toBeNull();
  expect(Alert.alert).toHaveBeenLastCalledWith(`${name} 삭제`, '이 구매 옵션만 지워지고 입고 기록은 남아요.', expect.any(Array));
  const buttons = vi.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  expect(buttons?.map(({ text, style }) => ({ text, style }))).toEqual([
    { text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive' },
  ]);
  return buttons!;
}
function confirm(buttons: AlertButton[]) {
  const proceed = buttons.find((button) => button.style === 'destructive');
  expect(proceed?.onPress).toBeTypeOf('function'); act(() => proceed!.onPress!());
}

describe('ING06 실제 구매 옵션 화면의 저장·삭제 생명주기', () => {
  beforeEach(() => {
    vi.resetAllMocks(); mock.params = { ingredient: 'g1' }; mock.detail.mockReturnValue(state(options));
    vi.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  for (const source of ['edit', 'add'] as const) for (const destination of ['other', 'new', 'same'] as const) {
    it(`${source} 저장 대기 → ${destination} 편집 진입: 이전 성공은 새 편집을 닫지 않으며 새 저장 성공만 닫는다`, () => {
      mock.params.option = source === 'edit' ? 'o1' : undefined;
      const callbacks: Callbacks[] = [];
      mock.save.mockImplementation((_payload: unknown, next: Callbacks) => { callbacks.push(next); });
      render(<PurchaseOptionScreen />);
      if (source === 'add') openNew();
      fillDraft(); fireEvent.click(screen.getByRole('button', { name: source === 'edit' ? '저장' : '추가' }));
      expect(mock.save).toHaveBeenCalledOnce();
      fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
      const nextId = destination === 'other' ? 'o2' : destination === 'same' && source === 'edit' ? 'o1' : undefined;
      if (nextId) openExisting(nextId === 'o2' ? '대파 박스' : '대파 1kg');
      else openNew();
      fillDraft();
      expect(callbacks[0]).toBeDefined(); act(() => callbacks[0]!.onSuccess());
      expect(screen.queryByLabelText('옵션 이름')).not.toBeNull(); expectDraft();
      expect(mock.save).toHaveBeenCalledOnce(); expectNoNavigation();
      fireEvent.click(screen.getByRole('button', { name: nextId ? '저장' : '추가' }));
      expect(mock.save.mock.calls[1]?.[0]).toEqual(expectedPayload(nextId));
      expect(callbacks[1]).toBeDefined(); act(() => callbacks[1]!.onSuccess());
      expect(screen.queryByLabelText('옵션 이름')).toBeNull();
      expect(mock.remove).not.toHaveBeenCalled();
    });
  }

  for (const mode of ['add', 'edit'] as const) {
    it(`${mode}: 저장 성공 전 폼 유지 → 성공 목록 복귀 → 재추가는 모든 draft 초기화`, () => {
      const id = mode === 'edit' ? 'o1' : undefined;
      mock.params.option = id; mock.detail.mockReturnValue(state(id ? options : []));
      let callbacks: Callbacks | undefined;
      mock.save.mockImplementation((_payload: unknown, next: Callbacks) => { callbacks = next; });
      const { rerender } = render(<PurchaseOptionScreen />);
      if (!id) {
        expect(screen.getByText('등록된 구매 옵션이 없어요')).toBeTruthy(); openNew(); expectBlank();
      } else { expect(value('옵션 이름')).toBe('대파 1kg'); expect(value('용량')).toBe('1000'); }
      fillDraft(); fireEvent.click(screen.getByRole('button', { name: id ? '저장' : '추가' }));
      expect(mock.save).toHaveBeenCalledOnce(); expect(mock.save.mock.calls[0]?.[0]).toEqual(expectedPayload(id));
      expectDraft(); expect(callbacks).toBeDefined(); act(() => callbacks!.onSuccess());
      expect(screen.queryByLabelText('옵션 이름')).toBeNull();
      expect(screen.getByRole('button', { name: '구매 옵션 추가' })).toBeTruthy();
      // Saving does not manufacture a new query result in the test or in the host.
      const saved: Option = { id: id ?? 'new-o', name: '검수 옵션', vendorId: 'v2', vendorName: '검수 거래처',
        brandName: null, volume: 2000, amount: 10000, url: 'https://example.invalid/draft' };
      mock.detail.mockReturnValue(state([saved])); rerender(<PurchaseOptionScreen />);
      expect(screen.getByRole('button', { name: '검수 옵션 구매 링크 메뉴 열기' })).toBeTruthy();
      openNew(); expectBlank(); expect(mock.save).toHaveBeenCalledOnce();
      expect(mock.remove).not.toHaveBeenCalled(); expect(Alert.alert).not.toHaveBeenCalled(); expectNoNavigation();
    });
    for (const kind of ['Error', 'nonError'] as const) {
      it(`${mode} ${kind}: 저장 실패 Alert 계약과 draft 유지·재시도 payload`, () => {
        const id = mode === 'edit' ? 'o1' : undefined;
        mock.params.option = id; mock.detail.mockReturnValue(state(id ? options : []));
        mock.save.mockImplementation((_payload: unknown, callbacks: Callbacks) =>
          callbacks.onError(kind === 'Error' ? new Error('옵션 저장 검수 실패') : { code: 'FIXTURE' }));
        render(<PurchaseOptionScreen />); if (!id) openNew(); fillDraft();
        fireEvent.click(screen.getByRole('button', { name: id ? '저장' : '추가' }));
        expect(Alert.alert).toHaveBeenCalledOnce();
        expect(Alert.alert).toHaveBeenCalledWith('저장하지 못했어요', kind === 'Error' ? '옵션 저장 검수 실패' : '잠시 후 다시 시도해 주세요');
        expectDraft(); expect(mock.save.mock.calls[0]?.[0]).toEqual(expectedPayload(id));
        fireEvent.click(screen.getByRole('button', { name: id ? '저장' : '추가' }));
        expect(mock.save).toHaveBeenCalledTimes(2); expect(mock.save.mock.calls[1]?.[0]).toEqual(expectedPayload(id));
        expect(mock.remove).not.toHaveBeenCalled(); expectNoNavigation();
      });
    }
  }
  it('빈 목록의 추가 취소는 저장하지 않고 다음 추가를 빈 폼으로 연다', () => {
    mock.detail.mockReturnValue(state([])); render(<PurchaseOptionScreen />); openNew(); fillDraft();
    fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(screen.getByText('등록된 구매 옵션이 없어요')).toBeTruthy(); openNew(); expectBlank();
    expect(mock.save).not.toHaveBeenCalled(); expect(mock.remove).not.toHaveBeenCalled(); expectNoNavigation();
  });
  it('삭제 확인의 취소 계약은 mutation 없이 현재 편집을 보존한다', () => {
    mock.params.option = 'o1'; render(<PurchaseOptionScreen />); fillDraft();
    const buttons = beginDelete();
    act(() => buttons.find((button) => button.style === 'cancel')?.onPress?.());
    expect(mock.remove).not.toHaveBeenCalled(); expect(mock.save).not.toHaveBeenCalled(); expectDraft(); expectNoNavigation();
  });
  for (const id of ['o1', 'o2']) {
    it(`${id}: 삭제 승인 때만 정확한 옵션 ID 호출, 같은 옵션 성공이면 목록 복귀`, () => {
      mock.params.option = id;
      let callbacks: Callbacks | undefined;
      mock.remove.mockImplementation((_id: string, next: Callbacks) => { callbacks = next; });
      render(<PurchaseOptionScreen />);
      const buttons = beginDelete(); expect(mock.remove).not.toHaveBeenCalled(); confirm(buttons);
      expect(mock.deleteHook).toHaveBeenCalledWith('g1');
      expect(mock.remove).toHaveBeenCalledOnce(); expect(mock.remove.mock.calls[0]?.[0]).toBe(id);
      expect(screen.getByLabelText('옵션 이름')).toBeTruthy();
      expect(callbacks).toBeDefined(); act(() => callbacks!.onSuccess());
      expect(screen.queryByLabelText('옵션 이름')).toBeNull();
      expect(screen.getByRole('button', { name: '구매 옵션 추가' })).toBeTruthy();
      expect(mock.save).not.toHaveBeenCalled(); expectNoNavigation();
    });
  }
  for (const kind of ['Error', 'nonError'] as const) {
    it(`${kind}: 삭제 실패는 현재 편집 유지, 오류 Alert 후 재승인은 동일 ID`, () => {
      mock.params.option = 'o1';
      mock.remove.mockImplementation((_id: string, callbacks: Callbacks) =>
        callbacks.onError(kind === 'Error' ? new Error('옵션 삭제 검수 실패') : { code: 'FIXTURE' }));
      render(<PurchaseOptionScreen />); fillDraft(); confirm(beginDelete());
      expect(Alert.alert).toHaveBeenLastCalledWith('삭제하지 못했어요', kind === 'Error' ? '옵션 삭제 검수 실패' : '잠시 후 다시 시도해 주세요');
      expectDraft(); expect(mock.remove.mock.calls[0]?.[0]).toBe('o1');
      confirm(beginDelete()); expect(mock.remove).toHaveBeenCalledTimes(2);
      expect(mock.remove.mock.calls[1]?.[0]).toBe('o1'); expect(mock.save).not.toHaveBeenCalled(); expectNoNavigation();
    });
  }
  it('삭제 응답 대기 중 다른 옵션을 편집하면 이전 옵션의 성공이 새 편집을 닫지 않는다', () => {
    mock.params.option = 'o1';
    let callbacks: Callbacks | undefined;
    mock.remove.mockImplementation((_id: string, next: Callbacks) => { callbacks = next; });
    render(<PurchaseOptionScreen />); confirm(beginDelete());
    fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
    openExisting('대파 박스');
    expect(value('옵션 이름')).toBe('대파 박스');
    change('옵션 이름', '두 번째 옵션 편집 초안');
    expect(callbacks).toBeDefined(); act(() => callbacks!.onSuccess());
    expect(screen.queryByLabelText('옵션 이름')).not.toBeNull();
    expect(value('옵션 이름')).toBe('두 번째 옵션 편집 초안');
    expect(mock.remove).toHaveBeenCalledOnce(); expect(mock.remove.mock.calls[0]?.[0]).toBe('o1');
    expect(mock.save).not.toHaveBeenCalled(); expectNoNavigation();
  });
  it('삭제 응답 대기 중 신규 추가(null ID)로 전환해도 이전 성공은 새 폼과 입력값을 보존한다', () => {
    mock.params.option = 'o1';
    let callbacks: Callbacks | undefined;
    mock.remove.mockImplementation((_id: string, next: Callbacks) => { callbacks = next; });
    render(<PurchaseOptionScreen />); confirm(beginDelete());
    fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
    openNew(); expectBlank(); fillDraft();
    expect(callbacks).toBeDefined(); act(() => callbacks!.onSuccess());
    expect(screen.queryByLabelText('옵션 이름')).not.toBeNull();
    expectDraft();
    expect(screen.getByRole('button', { name: '추가' }).getAttribute('aria-disabled')).not.toBe('true');
    expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
    expect(screen.queryByRole('button', { name: '더보기' })).toBeNull();
    expect(mock.remove).toHaveBeenCalledOnce(); expect(mock.remove.mock.calls[0]?.[0]).toBe('o1');
    expect(mock.save).not.toHaveBeenCalled(); expectNoNavigation();
    // The surviving form is really a new option, not merely the old editor's text.
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(mock.save).toHaveBeenCalledOnce();
    expect(mock.save.mock.calls[0]?.[0]).toEqual(expectedPayload(undefined));
  });
  for (const order of ['callback-first', 'refetch-first'] as const) {
    it(`${order}: 삭제 후 새 o2 객체 재조회가 전체 draft를 덮지 않고, 취소 후 재진입은 새 서버값을 쓴다`, () => {
      mock.params.option = 'o1';
      let callbacks: Callbacks | undefined;
      mock.remove.mockImplementation((_id: string, next: Callbacks) => { callbacks = next; });
      const { rerender } = render(<PurchaseOptionScreen />); confirm(beginDelete());
      fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
      openExisting('대파 박스');
      fillDraft(); expectDraft();
      // A new response removes o1 and moves o2 from index 1 to index 0. Every
      // server field differs from the draft, including base g versus input kg.
      // Hook invalidation itself is mocked; both externally delivered orderings
      // are exercised, including refetch before the local mutation callback.
      const fresh: Option = { id: 'o2', name: '재조회된 서버 옵션', vendorId: 'v1', vendorName: '첫 거래처',
        brandName: null, volume: 3750, amount: 27000, url: 'https://example.invalid/fresh-server' };
      expect(fresh).not.toBe(options[1]);
      const refetch = () => { mock.detail.mockReturnValue(state([fresh])); rerender(<PurchaseOptionScreen />); };
      expect(callbacks).toBeDefined();
      if (order === 'callback-first') {
        act(() => callbacks!.onSuccess()); expectDraft(); refetch();
      } else {
        refetch(); expectDraft(); act(() => callbacks!.onSuccess());
      }
      expectDraft();
      fireEvent.click(screen.getByRole('button', { name: '구매처 변경, 검수 거래처' }));
      expect(modal().getByRole('button', { name: '검수 거래처, 현재 선택됨' })).toBeTruthy();
      fireEvent.click(modal().getByRole('button', { name: '닫기' }));
      expect(mock.remove).toHaveBeenCalledOnce(); expect(mock.remove.mock.calls[0]?.[0]).toBe('o1');
      expect(mock.save).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
      openExisting('재조회된 서버 옵션');
      expectServerOption(fresh);
      fireEvent.click(screen.getByRole('button', { name: '구매처 변경, 첫 거래처' }));
      expect(modal().getByRole('button', { name: '첫 거래처, 현재 선택됨' })).toBeTruthy();
      fireEvent.click(modal().getByRole('button', { name: '닫기' }));
      expect(mock.save).not.toHaveBeenCalled(); expectNoNavigation();
    });
  }
  it('옵션 수정 딥링크의 최초 조회가 늦어도 응답이 도착하면 모든 서버 필드를 처음 채운다', () => {
    mock.params.option = 'o2';
    mock.detail.mockReturnValue({ ...state([]), data: undefined, isLoading: true, isFetched: false });
    const { rerender } = render(<PurchaseOptionScreen />);
    expect(screen.getByText('불러오는 중이에요')).toBeTruthy();
    expect(screen.queryByLabelText('옵션 이름')).toBeNull();
    const late: Option = { id: 'o2', name: '늦게 도착한 옵션', vendorId: 'v1', vendorName: '첫 거래처',
      brandName: null, volume: 3250, amount: 19500, url: 'https://example.invalid/late-server' };
    mock.detail.mockReturnValue(state([late])); rerender(<PurchaseOptionScreen />);
    expectServerOption(late);
    expect(screen.getByRole('button', { name: '저장' }).getAttribute('aria-disabled')).not.toBe('true');
    expect(mock.save).not.toHaveBeenCalled(); expect(mock.remove).not.toHaveBeenCalled(); expectNoNavigation();
  });
  for (const destination of ['other-option', 'new-null'] as const) {
    it(`${destination}: 선택 이벤트와 삭제 성공을 같은 act에서 호출해도 effect 전 새 폼을 닫지 않는다`, () => {
      mock.params.option = 'o1';
      let callbacks: Callbacks | undefined;
      mock.remove.mockImplementation((_id: string, next: Callbacks) => { callbacks = next; });
      render(<PurchaseOptionScreen />); confirm(beginDelete());
      fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(screen.queryByLabelText('옵션 이름')).toBeNull();
      if (destination === 'other-option') fireEvent.click(screen.getByRole('button', { name: '대파 박스 구매 링크 메뉴 열기' }));
      const next = screen.getByRole('button', { name: destination === 'other-option' ? '구매 링크 수정' : '구매 옵션 추가' });
      expect(callbacks).toBeDefined();
      // Deliberately synchronous inside one outer act, before passive effects.
      // This is an event/effect boundary test, not a reproduced network microtask.
      act(() => { fireEvent.click(next); callbacks!.onSuccess(); });
      expect(screen.queryByLabelText('옵션 이름')).not.toBeNull();
      if (destination === 'other-option') expectServerOption(options[1]!);
      else expectBlank();
      expect(mock.remove).toHaveBeenCalledOnce(); expect(mock.remove.mock.calls[0]?.[0]).toBe('o1');
      expect(mock.save).not.toHaveBeenCalled(); expectNoNavigation();
    });
  }
});
