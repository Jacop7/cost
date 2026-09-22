import { useUnitPriceFormat } from '@/lib/unitPriceFormat';
import { Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Badge, Card, ScrollTabs } from '@/components/kit';
import { COLOR, T, TYPE, space, tnum } from '@/theme/tokens';
import { formatQuantity } from '@costkeep/core';

export type StockMode = 'inbound' | 'deduct' | 'waste';
const modes: StockMode[] = ['inbound', 'deduct', 'waste'];

export function StockChangeOverview({ id, name, stock, basePrice, unit, mode, minimumStock, changePreview, disabled = false, compact = false, inlineSummary = false }: {
  id: string; name: string; stock: number; basePrice: number | null; unit: 'g' | 'ml' | '개'; mode?: StockMode; minimumStock?: number;
  changePreview?: { stock: string; basePrice: string }; disabled?: boolean; compact?: boolean; inlineSummary?: boolean;
}) {
  const formatUnitPrice = useUnitPriceFormat();
  const router = useRouter();
  const currentStock = formatQuantity(stock, unit);
  const currentPrice = basePrice === null ? '산출 전' : formatUnitPrice(basePrice, unit);
  // 부모의 12px 간격과 합쳐 탭 아래 입력 영역까지 공통 24px을 확보한다.
  return <View style={{ gap: compact ? space.md : space.xl, paddingBottom: compact ? 0 : space.md }}>
    <Card pad={0}>
      {inlineSummary ? <View style={{ paddingVertical: space.md, paddingHorizontal: space.lg, gap: space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {minimumStock !== undefined && stock < minimumStock ? <Badge tone="amber" sm>최소재고 미달</Badge> : null}
          <Text style={{ ...TYPE.header, color: T.ink, flex: 1 }}>{name}</Text>
        </View>
        <Text style={{ ...TYPE.captionSm, color: stock < 0 ? COLOR.status.negative : COLOR.text.tertiary }}>
          {minimumStock !== undefined ? <>
            현재 <Text>{currentStock}</Text> · 최소 <Text>{formatQuantity(minimumStock, unit)}</Text>
          </> : <>
            현재 재고 <Text>{currentStock}</Text> · 단가 <Text>{currentPrice}</Text>
          </>}
        </Text>
      </View> : <>
      <Text style={{ ...TYPE.header, color: T.ink, padding: space.lg }}>{name}</Text>
      {[
        [changePreview ? '입고 후 재고' : '현재 재고', changePreview ? `${currentStock} → ${changePreview.stock}` : currentStock],
        minimumStock !== undefined ? ['최소재고', formatQuantity(minimumStock, unit)]
          : [changePreview ? '입고 후 단가' : '단가', changePreview ? `${currentPrice} → ${changePreview.basePrice}` : currentPrice],
      ].map(([label, value], i) => <View key={label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm,
        paddingVertical: compact ? space.md : space.lg, paddingHorizontal: space.lg, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Text style={{ ...TYPE.caption, color: T.sub }}>{label}</Text>
        <Text style={[{ ...TYPE.body, flexShrink: 1, textAlign: 'right', color: i === 0 && stock < 0 ? COLOR.status.negative : T.ink }, tnum]}>{value}</Text>
      </View>)}
      </>}
    </Card>
    {mode ? <View style={{ borderBottomWidth: 1, borderBottomColor: T.line }}>
      <ScrollTabs tabs={['입고', '차감', '폐기']} active={modes.indexOf(mode)}
        onChange={index => { if (!disabled && modes[index] !== mode) router.replace(`/ingredients/add-stock/${id}?mode=${modes[index]}` as Href); }} />
    </View> : null}
  </View>;
}
