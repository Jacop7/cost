import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { COLOR, COMPONENT, T, TYPE, minTouchTarget, space } from '@/theme/tokens';
import { Icon } from './Icon';

export function CardFooterAction({ children, onPress, accessibilityLabel, tone = 'neutral', icon = 'chevron' }: {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  tone?: 'neutral' | 'accent';
  icon?: 'chevron' | 'plus';
}) {
  const accent = tone === 'accent';
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
    style={{ minHeight: minTouchTarget, borderRadius: 0, paddingVertical: space.md, paddingHorizontal: space.lg,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
      backgroundColor: accent ? COLOR.action.primaryTint : T.surface2,
      borderTopWidth: 1, borderTopColor: accent ? COMPONENT.notice.border : T.line2 }}>
    {icon === 'plus' ? <Icon name="plus" size={16} color={accent ? COLOR.text.link : COLOR.text.tertiary} /> : null}
    <Text style={{ ...TYPE.caption, fontSize: COMPONENT.cardFooter.fontSize, fontWeight: '700', color: accent ? COLOR.text.link : COLOR.text.secondary }}>{children}</Text>
    {icon === 'chevron' ? <Icon name="chevron" size={16} color={accent ? COLOR.text.link : COLOR.text.tertiary} /> : null}
  </Pressable>;
}
