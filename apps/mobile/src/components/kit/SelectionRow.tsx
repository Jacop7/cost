import { Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';
import { COLOR, T, rowMinHeight, space } from '@/theme/tokens';

/** 정렬·카테고리·단위 시트가 공유하는 한 줄 선택 항목. */
export function SelectionRow({ label, selected, onPress, last = false, accessibilityLabel }: {
  label: string;
  selected: boolean;
  onPress: () => void;
  last?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityLabel={accessibilityLabel} accessibilityState={{ selected }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm,
        minHeight: rowMinHeight.oneLine, paddingVertical: space.md,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 16, fontWeight: selected ? '800' : '600',
          color: selected ? COLOR.state.selectedText : T.ink }}>{label}</Text>
      </View>
      {selected ? <Icon name="check" size={20} color={COLOR.action.primary} sw={2.4} /> : null}
    </Pressable>
  );
}
