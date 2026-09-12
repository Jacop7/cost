import { EmptyDataText } from '@/components/kit/EmptyDataText';
/**
 * 식재료 상세의 기준 단가·최근 입고. 서버의 확정값을 재계산하지 않는다.
 * 입고 완료/부분 입고 중 실입고 수량이 있는 기록만 최대 3건 표시한다.
 */
import { Text, View } from 'react-native';
import { Badge, Card } from '@/components/kit';
import { formatQuantity, formatUnitPrice } from '@margincook/core';
import { COLOR, COMPONENT, T, TYPE, space, tnum } from '@/theme/tokens';
import { packSummaryParts } from '@/lib/num';
import { PurchaseAmount } from './PurchaseAmount';
import { DetailMore, DetailPreviewRow, DetailSectionHeader } from './DetailPreview';

export interface InboundRecord {
  id: string;
  orderedAt: string;
  status: 'ordered' | 'partial' | 'received' | 'canceled';
  volume: number;
  amount: number;
  qty: number;
  receivedQty: number;
  vendorName: string | null;
  unitPrice: number | null;
}


export function BasePriceCard({ unit, basePrice, purchase, orders, onSeeAll }: {
  unit: 'g' | 'ml' | '개';
  basePrice: number | null;
  purchase: { count: number; avg: number | null; low: number | null; high: number | null };
  orders: InboundRecord[];
  onSeeAll: () => void;
}) {
  const eligible = orders.filter(o => (o.status === 'received' || o.status === 'partial') && o.receivedQty > 0);
  const priced = eligible.slice(0, 3);
  const firstLow = eligible.findIndex(o => purchase.low !== null && o.unitPrice !== null && Math.abs(o.unitPrice - purchase.low) < 0.0001);
  const firstHigh = eligible.findIndex(o => purchase.high !== null && o.unitPrice !== null && Math.abs(o.unitPrice - purchase.high) < 0.0001);
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <DetailSectionHeader>기준 단가</DetailSectionHeader>
      <View style={{ paddingHorizontal: space.lg, paddingVertical: COMPONENT.ingredientDetail.cardPaddingVertical }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ maxWidth: '100%' }}>
            <Text style={{ ...TYPE.caption, color: T.sub2 }}>실입고 기준</Text>
            <Text style={[{ ...TYPE.display, color: basePrice === null ? T.sub2 : COLOR.text.accent, marginTop: space.xs }, tnum]}>
              {basePrice === null ? '산출 전' : formatUnitPrice(basePrice, unit)}
            </Text>
          </View>
          <View style={{ maxWidth: '100%', alignItems: 'flex-end' }}>
            <Text style={{ ...TYPE.caption, color: T.sub2 }}>가중평균</Text>
            <Text style={[{ ...TYPE.body, color: T.ink }, tnum]}>{purchase.avg === null ? '산출 전' : formatUnitPrice(purchase.avg, unit)}</Text>
          </View>
        </View>
      </View>
      {purchase.count > 0 ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, flexDirection: 'row', flexWrap: 'wrap', gap: 22 }}>
          {([['최저', purchase.low, COLOR.text.accent], ['최고', purchase.high, COLOR.status.negative]] as const).map(([label, value, color]) => (
            <View key={label} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, maxWidth: '100%' }}>
              <Text style={{ ...TYPE.caption, color }}>{label}</Text>
              <Text style={[{ ...TYPE.caption, color: T.ink, fontWeight: '700' }, tnum]}>{value === null ? '산출 전' : formatUnitPrice(value, unit)}</Text>
            </View>
          ))}
        </View>
      ) : <EmptyDataText style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
        재고 입력해주세요.
      </EmptyDataText>}
      {priced.length ? <>
        <View testID="recent-inbound-divider" style={{ borderTopWidth: 1, borderTopColor: T.line2 }} />
        <DetailSectionHeader plain>최근 입고</DetailSectionHeader>
        <View style={{ paddingHorizontal: space.lg }}>
          {priced.map((o, i) => {
            const partial = o.status === 'partial';
            const low = i === firstLow;
            const high = i === firstHigh;
            const sub = [partial ? '부분 입고' : '', o.vendorName ?? '거래처 미지정'].filter(Boolean).join(' · ');
            const parts = packSummaryParts({ volume: o.volume, qty: o.qty, receivedQty: o.receivedQty, amount: o.amount,
              fmtQty: v => formatQuantity(v, unit), fmtWon: v => v.toLocaleString('ko-KR') });
            return <DetailPreviewRow key={o.id} title={o.orderedAt.slice(5).replace('-', '/')} sub={sub}
              purchaseEmphasis
              subBefore={<>{low ? <Badge tone="blue" sm alignSelf="center">최저</Badge> : null}{high ? <Badge tone="red" sm alignSelf="center">최고</Badge> : null}</>}
              subAfter={<PurchaseAmount>{parts.amount}</PurchaseAmount>}
              value={o.unitPrice === null ? '산출 전' : formatUnitPrice(o.unitPrice, unit)}
              detail={parts.total}
              detailAfter={[parts.breakdown, partial ? '도착분만 반영' : ''].filter(Boolean).join('\n')}
              last={i === priced.length - 1} />;
          })}
        </View>
      </> : null}
      <DetailMore onPress={onSeeAll} accessibilityLabel="구매 이력 자세히보기" />
    </Card>
  );
}
