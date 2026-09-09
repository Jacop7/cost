import { describe, expect, it } from 'vitest';
import { DATE_TIME_DISPLAY_FORMAT, formatStoreDateTime } from '@/lib/date';
import { changeStamp, changeTime, monthLabel } from '@/features/changes/hooks';

describe('5개국 공통 YY-MM-DD HH:mm 표시', () => {
  const instant = '2026-09-06T22:05:00Z';
  it.each([
    ['Asia/Seoul', '26-09-07 07:05'],
    ['America/New_York', '26-09-06 18:05'],
    ['Europe/London', '26-09-06 23:05'],
    ['Australia/Sydney', '26-09-07 08:05'],
    ['America/Toronto', '26-09-06 18:05'],
  ])('%s: 매장 시간대와 공통 형식을 적용한다', (timezone, expected) => {
    expect(DATE_TIME_DISPLAY_FORMAT).toBe('YY-MM-DD HH:mm');
    expect(formatStoreDateTime(instant, timezone)).toBe(expected);
    expect(changeTime(instant, timezone)).toBe(expected);
    expect(changeStamp(instant, timezone)).toBe(expected);
  });
  it('자정은 00시이며 연도·월 그룹도 같은 매장 날짜를 쓴다', () => {
    expect(formatStoreDateTime('2025-12-31T15:00:00Z', 'Asia/Seoul')).toBe('26-01-01 00:00');
    expect(monthLabel('2025-12-31T15:00:00Z', 'Asia/Seoul')).toBe('2026년 1월');
    expect(monthLabel('2025-12-31T15:00:00Z', 'America/New_York')).toBe('2025년 12월');
  });
  it('UTC offset 입력과 Z 입력은 같은 시각이다', () => {
    expect(formatStoreDateTime('2026-09-07T07:05:00+09:00', 'Asia/Seoul')).toBe('26-09-07 07:05');
  });
  it('서머타임 전환을 매장 시간대로 적용한다', () => {
    expect(formatStoreDateTime('2026-03-08T06:59:00Z', 'America/New_York')).toBe('26-03-08 01:59');
    expect(formatStoreDateTime('2026-03-08T07:00:00Z', 'America/New_York')).toBe('26-03-08 03:00');
    expect(formatStoreDateTime('2026-10-03T15:59:00Z', 'Australia/Sydney')).toBe('26-10-04 01:59');
    expect(formatStoreDateTime('2026-10-03T16:00:00Z', 'Australia/Sydney')).toBe('26-10-04 03:00');
  });
  it.each([
    [instant, undefined], [instant, ''], [instant, 'invalid/timezone'],
    ['invalid', 'Asia/Seoul'], ['2026-09-07T07:05:00', 'Asia/Seoul'],
  ])('시간대나 절대시각이 없으면 기기 값으로 추정하지 않는다: %s %s', (value, timezone) => {
    expect(formatStoreDateTime(value!, timezone)).toBe('');
  });
});
