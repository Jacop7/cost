/**
 * SALES-18 채널별 손익 — 매장·배달·포장 분할 손익.
 *
 * 매출·수량·재료비·세금·수수료는 판매 줄에 채널별 수량이 있어 **정확히** 나뉜다.
 * 고정지출·폐기·추가지출만 매출 비중 배분이며, 표에 '배분'이라고 적어 구분한다 —
 * 배분값을 실제값처럼 보이게 하면 "배달이 적자"라는 잘못된 결론으로 이어진다.
 */
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { useEtcByChannel, useSalesRange } from '../hooks';

import { DetailSummary, SalesRow } from '../components/ProfitBlocks';
import { useChannelFixed } from '@/features/my/hooks';
import { rangeLabel } from '../period';
import { useSalesBusinessDate } from '../businessDay';

const NUM = { fontVariant: ['tabular-nums' as const] };
const COLOR: Record<string, string> = { hall: '#3182F6', delivery: '#7A8694', takeout: '#C5CCD3' };

export default function SalesChannelScreen() {
  const params = useLocalSearchParams<{ from?: string; to?: string; date?: string }>();
    /*
   * ⚠ **서버가 정한 장부 날짜**를 쓴다(0125). 앱이 `+09:00` 고정 오프셋으로 직접
   *   계산하면 앱과 DB 가 각자 오늘을 갖게 된다(기획서 §2.1).
   *   못 받았으면 빈 문자열이고, 그동안 조회가 꺼진다 — 잘못된 날의 숫자보다 낫다.
   */
  const serverToday = useSalesBusinessDate() ?? '';
  const today = serverToday;
  const from = params.from ?? params.date ?? today;
  const to = params.to ?? params.date ?? today;

  const range = useSalesRange(from, to);
  // 고정지출은 항목마다 드는 채널이 다르다(수수료는 배달에만). 서버가 비중대로 나눠 준다.
  const chFixed = useChannelFixed(from, to);
  // 기타 매출도 채널이 있다(0093). 채널을 묻기 전에 적은 줄만 미지정으로 남는다.
  const etcCh = useEtcByChannel(from, to);
  const s = range.data?.summary;
  const etcOf = (code: string) => etcCh.data?.byChannel[code]?.amount ?? 0;
  const etcTaxOf = (code: string) => etcCh.data?.byChannel[code]?.tax ?? 0;
  /* 순서는 매장 · 배달앱 · 포장 고정이다(프로토타입). 금액순이면 날마다 자리가 바뀐다. */
  const ORDER: Record<string, number> = { hall: 0, delivery: 1, takeout: 2 };
  const channels = (range.data?.channels ?? [])
    .map((c) => ({ ...c, etc: etcOf(c.code), etcTax: etcTaxOf(c.code) }))
    .filter((c) => c.amount + c.etc > 0)
    .sort((a, b2) => (ORDER[a.code] ?? 9) - (ORDER[b2.code] ?? 9));
  /*
   * ⚠ 배분 분모는 **채널에 귀속된 매출 전부**다. 기타 매출을 빼 놓으면
   *   술을 많이 파는 매장의 고정지출이 배달 쪽으로 쏠린다.
   *   미지정 몫은 여전히 뺀다 — 어느 채널인지 모르니까.
   */
  const assigned = channels.reduce((a, c) => a + c.amount + c.etc, 0);
  const unassigned = etcCh.data?.unassigned ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="채널별 손익" onBack={() => safeBack(`/sales/day?date=${to}`)} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28, gap: 11 }}>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <DetailSummary rows={[['영업일', rangeLabel(from, to)]]} />
        </Card>

        <QueryState
          isLoading={range.isLoading}
          error={range.error}
          isEmpty={channels.length === 0}
          onRetry={() => void range.refetch()}
          emptyTitle="이 기간에 판매 기록이 없어요"
        >
          {channels.map((c) => {
            // 채널에 귀속되지 않는 비용은 **메뉴 매출** 비중으로 나눈다.
            // 기타 매출은 채널이 없으므로 분모에서 뺀다.
            const revenue = c.amount + c.etc;
            const share = assigned > 0 ? revenue / assigned : 0;
            const waste = (s?.wasteLoss ?? 0) * share;
            // 비중 설정이 있으면 그 값, 없으면 서버가 매출 비중으로 계산한 값이 온다.
            const fixed = chFixed.data?.byChannel[c.code] ?? (s?.fixedCost ?? 0) * share;
            const daily = (s?.dailyExtra ?? 0) * share;
            const extraMat = (s?.extraMaterialCost ?? 0) * share;
            const tax = c.tax + c.etcTax;
            const profit = revenue - c.material - extraMat - tax - waste - fixed - daily;
            const rate = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;
            const neg = profit < 0;
            const PR = neg ? T.red : T.green;
            const p = (v: number) => (revenue > 0 ? Math.round((v / revenue) * 1000) / 10 : 0);

            // [라벨, 금액, 배분값인가]
            const costs: [string, number, boolean][] = [
              ['(−) 재료 원가', c.material, false],
              ['(−) 부자재', extraMat, true],
              ['(−) 폐기 손실', waste, true],
              ['(−) 고정 지출', fixed, chFixed.data === undefined],
              ['(−) 추가 지출', daily, true],
              ['(−) 세금', tax, false],
            ];

            return (
              <Card key={c.code} pad={0} style={{ overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: COLOR[c.code] ?? T.sub2 }} />
                  <Text style={{ fontSize: 15, fontWeight: '800', color: T.sub }}>{c.name}</Text>
                </View>
                <View style={{ paddingHorizontal: 14, paddingTop: 5, paddingBottom: 5 }}>
                  <SalesRow label="판매 수량" amount={`${c.qty}개`} strong />
                  <SalesRow
                    label="매출"
                    amount={`${won(revenue)}원`}
                    percent="100%"
                    strong
                  />
                  <SalesRow label="순이익" amount={`${neg ? '−' : ''}${won(Math.abs(profit))}원`} percent={`${rate}%`} strong tone={PR} />
                  {costs.map(([n, v, allocated], k) => (
                    <SalesRow
                      key={n}
                      label={allocated ? `${n} 배분` : n}
                      amount={`${won(v)}원`}
                      percent={`${p(v)}%`}
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
      </ScrollView>
    </View>
  );
}
