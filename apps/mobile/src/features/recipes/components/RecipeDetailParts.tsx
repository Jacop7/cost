import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/kit';
import { COLOR, COMPONENT, T, TYPE, minTouchTarget, rowMinHeight, space, tnum } from '@/theme/tokens';
export function RecipeDetailHeading({ title, sub }: { title: string; sub?: string }) {
  return <View style={{ minHeight: minTouchTarget, paddingHorizontal: space.lg, paddingVertical: space.md,
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.sm,
    backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
    <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{title}</Text>
    {sub ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary }}>{sub}</Text> : null}
  </View>;
}

export function RecipeDetailRow({ label, sub, value, secondary, color = COLOR.text.primary, secondaryColor, inset = false, onPress, accessibilityLabel, last = false }: {
  label: ReactNode; sub?: ReactNode; value: ReactNode; secondary?: ReactNode; color?: string;
  onPress?: () => void; accessibilityLabel?: string; last?: boolean; inset?: boolean; secondaryColor?: string;
}) {
  const content = <>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{label}</Text>
      {sub ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, marginTop: space.xs }}>{sub}</Text> : null}
    </View>
    <View style={{ alignItems: 'flex-end', maxWidth: '52%', flexShrink: 1 }}>
      <Text style={[{ ...TYPE.body, color, textAlign: 'right' }, tnum]}>{value}</Text>
      {secondary ? <Text style={[{ ...TYPE.captionSm, marginTop: space.xs, color: secondaryColor ?? (color === COLOR.text.primary ? COLOR.text.tertiary : color), textAlign: 'right' }, tnum]}>{secondary}</Text> : null}
    </View>
    {onPress ? <Icon name="chevron" size={16} color={COLOR.text.tertiary} /> : null}
  </>;
  const style = { minHeight: rowMinHeight.oneLine, paddingVertical: space.md, paddingHorizontal: inset ? 0 : space.lg, marginHorizontal: inset ? space.lg : 0, gap: space.sm,
    flexDirection: 'row' as const, alignItems: 'center' as const,
    borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 };
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={style}>{content}</Pressable>
    : <View style={style}>{content}</View>;
}

export function RecipeDetailSubtotal({ label = '소계', sub, value, secondary, borderTop = true }: { label?: string; sub?: string; value: string; secondary?: string; borderTop?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.lg, borderTopWidth: borderTop ? 1 : 0, borderTopColor: T.line2 }}>
    <View style={{ flex: 1 }}>
      <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{label}</Text>
      {sub ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary }}>{sub}</Text> : null}
    </View>
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={[{ ...TYPE.body, color: COLOR.text.primary }, tnum]}>{value}</Text>
      {secondary ? <Text style={[{ ...TYPE.captionSm, color: COLOR.text.tertiary }, tnum]}>{secondary}</Text> : null}
    </View>
  </View>;
}

export function RecipeDetailFooter({ children, onPress, accessibilityLabel, tone = 'neutral', icon = 'chevron' }: { children: string; onPress: () => void; accessibilityLabel?: string; tone?: 'neutral' | 'accent'; icon?: 'chevron' | 'plus' }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? children}
    style={{ minHeight: minTouchTarget, borderRadius: 0, paddingVertical: space.md, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
      backgroundColor: tone === 'accent' ? COLOR.action.primaryTint : T.surface2,
      borderTopWidth: 1, borderTopColor: tone === 'accent' ? COMPONENT.notice.border : T.line2 }}>
    {icon === 'plus' ? <Icon name="plus" size={16} color={tone === 'accent' ? COLOR.text.link : COLOR.text.tertiary} /> : null}
    <Text style={{ ...TYPE.caption, fontSize: COMPONENT.cardFooter.fontSize, fontWeight: '700', color: tone === 'accent' ? COLOR.text.link : COLOR.text.secondary }}>{children}</Text>
    {icon === 'chevron' ? <Icon name="chevron" size={16} color={tone === 'accent' ? COLOR.text.link : COLOR.text.tertiary} /> : null}
  </Pressable>;
}
