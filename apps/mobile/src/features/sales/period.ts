/**
 * 매출 기간 프리셋 (SALES-02).
 *
 * 기준일은 **영업일**(KST)이다. 기기 로컬이나 UTC 로 계산하면 자정 전후에 하루가 어긋나
 * "오늘 매출이 어제로 잡히는" 문제가 생긴다(@sikjae/core businessDate).
 */
import { currentBusinessDay } from '@sikjae/core';

export type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'custom';

export interface Period {
  key: PeriodKey;
  short: string;
  label: string;
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** 'YYYY-MM-DD' 를 UTC 자정 Date 로. 시간대 보정을 두 번 하지 않도록 UTC 로만 다룬다. */
export const parseDay = (s: string): Date => new Date(`${s}T00:00:00Z`);

export const addDays = (s: string, n: number): string => {
  const d = parseDay(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

const startOfMonth = (s: string) => `${s.slice(0, 7)}-01`;
const endOfMonth = (s: string) => {
  const d = parseDay(s);
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
};

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** '8월 19일 (수)' — 연도는 같은 해면 생략한다. */
export function dayLabel(s: string, today: string = currentBusinessDay()): string {
  const d = parseDay(s);
  const y = d.getUTCFullYear() === parseDay(today).getUTCFullYear() ? '' : `${d.getUTCFullYear()}년 `;
  return `${y}${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY[d.getUTCDay()]})`;
}

export function rangeLabel(from: string, to: string): string {
  if (from === to) return dayLabel(from);
  const a = parseDay(from);
  const b = parseDay(to);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  return sameMonth
    ? `${a.getUTCMonth() + 1}월 ${a.getUTCDate()}일 ~ ${b.getUTCDate()}일`
    : `${a.getUTCMonth() + 1}월 ${a.getUTCDate()}일 ~ ${b.getUTCMonth() + 1}월 ${b.getUTCDate()}일`;
}

/** 프리셋 목록. '직접설정'은 사용자가 고른 구간을 그대로 쓴다. */
export function periods(today: string = currentBusinessDay()): Period[] {
  const yest = addDays(today, -1);
  const lastMonthAnchor = addDays(startOfMonth(today), -1);
  return [
    { key: 'today', short: '오늘', label: dayLabel(today), from: today, to: today },
    { key: 'yesterday', short: '어제', label: dayLabel(yest), from: yest, to: yest },
    // '이번주'는 최근 7일이다. 주 시작 요일은 가게마다 달라 오해를 부른다.
    { key: 'week', short: '최근 7일', label: rangeLabel(addDays(today, -6), today), from: addDays(today, -6), to: today },
    { key: 'month', short: '이번달', label: rangeLabel(startOfMonth(today), today), from: startOfMonth(today), to: today },
    {
      key: 'lastMonth', short: '지난달',
      label: rangeLabel(startOfMonth(lastMonthAnchor), endOfMonth(lastMonthAnchor)),
      from: startOfMonth(lastMonthAnchor), to: endOfMonth(lastMonthAnchor),
    },
  ];
}

export const todayBusiness = currentBusinessDay;
