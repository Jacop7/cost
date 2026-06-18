/**
 * 발주(ORD) 데모 데이터 — 프로토타입 data.jsx 발췌. ⚠ 임시(Supabase 연동 전).
 */
export interface OrderOption {
  name: string; // 상품명
  vol: string; // 용량 (예: '1통(1kg)')
  amt: number; // 금액
  vendor: string;
  per: string; // 환산 단가 라벨 (예: '2.1원/g')
}

export interface Candidate {
  name: string;
  reason: 'out' | 'low' | 'recipe';
  reasonLabel: string;
  rec: string; // 권장 발주 (예: '3망')
  remain: string; // 현재 재고
  recent: string; // 최근 주문
  hint?: string; // 절약 힌트
  calcNote?: string; // 레시피 계산 사유
  options: OrderOption[]; // 구매 링크·옵션
}

export interface Waiting {
  name: string;
  vendor: string;
  brand?: string;
  qty: string;
  amt: number;
  due: string;
  late?: boolean;
}

export interface Done {
  name: string;
  vendor: string;
  qty: string;
  amt: number;
  date: string;
}

export const CANDIDATES: Candidate[] = [
  {
    name: '양파', reason: 'low', reasonLabel: '안전재고 미달', rec: '3', remain: '미개봉 0 · 개봉 1', recent: '대림유통 2,520원 (5/31)',
    options: [
      { name: '양파', vol: '1.2kg', amt: 2520, vendor: '대림유통', per: '2.1원/g' },
      { name: '양파', vol: '3kg', amt: 5400, vendor: '농산랜드', per: '1.8원/g' },
      { name: '깐양파', vol: '1kg', amt: 2300, vendor: '쿠팡', per: '2.3원/g' },
    ],
  },
  {
    name: '다진마늘', reason: 'out', reasonLabel: '곧 소진', rec: '2', remain: '개봉 1', recent: '□□상회 8,500원 (5/27)',
    options: [
      { name: '다진마늘', vol: '1kg', amt: 8500, vendor: '□□상회', per: '8.5원/g' },
      { name: '다진마늘', vol: '3kg', amt: 24600, vendor: '양념마을', per: '8.2원/g' },
    ],
  },
  {
    name: '돼지고기 앞다리', reason: 'out', reasonLabel: '곧 소진', rec: '1', remain: '미개봉 1 · 개봉 1', recent: '대성축산 65,000원 (6/04)',
    options: [
      { name: '앞다리살 냉장', vol: '5kg', amt: 65000, vendor: '대성축산', per: '13원/g' },
      { name: '앞다리살 냉동', vol: '5kg', amt: 55000, vendor: '미트뱅크', per: '11원/g' },
    ],
  },
  {
    name: '두부', reason: 'low', reasonLabel: '안전재고 미달', rec: '2', remain: '미개봉 4', recent: '○○청과 11,000원 (6/03)',
    options: [
      { name: '두부', vol: '10모', amt: 11000, vendor: '○○청과', per: '1,100원/모' },
      { name: '두부', vol: '1모', amt: 1200, vendor: '쿠팡', per: '1,200원/모' },
    ],
  },
];

export const WAITING: Waiting[] = [
  { name: '대파', vendor: '○○청과', qty: '2', amt: 8000, due: '내일 (06-06)', late: false },
  { name: '양파', vendor: '대림유통', qty: '3', amt: 7560, due: '오늘 (06-05)', late: false },
  { name: '식용유', vendor: '대림유통', brand: '해표', qty: '1', amt: 45000, due: '지연 (06-03)', late: true },
];

export const DONE: Done[] = [
  { name: '돼지고기 앞다리', vendor: '대성축산', qty: '1', amt: 65000, date: '06-04' },
  { name: '계란', vendor: '대성축산', qty: '3', amt: 19800, date: '06-02' },
];
