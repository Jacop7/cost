/**
 * 식재료 데모 데이터 — 프로토타입 data.jsx 발췌 (ING-01 리스트 · ING-02 상세).
 * ⚠ 임시. 실데이터는 Supabase 쿼리(useIngredients)로 교체.
 */
export interface IngCardData {
  id: string;
  name: string;
  cat: string;
  status: 'ok' | 'low' | 'out';
  unit: 'g' | 'ml' | '개';
  per: number;
  sealed: number;
  opened: number;
  soon: boolean;
  price: number; // 기준 단가
  priceUnit: string;
  last: string;
  warn?: boolean;
  warnPct?: number;
  // 상세용
  avg?: number; // 가중평균 단가
  low?: number; // 최저 단가
  high?: number; // 최고 단가
  loss?: number; // 등록 로스율(%)
  lossReal?: number; // 실측 로스율(%)
  safe?: number; // 안전재고(개수)
  minOrder?: number; // 최소 발주(개수)
  vendor?: string; // 기본 거래처
  memo?: string;
}

export const DEMO_INGREDIENTS: IngCardData[] = [
  { id: 'ING-0012', name: '대파', cat: '농산(신선)', status: 'ok', unit: 'g', per: 1000, sealed: 2, opened: 1, soon: false, price: 4.71, priceUnit: '원/g', last: '06-03', avg: 3.9, low: 3.6, high: 4.2, loss: 15, lossReal: 13.2, safe: 2, minOrder: 1, vendor: '○○청과', memo: '6월 단가 인상 주의 · 흙대파보다 깐대파가 33% 비쌈' },
  { id: 'ING-0003', name: '돼지고기 앞다리', cat: '축산-계란', status: 'ok', unit: 'g', per: 5000, sealed: 1, opened: 1, soon: false, price: 13.0, priceUnit: '원/g', last: '06-04', avg: 12.4, low: 11.0, high: 13.0, loss: 0, lossReal: 0, safe: 1, minOrder: 1, vendor: '대성축산' },
  { id: 'ING-0007', name: '양파', cat: '농산(신선)', status: 'low', unit: 'g', per: 1200, sealed: 0, opened: 1, soon: false, price: 2.1, priceUnit: '원/g', last: '05-31', avg: 2.0, low: 1.8, high: 2.3, loss: 10, lossReal: 9.4, safe: 3, minOrder: 1, vendor: '대림유통' },
  { id: 'ING-0021', name: '다진마늘', cat: '소스-유지류-장류', status: 'out', unit: 'g', per: 1000, sealed: 0, opened: 1, soon: true, price: 8.5, priceUnit: '원/g', last: '05-27', avg: 8.5, low: 8.2, high: 8.9, loss: 0, lossReal: 0, safe: 2, minOrder: 1, vendor: '□□상회', memo: '곧 소진 — 발주 필요' },
  { id: 'ING-0015', name: '식용유', cat: '소스-유지류-장류', status: 'ok', unit: 'ml', per: 18000, sealed: 2, opened: 1, soon: false, price: 2.5, priceUnit: '원/ml', last: '05-20', avg: 2.5, low: 2.4, high: 2.6, loss: 0, lossReal: 0, safe: 1, minOrder: 1, vendor: '대림유통' },
  { id: 'ING-0001', name: '계란', cat: '축산-계란', status: 'ok', unit: '개', per: 30, sealed: 3, opened: 1, soon: false, price: 220, priceUnit: '원/개', last: '06-02', avg: 220, low: 210, high: 230, loss: 0, lossReal: 0, safe: 2, minOrder: 1, vendor: '대성축산' },
  { id: 'ING-0030', name: '두부', cat: '두부-발효식품', status: 'low', unit: '개', per: 1, sealed: 4, opened: 0, soon: false, price: 1100, priceUnit: '원/개', last: '06-03', avg: 1100, low: 1050, high: 1150, loss: 0, lossReal: 0, safe: 6, minOrder: 1, vendor: '○○청과' },
];

export const CATEGORIES = [
  '전체', '축산·계란', '수산·해조류', '농산 (신선)', '곡물·견과·분말', '유제품', '냉동식품',
  '소스·유지류·장류', '향신료·허브', '음료·주류', '상온가공·건식', '두부·발효식품', '베이커리',
];

/** 개당 용량 라벨 — 프로토타입 카드 로직(g·ml·개). */
export function perLabel(unit: '개' | 'g' | 'ml', per: number): string {
  if (unit === '개') return `${per}개`;
  if (per >= 1000) return `${per / 1000}${unit === 'ml' ? 'L' : 'kg'}`;
  return `${per}${unit}`;
}

export const getIngredient = (id?: string) => DEMO_INGREDIENTS.find((g) => g.id === id);

// ── 상세(ING-02) 확장 데모 — 식재료별 추이·이력·옵션 (대파만 채움) ──────
export interface Purchase {
  date: string;
  vendor: string;
  each: string;
  unitWon: number;
  qtyN: number;
  per: number;
}
export interface Option {
  name: string;
  vendor: string;
  per: number;
  best?: boolean;
  high?: boolean;
}
export interface DetailExtra {
  trend: { v: number; big?: boolean }[];
  trendChange: string; // 예: '▲ 2.6% 상승'
  purchases: Purchase[];
  options: Option[];
}

export const DETAIL_EXTRAS: Record<string, DetailExtra> = {
  'ING-0012': {
    trend: [{ v: 3.4 }, { v: 3.5 }, { v: 3.6 }, { v: 3.7 }, { v: 3.8 }, { v: 3.9 }, { v: 4.0 }, { v: 4.05 }, { v: 4.0, big: true }],
    trendChange: '▲ 2.6% 상승',
    purchases: [
      { date: '06-03', vendor: '○○청과', each: '1kg', unitWon: 4000, qtyN: 2, per: 4.0 },
      { date: '05-28', vendor: '대림유통', each: '1kg', unitWon: 3600, qtyN: 3, per: 3.6 },
      { date: '05-20', vendor: '○○청과', each: '1kg', unitWon: 4200, qtyN: 1, per: 4.2 },
      { date: '05-12', vendor: '□□상회', each: '1kg', unitWon: 3900, qtyN: 2, per: 3.9 },
      { date: '05-05', vendor: '대림유통', each: '1kg', unitWon: 3700, qtyN: 2, per: 3.7 },
      { date: '04-28', vendor: '○○청과', each: '1kg', unitWon: 4100, qtyN: 1, per: 4.1 },
    ],
    options: [
      { name: '대파(흙대파) 1kg, 4,000원', vendor: '○○청과몰', per: 4.0 },
      { name: '깐대파 1kg, 5,200원', vendor: '쿠팡 · 곰곰', per: 5.2, high: true },
      { name: '대파 2kg 박스, 7,600원', vendor: '□□상회', per: 3.8, best: true },
    ],
  },

  // 돼지고기 앞다리 (원/g · 5kg 단위)
  'ING-0003': {
    trend: [{ v: 11.0 }, { v: 11.4 }, { v: 11.8 }, { v: 12.0 }, { v: 12.4 }, { v: 12.6 }, { v: 13.0, big: true }],
    trendChange: '▲ 4.8% 상승',
    purchases: [
      { date: '06-04', vendor: '대성축산', each: '5kg', unitWon: 65000, qtyN: 1, per: 13.0 },
      { date: '05-22', vendor: '미트뱅크', each: '5kg', unitWon: 62000, qtyN: 1, per: 12.4 },
      { date: '05-10', vendor: '대성축산', each: '5kg', unitWon: 60000, qtyN: 2, per: 12.0 },
      { date: '04-30', vendor: '한돈유통', each: '5kg', unitWon: 55000, qtyN: 1, per: 11.0 },
    ],
    options: [
      { name: '앞다리살 5kg 냉장', vendor: '대성축산', per: 13.0, high: true },
      { name: '앞다리살 5kg 냉동', vendor: '미트뱅크', per: 11.0, best: true },
      { name: '앞다리살 3kg', vendor: '한돈몰', per: 12.0 },
    ],
  },

  // 양파 (원/g · 1.2kg 단위)
  'ING-0007': {
    trend: [{ v: 1.8 }, { v: 1.9 }, { v: 1.95 }, { v: 2.0 }, { v: 2.05 }, { v: 2.1, big: true }],
    trendChange: '▲ 5.0% 상승',
    purchases: [
      { date: '05-31', vendor: '대림유통', each: '1.2kg', unitWon: 2520, qtyN: 3, per: 2.1 },
      { date: '05-20', vendor: '○○청과', each: '1.2kg', unitWon: 2400, qtyN: 2, per: 2.0 },
      { date: '05-08', vendor: '농산랜드', each: '1.2kg', unitWon: 2160, qtyN: 2, per: 1.8 },
      { date: '04-27', vendor: '□□상회', each: '1.2kg', unitWon: 2760, qtyN: 1, per: 2.3 },
    ],
    options: [
      { name: '양파 1.2kg', vendor: '대림유통', per: 2.1 },
      { name: '양파 3kg 박스', vendor: '농산랜드', per: 1.8, best: true },
      { name: '깐양파 1kg', vendor: '쿠팡', per: 2.3, high: true },
    ],
  },

  // 다진마늘 (원/g · 1kg 단위)
  'ING-0021': {
    trend: [{ v: 8.2 }, { v: 8.3 }, { v: 8.5 }, { v: 8.6 }, { v: 8.9 }, { v: 8.5, big: true }],
    trendChange: '▲ 1.2% 상승',
    purchases: [
      { date: '05-27', vendor: '□□상회', each: '1kg', unitWon: 8500, qtyN: 1, per: 8.5 },
      { date: '05-15', vendor: '양념마을', each: '1kg', unitWon: 8200, qtyN: 2, per: 8.2 },
      { date: '05-02', vendor: '□□상회', each: '1kg', unitWon: 8900, qtyN: 1, per: 8.9 },
    ],
    options: [
      { name: '다진마늘 1kg', vendor: '□□상회', per: 8.5 },
      { name: '다진마늘 3kg', vendor: '양념마을', per: 8.2, best: true },
      { name: '깐마늘 1kg', vendor: '쿠팡', per: 8.9, high: true },
    ],
  },

  // 식용유 (원/ml · 18L 단위)
  'ING-0015': {
    trend: [{ v: 2.4 }, { v: 2.45 }, { v: 2.5 }, { v: 2.55 }, { v: 2.6 }, { v: 2.5, big: true }],
    trendChange: '▲ 0.8% 상승',
    purchases: [
      { date: '05-20', vendor: '대림유통', each: '18L', unitWon: 45000, qtyN: 2, per: 2.5 },
      { date: '05-05', vendor: '식자재마트', each: '18L', unitWon: 43200, qtyN: 1, per: 2.4 },
      { date: '04-20', vendor: '대림유통', each: '18L', unitWon: 46800, qtyN: 1, per: 2.6 },
    ],
    options: [
      { name: '식용유 18L', vendor: '대림유통', per: 2.5 },
      { name: '카놀라유 18L', vendor: '식자재마트', per: 2.4, best: true },
      { name: '콩기름 18L', vendor: '쿠팡', per: 2.6, high: true },
    ],
  },

  // 계란 (원/개 · 30개 단위)
  'ING-0001': {
    trend: [{ v: 210 }, { v: 213 }, { v: 216 }, { v: 220 }, { v: 225 }, { v: 220, big: true }],
    trendChange: '▲ 2.3% 상승',
    purchases: [
      { date: '06-02', vendor: '대성축산', each: '30개', unitWon: 6600, qtyN: 3, per: 220 },
      { date: '05-22', vendor: '양계직판', each: '30개', unitWon: 6300, qtyN: 2, per: 210 },
      { date: '05-10', vendor: '대성축산', each: '30개', unitWon: 6900, qtyN: 1, per: 230 },
    ],
    options: [
      { name: '계란 30개', vendor: '대성축산', per: 220 },
      { name: '특란 30개', vendor: '양계직판', per: 210, best: true },
      { name: '계란 15개', vendor: '마트', per: 230, high: true },
    ],
  },

  // 두부 (원/개 · 1개 단위)
  'ING-0030': {
    trend: [{ v: 1050 }, { v: 1070 }, { v: 1090 }, { v: 1100 }, { v: 1150 }, { v: 1100, big: true }],
    trendChange: '▲ 1.9% 상승',
    purchases: [
      { date: '06-03', vendor: '○○청과', each: '1개', unitWon: 1100, qtyN: 4, per: 1100 },
      { date: '05-24', vendor: '두부공방', each: '1개', unitWon: 1050, qtyN: 6, per: 1050 },
      { date: '05-12', vendor: '○○청과', each: '1개', unitWon: 1150, qtyN: 2, per: 1150 },
    ],
    options: [
      { name: '국산콩 두부 1개', vendor: '○○청과', per: 1100 },
      { name: '두부 1개', vendor: '두부공방', per: 1050, best: true },
      { name: '유기농 두부 1개', vendor: '쿠팡', per: 1150, high: true },
    ],
  },
};

export const won = (n: number): string => Math.round(n).toLocaleString('ko-KR');
