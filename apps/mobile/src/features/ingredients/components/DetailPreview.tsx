import type { ReactNode } from 'react';
import { Icon } from '@/components/kit/Icon';
import { Pressable, Text, View, type TextStyle } from 'react-native';
import { COMPONENT, T, TYPE, rowMinHeight, space, tnum } from '@/theme/tokens';

/** 식재료 상세의 구매 링크·입고·재고 미리보기 공통 짜임. 값 계산은 호출부 소유. */
export function DetailSectionHeader({ children, plain = false }: { children: ReactNode; plain?: boolean }) {
  return <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md,
    backgroundColor: plain ? T.surface : T.surface2, borderBottomWidth: plain ? 0 : 1, borderBottomColor: T.line2 }}>
    <Text style={{ ...TYPE.body, fontWeight: '800', color: T.ink }}>{children}</Text>
  </View>;
}

export function DetailPreviewRow({ title, sub, value, detail, color = T.ink, detailColor = T.sub2,
  last = false, onPress, accessibilityLabel, detailStyle, subAfter, titleBefore, subBefore,
  purchaseEmphasis = false, detailAfter, showChevron = false }: {
  title: string; sub?: string; value: string; detail?: string; color?: string; detailColor?: string;
  last?: boolean; onPress?: () => void; accessibilityLabel?: string;
  detailStyle?: TextStyle;
  subAfter?: ReactNode;
  titleBefore?: ReactNode;
  subBefore?: ReactNode;
  purchaseEmphasis?: boolean;
  detailAfter?: string;
  showChevron?: boolean;
}) {
  const content = <>
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs }}>
        {titleBefore}
        <Text style={purchaseEmphasis ? { ...TYPE.captionSm, color: T.sub2 } : { ...TYPE.body, fontWeight: '700', color: T.ink }}>{title}</Text>
      </View>
      {sub ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, marginTop: 3 }}>
        {subBefore}
        <Text style={purchaseEmphasis ? { ...TYPE.body, fontWeight: '700', color: T.ink } : { ...TYPE.captionSm, color: T.sub2 }}>{sub}</Text>
      </View> : null}
      {subAfter}
    </View>
    <View style={{ marginLeft: 'auto', flexShrink: 1, maxWidth: '65%', alignItems: 'flex-end' }}>
      <Text style={[purchaseEmphasis ? { ...TYPE.captionSm, color: T.sub2, textAlign: 'right' } : { ...TYPE.body, fontWeight: '700', color, textAlign: 'right' }, tnum]}>{value}</Text>
      {detail ? <Text style={[purchaseEmphasis ? { ...TYPE.body, fontWeight: '700', color: T.ink, marginTop: 3, textAlign: 'right' } : { ...TYPE.captionSm, color: detailColor, marginTop: 3, textAlign: 'right' }, tnum, detailStyle]}>{detail}</Text> : null}
      {detailAfter ? <Text style={[{ ...TYPE.captionSm, color: T.sub2, textAlign: 'right', marginTop: 3 }, tnum]}>{detailAfter}</Text> : null}
    </View>
    {showChevron ? <Icon name="chevron" size={16} color={T.line3} /> : null}
  </>;
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const,
    gap: COMPONENT.ingredientDetail.rowGap, minHeight: rowMinHeight.oneLine,
    paddingVertical: space.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 };
  return onPress ? <Pressable style={style} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>{content}</Pressable>
    : <View style={style}>{content}</View>;
}

export function DetailMore({ onPress, label = '자세히보기', accessibilityLabel }: {
  onPress: () => void; label?: string; accessibilityLabel: string;
}) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
    style={{ minHeight: COMPONENT.ingredientDetail.moreMinHeight, paddingVertical: space.md,
      flexDirection: 'row', gap: space.xs, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1,
      borderTopColor: T.line2, backgroundColor: T.surface2 }}>
    <Text style={{ ...TYPE.caption, fontWeight: '700', color: T.sub }}>{label}</Text>
    <Icon name="chevron" size={16} color={T.sub} />
  </Pressable>;
}
