/**
 * ING-10 폐기 내역 — 로스율 카드의 드릴다운.
 *
 * 왜 탭으로 가르나: 두 폐기는 사장님이 할 일이 다르다.
 *   조리 전 폐기가 많다 → 발주를 줄이거나 보관을 손봐야 한다
 *   조리 후 폐기가 많다 → 덜 만들어야 한다
 * 한 숫자로 뭉치면 어느 쪽을 손봐야 할지 알 수 없다.
 *
 * ⚠ 여기서는 **읽기만 한다.** 폐기 되돌리기는 없앴다 — 잘못 찍었으면 재고 수정(E5)으로
 *   맞추면 된다. 되돌리기와 재고 수정이 나란히 있으면 같은 일을 두 길로 하게 되고,
 *   어느 쪽이 원장에 무엇을 남기는지 사장님이 알 수가 없다.
 *   폐기 기록 자체는 남으므로 로스율에도 그대로 잡힌다.
 *   그래서 '취소됨' 표시도 없다 — 상쇄되는 폐기가 생기지 않는다.
 */
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Badge, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatQuantity } from '@sikjae/core';
import { T, tnum, won } from '@/theme/tokens';
import { dispUnit } from '../ledger';
import { PeriodSheet, periodRange, type HistoryPeriod } from './HistoryFilterSheet';
import { useStoreLocalDate } from '@/features/sales/businessDay';
import { BusinessDateGate } from '@/features/sales/components/BusinessDateGate';
import { ConditionRow, FilterButton, MonthHead, SummaryCard, groupByMonth, historyContent, monthTitle } from '../components/HistoryLayout';
import { DISCARD_DELETE_DAYS, useDeleteDiscard, useIngredientDetail, useStockHistory, type LedgerEntry } from '../hooks';

type Tab = '전체' | '조리 전 폐기' | '조리 후 폐기';
const TABS: Tab[] = ['전체', '조리 전 폐기', '조리 후 폐기'];

/**
 * ⚠ 여기는 **날짜가 표시가 아니라 권한**이다(0125). 아래 `canDelete` 가 폐기 삭제
 *   허용 여부를 날짜로 정한다. 앱이 `businessDay(new Date())` 로 직접 계산하면
 *   서버가 막는 경계(0086)와 달라져, 사장님 화면에는 지울 수 있다고 나오는데
 *   눌러도 거부되거나 그 반대가 된다.
 *   그래서 **매장 현지 날짜**를 서버에서 받고 나서 본체를 붙인다.
 */
export default function DiscardHistoryScreen() {
  return (
    <BusinessDateGate source={useStoreLocalDate()} title="폐기 내역">
      {(localDate) => <DiscardHistoryBody localDate={localDate} />}
    </BusinessDateGate>
  );
}

function DiscardHistoryBody({ localDate }: { localDate: string }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('전체');
  const [period, setPeriod] = useState<HistoryPeriod>('최근 3개월');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [tabOpen, setTabOpen] = useState(false);

  const detail = useIngredientDetail(id);
  const history = useStockHistory(id, periodRange(period));
  const deleteDiscard = useDeleteDiscard(id ?? '');
  const [menuFor, setMenuFor] = useState<LedgerEntry | null>(null);

  const g = detail.data;
  const unit = dispUnit(g?.baseUnit ?? 'g');
  const price = g?.basePrice ?? null;

  /*
   * 폐기만 추린다. **지운 폐기는 여기서 사라진다** —
   * '삭제'라 해 놓고 취소선 그은 줄이 남으면 지운 게 아니다.
   * 원장은 그대로다. 재고 변동 내역에서 '(취소됨)' 으로 볼 수 있다.
   */
  const discards = useMemo(
    () => (history.data ?? []).filter((e) => e.type === 'discard' && !e.reverted),
    [history.data],
  );

  /**
   * 지울 수 있는 줄인가. 조리 후 폐기는 **매출이 주인**이라 여기서 못 고치고,
   * 7일이 지난 건 이미 월 손익·로스율의 근거로 굳었다.
   * ⚠ 이건 안내일 뿐이다 — 진짜 경계는 서버(0086)가 막는다.
   */
  const canDelete = (e: LedgerEntry) => {
    if (e.waste) return false;
    // ⚠ 서버가 준 매장 현지 날짜를 쓴다(0125). 앱이 계산하면 서버 경계와 갈린다.
    const days = Math.floor(
      (Date.parse(`${localDate}T00:00:00Z`) - Date.parse(`${e.date}T00:00:00Z`)) / 86_400_000,
    );
    return days >= 0 && days < DISCARD_DELETE_DAYS;
  };

  const confirmDelete = (e: LedgerEntry) => {
    Alert.alert(
      '폐기 삭제',
      `${formatQuantity(Math.abs(e.countDelta), unit)} 폐기를 지워요. 재고가 폐기 전으로 돌아가고 로스율에서도 빠집니다.`,
      [
        { text: '닫기', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () =>
            deleteDiscard.mutate(
              { eventId: e.id },
              {
                onError: (err) =>
                  Alert.alert('지우지 못했어요', err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요'),
              },
            ),
        },
      ],
    );
  };

  const shown = useMemo(() => {
    if (tab === '조리 전 폐기') return discards.filter((e) => !e.waste);
    if (tab === '조리 후 폐기') return discards.filter((e) => e.waste);
    return discards;
  }, [discards, tab]);

  /* 탭별 합계. discards 에서 지운 폐기가 이미 빠져 있어 서버 로스율과 같은 값이 된다. */
  const sum = (rows: LedgerEntry[]) =>
    rows.reduce((a, e) => a + Math.abs(e.countDelta), 0);

  const shownAmount = sum(shown);
  const shownCost = price === null ? null : shownAmount * price;

  const groups = groupByMonth(shown, (e) => e.date);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="폐기 내역" onBack={() => safeBack(`/ingredients/${id}`)} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={historyContent}>
        {/* 조건 줄 — 목록과 함께 스크롤된다(프로토타입 `.content`). */}
        <ConditionRow>
          <FilterButton label={tab} onPress={() => setTabOpen(true)} />
          <FilterButton label={period} onPress={() => setPeriodOpen(true)} />
        </ConditionRow>

        <QueryState
          isLoading={history.isLoading}
          error={history.error}
          isEmpty={shown.length === 0}
          onRetry={() => void history.refetch()}
          emptyTitle={tab === '전체' ? '아직 폐기 기록이 없어요' : `${tab} 기록이 없어요`}
          emptyHint={
            tab === '조리 후 폐기'
              ? '매출 등록에서 못 판 수량을 적으면 여기 쌓여요'
              : '식재료 상세에서 남은 양을 고치면 폐기로 기록돼요'
          }
        >
          {/* 합계 — 머리에 수량·금액. 다섯 화면이 같은 요약 카드를 쓴다. */}
          <SummaryCard
            label={`${tab} 합계`}
            value={formatQuantity(shownAmount, unit)}
            sub={shownCost === null ? '단가 산출 전' : `${won(Math.round(shownCost))}원`}
          />

          {groups.map(([ym, list], gi) => (
            <View key={ym}>
              <MonthHead month={monthTitle(ym)} count={list.length} first={gi === 0} />
              {/* 줄마다 카드를 쓰면 목록이 아니라 더미가 된다 — 한 장에 구분선. */}
              <Card pad={0} style={{ overflow: 'hidden', marginBottom: 12 }}>
                {list.map((e, i) => (
                  <View
                    key={e.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                      minHeight: 72, paddingVertical: 12, paddingLeft: 14, paddingRight: 12,
                      borderBottomWidth: i < list.length - 1 ? 1 : 0, borderBottomColor: T.line2,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[{ fontSize: 12, color: T.ter, fontWeight: '700' }, tnum]}>
                          {e.date.slice(5).replace('-', '/')}
                        </Text>
                        <Badge tone={e.waste ? 'amber' : 'neutral'} sm>
                          {e.waste ? '조리 후' : '조리 전'}
                        </Badge>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: T.ink, marginTop: 4 }} numberOfLines={1}>
                        {e.note ?? (e.waste ? '조리 후 폐기' : '조리 전 폐기')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[{ fontSize: 15, fontWeight: '800', color: T.red }, tnum]}>
                        −{formatQuantity(Math.abs(e.countDelta), unit)}
                      </Text>
                      {price !== null ? (
                        <Text style={[{ fontSize: 12, color: T.ter, fontWeight: '700', marginTop: 3 }, tnum]}>
                          {won(Math.round(Math.abs(e.countDelta) * price))}원
                        </Text>
                      ) : null}
                    </View>
                    {/*
                      ⋮ — 지울 수 있는 줄에만 나온다(조리 전 · 7일 이내).
                      자리는 항상 비워 둔다. 있고 없고에 따라 오른쪽 숫자가 밀리면
                      같은 목록이 줄마다 다르게 보인다.
                    */}
                    <View style={{ width: 27, alignItems: 'center' }}>
                      {canDelete(e) ? (
                        <Pressable
                          onPress={() => setMenuFor(e)}
                          accessibilityRole="button" accessibilityLabel="더보기"
                          hitSlop={8}
                          style={{ width: 27, height: 40, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Icon name="more" size={19} color={T.ter} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          ))}
        </QueryState>
      </ScrollView>

      {/* 유형 선택 — 기간 시트와 같은 하단 시트. 같은 자리에서 같은 모양이어야 한다. */}
      <Modal visible={tabOpen} transparent animationType="fade" onRequestClose={() => setTabOpen(false)} statusBarTranslucent>
        <Pressable onPress={() => setTabOpen(false)} accessibilityRole="button" accessibilityLabel="닫기" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: T.scrim }}>
          <View onStartShouldSetResponder={() => true} style={{ backgroundColor: T.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 26 }}>
            <View style={{ alignItems: 'center', paddingBottom: 12 }}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: T.line }} />
            </View>
            <Text style={{ fontSize: 19, fontWeight: '800', color: T.ink, marginBottom: 14 }}>유형</Text>
            {TABS.map((k) => {
              const on = k === tab;
              const n = k === '전체' ? discards.length : discards.filter((e) => (k === '조리 후 폐기' ? e.waste : !e.waste)).length;
              return (
                <Pressable
                  key={k}
                  onPress={() => { setTab(k); setTabOpen(false); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${k} ${n}건`}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: T.line2 }}
                >
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: on ? '800' : '600', color: on ? T.blue : T.ink }}>{k}</Text>
                  <Text style={[{ fontSize: 14, color: T.ter, marginRight: 8 }, tnum]}>{n}건</Text>
                  {on ? <Icon name="check" size={18} color={T.blue} sw={2.4} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      <PeriodSheet
        visible={periodOpen}
        value={period}
        onClose={() => setPeriodOpen(false)}
        onApply={(p) => { setPeriod(p); setPeriodOpen(false); }}
      />

      {/* 삭제 메뉴 — 구매 옵션 수정과 같은 하단 시트 */}
      <Modal visible={menuFor !== null} transparent animationType="fade" onRequestClose={() => setMenuFor(null)} statusBarTranslucent>
        <Pressable onPress={() => setMenuFor(null)} accessibilityRole="button" accessibilityLabel="메뉴 닫기" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: T.scrim }}>
          {/* 시트 본문 탭이 배경까지 전달돼 닫히지 않게 여기서 삼킨다. */}
          <View onStartShouldSetResponder={() => true} style={{ backgroundColor: T.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 16 }}>
            <View style={{ alignItems: 'center', paddingBottom: 14 }}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: T.line }} />
            </View>
            <View style={{ backgroundColor: T.surface2, borderRadius: 14, overflow: 'hidden', marginBottom: 9 }}>
              <Pressable
                onPress={() => { const t = menuFor; setMenuFor(null); if (t) confirmDelete(t); }}
                accessibilityRole="button" accessibilityLabel="폐기 삭제"
                style={{ paddingVertical: 20, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: T.red }}>삭제</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setMenuFor(null)} accessibilityRole="button" accessibilityLabel="닫기" style={{ paddingVertical: 20, borderRadius: 14, backgroundColor: T.surface2, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: T.ink }}>닫기</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
