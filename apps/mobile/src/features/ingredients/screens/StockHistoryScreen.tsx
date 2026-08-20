/**
 * ING-07 재고 변동 내역 — 원장 전체. 월별로 묶고, 조회 설정(ING-08)으로 기간·종류를 좁힌다.
 *
 * 잔량은 서버가 누적해 준다(stock_history.balance). 앱이 종류별로 다시 더하면
 * 입고·소진·폐기·실사의 부호 규칙을 앱도 알아야 하고, 그 규칙이 두 벌이 된다.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Icon, QueryState } from '../../../components/kit';
import { T, tnum } from '../../../theme/tokens';
import { formatQuantity } from '@sikjae/core';
import { safeBack } from '@/lib/nav';
import { LedgerRow } from '../components/LedgerRow';
import { HistoryFilterSheet, periodRange, type HistoryFilter } from './HistoryFilterSheet';
import { dispUnit, toLedgerView, type LedgerType } from '../ledger';
import { useIngredientDetail, useStockHistory, type LedgerEntry } from '../hooks';

/** 유형 칩 → 원장 종류. '조정'은 실사(E5)와 판매 취소 보정을 함께 본다. */
const KIND_TYPES: Record<string, LedgerType[] | null> = {
  전체: null,
  입고: ['inbound'],
  소진: ['consume'],
  폐기: ['discard'],
  조정: ['stocktake', 'adjust'],
};
const KINDS = Object.keys(KIND_TYPES);

/** 합계 한 칸의 표기. 0 이면 부호를 떼고 그냥 `0g` 이라고 쓴다. */
const signed = (v: number, unit: 'g' | 'ml' | '개', sign: '+' | '−') =>
  Math.abs(v) < 0.0001 ? formatQuantity(0, unit) : `${sign}${formatQuantity(v, unit)}`;

export function StockHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [filter, setFilter] = useState<HistoryFilter>({ period: '최근 3개월', kind: '전체', order: '최신순' });
  const [filterOpen, setFilterOpen] = useState(false);

  const detail = useIngredientDetail(id);
  const history = useStockHistory(id, periodRange(filter.period));
  const g = detail.data;
  const unit = g ? dispUnit(g.baseUnit) : 'g';

  const rows = useMemo(() => {
    const types = KIND_TYPES[filter.kind] ?? null;
    const list = (history.data ?? []).filter((e) => (types ? types.includes(e.type) : true));
    // 서버는 최신순으로 준다. '오래된순'이면 뒤집기만 하면 된다 — 잔량은 이미 계산돼 있다.
    return filter.order === '오래된순' ? [...list].reverse() : list;
  }, [history.data, filter.kind, filter.order]);

  /** 월별 그룹 — 'YYYY-MM' → 항목. */
  const groups = useMemo(() => {
    const m = new Map<string, LedgerEntry[]>();
    for (const e of rows) {
      const ym = e.date.slice(0, 7);
      const arr = m.get(ym);
      if (arr) arr.push(e);
      else m.set(ym, [e]);
    }
    return [...m.entries()];
  }, [rows]);

  /*
   * 기간 합계 — 원장의 **유형 그대로**, 그리고 **빠짐없이** 센다.
   *
   * ⚠ 부호로 세면 안 된다. '나간 양' 한 칸에 폐기·조정 감소까지 삼키면,
   *   바로 아래 줄에는 '폐기'가 따로 적혀 있어서 같은 폐기가 위에서는 소진으로
   *   아래에서는 폐기로 읽힌다.
   * ⚠ 그렇다고 빼 버려도 안 된다. 그러면 `입고 − 소진` 이 재고 증감과 안 맞아
   *   사장님이 대조할 수가 없다. 이름을 붙여서 **다 보여준다.**
   *
   *   시작 재고 + 입고 − 소진 − 폐기 ± 조정 = 현재 재고
   *
   * 유형 칩(전체/입고/소진/폐기/조정)과 같은 갈래를 쓴다.
   */
  const totals = useMemo(() => {
    let inbound = 0;
    let consume = 0;
    let discard = 0;
    let adjust = 0;   // 실사·조정은 늘 수도 줄 수도 있어 **순증감**으로 둔다
    for (const e of rows) {
      if (e.type === 'inbound') inbound += Math.max(e.countDelta, 0);
      else if (e.type === 'consume') consume += Math.max(-e.countDelta, 0);
      else if (e.type === 'discard') discard += Math.max(-e.countDelta, 0);
      else adjust += e.countDelta;
    }
    return { inbound, consume, discard, adjust };
  }, [rows]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title={g ? `${g.name} 재고 내역` : '재고 내역'}
        onBack={() => safeBack(`/ingredients/${id}`)}
        right={
          <Pressable
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button" accessibilityLabel="조회 설정"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 8 }}
          >
            <Icon name="sort" size={19} color={T.ink2} />
            <Text style={{ color: T.ink2, fontSize: 16, fontWeight: '700' }}>조회</Text>
          </Pressable>
        }
      />

      {/* 선택된 조건 요약 — 왜 이만큼만 보이는지 알 수 있어야 한다. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingBottom: 10 }}>
        <Text style={{ fontSize: 14, color: T.sub2, fontWeight: '600' }}>
          {filter.period} · {filter.kind} · {filter.order}
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600' }, tnum]}>{rows.length}건</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, gap: 11 }} showsVerticalScrollIndicator={false}>
        <QueryState
          isLoading={history.isLoading || detail.isLoading}
          error={history.error ?? detail.error}
          isEmpty={rows.length === 0}
          onRetry={() => { void history.refetch(); void detail.refetch(); }}
          emptyTitle="이 조건에 맞는 기록이 없어요"
          emptyHint="조회 설정에서 기간이나 종류를 넓혀 보세요"
        >
          {/* 요약 */}
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>현재 재고</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, tnum]}>
                {g ? formatQuantity(g.stockTotal, unit) : '—'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', paddingVertical: 13, paddingHorizontal: 15, gap: 12 }}>
              {/*
                네 갈래를 **항상** 같은 자리에 둔다. 0 이라고 감추면 칸이 들쭉날쭉해서
                어제 화면과 오늘 화면을 눈으로 못 겹친다. 부호만 값이 있을 때 붙인다 —
                '−0g' 은 아무 말도 아니다.
              */}
              {([
                ['입고', signed(totals.inbound, unit, '+'), T.blue],
                ['소진', signed(totals.consume, unit, '−'), T.red],
                ['폐기', signed(totals.discard, unit, '−'), T.red],
                ['조정', signed(Math.abs(totals.adjust), unit, totals.adjust >= 0 ? '+' : '−'), T.sub2],
              ] as const)
                .map(([label, value, color]) => (
                  <View key={label} style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}>{label}</Text>
                    <Text style={[{ fontSize: 15, fontWeight: '800', color, marginTop: 2 }, tnum]} numberOfLines={1}>
                      {value}
                    </Text>
                  </View>
                ))}
            </View>
          </Card>

          {groups.map(([ym, list]) => (
            <View key={ym}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub, marginHorizontal: 6, marginBottom: 7 }}>
                {ym.slice(0, 4)}년 {Number(ym.slice(5))}월
              </Text>
              <Card pad={0} style={{ overflow: 'hidden' }}>
                {list.map((e, i) => {
                  const v = toLedgerView(e, g?.baseUnit ?? 'g');
                  return (
                    /*
                     * ⚠ 여기서는 아무것도 눌리지 않는다. 이 화면은 입고·소진·폐기·조정이
                     *   **섞인 원장**이라, 폐기 줄만 몰래 눌려 되돌아가면 사장님은
                     *   어느 줄이 눌리는지 알 길이 없다. 폐기 되돌리기는 폐기 내역(ING-10)
                     *   한 곳에서만 한다.
                     */
                    <LedgerRow
                      key={v.id}
                      date={v.date}
                      /*
                       * ⚠ '(취소됨)' 은 여기만 남는다. 이 화면은 입고도 보여 주는데
                       *   **입고 취소(E11)는 그대로 살아 있다**(발주 화면의 '입고 취소').
                       *   폐기 전용 화면에서는 뺐다 — 폐기는 이제 상쇄될 일이 없다.
                       */
                      act={e.reverted ? `${v.label} (취소됨)` : v.label}
                      memo={v.memo}
                      delta={v.delta}
                      bal={v.balance}
                      up={v.up}
                      px={15}
                      last={i === list.length - 1}
                    />
                  );
                })}
              </Card>
            </View>
          ))}
        </QueryState>
      </ScrollView>

      <HistoryFilterSheet
        visible={filterOpen}
        value={filter}
        kinds={KINDS}
        onApply={(next) => { setFilter(next); setFilterOpen(false); }}
        onClose={() => setFilterOpen(false)}
      />
    </View>
  );
}
