/**
 * ING-01 데모 데이터 — 프로토타입 data.jsx 의 ingredients 발췌.
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
  price: number;
  priceUnit: string;
  last: string;
  warn?: boolean;
  warnPct?: number;
}

export const DEMO_INGREDIENTS: IngCardData[] = [
  { id: 'ING-0012', name: '대파', cat: '농산(신선)', status: 'ok', unit: 'g', per: 1000, sealed: 2, opened: 1, soon: false, price: 4.71, priceUnit: '원/g', last: '06-03' },
  { id: 'ING-0003', name: '돼지고기 앞다리', cat: '축산-계란', status: 'ok', unit: 'g', per: 5000, sealed: 1, opened: 1, soon: false, price: 13.0, priceUnit: '원/g', last: '06-04' },
  { id: 'ING-0007', name: '양파', cat: '농산(신선)', status: 'low', unit: 'g', per: 1200, sealed: 0, opened: 1, soon: false, price: 2.1, priceUnit: '원/g', last: '05-31' },
  { id: 'ING-0021', name: '다진마늘', cat: '소스-유지류-장류', status: 'out', unit: 'g', per: 1000, sealed: 0, opened: 1, soon: true, price: 8.5, priceUnit: '원/g', last: '05-27' },
  { id: 'ING-0015', name: '식용유', cat: '소스-유지류-장류', status: 'ok', unit: 'ml', per: 18000, sealed: 2, opened: 1, soon: false, price: 2.5, priceUnit: '원/ml', last: '05-20' },
  { id: 'ING-0001', name: '계란', cat: '축산-계란', status: 'ok', unit: '개', per: 30, sealed: 3, opened: 1, soon: false, price: 220, priceUnit: '원/개', last: '06-02' },
  { id: 'ING-0030', name: '두부', cat: '두부-발효식품', status: 'low', unit: '개', per: 1, sealed: 4, opened: 0, soon: false, price: 1100, priceUnit: '원/모', last: '06-03' },
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
