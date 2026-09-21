/**
 * SALES-04 채널별 손익 — 판매 시점의 전체 채널별 손익.
 *
 * 매출·수량·재료비·세금·수수료는 판매 줄에 채널별 수량이 있어 **정확히** 나뉜다.
 * 고정지출만 제품 정책에 따라 매출 비중으로 배분한다. 폐기·추가지출은 채널
 * 귀속 원장이 없으므로 채널 카드에서 빼고 화면 하단의 미지정 비용으로 표시한다.
 */
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { COLOR, LAYOUT, COMPONENT, T, won, TYPE, space } from '@/theme/tokens';
import { useSalesRange } from '../hooks';

import { DetailSummary, SalesRow } from '../components/ProfitBlocks';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { rangeLabel } from '@/lib/date';
import { useSalesBusinessDate } from '@/features/business-day/businessDay';
import { nullablePercentOfTotal, percentOfTotal } from '../periodPercent';

const NUM = { fontVariant: ['tabular-nums' as const] };
const CHANNEL_COLOR: Record<string, string> = COMPONENT.channelChart;

/**
 * ⚠ 서버가 정한 장부 날짜를 받고 나서 본체를 붙인다(0125). 앱이 직접 계산하지 않는다.
 *   게이트가 로딩·오류·재시도를 함께 다룬다 — 날짜 조회가 실패하면 예전엔 영원히
 *   "불러오는 중" 만 떴다.
 */
export default function SalesChannelScreen() {
  return (
    <BusinessDateGate source={useSalesBusinessDate()} title="채널별 손익">
      {(serverToday) => <SalesChannelScreenBody serverToday={serverToday} />}
    </BusinessDateGate>
  );
}

function SalesChannelScreenBody({ serverToday }: { serverToday: string }) {
  const params = useLocalSearchParams<{ from?: string; to?: string; date?: string }>();
  const today = serverToday;
  const from = params.from ?? params.date ?? today;
  const to = params.to ?? params.date ?? today;

  const range = useSalesRange(from, to);
  // 기타 매출도 채널이 있다(0093). 채널을 묻기 전에 적은 줄만 미지정으로 남는다.
  /* 기본 3개를 먼저 두고, 사용자 채널은 서버의 안정된 manifest 순서를 유지한다. */
  const ORDER: Record<string, number> = { hall: 0, delivery: 1, takeout: 2 };
  const channels = (range.data?.channels ?? [])
    // 새 기간 RPC의 amount/tax/netSales는 메뉴와 채널 지정 기타 매출을 이미 합친 권위 총액이다.
    .filter((c) => c.amount > 0 || (c.fixedCost ?? 0) !== 0)
    .sort((a, b2) => (ORDER[a.code] ?? 9) - (ORDER[b2.code] ?? 9));
  /*
   * ⚠ 배분 분모는 **채널에 귀속된 매출 전부**다. 기타 매출을 빼 놓으면
   *   술을 많이 파는 매장의 고정지출이 배달 쪽으로 쏠린다.
   *   미지정 몫은 여전히 뺀다 — 어느 채널인지 모르니까.
   */
  const unassigned = range.data?.unassignedRevenue ?? 0;
  const unallocatedWaste = range.data?.wasteLossUnallocated ?? 0;
  const unallocatedDailyExtra = range.data?.dailyExtraUnallocated ?? 0;
  const accountingError = channels.some(c => c.netSales == null)
    ? new Error('채널별 순매출을 확인하지 못했어요. 다시 불러와 주세요.') : null;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="채널별 손익" onBack={() => safeBack(`/sales/day?date=${to}`)} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: LAYOUT.scroll.start, paddingBottom: LAYOUT.scroll.end, gap: space.md }}>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <DetailSummary rows={[['영업일', rangeLabel(from, to)]]} />
        </Card>

        <QueryState
          isLoading={range.isLoading}
          error={range.error ?? accountingError}
          isEmpty={channels.length === 0}
          onRetry={() => { void range.refetch(); }}
          emptyTitle="이 기간에 판매 기록이 없어요"
        >
          {channels.map((c) => {
            const revenue = c.amount;
            const etcRevenue = c.etcRevenue;
            const fixed = c.fixedCost ?? null;
            const extraMat = c.extraMaterialCost;
            const tax = c.tax;
            const profit = c.profit ?? null;
            const rate = nullablePercentOfTotal(profit, revenue);
            const neg = profit != null && profit < 0;
            const PR = neg ? COLOR.status.negative : COLOR.status.positive;
            const p = (v: number) => percentOfTotal(v, revenue);

            // [라벨, 금액, 배분값인가]
            const costs: [string, number | null, boolean][] = [
              ['(−) 재료', c.material + extraMat, extraMat !== 0],
              // 채널 귀속 원장이 없는 항목도 손익 구성에서 빠진 것으로 보이지 않게
              // 행은 유지한다. 서버는 채널별 0과 하단 미지정 합계를 함께 반환한다.
              ['(−) 폐기 손실', c.wasteLoss, false],
              ['(−) 고정 지출', fixed, true],
              ['(−) 추가 지출', c.dailyExtra, false],
              // 손익은 확정 순매출을 사용하므로 과세액을 추가 차감으로 표시하지 않는다.
              ['세금 (참고)', tax, false],
            ];

            return (
              <Card key={c.code} pad={0} style={{ overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: space.lg, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: CHANNEL_COLOR[c.code] ?? T.sub2 }} />
                  <Text style={{ ...TYPE.body, fontWeight: '800', color: T.sub }}>{c.name}</Text>
                </View>
                <View style={{ paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.xs }}>
                  <SalesRow label="판매 수량" amount={`${c.qty}개`} strong reserveArrowSpace={false} />
                   <SalesRow
                     label="매출"
                    amount={`${won(revenue)}원`}
                    percent="100%"
                     strong
                     reserveArrowSpace={false}
                   />
                   <SalesRow
                     label="기타 매출"
                     amount={`${won(etcRevenue)}원`}
                     percent={`${p(etcRevenue)}%`}
                     reserveArrowSpace={false}
                   />
                   <SalesRow label="채널 손익" amount={profit == null ? '미산출' : `${neg ? '−' : ''}${won(Math.abs(profit))}원`} percent={rate == null ? '미산출' : `${rate}%`} strong tone={profit == null ? T.sub : PR} reserveArrowSpace={false} />
                  {costs.map(([n, v, allocated], k) => (
                    <SalesRow
                      key={n}
                      label={allocated ? `${n} 배분` : n}
                      amount={v == null ? '미산출' : `${won(v)}원`}
                      percent={v == null ? '미산출' : `${p(v)}%`}
                      last={k === costs.length - 1}
                      reserveArrowSpace={false}
                    />
                  ))}
                </View>
              </Card>
            );
          })}
        </QueryState>

        {/*
          ⚠ 설명 문단은 다 걷어냈다 — 사장님: "설명이 더 헷갈려."
            `배분` 꼬리표가 줄마다 붙어 있으니 문단으로 또 말할 필요가 없다.
            다만 미지정 금액은 **화면에 없는 돈**이라 한 줄로 남긴다.
        */}
        {unassigned > 0 ? (
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <DetailSummary rows={[['채널 미지정 기타 매출', `${won(unassigned)}원`]]} />
          </Card>
        ) : null}
        {(range.data?.fixedCostUnallocated ?? 0) > 0 ? (
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <DetailSummary
              rows={[
                ['채널 미지정 고정 지출', `${won(range.data?.fixedCostUnallocated ?? 0)}원`],
              ]}
            />
          </Card>
        ) : null}
        {unallocatedWaste > 0 || unallocatedDailyExtra > 0 ? (
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ paddingVertical: 12, paddingHorizontal: space.lg, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ ...TYPE.body, fontWeight: '800', color: T.sub }}>채널 미지정 비용</Text>
            </View>
            <View style={{ paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.xs }}>
              {unallocatedWaste > 0 ? (
                <SalesRow label="폐기 손실" amount={`${won(unallocatedWaste)}원`} last={unallocatedDailyExtra <= 0} reserveArrowSpace={false} />
              ) : null}
              {unallocatedDailyExtra > 0 ? (
                <SalesRow label="추가 지출" amount={`${won(unallocatedDailyExtra)}원`} last reserveArrowSpace={false} />
              ) : null}
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
