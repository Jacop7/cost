import { type ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { COMPONENT, T, shadow as SHADOW } from '@/theme/tokens';

export function Card({ children, style, pad = COMPONENT.card.contentInset, onLine, shadow = true }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; pad?: number; onLine?: boolean; shadow?: boolean;
}) {
  return <View style={[{ backgroundColor: T.surface, borderRadius: 16, padding: pad,
    borderWidth: onLine ? 1 : 0, borderColor: T.line }, shadow ? SHADOW.card : null, style]}>{children}</View>;
}
