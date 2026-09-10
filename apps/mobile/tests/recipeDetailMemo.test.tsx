vi.mock('@/lib/SessionProvider', () => ({ useSessionState: () => ({ userId: 'recipe-actor-a' }), useStoreId: () => 'recipe-store-a' }));
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
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
  capabilities: vi.fn(),
  tax: vi.fn(),
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

vi.mock('expo-router', () => ({ useFocusEffect: (fn: () => void | (() => void)) => useEffect(fn, [fn]),
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
  useAppCapabilities: mock.capabilities,
  useRecipeTaxState: mock.tax,
}));

vi.mock('@/features/international-tax/RecipeTaxStatusCard', () => ({
  RecipeTaxStatusCard: () => null,
}));

const recipe = (id: string, memo: string | null): RecipeDetail => ({
  id, editRevision: '1',
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
    mock.capabilities.mockReturnValue({ data: { internationalTax: { readEnabled: false, writeEnabled: false } },
      isLoading: false, error: null, refetch: vi.fn() });
    mock.tax.mockReturnValue({ data: null, isLoading: false, error: null, refetch: vi.fn() });
  });

  it.each(['pending', 'error', 'cached-false-error', 'missing'] as const)(
    'capability %s 동안 legacy 세금·손익을 표시하지 않는다', status => {
    const refetch = vi.fn();
    mock.detail.mockReturnValue(state({ ...recipe('r1', null), taxItems: [{ name: '기존 세금', rate: 10 }] }));
    mock.capabilities.mockReturnValue({
      data: status === 'cached-false-error' ? { internationalTax: { readEnabled: false, writeEnabled: false } } : undefined,
      isLoading: status === 'pending', error: status.includes('error') ? new Error('capability unavailable') : null, refetch,
    });
    render(<RecipeDetailScreen />);
    expect(screen.queryByText('1,200원')).toBeNull();
    expect(screen.queryByText('순이익')).toBeNull();
    if (status === 'pending') expect(screen.getByText('불러오는 중이에요')).toBeTruthy();
    else {
      expect(screen.getByText('정보를 불러오지 못했어요')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
      expect(refetch).toHaveBeenCalledOnce();
    }
    expect(mock.save).not.toHaveBeenCalled();
  });

  it.each(['tax_inclusive', 'tax_exclusive', undefined] as const)(
    'F4-6 현재 quote의 %s 라벨만 사용하고 예약 basis로 대체하지 않는다', priceBasis => {
      mock.detail.mockReturnValue(state(recipe('r1', '메모')));
      mock.capabilities.mockReturnValue({ data: { internationalTax: { readEnabled: true, writeEnabled: false } },
        isLoading: false, error: null, refetch: vi.fn() });
      mock.tax.mockReturnValue({ data: { priceBasis: 'tax_inclusive',
        quote: { taxAmount: 1091, netSales: 10909, components: [] },
        quoteContext: priceBasis ? { market: { priceBasis } } : undefined },
        isLoading: false, error: null, refetch: vi.fn() });
      render(<RecipeDetailScreen />);
      if (priceBasis === 'tax_inclusive') expect(screen.getByText('(판매가 포함)')).toBeTruthy();
      else expect(screen.queryByText('(판매가 포함)')).toBeNull();
      if (priceBasis === 'tax_exclusive') expect(screen.getByText('(판매가 별도)')).toBeTruthy();
      else expect(screen.queryByText('(판매가 별도)')).toBeNull();
      openMemo(); expect(input().value).toBe('메모'); expect(mock.save).not.toHaveBeenCalled();
    });

  it('활성일 이전의 명시적 null quote는 서버 상세 세액으로 본문과 메모를 연다', () => {
    mock.detail.mockReturnValue(state({ ...recipe('r1', '서버 원본 메모'), tax: 1_091, taxItems: [{ name: '기존 세금', rate: 10 }] }));
    mock.capabilities.mockReturnValue({ data: { internationalTax: { readEnabled: true, writeEnabled: false } },
      isLoading: false, error: null, refetch: vi.fn() });
    mock.tax.mockReturnValue({ data: { quote: null }, isLoading: false, error: null, refetch: vi.fn() });
    render(<RecipeDetailScreen />);
    expect(screen.getByText('첫 레시피')).toBeTruthy();
    expect(screen.getAllByText('1,091원').length).toBeGreaterThan(0);
    expect(screen.queryByText('1,200원')).toBeNull();
    openMemo();
    expect(input().value).toBe('서버 원본 메모');
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('capability explicit false는 기존 세금 표시를 유지한다', () => {
    mock.detail.mockReturnValue(state({ ...recipe('r1', null), taxItems: [{ name: '기존 세금', rate: 10 }] }));
    render(<RecipeDetailScreen />);
    expect(screen.getAllByText('1,200원').length).toBeGreaterThan(0);
    expect(mock.tax).toHaveBeenCalledWith('r1', false);
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('capability가 활성으로 확인돼도 quote를 기다린 뒤 서버 세금만 표시한다', () => {
    mock.detail.mockReturnValue(state({ ...recipe('r1', null), taxItems: [{ name: '기존 세금', rate: 10 }] }));
    mock.capabilities.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
    const view = render(<RecipeDetailScreen />);
    expect(screen.queryByText('1,200원')).toBeNull();
    mock.capabilities.mockReturnValue({ data: { internationalTax: { readEnabled: true, writeEnabled: false } },
      isLoading: false, error: null, refetch: vi.fn() });
    mock.tax.mockReturnValue({ data: null, isLoading: true, error: null, refetch: vi.fn() });
    view.rerender(<RecipeDetailScreen />);
    expect(screen.getByText('불러오는 중이에요')).toBeTruthy();
    expect(screen.queryByText('1,200원')).toBeNull();
    mock.tax.mockReturnValue({ data: { priceBasis: 'tax_inclusive', quote: { taxAmount: 1091, netSales: 10909, components: [] } },
      isLoading: false, error: null, refetch: vi.fn() });
    view.rerender(<RecipeDetailScreen />);
    expect(screen.getAllByText('1,091원').length).toBeGreaterThan(0);
    expect(screen.queryByText('1,200원')).toBeNull();
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('활성 capability의 quote 조회 실패는 재시도를 제공하고 legacy로 대체하지 않는다', () => {
    const refetch = vi.fn();
    mock.detail.mockReturnValue(state({ ...recipe('r1', null), taxItems: [{ name: '기존 세금', rate: 10 }] }));
    mock.capabilities.mockReturnValue({ data: { internationalTax: { readEnabled: true, writeEnabled: false } },
      isLoading: false, error: null, refetch: vi.fn() });
    mock.tax.mockReturnValue({ data: null, isLoading: false, error: new Error('quote unavailable'), refetch });
    render(<RecipeDetailScreen />);
    expect(screen.queryByText('1,200원')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(mock.save).not.toHaveBeenCalled();
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
    expect(mock.save).toHaveBeenCalledTimes(1);
    expect(mock.save.mock.calls[0]?.[0]).toEqual({ patch: 'active', requestId: expect.any(String), id: 'r1', expectedRevision: '1', active: false });
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

  it('부자재가 없어도 빈 상태와 자세히 보기를 표시하고 관리 화면으로 이동한다', () => {
    render(<RecipeDetailScreen />);
    expect(screen.getByText('등록된 부자재가 없어요')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '부자재 자세히 보기' }));
    expect(mock.push).toHaveBeenCalledWith('/recipes/materials');
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('어느 인분 탭을 바꿔도 비용과 판매 손익이 함께 전환되며 저장하지 않는다', () => {
    render(<RecipeDetailScreen />);
    fireEvent.click(screen.getAllByRole('tab', { name: '10인분' })[0]!);
    expect(screen.getAllByText('20,000원').length).toBeGreaterThan(0);
    expect(screen.getByText('120,000원')).toBeTruthy();
    expect(screen.getAllByRole('tab', { name: '10인분' }).every(tab => tab.getAttribute('aria-selected') === 'true')).toBe(true);
    const oneTabs = screen.getAllByRole('tab', { name: '1인분' });
    fireEvent.click(oneTabs[oneTabs.length - 1]!);
    expect(screen.queryByText('120,000원')).toBeNull();
    expect(screen.getAllByText('2,000원').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('tab', { name: '1인분' }).every(tab => tab.getAttribute('aria-selected') === 'true')).toBe(true);
    expect(mock.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '판매가 시뮬레이션' }));
    expect(mock.push).toHaveBeenCalledWith('/recipes/price-simulation?id=r1');
  });

  it('legacy 월평균 서버값은 정보 행·손익 탭으로 노출하지 않고 최근 30일 사실값만 유지한다', () => {
    render(<RecipeDetailScreen />);
    expect(screen.getByText('최근 30일 기준')).toBeTruthy();
    expect(screen.getByText('판매 4 · 폐기 0')).toBeTruthy();
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

  it('저장 중 추가로 입력한 메모를 늦은 성공이 지우지 않고 별도 확인을 요구한다', async () => {
    const next = { ...recipe('r1', '전송한 메모'), editRevision: '2' };
    mock.detail.mockReturnValue({ ...state(recipe('r1', '서버 원본 메모')), refetch: vi.fn().mockResolvedValue({ data: next }) });
    render(<RecipeDetailScreen />); openMemo();
    fireEvent.change(input(), { target: { value: '전송한 메모' } });
    fireEvent.click(modal().getByRole('button', { name: '완료' }));
    fireEvent.change(input(), { target: { value: '나중에 입력한 메모' } });
    const [sent, callbacks] = mock.save.mock.calls[0]!;
    await act(async () => { callbacks.onSuccess('r1'); callbacks.onSettled(); });
    expect(sent).toEqual({ patch: 'memo', requestId: expect.any(String), id: 'r1', expectedRevision: '1', memo: '전송한 메모' });
    expect(input().value).toBe('나중에 입력한 메모');
    expect(modal().getByRole('button', { name: '완료' })).toHaveProperty('disabled', true);
    fireEvent.click(modal().getByRole('button', { name: '최신 내용 확인' }));
    expect(mock.save).toHaveBeenCalledTimes(1);
    fireEvent.click(modal().getByRole('button', { name: '완료' }));
    expect(mock.save.mock.calls[1]![0]).toMatchObject({ patch: 'memo', expectedRevision: '2', memo: '나중에 입력한 메모' });
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

    expect(screen.queryByTestId('recipe-memo-modal')).toBeNull();
    expect(mock.save).not.toHaveBeenCalled();
    openMemo();
    expect(input().value).toBe(sharedMemo);
    fireEvent.change(input(), { target: { value: '  두 번째 레시피 초안  ' } });
    fireEvent.click(modal().getByRole('button', { name: '완료' }));

    expect(mock.save).toHaveBeenCalledOnce();
    expect(mock.save.mock.calls[0]?.[0]).toEqual({
      id: 'r2',
      patch: 'memo', requestId: expect.any(String), expectedRevision: '1',
      memo: '두 번째 레시피 초안',
    });
    expect(mock.save.mock.calls[0]?.[0]).not.toHaveProperty('avgMonthlySales');
    expect(mock.save.mock.calls[0]?.[0]).not.toMatchObject({ memo: '첫 레시피에만 속한 초안' });
  });
});

// 0204 supplies the revision that makes these existing controls editable.
it('resumes a stopped recipe through a narrow versioned active patch', async () => {
  vi.resetAllMocks(); mock.routeId='r1';
  mock.capabilities.mockReturnValue({data:{internationalTax:{readEnabled:false}},isLoading:false,error:null,refetch:vi.fn()});
  mock.tax.mockReturnValue({data:null,isLoading:false,error:null,refetch:vi.fn()});
  mock.detail.mockReturnValue(state({ ...recipe('r1', null), active: false, editRevision: '9007199254740993' }));
  render(<RecipeDetailScreen />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '판매 재개' })); });
  expect(mock.save).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(modal().getByRole('button', { name: '판매 재개' })); });
  expect(mock.save.mock.calls[0]?.[0]).toEqual({ patch:'active', requestId:expect.any(String), id:'r1',
    expectedRevision:'9007199254740993', active:true });
});
