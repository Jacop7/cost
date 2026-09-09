import { COLOR, T, TYPE, space } from '@/theme/tokens';

/** 재고·수정 내역의 같은 역할은 같은 여백/타이포 규격을 사용한다. */
export const historyRowStyles = {
  spacing: { paddingVertical: space.md, paddingHorizontal: 15 },
  date: { ...TYPE.captionSm, color: COLOR.text.tertiary, fontWeight: '700' as const },
  title: { ...TYPE.body, color: T.ink, fontWeight: '700' as const },
  description: { fontSize: TYPE.captionSm.fontSize, color: T.sub, fontWeight: '600' as const },
};
