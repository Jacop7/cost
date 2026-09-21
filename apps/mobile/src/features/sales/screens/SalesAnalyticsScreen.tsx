/**
 * SALES-02 매출 분석 — 기간 선택 기준의 손익 한 장.
 *
 * 구성: 기간 칩 → 손익 계산 → 채널별 매출 → 메뉴별 판매량.
 * 아래 세 블록은 일 손익 상세(SALES-03)와 같은 구성이고, 넣는 수치만 기간 집계로 바뀐다.
 *
 * 캘린더 숫자는 **그날의 실제 순이익**이다(sales_range.daily). 기간 합계를 비례 확대해
 * 그리면 캘린더를 더한 값과 아래 손익표가 어긋난다 — 그렇게 하지 않는다.
 */
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { FilterButton, HubHeader, QueryState } from '@/components/kit';
import { LAYOUT, COLOR, COMPONENT, T, space } from '@/theme/tokens';
import { useSalesRange } from '../hooks';
import { ChannelMixCard, MenuSalesList, ProfitBreakdownCard, SecLabel } from '../components/ProfitBlocks';
import { rangeLabel } from '@/lib/date';
import { useSalesBusinessDate } from '@/features/business-day/businessDay';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { SalesSectionTabs } from '../components/SalesSectionTabs';
import { SalesPeriodSheet, type SalesPeriodRange } from '../components/SalesPeriodSheet';

const NUM = { fontVariant: ['tabular-nums' as const] };
/**
 * ⚠ 이 화면만 **감싸는 층**이 필요하다.
 *
 * 다른 조회 화면은 날짜를 조회 인자로만 쓰므로 빈 값이면 조회가 꺼지고 끝이다.
 * 그런데 여기는 `useState(today)` 로 **상태를 씨앗 삼는다**(달력 기준월).
 * 훅은 조건부로 못 부르니, 빈 날짜로 한 번 렌더되면 그 빈 값이 상태에 굳어
 * 나중에 서버 날짜가 와도 안 바뀐다.
 *
 * 그래서 날짜를 받은 **뒤에** 본체를 처음 붙인다. 본체는 날짜를 prop 으로 받으므로
 * 그 안의 훅들은 언제나 진짜 날짜를 본다.
 *
 * ⚠ 게이트가 `key={date}` 로 **날짜가 바뀌면 본체를 다시 만든다.** 화면을 열어 둔 채
 *   자정을 넘기거나 영업일이 바뀌면 `monthAnchor` 가 옛 날짜에 남기 때문이다.
 */
export default function SalesAnalyticsScreen() {
  return (
    <BusinessDateGate
      source={useSalesBusinessDate()}
      title="매출관리"
    >
      {(today) => <SalesAnalyticsBody today={today} />}
    </BusinessDateGate>
  );
}

function SalesAnalyticsBody({ today }: { today: string }) {
  const [active, setActive] = useState<SalesPeriodRange>({ mode: 'day', from: today, to: today });
  const [periodOpen, setPeriodOpen] = useState(false);

  const router = useRouter();
  const [showAll, setShowAll] = useState(false);

  const activeLabel = rangeLabel(active.from, active.to);
  const activeModeLabel = active.mode === 'month' ? '월간' : '일간';

  const range = useSalesRange(active.from, active.to);
  const s = range.data?.summary;

  const dayCount = s?.days ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <HubHeader title="매출관리" />
      <SalesSectionTabs active="analytics" />

      {/* 매출 작성 목록의 `최신순`과 같은 헤더 아래 필터 기준선에 둔다. */}
      <View style={{ paddingHorizontal: 16, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View testID="sales-period-filter-touch-boundary" style={{ paddingVertical: COMPONENT.filterChip.hitSlop }}>
          <FilterButton label={`${activeModeLabel}, ${activeLabel}`} onPress={() => setPeriodOpen(true)} />
        </View>
        <View style={{ flex: 1 }} />
        {dayCount > 1 ? (
          <Text style={[{ fontSize: 13, fontWeight: '700', color: COLOR.text.tertiary }, NUM]}>{dayCount}일</Text>
        ) : null}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: LAYOUT.scroll.start, paddingBottom: 24, gap: space.md }}>
        <QueryState
          isLoading={range.isLoading}
          error={range.error}
          isEmpty={false}
          onRetry={() => void range.refetch()}
          emptyTitle=""
        >
          {s ? (
            <>
              <SecLabel title="손익 계산" />
              <ProfitBreakdownCard
                summary={s}
                qtyLabel={dayCount > 1 ? `${dayCount}일 · ${s.qty}개` : `${s.qty}개`}
                from={active.from}
                to={active.to}
                profitFirst
                blackAmounts
              />

              {/* '자세히 보기'는 카드 안 맨 아래다(프로토타입 `.channel-more`). */}
              <SecLabel title="채널별 매출" />
              <ChannelMixCard
                summary={s}
                channels={range.data?.channels ?? []}
                onMore={() => router.push(`/sales/channel?from=${active.from}&to=${active.to}` as Href)}
              />

              <SecLabel title="메뉴별 판매량" right={`총 ${range.data?.menu.length ?? 0}개`} />
              <MenuSalesList
                menu={range.data?.menu ?? []}
                totalRevenue={s.revenue}
                showAll={showAll}
                onShowAll={() => setShowAll(true)}
                onSelect={(menu) => {
                  if (!menu.recipeId) return;
                  router.push(`/sales/menu?recipe=${menu.recipeId}&from=${active.from}&to=${active.to}` as Href);
                }}
              />
            </>
          ) : null}
        </QueryState>
      </ScrollView>

      <SalesPeriodSheet visible={periodOpen} today={today} value={active}
        onClose={() => setPeriodOpen(false)}
        onApply={(next) => { setActive(next); setPeriodOpen(false); }} />
    </View>
  );
}
