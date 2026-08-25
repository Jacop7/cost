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

/**
 * '8월 19일 (수)' — 연도는 같은 해면 생략한다.
 *
 * ⚠ `today` 에 기본값을 두지 않는다(0125). 예전엔 `currentBusinessDay()` 였는데,
 *   그러면 조회 날짜는 서버 것인데 **연도 생략 여부만 기기 날짜에 기댄다.**
 *   부르는 쪽이 서버 기준일을 넘겨야 한다.
 */
export function dayLabel(s: string, today: string): string {
  const d = parseDay(s);
  const y = d.getUTCFullYear() === parseDay(today).getUTCFullYear() ? '' : `${d.getUTCFullYear()}년 `;
  return `${y}${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY[d.getUTCDay()]})`;
}

/**
 * ⚠ `today` 는 **연도 생략 판단에만** 쓴다(0125). 기본값은 두지 않는다 —
 *   기본값을 두면 부르는 쪽이 잊고, 그 자리만 기기 날짜에 기대게 된다.
 */
export function rangeLabel(from: string, to: string, today: string = to): string {
  if (from === to) return dayLabel(from, today);
  const a = parseDay(from);
  const b = parseDay(to);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  return sameMonth
    ? `${a.getUTCMonth() + 1}월 ${a.getUTCDate()}일 ~ ${b.getUTCDate()}일`
    : `${a.getUTCMonth() + 1}월 ${a.getUTCDate()}일 ~ ${b.getUTCMonth() + 1}월 ${b.getUTCDate()}일`;
}

/**
 * 프리셋 목록. '직접설정'은 사용자가 고른 구간을 그대로 쓴다.
 * ⚠ 기본값 없음 — 위 `dayLabel` 과 같은 이유다(0125).
 */
export function periods(today: string): Period[] {
  const yest = addDays(today, -1);
  const lastMonthAnchor = addDays(startOfMonth(today), -1);
  return [
    { key: 'today', short: '오늘', label: dayLabel(today, today), from: today, to: today },
    { key: 'yesterday', short: '어제', label: dayLabel(yest, today), from: yest, to: yest },
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

/**
 * @deprecated 앱이 직접 계산하는 오늘. **새 코드에서 쓰지 않는다**(0125).
 *
 * `+09:00` 고정 오프셋이라 서머타임이 있는 지역에서 틀리고, 무엇보다 앱과 DB 가
 * 각자 오늘을 계산하게 된다(기획서 §2.1). 서버가 정한 날짜를 쓴다 —
 * 판매는 `useSalesBusinessDate()`, 일반 기록은 `useStoreLocalDate()`.
 *
 * 아직 남겨 둔 이유는 일반 기록 화면 몇 개가 옮겨지기 전이라서다. 그게 끝나면 지운다.
 */
export const todayBusiness = currentBusinessDay;
