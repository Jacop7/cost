/**
 * 디자인 토큰 — ver.2 프로토타입 kit.jsx 의 T·STATUS 를 RN으로 이식(확정 원천).
 * Toss/Cashnote 스타일: primary=블루, 긍정=초록, 주의=앰버, 위험=레드, 비용=그레이.
 */

import { formatNumber, getLocale } from '@sikjae/core';

export const T = {
  // surfaces
  bg: '#F2F4F6',
  surface: '#FFFFFF',
  surface2: '#F9FAFB',
  // brand
  blue: '#3182F6',
  bluePressed: '#2272EB',
  blueTint: '#EBF3FE',
  blueLine: 'rgba(49,130,246,0.2)', // 파랑 강조 구분선(편집·구매옵션·발주완료)
  // 컬러 배경 위 글자·아이콘(반전) — 흰 surface와 의미 분리
  onColor: '#FFFFFF',
  // 모달·시트 딤 배경(스크림)
  scrim: 'rgba(0,0,0,0.42)',
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
  amberTint: '#FFF4E5',
  red: '#F04452',
  redTint: '#FEECEC',
  // 부족 상태 텍스트는 가독성 위해 진한 주황 사용(프로토타입 동일)
  amberText: '#E07A00',
  // 인라인 통합 — 반복 사용되던 색을 토큰화
  line3: '#D1D6DB', // 밑줄형 탭/헤더 하단 구분선 · chevron 아이콘 (grey300)
  gray400: '#B0B8C1', // Toss grey400 — 차트(세금) 등 옅은 회색 단계
} as const;

/** 폰트 — 프로토타입은 Pretendard. RN에서는 expo-font 로 번들 후 fontFamily 지정. */
export const FONT = {
  family: 'Pretendard',
  // RN tabular-nums: style={{ fontVariant: NUM }}
  num: ['tabular-nums'] as const,
};

/**
 * 타입 스케일 — 크기 6단계(22·20·18·16·14·13) · 굵기 3단계(800·700·600)로 일원화.
 * 신규 UI는 인라인 fontSize/fontWeight 대신 이 토큰 사용(기존 화면은 점진 치환).
 */
export const TYPE = {
  display: { fontSize: 22, fontWeight: '800' }, // 큰 숫자·금액 강조
  title: { fontSize: 20, fontWeight: '800' }, // 화면·시트 제목, 항목명
  header: { fontSize: 18, fontWeight: '700' }, // 앱 헤더·섹션 헤더
  body: { fontSize: 16, fontWeight: '700' }, // 본문 기본(행 제목·값)
  bodyWeak: { fontSize: 16, fontWeight: '600' }, // 본문 보조
  caption: { fontSize: 14, fontWeight: '600' }, // 라벨·캡션
  captionSm: { fontSize: 13, fontWeight: '600' }, // 칩·탭 라벨
} as const;

/** legacy kit 상태 키 — core `StockState`와 의미가 아직 다르며 재고 판정에 쓰지 않는다(P2-3). */
export type StatusKey = 'ok' | 'low' | 'out';

/** 숫자 정렬용 tabular-nums 스타일 (kit tnum). */
export const tnum = { fontVariant: ['tabular-nums'] } as { fontVariant: ('tabular-nums')[] };

/**
 * kit의 옛 범용 상태색. core 재고 계약(여유/소진 임박/소진)의 단일 판정처가 아니며,
 * 키·라벨 통합은 작업큐 P2-3에서 수행한다.
 */
export const STATUS: Record<
  StatusKey,
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

/**
 * 금액 표기 (kit won) — 통화기호 없이 숫자만. 호출부가 뒤에 '원'을 붙인다.
 *
 * 서식 규칙은 `@sikjae/core` locale.ts 단일 출처를 쓴다. `toLocaleString('ko-KR')` 은
 * Hermes 의 Intl 구현에 의존해 기기마다 결과가 달라질 수 있는데, 금액은 기기와 무관해야 한다.
 *
 * ⚠ 지금은 **'ko' 고정**이다. 언어·통화 설정(MY-08)의 선택값을 여기 연결하면 앱 전체 금액 표기가
 *   바뀌지만, 실제 언어 전환은 아직 활성화하지 않기로 했으므로 연결하지 않는다.
 *   연결 시점에는 화면 재렌더 경로(스토어 구독)도 함께 설계해야 한다 — 모듈 값만 바꾸면 이미 그려진
 *   화면이 갱신되지 않는다.
 */
export const won = (n: number): string => {
  const L = getLocale('ko');
  return formatNumber(n, { digits: L.moneyDigits, group: L.group, decimal: L.decimal });
};
