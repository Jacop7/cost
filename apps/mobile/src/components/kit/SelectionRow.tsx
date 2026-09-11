import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { Icon } from './Icon';
import { COLOR, T, TYPE, rowMinHeight, space } from '@/theme/tokens';

/** 정렬·카테고리·단위 시트가 공유하는 한 줄 선택 항목. */
export function SelectionRow({ label, selected, onPress, last = false, accessibilityLabel, description, labelStyle }: {
  label: string;
  selected: boolean;
  onPress: () => void;
  last?: boolean;
  accessibilityLabel?: string;
  description?: string;
  labelStyle?: TextStyle;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityLabel={accessibilityLabel} accessibilityState={{ selected }} aria-pressed={selected}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm,
        minHeight: rowMinHeight.oneLine, paddingVertical: space.md,
        // Fractional Android density can round adjacent text-backed hosts into
        // the same physical pixel. Keep one physical pixel between their targets.
        marginBottom: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[{ fontSize: 16, fontWeight: selected ? '800' : '600',
          color: selected ? COLOR.state.selectedText : T.ink }, labelStyle]}>{label}</Text>
        {description ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, marginTop: space.xs }}>{description}</Text> : null}
      </View>
      {selected ? <Icon name="check" size={20} color={COLOR.action.primary} sw={2.4} /> : null}
    </Pressable>
  );
}
