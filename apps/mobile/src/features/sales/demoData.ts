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
  17: { rev: 1020, profit: 332 }, 18: { rev: 950, profit: 300, today: true },
};

export const SALES_MONTH = { rev: 28_500_000, expense: 17_130_000, profit: 11_370_000, rate: 39.9, days: 18, avgProfit: 632_000 };
