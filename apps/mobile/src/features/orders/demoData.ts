/**
 * 발주(ORD) 데모 데이터 — 프로토타입 data.jsx 발췌. ⚠ 임시(Supabase 연동 전).
 */
export interface Candidate {
  name: string;
  reason: 'out' | 'low' | 'recipe';
  reasonLabel: string;
  rec: string; // 권장 발주 (예: '3망')
  remain: string; // 현재 재고
  recent: string; // 최근 주문
  hint?: string; // 절약 힌트
  calcNote?: string; // 레시피 계산 사유
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
  { name: '양파', reason: 'low', reasonLabel: '안전재고 미달', rec: '3', remain: '미개봉 0 · 개봉 1', recent: '대림유통 2,520원 (5/31)' },
  { name: '다진마늘', reason: 'out', reasonLabel: '곧 소진', rec: '2', remain: '개봉 1 (거의 빔)', recent: '□□상회 8,500원 (5/27)' },
  { name: '돼지고기 앞다리', reason: 'out', reasonLabel: '곧 소진', rec: '1', remain: '미개봉 1 · 개봉 1', recent: '대성축산 65,000원 (6/04)' },
  { name: '두부', reason: 'low', reasonLabel: '안전재고 미달', rec: '2', remain: '미개봉 4', recent: '○○청과 11,000원 (6/03)' },
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
