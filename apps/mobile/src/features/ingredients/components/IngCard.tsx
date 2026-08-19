// IngCard.tsx — ING-01 리스트 카드 (실데이터)
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card, Badge } from '../../../components/kit';
import { T, tnum } from '../../../theme/tokens';
import { formatQuantity, formatUnitPrice } from '@sikjae/core';
import type { IngredientRow } from '../hooks';

/** DB 기준단위(ea) → 화면 표기(개). */
const dispUnit = (u: IngredientRow['baseUnit']) => (u === 'ea' ? '개' : u);

/**
 * 재고 상태 — 여유 / 소진 임박 2단계 (`docs/구현-변경점.md` §2).
 *
 * ⚠ 흡수 방향이 거꾸로였다. 3단계(충분/부족/소진임박)를 2단계로 줄이면서 '부족'을
 *   '여유'로 흡수해, **안전재고 미달인데 '여유'** 라고 쓰고 있었다(실측 7종).
 *   애호박은 안전선 1,500g 에 재고 720g 인데 '여유 ⚠' 였다.
 *   안전재고란 "이 밑으로 내려가면 발주해야 하는 선"이므로 그 아래는 소진 임박이 맞다.
 *   '부족'은 **'소진 임박'으로** 흡수한다.
 *
 * 안전재고는 **개수** 기준이라 개당 용량을 곱해 총량과 단위를 맞춘다.
 */
export function belowSafety(g: { stockTotal: number; safetyStock: number; perVolume: number }): boolean {
  return g.stockTotal < g.safetyStock * g.perVolume;
}

function statusOf(g: IngredientRow): { label: string; tone: 'green' | 'red' } {
  if (g.soonOut || g.stockTotal <= 0 || belowSafety(g)) return { label: '소진 임박', tone: 'red' };
  return { label: '여유', tone: 'green' };
}

export function IngCard({ g, onPress }: { g: IngredientRow; onPress?: () => void }) {
  const unit = dispUnit(g.baseUnit);
  const st = statusOf(g);

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
            <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, tnum]} numberOfLines={1}>
              총 {formatQuantity(g.stockTotal, unit)}
            </Text>
            {/* 왜 빨간지 그 자리에서 설명한다 — 안전선을 같이 보여준다. */}
            {belowSafety(g) ? (
              <Text style={{ fontSize: 13, fontWeight: '700', color: T.red }}>
                안전 {formatQuantity(g.safetyStock * g.perVolume, unit)} 미달
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
