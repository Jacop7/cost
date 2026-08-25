// IngCard.tsx — ING-01 리스트 카드 (실데이터)
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card, Badge } from '../../../components/kit';
import { T, tnum } from '../../../theme/tokens';
import {
  belowSafety,
  formatQuantity,
  formatUnitPrice,
  isNegativeStock,
  stockStateOf,
  STOCK_STATE_LABEL,
  type StockState,
} from '@sikjae/core';
import type { IngredientRow } from '../hooks';

/** DB 기준단위(ea) → 화면 표기(개). */
const dispUnit = (u: IngredientRow['baseUnit']) => (u === 'ea' ? '개' : u);

/**
 * 재고 상태 판정은 **`@sikjae/core` 한 곳**에 있다(0108).
 *
 * ⚠ 예전엔 여기에도 한 벌이 있었고 core 와 **뜻이 달랐다** —
 *   core 는 `soonOut` 을 'out' 으로 보냈고 여기는 'low' 로 봤다.
 *   같은 이름이 다른 뜻이라 어느 쪽을 고쳐도 다른 쪽이 안 따라왔다.
 *   안전선 경계도 여기만 `<` 였다(기획안 §3 은 `이하`).
 *
 * 아래 셋은 **재수출일 뿐**이다. 이미 이 경로로 import 하는 화면이 여럿이라
 * 한 번에 갈아엎지 않고 통로만 core 로 돌렸다. 새 화면은 core 에서 직접 가져온다.
 */
export { belowSafety, stockStateOf };
export type { StockState };

export const stockLabel = (st: StockState) => STOCK_STATE_LABEL[st];

export function IngCard({ g, onPress }: { g: IngredientRow; onPress?: () => void }) {
  const unit = dispUnit(g.baseUnit);
  const st = stockLabel(stockStateOf(g));

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${g.name} 상세`}>
      <Card pad={0} style={{ overflow: 'hidden' }}>
        <View style={{ flex: 1, paddingVertical: 13, paddingHorizontal: 15 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Badge tone={st.tone} solid sm>{st.label}</Badge>
            <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: T.ink }} numberOfLines={1}>
              {g.name}
            </Text>
            <View style={{ flex: 1 }} />
            {g.categoryName ? <Badge tone="neutral" sm>{g.categoryName}</Badge> : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 }}>
            {/*
              ⚠ 음수 재고는 **빨강 그대로**다(0102). `0g` 으로 보정하지 않는다 —
                감추면 입고를 빠뜨렸다는 단서가 화면에서 사라진다.
            */}
            <Text
              style={[{ fontSize: 16, fontWeight: '800', color: isNegativeStock(g.stockTotal) ? T.red : T.ink }, tnum]}
              numberOfLines={1}
            >
              총 {formatQuantity(g.stockTotal, unit)}
            </Text>
            {/* 왜 노란지 그 자리에서 설명한다 — 안전선을 같이 보여준다. */}
            {stockStateOf(g) === 'low' ? (
              <Text style={{ fontSize: 13, fontWeight: '700', color: T.amberText }}>
                안전 {formatQuantity(g.safetyStock, unit)} 미달
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            {/* 기준단가가 null 이면 '산출 불가'다. 0원으로 그리면 공짜 재료로 읽힌다. */}
            <Text style={[{ fontSize: 14, fontWeight: '700', color: g.basePrice === null ? T.ter : T.sub }, tnum]}>
              {g.basePrice === null ? '단가 산출 전' : formatUnitPrice(g.basePrice, unit)}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 14, color: T.sub2 }}>
              {g.lastInboundAt ? `최근입고 ${g.lastInboundAt.slice(5).replace('-', '/')}` : '입고 기록 없음'}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
