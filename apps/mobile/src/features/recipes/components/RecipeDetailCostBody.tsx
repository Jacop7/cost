import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { EmptyDataText, Icon } from '@/components/kit';
import { COLOR, COMPONENT, T, TYPE, minTouchTarget, space } from '@/theme/tokens';
import { RecipeDetailRow, RecipeDetailSubtotal } from './RecipeDetailParts';

export type RecipeCostItem = {
  key: string; label: string; sub?: string; value: string; secondary?: string;
};

/** Shared 0 / 1 / many-item presentation for the four menu cost cards. */
export function RecipeDetailCostBody({ title, items, empty, total, expanded, onToggle, notice }: {
  title: string; items: RecipeCostItem[]; empty: string;
  total: { value: string; secondary?: string };
  expanded: boolean; onToggle: () => void; notice?: ReactNode;
}) {
  if (!items.length) return <EmptyDataText style={{ padding: space.lg }}>{empty}</EmptyDataText>;
  if (items.length === 1) { const { key, ...row } = items[0]!; return <RecipeDetailRow key={key} {...row} last />; }
  return <>
    {expanded ? <>
      {items.map(({ key, ...item }, index) => <RecipeDetailRow {...item} key={key} last={index === items.length - 1} />)}
      {notice}
    </> : null}
    <RecipeDetailSubtotal label={expanded ? '소계' : `${items[0]!.label} 외 ${items.length - 1}개`}
      borderTop={expanded} {...total} />
    <Pressable onPress={onToggle} accessibilityRole="button"
      accessibilityLabel={`${title} ${expanded ? '접기' : '펼치기'}`} accessibilityState={{ expanded }} aria-expanded={expanded}
      style={{ minWidth: minTouchTarget, minHeight: minTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
        paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: T.line2 }}>
      <Text style={{ ...TYPE.caption, fontSize: COMPONENT.cardFooter.fontSize, fontWeight: '700', color: COLOR.text.secondary }}>{expanded ? '접기' : '펼치기'}</Text>
      <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}><Icon name="chevronDown" size={16} color={COLOR.text.tertiary} /></View>
    </Pressable>
  </>;
}
