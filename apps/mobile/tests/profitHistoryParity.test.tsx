import { createElement, type ReactNode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfitHistoryScreen from '@/features/recipes/screens/ProfitHistoryScreen';
import { formatProfitDeltaAmount, ProfitChangeRow } from '@/features/recipes/components/ProfitChangeRow';
import type { ProfitChange } from '@/features/recipes/profitHistory';
import { monthLabel } from '@/features/changes';

// 서버가 제공한 매장 시간대 fixture. 기기 시간대는 사용하지 않는다.
vi.mock('@/features/business-day/businessDay', () => ({
  useBusinessDay: () => ({ data: { timezone: 'Asia/Seoul' } }),
}));

const mock = vi.hoisted(() => ({
  history: vi.fn(), next: vi.fn(), retry: vi.fn(), replace: vi.fn(), back: vi.fn(),
  onScroll: undefined as undefined | ((event: {
    nativeEvent: {
      layoutMeasurement: { height: number };
      contentOffset: { y: number };
      contentSize: { height: number };
    };
  }) => void),
}));

vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return {
    ...rn,
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
      visible ? <div data-testid="profit-history-modal">{children}</div> : null,
    ScrollView: (props: React.ComponentProps<typeof rn.ScrollView>) => {
      if (props.onScroll) mock.onScroll = props.onScroll as typeof mock.onScroll;
      return createElement(rn.ScrollView, props);
    },
  };
});
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'recipe-profit-fixture' }),
  router: { canGoBack: () => false, replace: mock.replace, back: mock.back },
}));
vi.mock('@/features/recipes/profitHistory', async (original) => ({
  ...await original<typeof import('@/features/recipes/profitHistory')>(),
  useProfitHistory: mock.history,
}));

const up: ProfitChange = {
  id: 'profit-up', occurredAt: '2030-08-20T05:41:00Z', title: '고촧가루 단가 반영',
  summary: '재료비 32원 감소', sourceLabel: '고촧가루',
  cause: { key: 'material_cost', label: '재료비', before: 2_838.4, after: 2_806.4 },
  profitBefore: 4_014.69, profitAfter: 4_046.69, profitDelta: 32,
  rateBefore: 33.46, rateAfter: 33.72,
};
const down: ProfitChange = {
  id: 'profit-down', occurredAt: '2030-08-18T07:02:00Z', title: '고정지출 반영',
  summary: '고정지출 36원 증가', sourceLabel: '고정지출 설정',
  cause: { key: 'fixed_cost', label: '고정지출', before: 3_720, after: 3_756 },
  profitBefore: 4_050.69, profitAfter: 4_014.69, profitDelta: -36,
  rateBefore: 33.76, rateAfter: 33.46,
};
const flat: ProfitChange = {
  id: 'profit-flat', occurredAt: '2030-07-30T01:12:00Z', title: '비교 기준 없음',
  summary: null, sourceLabel: null, cause: null,
  profitBefore: null, profitAfter: 3_500.5, profitDelta: 0,
  rateBefore: null, rateAfter: 29.5,
};

const firstPage = { items: [up, down], next: { occurredAt: down.occurredAt, id: down.id } };
const secondPage = { items: [flat], next: null };
const query = (overrides: Record<string, unknown> = {}) => ({
  data: { pages: [firstPage] }, isLoading: false, error: null,
  hasNextPage: true, isFetchingNextPage: false,
  fetchNextPage: mock.next, refetch: mock.retry, ...overrides,
});
const modal = () => within(screen.getByTestId('profit-history-modal'));
const row = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}.*순이익`) });
const scroll = (y: number) => {
  expect(mock.onScroll).toBeTypeOf('function');
  act(() => mock.onScroll!({ nativeEvent: {
    layoutMeasurement: { height: 500 }, contentOffset: { y }, contentSize: { height: 1_000 },
  } }));
};

// Actual ProfitHistoryScreen, common row/value components and kit hosts are
// rendered. Only the domain hook, router and native Modal visibility are mocked.
// No real RPC/cursor execution, native scroll reachability, font scaling,
// geometry or visual approval is certified by these RNW/jsdom assertions.
describe('RCP-16 실제 손익 변동 목록·시트·페이지 연결', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.onScroll = undefined;
    mock.next.mockResolvedValue(undefined); mock.retry.mockResolvedValue(undefined);
    mock.history.mockReturnValue(query());
  });

  it('공용 행 helper는 음수 반원 경계에서 RCP-16과 RCP-02의 기존 반올림 순서를 각각 보존한다', () => {
    expect(formatProfitDeltaAmount(-0.495, 'absolute-first')).toBe('1원');
    expect(formatProfitDeltaAmount(-0.495, 'signed-first')).toBe('0원');
  });

  it('상세 미리보기는 매장 날짜와 증감·변동 후 순이익을 구분하고 행 이동을 유지한다', () => {
    const open = vi.fn();
    render(<ProfitChangeRow item={{ ...down, occurredAt: '2030-08-18T16:02:00Z' }} last preview deltaRounding="signed-first" onPress={open} />);
    expect(screen.getByText('08/19')).toBeTruthy();
    expect(screen.getByText('−36원')).toBeTruthy();
    expect(screen.getByText('순이익 4,015원')).toBeTruthy();
    expect(screen.getByText('고정지출 36원 증가')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(open).toHaveBeenCalledOnce();
  });

  it('2개월을 서버 순서대로 묶고 up·down·flat과 원단위 won 반올림을 보존한다', () => {
    mock.history.mockReturnValue(query({ data: { pages: [firstPage, secondPage] }, hasNextPage: false }));
    render(<ProfitHistoryScreen />);
    expect(mock.history).toHaveBeenCalledWith('recipe-profit-fixture');
    const months = [monthLabel(up.occurredAt, 'Asia/Seoul'), monthLabel(flat.occurredAt, 'Asia/Seoul')];
    expect(months[0]).not.toBe(months[1]);
    expect(screen.getAllByText(new RegExp('^2030년 (7|8)월$')).map((node) => node.textContent)).toEqual(months);
    expect(within(row(up.title)).getByText('4,047원')).toBeTruthy();
    expect(within(row(up.title)).getByText('+32원')).toBeTruthy();
    expect(within(row(down.title)).getByText('4,015원')).toBeTruthy();
    expect(within(row(down.title)).getByText('−36원')).toBeTruthy();
    expect(within(row(flat.title)).getByText('3,501원')).toBeTruthy();
    expect(within(row(flat.title)).getByText('변동 없음')).toBeTruthy();
  });

  it('행을 누르면 선택한 서버 원인·순이익·비율 전후값을 공용 Sheet에 보이고 내부 닫기로 종료한다', () => {
    render(<ProfitHistoryScreen />);
    fireEvent.click(row(up.title));
    expect(modal().getByText('손익 변동 상세')).toBeTruthy();
    expect(modal().getByText(up.title)).toBeTruthy();
    expect(modal().getByText(/· 고촧가루$/)).toBeTruthy();
    expect(modal().getByText('변동 원인')).toBeTruthy();
    expect(modal().getByText('손익 결과')).toBeTruthy();
    expect(modal().getByText('2,838원')).toBeTruthy();
    expect(modal().getByText('2,806원')).toBeTruthy();
    expect(modal().getByText('4,015원')).toBeTruthy();
    expect(modal().getByText('4,047원')).toBeTruthy();
    expect(modal().getByText('33.46%')).toBeTruthy();
    expect(modal().getByText('33.72%')).toBeTruthy();
    const closes = modal().getAllByRole('button', { name: '닫기' });
    expect(closes.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(closes.at(-1)!);
    expect(screen.queryByTestId('profit-history-modal')).toBeNull();
  });

  it('비교 기준이 없는 행은 원인을 조작하지 않고 손익 전후의 이전값을 —로 보인 뒤 backdrop으로 닫는다', () => {
    mock.history.mockReturnValue(query({ data: { pages: [secondPage] }, hasNextPage: false }));
    render(<ProfitHistoryScreen />);
    fireEvent.click(row(flat.title));
    expect(modal().queryByText('변동 원인')).toBeNull();
    expect(modal().getByText('손익 결과')).toBeTruthy();
    expect(modal().getAllByText('—')).toHaveLength(2);
    expect(modal().getByText('3,501원')).toBeTruthy();
    expect(modal().getByText('29.50%')).toBeTruthy();
    fireEvent.click(modal().getAllByRole('button', { name: '닫기' })[0]!);
    expect(screen.queryByTestId('profit-history-modal')).toBeNull();
  });

  it('스크롤 임계점에서만 다음 페이지를 요청하고 fetching·마지막 상태에서 중복하지 않으며 기존 행을 유지한다', () => {
    const view = render(<ProfitHistoryScreen />);
    scroll(100); expect(mock.next).not.toHaveBeenCalled();
    scroll(300); expect(mock.next).toHaveBeenCalledOnce();

    mock.history.mockReturnValue(query({ isFetchingNextPage: true }));
    view.rerender(<ProfitHistoryScreen />);
    scroll(300); expect(mock.next).toHaveBeenCalledOnce();
    expect(row(up.title)).toBeTruthy(); expect(row(down.title)).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();

    mock.history.mockReturnValue(query({ data: { pages: [firstPage, secondPage] }, hasNextPage: false }));
    view.rerender(<ProfitHistoryScreen />);
    scroll(300); expect(mock.next).toHaveBeenCalledOnce();
    expect(row(up.title)).toBeTruthy(); expect(row(down.title)).toBeTruthy(); expect(row(flat.title)).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
