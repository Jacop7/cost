import { Pressable, Text, View } from 'react-native';
import { Card, Sheet } from '@/components/kit';
import { T, space, TYPE } from '@/theme/tokens';

export interface OrderSummaryRow {
  id: string;
  name: string;
  description: string;
  value: string;
  onPress: () => void;
}

/** Shared native/web overview; rows come from the same order board as the cards. */
export function OrderBoardSummary({ visible, title, rows, onClose }: {
  visible: boolean; title: string; rows: OrderSummaryRow[]; onClose: () => void;
}) {
  return <Sheet visible={visible} title={title} onClose={onClose}>
    <Text style={{ ...TYPE.caption, color: T.sub2, marginBottom: space.md }}>{rows.length}건</Text>
    {rows.length === 0 ? <Text style={{ ...TYPE.body, color: T.sub }}>표시할 내역이 없어요</Text> :
      <Card pad={0} style={{ overflow: 'hidden' }}>
        {rows.map((row, i) => <Pressable key={row.id} accessibilityRole="button"
          accessibilityLabel={`${row.name} ${title} 상세`} onPress={() => { onClose(); row.onPress(); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 64,
            padding: space.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: T.line2 }}>
          <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
            <Text style={{ ...TYPE.body, fontWeight: '700', color: T.ink }}>{row.name}</Text>
            <Text style={{ ...TYPE.caption, color: T.sub2 }}>{row.description}</Text>
          </View>
          <Text style={{ ...TYPE.body, fontWeight: '700', color: T.ink, textAlign: 'right',
            maxWidth: '42%', fontVariant: ['tabular-nums'] }}>{row.value}</Text>
        </Pressable>)}
      </Card>}
  </Sheet>;
}
