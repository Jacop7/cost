/**
 * SALES-03 일 손익 상세 — 채널 구성 도넛 + 손익 계산(브레이크다운) + 메뉴별 판매량.
 * 구성 블록은 매출 분석(SALES-02)과 공유한다(components/ProfitBlocks) — 이쪽은 하루치를 넣는다.
 */
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Button, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { useSalesDay, useSalesRange, type RangeMenu } from '../hooks';
import { ChannelMixCard, MenuSalesList, ProfitBreakdownCard, SecLabel } from '../components/ProfitBlocks';
import { BusinessDateGate } from '../components/BusinessDateGate';
import { MenuProfitSheet } from '../components/MenuProfitSheet';
import { dayLabel } from '../period';
import { useSalesBusinessDate } from '../businessDay';

/**
 * ⚠ 서버가 정한 장부 날짜를 받고 나서 본체를 붙인다(0125). 앱이 직접 계산하지 않는다.
 *   게이트가 로딩·오류·재시도를 함께 다룬다 — 날짜 조회가 실패하면 예전엔 영원히
 *   "불러오는 중" 만 떴다.
 */
export default function SalesDayDetailScreen() {
  return (
    <BusinessDateGate source={useSalesBusinessDate()} title="일 손익">
      {(serverToday) => <SalesDayDetailScreenBody serverToday={serverToday} />}
    </BusinessDateGate>
  );
}

function SalesDayDetailScreenBody({ serverToday }: { serverToday: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date ?? serverToday;

  const day = useSalesDay(date);
  // 메뉴별 집계·채널 구성은 기간 함수가 하루 범위로도 그대로 답한다 — 같은 정의를 두 벌 두지 않는다.
  const range = useSalesRange(date, date);

  const [showAll, setShowAll] = useState(false);
  const [sel, setSel] = useState<RangeMenu | null>(null);

  const summary = day.data?.summary;
  const qty = summary?.qty ?? 0;

  const d = day.data;
  /** 이 날에 적힌 것이 하나라도 있나. 없으면 §6.4 의 `판매 내역이 없습니다.` 자리다. */
  const hasRecord = Boolean(d && (d.items.length > 0 || d.etcItems.length > 0 || d.extraItems.length > 0));
  /**
   * 정정 화면으로 갈 수 있나.
   * ⚠ **영업 중인 날은 아니다.** 그건 매출관리 홈에서 저장한다 — 여기로 보내면
   *   서버가 45011 로 돌려보내고 사장님은 왜 막혔는지 모른다.
   */
  const canAmend = Boolean(d?.editable && d?.dayStatus !== 'open' && d?.dayStatus !== 'break');

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={`${dayLabel(date, serverToday)} 손익`} onBack={() => safeBack('/sales' as Href)} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24, gap: 11 }}>
        <QueryState
          isLoading={day.isLoading || range.isLoading}
          error={day.error ?? range.error}
          isEmpty={false}
          onRetry={() => { void day.refetch(); void range.refetch(); }}
          emptyTitle=""
        >
          {summary && !hasRecord ? (
            /*
             * §6.4 — 기록이 없는 날은 **경고 카드를 먼저 띄우지 않는다.** 가운데 한 줄만 둔다.
             *   손익 카드를 0원으로 채워 그리면 "장사를 했는데 0원" 인지
             *   "적은 것이 없다" 인지 구별이 안 된다.
             */
            <View style={{ paddingVertical: 72, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: T.ter }}>판매 내역이 없습니다.</Text>
            </View>
          ) : null}

          {summary && hasRecord ? (
            <>
              {/*
                §6.4 — 원가·손익을 **현재 기준**으로 계산한 날에만 붙는다(0149·0153).
                ⚠ 문구를 넓히면 안 된다. 매출과 판매 수량은 사장님이 적은 실제 기록이다 —
                  `전체가 추정` 처럼 말하면 사장님이 자기 기록을 못 믿게 된다.
              */}
              {d?.basisQuality === 'estimated_current' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, backgroundColor: T.amberTint, marginTop: 9 }}>
                  <Icon name="info" size={15} color={T.amberText} />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.amberText, lineHeight: 20 }}>
                    원가·손익은 현재 기준으로 계산했어요
                  </Text>
                </View>
              ) : null}

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

      {/*
        §6.4 — 기록이 있으면 `판매 내역 수정`, 없으면 `판매 내역 추가`. 자리는 하단 고정이다.
        ⚠ 영업 중인 날에는 안 띄운다. 그 날은 매출관리 홈에서 저장한다.
      */}
      {canAmend ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 + insets.bottom, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.line2 }}>
          <Button kind={hasRecord ? 'ghost' : 'primary'} size="lg" full onPress={() => router.push(`/sales/past?date=${date}` as Href)}>
            {hasRecord ? '판매 내역 수정' : '판매 내역 추가'}
          </Button>
        </View>
      ) : null}

      {summary ? (
        <MenuProfitSheet sel={sel} summary={summary} periodLabel="오늘" from={date} to={date} onClose={() => setSel(null)} />
      ) : null}
    </View>
  );
}
