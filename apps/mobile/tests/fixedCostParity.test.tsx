vi.mock('@/features/changes/components/ConfigurationHistoryLink', () => ({ ConfigurationHistoryLink: () => null }));
import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FixedCostScreen from '@/features/my/screens/FixedCostScreen';
import FixedCostEditScreen from '@/features/my/screens/FixedCostEditScreen';
import { RevenueGapCard } from '@/features/my/components/RevenueGapCard';
import { recentFixedMonths } from '@/features/my/components/FixedMonthPicker';
import { ChannelWeightSheet } from '@/features/my/components/ChannelWeightSheet';
import type { FixedCosts, RevenueCheck } from '@/features/my/hooks';

const mock = vi.hoisted(() => ({ fixed: vi.fn(), check: vi.fn(), save: vi.fn(), back: vi.fn(), lists: vi.fn(), params: {} as { month?: string } }));
vi.mock('react-native', async (original) => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div data-testid="fixed-modal">{children}</div> : null,
}));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => mock.params, useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/nav', () => ({ safeBack: mock.back }));
vi.mock('@/features/business-day/businessDay', () => ({ useStoreLocalDate: () => ({ date: '2030-01-03', isLoading: false, error: null }) }));
vi.mock('@/features/my/hooks', () => ({ useFixedCosts: mock.fixed, useRevenueCheck: mock.check,
  useSaveFixedCosts: () => ({ mutate: mock.save, isPending: false }) }));
vi.mock('@/features/master-data/hooks', () => ({ useSettingsLists: mock.lists }));

const fixedData = (month: string): FixedCosts => ({ month, totalRevenue: month === '2030-01' ? 12000000 : 8000000,
  rate: 0.2, items: [{ key: 'labor', mode: 'detail', total: 2400000,
    lines: [{ name: '주방 이모', amount: 1700000 }, { name: '홀 직원', amount: 700000 }], weights: null }] });
const checkData: RevenueCheck = { month: '2030-01', daysElapsed: 3, daysTotal: 31, inProgress: true,
  manualRevenue: 12000000, fixedTotal: 2400000, actualRevenue: 1500000, projectedRevenue: 15500000,
  gapPct: 29.16667, rateManual: 0.2, rateProjected: 0.1548, hasSales: true };
const query = <T,>(data: T) => ({ data, isLoading: false, error: null, refetch: vi.fn() });
const monthPicker = () => {
  fireEvent.click(screen.getByRole('button', { name: /2030년 1월 변경/ }));
  return within(screen.getByTestId('fixed-modal'));
};

describe('고정 지출 실제 화면·공용 월 선택·초안 보호', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.params = {};
    mock.fixed.mockImplementation((month: string) => query(fixedData(month)));
    mock.check.mockReturnValue(query(checkData));
    mock.lists.mockReturnValue(query({ channels: [{ code: 'hall', name: '매장', active: true },
      { code: 'delivery', name: '배달', active: true }, { code: 'takeout', name: '포장', active: true }] }));
  });
  afterEach(cleanup);

  it('최근 월은 서버 월을 기준으로 연도를 넘고 미래 월을 넣지 않는다', () => {
    expect(recentFixedMonths('2030-01')).toEqual(['2030-01', '2029-12', '2029-11', '2029-10', '2029-09', '2029-08']);
  });
  it('조회와 수정은 같은 월 선택 행을 사용하고 조회만으로 저장하지 않는다', () => {
    render(<FixedCostScreen />);
    const host = monthPicker();
    expect(host.getByRole('button', { name: '2030년 1월' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(host.getByRole('button', { name: '2029년 12월' }));
    expect(mock.fixed).toHaveBeenLastCalledWith('2029-12');
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('수정 월 변경 시 새 달 데이터로 폼을 다시 초기화하고 이전 달 값을 보내지 않는다', () => {
    render(<FixedCostEditScreen />);
    expect((screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement).value).toBe('12000000');
    expect(getComputedStyle(screen.getByRole('textbox', { name: '총 월매출' })).textAlign).toBe('right');
    fireEvent.click(monthPicker().getByRole('button', { name: '2029년 12월' }));
    expect(screen.queryByTestId('fixed-modal')).toBeNull();
    expect((screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement).value).toBe('8000000');
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(mock.save.mock.calls[0]![0]).toMatchObject({ month: '2029-12', totalRevenue: 8000000 });
  });
  it('변경한 초안은 월 이동 취소 시 유지되고 이동 확인 때만 폐기된다', () => {
    render(<FixedCostEditScreen />);
    fireEvent.change(screen.getByRole('textbox', { name: '총 월매출' }), { target: { value: '13000000' } });
    fireEvent.click(monthPicker().getByRole('button', { name: '2029년 12월' }));
    expect(screen.getByText('저장하지 않은 변경 내용은 사라집니다.')).toBeTruthy();
    fireEvent.click(within(screen.getByTestId('fixed-modal')).getByRole('button', { name: '취소' }));
    expect((screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement).value).toBe('13000000');
    fireEvent.click(monthPicker().getByRole('button', { name: '2029년 12월' }));
    fireEvent.click(within(screen.getByTestId('fixed-modal')).getByRole('button', { name: '이동' }));
    expect((screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement).value).toBe('8000000');
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('조회 실패 후 복구하면 빈 기본값이 아니라 서버 값을 초기화한다', () => {
    mock.fixed.mockReturnValue({ data: undefined, isLoading: false, error: new Error('실패'), refetch: vi.fn() });
    const view = render(<FixedCostEditScreen />);
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(mock.save).not.toHaveBeenCalled();
    mock.fixed.mockImplementation((month: string) => query(fixedData(month)));
    view.rerender(<FixedCostEditScreen />);
    expect((screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement).value).toBe('12000000');
  });
  it('실적 비교는 자동으로 입력을 덮지 않고 채우기 클릭 시에만 반영한다', () => {
    render(<FixedCostEditScreen />);
    expect((screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement).value).toBe('12000000');
    fireEvent.click(screen.getByRole('button', { name: '월매출을 15,500,000원으로 채우기' }));
    expect((screen.getByRole('textbox', { name: '총 월매출' }) as HTMLInputElement).value).toBe('15500000');
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('판매 없는 달은 0% 괴리·예상 매출을 꾸미지 않는다', () => {
    render(<RevenueGapCard check={{ ...checkData, hasSales: false }} onApply={vi.fn()} />);
    expect(screen.getByText(/아직 매출 기록이 없어요/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('항목 추가는 팝업 취소 시 초안을 바꾸지 않고 추가 후에만 저장 payload에 들어간다', () => {
    render(<FixedCostEditScreen />);
    fireEvent.click(screen.getByRole('button', { name: '항목 추가' }));
    let host = within(screen.getByTestId('fixed-modal'));
    expect(host.getByText('고정 지출 항목 추가')).toBeTruthy();
    fireEvent.change(host.getByRole('textbox', { name: '항목 이름' }), { target: { value: '보험료' } });
    fireEvent.change(host.getByRole('textbox', { name: '세부 항목명' }), { target: { value: '월 보험료' } });
    fireEvent.change(host.getByRole('textbox', { name: '세부 항목 금액' }), { target: { value: '50000' } });
    fireEvent.click(host.getByRole('button', { name: '취소' }));
    expect(screen.queryByText('월 보험료')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '항목 추가' }));
    host = within(screen.getByTestId('fixed-modal'));
    expect((host.getByRole('textbox', { name: '항목 이름' }) as HTMLInputElement).value).toBe('');
    fireEvent.change(host.getByRole('textbox', { name: '항목 이름' }), { target: { value: '보험료' } });
    fireEvent.change(host.getByRole('textbox', { name: '세부 항목명' }), { target: { value: '월 보험료' } });
    fireEvent.change(host.getByRole('textbox', { name: '세부 항목 금액' }), { target: { value: '50000' } });
    fireEvent.click(host.getByRole('button', { name: '추가' }));
    expect(mock.save).not.toHaveBeenCalled();
    expect(screen.getByText('월 보험료')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(mock.save.mock.calls[0]![0].items).toContainEqual({ key: '보험료', mode: 'detail', total: 50000,
      lines: [{ name: '월 보험료', amount: 50000 }], weights: null });
  });
  it('동일 항목명은 중복 생성하지 않고 마지막 세부 줄 삭제 후 옛 합계가 살아나지 않는다', () => {
    render(<FixedCostEditScreen />);
    fireEvent.click(screen.getByRole('button', { name: '항목 추가' }));
    const host = within(screen.getByTestId('fixed-modal'));
    fireEvent.change(host.getByRole('textbox', { name: '항목 이름' }), { target: { value: '인건비' } });
    expect(host.getByRole('button', { name: '추가' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(host.getByRole('button', { name: '취소' }));
    fireEvent.click(screen.getByRole('button', { name: '주방 이모 세부 항목 삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '홀 직원 세부 항목 삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(mock.save.mock.calls[0]![0].items).toEqual([]);
  });
  it('기존 세부 항목 금액은 수정 팝업 적용 전에는 바뀌지 않는다', () => {
    render(<FixedCostEditScreen />);
    fireEvent.click(screen.getByRole('button', { name: '주방 이모 세부 항목 수정' }));
    const host = within(screen.getByTestId('fixed-modal'));
    fireEvent.change(host.getByRole('textbox', { name: '세부 항목 금액' }), { target: { value: '1800000' } });
    expect(screen.getByText('1,700,000원')).toBeTruthy();
    fireEvent.click(host.getByRole('button', { name: '적용' }));
    expect(screen.getByText('1,800,000원')).toBeTruthy();
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('채널 배분 숫자 입력은 자동/직접 선택·서버 정규화·취소/적용 계약을 유지한다', () => {
    const apply = vi.fn(), close = vi.fn();
    render(<ChannelWeightSheet visible onClose={close} value={{ hall: 30, delivery: 50, takeout: 20 }} onApply={apply} />);
    expect(screen.getByRole('button', { name: '직접 배분' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByRole('textbox', { name: '매장 배분 비중' }), { target: { value: '3' } });
    fireEvent.change(screen.getByRole('textbox', { name: '배달 배분 비중' }), { target: { value: '5' } });
    fireEvent.change(screen.getByRole('textbox', { name: '포장 배분 비중' }), { target: { value: '2' } });
    expect(screen.getByText('10%')).toBeTruthy();
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(apply).toHaveBeenLastCalledWith({ hall: 3, delivery: 5, takeout: 2 });
    fireEvent.click(screen.getByRole('button', { name: '매출 비중으로 자동' }));
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(apply).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(close).toHaveBeenCalledOnce();
  });
  it('직접 배분 합계 0은 적용하지 않으며 기존 비활성 채널 비중은 숨기지 않는다', () => {
    mock.lists.mockReturnValue(query({ channels: [{ code: 'hall', name: '매장', active: true }, { code: 'delivery', name: '배달', active: false }] }));
    const apply = vi.fn();
    render(<ChannelWeightSheet visible onClose={vi.fn()} value={{ hall: 50, delivery: 50 }} onApply={apply} />);
    expect(screen.getByText('배달 (사용 안 함)')).toBeTruthy();
    for (const label of ['매장', '배달']) fireEvent.change(screen.getByRole('textbox', { name: `${label} 배분 비중` }), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(apply).not.toHaveBeenCalled();
  });
  it('채널 목록 백그라운드 재조회는 편집 중인 비중을 덮지 않는다', () => {
    const value = { hall: 30, delivery: 50, takeout: 20 };
    const apply = vi.fn();
    const view = render(<ChannelWeightSheet visible onClose={vi.fn()} value={value} onApply={apply} />);
    fireEvent.change(screen.getByRole('textbox', { name: '매장 배분 비중' }), { target: { value: '35' } });
    mock.lists.mockReturnValue(query({ channels: [{ code: 'hall', name: '매장', active: true }, { code: 'delivery', name: '배달', active: true }, { code: 'takeout', name: '포장', active: true }] }));
    view.rerender(<ChannelWeightSheet visible onClose={vi.fn()} value={value} onApply={apply} />);
    expect((screen.getByRole('textbox', { name: '매장 배분 비중' }) as HTMLInputElement).value).toBe('35');
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(apply).toHaveBeenCalledWith({ hall: 35, delivery: 50, takeout: 20 });
  });
  it('고정 지출 저장 연타는 한 요청만 보낸다', () => {
    render(<FixedCostEditScreen />);
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(mock.save).toHaveBeenCalledOnce();
  });
});
