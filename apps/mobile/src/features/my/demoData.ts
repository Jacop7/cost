/**
 * 마이페이지 데모 데이터 — 프로토타입(screens_my) data.jsx 이식.
 * 설정 기준값(카테고리·구매처·알림). ⚠ 임시 데모. 실데이터는 Supabase 사용자 설정으로 교체.
 * 월 손익 수치는 두지 않는다 — 매출관리(features/sales)의 캘린더 집계가 단일 출처.
 */
export const MY_CATEGORIES = ['축산·계란', '수산·해조류', '농산(신선)', '곡물·견과·분말', '유제품', '냉동식품', '소스·유지류·장류', '향신료·허브', '음료·주류', '상온가공·건식', '두부·발효식품', '베이커리'];
export const MY_CAT_LOSS: Record<string, number> = { '농산(신선)': 12, '축산·계란': 0, '소스·유지류·장류': 0, '수산·해조류': 40 };

export interface Vendor { name: string; count: number; dup?: boolean; }
export const MY_VENDORS: Vendor[] = [
  { name: '○○청과', count: 24 },
  { name: '대림유통', count: 31 },
  { name: '□□상회', count: 18 },
  { name: '대성축산', count: 12 },
  { name: '대림 유통', count: 2, dup: true },
];

export interface Notif { name: string; desc: string; on: boolean; }
export const MY_NOTIFICATIONS: Notif[] = [
  { name: '아침 발주 요약', desc: '곧 소진·안전재고 미달 후보를 08:00에 묶어서', on: true },
  { name: '입고 지연', desc: '발주됨 건의 예정일이 지났을 때', on: true },
  { name: '단가 급등', desc: '입고 단가가 평균 대비 ±15% 이상일 때', on: true },
  { name: '목표 미달 전환', desc: '순이익률이 목표 아래로 처음 떨어질 때', on: false },
];
