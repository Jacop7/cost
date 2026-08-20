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
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Badge, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatQuantity, formatUnitPrice } from '@sikjae/core';
import { T, tnum, won } from '@/theme/tokens';
import { packSummary } from '@/lib/num';
import { dispUnit } from '../ledger';
import { useIngredientDetail, usePurchaseHistory, type PurchaseRow } from '../hooks';

const STATUS: Record<PurchaseRow['status'], { label: string; tone: 'blue' | 'amber' | 'neutral' | 'green' }> = {
  ordered: { label: '입고 대기', tone: 'blue' },
  partial: { label: '부분 입고', tone: 'amber' },
  received: { label: '입고 완료', tone: 'green' },
  canceled: { label: '취소', tone: 'neutral' },
};

export default function PurchaseHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useIngredientDetail(id);
  const purchases = usePurchaseHistory(id);

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

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="구매 이력" onBack={() => safeBack(`/ingredients/${id}`)} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 11 }}>
        <QueryState
          isLoading={purchases.isLoading}
          error={purchases.error}
          isEmpty={rows.length === 0}
          onRetry={() => void purchases.refetch()}
          emptyTitle="아직 구매 기록이 없어요"
          emptyHint="발주 → 입고를 등록하면 여기에 쌓여요"
        >
          <Card pad={14}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.sub }}>지금까지 산 금액</Text>
              <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink }, tnum]}>{won(Math.round(spent))}원</Text>
            </View>
            {range ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 9, paddingTop: 9, borderTopWidth: 1, borderTopColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 14, color: T.ter, fontWeight: '600' }}>단가 범위</Text>
                <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2 }, tnum]}>
                  {formatUnitPrice(range.low, unit)} ~ {formatUnitPrice(range.high, unit)}
                </Text>
              </View>
            ) : null}
            {g?.basePrice !== null && g?.basePrice !== undefined ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
                <Text style={{ flex: 1, fontSize: 14, color: T.ter, fontWeight: '600' }}>기준 단가 (실입고량 가중평균)</Text>
                <Text style={[{ fontSize: 14, fontWeight: '800', color: T.blue }, tnum]}>
                  {formatUnitPrice(g.basePrice, unit)}
                </Text>
              </View>
            ) : null}
          </Card>

          {rows.map((r) => {
            const st = STATUS[r.status];
            return (
              <Card key={r.id} pad={0} style={{ overflow: 'hidden', opacity: r.status === 'canceled' ? 0.5 : 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 15 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600' }, tnum]}>
                        {r.orderedAt.slice(5).replace('-', '/')}
                      </Text>
                      <Badge tone={st.tone} sm>{st.label}</Badge>
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink, marginTop: 3 }} numberOfLines={1}>
                      {r.vendorName ?? '거래처 미지정'}
                    </Text>
                    <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 2 }, tnum]}>
                      {/* 주문과 실제가 다르면 그 사실이 단가와 재고를 바꾼다 — packSummary 가 밝힌다. */}
                      {packSummary({
                        volume: r.volume, qty: r.qty, receivedQty: r.receivedQty, amount: r.amount,
                        fmtQty: (v) => formatQuantity(v, unit),
                        fmtWon: won,
                      })}
                    </Text>
                  </View>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, tnum]}>
                    {r.unitPrice === null ? '—' : formatUnitPrice(r.unitPrice, unit)}
                  </Text>
                </View>
              </Card>
            );
          })}

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 2, marginTop: 2 }}>
            <Icon name="info" size={15} color={T.ter} />
            <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>
              여기 단가는 <Text style={{ fontWeight: '700' }}>그날 그 값</Text>이에요. 기준 단가는 실제로 들어온 양으로
              가중평균한 값이라 조금 달라요.
            </Text>
          </View>
        </QueryState>
      </ScrollView>
    </View>
  );
}
