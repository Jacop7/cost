import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/kit';
import { historyRowStyles } from '@/components/history/historyRowStyles';
import { COLOR, T, space } from '@/theme/tokens';

/** Candidate/direct ordering share the same selectable purchase-link and ingredient rows. */
export function OrderChoiceRow({ title, description, selected, last = false, onPress, label = title }: {
  title: string; description: string; selected: boolean; last?: boolean; label?: string; onPress: () => void;
}) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ selected }} aria-pressed={selected}
    style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56,
      paddingVertical: historyRowStyles.spacing.paddingVertical, paddingHorizontal: historyRowStyles.spacing.paddingHorizontal,
      backgroundColor: T.surface, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 }}>
    <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
      <Text style={historyRowStyles.title}>{title}</Text>
      <Text style={historyRowStyles.description}>{description}</Text>
    </View>
    {selected ? <Icon name="check" size={18} color={COLOR.state.selectedText} /> : null}
  </Pressable>;
}
