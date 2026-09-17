import { Text, View } from 'react-native';
import { COLOR, T, TYPE, radius, space } from '@/theme/tokens';

/** Read-only record identity in confirmation dialogs: labels left, values right. */
export function RecordSummary({ rows }: { rows: { label: string; value: string }[] }) {
  return <View style={{ padding: space.md, gap: space.md, borderRadius: radius.md, backgroundColor: T.surface2 }}>
    {rows.map(row => <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Text style={{ ...TYPE.captionSm, flex: 1, color: COLOR.text.tertiary }}>{row.label}</Text>
      <Text style={{ ...TYPE.body, flex: 2, fontWeight: '700', textAlign: 'right', color: COLOR.text.primary }}>{row.value}</Text>
    </View>)}
  </View>;
}
