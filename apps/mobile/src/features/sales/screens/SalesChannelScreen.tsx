/**
 * SALES-04 채널별 손익 — 매장·배달·포장 분할 손익.
 *
 * 매출·수량·재료비·세금·수수료는 판매 줄에 채널별 수량이 있어 **정확히** 나뉜다.
 * 고정지출·폐기·추가지출만 매출 비중 배분이며, 표에 '배분'이라고 적어 구분한다 —
 * 배분값을 실제값처럼 보이게 하면 "배달이 적자"라는 잘못된 결론으로 이어진다.
 */
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { COLOR, LAYOUT, COMPONENT, T, won, TYPE, space } from '@/theme/tokens';
import { useEtcByChannel, useSalesRange } from '../hooks';

import { DetailSummary, SalesRow } from '../components/ProfitBlocks';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { rangeLabel } from '@/lib/date';
import { useSalesBusinessDate } from '@/features/business-day/businessDay';

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
  const etcCh = useEtcByChannel(from, to);
  const s = range.data?.summary;
  /* 순서는 매장 · 배달앱 · 포장 고정이다(프로토타입). 금액순이면 날마다 자리가 바뀐다. */
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
  const assigned = channels.reduce((a, c) => a + c.amount, 0);
  const unassigned = etcCh.data?.unassigned ?? 0;
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
          isLoading={range.isLoading || etcCh.isLoading}
          error={range.error ?? etcCh.error ?? accountingError}
          isEmpty={channels.length === 0}
          onRetry={() => { void range.refetch(); void etcCh.refetch(); }}
          emptyTitle="이 기간에 판매 기록이 없어요"
        >
          {channels.map((c) => {
            // 서버 배분 결과가 없을 때만 같은 매출 비중 공식으로 미리보기를 만든다.
            const revenue = c.amount;
            const share = assigned > 0 ? revenue / assigned : 0;
            const waste = (s?.wasteLoss ?? 0) * share;
            const fixed = c.fixedCost ?? null;
            const daily = (s?.dailyExtra ?? 0) * share;
            const extraMat = (s?.extraMaterialCost ?? 0) * share;
            const tax = c.tax;
            const profit = fixed == null ? null
              : (c.netSales ?? 0) - c.material - extraMat - waste - fixed - daily;
            const rate = profit != null && revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null;
            const neg = profit != null && profit < 0;
            const PR = neg ? COLOR.status.negative : COLOR.status.positive;
            const p = (v: number) => (revenue > 0 ? Math.round((v / revenue) * 1000) / 10 : 0);

            // [라벨, 금액, 배분값인가]
            const costs: [string, number | null, boolean][] = [
              ['(−) 재료', c.material + extraMat, extraMat !== 0],
              ['(−) 폐기 손실', waste, true],
              ['(−) 고정 지출', fixed, true],
              ['(−) 추가 지출', daily, true],
              // 손익은 확정 순매출을 사용하므로 과세액을 추가 차감으로 표시하지 않는다.
              ['세금 (참고)', tax, false],
            ];

            return (
              <Card key={c.code} pad={0} style={{ overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: space.md, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: CHANNEL_COLOR[c.code] ?? T.sub2 }} />
                  <Text style={{ fontSize: TYPE.caption.fontSize, fontWeight: '800', color: T.sub }}>{c.name}</Text>
                </View>
                <View style={{ paddingHorizontal: space.md, paddingTop: space.xs, paddingBottom: space.xs }}>
                  <SalesRow label="판매 수량" amount={`${c.qty}개`} strong />
                  <SalesRow
                    label="매출"
                    amount={`${won(revenue)}원`}
                    percent="100%"
                    strong
                  />
                  <SalesRow label="순이익" amount={profit == null ? '미산출' : `${neg ? '−' : ''}${won(Math.abs(profit))}원`} percent={rate == null ? '미산출' : `${rate}%`} strong tone={profit == null ? T.sub : PR} />
                  {costs.map(([n, v, allocated], k) => (
                    <SalesRow
                      key={n}
                      label={allocated ? `${n} 배분` : n}
                      amount={v == null ? '미산출' : `${won(v)}원`}
                      percent={v == null ? '미산출' : `${p(v)}%`}
                      last={k === costs.length - 1}
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
      </ScrollView>
    </View>
  );
}
