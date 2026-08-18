/**
 * 매출관리 데모 데이터 — 프로토타입(screens_sales) data.jsx 이식.
 * 메뉴 판매 → 매출 + 재료원가(레시피 연동) + 채널 수수료 + 고정지출 일배분 → 일/월 손익.
 * ⚠ 임시 데모. 실데이터는 Supabase(판매 기록·손익 스냅샷)로 교체.
 */
export interface SaleMenu {
  name: string;
  price: number;
  cogs: number; // 개당 재료원가
  qty: number; // 매장+배달+포장
  hall: number;
  delivery: number;
  takeout: number;
}
export interface SaleChannel {
  id: string;
  name: string;
  fee: number; // 수수료율(%)
  feeLabel: string;
}
export interface ChannelSeg {
  label: string;
  value: number; // %
  color: string;
  amt: number;
}

export const SALES = {
  date: '6월 18일 (목)',
  channels: [
    { id: 'hall', name: '매장', fee: 0, feeLabel: '수수료 없음' },
    { id: 'delivery', name: '배달', fee: 9.8, feeLabel: '중개 6.8% · 결제 3.0%' },
    { id: 'takeout', name: '포장', fee: 0, feeLabel: '수수료 없음' },
  ] as SaleChannel[],
  menu: [
    { name: '제육볶음', price: 12000, cogs: 2832, qty: 38, hall: 24, delivery: 11, takeout: 3 },
    { name: '김치찌개', price: 9000, cogs: 2997, qty: 22, hall: 15, delivery: 7, takeout: 0 },
    { name: '된장찌개', price: 8000, cogs: 2888, qty: 18, hall: 13, delivery: 5, takeout: 0 },
    { name: '계란말이', price: 6000, cogs: 900, qty: 16, hall: 12, delivery: 2, takeout: 2 },
    { name: '순두부찌개', price: 9000, cogs: 2700, qty: 14, hall: 9, delivery: 5, takeout: 0 },
    { name: '제육덮밥', price: 9500, cogs: 2600, qty: 12, hall: 6, delivery: 5, takeout: 1 },
    { name: '비빔밥', price: 9000, cogs: 2400, qty: 10, hall: 7, delivery: 3, takeout: 0 },
    { name: '공기밥', price: 1000, cogs: 280, qty: 9, hall: 7, delivery: 2, takeout: 0 },
    { name: '라면', price: 4500, cogs: 950, qty: 7, hall: 5, delivery: 2, takeout: 0 },
    { name: '치즈돈까스', price: 11000, cogs: 3400, qty: 5, hall: 2, delivery: 3, takeout: 0 },
    { name: '제육덮밥(곱빼기)', price: 11000, cogs: 3100, qty: 4, hall: 2, delivery: 2, takeout: 0 },
    { name: '계란찜', price: 4000, cogs: 700, qty: 4, hall: 4, delivery: 0, takeout: 0 },
    { name: '콜라', price: 2000, cogs: 900, qty: 3, hall: 1, delivery: 2, takeout: 0 },
    { name: '공깃밥 추가', price: 1000, cogs: 280, qty: 3, hall: 2, delivery: 1, takeout: 0 },
    { name: '된장찌개(곱빼기)', price: 9500, cogs: 3050, qty: 2, hall: 1, delivery: 1, takeout: 0 },
  ] as SaleMenu[],
  etc: 56000, // 기타 매출(레시피 미등록 음료 등)
  // 일 손익(검산): 950,000 − 86,400 − 239,900 − 15,000 − 12,000 − 297,700 − 18,000 = 281,000
  revenue: 950000,
  tax: 86400, // 부가세(매출분)
  material: 239900, // 재료원가(판매분)
  fixed: 297700, // 고정지출(어제값 복사·수정 가능)
  fixedFrom: '6/17',
  extra: 15000, // 부자재
  dailyExtra: 12000, // 추가 지출(당일 일회성)
  waste: 18000, // 폐기 손실(재료원가만)
  profit: 281000,
  channelMix: [
    { label: '매장', value: 63, color: '#3182F6', amt: 598500 },
    { label: '배달', value: 28, color: '#7A8694', amt: 266000 },
    { label: '포장', value: 9, color: '#C5CCD3', amt: 85500 },
  ] as ChannelSeg[],
  wasteItems: [
    { name: '제육볶음', qty: 4, cogs: 2832, raw: false },
    { name: '두부', qty: 6, cogs: 1100, raw: true },
  ],
};

/** 일별 손익(6월 캘린더 — 매출/이익 천원). */
export const SALES_CALENDAR: Record<number, { rev: number; profit: number; today?: boolean }> = {
  8: { rev: 780, profit: 205 }, 9: { rev: 990, profit: 322 }, 10: { rev: 820, profit: 240 },
  11: { rev: 900, profit: 281 }, 12: { rev: 760, profit: 198 }, 13: { rev: 1120, profit: 388 },
  14: { rev: 1240, profit: 441 }, 15: { rev: 690, profit: 152 }, 16: { rev: 880, profit: 268 },
  17: { rev: 1020, profit: 332 }, 18: { rev: 950, profit: 281, today: true },
};

// ── 기간 선택 (SALES-02 매출 분석) ─────────────────────────────
/** 기간 프리셋. 기준일 6/18(목), 주는 일요일(6/14) 시작. */
export type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'custom';

export interface PeriodPreset {
  key: PeriodKey;
  short: string; // 칩 라벨
  label: string; // 화면 표기 기간
  days: number[]; // 6월 일자 (custom·lastMonth 는 별도 처리)
}

export const PERIODS: PeriodPreset[] = [
  { key: 'today', short: '오늘', label: '6월 18일 (목)', days: [18] },
  { key: 'yesterday', short: '어제', label: '6월 17일 (수)', days: [17] },
  { key: 'week', short: '이번주', label: '6월 14일 ~ 18일', days: [14, 15, 16, 17, 18] },
  { key: 'month', short: '이번달', label: '6월 1일 ~ 18일', days: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
  { key: 'lastMonth', short: '지난달', label: '5월 1일 ~ 31일', days: [] },
  { key: 'custom', short: '직접설정', label: '기간 직접 선택', days: [] },
];

/** 지난달(5월) 매출 합계 — 캘린더 일별 데이터가 없어 합계만 둔다. */
export const LAST_MONTH = { revenue: 26_800_000, profit: 7_900_000, days: 31 };

export interface PeriodSales {
  key: PeriodKey;
  label: string;
  dayCount: number;
  revenue: number;
  tax: number;
  material: number;
  waste: number;
  extra: number;
  fixed: number;
  dailyExtra: number;
  expense: number;
  profit: number;
  qty: number;
  channelMix: ChannelSeg[];
  menu: SaleMenu[];
}

/**
 * 기간 손익 — 매출·순이익은 캘린더 일별 실값의 합, 비용 6종은 하루치 구성비로 배분한다.
 * 이렇게 해야 캘린더에 찍힌 숫자를 더한 값과 아래 손익표가 일치한다(비례 확대만 하면 어긋난다).
 * '오늘'이면 검산값 그대로: 950,000 − 669,000 = 281,000 (29.6%).
 * ⚠ 데모용 근사. 실데이터는 기간 내 판매 기록 합산(고정지출은 일배분 합, 세금은 매출분).
 */
export function salesForPeriod(key: PeriodKey, customDays?: number[]): PeriodSales {
  const preset = PERIODS.find((p) => p.key === key) ?? PERIODS[0]!;
  const days = key === 'custom' ? (customDays ?? []) : preset.days;

  // 매출·순이익은 캘린더 실값 합계 — 캘린더 숫자와 아래 손익표가 어긋나지 않게.
  const revenue = key === 'lastMonth'
    ? LAST_MONTH.revenue
    : days.reduce((a, d) => a + (SALES_CALENDAR[d]?.rev ?? 0) * 1000, 0);
  const profit = key === 'lastMonth'
    ? LAST_MONTH.profit
    : days.reduce((a, d) => a + (SALES_CALENDAR[d]?.profit ?? 0) * 1000, 0);
  const dayCount = key === 'lastMonth' ? LAST_MONTH.days : days.length;
  const expense = revenue - profit;

  // 비용 6종은 하루치(SALES) 구성비로 배분. 마지막 항목이 잔액을 흡수해 합이 항상 expense 와 같다.
  const dayExpense = SALES.tax + SALES.material + SALES.waste + SALES.extra + SALES.fixed + SALES.dailyExtra;
  const part = (v: number) => (dayExpense > 0 ? Math.round((expense * v) / dayExpense) : 0);
  const tax = part(SALES.tax);
  const material = part(SALES.material);
  const waste = part(SALES.waste);
  const extra = part(SALES.extra);
  const fixed = part(SALES.fixed);
  const dailyExtra = expense - tax - material - waste - extra - fixed;

  // 판매 수량은 매출 배수로 확대.
  const k = SALES.revenue > 0 ? revenue / SALES.revenue : 0;
  const menu: SaleMenu[] = SALES.menu.map((m) => {
    const hall = Math.round(m.hall * k);
    const delivery = Math.round(m.delivery * k);
    const takeout = Math.round(m.takeout * k);
    return { ...m, hall, delivery, takeout, qty: hall + delivery + takeout };
  });

  return {
    key,
    label: key === 'custom' ? customLabel(days) : preset.label,
    dayCount,
    revenue,
    tax, material, waste, extra, fixed, dailyExtra,
    expense,
    profit,
    qty: menu.reduce((a, m) => a + m.qty, 0),
    channelMix: SALES.channelMix.map((c) => ({ ...c, value: c.value, amt: Math.round(c.amt * k) })),
    menu,
  };
}

/** 직접설정 기간 라벨 — 연속 구간이면 시작~끝, 하루면 그 날. */
export function customLabel(days: number[]): string {
  if (days.length === 0) return '기간을 선택해 주세요';
  const s = Math.min(...days);
  const e = Math.max(...days);
  return s === e ? `6월 ${s}일` : `6월 ${s}일 ~ ${e}일`;
}

/** 직접설정 기본 구간 — 기록이 있는 첫날~오늘. */
export const CUSTOM_DEFAULT = [11, 12, 13, 14, 15, 16, 17, 18];
