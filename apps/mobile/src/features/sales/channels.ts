/**
 * 판매 채널 이름표 — 한 곳에서만 만든다(0093).
 *
 * ⚠ 채널은 매장·배달앱·포장 **3개 고정**이다(0043). 네 번째를 만들어도
 *   `daily_sales_items` 가 세 컬럼이라 수량을 넣을 곳이 없다.
 */
import type { ChannelCode } from './hooks';

/** 시트의 채널 버튼 순서. 서버 `sales_channels.sort_order` 와 같다. */
export const CHANNEL_LABEL: [ChannelCode, string][] = [
  ['hall', '매장'],
  ['delivery', '배달'],
  ['takeout', '포장'],
];

/**
 * 채널 코드 → 이름. **없으면 '미지정'** 이다.
 *
 * ⚠ 미지정을 '매장'으로 적으면 안 된다. 채널을 묻기 전에 적은 줄이라
 *   모르는 것이지 매장인 게 아니다 — 추정해서 채우면 채널 손익이 거짓말이 된다.
 */
export const channelName = (c?: ChannelCode | null) =>
  CHANNEL_LABEL.find(([k]) => k === c)?.[1] ?? '미지정';
