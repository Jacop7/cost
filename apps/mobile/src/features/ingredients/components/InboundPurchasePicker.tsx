import { Platform, Pressable, Text, View } from 'react-native';
import { Button, Icon, Sheet } from '@/components/kit';
import { COLOR, T, TYPE, space, won } from '@/theme/tokens';
import { formatUnitPrice } from '@margincook/core';

type Option = { id: string; name: string; vendorName: string | null; volume: number; amount: number };
/** 실제 구매 옵션을 보여준다. 미선택/직접 입력은 저장 데이터가 아닌 폼의 선택 상태다. */
export function InboundPurchasePicker({ visible, onClose, options, unit, selected, onSelect, onAdd }: {
  visible: boolean; onClose: () => void; options: Option[]; unit: string;
  selected: string; onSelect: (id: string) => void; onAdd: () => void;
}) {
  const rows = [
    { id: 'none', name: '미선택', meta: '', label: '미선택' },
    ...options.map(o => ({ id: o.id, name: `${o.vendorName ? `${o.vendorName} · ` : ''}${o.name}`,
      meta: `${won(o.amount)}원 · ${formatUnitPrice(o.amount / o.volume, unit)}`,
      label: `${o.vendorName ? `${o.vendorName} · ` : ''}${o.name}, ${won(o.amount)}원, ${formatUnitPrice(o.amount / o.volume, unit)}` })),
  ];
  return <Sheet visible={visible} onClose={onClose} title="구매처 선택" footer={
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Button kind="ghost" size="md" style={{ flex: 1, borderColor: COLOR.action.primary }} accessibilityLabel="직접 입력" onPress={() => onSelect('direct')}><Text style={{ color: COLOR.action.primary }}>＋ 직접 입력</Text></Button>
      <Button kind="ghost" size="md" style={{ flex: 1, borderColor: COLOR.action.primary }} accessibilityLabel="새 구매 링크·옵션 추가" onPress={onAdd}><Text style={{ color: COLOR.action.primary }}>＋ 구매 링크 추가</Text></Button>
    </View>
  }>
      {rows.map((row, index) => <Pressable key={row.id} accessibilityRole="button"
        accessibilityLabel={`${row.label}${Platform.OS === 'web' && selected === row.id ? ', 현재 선택됨' : ''}`}
        accessibilityState={{ selected: selected === row.id }} onPress={() => onSelect(row.id)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md,
          borderTopWidth: index ? 1 : 0, borderTopColor: T.line2 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...TYPE.caption, fontWeight: '700', color: row.id === 'none' ? COLOR.text.tertiary : T.ink }}>{row.name}</Text>
          {row.meta ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, marginTop: space.xs }}>{row.meta}</Text> : null}
        </View>
        {selected === row.id ? <Icon name="check" size={18} color={COLOR.action.primary} /> : null}
      </Pressable>)}
  </Sheet>;
}
