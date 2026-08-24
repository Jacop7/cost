/**
 * SALES-17 폐기 손실 자세히 — 프로토타입 `?screen=waste` 규격.
 *
 * ⚠ 두 갈래를 섞지 않는다(0041). 사장님이 할 일이 다르기 때문이다 —
 *     조리 폐기    만들어 놓고 못 팔았다   → 덜 만들어야 한다
 *     식재료 폐기  쓰기도 전에 버렸다      → 발주·보관을 손봐야 한다
 *
 * ⚠ 0097 에서 프로토타입에 맞췄다. 카드 셋에 설명 문단까지 있던 걸 **카드 하나**로 줄였다.
 *   금액은 지어내지 않는다 — 조리 폐기는 판매 시점에 굳은 1인분 재료비,
 *   식재료 폐기는 **버린 날** 단가로 되짚는다(0058).
 */
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatQuantity } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { DetailRow, DetailSection, DetailSummary } from '../components/ProfitBlocks';
import { useSalesRange, useWasteBreakdown } from '../hooks';
import { rangeLabel, todayBusiness } from '../period';

export default function SalesWasteScreen() {
  const { from: f, to: t } = useLocalSearchParams<{ from?: string; to?: string }>();
  const to = t ?? todayBusiness();
  const from = f ?? to;

  const q = useWasteBreakdown(from, to);
  const range = useSalesRange(from, to);
  const d = q.data;

  const revenue = range.data?.summary.revenue ?? 0;
  const pct = revenue > 0 ? Math.round(((d?.total ?? 0) / revenue) * 1000) / 10 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="폐기 손실 자세히" onBack={() => safeBack(`/sales/day?date=${to}`)} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <QueryState
          isLoading={q.isLoading}
          error={q.error}
          isEmpty={false}
          onRetry={() => void q.refetch()}
          emptyTitle=""
        >
          {d ? (
            <Card pad={0} style={{ overflow: 'hidden' }}>
              <DetailSummary
                rows={[
                  ['영업일', rangeLabel(from, to)],
                  ['폐기 손실 합계', `${d.total > 0 ? '−' : ''}${won(Math.round(d.total))}원`, undefined, d.total > 0 ? T.red : undefined],
                  ['매출 대비', `${pct > 0 ? '−' : ''}${pct}%`, undefined, pct > 0 ? T.red : undefined],
                ]}
              />

              <DetailSection title="조리 폐기" />
              <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
                {d.menu.length === 0 ? (
                  <DetailRow name="기록 없음" amount="0원" muted last />
                ) : (
                  d.menu.map((m, i) => (
                    <DetailRow
                      key={m.name}
                      name={m.name}
                      sub={`${m.qty}인분`}
                      amount={`${won(Math.round(m.amount))}원`}
                      last={i === d.menu.length - 1}
                    />
                  ))
                )}
              </View>

              <DetailSection title="식재료 폐기" divider />
              <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
                {d.ingredient.length === 0 ? (
                  <DetailRow name="기록 없음" amount="0원" muted last />
                ) : (
                  d.ingredient.map((g, i) => (
                    <DetailRow
                      key={g.name}
                      name={g.name}
                      sub={formatQuantity(g.qty, g.baseUnit === 'ea' ? '개' : (g.baseUnit as 'g' | 'ml'))}
                      amount={`${won(Math.round(g.amount))}원`}
                      last={i === d.ingredient.length - 1}
                    />
                  ))
                )}
              </View>
            </Card>
          ) : null}
        </QueryState>
      </ScrollView>
    </View>
  );
}
