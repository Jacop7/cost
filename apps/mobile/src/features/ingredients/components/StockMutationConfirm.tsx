import { Text, View } from 'react-native';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { COLOR, T, TYPE, radius, space, tnum } from '@/theme/tokens';

/** 입고·차감·폐기의 공통 확인 양식. 수량 문자열은 호출처의 공용 포맷터가 소유한다. */
export function StockMutationConfirm({ visible, action, ingredientName, quantity, remaining, negative = false, loading, onCancel, onConfirm }: {
  visible: boolean; action: '입고' | '차감' | '폐기'; ingredientName: string; quantity: string;
  remaining: string; negative?: boolean; loading: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return <ConfirmDialog visible={visible} title={`재고를 ${action}할까요?`} kind="primary"
    confirmText={action} closeLabel={`${action} 확인 닫기`} loading={loading} onCancel={onCancel} onConfirm={onConfirm}>
    <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: T.surface2, gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, flex: 1 }}>식재료</Text>
        <Text style={{ ...TYPE.body, fontWeight: '800', color: T.ink, flex: 1, textAlign: 'right' }}>{ingredientName}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, flex: 1 }}>{action}량</Text>
        <Text style={[{ ...TYPE.body, fontWeight: '800', color: T.ink, flex: 1, textAlign: 'right' }, tnum]}>{quantity}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', borderTopWidth: 1, borderTopColor: T.line, paddingTop: space.md }}>
        <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, flex: 1 }}>{action} 후 재고</Text>
        <Text style={[{ ...TYPE.body, fontWeight: '800', color: negative ? COLOR.status.negative : T.ink, flex: 1, textAlign: 'right' }, tnum]}>{remaining}</Text>
      </View>
    </View>
  </ConfirmDialog>;
}
