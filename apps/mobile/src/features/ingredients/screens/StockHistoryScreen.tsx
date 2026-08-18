// StockHistoryScreen.tsx — ING-07 재고 내역 (재고 변동 원장)
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Icon } from '../../../components/kit';
import { T, tnum } from '../../../theme/tokens';
import { businessDay, formatQuantity } from '@sikjae/core';
import { stockLedger } from '../demoData';
import { safeBack } from '@/lib/nav';
import { useIngredients, fmtStock, type StockEvent } from '../store';
import { LedgerRow } from '../components/LedgerRow';
import { HistoryFilterSheet, type HistoryFilter } from './HistoryFilterSheet';

// 유형 필터 ↔ 원장 act 매칭.
const matchType = (act: string, type: string) => {
  if (type === '전체') return true;
  if (type === '입고') return act.includes('입고');
  if (type === '소진') return act.includes('소진');
  if (type === '조정') return act.includes('조정') || act.includes('폐기');
  return true;
};

/** 원장 이벤트 유형 → 화면 표기. 필터의 '입고/소진/조정' 분류와 문구가 맞아야 한다. */
const ACT_LABEL: Record<StockEvent['type'], string> = {
  inbound: '입고',
  discard: '폐기',
  stocktake: '완전 소진',
  adjust: '수량 조정',
};

/**
 * 기간 필터 → 시작 영업일. 제한 없음이면 null.
 * 선택지는 `HistoryFilterSheet` 의 `['오늘','1개월','3개월','6개월','직접']` 과 **정확히 일치해야 한다**.
 * (직접 지정 UI 는 아직 없어 전체 기간으로 둔다.)
 */
function periodStart(period: string): string | null {
  if (period === '오늘') return businessDay(new Date());
  const days = period === '1개월' ? 30 : period === '3개월' ? 90 : period === '6개월' ? 180 : null;
  if (days === null) return null; // '직접' 등 — 아직 범위 지정 UI 가 없다
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return businessDay(from);
}

/** 'YYYY-MM-DD' → 'M/D' 표기. */
const shortDate = (ymd: string) => {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? `${Number(m[1])}/${Number(m[2])}` : ymd;
};

export function StockHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = useIngredients((s) => s.items);
  const g = items.find((x) => x.id === id) || items[0];

  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>({ period: '3개월', type: '전체', sort: '최신순' });

  // 이 식재료의 **실제 변동 원장**. 데모 상수(stockLedger)는 대파 고정이라 id 와 무관했다.
  const events = useIngredients((s) => s.events);
  const mine = useMemo(() => events.filter((e) => e.ingredientId === g?.id), [events, g?.id]);

  // 기간·유형·정렬을 실제로 적용한다(기존에는 필터가 로직에 연결돼 있지 않았다).
  const rows = useMemo(() => {
    const from = periodStart(filter.period);
    const out = mine
      .filter((e) => (from === null ? true : e.occurredAt >= from))
      .filter((e) => matchType(ACT_LABEL[e.type], filter.type));
    // events 는 최신순으로 쌓인다. '과거순'이면 뒤집는다.
    return filter.sort === '과거순' ? [...out].reverse() : out;
  }, [mine, filter.period, filter.type, filter.sort]);

  // 아직 원장이 비어 있으면(신규 설치·데모) 기존 데모 원장을 참고용으로 보여준다.
  const useDemo = mine.length === 0;
  const months = useMemo(() => {
    if (!useDemo) return [];
    const out = stockLedger
      .map((m) => ({ ...m, rows: m.rows.filter((r) => matchType(r.act, filter.type)) }))
      .filter((m) => m.rows.length > 0);
    if (filter.sort === '과거순') {
      return out.slice().reverse().map((m) => ({ ...m, rows: m.rows.slice().reverse() }));
    }
    return out;
  }, [useDemo, filter.type, filter.sort]);

  // 기간 표기는 필터를 따른다(기존에는 '2026.03.22 ~ 06.21' 고정 문자열이었다).
  const rangeLabel = useMemo(() => {
    const from = periodStart(filter.period);
    const today = businessDay(new Date());
    return from === null ? '전체 기간' : `${from} ~ ${today}`;
  }, [filter.period]);

  const stockStr = g ? fmtStock(g.unit, g.stock) : '-';
  const sm = stockStr.match(/^([\d.]+)(.*)$/);
  const stockBig = sm?.[1] ?? stockStr;
  const stockUnit = sm?.[2] ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title={`${g?.name ?? '재고'} 재고 내역`}
        onBack={() => safeBack()}
        // 원장은 목록이 짧고 필터가 이미 있어 별도 검색이 필요 없다.
        // 무반응 아이콘을 두면 눌러도 아무 일이 없어 오해를 준다 → 필터 열기로 연결한다.
        right={
          <Pressable
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="조회 설정"
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="sort" size={22} color={T.ink2} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {/* 현재 재고 카드 */}
        <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 }}>
          <Card pad={18}>
            <Text style={{ fontSize: 14, color: T.sub2, fontWeight: '600', marginBottom: 6 }}>현재 재고</Text>
            <Text style={tnum}>
              <Text style={{ fontSize: 22, fontWeight: '800', letterSpacing: -1, color: T.ink }}>{stockBig}</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub }}> {stockUnit}</Text>
            </Text>
          </Card>
        </View>

        {/* 기간 필터 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: T.line }}>
          <Text style={[{ flex: 1, fontSize: 14, color: T.sub2, fontWeight: '600' }, tnum]}>{rangeLabel}</Text>
          <Pressable onPress={() => setFilterOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.ink2 }}>{filter.period} · {filter.type} · {filter.sort}</Text>
            <Icon name="chevronDown" size={15} color={T.ter} />
          </Pressable>
        </View>

        {/* 원장 — 이 식재료의 실제 변동 이력 */}
        {!useDemo ? (
          rows.length === 0 ? (
            <View style={{ paddingVertical: 48, alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14, color: T.ter }}>해당 조건의 내역이 없어요</Text>
              <Text style={{ fontSize: 13, color: T.ter }}>기간이나 유형을 바꿔 보세요</Text>
            </View>
          ) : (
            rows.map((e, i) => (
              <LedgerRow
                key={e.id}
                date={shortDate(e.occurredAt)}
                act={ACT_LABEL[e.type]}
                memo={e.note}
                // 폐기는 폐기량을, 나머지는 재고 증감을 보여준다.
                delta={formatQuantity(Math.abs(e.type === 'discard' ? e.volumeDelta : e.countDelta), g!.unit)}
                bal={formatQuantity(e.afterStock, g!.unit)}
                up={e.countDelta > 0}
                px={22}
                last={i === rows.length - 1}
              />
            ))
          )
        ) : months.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: T.ter }}>해당 조건의 내역이 없어요</Text>
          </View>
        ) : (
          <>
            {/* 아직 이 식재료의 변동 기록이 없어 예시를 보여준다 — 실제 내역과 혼동하지 않도록 명시한다. */}
            <View style={{ marginHorizontal: 16, marginTop: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: T.surface2 }}>
              <Text style={{ fontSize: 13, color: T.sub2, fontWeight: '600' }}>아직 변동 기록이 없어요. 아래는 표기 예시예요.</Text>
            </View>
            {months.map((m, mi) => (
              <View key={mi}>
                <Text style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 14, fontSize: 14, fontWeight: '800', color: T.ink2 }}>{m.ym}</Text>
                {m.rows.map((r, i) => (
                  <LedgerRow key={i} date={r.dt} act={r.act} memo={r.memo} delta={r.delta} bal={r.bal} up={r.up} px={22} last={i === m.rows.length - 1} />
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <HistoryFilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} value={filter} onApply={setFilter} />
    </View>
  );
}
