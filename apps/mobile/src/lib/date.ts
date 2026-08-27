/**
 * 서버가 내려준 YYYY-MM-DD를 다루는 범용 날짜 산술·표기 함수.
 *
 * 기준일은 호출자가 명시한다. 기기 시계로 오늘을 다시 계산하면 서버 영업일과 갈릴 수 있다.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** 'YYYY-MM-DD'를 UTC 자정 Date로. 시간대 보정을 두 번 하지 않도록 UTC로만 다룬다. */
export const parseDay = (s: string): Date => new Date(`${s}T00:00:00Z`);

export const addDays = (s: string, n: number): string => {
  const d = parseDay(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

export const startOfMonth = (s: string): string => `${s.slice(0, 7)}-01`;

export const endOfMonth = (s: string): string => {
  const d = parseDay(s);
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
};

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * '8월 19일 (수)' — 연도는 같은 해면 생략한다.
 *
 * `today`에 기본값을 두지 않는다. 조회 날짜는 서버 것인데 연도 생략 여부만 기기 날짜에 기대면
 * 자정 경계에서 표시가 갈린다.
 */
export function dayLabel(s: string, today: string): string {
  const d = parseDay(s);
  const y = d.getUTCFullYear() === parseDay(today).getUTCFullYear() ? '' : `${d.getUTCFullYear()}년 `;
  return `${y}${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY[d.getUTCDay()]})`;
}

/** `today`는 연도 생략 판단에만 쓴다. 생략하면 인자로 받은 구간의 끝을 기준으로 삼는다. */
export function rangeLabel(from: string, to: string, today: string = to): string {
  if (from === to) return dayLabel(from, today);
  const a = parseDay(from);
  const b = parseDay(to);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  return sameMonth
    ? `${a.getUTCMonth() + 1}월 ${a.getUTCDate()}일 ~ ${b.getUTCDate()}일`
    : `${a.getUTCMonth() + 1}월 ${a.getUTCDate()}일 ~ ${b.getUTCMonth() + 1}월 ${b.getUTCDate()}일`;
}
