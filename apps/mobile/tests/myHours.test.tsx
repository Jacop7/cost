/** MY-09 Claude Design 2a — 체크 요일, 공통 시각 휠, 판본 저장 계약. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RpcError } from '@/lib/supabase';
import type { HoursStatus } from '@/features/settings/hooks';

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  router: { canGoBack: () => true, back: vi.fn(), replace: vi.fn() },
}));

const hoursStatus = vi.fn();
const saveHours = vi.fn();
vi.mock('@/features/settings/hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useHoursStatus: () => hoursStatus(),
  useSetOperatingHours: () => ({ mutate: saveHours, isPending: false }),
}));

import MyHoursScreen from '@/features/my/screens/MyHoursScreen';

const UNIFORM_HOURS = Object.fromEntries(
  Array.from({ length: 7 }, (_, dow) => [String(dow), { open: '11:00', close: '22:00', closed: false }]),
);

function makeStatus(over: Partial<HoursStatus> = {}) {
  return {
    data: {
      localDate: '2026-08-26',
      timezone: 'Asia/Seoul',
      timezoneConfirmed: true,
      today: { openTime: '11:00', closeTime: '22:00', breakStart: null, breakEnd: null, closeDayOffset: 0, closed: false },
      currentRule: { ruleId: 'rule-1', revision: 3, effectiveFrom: '2026-01-01', weeklyHours: UNIFORM_HOURS, weeklyBreaks: {} },
      pending: null,
      ...over,
    } satisfies HoursStatus,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

beforeEach(() => {
  hoursStatus.mockReturnValue(makeStatus());
  saveHours.mockReset();
});

describe('2a 화면', () => {
  it('영업 요일 체크 목록과 시작·종료 두 칸만 표시한다', () => {
    render(<MyHoursScreen />);
    expect(screen.getByText('영업 요일')).toBeTruthy();
    expect(screen.getByText('영업 시각')).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(7);
    expect(screen.getByLabelText('시작 선택')).toBeTruthy();
    expect(screen.getByLabelText('종료 선택')).toBeTruthy();
    expect(screen.queryByText('선택한 요일에 적용')).toBeNull();
    expect(screen.queryByText('브레이크 타임')).toBeNull();
    expect(screen.queryByText('매장 시간대')).toBeNull();
  });

  it('체크를 끄면 즉시 휴무가 되고 저장 입력에 반영한다', () => {
    render(<MyHoursScreen />);
    fireEvent.click(screen.getByLabelText('수요일'));
    expect(screen.getByText('휴무')).toBeTruthy();
    fireEvent.click(screen.getByText('저장'));
    const input = saveHours.mock.calls[0]![0] as { weeklyHours: Record<string, { closed: boolean }> };
    expect(input.weeklyHours['3']!.closed).toBe(true);
    expect(input.weeklyHours['1']!.closed).toBe(false);
  });

  it('매일을 누르면 휴무일을 모두 영업으로 바꾼다', () => {
    const sixDays = { ...UNIFORM_HOURS, '0': { open: '11:00', close: '22:00', closed: true } };
    hoursStatus.mockReturnValue(makeStatus({
      currentRule: { ruleId: 'rule-1', revision: 3, effectiveFrom: '2026-01-01', weeklyHours: sixDays, weeklyBreaks: {} },
    }));
    render(<MyHoursScreen />);
    expect(screen.getByText('휴무')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('매일 영업'));
    expect(screen.queryByText('휴무')).toBeNull();
    fireEvent.click(screen.getByText('저장'));
    const input = saveHours.mock.calls[0]![0] as { weeklyHours: Record<string, { closed: boolean }> };
    expect(Object.values(input.weeklyHours).every((day) => !day.closed)).toBe(true);
  });

  it('시각 휠은 15분 단위 값을 모든 영업 요일에 적용한다', () => {
    render(<MyHoursScreen />);
    fireEvent.click(screen.getByLabelText('시작 선택'));
    fireEvent.click(screen.getByLabelText('12시 선택'));
    fireEvent.click(screen.getByLabelText('15분 선택'));
    fireEvent.click(screen.getByRole('button', { name: '12:15 시작' }));
    expect(screen.getByText('12:15')).toBeTruthy();
    fireEvent.click(screen.getByText('저장'));
    const input = saveHours.mock.calls[0]![0] as { weeklyHours: Record<string, { open: string }> };
    expect(Object.values(input.weeklyHours).every((day) => day.open === '12:15')).toBe(true);
  });

  it('종료 시트에서 고른 익일을 close_day_offset으로 보낸다', () => {
    const mondayOnly = Object.fromEntries(
      Array.from({ length: 7 }, (_, dow) => [String(dow), { open: '11:00', close: '22:00', closed: dow !== 1 }]),
    );
    hoursStatus.mockReturnValue(makeStatus({
      currentRule: { ruleId: 'rule-1', revision: 3, effectiveFrom: '2026-01-01', weeklyHours: mondayOnly, weeklyBreaks: {} },
    }));
    render(<MyHoursScreen />);
    fireEvent.click(screen.getByLabelText('종료 선택'));
    fireEvent.click(screen.getByLabelText('익일 종료일 선택'));
    fireEvent.click(screen.getByRole('button', { name: '익일 22:00 종료' }));
    fireEvent.click(screen.getByText('저장'));
    const input = saveHours.mock.calls[0]![0] as { weeklyHours: Record<string, { close_day_offset: number }> };
    expect(input.weeklyHours['1']!.close_day_offset).toBe(1);
  });

  it('저장할 때 기존 요일별 시각과 숨은 브레이크를 2a 공통 시각으로 정리한다', () => {
    const mixedHours = {
      ...UNIFORM_HOURS,
      '2': { open: '09:00', close: '20:00', closed: false },
    };
    hoursStatus.mockReturnValue(makeStatus({
      currentRule: {
        ruleId: 'rule-1', revision: 3, effectiveFrom: '2026-01-01', weeklyHours: mixedHours,
        weeklyBreaks: { '1': { start: '15:00', end: '16:00' } },
      },
    }));
    render(<MyHoursScreen />);
    fireEvent.click(screen.getByText('저장'));
    const input = saveHours.mock.calls[0]![0] as {
      weeklyHours: Record<string, { open: string; close: string }>;
      weeklyBreaks: Record<string, unknown>;
    };
    expect(Object.values(input.weeklyHours).every((day) => day.open === '11:00' && day.close === '22:00')).toBe(true);
    expect(input.weeklyBreaks).toEqual({});
  });
});

describe('판본과 적용일', () => {
  const PENDING_HOURS = Object.fromEntries(
    Array.from({ length: 7 }, (_, dow) => [String(dow), { open: '10:00', close: '21:00', closed: false }]),
  );
  const pending = {
    ruleId: 'rule-2', revision: 5, effectiveFrom: '2026-08-27',
    weeklyHours: PENDING_HOURS, weeklyBreaks: {},
    hours: { openTime: '10:00', closeTime: '21:00', breakStart: null, breakEnd: null, closeDayOffset: 0, closed: false },
  };

  it('예약 규칙을 편집 기준으로 표시하고 그 판본으로 저장한다', () => {
    hoursStatus.mockReturnValue(makeStatus({ pending }));
    render(<MyHoursScreen />);
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('21:00')).toBeTruthy();
    fireEvent.click(screen.getByText('저장'));
    const input = saveHours.mock.calls[0]![0] as { baseRuleId: string; baseRevision: number };
    expect(input.baseRuleId).toBe('rule-2');
    expect(input.baseRevision).toBe(5);
  });

  it('45009면 refetch 결과로 화면과 다음 저장 판본을 교체한다', async () => {
    const fresh = makeStatus({
      currentRule: { ruleId: 'rule-9', revision: 12, effectiveFrom: '2026-01-01', weeklyHours: PENDING_HOURS, weeklyBreaks: {} },
    });
    let finishRefetch!: (result: { data: HoursStatus; isError: false }) => void;
    const refetch = vi.fn(() => new Promise<{ data: HoursStatus; isError: false }>((resolve) => { finishRefetch = resolve; }));
    hoursStatus.mockReturnValue({ ...makeStatus(), refetch });
    saveHours.mockImplementationOnce((_input: unknown, options?: { onError?: (error: Error) => void }) => {
      options?.onError?.(new RpcError('다른 기기에서 영업시간이 변경됐어요', '45009', 'REVISION_CONFLICT'));
    });

    render(<MyHoursScreen />);
    fireEvent.click(screen.getByText('저장'));
    await act(async () => finishRefetch({ data: fresh.data, isError: false }));
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('21:00')).toBeTruthy();

    fireEvent.click(screen.getByText('저장'));
    const input = saveHours.mock.calls.at(-1)![0] as { baseRuleId: string; baseRevision: number };
    expect(input.baseRuleId).toBe('rule-9');
    expect(input.baseRevision).toBe(12);
  });

  it('45009 뒤 재조회 실패면 낡은 판본으로 다시 저장하지 않는다', async () => {
    const initial = makeStatus();
    const refetch = vi.fn(async () => ({ data: initial.data, isError: true, error: new Error('network') }));
    hoursStatus.mockReturnValue({ ...initial, refetch });
    saveHours.mockImplementationOnce((_input: unknown, options?: { onError?: (error: Error) => void }) => {
      options?.onError?.(new RpcError('다른 기기에서 영업시간이 변경됐어요', '45009', 'REVISION_CONFLICT'));
    });

    render(<MyHoursScreen />);
    fireEvent.click(screen.getByText('저장'));
    await vi.waitFor(() => expect(screen.getByText(/최신 값을 못 받았어요/)).toBeTruthy());
    fireEvent.click(screen.getByText('저장'));
    expect(saveHours).toHaveBeenCalledTimes(1);
  });
});
