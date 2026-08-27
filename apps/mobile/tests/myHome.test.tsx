/**
 * MY 홈 — 영업시간 줄의 판단(검토 지적).
 *   · 로딩·오류·미설정을 뭉치지 않는다.
 *   · 시간은 같고 브레이크만 요일별로 달라도 '요일마다 달라요'.
 *   · 오늘 실제 시간(operating_hours_status.today)을 그린다 — 표시 폼과 섞지 않는다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HoursStatus } from '@/features/settings/hooks';

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  router: { canGoBack: () => true, back: vi.fn(), replace: vi.fn() },
  Link: ({ children }: { children: unknown }) => children,
}));

const hoursStatus = vi.fn();
vi.mock('@/features/settings/hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useHoursStatus: () => hoursStatus(),
  useStoreSettings: () => ({ data: undefined, isLoading: false, error: null }),
}));
vi.mock('@/features/master-data/hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSettingsLists: () => ({
    data: { categories: [], recipeCategories: [], materials: [], vendors: [], channels: [] },
    isLoading: false, error: null,
  }),
}));
vi.mock('@/features/my/hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useStoreName: () => ({ data: '시험 매장', isLoading: false, error: null }),
}));

import MyHomeScreen from '@/features/my/screens/MyHomeScreen';

const UNIFORM = Object.fromEntries(Array.from({ length: 7 }, (_, d) => [String(d), { open: '11:00', close: '22:00', closed: false }]));

function status(over: Partial<HoursStatus> = {}) {
  return {
    data: {
      localDate: '2026-08-27', timezone: 'Asia/Seoul', timezoneConfirmed: true,
      today: { openTime: '11:00:00', closeTime: '22:00:00', breakStart: null, breakEnd: null, closeDayOffset: 0, closed: false },
      currentRule: { ruleId: 'r', revision: 1, effectiveFrom: null, weeklyHours: UNIFORM, weeklyBreaks: {} },
      pending: null,
      ...over,
    } as HoursStatus,
    isLoading: false, isError: false, error: null, refetch: vi.fn(),
  };
}

beforeEach(() => { hoursStatus.mockReturnValue(status()); });

describe('MY 홈 영업시간 줄', () => {
  it('오늘 실제 시간을 그린다', () => {
    render(<MyHomeScreen />);
    expect(screen.getByText('11:00 ~ 22:00')).toBeTruthy();
  });

  it('로딩은 로딩이다 — 설정 안 됨이 아니다', () => {
    hoursStatus.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() });
    render(<MyHomeScreen />);
    expect(screen.getByText('불러오는 중…')).toBeTruthy();
    expect(screen.queryByText('설정 안 됨')).toBeNull();
  });

  it('오류는 오류다 — 설정 안 됨이 아니다', () => {
    hoursStatus.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('x'), refetch: vi.fn() });
    render(<MyHomeScreen />);
    expect(screen.getByText('영업시간을 불러오지 못했어요')).toBeTruthy();
    expect(screen.queryByText('설정 안 됨')).toBeNull();
  });

  it('데이터가 왔는데 오늘 시간이 없을 때만 설정 안 됨', () => {
    hoursStatus.mockReturnValue(status({ today: undefined as unknown as HoursStatus['today'], currentRule: null }));
    render(<MyHomeScreen />);
    expect(screen.getByText('설정 안 됨')).toBeTruthy();
  });

  it('시간은 같고 브레이크만 요일별로 달라도 요일마다 달라요', () => {
    hoursStatus.mockReturnValue(status({
      currentRule: { ruleId: 'r', revision: 1, effectiveFrom: null, weeklyHours: UNIFORM,
        weeklyBreaks: { '1': { start: '15:00', end: '17:00' } } },
    }));
    render(<MyHomeScreen />);
    expect(screen.getByText(/요일마다 달라요/)).toBeTruthy();
  });

  it('시간만 요일별로 달라도 요일마다 달라요', () => {
    hoursStatus.mockReturnValue(status({
      currentRule: { ruleId: 'r', revision: 1, effectiveFrom: null,
        weeklyHours: { ...UNIFORM, '6': { open: '10:00', close: '20:00', closed: false } }, weeklyBreaks: {} },
    }));
    render(<MyHomeScreen />);
    expect(screen.getByText(/^오늘 11:00 ~ 22:00 · 요일마다 달라요$/)).toBeTruthy();
  });

  it('자정을 넘는 영업은 익일로 표기한다', () => {
    hoursStatus.mockReturnValue(status({
      today: { openTime: '18:00:00', closeTime: '02:00:00', breakStart: null, breakEnd: null, closeDayOffset: 1, closed: false },
    }));
    render(<MyHomeScreen />);
    expect(screen.getByText('18:00 ~ 익일 02:00')).toBeTruthy();
  });

  it('휴무일은 휴무라고 말한다', () => {
    hoursStatus.mockReturnValue(status({
      today: { openTime: '11:00:00', closeTime: '22:00:00', breakStart: null, breakEnd: null, closeDayOffset: 0, closed: true },
    }));
    render(<MyHomeScreen />);
    expect(screen.getByText('오늘은 휴무예요')).toBeTruthy();
  });
});
