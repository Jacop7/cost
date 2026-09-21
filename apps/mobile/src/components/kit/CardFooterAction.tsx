import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { COLOR, COMPONENT, T, TYPE, space } from '@/theme/tokens';
import { Icon } from './Icon';

export function CardFooterAction({ children, onPress, accessibilityLabel, tone = 'neutral', icon = 'chevron', disabled = false }: {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  tone?: 'neutral' | 'accent';
  icon?: 'chevron' | 'plus';
  disabled?: boolean;
}) {
  const accent = tone === 'accent';
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
    accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }}
    style={{ minHeight: COMPONENT.cardFooter.minHeight, borderRadius: 0, paddingVertical: space.md, paddingHorizontal: space.lg,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
      backgroundColor: accent ? COLOR.action.primaryTint : T.surface2,
      borderTopWidth: 1, borderTopColor: accent ? COMPONENT.notice.border : T.line2,
      opacity: disabled ? 0.35 : 1 }}>
    {icon === 'plus' ? <Icon name="plus" size={16} color={accent ? COLOR.text.link : COLOR.text.tertiary} /> : null}
    <Text style={{ ...TYPE.caption, fontSize: COMPONENT.cardFooter.fontSize, fontWeight: '700', color: accent ? COLOR.text.link : COLOR.text.secondary }}>{children}</Text>
    {icon === 'chevron' ? <Icon name="chevron" size={16} color={accent ? COLOR.text.link : COLOR.text.tertiary} /> : null}
  </Pressable>;
}
