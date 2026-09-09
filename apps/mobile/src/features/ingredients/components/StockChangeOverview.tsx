import { Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Card, ScrollTabs } from '@/components/kit';
import { COLOR, T, TYPE, space, tnum } from '@/theme/tokens';
import { formatQuantity, formatUnitPrice } from '@margincook/core';

export type StockMode = 'inbound' | 'deduct' | 'waste';
const modes: StockMode[] = ['inbound', 'deduct', 'waste'];

export function StockChangeOverview({ id, name, stock, basePrice, unit, mode, disabled = false }: {
  id: string; name: string; stock: number; basePrice: number | null; unit: 'g' | 'ml' | '개'; mode: StockMode; disabled?: boolean;
}) {
  const router = useRouter();
  return <View style={{ gap: space.md }}>
    <Card pad={0}>
      <Text style={{ ...TYPE.header, color: T.ink, padding: space.lg }}>{name}</Text>
      {[
        ['현재 재고', formatQuantity(stock, unit)],
        ['기준단가', basePrice === null ? '산출 전' : formatUnitPrice(basePrice, unit)],
      ].map(([label, value], i) => <View key={label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm,
        paddingVertical: space.lg, paddingHorizontal: space.lg, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Text style={{ ...TYPE.caption, color: T.sub }}>{label}</Text>
        <Text style={[{ ...TYPE.body, color: i === 0 && stock < 0 ? COLOR.status.negative : T.ink }, tnum]}>{value}</Text>
      </View>)}
    </Card>
    <View style={{ borderBottomWidth: 1, borderBottomColor: T.line }}>
      <ScrollTabs tabs={['입고', '차감', '폐기']} active={modes.indexOf(mode)}
        onChange={index => { if (!disabled && modes[index] !== mode) router.replace(`/ingredients/add-stock/${id}?mode=${modes[index]}` as Href); }} />
    </View>
  </View>;
}
