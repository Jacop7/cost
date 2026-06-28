// StockHistoryScreen.tsx — ING-07 재고 내역 (재고 변동 원장)
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Icon } from '../../../components/kit';
import { T, tnum } from '../../../theme/tokens';
import { stockLedger } from '../demoData';
import { safeBack } from '@/lib/nav';
import { useIngredients, fmtStock } from '../store';
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

export function StockHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = useIngredients((s) => s.items);
  const g = items.find((x) => x.id === id) || items[0];

  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>({ period: '3개월', type: '전체', sort: '최신순' });

  // 유형·정렬 적용된 월별 원장.
  const months = useMemo(() => {
    const out = stockLedger
      .map((m) => ({ ...m, rows: m.rows.filter((r) => matchType(r.act, filter.type)) }))
      .filter((m) => m.rows.length > 0);
    if (filter.sort === '과거순') {
      return out.slice().reverse().map((m) => ({ ...m, rows: m.rows.slice().reverse() }));
    }
    return out;
  }, [filter.type, filter.sort]);

  const stockStr = g ? fmtStock(g.unit, g.stock) : '-';
  const sm = stockStr.match(/^([\d.]+)(.*)$/);
  const stockBig = sm?.[1] ?? stockStr;
  const stockUnit = sm?.[2] ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title={`${g?.name ?? '재고'} 재고 내역`}
        onBack={() => safeBack()}
        right={
          <Pressable style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="search" size={22} color={T.ink2} />
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
          <Text style={[{ flex: 1, fontSize: 14, color: T.sub2, fontWeight: '600' }, tnum]}>2026.03.22 ~ 06.21</Text>
          <Pressable onPress={() => setFilterOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.ink2 }}>{filter.period} · {filter.type} · {filter.sort}</Text>
            <Icon name="chevronDown" size={15} color={T.ter} />
          </Pressable>
        </View>

        {/* 원장 */}
        {months.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: T.ter }}>해당 조건의 내역이 없어요</Text>
          </View>
        ) : (
          months.map((m, mi) => (
            <View key={mi}>
              <Text style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 14, fontSize: 14, fontWeight: '800', color: T.ink2 }}>{m.ym}</Text>
              {m.rows.map((r, i) => (
                <LedgerRow key={i} date={r.dt} act={r.act} memo={r.memo} delta={r.delta} bal={r.bal} up={r.up} px={22} last={i === m.rows.length - 1} />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <HistoryFilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} value={filter} onApply={setFilter} />
    </View>
  );
}
