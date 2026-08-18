/**
 * SALES-03 일 손익 상세 — 채널 구성 도넛 + 손익 계산(브레이크다운) + 메뉴별 판매량.
 * 구성 블록은 매출 분석(SALES-02)과 공유한다(components/ProfitBlocks) — 이쪽은 하루치를 넣는다.
 */
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { useSalesDay, useSalesRange, type RangeMenu } from '../hooks';
import { ChannelMixCard, MenuSalesList, ProfitBreakdownCard, SecLabel } from '../components/ProfitBlocks';
import { MenuProfitSheet } from '../components/MenuProfitSheet';
import { dayLabel, todayBusiness } from '../period';

export default function SalesDayDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date ?? todayBusiness();

  const day = useSalesDay(date);
  // 메뉴별 집계·채널 구성은 기간 함수가 하루 범위로도 그대로 답한다 — 같은 정의를 두 벌 두지 않는다.
  const range = useSalesRange(date, date);

  const [showAll, setShowAll] = useState(false);
  const [sel, setSel] = useState<RangeMenu | null>(null);

  const summary = day.data?.summary;
  const qty = summary?.qty ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={`${dayLabel(date)} 손익`} onBack={() => safeBack('/sales' as Href)} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24, gap: 11 }}>
        <QueryState
          isLoading={day.isLoading || range.isLoading}
          error={day.error ?? range.error}
          isEmpty={false}
          onRetry={() => { void day.refetch(); void range.refetch(); }}
          emptyTitle=""
        >
          {summary ? (
            <>
              <SecLabel title="채널 구성" onPress={() => router.push(`/sales/channel?from=${date}&to=${date}` as Href)} />
              <ChannelMixCard summary={summary} channels={range.data?.channels ?? []} />

              <SecLabel title="일 손익 계산" onPress={() => router.push(`/sales/day-detail?date=${date}` as Href)} />
              <ProfitBreakdownCard summary={summary} qtyLabel={`${qty}개`} from={date} to={date} />

              <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2, marginTop: 4 }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.sub }}>메뉴별 판매량</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter }}>
                  총 {range.data?.menu.length ?? 0}개 · 판매량순
                </Text>
              </View>
              <MenuSalesList menu={range.data?.menu ?? []} showAll={showAll} onShowAll={() => setShowAll(true)} onSelect={setSel} />
            </>
          ) : null}
        </QueryState>
      </ScrollView>

      {summary ? (
        <MenuProfitSheet sel={sel} summary={summary} periodLabel="오늘" from={date} to={date} onClose={() => setSel(null)} />
      ) : null}
    </View>
  );
}
