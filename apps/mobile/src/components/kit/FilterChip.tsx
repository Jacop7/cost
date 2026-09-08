import { Pressable, Text } from 'react-native';
import { COLOR, COMPONENT, T } from '@/theme/tokens';
import { Icon } from './Icon';

/** 정렬/필터가 같은 렌더 경로를 사용한다. 이름·힌트만 호출 맥락에 따라 다르다. */
export function FilterChip({ label, onPress, accessibilityLabel, accessibilityHint }: {
  label: string; onPress: () => void; accessibilityLabel: string; accessibilityHint?: string;
}) {
  const token = COMPONENT.filterChip;
  return <Pressable onPress={onPress} accessibilityRole="button"
    accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}
    hitSlop={{ top: token.hitSlop, bottom: token.hitSlop }}
    style={{ alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center',
      minHeight: token.minHeight, gap: token.gap, paddingVertical: token.paddingVertical,
      paddingHorizontal: token.paddingHorizontal, borderRadius: token.borderRadius,
      borderWidth: 1, borderColor: T.line, backgroundColor: T.surface }}>
    <Text style={{ ...token.label, flexShrink: 1, color: T.sub }}>{label}</Text>
    <Icon name="chevronDown" size={token.iconSize} color={COLOR.text.tertiary} />
  </Pressable>;
}

export function FilterButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <FilterChip label={label} onPress={onPress} accessibilityLabel={`${label} 변경`} />;
}
