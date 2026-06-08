/**
 * 디자인 토큰 — ver.2 프로토타입 kit.jsx 의 T·STATUS 를 RN으로 이식(확정 원천).
 * Toss/Cashnote 스타일: primary=블루, 순이익·충분=초록, 부족=앰버, 소진임박=레드, 비용=그레이.
 */

export const T = {
  // surfaces
  bg: '#F2F4F6',
  surface: '#FFFFFF',
  surface2: '#F9FAFB',
  // brand
  blue: '#3182F6',
  bluePressed: '#2272EB',
  blueTint: '#EBF3FE',
  blueTint2: '#F4F8FF',
  // text
  ink: '#191F28',
  ink2: '#333D4B',
  sub: '#4E5968',
  sub2: '#6B7684',
  ter: '#8B95A1',
  // lines
  line: '#E5E8EB',
  line2: '#F2F4F6',
  // status
  green: '#15B374',
  greenTint: '#E7F7F0',
  amber: '#FF8A00',
  amberTint: '#FFF4E5',
  red: '#F04452',
  redTint: '#FEECEC',
  // 부족 상태 텍스트는 가독성 위해 진한 주황 사용(프로토타입 동일)
  amberText: '#E07A00',
  // cost gray
  cost: '#8B95A1',
} as const;

/** 폰트 — 프로토타입은 Pretendard. RN에서는 expo-font 로 번들 후 fontFamily 지정. */
export const FONT = {
  family: 'Pretendard',
  // RN tabular-nums: style={{ fontVariant: NUM }}
  num: ['tabular-nums'] as const,
};

/** 재고 상태색 — 2단계: 여유 / 소진 임박. ('부족' 단계 제거, 기존 부족은 여유로 흡수) */
export const STATUS: Record<
  'ok' | 'low' | 'out',
  { label: string; fg: string; bg: string; bar: string }
> = {
  ok: { label: '여유', fg: T.green, bg: T.greenTint, bar: T.green },
  // low(안전재고 미달)는 별도 단계 없이 여유로 표시
  low: { label: '여유', fg: T.green, bg: T.greenTint, bar: T.green },
  out: { label: '소진 임박', fg: T.red, bg: T.redTint, bar: T.red },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 } as const;

/** 카드 그림자 — 프로토타입 boxShadow '0 1px 3px rgba(0,0,0,0.04)' 의 RN 등가. */
export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 3,
  elevation: 1,
} as const;

/** 원화 포맷 (kit won). */
export const won = (n: number): string =>
  (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('ko-KR');
