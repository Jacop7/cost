/**
 * MY-05 고정 지출 (월) — 항목별 금액과 고정지출률.
 *
 * 고정지출률 = 항목 합계 ÷ 월 매출. 이 비율이 **모든 메뉴의 손익**에 곱해지므로
 * 여기 숫자 하나가 전 메뉴 순이익률을 움직인다 — 화면에서 그 사실을 알린다.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Badge, Button, Card, FilterButton, Icon, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatPercent } from '@margincook/core';
import { T, won } from '@/theme/tokens';
import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { useFixedCosts, useRevenueCheck } from '../hooks';
import { RevenueGapCard } from '../components/RevenueGapCard';

const NUM = { fontVariant: ['tabular-nums' as const] };

const LABEL: Record<string, string> = {
  labor: '인건비', rent: '임대료', utility: '공과금', commission: '플랫폼 수수료',
  packing: '포장비', delivery: '배달/배송', ads: '광고/홍보', etc: '기타',
};

/**
 * 최근 6개월 — 지난달 값을 그대로 복사해 쓰는 일이 잦아 월 이동이 필요하다.
 *
 * ⚠ `now` 는 **인자**다(0126). 예전엔 기기 시계로 이번 달을 만들었는데, 그러면
 *   해외 매장 월말에 서버는 8월인데 이 목록만 9월부터 시작한다.
 */
function recentMonths(now: string, count = 6): string[] {
  const y = Number(now.slice(0, 4));
  const m = Number(now.slice(5, 7));
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

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
  const router = useRouter();
  const months = recentMonths(localMonth);
  const [month, setMonth] = useState(months[0]!);
  /** 월 고르는 입구는 하나다(0096) — 매출 분석·식재료 내역과 같은 필터 버튼. */
  const [monthOpen, setMonthOpen] = useState(false);
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

      {/*
        ⚠ 칩 6개를 필터 버튼 하나로 바꿨다(0096). 매출 분석·식재료 내역이 쓰는
          `.condition-filter` 와 같은 모양이라야 사장님이 한 번만 배운다.
      */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: 20, paddingVertical: 8 }}>
        <FilterButton label={`${month.slice(0, 4)}년 ${Number(month.slice(5))}월`} onPress={() => setMonthOpen(true)} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24, gap: 11 }}>
        <QueryState
          isLoading={fixed.isLoading}
          error={fixed.error}
          isEmpty={items.length === 0 && revenue === 0}
          onRetry={() => void fixed.refetch()}
          emptyTitle={`${Number(month.slice(5))}월 고정지출이 아직 없어요`}
          emptyHint="아래 ‘수정’으로 월 매출과 항목을 등록해 주세요"
        >
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 16 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>총 월매출</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(revenue)}</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: T.sub2, marginLeft: 4 }}>원</Text>
            </View>
          </Card>

          {check.data ? <RevenueGapCard check={check.data} /> : null}

          {items.map((it) => (
            <Card key={it.key} pad={0} style={{ overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>{LABEL[it.key] ?? it.key}</Text>
                <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2 }, NUM]}>{pctOf(it.total)}</Text>
              </View>
              <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
                {it.lines.length === 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>합계 입력</Text>
                    <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(it.total)}원</Text>
                  </View>
                ) : (
                  <>
                    {it.lines.map((l, i) => (
                      <View key={`${l.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < it.lines.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>{l.name}</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(l.amount)}원</Text>
                          <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>{pctOf(l.amount)}</Text>
                        </View>
                      </View>
                    ))}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line }}>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>소계</Text>
                      <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(it.total)}원</Text>
                    </View>
                  </>
                )}
              </View>
            </Card>
          ))}

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 2, marginTop: 2 }}>
            <Icon name="info" size={15} color={T.ter} />
            <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>
              고정지출률은 이 달의 <Text style={{ fontWeight: '700' }}>모든 메뉴 손익</Text>에 곱해져요. 여기 숫자를 고치면 전 메뉴 순이익률이 함께 바뀌어요.
            </Text>
          </View>
        </QueryState>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 11, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 11 }}>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub2 }}>고정 지출 합계</Text>
          <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink, marginRight: 8 }, NUM]}>{won(total)}원</Text>
          {rate !== null && rate !== undefined ? <Badge tone="blue" sm>{formatPercent(rate)}</Badge> : null}
        </View>
        <Button kind="primary" size="lg" full onPress={() => router.push(`/recipes/fixed-cost-edit?month=${month}` as Href)}>
          수정
        </Button>
      </View>

      <Sheet visible={monthOpen} onClose={() => setMonthOpen(false)} title="월" sub="어느 달을 볼까요?" height={430}>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {months.map((m, i) => {
            const on = m === month;
            return (
              <Pressable
                key={m}
                onPress={() => { setMonth(m); setMonthOpen(false); }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${m.slice(0, 4)}년 ${Number(m.slice(5))}월`}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 55, paddingHorizontal: 15,
                  borderBottomWidth: i === months.length - 1 ? 0 : 1, borderBottomColor: T.line2,
                }}
              >
                <Text style={{ flex: 1, fontSize: 15, fontWeight: on ? '800' : '700', color: on ? T.blue : T.ink }}>
                  {m.slice(0, 4)}년 {Number(m.slice(5))}월
                </Text>
                {on ? <Icon name="check" size={18} color={T.blue} /> : null}
              </Pressable>
            );
          })}
        </Card>
      </Sheet>
    </View>
  );
}
