import { type ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { COLOR, COMPONENT, TYPE, T, minTouchTarget, rowMinHeight, space, tnum } from '@/theme/tokens';
import { Card } from './Card';

/** 읽기 전용 상세 화면이 함께 쓰는 제목·값·비율 카드. */
export function DetailSummaryCard({ title, count, children, style }: {
  title: string; count?: number; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return <Card pad={0} style={[{ overflow: 'hidden' }, style]}>
    <View style={{ minHeight: minTouchTarget, paddingHorizontal: COMPONENT.card.contentInset, paddingVertical: space.md,
      backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
      <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{title}</Text>
      {count !== undefined ? <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary }}>{count}개</Text> : null}
    </View>
    {children}
  </Card>;
}

export function DetailSummaryRow({ label, description, value, rate, last = false, secondary = false }: {
  label: string; description?: string; value: string; rate?: string; last?: boolean; secondary?: boolean;
}) {
  return <View style={{ minHeight: rowMinHeight.oneLine, paddingHorizontal: COMPONENT.card.contentInset, paddingVertical: space.md,
    flexDirection: 'row', alignItems: 'center', gap: space.sm, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 }}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ ...TYPE.body, color: secondary ? COLOR.text.tertiary : COLOR.text.primary }}>{label}</Text>
      {description ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, marginTop: space.xs }}>{description}</Text> : null}
    </View>
    <View style={{ alignItems: 'flex-end', maxWidth: '58%', flexShrink: 1 }}>
      <Text style={{ ...TYPE.body, ...tnum, color: secondary ? COLOR.text.tertiary : COLOR.text.primary, textAlign: 'right' }}>{value}</Text>
      {rate ? <Text style={{ ...TYPE.captionSm, ...tnum, color: COLOR.text.tertiary, marginTop: space.xs, textAlign: 'right' }}>{rate}</Text> : null}
    </View>
  </View>;
}
