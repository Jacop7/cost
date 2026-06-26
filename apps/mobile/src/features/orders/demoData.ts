/**
 * 발주(ORD) 데모 데이터 — 프로토타입(발주 현황 페이지 정리본) 이식. ⚠ 임시(Supabase 연동 전).
 */
export interface OrderOption {
  name: string; // 상품명
  vendor: string;
  brand: string;
  amt: number; // 금액(원)
  vol: number; // 용량(g/ml, 1개 기준)
  per: number; // 환산 단가(원/g)
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
  due: string; // 도착 예정/지연
  late: boolean;
}

export interface Done {
  name: string;
  due: string; // 입고 완료 (날짜)
  buy: string; // 구매 내역 한 줄
  per: string; // 입고 단가
}

// 대파 구매 옵션·링크 (주문하기 / 발주완료 시트 공용)
export const OPTIONS: OrderOption[] = [
  { name: '대파(흙대파) 1kg', vendor: '○○청과몰', brand: '-', amt: 4000, vol: 1000, per: 4.0, badge: null },
  { name: '깐대파 1kg', vendor: '쿠팡', brand: '곰곰', amt: 5200, vol: 1000, per: 5.2, badge: 'high' },
  { name: '대파 2kg 박스', vendor: '□□상회', brand: '-', amt: 7600, vol: 2000, per: 3.8, badge: 'low' },
];

export const CANDIDATES: Candidate[] = [
  { name: '양파', reason: 'low', reasonLabel: '안전재고 미달', remain: '1.2kg (안전 3kg)', rec: 3.6, recUnit: 'kg', recent: '대림유통, 양파 1.2kg, 2개 5,040원 (5/31)' },
  { name: '다진마늘', reason: 'out', reasonLabel: '곧 소진', remain: '200g (안전 1kg)', rec: 1000, recUnit: 'g', recent: '□□상회, 다진마늘 1kg, 1개 8,500원 (5/27)' },
  { name: '돼지고기 앞다리', reason: 'out', reasonLabel: '곧 소진', remain: '2kg (안전 5kg)', rec: 5, recUnit: 'kg', recent: '대성축산, 돼지고기 앞다리 5kg, 1개 65,000원 (6/04)' },
  { name: '두부', reason: 'low', reasonLabel: '안전재고 미달', remain: '4개 (안전 6개)', rec: 2, recUnit: '개', recent: '○○청과, 두부 10개, 1개 11,000원 (6/03)' },
  { name: '식용유', reason: 'low', reasonLabel: '안전재고 미달', remain: '3L (안전 18L)', rec: 18, recUnit: 'L', recent: '쿠팡, 식용유 18L, 1개 45,000원 (5/20)' },
];

export const WAITING: Waiting[] = [
  { name: '대파', buy: '○○청과, 대파 1개, 2개 8,000원', due: '2일 후 도착 (06/08)', late: false },
  { name: '계란', buy: '대성축산, 계란 30개, 3개 19,800원', due: '내일 도착 (06/07)', late: false },
  { name: '두부', buy: '○○청과, 두부 10개, 2개 22,000원', due: '오늘 도착 (06/06)', late: false },
  { name: '식용유', buy: '대림유통, 식용유 18L, 1개 45,000원', due: '1일 지연 (06/05)', late: true },
];

export const DONE: Done[] = [
  { name: '돼지고기 앞다리', due: '입고 완료 (06/04)', buy: '대성축산, 돼지고기 앞다리 5kg, 1개 65,000원', per: '13.0원/g' },
  { name: '청양고추', due: '입고 완료 (06/01)', buy: '대림유통, 청양고추 500g, 1개 4,900원', per: '9.8원/g' },
  { name: '두부', due: '입고 완료 (06/03)', buy: '○○청과, 두부 10개, 2개 22,000원', per: '1,100원/개' },
  { name: '대파', due: '입고 완료 (05/28)', buy: '대림유통, 대파 1개, 3개 10,800원', per: '3.6원/g' },
];
