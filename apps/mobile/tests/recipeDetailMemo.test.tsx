import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeDetailScreen from '@/features/recipes/screens/RecipeDetailScreen';
import RecipePriceSimulationScreen from '@/features/recipes/screens/RecipePriceSimulationScreen';
import type { RecipeDetail } from '@/features/recipes/hooks';

// 서버가 제공한 매장 시간대 fixture. 기기 시간대는 사용하지 않는다.
vi.mock('@/features/business-day/businessDay', () => ({
  useBusinessDay: () => ({ data: { timezone: 'Asia/Seoul' } }),
}));

const mock = vi.hoisted(() => ({
  detail: vi.fn(),
  save: vi.fn(),
  deactivate: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  routeId: 'r1',
}));

// RecipeDetailScreen, MemoEditSheet and kit controls are real. Only the domain
// hooks, router and Modal visibility are fixtures: these tests do not exercise a
// Supabase RPC or certify native animation, geometry, focus and IME behaviour.
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return {
    ...rn,
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
      visible ? <div data-testid="recipe-memo-modal">{children}</div> : null,
  };
});

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mock.routeId }),
  useRouter: () => ({ push: mock.push }),
  router: { canGoBack: () => false, replace: mock.replace, back: mock.back },
}));

vi.mock('@/features/recipes/hooks', () => ({
  useRecipeDetail: mock.detail,
  useSaveRecipe: () => ({ mutate: mock.save, isPending: false }),
  useDeactivateRecipe: () => ({ mutate: mock.deactivate, isPending: false }),
}));

vi.mock('@/features/recipes/profitHistory', () => ({
  deltaTone: () => 'flat',
  useProfitHistory: () => ({
    data: { pages: [{ items: [] }] },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/features/international-tax', () => ({
  useAppCapabilities: () => ({
    data: { internationalTax: { readEnabled: false, writeEnabled: false } },
    isLoading: false,
    error: null,
  }),
  useRecipeTaxState: () => ({ data: null, isLoading: false, error: null, refetch: vi.fn() }),
}));

vi.mock('@/features/international-tax/RecipeTaxStatusCard', () => ({
  RecipeTaxStatusCard: () => null,
}));

const recipe = (id: string, memo: string | null): RecipeDetail => ({
  id,
  name: id === 'r1' ? '첫 레시피' : '두 번째 레시피',
  price: id === 'r1' ? 12_000 : 15_000,
  active: true,
  sales30d: { qty: 4, revenue: 48_000, waste: 0 },
  memo,
  lastChange: {
    occurredAt: '2030-07-15T01:00:00Z',
    eventId: null,
    displayState: null,
    hasHistory: false,
  },
  taxMode: 'included',
  taxItems: [],
  taxBreakdown: [],
  tax: 0,
  baseServings: id === 'r1' ? 10 : 6,
  targetProfitRate: id === 'r1' ? 30 : 27,
  avgMonthlySales: id === 'r1' ? 40 : 22,
  materialCost: 2_000,
  extraCost: 0,
  fixedRate: 0.2,
  fixedMonth: '2030-07',
  fixedItems: [],
  categoryId: null,
  lines: [],
  extras: [],
});

const state = (data: RecipeDetail) => ({
  data,
  isLoading: false,
  isFetched: true,
  error: null,
  refetch: vi.fn(),
});

const modal = () => within(screen.getByTestId('recipe-memo-modal'));
const input = () => modal().getByRole('textbox', { name: '메모' }) as HTMLTextAreaElement;

function openMemo() {
  fireEvent.click(screen.getByRole('button', { name: '메모 수정' }));
  expect(modal().getByText('메모 수정')).toBeTruthy();
}

describe('RCP02 실제 상세 화면의 공용 메모 재조회 계약', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.routeId = 'r1';
    mock.detail.mockReturnValue(state(recipe('r1', '서버 원본 메모')));
  });

  it('판매 상태를 열거나 취소하면 쓰지 않고 확정만 정확한 ID를 한 번 변경한다', () => {
    render(<RecipeDetailScreen />);
    fireEvent.click(screen.getByRole('button', { name: '판매 중지' }));
    expect(modal().getByText('판매를 중지하시겠습니까?')).toBeTruthy();
    expect(mock.deactivate).not.toHaveBeenCalled();
    fireEvent.click(modal().getByRole('button', { name: '취소' }));
    expect(mock.deactivate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '판매 중지' }));
    const confirm = modal().getByRole('button', { name: '판매 중지' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(mock.deactivate).toHaveBeenCalledTimes(1);
    expect(mock.deactivate.mock.calls[0]?.[0]).toBe('r1');
  });

  it('시뮬레이션은 독립 화면으로 연결한다', () => {
    render(<RecipeDetailScreen />);
    fireEvent.click(screen.getByRole('button', { name: '판매가 시뮬레이션' }));
    expect(mock.push).toHaveBeenCalledWith('/recipes/price-simulation?id=r1');
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('확인창이 열린 뒤 판매 상태가 바뀌면 반대 작업을 임의 실행하지 않는다', () => {
    const view = render(<RecipeDetailScreen />);
    fireEvent.click(screen.getByRole('button', { name: '판매 중지' }));
    mock.detail.mockReturnValue(state({ ...recipe('r1', null), active: false }));
    view.rerender(<RecipeDetailScreen />);
    fireEvent.click(modal().getByRole('button', { name: '판매 중지' }));
    expect(mock.save).not.toHaveBeenCalled();
    expect(mock.deactivate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('recipe-memo-modal')).toBeNull();
  });

  it('전체 화면 시뮬레이션의 가격 입력·인분 전환은 실제 메뉴를 저장하지 않는다', () => {
    render(<RecipePriceSimulationScreen />);
    const price = screen.getByRole('textbox', { name: '시뮬레이션 판매가' }) as HTMLInputElement;
    expect(price.value).toBe('12000');
    fireEvent.change(price, { target: { value: '15000' } });
    expect(screen.getByText('10,000원')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '10인분' }));
    expect(screen.getByText('100,000원')).toBeTruthy();
    expect(mock.save).not.toHaveBeenCalled();
    expect(mock.deactivate).not.toHaveBeenCalled();
  });

  it('legacy 월평균 서버값은 정보 행·손익 탭으로 노출하지 않고 최근 30일 사실값만 유지한다', () => {
    render(<RecipeDetailScreen />);
    expect(screen.getByText('최근 30일 판매')).toBeTruthy();
    expect(screen.getByText('4인분')).toBeTruthy();
    expect(screen.queryByText('월 평균 판매량')).toBeNull();
    expect(screen.queryByRole('tab', { name: '월평균 기준' })).toBeNull();
  });

  it('수정하지 않은 열린 메모는 같은 레시피의 최신 재조회 값으로 갱신한다', () => {
    const { rerender } = render(<RecipeDetailScreen />);
    openMemo();
    expect(input().value).toBe('서버 원본 메모');

    mock.detail.mockReturnValue(state(recipe('r1', '재조회된 최신 메모')));
    rerender(<RecipeDetailScreen />);

    expect(input().value).toBe('재조회된 최신 메모');
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('작성 중인 열린 메모는 같은 레시피의 배경 재조회로 덮어쓰지 않는다', () => {
    const { rerender } = render(<RecipeDetailScreen />);
    openMemo();
    fireEvent.change(input(), { target: { value: '작성 중인 레시피 초안' } });

    mock.detail.mockReturnValue(state(recipe('r1', '재조회된 최신 메모')));
    rerender(<RecipeDetailScreen />);

    expect(input().value).toBe('작성 중인 레시피 초안');
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('dirty 초안을 취소한 뒤 다시 열면 재조회된 최신 메모를 표시한다', () => {
    const { rerender } = render(<RecipeDetailScreen />);
    openMemo();
    fireEvent.change(input(), { target: { value: '버릴 레시피 초안' } });

    mock.detail.mockReturnValue(state(recipe('r1', '재조회된 최신 메모')));
    rerender(<RecipeDetailScreen />);
    expect(input().value).toBe('버릴 레시피 초안');

    fireEvent.click(modal().getByRole('button', { name: '취소' }));
    expect(screen.queryByTestId('recipe-memo-modal')).toBeNull();
    openMemo();

    expect(input().value).toBe('재조회된 최신 메모');
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('메모가 같아도 레시피 ID가 바뀌면 이전 draft를 새 ID payload로 저장하지 않는다', () => {
    const sharedMemo = '두 레시피의 같은 서버 메모';
    mock.detail.mockReturnValue(state(recipe('r1', sharedMemo)));
    const { rerender } = render(<RecipeDetailScreen />);
    openMemo();
    fireEvent.change(input(), { target: { value: '첫 레시피에만 속한 초안' } });

    mock.routeId = 'r2';
    mock.detail.mockReturnValue(state(recipe('r2', sharedMemo)));
    rerender(<RecipeDetailScreen />);

    expect(input().value).toBe(sharedMemo);
    fireEvent.change(input(), { target: { value: '  두 번째 레시피 초안  ' } });
    fireEvent.click(modal().getByRole('button', { name: '완료' }));

    expect(mock.save).toHaveBeenCalledOnce();
    expect(mock.save.mock.calls[0]?.[0]).toEqual({
      id: 'r2',
      name: '두 번째 레시피',
      price: 15_000,
      baseServings: 6,
      targetProfitRate: 27,
      memo: '두 번째 레시피 초안',
    });
    expect(mock.save.mock.calls[0]?.[0]).not.toHaveProperty('avgMonthlySales');
    expect(mock.save.mock.calls[0]?.[0]).not.toMatchObject({ memo: '첫 레시피에만 속한 초안' });
  });
});
