/**
 * SALES-13 재료 원가 자세히 (+ SALES-14 재료별 사용 메뉴 시트).
 *
 * 여기 숫자는 새 계산이 아니라 **재고 원장 되짚기**다. 판매(E10)가 남긴 소진 이벤트를
 * 식재료별·메뉴별로 합쳐 보여준다. 그래서 "재고는 줄었는데 왜 줄었지"가 여기서 답이 된다.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AppHeader, Card, Icon, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { COMPONENT, LAYOUT, COLOR, T, won, space } from '@/theme/tokens';
import { formatQuantity, formatUnitPrice } from '@margincook/core';
import { useMaterialUsage, useSalesRange, type MaterialUsageItem } from '../hooks';
import { rangeLabel } from '@/lib/date';
import { useSalesBusinessDate } from '@/features/business-day/businessDay';
import { DetailSummary } from '../components/ProfitBlocks';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';

const NUM = { fontVariant: ['tabular-nums' as const] };
const dispUnit = (u: 'g' | 'ml' | 'ea') => (u === 'ea' ? '개' : u);

/**
 * ⚠ 서버가 정한 장부 날짜를 받고 나서 본체를 붙인다(0125). 앱이 직접 계산하지 않는다.
 *   게이트가 로딩·오류·재시도를 함께 다룬다 — 날짜 조회가 실패하면 예전엔 영원히
 *   "불러오는 중" 만 떴다.
 */
export default function SalesMaterialScreen() {
  return (
    <BusinessDateGate source={useSalesBusinessDate()} title="식재료 원가">
      {(serverToday) => <SalesMaterialScreenBody serverToday={serverToday} />}
    </BusinessDateGate>
  );
}

function SalesMaterialScreenBody({ serverToday }: { serverToday: string }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; to?: string; date?: string }>();
    const today = serverToday;
  const from = params.from ?? params.date ?? today;
  const to = params.to ?? params.date ?? today;

  const usage = useMaterialUsage(from, to);
  const range = useSalesRange(from, to);

  const [showAll, setShowAll] = useState(false);
  const [sel, setSel] = useState<MaterialUsageItem | null>(null);

  const items = usage.data?.items ?? [];
  const total = usage.data?.total ?? 0;
  const revenue = range.data?.summary.revenue ?? 0;
  const costRate = revenue > 0 ? Math.round((total / revenue) * 1000) / 10 : 0;
  const list = showAll ? items : items.slice(0, 5);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="식재료 원가 자세히" onBack={() => safeBack(`/sales/day?date=${to}`)} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: LAYOUT.scroll.start, paddingBottom: LAYOUT.scroll.end }}>
        <QueryState
          isLoading={usage.isLoading}
          error={usage.error}
          isEmpty={items.length === 0}
          onRetry={() => void usage.refetch()}
          emptyTitle="이 기간에 사용된 식재료가 없어요"
          emptyHint="판매를 등록하면 메뉴에 등록된 식재료와 사용량에 따라 자동 집계돼요"
        >
          <Card onLine pad={0} style={{ overflow: 'hidden' }}>
            <DetailSummary rows={[['영업일', rangeLabel(from, to)], ['식재료 원가 합계', `${won(Math.round(total))}원`], ['매출 원가율', `${costRate}%`]] as [string, string][]} />
            <View style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: T.ink, paddingTop: 12, paddingBottom: space.xs }}>사용 식재료</Text>
              {list.map((m) => {
                const unit = dispUnit(m.baseUnit);
                const menus = m.menus.map((x) => x.menuName);
                return (
                  <Pressable
                    key={m.ingredientId}
                    onPress={() => setSel(m)}
                    accessibilityRole="button" accessibilityLabel={`${m.name} 메뉴별 차감 보기`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: space.sm, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub }} numberOfLines={1}>
                        {m.name} <Text style={{ color: COLOR.text.tertiary }}>{formatQuantity(m.qty, unit)}</Text>
                      </Text>
                      <Text style={{ fontSize: 14, color: COLOR.text.tertiary, marginTop: space.xs }} numberOfLines={1}>
                        {menus.slice(0, 2).join(' · ')}{menus.length > 2 ? ` 외 ${menus.length - 2}개` : ''}
                      </Text>
                    </View>
                    <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(Math.round(m.amount))}원</Text>
                    <Icon name="chevron" size={15} color={T.line3} />
                  </Pressable>
                );
              })}
              {!showAll && items.length > 5 ? (
                <Pressable
                  onPress={() => setShowAll(true)}
                  accessibilityRole="button" accessibilityLabel={`식재료 ${items.length - 5}개 더 보기`}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: T.line2 }}
                >
                  <Text style={{ fontSize: COMPONENT.cardFooter.fontSize, fontWeight: '700', color: COLOR.text.link }}>더보기 ({items.length - 5}개)</Text>
                  <Icon name="chevronDown" size={15} color={COLOR.action.primary} />
                </Pressable>
              ) : null}
            </View>
          </Card>
        </QueryState>

      </ScrollView>

      {/* SALES-14 재료별 사용 메뉴 */}
      <Sheet
        visible={sel != null}
        onClose={() => setSel(null)}
        title={sel?.name}
        sub={sel ? `${formatQuantity(sel.qty, dispUnit(sel.baseUnit))} 사용 · 메뉴별 차감` : undefined}
        headerRight={
          sel ? (
            <Pressable
              onPress={() => { const id = sel.ingredientId; setSel(null); router.push(`/ingredients/${id}` as Href); }}
              hitSlop={6}
              accessibilityRole="button" accessibilityLabel="식재료 상세로 이동"
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 4 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLOR.text.link }}>식재료 보기</Text>
              <Icon name="chevron" size={15} color={COLOR.action.primary} />
            </Pressable>
          ) : undefined
        }
      >
        {sel ? (
          <View>
            <Card onLine pad={0} style={{ overflow: 'hidden' }}>
              {sel.menus.map((r, i) => (
                <View key={r.menuName} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, paddingHorizontal: space.md, borderBottomWidth: i < sel.menus.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>{r.menuName}</Text>
                    <Text style={[{ fontSize: 14, color: COLOR.text.tertiary, fontWeight: '600', marginTop: space.xs }, NUM]}>
                      {formatQuantity(r.qty, dispUnit(sel.baseUnit))}
                    </Text>
                  </View>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(Math.round(r.amount))}원</Text>
                </View>
              ))}
            </Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: 12, backgroundColor: T.surface2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>합계</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{formatQuantity(sel.qty, dispUnit(sel.baseUnit))}</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round(sel.amount))}원</Text>
            </View>
            <Text style={[{ fontSize: 14, color: COLOR.text.tertiary, marginTop: 8, textAlign: 'right' }, NUM]}>
              {sel.unitPrice === null ? '기준단가 산출 전' : `기준단가 ${formatUnitPrice(sel.unitPrice, dispUnit(sel.baseUnit))}`}
            </Text>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
