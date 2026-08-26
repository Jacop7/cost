/**
 * MY-09 영업시간 화면 (0156) — 요일 선택·공통 적용·거울 검증·시간대 경로.
 *
 * 여기서 재는 것은 **화면의 판단**이다 — 서버 규칙을 어떻게 펼치고, 무엇을 서버로
 * 보내고, 틀린 값에 무슨 말을 하는가. 서버 검증 자체는 DB 스위트 25 가 잰다.
 * ⚠ RN-web 으로 그린다. 무엇을 포기하는지는 `tests/setup.ts` 머리말에 적었다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RpcError } from '@/lib/supabase';
import type { HoursStatus } from '@/features/my/hooks';

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  router: { canGoBack: () => true, back: vi.fn(), replace: vi.fn() },
}));

const hoursStatus = vi.fn();
const saveHours = vi.fn();
const saveTz = vi.fn();
vi.mock('@/features/my/hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useHoursStatus: () => hoursStatus(),
  useSetOperatingHours: () => ({ mutate: saveHours, isPending: false }),
  useSetStoreTimezone: () => ({ mutate: saveTz, isPending: false }),
}));

import MyHoursScreen from '@/features/my/screens/MyHoursScreen';

const UNIFORM_HOURS = Object.fromEntries(
  Array.from({ length: 7 }, (_, d) => [String(d), { open: '11:00', close: '22:00', closed: false }]),
);

function status(over: Partial<HoursStatus> = {}): { data: HoursStatus; isLoading: boolean; error: null; refetch: () => void } {
  return {
    data: {
      localDate: '2026-08-26',
      timezone: 'Asia/Seoul',
      timezoneConfirmed: true,
      today: { openTime: '11:00', closeTime: '22:00', breakStart: null, breakEnd: null, closeDayOffset: 0, closed: false },
      currentRule: { ruleId: 'rule-1', revision: 3, effectiveFrom: '2026-01-01', weeklyHours: UNIFORM_HOURS, weeklyBreaks: {} },
      pending: null,
      ...over,
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

beforeEach(() => {
  hoursStatus.mockReturnValue(status());
  saveHours.mockReset();
  saveTz.mockReset();
});

describe('요일별 표와 공통 적용', () => {
  it('서버 규칙을 요일별로 펼친다 — 월~일 일곱 줄', () => {
    render(<MyHoursScreen />);
    // 7일 모두 같은 시간이니 같은 문구가 7번 있다.
    expect(screen.getAllByText('11:00~22:00')).toHaveLength(7);
  });

  it('요일을 골라 휴무를 적용하면 그 요일만 바뀐다', () => {
    render(<MyHoursScreen />);
    fireEvent.click(screen.getByLabelText('수요일'));
    fireEvent.click(screen.getByLabelText('휴무'));
    fireEvent.click(screen.getByText('선택한 요일에 적용'));
    // '휴무'는 토글 알약에도 있다 — 요일 줄에 하나 더 생겼는지를 본다.
    expect(screen.getAllByText('휴무').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('11:00~22:00')).toHaveLength(6);
  });

  it('저장은 편집한 주간표를 그대로 보낸다', () => {
    render(<MyHoursScreen />);
    fireEvent.click(screen.getByLabelText('수요일'));
    fireEvent.click(screen.getByLabelText('휴무'));
    fireEvent.click(screen.getByText('선택한 요일에 적용'));
    fireEvent.click(screen.getByText('저장'));
    expect(saveHours).toHaveBeenCalledTimes(1);
    const arg = saveHours.mock.calls[0]![0] as { weeklyHours: Record<string, { closed: boolean }> };
    expect(arg.weeklyHours['3']!.closed).toBe(true);   // 수요일 = dow 3
    expect(arg.weeklyHours['1']!.closed).toBe(false);
  });
});

describe('거울 검증', () => {
  it('영업시간 밖 브레이크는 저장 전에 막고 이유를 말한다', () => {
    render(<MyHoursScreen />);
    fireEvent.click(screen.getByLabelText('월요일'));
    fireEvent.click(screen.getByLabelText('브레이크 타임 사용'));
    // 기본 브레이크 15:00~17:00 은 영업시간 안 — 시작을 23:00 으로 직접 입력해 어긋낸다.
    fireEvent.click(screen.getByLabelText('브레이크 시작 선택'));
    fireEvent.change(screen.getByLabelText('시각 직접 입력'), { target: { value: '23:00' } });
    fireEvent.click(screen.getByText('입력'));
    fireEvent.click(screen.getByLabelText('브레이크 종료 선택'));
    fireEvent.change(screen.getByLabelText('시각 직접 입력'), { target: { value: '23:30' } });
    fireEvent.click(screen.getByText('입력'));
    fireEvent.click(screen.getByText('선택한 요일에 적용'));

    expect(screen.getByText(/영업시간.*밖이에요/)).toBeTruthy();
    // 저장 버튼이 막혀 서버까지 안 간다 — 서버는 어차피 같은 말로 거절한다(0156).
    fireEvent.click(screen.getByText('저장'));
    expect(saveHours).not.toHaveBeenCalled();
  });

  it('종료를 시작보다 이르게 두면 자정 넘김으로 읽는다', () => {
    render(<MyHoursScreen />);
    fireEvent.click(screen.getByLabelText('금요일'));
    fireEvent.click(screen.getByLabelText('종료 선택'));
    fireEvent.change(screen.getByLabelText('시각 직접 입력'), { target: { value: '02:00' } });
    fireEvent.click(screen.getByText('입력'));
    expect(screen.getByText('자정 넘김')).toBeTruthy();
    fireEvent.click(screen.getByText('선택한 요일에 적용'));
    expect(screen.getByText('11:00~다음 날 02:00')).toBeTruthy();
  });
});

describe('요일 선택 시 기존 값 (P2-5)', () => {
  const VARIED_HOURS = {
    ...UNIFORM_HOURS,
    '3': { open: '09:00', close: '17:00', closed: false },   // 수요일만 다르다
  };

  it('첫 요일을 고르면 그 요일의 현재 값이 패널에 실린다 — 기본값으로 덮지 않는다', () => {
    hoursStatus.mockReturnValue(status({
      currentRule: { ruleId: 'rule-1', revision: 3, effectiveFrom: '2026-01-01', weeklyHours: VARIED_HOURS, weeklyBreaks: {} },
    }));
    render(<MyHoursScreen />);
    fireEvent.click(screen.getByLabelText('수요일'));
    // 패널의 시작/종료 행에 09:00·17:00 이 보인다(요일 줄 + 패널 = 각각 2번째 노드).
    expect(screen.getAllByText('09:00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('17:00').length).toBeGreaterThanOrEqual(1);
    // 그대로 적용해도 시간이 안 바뀐다 — 브레이크만 바꾸려는 사장님이 안전하다.
    fireEvent.click(screen.getByText('선택한 요일에 적용'));
    expect(screen.getByText('09:00~17:00')).toBeTruthy();
  });

  it('해제해서 하나만 남으면 남은 요일 값을 다시 싣는다 — 남은 요일을 덮지 않는다', () => {
    hoursStatus.mockReturnValue(status({
      currentRule: { ruleId: 'rule-1', revision: 3, effectiveFrom: '2026-01-01', weeklyHours: VARIED_HOURS, weeklyBreaks: {} },
    }));
    render(<MyHoursScreen />);
    fireEvent.click(screen.getByLabelText('수요일'));   // 패널 09:00~17:00
    fireEvent.click(screen.getByLabelText('화요일'));   // 둘 선택
    fireEvent.click(screen.getByLabelText('수요일'));   // 수 해제 → 화만 남는다
    fireEvent.click(screen.getByText('선택한 요일에 적용'));
    // 화요일은 제 값(11:00~22:00)을 유지해야 한다 — 수요일 값으로 덮이면 6줄이 된다.
    expect(screen.getAllByText('11:00~22:00')).toHaveLength(6);
    expect(screen.getByText('09:00~17:00')).toBeTruthy();
  });

  it('서로 다른 요일을 함께 고르면 혼합 표시가 뜬다', () => {
    hoursStatus.mockReturnValue(status({
      currentRule: { ruleId: 'rule-1', revision: 3, effectiveFrom: '2026-01-01', weeklyHours: VARIED_HOURS, weeklyBreaks: {} },
    }));
    render(<MyHoursScreen />);
    fireEvent.click(screen.getByLabelText('화요일'));
    fireEvent.click(screen.getByLabelText('수요일'));
    expect(screen.getByText('값이 서로 달라요')).toBeTruthy();
    // 같은 값 요일끼리는 안 뜬다.
    fireEvent.click(screen.getByLabelText('수요일'));   // 해제
    fireEvent.click(screen.getByLabelText('월요일'));
    expect(screen.queryByText('값이 서로 달라요')).toBeNull();
  });
});

describe('예약 규칙 판본 (0159)', () => {
  const PENDING_HOURS = Object.fromEntries(
    Array.from({ length: 7 }, (_, d) => [String(d), { open: '10:00', close: '21:00', closed: false }]),
  );
  const pending = {
    ruleId: 'rule-2', revision: 5, effectiveFrom: '2026-08-27',
    weeklyHours: PENDING_HOURS, weeklyBreaks: {},
    hours: { openTime: '10:00', closeTime: '21:00', breakStart: null, breakEnd: null, closeDayOffset: 0, closed: false },
  };

  it('예약이 있으면 예약 주간표로 편집을 시작한다 — 재진입해도 안 사라진다', () => {
    hoursStatus.mockReturnValue(status({ pending }));
    render(<MyHoursScreen />);
    // 현재 규칙(11:00~22:00)이 아니라 예약(10:00~21:00)이 보여야 한다.
    expect(screen.getAllByText('10:00~21:00')).toHaveLength(7);
    expect(screen.queryByText('11:00~22:00')).toBeNull();
  });

  it('저장이 편집 기준의 판본을 실어 보낸다', () => {
    hoursStatus.mockReturnValue(status({ pending }));
    render(<MyHoursScreen />);
    fireEvent.click(screen.getByText('저장'));
    const arg = saveHours.mock.calls[0]![0] as { baseRuleId?: string; baseRevision?: number };
    expect(arg.baseRuleId).toBe('rule-2');
    expect(arg.baseRevision).toBe(5);
  });

  /*
   * ⚠ refetch 의 **결과**로 교체해야 한다. 캐시(옛 데이터)를 그대로 둔 채 days 만 비우면
   *   effect 가 옛 판본으로 다시 초기화해 45009 가 반복됐다(검토 P1-1 재검토).
   *   여기서는 refetch 가 새 판본(rule-9, 10:00~21:00)을 돌려주고, 화면이 그 값으로
   *   바뀌며 다음 저장이 새 판본을 싣는지를 본다.
   */
  it('45009 면 refetch 결과로 편집과 판본을 교체한다 — 옛 값이 다시 들어오지 않는다', async () => {
    const fresh = status({
      currentRule: { ruleId: 'rule-9', revision: 12, effectiveFrom: '2026-01-01', weeklyHours: PENDING_HOURS, weeklyBreaks: {} },
    });
    const refetch = vi.fn(async () => ({ data: fresh.data }));
    hoursStatus.mockReturnValue({ ...status(), refetch });   // 캐시는 여전히 옛 값(11:00~22:00)
    saveHours.mockImplementationOnce((_input: unknown, opts?: { onError?: (e: Error) => void }) => {
      opts?.onError?.(new RpcError('다른 기기에서 영업시간이 변경됐어요', '45009', 'REVISION_CONFLICT'));
    });
    render(<MyHoursScreen />);
    fireEvent.click(screen.getByText('저장'));
    await vi.waitFor(() => expect(screen.getByText(/최신 값을 다시 불러왔어요/)).toBeTruthy());
    expect(refetch).toHaveBeenCalled();
    // 화면이 서버의 새 값으로 바뀌었다 — 캐시의 옛 값(11:00~22:00)이 아니다.
    expect(screen.getAllByText('10:00~21:00')).toHaveLength(7);
    // 다음 저장은 새 판본을 싣는다.
    fireEvent.click(screen.getByText('저장'));
    const arg = saveHours.mock.calls.at(-1)![0] as { baseRuleId: string; baseRevision: number };
    expect(arg.baseRuleId).toBe('rule-9');
    expect(arg.baseRevision).toBe(12);
  });
});

describe('매장 시간대', () => {
  it('정한 적 없으면 기기 시간대를 제안하고, 누르면 그 값으로 저장한다', () => {
    hoursStatus.mockReturnValue(status({ timezoneConfirmed: false }));
    render(<MyHoursScreen />);
    expect(screen.getByText('매장 시간대를 정해 주세요')).toBeTruthy();
    fireEvent.click(screen.getByText('기기 시간대 사용'));
    expect(saveTz).toHaveBeenCalledTimes(1);
    const tz = saveTz.mock.calls[0]![0] as string;
    expect(tz).toContain('/');   // IANA 모양 — 기기마다 값은 다르다
  });

  it('정해 둔 매장은 제안 배너가 없다', () => {
    render(<MyHoursScreen />);
    expect(screen.queryByText('매장 시간대를 정해 주세요')).toBeNull();
    expect(screen.getByText('Asia/Seoul')).toBeTruthy();
  });
});
