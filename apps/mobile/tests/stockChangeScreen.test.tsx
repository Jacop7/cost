import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StockChangeScreen } from '@/features/ingredients/screens/StockChangeScreen';

const m = vi.hoisted(() => ({ mode: 'deduct', unit: 'g', stock: 812, pending: false, save: vi.fn(), replace: vi.fn() }));
vi.mock('react-native', async original => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <>{children}</> : null };
});
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'g1', mode: m.mode }),
  useRouter: () => ({ replace: m.replace }), router: { canGoBack: () => false, replace: m.replace } }));
vi.mock('@/features/ingredients/hooks', () => ({
  useIngredientDetail: () => ({ data: { id: 'g1', name: '고춧가루', stockTotal: m.stock, basePrice: 28, baseUnit: m.unit }, isLoading: false, error: null }),
  useStockChange: () => ({ mutate: m.save, isPending: m.pending }),
}));
// 입고 본체는 quickInbound.test에서 실제 컴포넌트를 별도 검사한다.
vi.mock('@/features/ingredients/screens/QuickInboundScreen', () => ({ QuickInboundScreen: ({ editLayout }: { editLayout: boolean }) => <div>{editLayout ? '입고 실제 폼 연결' : '레거시 입고'}</div> }));
const fill = (name: string, value: string) => fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
describe('재고 수정 페이지: E1/E5/E2 분리와 mock 저장', () => {
  beforeEach(() => { vi.clearAllMocks(); m.mode = 'deduct'; m.unit = 'g'; m.stock = 812; m.pending = false; });
  it('기본 진입은 실제 입고 폼의 editLayout을 사용한다', () => {
    m.mode = ''; render(<StockChangeScreen />); expect(screen.getByText('입고 실제 폼 연결')).toBeTruthy(); expect(m.save).not.toHaveBeenCalled();
  });
  it('탭 순서와 이동은 입고·차감·폐기이며 이동 자체는 저장하지 않는다', () => {
    render(<StockChangeScreen />);
    expect(screen.getAllByRole('tab').map(x => x.textContent)).toEqual(['입고', '차감', '폐기']);
    fireEvent.click(screen.getByRole('tab', { name: '폐기' }));
    expect(m.replace).toHaveBeenCalledWith('/ingredients/add-stock/g1?mode=waste'); expect(m.save).not.toHaveBeenCalled();
  });
  it('차감은 사유 필수이며 g단위 목표 재고를 E5에 넘긴다', () => {
    render(<StockChangeScreen />); fill('차감할 수량', '120');
    const save = screen.getByRole('button', { name: '재고 차감' });
    fireEvent.click(save); expect(m.save).not.toHaveBeenCalled();
    fill('차감 사유', '  조리 중 사용  '); fireEvent.click(save);
    expect(m.save).toHaveBeenCalledWith({ ingredientId: 'g1', kind: 'adj', value: 692, reason: '조리 중 사용' }, expect.any(Object));
  });
  it.each(['ml', 'ea'])('%s도 중복환산 없이 기준단위로 차감한다', unit => {
    m.unit = unit; render(<StockChangeScreen />); fill('차감할 수량', '2'); fill('차감 사유', '실사');
    fireEvent.click(screen.getByRole('button', { name: '재고 차감' }));
    expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ value: 810 }), expect.any(Object));
  });
  it('과다 차감은 0으로 잘라 저장하지 않는다', () => {
    render(<StockChangeScreen />); fill('차감할 수량', '900'); fill('차감 사유', '실사');
    expect(screen.getByText('현재 재고 이내의 수량을 입력해 주세요')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '재고 차감' })); expect(m.save).not.toHaveBeenCalled();
  });
  it('음수 차감 입력을 양수로 바꿔 저장하지 않는다', () => {
    render(<StockChangeScreen />); fill('차감할 수량', '-120'); fill('차감 사유', '실사');
    expect((screen.getByRole('textbox', { name: '차감할 수량' }) as HTMLInputElement).value).toBe('-120');
    fireEvent.click(screen.getByRole('button', { name: '재고 차감' })); expect(m.save).not.toHaveBeenCalled();
  });
  it('음수 현재재고를 숨기거나 0으로 보정하지 않는다', () => {
    m.stock = -100; render(<StockChangeScreen />); expect(screen.getAllByText('−100g').length).toBeGreaterThan(0);
    fill('차감할 수량', '10'); fill('차감 사유', '실사'); fireEvent.click(screen.getByRole('button', { name: '재고 차감' })); expect(m.save).not.toHaveBeenCalled();
  });
  it('폐기는 차감과 구분된 E2 남은양 계약이며 지원하지 않는 사유를 저장했다고 하지 않는다', () => {
    m.mode = 'waste'; render(<StockChangeScreen />); fill('폐기할 수량', '120');
    expect(screen.getByText(/현재 저장 계약에서 지원하지 않습니다/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '폐기 기록' }));
    expect(m.save).toHaveBeenCalledWith({ ingredientId: 'g1', kind: 'waste', value: 692, reason: '' }, expect.any(Object));
  });
  it('저장중에는 중복 저장과 탭 전환을 막는다', () => {
    m.pending = true; render(<StockChangeScreen />); fill('차감할 수량', '120'); fill('차감 사유', '실사');
    fireEvent.click(screen.getByRole('button', { name: '재고 차감' })); fireEvent.click(screen.getByRole('tab', { name: '입고' }));
    expect(m.save).not.toHaveBeenCalled(); expect(m.replace).not.toHaveBeenCalled();
  });
  it('서버 오류 때만 오류 안내를 열고 초안을 보존한다', () => {
    m.save.mockImplementation((_input, callbacks) => callbacks.onError(new Error('저장 거절')));
    render(<StockChangeScreen />); fill('차감할 수량', '120'); fill('차감 사유', '실사');
    fireEvent.click(screen.getByRole('button', { name: '재고 차감' })); expect(screen.getByText('저장 거절')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: '차감할 수량' }) as HTMLInputElement).value).toBe('120'); expect(m.replace).not.toHaveBeenCalled();
  });
  it('제출 직후 중복 호출을 막고 화면을 떠난 뒤 늦은 성공은 다른 화면을 이동시키지 않는다', () => {
    m.save.mockReset();
    const { unmount } = render(<StockChangeScreen />); fill('차감할 수량', '120'); fill('차감 사유', '실사');
    const button = screen.getByRole('button', { name: '재고 차감' }); fireEvent.click(button); fireEvent.click(button);
    expect(m.save).toHaveBeenCalledOnce();
    const callbacks = m.save.mock.calls[0]?.[1]; unmount(); callbacks.onSuccess({ skipped: false });
    expect(m.replace).not.toHaveBeenCalled();
  });
});
