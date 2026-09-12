import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MyCategoryScreen from '@/features/my/screens/MyCategoryScreen';
import CategoryScreen from '@/features/recipes/screens/CategoryScreen';
import MaterialCategoryScreen from '@/features/recipes/screens/MaterialCategoryScreen';
import type { CategoryKind, CategoryRow, SettingsLists } from '@/features/master-data/hooks';

const mock = vi.hoisted(() => ({
  lists: vi.fn(), save: vi.fn(), remove: vi.fn(), reorder: vi.fn(),
  replace: vi.fn(), back: vi.fn(), canGoBack: false,
}));
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
    visible ? <div data-testid="category-modal">{children}</div> : null };
});
vi.mock('expo-router', () => ({
  router: { canGoBack: () => mock.canGoBack, back: mock.back, replace: mock.replace },
}));
vi.mock('@/features/master-data/hooks', () => ({
  useSettingsLists: mock.lists,
  useSaveCategory: () => ({ mutate: mock.save, isPending: false }),
  useDeleteCategory: () => ({ mutate: mock.remove, isPending: false }),
  useReorderCategories: () => ({ mutate: mock.reorder, isPending: false }),
}));

const categoryRows = (kind: CategoryKind): CategoryRow[] => [
  { id: `${kind}-a`, name: `${kind} 첫 분류`, kind, sortOrder: 0, usedCount: 3 },
  { id: `${kind}-b`, name: `${kind} 중간 분류`, kind, sortOrder: 1, usedCount: 0 },
  { id: `${kind}-c`, name: `${kind} 끝 분류`, kind, sortOrder: 2, usedCount: 1 },
];
const data: SettingsLists = {
  categories: categoryRows('ingredient'), recipeCategories: categoryRows('recipe'),
  materialCategories: categoryRows('material'), materials: [], vendors: [], channels: [],
};
const consumers = [
  { kind: 'ingredient', Host: MyCategoryScreen, title: '식재료 카테고리', used: '식재료', backTo: '/my/categories', key: 'categories' },
  { kind: 'recipe', Host: CategoryScreen, title: '메뉴 카테고리', used: '메뉴', backTo: '/recipes', key: 'recipeCategories' },
  { kind: 'material', Host: MaterialCategoryScreen, title: '부자재 카테고리', used: '부자재', backTo: '/my/categories', key: 'materialCategories' },
] as const;
const modal = () => within(screen.getByTestId('category-modal'));
const fillName = (value: string) => fireEvent.change(modal().getByRole('textbox', { name: '카테고리 이름' }), { target: { value } });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const readState = (value: SettingsLists) => ({ data: value, isLoading: false, error: null, refetch: vi.fn() });

// The real three route-consumer components render the real CategoryEditScreen,
// kit Input/Button/Sheet and safeBack. Only domain hooks/router and Modal
// visibility are adapted. Alert callbacks are inspected, not a browser dialog.
// This is not native drag/scroll/layout coverage or a DB deletion/ACL guarantee.
describe.each(consumers)('$kind 공용 카테고리 화면 실제 소비 계약', ({ kind, Host, title, used, backTo, key }) => {
  const rows = categoryRows(kind);
  const first = rows[0]!; const middle = rows[1]!; const last = rows[2]!;
  beforeEach(() => {
    vi.clearAllMocks(); mock.canGoBack = false;
    mock.lists.mockReturnValue(readState(data));
    vi.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('kind에 맞는 목록·제목·사용 개수만 렌더한다', () => {
    render(<Host />);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: / 수정$/ })).toHaveLength(3);
    for (const row of rows) expect(screen.getByRole('button', { name: `${row.name} 수정` })).toBeTruthy();
    for (const other of consumers.filter((c) => c.kind !== kind)) {
      expect(screen.queryByRole('button', { name: `${other.kind} 첫 분류 수정` })).toBeNull();
    }
    expect(within(screen.getByRole('button', { name: `${first.name} 수정` })).getByText(`${used} 3개`)).toBeTruthy();
  });

  it('추가는 trim한 이름과 정확 kind·undefined ID를 보내고 성공 시 시트를 닫는다', () => {
    render(<Host />);
    fireEvent.click(screen.getAllByRole('button', { name: '카테고리 추가' })[0]!);
    fillName('  새 분류  ');
    fireEvent.click(modal().getByRole('button', { name: '추가' }));
    expect(mock.save).toHaveBeenCalledOnce();
    expect(mock.save.mock.calls[0]?.[0]).toEqual({ id: undefined, name: '새 분류', kind });
    expect(screen.getByTestId('category-modal')).toBeTruthy();
    act(() => mock.save.mock.calls[0]?.[1].onSuccess());
    expect(screen.queryByTestId('category-modal')).toBeNull();
    expect(mock.remove).not.toHaveBeenCalled(); expect(mock.reorder).not.toHaveBeenCalled();
  });

  it('수정은 원래 이름을 채우고 정확 ID·kind와 trim한 새 이름을 보낸다', () => {
    render(<Host />); click(`${middle.name} 수정`);
    expect((modal().getByRole('textbox', { name: '카테고리 이름' }) as HTMLInputElement).value).toBe(middle.name);
    fillName('  바꾼 분류  '); fireEvent.click(modal().getByRole('button', { name: '저장' }));
    expect(mock.save.mock.calls[0]?.[0]).toEqual({ id: middle.id, name: '바꾼 분류', kind });
  });

  it('공백 이름은 추가가 disabled이며 취소 후 저장 호출이 없다', () => {
    render(<Host />); fireEvent.click(screen.getAllByRole('button', { name: '카테고리 추가' })[0]!);
    fillName('   ');
    const add = modal().getByRole('button', { name: '추가' });
    expect(add.getAttribute('aria-disabled')).toBe('true'); fireEvent.click(add);
    expect(mock.save).not.toHaveBeenCalled();
    fireEvent.click(modal().getByRole('button', { name: '취소' }));
    expect(screen.queryByTestId('category-modal')).toBeNull();
  });

  it.each([
    ['위로 이동', [1, 0, 2]], ['아래로 이동', [0, 2, 1]],
  ] as const)('중간 행 %s는 해당 kind의 정확 전체 ID 순서를 보낸다', (direction, indices) => {
    render(<Host />);
    expect(mock.reorder).not.toHaveBeenCalled();
    if (kind === 'ingredient') {
      click(`${middle.name} 순서 변경`);
      expect(modal().getByRole('button', { name: direction }).getAttribute('aria-disabled')).not.toBe('true');
      fireEvent.click(modal().getByRole('button', { name: direction }));
    } else {
      const control = screen.getByRole('button', { name: `${middle.name} ${direction}` });
      expect(getComputedStyle(control).height).toBe('44px');
      fireEvent.click(control); fireEvent.click(control);
    }
    expect(mock.reorder).toHaveBeenCalledOnce();
    expect(mock.reorder.mock.calls[0]?.[0]).toEqual(indices.map((i) => rows[i]!.id));
    expect(screen.queryByTestId('category-modal')).toBeNull();
    expect(mock.save).not.toHaveBeenCalled(); expect(mock.remove).not.toHaveBeenCalled();
  });

  it.each([
    [0, '위로 이동', '아래로 이동'], [2, '아래로 이동', '위로 이동'],
  ] as const)('끝 경계 행 %i의 %s는 disabled로 반대 방향과 구분된다', (index, disabled, enabled) => {
    render(<Host />);
    if (kind === 'ingredient') click(`${rows[index]!.name} 순서 변경`);
    const host = kind === 'ingredient' ? modal() : screen;
    const prefix = kind === 'ingredient' ? '' : `${rows[index]!.name} `;
    const button = host.getByRole('button', { name: prefix + disabled });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(host.getByRole('button', { name: prefix + enabled }).getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(button); expect(mock.reorder).not.toHaveBeenCalled();
    if (kind === 'ingredient') expect(screen.getByTestId('category-modal')).toBeTruthy();
    else expect(screen.queryByTestId('category-modal')).toBeNull();
  });

  if (kind === 'ingredient') it.each(['취소', '닫기'])('순서 시트 %s는 mutation 없이 닫힌다', (action) => {
    render(<Host />); click(`${middle.name} 순서 변경`);
    fireEvent.click(modal().getByRole('button', { name: action }));
    expect(screen.queryByTestId('category-modal')).toBeNull();
    expect(mock.reorder).not.toHaveBeenCalled(); expect(mock.save).not.toHaveBeenCalled(); expect(mock.remove).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: / 수정$/ }).map((el) => el.getAttribute('aria-label'))).toEqual(rows.map((r) => `${r.name} 수정`));
  });

  it('한 행만 있으면 순서 변경 진입점 자체가 disabled다', () => {
    mock.lists.mockReturnValue(readState({ ...data, [key]: [first] }));
    render(<Host />);
    for (const name of kind === 'ingredient' ? [`${first.name} 순서 변경`] : [`${first.name} 위로 이동`, `${first.name} 아래로 이동`]) {
      const trigger = screen.getByRole('button', { name });
      expect(trigger.getAttribute('aria-disabled')).toBe('true'); fireEvent.click(trigger);
    }
    expect(screen.queryByTestId('category-modal')).toBeNull(); expect(mock.reorder).not.toHaveBeenCalled();
  });

  it('삭제 확인은 kind별 사용중 안내·취소 무변이·확인 정확 ID 계약을 지킨다', () => {
    render(<Host />); click(`${last.name} 삭제`);
    if (kind !== 'ingredient') {
      expect(screen.getByText('이 카테고리를 사용하는 항목이 있으면 지울 수 없어요.')).toBeTruthy();
      click('취소');
      expect(mock.remove).not.toHaveBeenCalled();
      click(`${last.name} 삭제`); click('삭제'); click('삭제');
      expect(mock.remove).toHaveBeenCalledOnce();
      expect(mock.remove.mock.calls[0]?.[0]).toBe(last.id);
      expect(mock.save).not.toHaveBeenCalled(); expect(mock.reorder).not.toHaveBeenCalled();
      return;
    }
    const alert = vi.mocked(Alert.alert);
    expect(alert).toHaveBeenCalledOnce();
    expect(alert.mock.calls[0]?.slice(0, 2)).toEqual([
      `${last.name} 삭제`, `이 카테고리를 쓰는 ${used}가 있으면 지울 수 없어요.`,
    ]);
    const buttons = alert.mock.calls[0]?.[2];
    const cancel = buttons?.find((button) => button.text === '취소');
    expect(cancel).toMatchObject({ text: '취소', style: 'cancel' });
    act(() => cancel?.onPress?.());
    expect(mock.remove).not.toHaveBeenCalled();
    const confirm = buttons?.find((button) => button.text === '삭제');
    expect(confirm).toMatchObject({ text: '삭제', style: 'destructive' });
    expect(typeof confirm?.onPress).toBe('function'); act(() => confirm?.onPress?.());
    expect(mock.remove).toHaveBeenCalledOnce(); expect(mock.remove.mock.calls[0]?.[0]).toBe(last.id);
    expect(mock.save).not.toHaveBeenCalled(); expect(mock.reorder).not.toHaveBeenCalled();
  });

  it.each([false, true])('뒤로는 실제 소비처 fallback과 safeBack 분기를 유지한다 (history=%s)', (hasHistory) => {
    mock.canGoBack = hasHistory; render(<Host />); click('뒤로 가기');
    if (hasHistory) { expect(mock.back).toHaveBeenCalledOnce(); expect(mock.replace).not.toHaveBeenCalled(); }
    else { expect(mock.replace).toHaveBeenCalledWith(backTo); expect(mock.back).not.toHaveBeenCalled(); }
    expect(mock.save).not.toHaveBeenCalled(); expect(mock.remove).not.toHaveBeenCalled(); expect(mock.reorder).not.toHaveBeenCalled();
  });
});
