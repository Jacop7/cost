/**
 * 판매 채널 이름표 — 한 곳에서만 만든다(0093).
 *
 * 기본 세 채널의 레거시 호환 이름표다. 사용자 추가 채널은 서버가 반환한 UUID·이름
 * 스냅샷을 그대로 사용하며 이 표로 추정하지 않는다.
 */
import type { ChannelCode } from './hooks';

/** 구형 화면의 기본 채널 버튼 순서. */
export const CHANNEL_LABEL: [ChannelCode, string][] = [
  ['hall', '매장'],
  ['delivery', '배달'],
  ['takeout', '포장'],
];

/**
 * 채널 코드 → 이름. **없으면 '채널 미지정'** 이다.
 *
 * ⚠ 미지정을 '매장'으로 적으면 안 된다. 채널을 묻기 전에 적은 줄이라
 *   모르는 것이지 매장인 게 아니다 — 추정해서 채우면 채널 손익이 거짓말이 된다.
 */
export const channelName = (c?: ChannelCode | null) =>
  CHANNEL_LABEL.find(([k]) => k === c)?.[1] ?? '채널 미지정';
