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
import { dayLabel } from '../period';
import { useSalesBusinessDate } from '../businessDay';

export default function SalesDayDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  /*
   * ⚠ **서버가 정한 장부 날짜**를 쓴다(0125). 앱이 `+09:00` 고정 오프셋으로 직접
   *   계산하면 앱과 DB 가 각자 오늘을 갖게 된다(기획서 §2.1).
   *   못 받았으면 빈 문자열이고, 그동안 조회가 꺼진다 — 잘못된 날의 숫자보다 낫다.
   */
  const serverToday = useSalesBusinessDate() ?? '';
  const date = params.date ?? serverToday;

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
              {/* '자세히 보기'는 카드 안 맨 아래다(프로토타입 `.channel-more`). 제목엔 안 단다. */}
              <SecLabel title="채널별 매출" />
              <ChannelMixCard
                summary={summary}
                channels={range.data?.channels ?? []}
                onMore={() => router.push(`/sales/channel?from=${date}&to=${date}` as Href)}
              />

              {/*
                ⚠ '자세히 보기'를 달지 않는다. 아래 카드의 **줄마다** 화살표가 있고
                  각각 매출·재료·부자재·폐기·고정·추가·세금 상세로 간다.
                  머리에 하나 더 두면 같은 곳을 두 길로 가게 된다(중복).
              */}
              <SecLabel title="일 손익 계산" />
              <ProfitBreakdownCard summary={summary} qtyLabel={`${qty}개`} from={date} to={date} />

              <SecLabel title="메뉴별 판매량" right={`총 ${range.data?.menu.length ?? 0}개`} />
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
