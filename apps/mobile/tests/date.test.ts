import { describe, expect, it } from 'vitest';
import { addDays, dayLabel, endOfMonth, rangeLabel, startOfMonth } from '@/lib/date';
import { periods } from '@/features/sales/period';

describe('서버 날짜 순수 함수', () => {
  it('윤년·월말·연말을 UTC 달력 날짜로 이동한다', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('월의 처음과 끝을 기기 시간대 없이 계산한다', () => {
    expect(startOfMonth('2024-02-19')).toBe('2024-02-01');
    expect(endOfMonth('2024-02-19')).toBe('2024-02-29');
    expect(endOfMonth('2026-12-01')).toBe('2026-12-31');
  });

  it('기준일과 같은 해만 연도를 생략한다', () => {
    expect(dayLabel('2026-08-19', '2026-08-28')).toBe('8월 19일 (수)');
    expect(dayLabel('2025-12-31', '2026-01-01')).toBe('2025년 12월 31일 (수)');
  });

  it('같은 달과 다른 달의 범위를 구분해 표시한다', () => {
    expect(rangeLabel('2026-08-01', '2026-08-07')).toBe('8월 1일 ~ 7일');
    expect(rangeLabel('2026-08-31', '2026-09-01')).toBe('8월 31일 ~ 9월 1일');
    expect(rangeLabel('2026-08-19', '2026-08-19', '2026-08-28')).toBe('8월 19일 (수)');
  });

  it('매출 기간 프리셋은 호출자가 준 기준일만 사용한다', () => {
    expect(periods('2026-03-01').map(({ key, from, to }) => ({ key, from, to }))).toEqual([
      { key: 'today', from: '2026-03-01', to: '2026-03-01' },
      { key: 'yesterday', from: '2026-02-28', to: '2026-02-28' },
      { key: 'week', from: '2026-02-23', to: '2026-03-01' },
      { key: 'month', from: '2026-03-01', to: '2026-03-01' },
      { key: 'lastMonth', from: '2026-02-01', to: '2026-02-28' },
    ]);
  });
});
