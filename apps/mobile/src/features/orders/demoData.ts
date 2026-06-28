/**
 * 발주(ORD) 데모 데이터 — 프로토타입(발주 현황 페이지 정리본) 이식. ⚠ 임시(Supabase 연동 전).
 */
export interface OrderOption {
  name: string; // 상품명
  vendor: string;
  brand: string;
  amt: number; // 금액(원)
  vol: number; // 용량(1개 기준, unit 단위)
  unit: 'g' | 'ml' | '개'; // 용량·단가 단위
  per: number; // 환산 단가(원/unit)
  badge: 'high' | 'low' | null;
}

export interface Candidate {
  name: string;
  reason: 'out' | 'low' | 'recipe';
  reasonLabel: string;
  remain: string; // 현재 재고 (예: '1.2kg (안전 3kg)')
  rec: number; // 권장 발주량
  recUnit: string; // 권장 단위
  recent: string; // 최근 주문 한 줄
}

export interface Waiting {
  name: string;
  buy: string; // 구매처·상품·수량·금액 한 줄
  per: string; // 환산 단가(입고 시 입고 단가로 이월)
  dueOffset: number; // 오늘 기준 도착일(일). 음수 = 지연
}

export interface Done {
  name: string;
  buy: string; // 구매 내역 한 줄
  per: string; // 입고 단가
  agoOffset: number; // 오늘 기준 며칠 전 입고(0 = 오늘)
}

// 식재료별 구매 옵션·링크 (주문하기 / 발주완료 시트 · 옵션 변경 공용)
export const OPTIONS_BY_INGREDIENT: Record<string, OrderOption[]> = {
  대파: [
    { name: '대파(흙대파) 1kg', vendor: '○○청과몰', brand: '-', amt: 4000, vol: 1000, unit: 'g', per: 4.0, badge: null },
    { name: '깐대파 1kg', vendor: '쿠팡', brand: '곰곰', amt: 5200, vol: 1000, unit: 'g', per: 5.2, badge: 'high' },
    { name: '대파 2kg 박스', vendor: '□□상회', brand: '-', amt: 7600, vol: 2000, unit: 'g', per: 3.8, badge: 'low' },
  ],
  양파: [
    { name: '양파 1.2kg', vendor: '대림유통', brand: '-', amt: 2520, vol: 1200, unit: 'g', per: 2.1, badge: null },
    { name: '양파 3kg 박스', vendor: '농산랜드', brand: '-', amt: 5400, vol: 3000, unit: 'g', per: 1.8, badge: 'low' },
    { name: '깐양파 1kg', vendor: '쿠팡', brand: '곰곰', amt: 2300, vol: 1000, unit: 'g', per: 2.3, badge: 'high' },
  ],
  다진마늘: [
    { name: '다진마늘 1kg', vendor: '□□상회', brand: '-', amt: 8500, vol: 1000, unit: 'g', per: 8.5, badge: null },
    { name: '다진마늘 3kg', vendor: '양념마을', brand: '-', amt: 24600, vol: 3000, unit: 'g', per: 8.2, badge: 'low' },
  ],
  '돼지고기 앞다리': [
    { name: '앞다리살 5kg 냉장', vendor: '대성축산', brand: '-', amt: 65000, vol: 5000, unit: 'g', per: 13.0, badge: 'high' },
    { name: '앞다리살 5kg 냉동', vendor: '미트뱅크', brand: '-', amt: 55000, vol: 5000, unit: 'g', per: 11.0, badge: 'low' },
  ],
  두부: [
    { name: '두부 10개', vendor: '○○청과', brand: '-', amt: 11000, vol: 10, unit: '개', per: 1100, badge: 'low' },
    { name: '두부 1개', vendor: '쿠팡', brand: '-', amt: 1200, vol: 1, unit: '개', per: 1200, badge: 'high' },
  ],
  식용유: [
    { name: '식용유 18L', vendor: '대림유통', brand: '해표', amt: 45000, vol: 18000, unit: 'ml', per: 2.5, badge: null },
    { name: '카놀라유 18L', vendor: '식자재마트', brand: '-', amt: 43200, vol: 18000, unit: 'ml', per: 2.4, badge: 'low' },
  ],
  계란: [
    { name: '계란 30개', vendor: '대성축산', brand: '-', amt: 6600, vol: 30, unit: '개', per: 220, badge: null },
    { name: '특란 30개', vendor: '양계직판', brand: '-', amt: 6300, vol: 30, unit: '개', per: 210, badge: 'low' },
  ],
  청양고추: [
    { name: '청양고추 500g', vendor: '대림유통', brand: '-', amt: 4900, vol: 500, unit: 'g', per: 9.8, badge: null },
  ],
};

/** 식재료의 구매 옵션 (없으면 대파 기본). */
export const optionsFor = (name?: string): OrderOption[] => OPTIONS_BY_INGREDIENT[name ?? '대파'] ?? OPTIONS_BY_INGREDIENT['대파']!;

export const CANDIDATES: Candidate[] = [
  { name: '양파', reason: 'low', reasonLabel: '안전재고 미달', remain: '1.2kg (안전 3kg)', rec: 3.6, recUnit: 'kg', recent: '대림유통, 양파 1.2kg, 2개 5,040원 (5/31)' },
  { name: '다진마늘', reason: 'out', reasonLabel: '곧 소진', remain: '200g (안전 1kg)', rec: 1000, recUnit: 'g', recent: '□□상회, 다진마늘 1kg, 1개 8,500원 (5/27)' },
  { name: '돼지고기 앞다리', reason: 'out', reasonLabel: '곧 소진', remain: '2kg (안전 5kg)', rec: 5, recUnit: 'kg', recent: '대성축산, 돼지고기 앞다리 5kg, 1개 65,000원 (6/04)' },
  { name: '두부', reason: 'low', reasonLabel: '안전재고 미달', remain: '4개 (안전 6개)', rec: 2, recUnit: '개', recent: '○○청과, 두부 10개, 1개 11,000원 (6/03)' },
  { name: '식용유', reason: 'low', reasonLabel: '안전재고 미달', remain: '3L (안전 18L)', rec: 18, recUnit: 'L', recent: '쿠팡, 식용유 18L, 1개 45,000원 (5/20)' },
];

export const WAITING: Waiting[] = [
  { name: '대파', buy: '○○청과, 대파 1개, 2개 8,000원', per: '4.0원/g', dueOffset: 2 },
  { name: '계란', buy: '대성축산, 계란 30개, 3개 19,800원', per: '660원/개', dueOffset: 1 },
  { name: '두부', buy: '○○청과, 두부 10개, 2개 22,000원', per: '1,100원/개', dueOffset: 0 },
  { name: '식용유', buy: '대림유통, 식용유 18L, 1개 45,000원', per: '2.5원/ml', dueOffset: -1 },
];

export const DONE: Done[] = [
  { name: '돼지고기 앞다리', buy: '대성축산, 돼지고기 앞다리 5kg, 1개 65,000원', per: '13.0원/g', agoOffset: 2 },
  { name: '청양고추', buy: '대림유통, 청양고추 500g, 1개 4,900원', per: '9.8원/g', agoOffset: 5 },
  { name: '두부', buy: '○○청과, 두부 10개, 2개 22,000원', per: '1,100원/개', agoOffset: 3 },
  { name: '대파', buy: '대림유통, 대파 1개, 3개 10,800원', per: '3.6원/g', agoOffset: 9 },
];
