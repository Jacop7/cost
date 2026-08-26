/**
 * 주간 일정 모델 — 서버 `assert_weekly_schedule`(0156)의 거울을 잰다.
 *
 * 서버 검증은 DB 스위트(25)가 공개 문으로 잰다. 여기서는 거울이 **같은 말**을
 * 하는지를 본다 — 거울이 통과시킨 값을 서버가 거절하면 사장님은 이유를 모른 채
 * 저장이 막힌다.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DAY, DOW_ORDER, WeeklySchedule,
  fromRule, isOvernight, normalizeTimeInput, spanMinutes, toWeeklyJson, validateWeeklySchedule,
} from '../src/features/my/weeklySchedule';

const week = (patch: Partial<Record<number, Partial<typeof DEFAULT_DAY>>> = {}): WeeklySchedule => {
  const out: WeeklySchedule = {};
  for (let d = 0; d < 7; d += 1) out[d] = { ...DEFAULT_DAY, ...(patch[d] ?? {}) };
  return out;
};

describe('검증 — 서버와 같은 말', () => {
  it('기본 주간표는 통과한다', () => {
    expect(validateWeeklySchedule(week())).toBeNull();
  });

  it('시작=종료는 거부 — 영업일 경계를 못 정한다', () => {
    expect(validateWeeklySchedule(week({ 2: { open: '10:00', close: '10:00' } })))
      .toContain('시작과 종료가 같아요');
  });

  it('영업시간 밖 브레이크는 거부', () => {
    expect(validateWeeklySchedule(week({ 1: { breakStart: '23:00', breakEnd: '23:30' } })))
      .toContain('영업시간');
  });

  it('브레이크 시작=종료는 거부', () => {
    expect(validateWeeklySchedule(week({ 1: { breakStart: '15:00', breakEnd: '15:00' } })))
      .toContain('브레이크 시작과 종료가 같아요');
  });

  it('자정 넘는 브레이크는 거부', () => {
    expect(validateWeeklySchedule(week({ 1: { open: '18:00', close: '02:00', breakStart: '23:30', breakEnd: '00:30' } })))
      .toContain('자정을 넘어요');
  });

  /*
   * ⚠ 겹침 표본은 요일별로 달라야 한다 — 균일한 주간표는 자정 넘김(close<open)이면
   *   close > next_open 이 성립할 수 없다(0156 마이그레이션이 실측으로 배운 것).
   */
  it('자정 넘김이 다음 날 영업과 겹치면 거부', () => {
    expect(validateWeeklySchedule(week({
      1: { open: '18:00', close: '02:30' },
      2: { open: '02:00', close: '22:00' },
    }))).toContain('겹칠 수 없어요');
  });

  it('경계가 맞닿는 자정 넘김(다음 날 시작=종료)은 허용', () => {
    expect(validateWeeklySchedule(week({
      1: { open: '18:00', close: '02:00' },
      2: { open: '02:00', close: '22:00' },
    }))).toBeNull();
  });

  it('휴무일의 브레이크는 거부', () => {
    expect(validateWeeklySchedule(week({ 3: { closed: true, breakStart: '15:00', breakEnd: '16:00' } })))
      .toContain('휴무인데 브레이크');
  });

  it('자정 넘김 영업의 저녁·새벽 브레이크는 허용', () => {
    expect(validateWeeklySchedule(week({ 1: { open: '18:00', close: '02:00', breakStart: '21:00', breakEnd: '21:30' } })))
      .toBeNull();
    expect(validateWeeklySchedule(week({ 1: { open: '18:00', close: '02:00', breakStart: '00:30', breakEnd: '01:30' } })))
      .toBeNull();
  });

  it('자정 넘김 영업의 낮 브레이크는 거부 — 영업시간 밖이다', () => {
    expect(validateWeeklySchedule(week({ 1: { open: '18:00', close: '02:00', breakStart: '15:00', breakEnd: '16:00' } })))
      .toContain('영업시간 밖');
  });
});

describe('규칙 JSON 왕복', () => {
  it('서버 규칙을 읽고 그대로 되쓴다', () => {
    const hours = Object.fromEntries(
      Array.from({ length: 7 }, (_, d) => [String(d), { open: '11:00', close: '22:00', closed: d === 0 }]),
    );
    const breaks = { '1': { start: '15:00', end: '17:00' } };
    const days = fromRule(hours, breaks);
    expect(days).not.toBeNull();
    expect(days![0]!.closed).toBe(true);
    expect(days![1]!.breakStart).toBe('15:00');

    const out = toWeeklyJson(days!);
    expect(out.hours['0']).toEqual({ open: '11:00', close: '22:00', closed: true });
    expect(out.breaks['1']).toEqual({ start: '15:00', end: '17:00' });
    // 브레이크 없는 요일은 키를 안 만든다 — 서버가 null 요일을 '없음'으로 읽는다.
    expect('2' in out.breaks).toBe(false);
  });

  it("settings 경유 옛 규칙의 'HH:MM:SS' 도 읽는다", () => {
    const hours = Object.fromEntries(
      Array.from({ length: 7 }, (_, d) => [String(d), { open: '11:00:00', close: '22:00:00' }]),
    );
    const days = fromRule(hours, {});
    expect(days![3]!.open).toBe('11:00');
  });

  /** 모양이 어긋나면 기본값으로 메우지 않는다 — 저장 시 진짜 규칙이 덮인다. */
  it.each([
    ['요일이 빠졌다', { '0': { open: '11:00', close: '22:00' } }, {}],
    ['시각이 아니다', Object.fromEntries(Array.from({ length: 7 }, (_, d) => [String(d), { open: 'abc', close: '22:00' }])), {}],
    ['반쪽 브레이크', Object.fromEntries(Array.from({ length: 7 }, (_, d) => [String(d), { open: '11:00', close: '22:00' }])), { '1': { start: '15:00' } }],
  ])('%s → null', (_label, hours, breaks) => {
    expect(fromRule(hours, breaks)).toBeNull();
  });
});

describe('시각 유틸', () => {
  it('자정 넘김 판정과 길이', () => {
    expect(isOvernight('18:00', '02:00')).toBe(true);
    expect(isOvernight('11:00', '22:00')).toBe(false);
    expect(spanMinutes('18:00', '02:00')).toBe(8 * 60);
    expect(spanMinutes('10:00', '02:00')).toBe(16 * 60);
  });

  it('직접 입력 정규화', () => {
    expect(normalizeTimeInput('9:0')).toBe('09:00');
    expect(normalizeTimeInput('930')).toBe('09:30');
    expect(normalizeTimeInput('21:30')).toBe('21:30');
    expect(normalizeTimeInput('9')).toBe('09:00');
    expect(normalizeTimeInput('25:00')).toBeNull();
    expect(normalizeTimeInput('12:75')).toBeNull();
    expect(normalizeTimeInput('점심')).toBeNull();
  });

  it('표시 순서는 월~일이다', () => {
    expect(DOW_ORDER[0]).toBe(1);
    expect(DOW_ORDER[6]).toBe(0);
  });
});
