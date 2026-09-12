import { Text, type TextProps } from 'react-native';
import { COLOR, COMPONENT, TYPE } from '@/theme/tokens';

/** 빈 데이터 문구의 공통 표시. 호출부는 문구와 배치만 소유한다. */
export function EmptyDataText({ variant = 'body', style, ...props }: TextProps & { variant?: 'body' | 'title' }) {
  const typography = variant === 'title'
    ? { ...TYPE.body, fontSize: COMPONENT.emptyState.titleFontSize, color: COLOR.text.primary }
    : { ...TYPE.caption, fontSize: COMPONENT.emptyState.bodyFontSize, color: COLOR.text.tertiary };
  return <Text {...props} style={[style, typography]} />;
}
