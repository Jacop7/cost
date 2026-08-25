/**
 * SALES-18 세금 자세히 — 프로토타입 `?screen=tax` 규격.
 *
 * ⚠ 요율은 **판 날 기준**이다. 지금 요율로 다시 곱하면 MY > 세금 을 한 번
 *   고칠 때마다 지난달 장부가 통째로 움직인다.
 *
 * ⚠ 0097 에서 프로토타입에 맞췄다. 카드 셋(총액·항목별·무엇에 붙었나)에 문단까지
 *   있던 걸 **카드 하나**로 줄였다. 항목 줄이 이미 `매출 669,000원`과 `9.09%`를
 *   달고 있어서 '무엇에 붙었나'를 따로 말할 필요가 없다.
 */
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { DetailRow, DetailSection, DetailSummary } from '../components/ProfitBlocks';
import { useSalesRange, useTaxBreakdown } from '../hooks';
import { rangeLabel } from '../period';
import { useSalesBusinessDate } from '../businessDay';

/** 9.0909090909 → `9.09%`. 화면은 두 자리면 충분하다. */
const pct2 = (v: number) => `${(Math.round(v * 100) / 100).toFixed(2)}%`;

export default function SalesTaxScreen() {
  const { from: f, to: t } = useLocalSearchParams<{ from?: string; to?: string }>();
  /*
   * ⚠ **서버가 정한 장부 날짜**를 쓴다(0125). 앱이 `+09:00` 고정 오프셋으로 직접
   *   계산하면 앱과 DB 가 각자 오늘을 갖게 된다(기획서 §2.1).
   *   못 받았으면 빈 문자열이고, 그동안 조회가 꺼진다 — 잘못된 날의 숫자보다 낫다.
   */
  const serverToday = useSalesBusinessDate() ?? '';
  const to = t ?? serverToday;
  const from = f ?? to;

  const q = useTaxBreakdown(from, to);
  const range = useSalesRange(from, to);
  const d = q.data;

  const revenue = range.data?.summary.revenue ?? 0;
  const share = revenue > 0 ? Math.round(((d?.total ?? 0) / revenue) * 1000) / 10 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="세금 자세히" onBack={() => safeBack(`/sales/day?date=${to}`)} />

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
                  ['세금 합계', `${won(Math.round(d.total))}원`],
                  ['매출 대비', `${share}%`],
                ]}
              />

              <DetailSection title="항목별" />
              <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
                {d.items.length === 0 ? (
                  <DetailRow name="기록 없음" amount="0원" muted last />
                ) : (
                  d.items.map((i, k) => (
                    <DetailRow
                      key={i.name}
                      name={i.name}
                      sub={`매출 ${won(revenue)}원`}
                      amount={`${won(Math.round(i.amount))}원`}
                      percent={pct2(i.rate)}
                      last={k === d.items.length - 1}
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
