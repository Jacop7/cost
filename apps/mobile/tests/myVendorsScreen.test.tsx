import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MyVendorsScreen from '@/features/my/screens/MyVendorsScreen';

const mock = vi.hoisted(() => ({
  lists: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return {
    ...rn,
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
      visible ? <div data-testid="vendor-management-modal">{children}</div> : null,
  };
});
vi.mock('expo-router', () => ({
  router: { canGoBack: () => false, back: mock.back, replace: mock.replace },
}));
vi.mock('@/features/master-data/hooks', () => ({
  useSettingsLists: mock.lists,
  useSaveVendor: () => ({ mutate: mock.save, isPending: false }),
  useDeleteVendor: () => ({ mutate: mock.remove, isPending: false }),
}));

const vendors = [
  { id: 'vendor-a', name: '한빛 유통', usedCount: 3 },
  { id: 'vendor-b', name: '한빛유통', usedCount: 0 },
];
const modal = () => within(screen.getByTestId('vendor-management-modal'));
const changeName = (value: string) => fireEvent.change(
  modal().getByRole('textbox', { name: '구매처 이름' }),
  { target: { value } },
);

describe('MY-11 구매처 관리 실제 소비 계약', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.lists.mockReturnValue({
      data: { vendors },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    vi.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('구매처 목록과 사용 개수, 유사 이름 안내를 렌더한다', () => {
    render(<MyVendorsScreen />);

    expect(screen.getByText('구매처 2')).toBeTruthy();
    expect(screen.getByText('비슷한 이름이 있어요')).toBeTruthy();
    expect(screen.getByRole('button', { name: '한빛 유통 수정' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '한빛유통 수정' })).toBeTruthy();
    expect(screen.getByText('발주 3건')).toBeTruthy();
  });

  it('추가는 trim한 이름과 undefined ID를 보내고 성공하면 시트를 닫는다', () => {
    render(<MyVendorsScreen />);
    fireEvent.click(screen.getByRole('button', { name: '구매처 추가' }));
    expect(modal().getByText('구매처 추가')).toBeTruthy();

    changeName('  새 구매처  ');
    fireEvent.click(modal().getByRole('button', { name: '추가' }));

    expect(mock.save).toHaveBeenCalledOnce();
    expect(mock.save.mock.calls[0]?.[0]).toEqual({ id: undefined, name: '새 구매처' });
    expect(screen.getByTestId('vendor-management-modal')).toBeTruthy();
    act(() => mock.save.mock.calls[0]?.[1].onSuccess());
    expect(screen.queryByTestId('vendor-management-modal')).toBeNull();
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it('수정은 기존 이름을 채우고 선택한 구매처 ID와 새 이름을 보낸다', () => {
    render(<MyVendorsScreen />);
    fireEvent.click(screen.getByRole('button', { name: '한빛 유통 이름 변경' }));

    const input = modal().getByRole('textbox', { name: '구매처 이름' }) as HTMLInputElement;
    expect(input.value).toBe('한빛 유통');
    expect(modal().getByText(/이름을 바꾸면 과거 발주/)).toBeTruthy();
    changeName('  한빛 식자재  ');
    fireEvent.click(modal().getByRole('button', { name: '저장' }));

    expect(mock.save.mock.calls[0]?.[0]).toEqual({ id: 'vendor-a', name: '한빛 식자재' });
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it('삭제는 확인 전에는 변이하지 않고 확인한 구매처 ID만 삭제한다', () => {
    render(<MyVendorsScreen />);
    fireEvent.click(screen.getByRole('button', { name: '한빛 유통 삭제' }));

    expect(mock.remove).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      '한빛 유통 삭제',
      '발주 3건에 쓰인 구매처예요. 목록에서만 숨겨지고 과거 발주는 그대로 남아요.',
      expect.any(Array),
    );
    const actions = vi.mocked(Alert.alert).mock.calls[0]?.[2];
    const confirm = actions?.find((action) => action.text === '삭제');
    expect(confirm?.style).toBe('destructive');
    act(() => confirm?.onPress?.());
    expect(mock.remove).toHaveBeenCalledOnce();
    expect(mock.remove.mock.calls[0]?.[0]).toBe('vendor-a');
    expect(mock.save).not.toHaveBeenCalled();
  });
});
