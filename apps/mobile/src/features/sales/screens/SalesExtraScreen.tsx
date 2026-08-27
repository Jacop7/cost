/**
 * SALES-15 부자재 자세히 (+ SALES-16 부자재별 사용 메뉴 시트).
 *
 * 부자재는 재고를 갖지 않는다(포장용기 등). 그래서 원장이 아니라 **판매 시점 스냅샷**
 * (daily_sales_items.unit_extra_cost)에서 되짚는다.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Icon, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { useExtraUsage, useSalesRange, type ExtraUsageItem } from '../hooks';
import { rangeLabel } from '@/lib/date';
import { useSalesBusinessDate } from '@/features/business-day/businessDay';
import { DetailSummary } from '../components/ProfitBlocks';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';

const NUM = { fontVariant: ['tabular-nums' as const] };

/**
 * ⚠ 서버가 정한 장부 날짜를 받고 나서 본체를 붙인다(0125). 앱이 직접 계산하지 않는다.
 *   게이트가 로딩·오류·재시도를 함께 다룬다 — 날짜 조회가 실패하면 예전엔 영원히
 *   "불러오는 중" 만 떴다.
 */
export default function SalesExtraScreen() {
  return (
    <BusinessDateGate source={useSalesBusinessDate()} title="기타 매출">
      {(serverToday) => <SalesExtraScreenBody serverToday={serverToday} />}
    </BusinessDateGate>
  );
}

function SalesExtraScreenBody({ serverToday }: { serverToday: string }) {
  const params = useLocalSearchParams<{ from?: string; to?: string; date?: string }>();
    const today = serverToday;
  const from = params.from ?? params.date ?? today;
  const to = params.to ?? params.date ?? today;

  const usage = useExtraUsage(from, to);
  const range = useSalesRange(from, to);
  const [sel, setSel] = useState<ExtraUsageItem | null>(null);

  const items = usage.data?.items ?? [];
  const total = usage.data?.total ?? 0;
  const revenue = range.data?.summary.revenue ?? 0;
  const rate = revenue > 0 ? Math.round((total / revenue) * 1000) / 10 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="부자재 자세히" onBack={() => safeBack(`/sales/day?date=${to}`)} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28 }}>
        <QueryState
          isLoading={usage.isLoading}
          error={usage.error}
          isEmpty={items.length === 0}
          onRetry={() => void usage.refetch()}
          emptyTitle="이 기간에 사용된 부자재가 없어요"
          emptyHint="레시피의 ‘부가 원가’에 포장용기 등을 등록하면 집계돼요"
        >
          <Card onLine pad={0} style={{ overflow: 'hidden' }}>
            <DetailSummary rows={[['영업일', rangeLabel(from, to)], ['부자재 합계', `${won(Math.round(total))}원`], ['매출 대비', `${rate}%`]] as [string, string][]} />
            <View style={{ paddingHorizontal: 15, paddingBottom: 4 }}>
              {items.map((m, i) => (
                <Pressable
                  key={m.name}
                  onPress={() => setSel(m)}
                  accessibilityRole="button" accessibilityLabel={`${m.name} 메뉴별 내역 보기`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingLeft: 12, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub }} numberOfLines={1}>
                      {m.name} <Text style={{ color: T.ter }}>{m.qty}개</Text>
                    </Text>
                    <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }} numberOfLines={1}>
                      {m.menus.map((x) => x.menuName).join(' · ')}
                    </Text>
                  </View>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(Math.round(m.amount))}원</Text>
                  <Icon name="chevron" size={15} color={T.line3} />
                </Pressable>
              ))}
            </View>
          </Card>
        </QueryState>

      </ScrollView>

      {/* SALES-16 부자재별 사용 메뉴 */}
      <Sheet visible={sel != null} onClose={() => setSel(null)} title={sel?.name} sub={sel ? `${sel.qty}개 사용 · 메뉴별 내역` : undefined} height={420}>
        {sel ? (
          <View>
            <Card onLine pad={0} style={{ overflow: 'hidden' }}>
              {sel.menus.map((r, i) => (
                <View key={r.menuName} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, borderBottomWidth: i < sel.menus.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>{r.menuName}</Text>
                    <Text style={[{ fontSize: 14, color: T.sub, fontWeight: '600', marginTop: 3 }, NUM]}>{won(r.unit)}원 × {r.qty}개</Text>
                  </View>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(Math.round(r.amount))}원</Text>
                </View>
              ))}
            </Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingVertical: 14, paddingHorizontal: 15, borderRadius: 12, backgroundColor: T.surface2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>합계</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{sel.qty}개</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round(sel.amount))}원</Text>
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
