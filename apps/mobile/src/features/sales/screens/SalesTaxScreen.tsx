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
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { LAYOUT, T, TYPE, won, space } from '@/theme/tokens';
import { DetailRow, DetailSection, DetailSummary } from '../components/ProfitBlocks';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { useSalesRange, useTaxBreakdown } from '../hooks';
import { rangeLabel } from '@/lib/date';
import { useSalesBusinessDate } from '@/features/business-day/businessDay';
import { useAppCapabilities, useSalesTaxDetail } from '@/features/international-tax';
import { formatMarketMoney } from '@costkeep/core';
import { percentOfTotal, percentOfTotalText } from '../periodPercent';

/**
 * ⚠ 서버가 정한 장부 날짜를 받고 나서 본체를 붙인다(0125). 앱이 직접 계산하지 않는다.
 *   게이트가 로딩·오류·재시도를 함께 다룬다 — 날짜 조회가 실패하면 예전엔 영원히
 *   "불러오는 중" 만 떴다.
 */
export default function SalesTaxScreen() {
  return (
    <BusinessDateGate source={useSalesBusinessDate()} title="세금 자세히">
      {(serverToday) => <SalesTaxScreenBody serverToday={serverToday} />}
    </BusinessDateGate>
  );
}

function SalesTaxScreenBody({ serverToday }: { serverToday: string }) {
  const { from: f, to: t } = useLocalSearchParams<{ from?: string; to?: string }>();
  const to = t ?? serverToday;
  const from = f ?? to;

  const q = useTaxBreakdown(from, to);
  const range = useSalesRange(from, to);
  const capabilities = useAppCapabilities();
  const internationalEnabled = Boolean(capabilities.data?.internationalTax.readEnabled);
  const international = useSalesTaxDetail(from, to, internationalEnabled);
  const d = q.data;
  const revenue = range.data?.summary.revenue ?? 0;
  const share = percentOfTotal(d?.total ?? 0, revenue);
  const activeLoading = range.isLoading || q.isLoading
    || (internationalEnabled && international.isLoading);
  const activeError = range.error ?? q.error
    ?? (internationalEnabled ? international.error : null);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="세금 자세히" onBack={() => safeBack(`/sales/day?date=${to}`)} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: LAYOUT.scroll.start, paddingBottom: LAYOUT.scroll.end }} showsVerticalScrollIndicator={false}>
        <QueryState
          isLoading={activeLoading}
          error={activeError}
          isEmpty={false}
          onRetry={() => {
            if (internationalEnabled) {
              void Promise.all([international.refetch(), q.refetch(), range.refetch()]);
            } else {
              void Promise.all([q.refetch(), range.refetch()]);
            }
          }}
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
              <View style={{ paddingBottom: 4 }}>
                {d.items.length === 0 ? (
                  <DetailRow name="기록 없음" amount="0원" muted empty last />
                ) : (
                  d.items.map((i, k) => (
                    <DetailRow
                      key={i.name}
                      name={i.name}
                      sub={`매출 ${won(revenue)}원`}
                      amount={`${won(Math.round(i.amount))}원`}
                      percent={percentOfTotalText(i.amount, revenue)}
                      last={k === d.items.length - 1}
                    />
                  ))
                )}
              </View>
            </Card>
          ) : null}
          {internationalEnabled ? <InternationalTaxDetail detail={international.data} revenue={revenue} /> : null}
        </QueryState>
      </ScrollView>
    </View>
  );
}

function InternationalTaxDetail({ detail, revenue }: {
  detail: ReturnType<typeof useSalesTaxDetail>['data']; revenue: number;
}) {
  if (!detail) return null;
  const lines = [
    ...detail.lines.map((line) => ({
      key:`menu:${line.dailySalesItemId}:${line.salesChannelId ?? line.salesChannel}`,name:`${line.menuName} · ${line.salesChannelName}`,
      saleDate:line.saleDate,currencyCode:line.currencyCode,minorUnit:line.minorUnit,taxAmount:line.taxAmount,
      taxProfileRevision:line.taxProfileRevision,componentCount:line.components.length,
      channelNameOrigin:line.salesChannelNameOrigin,
    })),
    ...detail.etcLines.map((line,index) => ({
      key:`etc:${line.dailySalesId}:${index}`,name:`${line.name} · ${line.salesChannelName}`,
      saleDate:line.saleDate,currencyCode:line.currencyCode,minorUnit:line.minorUnit,taxAmount:line.taxAmount,
      taxProfileRevision:line.taxProfileRevision,componentCount:line.components.length,
      channelNameOrigin:line.salesChannelNameOrigin,
    })),
  ];
  if (lines.length === 0) {
    return (
      <Card style={{ marginTop: 12 }}>
        <Text style={{ ...TYPE.body, fontWeight: '800', color: T.ink }}>판매 시점 국제 세금 기록</Text>
        <Text style={{ ...TYPE.captionSm, color: T.sub2, marginTop: 5 }}>
          이 날은 기존 세금 계약으로 기록되어 국제 세금 구성 항목을 추정하지 않아요.
        </Text>
      </Card>
    );
  }
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <DetailSection title="판매 시점 국제 세금" />
      <View style={{ paddingBottom: 4 }}>
        {lines.map((line, index) => {
          const amount = formatMarketMoney(line.taxAmount, line.currencyCode);
          return (
            <DetailRow
              key={line.key}
              name={line.name}
              sub={`${detail.from === detail.to ? '' : `${line.saleDate} · `}프로필 판본 ${line.taxProfileRevision} · ${line.componentCount}개 항목${line.channelNameOrigin === 'upgrade_current_name' ? ' · 채널명 이관 당시 기준' : ''}`}
              amount={amount}
              percent={percentOfTotalText(line.taxAmount, revenue)}
              last={index === lines.length - 1}
            />
          );
        })}
      </View>
    </Card>
  );
}
