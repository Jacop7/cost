/**
 * 매출 기간 프리셋 (SALES-02).
 *
 * ⚠ **여기엔 오늘이 없다**(0125). 기준일은 부르는 쪽이 넘긴다 —
 *   판매는 `useSalesBusinessDate()`, 일반 기록은 `useStoreLocalDate()`.
 *   둘 다 서버가 정한다. 앱이 기기 시계로 오늘을 계산하던 `todayBusiness()` 는 지웠다.
 *   앱과 DB 가 각자 오늘을 세면 자정 전후에 하루가 갈린다(기획서 §2.1).
 *
 * 범용 날짜 산술·표기는 `src/lib/date.ts`가 소유하고, 여기에는 매출 기간 프리셋만 남긴다.
 */

import { addDays, dayLabel, endOfMonth, rangeLabel, startOfMonth } from '@/lib/date';

export type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'custom';

export interface Period {
  key: PeriodKey;
  short: string;
  label: string;
  from: string;
  to: string;
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
