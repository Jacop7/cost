import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/kit';
import { COLOR, T, TYPE, minTouchTarget, rowMinHeight, space, tnum } from '@/theme/tokens';
export function RecipeDetailHeading({ title, sub }: { title: string; sub?: string }) {
  return <View style={{ minHeight: minTouchTarget, paddingHorizontal: space.lg, paddingVertical: space.md,
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.sm,
    backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
    <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{title}</Text>
    {sub ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary }}>{sub}</Text> : null}
  </View>;
}

export function RecipeDetailRow({ label, sub, value, secondary, color = COLOR.text.primary, onPress, accessibilityLabel, last = false }: {
  label: ReactNode; sub?: ReactNode; value: ReactNode; secondary?: ReactNode; color?: string;
  onPress?: () => void; accessibilityLabel?: string; last?: boolean;
}) {
  const content = <>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{label}</Text>
      {sub ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, marginTop: space.xs }}>{sub}</Text> : null}
    </View>
    <View style={{ alignItems: 'flex-end', maxWidth: '52%', flexShrink: 1 }}>
      <Text style={[{ ...TYPE.body, color, textAlign: 'right' }, tnum]}>{value}</Text>
      {secondary ? <Text style={[{ ...TYPE.captionSm, marginTop: space.xs, color: color === COLOR.text.primary ? COLOR.text.tertiary : color, textAlign: 'right' }, tnum]}>{secondary}</Text> : null}
    </View>
    {onPress ? <Icon name="chevron" size={16} color={COLOR.text.tertiary} /> : null}
  </>;
  const style = { minHeight: rowMinHeight.oneLine, paddingVertical: space.md, paddingHorizontal: space.lg, gap: space.sm,
    flexDirection: 'row' as const, alignItems: 'center' as const,
    borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 };
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={style}>{content}</Pressable>
    : <View style={style}>{content}</View>;
}

export function RecipeDetailSubtotal({ label = '소계', sub, value, secondary }: { label?: string; sub?: string; value: string; secondary: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.lg, borderTopWidth: 1, borderTopColor: T.line2 }}>
    <View style={{ flex: 1 }}>
      <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{label}</Text>
      {sub ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary }}>{sub}</Text> : null}
    </View>
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={[{ ...TYPE.body, color: COLOR.text.primary }, tnum]}>{value}</Text>
      <Text style={[{ ...TYPE.captionSm, color: COLOR.text.tertiary }, tnum]}>{secondary}</Text>
    </View>
  </View>;
}

export function RecipeDetailFooter({ children, onPress, accessibilityLabel }: { children: string; onPress: () => void; accessibilityLabel?: string }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? children}
    style={{ minHeight: minTouchTarget, paddingVertical: space.md, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
      backgroundColor: T.surface2, borderTopWidth: 1, borderTopColor: T.line2 }}>
    <Text style={{ ...TYPE.caption, fontWeight: '700', color: COLOR.text.secondary }}>{children}</Text>
    <Icon name="chevron" size={16} color={COLOR.text.tertiary} />
  </Pressable>;
}
