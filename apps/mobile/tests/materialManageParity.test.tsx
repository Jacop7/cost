import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MaterialManageScreen from '@/features/recipes/screens/MaterialManageScreen';

const mock = vi.hoisted(() => ({
  lists: vi.fn(), save: vi.fn(), deactivate: vi.fn(), alert: vi.fn(),
  replace: vi.fn(), back: vi.fn(), push: vi.fn(), savePending: false,
  dimensions: { width: 390, height: 844, scale: 1, fontScale: 1 },
}));

vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return {
    ...rn,
    Alert: { ...rn.Alert, alert: mock.alert },
    useWindowDimensions: () => mock.dimensions,
    // Native Modal visibility alone is adapted for jsdom. MaterialManageScreen
    // and its kit Sheet/Input/Select/Button hosts remain real.
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
      visible ? <div data-testid="material-modal">{children}</div> : null,
  };
});
vi.mock('expo-router', () => ({
  router: { canGoBack: () => false, replace: mock.replace, back: mock.back },
  useRouter: () => ({ push: mock.push }),
}));
vi.mock('@/features/changes/configurationHistory', () => ({
  useConfigurationHistory: () => ({ data: { pages: [{ items: [], count: 0 }] }, isLoading: false, error: null }),
}));
vi.mock('@/features/master-data/hooks', () => ({
  useSettingsLists: mock.lists,
  useSaveMaterial: () => ({ mutate: mock.save, isPending: mock.savePending }),
  useDeactivateMaterial: () => ({ mutate: mock.deactivate, isPending: false }),
}));

const materials = [
  { id: 'material-box', name: '배달용 포장 용기', categoryId: 'cat-pack', categoryName: '포장 소모품',
    unitCost: 300, unitLabel: '개', memo: null, usedCount: 2 },
  { id: 'material-gas', name: 'BBQ 가스', categoryId: 'cat-heat', categoryName: '가열 연료',
    unitCost: 120.5, unitLabel: '회', memo: null, usedCount: 0 },
];
const categories = [
  { id: 'cat-pack', name: '포장 소모품', kind: 'material', sortOrder: 1, usedCount: 1 },
  { id: 'cat-heat', name: '가열 연료', kind: 'material', sortOrder: 2, usedCount: 1 },
];
const listState = () => ({
  data: { materials, materialCategories: categories },
  isLoading: false, error: null, refetch: vi.fn(),
});

type MutationCallbacks = { onSuccess: () => void; onError: (error: unknown) => void };
type AlertButton = { text?: string; style?: string; onPress?: () => void };

const modalForTitle = (title: string) => {
  const node = screen.getAllByTestId('material-modal').find((candidate) =>
    within(candidate).queryByText(title) !== null,
  );
  if (!node) throw new Error(`${title} modal not found`);
  return within(node);
};
const form = (title: '부자재 추가' | '부자재 수정') => modalForTitle(title);
const input = (host: ReturnType<typeof form>, name: string) =>
  host.getByRole('textbox', { name }) as HTMLInputElement;
const fill = (host: ReturnType<typeof form>, name: string, value: string) =>
  fireEvent.change(input(host, name), { target: { value } });
const openAdd = () => {
  fireEvent.click(screen.getByRole('button', { name: '부자재 추가' }));
  return form('부자재 추가');
};
const openEdit = (name = materials[0]!.name) => {
  fireEvent.click(screen.getAllByRole('button', { name: `${name} 수정` })[0]!);
  return form('부자재 수정');
};
const callbacksOf = (callIndex = 0) => mock.save.mock.calls[callIndex]![1] as MutationCallbacks;
const purchaseFieldsContainer = (host: ReturnType<typeof form>) => {
  const price = input(host, '구매 가격');
  let ancestor = input(host, '구매 수량').parentElement;
  while (ancestor && !ancestor.contains(price)) ancestor = ancestor.parentElement;
  if (!ancestor) throw new Error('purchase fields common container not found');
  return ancestor;
};

// Domain hooks, native Modal visibility, Alert delivery and router effects are
// mocked. These tests do not execute save_material/deactivate_material RPCs or
// certify native keyboard/gesture/layout geometry, font scaling or visual QA.
describe('RCP-13/14 실제 부자재 목록·폼·삭제 연결', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.savePending = false;
    Object.assign(mock.dimensions, { width: 390, height: 844, scale: 1, fontScale: 1 });
    mock.lists.mockReturnValue(listState());
  });

  afterEach(cleanup);

  it('부자재 목록 위 수정 내역 카드에서 공통 이력 페이지로 이동한다', () => {
    render(<MaterialManageScreen />);
    const history = screen.getByRole('button', { name: '부자재 수정 내역 보기' });
    expect(history.compareDocumentPosition(screen.getByText('등록된 부자재 2')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(history);
    expect(mock.push).toHaveBeenCalledWith('/my/configuration-history?kind=material');
  });

  it('목록의 서버 단가·사용 수를 보이고 이름과 카테고리 검색을 같은 실제 SearchBar로 적용한다', () => {
    render(<MaterialManageScreen />);
    expect(screen.getByText('등록된 부자재 2')).toBeTruthy();
    expect(screen.getByText('300원/개')).toBeTruthy();
    expect(screen.getByText('121원/회')).toBeTruthy();
    expect(screen.getByText(/메뉴 2개/)).toBeTruthy();

    const search = screen.getByRole('textbox', { name: '부자재 이름으로 검색' });
    fireEvent.change(search, { target: { value: '가열 연료' } });
    expect(screen.getByText('등록된 부자재 1')).toBeTruthy();
    expect(screen.getByText('BBQ 가스')).toBeTruthy();
    expect(screen.queryByText('배달용 포장 용기')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(screen.getByText('등록된 부자재 2')).toBeTruthy();
  });

  it('빈 추가는 disabled이고 카테고리·100개 30,000원을 개당 300원 payload로 저장한 뒤 성공 때만 닫는다', () => {
    render(<MaterialManageScreen />);
    const host = openAdd();
    const add = host.getByRole('button', { name: '추가' });
    expect(add.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(add); expect(mock.save).not.toHaveBeenCalled();

    const emptyCategory = host.getByRole('button', { name: '카테고리 선택: 지정 안 함' });
    expect(emptyCategory.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(emptyCategory);
    expect(screen.queryByText('부자재명')).toBeNull();
    const picker = modalForTitle('카테고리 선택');
    fireEvent.click(picker.getByRole('button', { name: '포장 소모품' }));
    expect(screen.getAllByTestId('material-modal')).toHaveLength(1);
    const restoredHost = form('부자재 추가');
    expect(restoredHost.getByRole('button', { name: '카테고리 선택: 포장 소모품' }).getAttribute('aria-expanded')).toBe('false');

    fill(restoredHost, '부자재명', '  새 포장 봉투  ');
    fill(restoredHost, '구매 수량', '100');
    fill(restoredHost, '구매 가격', '30000');
    expect(restoredHost.getByText('300원/개')).toBeTruthy();
    const restoredAdd = restoredHost.getByRole('button', { name: '추가' });
    expect(restoredAdd.getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(restoredAdd);
    expect(mock.save).toHaveBeenCalledWith({
      id: undefined, name: '새 포장 봉투', categoryId: 'cat-pack', unitCost: 300, unitLabel: '개',
    }, expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }));
    expect(restoredHost.getByText('부자재 추가')).toBeTruthy();
    act(() => callbacksOf().onSuccess());
    expect(screen.queryByTestId('material-modal')).toBeNull();
  });

  it('수정은 저장된 unitCost를 구매 수량 1개의 가격으로 되돌리고 기존 id·카테고리를 보존한다', () => {
    render(<MaterialManageScreen />);
    const host = openEdit();
    expect(input(host, '부자재명').value).toBe('배달용 포장 용기');
    expect(input(host, '구매 수량').value).toBe('1');
    expect(input(host, '구매 가격').value).toBe('300');
    expect(input(host, '단위 이름').value).toBe('개');
    expect(host.getByRole('button', { name: '카테고리 선택: 포장 소모품' })).toBeTruthy();
    fill(host, '구매 가격', '450');
    fireEvent.click(host.getByRole('button', { name: '저장' }));
    expect(mock.save).toHaveBeenCalledWith({
      id: 'material-box', name: '배달용 포장 용기', categoryId: 'cat-pack', unitCost: 450, unitLabel: '개',
    }, expect.any(Object));
  });

  it('취소는 저장하지 않고 닫으며 저장 실패는 Alert 후 작성 중 입력을 그대로 유지한다', () => {
    render(<MaterialManageScreen />);
    let host = openEdit();
    fill(host, '부자재명', '취소할 수정');
    fireEvent.click(host.getByRole('button', { name: '취소' }));
    expect(mock.save).not.toHaveBeenCalled();
    expect(screen.queryByTestId('material-modal')).toBeNull();

    host = openAdd();
    fill(host, '부자재명', '실패 후 보존');
    fill(host, '구매 수량', '10');
    fill(host, '구매 가격', '9990');
    fireEvent.click(host.getByRole('button', { name: '추가' }));
    act(() => callbacksOf().onError(new Error('저장 실패 fixture')));
    expect(mock.alert).toHaveBeenLastCalledWith('저장하지 못했어요', '저장 실패 fixture');
    expect(input(form('부자재 추가'), '부자재명').value).toBe('실패 후 보존');
    expect(input(form('부자재 추가'), '구매 수량').value).toBe('10');
    expect(input(form('부자재 추가'), '구매 가격').value).toBe('9990');
  });

  it('저장 A를 취소하고 B를 편집하면 A의 늦은 성공이 현재 B 폼과 draft를 닫지 않는다', () => {
    render(<MaterialManageScreen />);
    let host = openEdit('배달용 포장 용기');
    fireEvent.click(host.getByRole('button', { name: '저장' }));
    fireEvent.click(host.getByRole('button', { name: '취소' }));

    host = openEdit('BBQ 가스');
    fill(host, '부자재명', 'B 작성 중 이름');
    act(() => callbacksOf().onSuccess());
    expect(input(form('부자재 수정'), '부자재명').value).toBe('B 작성 중 이름');
    expect(mock.save).toHaveBeenCalledTimes(1);
  });

  it('저장 A를 취소하고 B를 편집하면 A의 늦은 오류가 현재 B에 오류 dialog를 오염시키지 않는다', () => {
    render(<MaterialManageScreen />);
    let host = openEdit('배달용 포장 용기');
    fireEvent.click(host.getByRole('button', { name: '저장' }));
    fireEvent.click(host.getByRole('button', { name: '취소' }));

    host = openEdit('BBQ 가스');
    fill(host, '부자재명', 'B 오류와 무관한 draft');
    act(() => callbacksOf().onError(new Error('A의 늦은 실패')));
    expect(mock.alert).not.toHaveBeenCalled();
    expect(input(form('부자재 수정'), '부자재명').value).toBe('B 오류와 무관한 draft');
    expect(mock.save).toHaveBeenCalledTimes(1);
  });

  it('mock dimension 변경에 따라 구매 입력은 row·column을 재계산하되 열린 폼 값을 보존한다', () => {
    const view = render(<MaterialManageScreen />);
    let host = openAdd();
    fill(host, '부자재명', '반응형 보존 draft');
    fill(host, '구매 수량', '100');
    fill(host, '구매 가격', '30000');
    expect(purchaseFieldsContainer(host).style.flexDirection).toBe('row');

    Object.assign(mock.dimensions, { width: 320, fontScale: 1 });
    view.rerender(<MaterialManageScreen />);
    host = form('부자재 추가');
    expect(purchaseFieldsContainer(host).style.flexDirection).toBe('column');
    expect(input(host, '부자재명').value).toBe('반응형 보존 draft');
    expect(input(host, '구매 수량').value).toBe('100');
    expect(input(host, '구매 가격').value).toBe('30000');

    Object.assign(mock.dimensions, { width: 390, fontScale: 2 });
    view.rerender(<MaterialManageScreen />);
    host = form('부자재 추가');
    expect(purchaseFieldsContainer(host).style.flexDirection).toBe('column');
    expect(input(host, '구매 가격').value).toBe('30000');

    Object.assign(mock.dimensions, { width: 390, fontScale: 1 });
    view.rerender(<MaterialManageScreen />);
    host = form('부자재 추가');
    expect(purchaseFieldsContainer(host).style.flexDirection).toBe('row');
    expect(input(host, '구매 수량').value).toBe('100');
  });

  it('저장 요청 뒤 화면이 unmount되면 늦은 오류 callback은 Alert를 만들지 않는다', () => {
    const view = render(<MaterialManageScreen />);
    const host = openEdit('배달용 포장 용기');
    fireEvent.click(host.getByRole('button', { name: '저장' }));
    view.unmount();
    act(() => callbacksOf().onError(new Error('unmount 뒤 실패')));
    expect(mock.alert).not.toHaveBeenCalled();
  });

  it('삭제 확인의 취소 경로는 mutation하지 않고 destructive 확인만 선택한 exact id를 전달한다', () => {
    render(<MaterialManageScreen />);
    fireEvent.click(screen.getByRole('button', { name: '배달용 포장 용기 삭제' }));
    expect(screen.getByText('부자재 삭제')).toBeTruthy();
    expect(screen.getByText(/메뉴가 2개/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(mock.deactivate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '배달용 포장 용기 삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(mock.deactivate).toHaveBeenCalledOnce();
    expect(mock.deactivate).toHaveBeenCalledWith('material-box', expect.objectContaining({ onError: expect.any(Function) }));
  });
});
