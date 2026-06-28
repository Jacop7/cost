// IngCard.tsx — ING-01 리스트 카드
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card, Badge, StatusBadge, Icon } from '../../../components/kit';
import { T, tnum, won } from '../../../theme/tokens';
import { fmtStock, type IngItem } from '../store';

export function IngCard({ g, onPress }: { g: IngItem; onPress?: () => void }) {
  const big = g.unit === 'ml' ? 'L' : 'kg';
  const line1 = '총 ' + fmtStock(g.unit, g.stock);
  let unitLabel: string;
  let unitPrice: number;
  if (g.unit === '개') {
    unitLabel = '개';
    unitPrice = Math.round(g.price);
  } else if (g.per >= 1000) {
    unitLabel = big;
    unitPrice = Math.round(g.price * 1000);
  } else {
    unitLabel = g.unit;
    unitPrice = Math.round(g.price * 10) / 10;
  }
  return (
    <Pressable onPress={onPress}>
      <Card pad={0} style={{ overflow: 'hidden' }}>
        <View style={{ padding: 0 }}>
          <View style={{ flex: 1, paddingVertical: 13, paddingHorizontal: 15 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {g.soon ? <Badge tone="red" solid sm>곧 소진</Badge> : <StatusBadge status={g.status} sm />}
              <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: T.ink }} numberOfLines={1}>
                {g.name}
              </Text>
              {g.warn ? <Icon name="warn" size={16} color={T.red} /> : null}
              <View style={{ flex: 1 }} />
              <Badge tone="neutral" sm>{g.cat}</Badge>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 }}>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, tnum]} numberOfLines={1}>
                {line1}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Text style={[{ fontSize: 14, fontWeight: '700', color: g.warn ? T.red : T.sub }, tnum]}>
                {won(unitPrice)}원/{unitLabel}
              </Text>
              {g.warn && g.warnPct ? <Badge tone="red" sm>▲{g.warnPct}%</Badge> : null}
              <View style={{ flex: 1 }} />
              <Text style={{ fontSize: 14, color: T.sub2 }}>최근입고 {g.last}</Text>
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
