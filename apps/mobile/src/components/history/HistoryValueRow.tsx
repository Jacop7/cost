import { Text, View } from 'react-native';
import { COLOR, T, TYPE, radius, space } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** Presentation only: callers own units, rounding and missing-value semantics. */
export function HistoryValueRow({ label, before, after, first = false, testID, boxed = false, stacked = false }: {
  boxed?: boolean;
  stacked?: boolean;
  label: string;
  before: string;
  after: string;
  first?: boolean;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[{
      flexDirection: stacked ? 'column' : 'row', flexWrap: 'wrap', alignItems: stacked ? 'stretch' : 'center', gap: space.sm,
      paddingVertical: space.md, paddingHorizontal: space.md, borderTopWidth: first ? 0 : 1, borderTopColor: T.line2,
    }, boxed && { minHeight: 56, borderWidth: 1, borderTopWidth: 1, borderColor: T.line, borderTopColor: T.line, borderRadius: radius.md }]}>
      <Text style={{ flexGrow: boxed && !stacked ? 1 : 0, minWidth: stacked ? 0 : 84, maxWidth: '100%', fontSize: TYPE.caption.fontSize, fontWeight: '700', color: T.sub }}>{label}</Text>
      {stacked ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
        <Text style={[{ maxWidth: '100%', fontSize: TYPE.caption.fontSize, color: COLOR.text.primary }, NUM]}>{before}</Text>
        <Text style={{ fontSize: TYPE.caption.fontSize, color: COLOR.text.tertiary }}>→</Text>
        <Text style={[{ flexShrink: 1, maxWidth: '100%', fontSize: TYPE.caption.fontSize, fontWeight: '800', color: COLOR.text.primary }, NUM]}>{after}</Text>
      </View> : <>
        <Text style={[{ maxWidth: '100%', fontSize: TYPE.caption.fontSize, color: COLOR.text.primary }, NUM]}>{before}</Text>
        <Text style={{ fontSize: TYPE.caption.fontSize, color: COLOR.text.tertiary }}>→</Text>
        <Text style={[{ flexGrow: boxed ? 0 : 1, flexShrink: 1, maxWidth: '100%', fontSize: TYPE.caption.fontSize, fontWeight: '800', color: COLOR.text.primary }, NUM]}>{after}</Text>
      </>}
    </View>
  );
}
