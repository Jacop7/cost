import { ConfigurationHistoryLink } from '@/features/changes/components/ConfigurationHistoryLink';
/**
 * MY-05 고정 지출 (월) — 항목별 금액과 고정지출률.
 *
 * 고정지출률 = 항목 합계 ÷ 월 매출. 이 비율이 **모든 메뉴의 손익**에 곱해지므로
 * 여기 숫자 하나가 전 메뉴 순이익률을 움직인다 — 화면에서 그 사실을 알린다.
 */
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Badge, Button, Card, QueryState, Notice } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatPercent } from '@margincook/core';
import { LAYOUT, COLOR, T, won, TYPE, space } from '@/theme/tokens';
import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { useBusinessEditConfirmation } from '@/features/business-day/useBusinessEditConfirmation';
import { useFixedCosts, useRevenueCheck } from '../hooks';
import { RevenueGapCard } from '../components/RevenueGapCard';
import { FixedMonthPicker } from '../components/FixedMonthPicker';

const NUM = { fontVariant: ['tabular-nums' as const] };

const LABEL: Record<string, string> = {
  labor: '인건비', rent: '임대료', utility: '공과금', commission: '플랫폼 수수료',
  packing: '포장비', delivery: '배달/배송', ads: '광고/홍보', etc: '기타',
};

/**
 * ⚠ 기준 월은 **서버**가 준다(0126). `local_date` 의 앞 7글자 —
 *   `store_local_month()` 과 같은 값이다(둘 다 매장 시간대의 지금).
 */
export default function FixedCostScreen() {
  return (
    <BusinessDateGate source={useStoreLocalDate()} title="고정 지출" onBack={() => safeBack('/my')}>
      {(localDate) => <FixedCostScreenBody localMonth={localDate.slice(0, 7)} />}
    </BusinessDateGate>
  );
}

function FixedCostScreenBody({ localMonth }: { localMonth: string }) {
  const editConfirmation = useBusinessEditConfirmation('고정지출');
  const router = useRouter();
  const [month, setMonth] = useState(localMonth);
  const fixed = useFixedCosts(month);
  // 적어둔 월매출이 전 메뉴 순이익에 곱해진다 — 실제와 얼마나 벌어졌는지 함께 보여준다(M-030).
  const check = useRevenueCheck(month);

  const items = fixed.data?.items ?? [];
  const revenue = fixed.data?.totalRevenue ?? 0;
  const total = items.reduce((a, i) => a + i.total, 0);
  const rate = fixed.data?.rate;
  const pctOf = (amt: number) => (revenue > 0 ? `${((amt / revenue) * 100).toFixed(1)}%` : '—');

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="고정 지출" onBack={() => safeBack('/my')} />

      <FixedMonthPicker value={month} localMonth={localMonth} onChange={setMonth} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: LAYOUT.scroll.start, paddingBottom: 24, gap: space.md }}>
        <ConfigurationHistoryLink kind="fixed_cost" month={month} />
        <QueryState
          isLoading={fixed.isLoading}
          error={fixed.error}
          isEmpty={items.length === 0 && revenue === 0}
          onRetry={() => void fixed.refetch()}
          emptyTitle={`${Number(month.slice(5))}월 고정지출이 아직 없어요`}
          emptyHint="아래 ‘수정’으로 월 매출과 항목을 등록해 주세요"
        >
          {!check.data?.hasSales ? <Card pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, paddingHorizontal: 16 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>총 월매출</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(revenue)}</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: T.sub2, marginLeft: 4 }}>원</Text>
            </View>
          </Card> : null}

          {check.data ? <RevenueGapCard check={check.data} /> : null}

          {items.map((it) => (
            <Card key={it.key} pad={0} style={{ overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.md, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>{LABEL[it.key] ?? it.key}</Text>
                <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2 }, NUM]}>{pctOf(it.total)}</Text>
              </View>
              <View style={{ paddingHorizontal: space.md, paddingTop: 4, paddingBottom: space.md }}>
                {it.lines.length === 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>합계 입력</Text>
                    <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(it.total)}원</Text>
                  </View>
                ) : (
                  <>
                    {it.lines.map((l, i) => (
                      <View key={`${l.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, borderBottomWidth: i < it.lines.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>{l.name}</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(l.amount)}원</Text>
                          <Text style={[{ fontSize: 14, fontWeight: '600', color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>{pctOf(l.amount)}</Text>
                        </View>
                      </View>
                    ))}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: space.sm, borderTopWidth: 1, borderTopColor: T.line }}>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>소계</Text>
                      <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(it.total)}원</Text>
                    </View>
                  </>
                )}
              </View>
            </Card>
          ))}

          <Notice style={{ marginTop: space.xs }}>
            고정지출률은 이 달의 <Text style={{ fontWeight: '700' }}>모든 메뉴 손익</Text>에 곱해져요. 여기 숫자를 고치면 전 메뉴 순이익률이 함께 바뀌어요.
          </Notice>
        </QueryState>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: space.md, paddingBottom: LAYOUT.scroll.end, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub2 }}>고정 지출 합계</Text>
          <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink, marginRight: 8 }, NUM]}>{won(total)}원</Text>
          {rate !== null && rate !== undefined ? <Badge tone="blue" sm>{formatPercent(rate)}</Badge> : null}
        </View>
        <Button kind="primary" size="lg" full onPress={() => month === localMonth ? editConfirmation.request(() => router.push(`/recipes/fixed-cost-edit?month=${month}` as Href)) : router.push(`/recipes/fixed-cost-edit?month=${month}` as Href)}>
          수정
        </Button>
      </View>

      {editConfirmation.dialog}
    </View>
  );
}
