import { Pressable, Text } from 'react-native';
import { COLOR, COMPONENT, T } from '@/theme/tokens';
import { Icon } from './Icon';

/** 정렬/필터가 같은 렌더 경로를 사용한다. 이름·힌트만 호출 맥락에 따라 다르다. */
export function FilterChip({ label, onPress, accessibilityLabel, accessibilityHint, selected, paddingHorizontal }: {
  label: string; onPress: () => void; accessibilityLabel: string; accessibilityHint?: string;
  selected?: boolean; paddingHorizontal?: number;
}) {
  const token = COMPONENT.filterChip;
  const isTab = selected !== undefined;
  return <Pressable onPress={onPress} accessibilityRole={isTab ? 'tab' : 'button'}
    accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}
    accessibilityState={isTab ? { selected } : undefined} aria-selected={isTab ? selected : undefined}
    hitSlop={{ top: token.hitSlop, bottom: token.hitSlop }}
    style={{ alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center',
      height: token.minHeight, gap: token.gap, paddingVertical: token.paddingVertical,
      paddingHorizontal: paddingHorizontal ?? token.paddingHorizontal, borderRadius: token.borderRadius,
      borderWidth: 1, borderColor: selected ? T.ink : T.line,
      backgroundColor: selected ? T.ink : T.surface }}>
    <Text style={{ ...token.label, flexShrink: 1, fontWeight: selected ? '800' : token.label.fontWeight,
      color: selected ? T.onColor : isTab ? T.ink : T.sub }}>{label}</Text>
    {!isTab ? <Icon name="chevronDown" size={token.iconSize} color={COLOR.text.tertiary} /> : null}
  </Pressable>;
}

export function FilterButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <FilterChip label={label} onPress={onPress} accessibilityLabel={`${label} 변경`} />;
}
