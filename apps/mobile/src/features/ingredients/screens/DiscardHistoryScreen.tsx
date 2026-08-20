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
import { businessDay, formatQuantity } from '@sikjae/core';
import { T, tnum, won } from '@/theme/tokens';
import { dispUnit } from '../ledger';
import { PeriodSheet, periodRange, type HistoryPeriod } from './HistoryFilterSheet';
import { DISCARD_DELETE_DAYS, useDeleteDiscard, useIngredientDetail, useStockHistory, type LedgerEntry } from '../hooks';

type Tab = '전체' | '조리 전 폐기' | '조리 후 폐기';
const TABS: Tab[] = ['전체', '조리 전 폐기', '조리 후 폐기'];

/** `2026-08` → `2026년 8월`. 월 머리말. */
const monthTitle = (ym: string) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`;

export default function DiscardHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('전체');
  const [period, setPeriod] = useState<HistoryPeriod>('최근 3개월');
  const [periodOpen, setPeriodOpen] = useState(false);

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
    const today = businessDay(new Date());
    if (today === null) return false;
    const days = Math.floor(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${e.date}T00:00:00Z`)) / 86_400_000,
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

  /** 월 머리말로 묶는다. 같은 배열에 섞어 넣어야 스크롤이 자연스럽다. */
  const groups = useMemo(() => {
    const m = new Map<string, LedgerEntry[]>();
    for (const e of shown) {
      const ym = e.date.slice(0, 7);
      const arr = m.get(ym);
      if (arr) arr.push(e);
      else m.set(ym, [e]);
    }
    return [...m.entries()];
  }, [shown]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="폐기 내역" onBack={() => safeBack(`/ingredients/${id}`)} />

      {/* 탭 — 밑줄형, 좌측 정렬 */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: T.line2, backgroundColor: T.surface }}>
        {TABS.map((k) => {
          const on = k === tab;
          const n = k === '전체' ? discards.length : discards.filter((e) => (k === '조리 후 폐기' ? e.waste : !e.waste)).length;
          return (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${k} ${n}건`}
              style={{ paddingVertical: 13, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: on ? T.ink : 'transparent' }}
            >
              <Text style={{ fontSize: 15, fontWeight: on ? '800' : '600', color: on ? T.ink : T.sub2 }}>
                {k}{n > 0 ? ` ${n}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 조건 줄 — 왼쪽 기간, 오른쪽 건수. 재고 내역(ING-08)과 같은 자리·같은 모양이다. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 }}>
        <Pressable
          onPress={() => setPeriodOpen(true)}
          accessibilityRole="button" accessibilityLabel={`기간 ${period} 변경`}
          hitSlop={6}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 }}
        >
          <Icon name="calendar" size={16} color={T.sub} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>{period}</Text>
          <Icon name="chevronDown" size={16} color={T.sub} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter }, tnum]}>{shown.length}건</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 14 }}>
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
          {/* 합계 — 머리에 수량, 아래 금액. 재고 내역 요약 카드와 같은 짜임이다. */}
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>{tab} 합계</Text>
              <Text style={[{ fontSize: 17, fontWeight: '800', color: T.ink }, tnum]}>
                {formatQuantity(shownAmount, unit)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15 }}>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.ter }}>폐기 금액</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, tnum]}>
                {shownCost === null ? '단가 산출 전' : `${won(Math.round(shownCost))}원`}
              </Text>
            </View>
          </Card>

          {groups.map(([ym, list]) => (
            <View key={ym}>
              <Text style={{ marginHorizontal: 6, marginBottom: 7, fontSize: 14, fontWeight: '700', color: T.sub }}>
                {monthTitle(ym)}
              </Text>
              {/* 줄마다 카드를 쓰면 목록이 아니라 더미가 된다 — 한 장에 구분선. */}
              <Card pad={0} style={{ overflow: 'hidden' }}>
                {list.map((e, i) => (
                  <View
                    key={e.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                      paddingVertical: 13, paddingLeft: 15, paddingRight: 12,
                      borderBottomWidth: i < list.length - 1 ? 1 : 0, borderBottomColor: T.line2,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[{ fontSize: 13, color: T.ter, fontWeight: '600' }, tnum]}>
                          {e.date.slice(5).replace('-', '/')}
                        </Text>
                        <Badge tone={e.waste ? 'amber' : 'neutral'} sm>
                          {e.waste ? '조리 후' : '조리 전'}
                        </Badge>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink, marginTop: 5 }} numberOfLines={1}>
                        {e.note ?? (e.waste ? '조리 후 폐기' : '조리 전 폐기')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[{ fontSize: 16, fontWeight: '800', color: T.red }, tnum]}>
                        −{formatQuantity(Math.abs(e.countDelta), unit)}
                      </Text>
                      {price !== null ? (
                        <Text style={[{ fontSize: 13, color: T.sub, marginTop: 3 }, tnum]}>
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
