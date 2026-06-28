// demoData.ts — 식재료(잔여) 정적 데모 데이터 (data.jsx에서 이식)
// 추후 Supabase rpc.* + react-query 무효화로 교체 예정.
import type {
  Ingredient,
  PurchaseOption,
  PurchaseRecord,
  TrendPointData,
  PeriodSeries,
  StockLedgerMonth,
} from './types';

export const ingredients: Ingredient[] = [
  { id: 'ING-0012', name: '대파', cat: '농산(신선)', status: 'ok', unit: 'g', per: 1000, perLabel: '1,000g', sealed: 2, opened: 1, soon: false, safe: 2, price: 4.71, priceUnit: '원/g', loss: 15, lossReal: 13.2, last: '06-03', vendor: '○○청과', avg: 3.9, low: 3.6, high: 4.2, recent: 4.0, memo: '6월 단가 인상 주의', warn: false },
  { id: 'ING-0003', name: '돼지고기 앞다리', cat: '축산-계란', status: 'ok', unit: 'g', per: 5000, perLabel: '5kg', sealed: 1, opened: 1, soon: false, safe: 1, price: 13.0, priceUnit: '원/g', loss: 0, lossReal: 0, last: '06-04', vendor: '대성축산', avg: 12.4, low: 11.0, high: 13.0, recent: 13.0, memo: '', warn: false },
  { id: 'ING-0007', name: '양파', cat: '농산(신선)', status: 'low', unit: 'g', per: 1200, perLabel: '1.2kg', sealed: 0, opened: 1, soon: false, safe: 3, price: 2.1, priceUnit: '원/g', loss: 10, lossReal: 9.4, last: '05-31', vendor: '대림유통', avg: 2.0, low: 1.8, high: 2.3, recent: 2.1, memo: '', warn: false },
  { id: 'ING-0021', name: '다진마늘', cat: '소스-유지류-장류', status: 'out', unit: 'g', per: 1000, perLabel: '1,000g', sealed: 0, opened: 1, soon: true, safe: 2, price: 8.5, priceUnit: '원/g', loss: 0, lossReal: 0, last: '05-27', vendor: '□□상회', avg: 8.5, low: 8.2, high: 8.9, recent: 8.5, memo: '곧 소진 — 발주 필요', warn: false },
  { id: 'ING-0015', name: '식용유', cat: '소스-유지류-장류', status: 'ok', unit: 'ml', per: 18000, perLabel: '18L', sealed: 2, opened: 1, soon: false, safe: 1, price: 2.5, priceUnit: '원/ml', loss: 0, lossReal: 0, last: '05-20', vendor: '대림유통', avg: 2.5, low: 2.4, high: 2.6, recent: 2.5, memo: '', warn: false },
  { id: 'ING-0009', name: '고추장', cat: '소스-유지류-장류', status: 'ok', unit: 'g', per: 3000, perLabel: '3kg', sealed: 1, opened: 1, soon: false, safe: 1, price: 6.2, priceUnit: '원/g', loss: 0, lossReal: 0, last: '05-22', vendor: '□□상회', avg: 6.2, low: 6.0, high: 6.4, recent: 6.2, memo: '', warn: false },
  { id: 'ING-0001', name: '계란', cat: '축산-계란', status: 'ok', unit: '개', per: 30, perLabel: '30개', sealed: 3, opened: 1, soon: false, safe: 2, price: 220, priceUnit: '원/개', loss: 0, lossReal: 0, last: '06-02', vendor: '대성축산', avg: 220, low: 210, high: 230, recent: 220, memo: '', warn: false },
  { id: 'ING-0030', name: '두부', cat: '두부-발효식품', status: 'low', unit: '개', per: 1, perLabel: '1개', sealed: 4, opened: 0, soon: false, safe: 6, price: 1100, priceUnit: '원/개', loss: 0, lossReal: 0, last: '06-03', vendor: '○○청과', avg: 1100, low: 1050, high: 1150, recent: 1100, memo: '', warn: false },
  { id: 'ING-0018', name: '진간장', cat: '소스-유지류-장류', status: 'ok', unit: 'ml', per: 1800, perLabel: '1.8L', sealed: 2, opened: 1, soon: false, safe: 1, price: 3.1, priceUnit: '원/ml', loss: 0, lossReal: 0, last: '05-18', vendor: '□□상회', avg: 3.1, low: 3.0, high: 3.2, recent: 3.1, memo: '', warn: false },
  { id: 'ING-0024', name: '청양고추', cat: '농산(신선)', status: 'ok', unit: 'g', per: 500, perLabel: '500g', sealed: 1, opened: 1, soon: false, safe: 1, price: 9.8, priceUnit: '원/g', loss: 8, lossReal: 7.1, last: '06-01', vendor: '대림유통', avg: 9.8, low: 8.5, high: 11.0, recent: 9.8, memo: '', warn: false },
];

// 대파 구매 옵션·링크
export const options: PurchaseOption[] = [
  { name: '대파(흙대파) 1kg', vendor: '○○청과몰', brand: '-', vol: '1kg-4,000원', price: '4,000원', per: 4.0, badge: null },
  { name: '깐대파 1kg', vendor: '쿠팡', brand: '곰곰', vol: '1kg-5,200원', price: '5,200원', per: 5.2, badge: 'high' },
  { name: '대파 2kg 박스', vendor: '□□상회', brand: '-', vol: '2kg-7,600원', price: '7,600원', per: 3.8, badge: 'low' },
];

// 식재료별 구매 옵션·링크 (상세 ING-03 · 수정 ING-04 공용)
export const optionsByName: Record<string, PurchaseOption[]> = {
  대파: options,
  양파: [
    { name: '양파 1.2kg', vendor: '대림유통', brand: '-', vol: '1.2kg-2,520원', price: '2,520원', per: 2.1, badge: null },
    { name: '양파 3kg 박스', vendor: '농산랜드', brand: '-', vol: '3kg-5,400원', price: '5,400원', per: 1.8, badge: 'low' },
    { name: '깐양파 1kg', vendor: '쿠팡', brand: '곰곰', vol: '1kg-2,300원', price: '2,300원', per: 2.3, badge: 'high' },
  ],
  '돼지고기 앞다리': [
    { name: '앞다리살 5kg 냉장', vendor: '대성축산', brand: '-', vol: '5kg-65,000원', price: '65,000원', per: 13.0, badge: 'high' },
    { name: '앞다리살 5kg 냉동', vendor: '미트뱅크', brand: '-', vol: '5kg-55,000원', price: '55,000원', per: 11.0, badge: 'low' },
  ],
  다진마늘: [
    { name: '다진마늘 1kg', vendor: '□□상회', brand: '-', vol: '1kg-8,500원', price: '8,500원', per: 8.5, badge: null },
    { name: '다진마늘 3kg', vendor: '양념마을', brand: '-', vol: '3kg-24,600원', price: '24,600원', per: 8.2, badge: 'low' },
  ],
  식용유: [
    { name: '식용유 18L', vendor: '대림유통', brand: '해표', vol: '18L-45,000원', price: '45,000원', per: 2.5, badge: null },
    { name: '카놀라유 18L', vendor: '식자재마트', brand: '-', vol: '18L-43,200원', price: '43,200원', per: 2.4, badge: 'low' },
  ],
  고추장: [
    { name: '고추장 3kg', vendor: '□□상회', brand: '-', vol: '3kg-18,600원', price: '18,600원', per: 6.2, badge: null },
  ],
  계란: [
    { name: '계란 30개', vendor: '대성축산', brand: '-', vol: '30개-6,600원', price: '6,600원', per: 220, badge: null },
    { name: '특란 30개', vendor: '양계직판', brand: '-', vol: '30개-6,300원', price: '6,300원', per: 210, badge: 'low' },
  ],
  두부: [
    { name: '두부 10개', vendor: '○○청과', brand: '-', vol: '10개-11,000원', price: '11,000원', per: 1100, badge: 'low' },
    { name: '두부 1개', vendor: '쿠팡', brand: '-', vol: '1개-1,200원', price: '1,200원', per: 1200, badge: 'high' },
  ],
  진간장: [
    { name: '진간장 1.8L', vendor: '□□상회', brand: '-', vol: '1.8L-5,580원', price: '5,580원', per: 3.1, badge: null },
  ],
  청양고추: [
    { name: '청양고추 500g', vendor: '대림유통', brand: '-', vol: '500g-4,900원', price: '4,900원', per: 9.8, badge: null },
  ],
};

/** 식재료의 구매 옵션 (없으면 대파 기본). */
export const optionsFor = (name?: string): PurchaseOption[] => optionsByName[name ?? '대파'] ?? options;

// 대파 최근 주문/입고 내역
export const purchases: PurchaseRecord[] = [
  { date: '06-03', vendor: '○○청과', brand: '-', each: '1kg', unitWon: 4000, qtyN: 2, qty: '2개', per: 4.0 },
  { date: '05-28', vendor: '대림유통', brand: '-', each: '1kg', unitWon: 3600, qtyN: 3, qty: '3개', per: 3.6 },
  { date: '05-20', vendor: '○○청과', brand: '-', each: '1kg', unitWon: 4200, qtyN: 1, qty: '1개', per: 4.2 },
];

// 대파 가격 추이
export const priceTrend: TrendPointData[] = [{ v: 4.2 }, { v: 3.6 }, { v: 3.8 }, { v: 4.0 }, { v: 4.0, big: true }];

// 기간별 집계 데모 (대파 원/g)
export const priceByPeriod: Record<string, PeriodSeries> = {
  '1주일': { unit: '일별 · 7점', labels: ['6/01', '6/02', '6/03', '6/04', '6/05', '6/06', '6/07'], pts: [{ v: 4.0 }, { v: 3.9 }, { v: 4.1 }, { v: 4.0 }, { v: 4.2 }, { v: 4.1 }, { v: 4.0, big: true }] },
  '2주일': { unit: '일별 · 14점', labels: ['5/25', '5/26', '5/27', '5/28', '5/29', '5/30', '5/31', '6/01', '6/02', '6/03', '6/04', '6/05', '6/06', '6/07'], pts: [{ v: 3.7 }, { v: 3.8 }, { v: 3.6 }, { v: 3.9 }, { v: 4.0 }, { v: 3.9 }, { v: 4.1 }, { v: 4.0 }, { v: 3.8 }, { v: 4.1 }, { v: 4.0 }, { v: 4.2 }, { v: 4.1 }, { v: 4.0, big: true }] },
  '1개월': { unit: '주별 평균 · 5점', labels: ['1주', '2주', '3주', '4주', '5주'], pts: [{ v: 3.7 }, { v: 3.9 }, { v: 3.8 }, { v: 4.0 }, { v: 4.05, big: true }] },
  '3개월': { unit: '주별 평균 · 13점', labels: ['1주', '2주', '3주', '4주', '5주', '6주', '7주', '8주', '9주', '10주', '11주', '12주', '13주'], pts: [{ v: 3.4 }, { v: 3.5 }, { v: 3.6 }, { v: 3.5 }, { v: 3.7 }, { v: 3.8 }, { v: 3.7 }, { v: 3.9 }, { v: 3.8 }, { v: 4.0 }, { v: 3.9 }, { v: 4.1 }, { v: 4.0, big: true }] },
  '6개월': { unit: '월별 평균 · 6점', labels: ['1월', '2월', '3월', '4월', '5월', '6월'], pts: [{ v: 3.2 }, { v: 3.3 }, { v: 3.5 }, { v: 3.6 }, { v: 3.8 }, { v: 4.0, big: true }] },
  '12개월': { unit: '월별 평균 · 12점', labels: ['7월', '8월', '9월', '10월', '11월', '12월', '1월', '2월', '3월', '4월', '5월', '6월'], pts: [{ v: 4.3 }, { v: 4.1 }, { v: 3.8 }, { v: 3.5 }, { v: 3.3 }, { v: 3.1 }, { v: 3.2 }, { v: 3.4 }, { v: 3.5 }, { v: 3.7 }, { v: 3.9 }, { v: 4.0, big: true }] },
};

export const categories = [
  '축산·계란', '수산·해조류', '농산 (신선)', '곡물·견과·분말', '유제품', '냉동식품',
  '소스·유지류·장류', '향신료·허브', '음료·주류', '상온가공·건식', '두부·발효식품', '베이커리',
];

export const listCategories = ['전체', ...categories];

// ING-03 상세: 대파 재고 변동 내역 (요약)
export const detailLedger = [
  { date: '06/20 18:40', act: '수량 조정', memo: '상해서 폐기', delta: '−2.3kg', bal: '3.9kg', up: false },
  { date: '06/19 20:30', act: '판매 소진', memo: '제육볶음 외 3개 메뉴', delta: '−1.9kg', bal: '6.2kg', up: false },
  { date: '06/03 09:15', act: '○○청과 입고', memo: '1kg 2개 · 8,000원 · 4원/g', delta: '+2.0kg', bal: '8.1kg', up: true },
  { date: '05/28 10:05', act: '대림유통 입고', memo: '1kg 3개 · 10,800원 · 3.6원/g', delta: '+3.0kg', bal: '6.1kg', up: true },
];

// ING-07 재고 내역 원장 (전체)
export const stockLedger: StockLedgerMonth[] = [
  {
    ym: '2026년 6월',
    rows: [
      { dt: '06/20 18:40', act: '수량 조정', memo: '상해서 폐기', delta: '-2.3kg', bal: '잔량 3.9kg', up: false },
      { dt: '06/19 20:30', act: '판매 소진', memo: '제육볶음 외 3개 메뉴', delta: '-1.9kg', bal: '잔량 6.2kg', up: false },
      { dt: '06/03 09:15', act: '○○청과 입고', memo: '1kg 2개 · 8,000원 · 4원/g', delta: '+2.0kg', bal: '잔량 8.1kg', up: true },
    ],
  },
  {
    ym: '2026년 5월',
    rows: [
      { dt: '05/28 10:05', act: '대림유통 입고', memo: '1kg 3개 · 10,800원 · 3.6원/g', delta: '+3.0kg', bal: '잔량 6.1kg', up: true },
      { dt: '05/21 19:50', act: '판매 소진', memo: '제육볶음 외 2개 메뉴', delta: '-2.4kg', bal: '잔량 3.1kg', up: false },
      { dt: '05/14 09:40', act: '○○청과 입고', memo: '1kg 5개 · 19,000원 · 3.8원/g', delta: '+5.0kg', bal: '잔량 5.5kg', up: true },
    ],
  },
];

// ──────────────────────────────────────────────────────────────
// 레거시 호환 export — 레시피 재료 검색(RecipeIngredientSearchScreen)에서 사용.
// 추후 Supabase 연동 시 위 ingredients 로 일원화 예정.
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
  price: number;
  priceUnit: string;
  last: string;
  warn?: boolean;
  warnPct?: number;
  avg?: number;
  low?: number;
  high?: number;
  loss?: number;
  lossReal?: number;
  safe?: number;
  minOrder?: number;
  vendor?: string;
  memo?: string;
}

export const DEMO_INGREDIENTS: IngCardData[] = ingredients.map((g) => ({
  id: g.id,
  name: g.name,
  cat: g.cat,
  status: g.status,
  unit: g.unit,
  per: g.per,
  sealed: g.sealed,
  opened: g.opened,
  soon: g.soon,
  price: g.price,
  priceUnit: g.priceUnit,
  last: g.last,
  warn: g.warn,
  warnPct: g.warnPct,
  avg: g.avg,
  low: g.low,
  high: g.high,
  loss: g.loss,
  lossReal: g.lossReal,
  safe: g.safe,
  minOrder: g.safe,
  vendor: g.vendor,
  memo: g.memo,
}));

/** 개당 용량 라벨 — 프로토타입 카드 로직(g·ml·개). */
export function perLabel(unit: '개' | 'g' | 'ml', per: number): string {
  if (unit === '개') return `${per}개`;
  if (per >= 1000) return `${per / 1000}${unit === 'ml' ? 'L' : 'kg'}`;
  return `${per}${unit}`;
}
