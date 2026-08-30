import type { ReactNode } from 'react';
import { Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { FONT } from '@/theme/tokens';

const NUM: TextStyle = { fontVariant: FONT.num as unknown as TextStyle['fontVariant'] };

/** 숫자 정렬을 선택적으로 적용하는 공용 텍스트. */
export function Txt({ children, style, num, n }: { children: ReactNode; style?: StyleProp<TextStyle>; num?: boolean; n?: number }) {
  return (
    <Text numberOfLines={n} style={[num ? NUM : null, style]}>
      {children}
    </Text>
  );
}
