import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import ManagementOrderScreen, { ManagementOrderPage } from '@/features/recipes/screens/ManagementOrderScreen';
import { moveOrderItem } from '@/components/kit/DragOrderList';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ManagementOrderAction } from '@/features/master-data/components/ManagementOrderAction';
import { orderItems, useItemOrder } from '@/features/master-data/useItemOrder';
import { checkIngredientDeletion } from '@/features/ingredients/deleteCheck';

const mock = vi.hoisted(() => ({ reorder: vi.fn(), save: vi.fn(), remove: vi.fn(), push: vi.fn(), back: vi.fn(), store: 'order-test-0', status: 'closed' as string | null }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mock.push }), useLocalSearchParams: () => ({ kind: 'recipe', target: 'item' }) }));
vi.mock('@/lib/nav', () => ({ safeBack: mock.back }));
vi.mock('@/features/ingredients/deleteCheck', () => ({ checkIngredientDeletion: vi.fn().mockResolvedValue({ canDelete: true, menuNames: [] }) }));
vi.mock('@/features/ingredients/hooks', () => ({ useIngredientList: vi.fn() }));
vi.mock('@/features/recipes/hooks', () => ({ useRecipeList: () => ({ data: [{id:'a', name:'메뉴', editRevision:'3'}], isLoading:false, refetch:vi.fn() }),
  useDeleteRecipe: () => ({mutateAsync:mock.remove}) }));
vi.mock('@/features/business-day/businessDay', () => ({ useBusinessDay: () => ({data:mock.status ? {status:mock.status} : undefined, refetch:vi.fn()}) }));
vi.mock('@/features/master-data/hooks', () => ({ useReorderCategories: () => ({ mutateAsync: mock.reorder }) }));
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => mock.store }));
vi.mock('react-native', async original => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div>{children}</div> : null,
}));
const rows = [{ id: 'a', name: '대파' }, { id: 'b', name: '계란' }];
let serial = 0;
beforeEach(() => { vi.clearAllMocks(); mock.status='closed'; mock.store = `order-test-${++serial}`; mock.reorder.mockResolvedValue(undefined); mock.save.mockResolvedValue(undefined); mock.remove.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => { vi.mocked(checkIngredientDeletion).mockResolvedValue({ canDelete: true, menuNames: [] }); });
const open = (label: string) => {
  fireEvent.click(screen.getByRole('button', { name: /관리 메뉴 열기$/ }));
  fireEvent.click(screen.getByRole('button', { name: label }));
};


it.each(['ingredient', 'material', 'recipe'] as const)('%s 순서 선택은 별도 페이지로 이동한다', kind => {
  render(<ManagementOrderAction kind={kind} />);
  open('카테고리 편집'); expect(mock.push).toHaveBeenLastCalledWith('/recipes/manage-order?kind='+kind+'&target=category');
  open(kind === 'recipe' ? '메뉴 목록 편집' : kind === 'ingredient' ? '재료 목록 편집' : '부자재 목록 편집'); expect(mock.push).toHaveBeenLastCalledWith('/recipes/manage-order?kind='+kind+'&target=item');
});
const page = () => render(<ManagementOrderPage kind="ingredient" rows={rows} isLoading={false} error={null} onRetry={vi.fn()} onSave={mock.save} onDelete={mock.remove} />);
const confirmSave = async () => {
  await waitFor(() => {
    const button = screen.getByRole('button', { name: '저장' });
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.getAttribute('aria-disabled')).not.toBe('true');
  });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByText('저장하시겠습니까?')).toBeTruthy();
  fireEvent.click(screen.getAllByRole('button', { name: '저장' }).at(-1)!);
};
it.each(['ingredient', 'material', 'recipe'] as const)('%s 목록·카테고리 저장은 확인 전 쓰지 않고 취소하면 초안을 유지한다', async kind => {
  for (const category of [false, true]) {
    const view=render(<ManagementOrderPage kind={kind} category={category} rows={rows} isLoading={false} error={null}
      onRetry={vi.fn()} onSave={mock.save} />);
    expect(screen.queryByText('항목 순서는 이 기기에 저장돼요.')).toBeNull();
    fireEvent.keyDown(screen.getByLabelText('계란 순서 변경'), {key:'ArrowUp'});
    fireEvent.click(screen.getByRole('button',{name:'저장'}));
    expect(mock.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'저장 확인 닫기'}));
    expect(mock.save).not.toHaveBeenCalled();
    await confirmSave();
    await waitFor(()=>expect(mock.save).toHaveBeenCalledWith(['b','a']));
    view.unmount(); mock.save.mockClear();
  }
});
it.each(['open','break',null])('메뉴 삭제는 %s 상태에서 차단한다', status => {
  mock.status=status; render(<ManagementOrderScreen />);
  fireEvent.click(screen.getByRole('button',{name:'메뉴 삭제'}));
  expect(screen.queryByText('삭제하시겠습니까?')).toBeNull();
  expect(mock.remove).not.toHaveBeenCalled();
});
it.each(['before_open','closed'])('메뉴 삭제는 %s에서 확인 후 기준판본을 전송한다', async status => {
  mock.status=status; render(<ManagementOrderScreen />);
  fireEvent.click(screen.getByRole('button',{name:'메뉴 삭제'}));
  expect(mock.remove).not.toHaveBeenCalled();
  expect(screen.getByText(/삭제 시, 복구가 불가합니다\./)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'삭제'}));
  await waitFor(()=>expect(mock.remove).toHaveBeenCalledWith({id:'a',revision:'3'}));
});
it('순서 변경 후 취소는 저장하지 않고, 저장 실패 후 초안을 유지해 재시도한다', async () => {
  const view = page();
  fireEvent.keyDown(screen.getByLabelText('계란 순서 변경'), { key: 'ArrowUp' });
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  expect(mock.back).toHaveBeenCalled(); expect(mock.save).not.toHaveBeenCalled();
  view.unmount(); page();
  mock.save.mockRejectedValueOnce(new Error('storage full'));
  fireEvent.keyDown(screen.getByLabelText('계란 순서 변경'), { key: 'ArrowUp' });
  await confirmSave();
  await screen.findByText('순서를 저장하지 못했어요. 다시 시도해 주세요.');
  expect(mock.save).toHaveBeenLastCalledWith(['b', 'a']);
  await confirmSave();
  await waitFor(() => expect(mock.save).toHaveBeenCalledTimes(2));
});
it('이동 순서는 중간 항목을 유지하며 경계 밖 이동은 무시한다', () => {
  expect(moveOrderItem(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'd', 'a']);
  expect(moveOrderItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
});

it('같은 목록에 드래그와 삭제가 있으며 삭제 확인 취소는 쓰지 않는다', () => {
  page();
  expect(screen.queryByRole('tab')).toBeNull();
  expect(screen.getByLabelText('대파 순서 변경')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '대파 삭제' }));
  expect(mock.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '삭제 확인 닫기' }));
  expect(mock.remove).not.toHaveBeenCalled();
  expect(mock.save).not.toHaveBeenCalled();
});

it.each(['ingredient', 'material', 'recipe'] as const)('%s 사용 중 카테고리는 차단 이유를 안내하고 빈 카테고리는 확인 후 삭제한다', async kind => {
  render(<ManagementOrderPage kind={kind} category rows={[{ ...rows[0]!, usedCount: 3, deleteBlocked: '사용 중인 카테고리' }, rows[1]!]}
    isLoading={false} error={null} onRetry={vi.fn()} onSave={mock.save} onDelete={mock.remove} />);
  fireEvent.click(screen.getByRole('button', { name: '대파 삭제' }));
  expect(screen.queryByText('삭제하시겠습니까?')).toBeNull();
  expect(screen.getByText('현재, 삭제가 불가능한 카테고리입니다')).toBeTruthy();
  expect(screen.getByText('3개')).toBeTruthy();
  expect(screen.queryByText(/삭제 시, 복구가 불가합니다\./)).toBeNull();
  expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '확인' }));
  expect(mock.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '계란 삭제' }));
  expect(screen.getByText('삭제하시겠습니까?')).toBeTruthy();
  expect(screen.getByText(/삭제 시, 복구가 불가합니다\./)).toBeTruthy();
  expect(mock.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  await screen.findByText('계란을(를) 삭제했어요.');
  expect(mock.remove).toHaveBeenCalledWith('b');
  expect(screen.queryByRole('button', { name: '계란 삭제' })).toBeNull();
});

it('재료 목록 편집의 삭제도 상세와 같은 사용 메뉴 안내를 표시한다', async () => {
  vi.mocked(checkIngredientDeletion).mockResolvedValue({ canDelete: false, menuNames: ['김치찌개', '판매 중지 메뉴'] });
  page(); fireEvent.click(screen.getByRole('button', { name: '대파 삭제' }));
  await screen.findByText('김치찌개');
  expect(screen.getByText('현재, 삭제가 불가능한 식재료입니다')).toBeTruthy();
  expect(screen.getByText('사용 중인 메뉴')).toBeTruthy();
  expect(screen.getByText('2개')).toBeTruthy();
  expect(screen.getByText('판매 중지 메뉴')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
  expect(mock.remove).not.toHaveBeenCalled();
});

it('삭제 실패는 행과 순서 초안을 유지하고 성공 후 남은 행 순서만 저장한다', async () => {
  mock.remove.mockRejectedValueOnce(new Error('연결을 확인해 주세요.')).mockResolvedValue(undefined);
  const extraRows = [...rows, { id: 'c', name: '양파' }];
  render(<ManagementOrderPage kind="ingredient" rows={extraRows} isLoading={false} error={null} onRetry={vi.fn()} onSave={mock.save} onDelete={mock.remove} />);
  fireEvent.keyDown(screen.getByLabelText('양파 순서 변경'), { key: 'ArrowUp' });
  fireEvent.keyDown(screen.getByLabelText('양파 순서 변경'), { key: 'ArrowUp' });
  fireEvent.click(screen.getByRole('button', { name: '대파 삭제' }));
  fireEvent.click(await screen.findByRole('button', { name: '삭제' }));
  await screen.findByText('대파: 연결을 확인해 주세요.');
  expect(screen.getByRole('button', { name: '대파 삭제' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '대파 삭제' }));
  fireEvent.click(await screen.findByRole('button', { name: '삭제' }));
  await screen.findByText('대파을(를) 삭제했어요.');
  await confirmSave();
  await waitFor(() => expect(mock.save).toHaveBeenCalledWith(['c', 'b']));
  expect(mock.remove.mock.calls.map(call => call[0])).toEqual(['a', 'a']);
});

it('기기 순서는 같은 매장의 여러 화면·재진입에 공유되고 다른 매장에는 섞이지 않는다', async () => {
  const first = renderHook(() => useItemOrder('ingredient'));
  const second = renderHook(() => useItemOrder('ingredient'));
  await act(() => first.result.current.save(['b', 'a']));
  expect(second.result.current.ids).toEqual(['b', 'a']);
  expect(JSON.parse(localStorage.getItem(`master-item-order.v1.${mock.store}.ingredient`)!)).toEqual(['b', 'a']);
  first.unmount();
  expect(renderHook(() => useItemOrder('ingredient')).result.current.ids).toEqual(['b', 'a']);
  mock.store = 'another-store'; second.rerender(); expect(second.result.current.ids).toEqual([]);
});

it('저장 공간 오류에서는 적용했다고 표시하지 않으며 신규·삭제 항목은 안전하게 정렬한다', async () => {
  const hook = renderHook(() => useItemOrder('material'));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await expect(hook.result.current.save(['b', 'a'])).rejects.toThrow('quota');
  expect(hook.result.current.ids).toEqual([]);
  expect(orderItems([...rows, { id: 'new', name: '새 항목' }], ['deleted', 'b', 'a']).map(row => row.id)).toEqual(['b', 'a', 'new']);
});
