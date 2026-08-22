/**
 * ING-09 구매 이력 전체 — 식재료 상세의 '자세히 보기'.
 *
 * 상세 화면은 최근 6건만 보여준다. 단가가 언제부터 올랐는지 보려면 잘리지 않은
 * 목록이 필요하다. 재고 변동 내역에는 이미 전체 보기가 있는데 구매 이력에만
 * 없어 짝이 맞지 않았다(0044).
 *
 * 여기 단가는 **그날 그 값**이다. 식재료 상세의 기준단가는 실입고량 가중평균이라
 * 다른 값이 나온다 — 그래서 최고·최저와 함께 보여 어디쯤인지 알 수 있게 한다.
 */
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Badge, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatQuantity, formatUnitPrice } from '@sikjae/core';
import { T, tnum, won } from '@/theme/tokens';
import { packSummary } from '@/lib/num';
import { dispUnit } from '../ledger';
import { PeriodSheet, periodRange, type HistoryPeriod } from './HistoryFilterSheet';
import { ConditionRow, FilterButton, MonthHead, SummaryCard, groupByMonth, monthTitle } from '../components/HistoryLayout';
import { useIngredientDetail, usePurchaseHistory, type PurchaseRow } from '../hooks';

const STATUS: Record<PurchaseRow['status'], { label: string; tone: 'blue' | 'amber' | 'neutral' | 'green' }> = {
  ordered: { label: '입고 대기', tone: 'blue' },
  partial: { label: '부분 입고', tone: 'amber' },
  received: { label: '입고 완료', tone: 'green' },
  canceled: { label: '취소', tone: 'neutral' },
};

export default function PurchaseHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [period, setPeriod] = useState<HistoryPeriod>('최근 3개월');
  const [periodOpen, setPeriodOpen] = useState(false);

  const detail = useIngredientDetail(id);
  const purchases = usePurchaseHistory(id, periodRange(period));

  const g = detail.data;
  const unit = dispUnit(g?.baseUnit ?? 'g');
  const rows = purchases.data ?? [];

  /** 단가 범위 — 이번 건이 비싼 편인지 싼 편인지 보려면 기준이 필요하다. */
  const range = useMemo(() => {
    const ps = rows.map((r) => r.unitPrice).filter((v): v is number => v !== null);
    if (ps.length === 0) return null;
    return { low: Math.min(...ps), high: Math.max(...ps) };
  }, [rows]);

  /** 실제로 들어온 것만 센다 — 대기·취소는 아직 산 게 아니다. */
  const received = rows.filter((r) => r.status === 'received' || r.status === 'partial');
  const spent = received.reduce((a, r) => a + r.amount * (r.receivedQty ?? 0), 0);

  const groups = groupByMonth(rows, (r) => r.orderedAt);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="구매 이력" onBack={() => safeBack(`/ingredients/${id}`)} />

      {/* 조건 줄 — 다섯 내역 화면이 같은 자리·같은 모양이다. */}
      <ConditionRow>
        <FilterButton label={period} onPress={() => setPeriodOpen(true)} />
      </ConditionRow>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 14 }}>
        <QueryState
          isLoading={purchases.isLoading}
          error={purchases.error}
          isEmpty={rows.length === 0}
          onRetry={() => void purchases.refetch()}
          emptyTitle="아직 구매 기록이 없어요"
          emptyHint="발주 → 입고를 등록하면 여기에 쌓여요"
        >
          {/*
            머리는 **기준단가**다 — 이 화면에서 사장님이 답을 얻고 싶은 하나.
            아래 두 칸이 "이번에 산 게 싼 편인지 비싼 편인지"의 기준이 된다.
          */}
          <SummaryCard
            label="기준단가"
            value={g?.basePrice == null ? '산출 전' : formatUnitPrice(g.basePrice, unit)}
            sub={`${won(Math.round(spent))}원 지출`}
            metrics={
              range === null
                ? []
                : [
                    { label: '기간 최저', value: formatUnitPrice(range.low, unit), tone: 'blue' },
                    { label: '기간 최고', value: formatUnitPrice(range.high, unit), tone: 'red' },
                  ]
            }
          />

          {groups.map(([ym, list]) => (
            <View key={ym}>
              <MonthHead month={monthTitle(ym)} count={list.length} />
              {/* 줄마다 카드를 쓰면 목록이 아니라 더미가 된다 — 한 장에 구분선. */}
              <Card pad={0} style={{ overflow: 'hidden' }}>
                {list.map((r, i) => {
                  const st = STATUS[r.status];
                  const mark = range === null || r.unitPrice === null ? null
                    : Math.abs(r.unitPrice - range.low) < 0.0001 ? '최저'
                      : Math.abs(r.unitPrice - range.high) < 0.0001 ? '최고' : null;
                  return (
                    <View
                      key={r.id}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        paddingVertical: 13, paddingHorizontal: 15,
                        borderBottomWidth: i < list.length - 1 ? 1 : 0, borderBottomColor: T.line2,
                        opacity: r.status === 'canceled' ? 0.5 : 1,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[{ fontSize: 13, color: T.ter, fontWeight: '600' }, tnum]}>
                            {r.orderedAt.slice(5).replace('-', '/')}
                          </Text>
                          {/* 입고 완료는 이 목록의 기본값이라 적지 않는다. 예외만 말한다. */}
                          {r.status !== 'received' ? <Badge tone={st.tone} sm>{st.label}</Badge> : null}
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink, marginTop: 5 }} numberOfLines={1}>
                          {r.vendorName ?? '거래처 미지정'}
                        </Text>
                        <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 3 }, tnum]}>
                          {/* 주문과 실제가 다르면 그 사실이 단가와 재고를 바꾼다 — packSummary 가 밝힌다. */}
                          {packSummary({
                            volume: r.volume, qty: r.qty, receivedQty: r.receivedQty, amount: r.amount,
                            fmtQty: (v) => formatQuantity(v, unit),
                            fmtWon: won,
                          })}
                        </Text>
                      </View>
                      {/* 최저·최고는 **단가 위**에 붙는다 — 그 배지가 가리키는 게 단가라서다. */}
                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={{ height: 18, justifyContent: 'center' }}>
                          {mark ? <Badge tone={mark === '최저' ? 'blue' : 'red'} sm>{mark}</Badge> : null}
                        </View>
                        <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, marginTop: 2 }, tnum]}>
                          {r.unitPrice === null ? '—' : formatUnitPrice(r.unitPrice, unit)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </Card>
            </View>
          ))}

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 2, marginTop: 2 }}>
            <Icon name="info" size={15} color={T.ter} />
            <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>
              여기 단가는 <Text style={{ fontWeight: '700' }}>그날 그 값</Text>이에요. 기준 단가는 실제로 들어온 양으로
              가중평균한 값이라 조금 달라요.
            </Text>
          </View>
        </QueryState>
      </ScrollView>

      <PeriodSheet
        visible={periodOpen}
        value={period}
        onClose={() => setPeriodOpen(false)}
        onApply={(p) => { setPeriod(p); setPeriodOpen(false); }}
      />
    </View>
  );
}
