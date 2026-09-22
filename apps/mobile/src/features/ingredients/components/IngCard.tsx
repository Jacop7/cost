import { useUnitPriceFormat } from '@/lib/unitPriceFormat';
// IngCard.tsx — ING-01 리스트 카드 (실데이터)
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card, Badge } from '../../../components/kit';
import { COLOR, COMPONENT, tnum, space } from '../../../theme/tokens';
import { belowSafety, formatQuantity, isNegativeStock, stockStateOf, STOCK_STATE_LABEL, type StockState } from '@costkeep/core';
import type { IngredientRow } from '../hooks';
import { isStockUnentered } from '../stockPresentation';

/** DB 기준단위(ea) → 화면 표기(개). */
const dispUnit = (u: IngredientRow['baseUnit']) => (u === 'ea' ? '개' : u);

/**
 * 재고 상태 판정은 **`@costkeep/core` 한 곳**에 있다(0108).
 *
 * ⚠ 예전엔 여기에도 한 벌이 있었고 core 와 **뜻이 달랐다** —
 *   core 는 `soonOut` 을 'out' 으로 보냈고 여기는 'low' 로 봤다.
 *   같은 이름이 다른 뜻이라 어느 쪽을 고쳐도 다른 쪽이 안 따라왔다.
 *   최소재고 경계도 여기만 `<` 였다(기획안 §3 은 `이하`).
 *
 * 아래 셋은 **재수출일 뿐**이다. 이미 이 경로로 import 하는 화면이 여럿이라
 * 한 번에 갈아엎지 않고 통로만 core 로 돌렸다. 새 화면은 core 에서 직접 가져온다.
 */
export { belowSafety, stockStateOf };
export type { StockState };

export const stockLabel = (st: StockState) => STOCK_STATE_LABEL[st];

export function IngCard({ g, onPress }: { g: IngredientRow; onPress?: () => void }) {
  const formatUnitPrice = useUnitPriceFormat();
  const unit = dispUnit(g.baseUnit);
  const st = isStockUnentered(g) ? { label: '재고 미입력', tone: 'neutral' as const } : stockLabel(stockStateOf(g));
  const showMinimum = g.stockTracking !== false && stockStateOf(g) === 'low' && belowSafety(g);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${g.name} ${isStockUnentered(g) ? '재고 입력' : '상세'}`}>
      <Card pad={0} style={{ overflow: 'hidden' }}>
        <View style={{ flex: 1, paddingVertical: space.md, paddingHorizontal: COMPONENT.card.contentInset }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
            <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
              {g.stockTracking !== false ? <Badge tone={st.tone} solid sm>{st.label}</Badge> : null}
              <Text style={{ maxWidth: '100%', flexShrink: 1, fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: COLOR.text.primary }} numberOfLines={1}>
                {g.name}
              </Text>
            </View>
            {/* 음수 재고는 실제 수치와 위험 색상을 유지한다. */}
            <Text style={[{ maxWidth: '50%', flexShrink: 1, textAlign: 'right', fontSize: 16, fontWeight: '800', color: isNegativeStock(g.stockTotal) ? COLOR.status.negative : COLOR.text.primary }, tnum]}>
              {g.stockTracking === false ? '재고 관리 안 함' : formatQuantity(g.stockTotal, unit)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.sm }}>
            <Text style={{ flex: 1, minWidth: 0, fontSize: showMinimum ? 13 : 14, fontWeight: showMinimum ? '700' : '400', color: showMinimum ? COLOR.status.caution : COLOR.text.tertiary }}>
              {showMinimum ? `최소재고 ${formatQuantity(g.safetyStock, unit)} 이하`
                : g.stockTracking === false ? '' : g.lastInboundAt ? `최근 입고 ${g.lastInboundAt.slice(5).replace('-', '/')}` : '입고 기록 없음'}
            </Text>
            {/* 산출 전을 0원으로 표시하지 않는다. */}
            <Text style={[{ maxWidth: '60%', flexShrink: 1, textAlign: 'right', fontSize: 14, fontWeight: '700', color: g.basePrice === null ? COLOR.text.tertiary : COLOR.text.secondary }, tnum]}>
              {g.basePrice === null ? '단가 산출 전' : formatUnitPrice(g.basePrice, unit)}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
