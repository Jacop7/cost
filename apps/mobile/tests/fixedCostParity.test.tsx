vi.mock('@/features/changes/components/ConfigurationHistoryLink', () => ({
  ConfigurationHistoryLink: () => <div data-testid="fixed-cost-history-link">최근 변경</div>,
}));
import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FixedCostScreen from '@/features/my/screens/FixedCostScreen';
import FixedCostEditScreen from '@/features/my/screens/FixedCostEditScreen';
import FixedCostDetailScreen from '@/features/my/screens/FixedCostDetailScreen';
import FixedCostSettingsScreen from '@/features/my/screens/FixedCostSettingsScreen';
import {
  completedFixedMonths,
  previousFixedMonths,
  recentFixedMonths,
} from '@/features/my/components/FixedMonthPicker';
import type {
  FixedCostBasis,
  FixedCostConfiguration,
  FixedCosts,
  RevenueCheck,
} from '@/features/my/hooks';

const mock = vi.hoisted(() => ({
  fixed: vi.fn(),
  basis: vi.fn(),
  configuration: vi.fn(),
  sales: vi.fn(),
  check: vi.fn(),
  save: vi.fn(),
  saveBasis: vi.fn(),
  saveSettings: vi.fn(),
  cancelReentry: vi.fn(),
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  lists: vi.fn(),
  params: {} as { month?: string; mode?: string; reentry?: string },
}));
vi.mock('react-native', async (original) => ({
  ...(await original<typeof import('react-native')>()),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
    visible ? <div data-testid="fixed-modal">{children}</div> : null,
}));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => mock.params,
  useRouter: () => ({ push: mock.push, replace: mock.replace }),
}));
vi.mock('@/lib/nav', () => ({ safeBack: mock.back }));
vi.mock('@/features/business-day/businessDay', () => ({
  useStoreLocalDate: () => ({ date: '2030-01-03', isLoading: false, error: null }),
  useBusinessDay: () => ({ data: { status: 'none' } }),
}));
vi.mock('@/features/my/hooks', () => ({
  useFixedCosts: mock.fixed,
  useFixedCostBasis: mock.basis,
  useRevenueCheck: mock.check,
  useSaveFixedCosts: () => ({ mutate: mock.save, isPending: false }),
  useFixedCostConfiguration: mock.configuration,
  useSaveFixedCostBasis: () => ({ mutate: mock.saveBasis, isPending: false }),
  useSaveFixedCostSettings: () => ({ mutate: mock.saveSettings, isPending: false }),
  useCancelFixedCostReentry: () => ({ mutate: mock.cancelReentry, isPending: false }),
}));
vi.mock('@/features/master-data/hooks', () => ({ useSettingsLists: mock.lists }));
vi.mock('@/features/sales/hooks', () => ({ useSalesRange: mock.sales }));

const fixedData = (month: string): FixedCosts => ({
  month,
  entered: true,
  totalRevenue: month === '2029-12' ? 12000000 : 8000000,
  rate: 0.2,
  items: [
    {
      key: 'labor',
      mode: 'detail',
      total: 2400000,
      lines: [
        { name: '주방 이모', amount: 1700000 },
        { name: '홀 직원', amount: 700000 },
      ],
      weights: null,
    },
  ],
});
const checkData: RevenueCheck = {
  month: '2030-01',
  daysElapsed: 3,
  daysTotal: 31,
  inProgress: true,
  manualRevenue: 12000000,
  fixedTotal: 2400000,
  actualRevenue: 1500000,
  projectedRevenue: 15500000,
  gapPct: 29.16667,
  rateManual: 0.2,
  rateProjected: 0.1548,
  hasSales: true,
};
const query = <T,>(data: T) => ({ data, isLoading: false, error: null, refetch: vi.fn() });
const basisData = (): FixedCostBasis => ({
  targetMonth: '2030-01',
  basisMonths: 3,
  fromMonth: '2029-10',
  toMonth: '2029-12',
  enteredMonths: 1,
  missingMonths: ['2029-11', '2029-10'],
  applied: false,
  rate: null,
  averageRevenue: null,
  averageFixed: null,
  revision: 4,
  months: [
    {
      month: '2029-12',
      entered: true,
      totalRevenue: 12000000,
      totalFixed: 2400000,
      rate: 0.2,
      items: fixedData('2029-12').items,
    },
    {
      month: '2029-11',
      entered: false,
      totalRevenue: null,
      totalFixed: null,
      rate: null,
      items: [],
    },
    {
      month: '2029-10',
      entered: false,
      totalRevenue: null,
      totalFixed: null,
      rate: null,
      items: [],
    },
  ],
});
const completeBasisData = (): FixedCostBasis => {
  const complete = basisData();
  return {
    ...complete,
    enteredMonths: 3,
    missingMonths: [],
    applied: true,
    rate: 0.2,
    averageRevenue: 12000000,
    averageFixed: 2400000,
    months: complete.months.map((row) => ({
      ...row,
      entered: true,
      totalRevenue: 12000000,
      totalFixed: 2400000,
      rate: 0.2,
      items: fixedData(row.month).items,
    })),
  };
};
const configurationData = (): FixedCostConfiguration => ({
  requestedMonth: '2030-01',
  effectiveMonth: '2030-01',
  configured: true,
  currentRevision: 2,
  sourceRevision: 2,
  reentry: null,
  items: fixedData('2029-12').items.map((item) => ({
    ...item,
    weights: { hall: 30, delivery: 50, takeout: 20 },
  })),
});
const monthPicker = () => {
  fireEvent.click(screen.getByRole('button', { name: /2029년 12월 변경/ }));
  return within(screen.getByTestId('fixed-modal'));
};
const confirmSave = () =>
  fireEvent.click(within(screen.getByTestId('fixed-modal')).getByRole('button', { name: /^저장/ }));

describe('고정 지출 실제 화면·공용 월 선택·초안 보호', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.params = {};
    mock.fixed.mockImplementation((month: string) => query(fixedData(month)));
    mock.basis.mockReturnValue(query(basisData()));
    mock.configuration.mockReturnValue(query(configurationData()));
    mock.sales.mockReturnValue(
      query({
        channels: [
          { code: 'hall', name: '매장', amount: 6000000 },
          { code: 'delivery', name: '배달', amount: 3000000 },
          { code: 'takeout', name: '포장', amount: 1000000 },
        ],
      }),
    );
    mock.check.mockReturnValue(query(checkData));
    mock.lists.mockReturnValue(
      query({
        channels: [
          { code: 'hall', name: '매장', active: true },
          { code: 'delivery', name: '배달', active: true },
          { code: 'takeout', name: '포장', active: true },
        ],
      }),
    );
  });
  afterEach(cleanup);

  it('최근 월은 서버 월을 기준으로 연도를 넘고 미래 월을 넣지 않는다', () => {
    expect(recentFixedMonths('2030-01')).toEqual([
      '2030-01',
      '2029-12',
      '2029-11',
      '2029-10',
      '2029-09',
      '2029-08',
    ]);
    expect(previousFixedMonths('2030-01')).toEqual(['2029-12', '2029-11', '2029-10']);
    expect(completedFixedMonths('2030-01')).toEqual([
      '2029-12',
      '2029-11',
      '2029-10',
      '2029-09',
      '2029-08',
      '2029-07',
      '2029-06',
      '2029-05',
      '2029-04',
      '2029-03',
      '2029-02',
      '2029-01',
    ]);
  });
  it('고정 지출 화면의 설정 버튼은 독립 설정 페이지로 연결한다', () => {
    render(<FixedCostScreen />);
    fireEvent.click(screen.getByRole('button', { name: '설정' }));
    expect(mock.push).toHaveBeenCalledWith('/recipes/fixed-cost-settings');
  });
  it('고정 지출 현황은 최근 변경을 첫 카드로 표시한다', () => {
    render(<FixedCostScreen />);
    const recent = screen.getByTestId('fixed-cost-history-link');
    const status = screen.getByText('고정 지출 적용');
    expect(recent.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('고정 지출 입력·수정 버튼은 대상 월 선택 레이어를 먼저 연다', () => {
    render(<FixedCostScreen />);
    fireEvent.click(screen.getByRole('button', { name: '고정 지출 입력 / 수정' }));
    const picker = within(screen.getByTestId('fixed-modal'));
    expect(picker.getByText('고정 지출 입력 / 수정')).toBeTruthy();
    expect(picker.getByText('입력 완료 · 수정')).toBeTruthy();
    expect(picker.getAllByText('미 입력 · 입력')).toHaveLength(2);
    fireEvent.click(picker.getByRole('button', { name: '2029년 12월 수정' }));
    expect(mock.push).toHaveBeenLastCalledWith('/recipes/fixed-cost-edit?month=2029-12');
  });
  it('설정 페이지가 평균 기간과 고정 지출 항목 구성을 함께 관리한다', () => {
    render(<FixedCostSettingsScreen />);
    expect(screen.queryByTestId('fixed-cost-history-link')).toBeNull();
    expect(screen.getByText('고정 지출 기준')).toBeTruthy();
    expect(screen.queryByText('이번 달을 제외한 완료 월의 평균 고정 지출률을 사용해요.')).toBeNull();
    expect(screen.getByTestId('fixed-cost-settings-section-divider')).toBeTruthy();
    expect(screen.getByText('당월 제외 최근 3개월')).toBeTruthy();
    expect(screen.getByText('2029년 10월 ~ 12월')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /고정 지출 기준 당월 제외 최근 3개월/ }));
    expect(screen.getByText('고정 지출 기준 선택')).toBeTruthy();
    expect(screen.getByText('당월 제외 최근 1개월')).toBeTruthy();
    expect(screen.getByText('2029년 12월')).toBeTruthy();
    expect(screen.getByText('당월 제외 최근 2개월')).toBeTruthy();
    expect(screen.getByText('2029년 11월 ~ 12월')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.getByText('고정 지출 항목 구성')).toBeTruthy();
    expect(
      screen.getByText(
        '수정 시 당월을 제외한 최근 3개월(10월~12월)의 고정 지출 내역이 초기화되므로 다시 입력해 주셔야 합니다.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('5개')).toBeNull();
    expect(screen.queryByText(/이번 달부터 적용/)).toBeNull();
    expect(
      (screen.getByRole('textbox', { name: '인건비 세부 항목 1' }) as HTMLInputElement).value,
    ).toBe('주방 이모');
    expect(
      (screen.getByRole('textbox', { name: '인건비 세부 항목 2' }) as HTMLInputElement).value,
    ).toBe('홀 직원');
    expect(screen.queryByText('매장 30% · 배달 50% · 포장 20%')).toBeNull();
    expect(
      (screen.getByRole('textbox', { name: '인건비 항목명' }) as HTMLInputElement).value,
    ).toBe('인건비');
    const cardHandle = screen.getByLabelText('인건비 카드 순서 변경');
    const cardInput = screen.getByRole('textbox', { name: '인건비 항목명' });
    expect(cardHandle.compareDocumentPosition(cardInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(getComputedStyle(cardHandle).width).toBe('100%');
    expect((cardHandle.firstElementChild as HTMLElement).style.transform).toContain('rotate(90deg)');
    expect(screen.queryByRole('button', { name: '인건비 항목 수정' })).toBeNull();
    expect(screen.queryByTestId('fixed-modal')).toBeNull();
    expect(
      screen.queryByText(/모든 월의 입력을 마치기 전까지는 기존 항목과 계산 기준/),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: '수정 취소' })).toBeNull();
    expect(screen.queryByRole('button', { name: '변경 중단' })).toBeNull();
  });
  it('설정 카드에서 세부 항목을 직접 입력·추가·삭제한다', () => {
    render(<FixedCostSettingsScreen />);
    fireEvent.change(screen.getByRole('textbox', { name: '인건비 세부 항목 1' }), {
      target: { value: '주방 정직원' },
    });
    fireEvent.click(screen.getByRole('button', { name: '인건비 지출 항목 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '인건비 세부 항목 3' }), {
      target: { value: '주말 보조' },
    });
    fireEvent.click(screen.getByRole('button', { name: '인건비 세부 항목 2 삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    confirmSave();
    expect(mock.saveSettings.mock.calls[0]![0].items[0].lines).toEqual([
      { name: '주방 정직원', amount: 0 },
      { name: '주말 보조', amount: 0 },
    ]);
  });
  it('설정 카드와 카드 안 입력칸의 순서를 바꾸고 불필요한 설명은 표시하지 않는다', () => {
    const base = configurationData();
    mock.configuration.mockReturnValue(
      query({
        ...base,
        items: [
          ...base.items,
          {
            key: 'rent',
            label: '임대료',
            mode: 'total' as const,
            total: 0,
            lines: [],
            weights: null,
          },
        ],
      }),
    );
    render(<FixedCostSettingsScreen />);

    expect(screen.queryByText('세부 입력')).toBeNull();
    expect(screen.queryByText('세부 항목 2개')).toBeNull();

    expect(
      (screen.getByRole('textbox', { name: '인건비 항목명' }) as HTMLInputElement).value,
    ).toBe('인건비');
    expect(screen.queryByRole('button', { name: '인건비 항목 수정' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: '임대료 항목명' }), {
      target: { value: '임차료' },
    });
    fireEvent.keyDown(screen.getByLabelText('인건비 세부 항목 1 순서 변경'), {
      key: 'ArrowDown',
    });
    fireEvent.keyDown(screen.getByLabelText('인건비 카드 순서 변경'), { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    confirmSave();

    expect(mock.saveSettings.mock.calls[0]![0].items.map((item: { key: string }) => item.key)).toEqual([
      'rent',
      'labor',
    ]);
    expect(mock.saveSettings.mock.calls[0]![0].items[0].label).toBe('임차료');
    expect(mock.saveSettings.mock.calls[0]![0].items[1].lines).toEqual([
      { name: '홀 직원', amount: 0 },
      { name: '주방 이모', amount: 0 },
    ]);
  });
  it('조회는 이번 달을 제외한 3개월 입력 상태와 미적용 사유를 표시한다', () => {
    render(<FixedCostScreen />);
    expect(screen.getByText('고정 지출 적용')).toBeTruthy();
    expect(screen.getByText('최근 3개월')).toBeTruthy();
    expect(screen.getByText('평균 고정 지출률')).toBeTruthy();
    expect(screen.getByText('고정 지출률')).toBeTruthy();
    expect(screen.getAllByText('미산출').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('최근 3개월 고정 지출')).toBeTruthy();
    expect(screen.getByText('인건비')).toBeTruthy();
    expect(screen.queryByText('(−) 인건비')).toBeNull();
    expect(screen.getByText('고정 지출 합계')).toBeTruthy();
    expect(screen.getAllByText('0%')).toHaveLength(2);
    expect(screen.queryByText('월별 입력 내역')).toBeNull();
    expect(screen.queryByText('이번 달을 제외한 완료 월만 기준에 포함해요.')).toBeNull();
    expect(screen.getByText('1/3개월')).toBeTruthy();
    expect(screen.getByText('미적용')).toBeTruthy();
    expect(screen.getByText('년/월')).toBeTruthy();
    expect(screen.getAllByText('미 입력')).toHaveLength(2);
    expect(screen.getByText('매출 12,000,000원')).toBeTruthy();
    expect(screen.getByText('고정 지출 2,400,000원')).toBeTruthy();
    expect(screen.getAllByText('매출 0원')).toHaveLength(2);
    expect(screen.getAllByText('고정 지출 0원')).toHaveLength(2);
    expect(screen.queryByText('입력 필요')).toBeNull();
    expect(screen.queryByText('현재 적용 기준')).toBeNull();
    expect(screen.queryByText('자료 부족')).toBeNull();
    expect(
      screen.queryByText('3개월 평균을 산출하려면 2개월치 고정 지출 내역을 추가로 입력해 주세요.'),
    ).toBeNull();
    expect(
      screen.getByText(
        '고정지출을 모두 입력하기 전까지는 메뉴 손익에 고정 지출이 반영되지 않습니다.',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('fixed-cost-missing-notice')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '월별 고정 지출 자세히 보기' })).toBeNull();
    expect(screen.queryByRole('button', { name: '최근 고정 지출 항목 자세히 보기' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '2029년 11월 상세' }));
    expect(mock.push).toHaveBeenCalledWith('/recipes/fixed-cost-detail?month=2029-11');
  });
  it('입력 완료 상태는 두 요약 카드의 자세히 보기를 실제 하위 화면으로 연결한다', () => {
    mock.basis.mockReturnValue(query(completeBasisData()));
    render(<FixedCostScreen />);

    fireEvent.click(screen.getByRole('button', { name: '2029년 12월 상세' }));
    expect(mock.push).toHaveBeenLastCalledWith('/recipes/fixed-cost-detail?month=2029-12');
    fireEvent.click(screen.getByRole('button', { name: '월별 고정 지출 자세히 보기' }));
    expect(mock.push).toHaveBeenLastCalledWith('/recipes/fixed-cost-detail?month=2029-12');
    fireEvent.click(screen.getByRole('button', { name: '최근 고정 지출 항목 자세히 보기' }));
    expect(mock.push).toHaveBeenLastCalledWith('/recipes/fixed-cost-detail?mode=average');
  });
  it('월별 상세는 입력값을 먼저 보여주고 하단 수정으로만 편집 화면에 진입한다', () => {
    mock.params = { month: '2029-12' };
    render(<FixedCostDetailScreen />);
    expect(screen.getAllByText('2029년 12월')).toHaveLength(2);
    expect(screen.getByText('12,000,000원')).toBeTruthy();
    expect(screen.getAllByText('2,400,000원').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('주방 이모')).toBeTruthy();
    expect(screen.getByText('홀 직원')).toBeTruthy();
    expect(screen.queryByText('채널 비중')).toBeNull();
    expect(screen.queryByText(/매장 60%/)).toBeNull();
    expect(screen.getByRole('button', { name: '년/월 2029년 12월 변경' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    expect(mock.push).toHaveBeenLastCalledWith('/recipes/fixed-cost-edit?month=2029-12');
  });
  it('미입력 월도 월별 상세를 먼저 보여주고 하단 입력으로 입력 화면에 진입한다', () => {
    mock.params = { month: '2029-11' };
    render(<FixedCostDetailScreen />);
    expect(screen.getByText('월별 고정 지출 상세')).toBeTruthy();
    expect(screen.getAllByText('2029년 11월')).toHaveLength(2);
    expect(screen.getAllByText('0원').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('미산출')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '입력' }));
    expect(mock.push).toHaveBeenLastCalledWith('/recipes/fixed-cost-edit?month=2029-11');
  });
  it('월별 상세의 년월 선택은 완료 월 12개만 최신순으로 보여주고 월 이동 기록을 쌓지 않는다', () => {
    mock.params = { month: '2029-12' };
    render(<FixedCostDetailScreen />);

    fireEvent.click(screen.getByRole('button', { name: '년/월 2029년 12월 변경' }));
    const picker = within(screen.getByTestId('fixed-modal'));
    expect(picker.getByText('년/월 선택')).toBeTruthy();
    expect(picker.getByText('2029년 12월')).toBeTruthy();
    expect(picker.getByText('2029년 1월')).toBeTruthy();
    expect(picker.queryByText('2030년 1월')).toBeNull();

    fireEvent.click(picker.getByRole('button', { name: '2029년 1월' }));
    expect(mock.replace).toHaveBeenLastCalledWith('/recipes/fixed-cost-detail?month=2029-01');
    expect(mock.fixed).toHaveBeenLastCalledWith('2029-01', true);
    expect(screen.queryByRole('button', { name: '수정' })).toBeNull();
    expect(screen.getByText('완료된 최근 3개월만 입력·수정할 수 있어요.')).toBeTruthy();
  });
  it('평균 상세는 설정된 기준 개월과 항목 평균을 보여주며 직접 수정 버튼은 두지 않는다', () => {
    mock.params = { mode: 'average' };
    mock.basis.mockReturnValue(query(completeBasisData()));
    render(<FixedCostDetailScreen />);
    expect(screen.getByText('최근 3개월 기준')).toBeTruthy();
    expect(screen.getByText('2029년 10월 ~ 2029년 12월')).toBeTruthy();
    expect(screen.getByText('평균 매출')).toBeTruthy();
    expect(screen.getByText('평균 고정 지출')).toBeTruthy();
    expect(screen.getByText('평균 고정 지출 항목')).toBeTruthy();
    expect(screen.getByText('주방 이모')).toBeTruthy();
    expect(screen.queryByText('채널 비중')).toBeNull();
    expect(screen.queryByRole('button', { name: '수정' })).toBeNull();
  });
  it('수정 월 변경 시 새 달 데이터로 폼을 다시 초기화하고 이전 달 값을 보내지 않는다', () => {
    render(<FixedCostEditScreen />);
    expect(screen.getByText('고정 지출 입력 / 수정')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement).value).toBe(
      '12,000,000',
    );
    expect(getComputedStyle(screen.getByRole('textbox', { name: '총 월매출' })).textAlign).toBe(
      'right',
    );
    fireEvent.click(monthPicker().getByRole('button', { name: '2029년 11월' }));
    expect(screen.queryByTestId('fixed-modal')).toBeNull();
    expect((screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement).value).toBe(
      '8,000,000',
    );
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    confirmSave();
    expect(mock.save.mock.calls[0]![0]).toMatchObject({ month: '2029-11', totalRevenue: 8000000 });
  });
  it('변경한 초안은 월 이동 취소 시 유지되고 이동 확인 때만 폐기된다', () => {
    render(<FixedCostEditScreen />);
    fireEvent.change(screen.getByRole('textbox', { name: '총 월매출' }), {
      target: { value: '13000000' },
    });
    fireEvent.click(monthPicker().getByRole('button', { name: '2029년 11월' }));
    expect(screen.getByText('저장하지 않은 변경 내용은 사라집니다.')).toBeTruthy();
    fireEvent.click(
      within(screen.getByTestId('fixed-modal')).getByRole('button', { name: '취소' }),
    );
    expect((screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement).value).toBe(
      '13,000,000',
    );
    fireEvent.click(monthPicker().getByRole('button', { name: '2029년 11월' }));
    fireEvent.click(
      within(screen.getByTestId('fixed-modal')).getByRole('button', { name: '이동' }),
    );
    expect((screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement).value).toBe(
      '8,000,000',
    );
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('조회 실패 후 복구하면 빈 기본값이 아니라 서버 값을 초기화한다', () => {
    mock.fixed.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('실패'),
      refetch: vi.fn(),
    });
    const view = render(<FixedCostEditScreen />);
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(mock.save).not.toHaveBeenCalled();
    mock.fixed.mockImplementation((month: string) => query(fixedData(month)));
    view.rerender(<FixedCostEditScreen />);
    expect((screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement).value).toBe(
      '12,000,000',
    );
  });
  it('월매출 입력 방식에서 매출관리 값을 선택하고 직접 입력으로 돌아오면 수기값을 복원한다', () => {
    render(<FixedCostEditScreen />);
    expect((screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement).value).toBe(
      '12,000,000',
    );
    expect(screen.queryByText('적어둔 월매출이 실제와 많이 달라요')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: '월매출 입력 방식 직접 입력' }),
    );
    fireEvent.click(
      within(screen.getByTestId('fixed-modal')).getByRole('button', {
        name: '매출관리 매출 적용 1,500,000원',
      }),
    );
    const revenueInput = screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement;
    expect(revenueInput.value).toBe('1,500,000');
    expect(revenueInput.readOnly).toBe(true);
    expect(revenueInput.parentElement?.getAttribute('style')).toContain('background-color');
    fireEvent.click(
      screen.getByRole('button', { name: '월매출 입력 방식 매출관리 매출 적용' }),
    );
    fireEvent.click(
      within(screen.getByTestId('fixed-modal')).getByRole('button', { name: '직접 입력' }),
    );
    expect((screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement).value).toBe(
      '12,000,000',
    );
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('매출관리 매출이 없는 달은 셀렉트 옵션을 비활성화한다', () => {
    mock.check.mockReturnValue(query({ ...checkData, hasSales: false, actualRevenue: 0 }));
    render(<FixedCostEditScreen />);
    fireEvent.click(
      screen.getByRole('button', { name: '월매출 입력 방식 직접 입력' }),
    );
    const option = within(screen.getByTestId('fixed-modal')).getByRole('button', {
      name: '매출관리 매출 적용 해당 월 매출 없음',
    });
    expect(option.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(option);
    expect((screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement).value).toBe(
      '12,000,000',
    );
  });

  it('월별 입력은 설정된 항목의 금액만 바꾸고 구성 기능을 노출하지 않는다', () => {
    render(<FixedCostEditScreen />);
    expect(screen.queryByRole('button', { name: '항목 추가' })).toBeNull();
    expect(screen.queryByRole('button', { name: /항목 삭제/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /채널 비중/ })).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: '주방 이모 금액' }), {
      target: { value: '1800000' },
    });
    expect(screen.getAllByText('2,500,000원')).toHaveLength(3);
    const subtotal = screen.getByText('소계').parentElement?.parentElement as HTMLElement;
    expect(within(subtotal).getByText('2,500,000원')).toBeTruthy();
    expect(within(subtotal).getByText('20.8%')).toBeTruthy();
    expect(getComputedStyle(subtotal).borderTopWidth).toBe('1px');
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    confirmSave();
    expect(mock.save.mock.calls[0]![0].items[0]).toMatchObject({
      key: 'labor',
      mode: 'detail',
      total: 2500000,
      lines: [
        { name: '주방 이모', amount: 1800000 },
        { name: '홀 직원', amount: 700000 },
      ],
    });
  });
  it('항목 추가·입력 방식·세부 항목 구성은 설정 페이지에서 저장한다', () => {
    render(<FixedCostSettingsScreen />);
    fireEvent.click(screen.getByRole('button', { name: '고정 지출 항목 추가' }));
    expect(screen.queryByTestId('fixed-modal')).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: '고정 지출 항목 2 항목명' }), {
      target: { value: '보험료' },
    });
    fireEvent.click(screen.getByRole('button', { name: '보험료 지출 항목 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '보험료 세부 항목 1' }), {
      target: { value: '화재 보험' },
    });
    expect(
      (screen.getByRole('textbox', { name: '보험료 항목명' }) as HTMLInputElement).value,
    ).toBe('보험료');
    expect(screen.queryByText('세부 항목 1개')).toBeNull();
    expect(screen.getByLabelText('보험료 세부 항목 1 순서 변경')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    confirmSave();
    expect(mock.saveSettings).toHaveBeenCalledOnce();
    expect(mock.saveSettings.mock.calls[0]![0]).toMatchObject({
      months: 3,
      baseSettingsRevision: 4,
      baseConfigurationRevision: 2,
    });
    expect(mock.saveSettings.mock.calls[0]![0].items).toContainEqual(
      expect.objectContaining({
        label: '보험료',
        mode: 'detail',
        lines: [{ name: '화재 보험', amount: 0 }],
      }),
    );
  });
  it('설정 페이지는 같은 항목명과 같은 세부 항목명을 저장 전에 막는다', () => {
    render(<FixedCostSettingsScreen />);
    fireEvent.click(screen.getByRole('button', { name: '고정 지출 항목 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '고정 지출 항목 2 항목명' }), {
      target: { value: '인건비' },
    });
    expect(screen.queryByTestId('fixed-modal')).toBeNull();
    expect(screen.getByRole('button', { name: '저장' }).getAttribute('aria-disabled')).toBe('true');
  });
  it('고정 지출 저장 연타는 한 요청만 보낸다', () => {
    render(<FixedCostEditScreen />);
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    const host = within(screen.getByTestId('fixed-modal'));
    fireEvent.click(host.getByRole('button', { name: '저장' }));
    fireEvent.click(host.getByRole('button', { name: '저장' }));
    expect(mock.save).toHaveBeenCalledOnce();
  });
});
