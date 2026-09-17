import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Badge, Button, Card, HubHeader, HubHeaderAction, Icon, QueryState, SearchBar, Sheet } from '@/components/kit';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { useSalesBusinessDate } from '@/features/business-day/businessDay';
import { rangeLabel } from '@/lib/date';
import { COLOR, COMPONENT, LAYOUT, T, TYPE, space, won } from '@/theme/tokens';
import { useSalesFeed, useSalesInventoryCountRequirement, useSetSalesCalendarDay, type SalesEntryStatus, type SalesFeedItem } from '../lifecycle';
import { SalesSectionTabs } from '../components/SalesSectionTabs';

const NUM = { fontVariant: ['tabular-nums' as const] };
const pad = (n: number) => String(n).padStart(2, '0');
type StatusFilter = 'all' | Exclude<SalesEntryStatus, 'closed'>;

const statusTabs: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'missing', label: '미작성' },
  { key: 'editing', label: '작성 중' },
  { key: 'completed', label: '작성 완료' },
];

function shiftMonth(day: string, offset: number) {
  const d = new Date(`${day}T00:00:00Z`);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-01`;
}

const statusMeta: Record<SalesEntryStatus, { label: string; tone: 'neutral' | 'blue' | 'green' | 'ghost' }> = {
  missing: { label: '미작성', tone: 'neutral' },
  editing: { label: '작성 중', tone: 'blue' },
  completed: { label: '작성 완료', tone: 'green' },
  closed: { label: '휴무', tone: 'ghost' },
};

export default function SalesFeedScreen() {
  return (
    <BusinessDateGate source={useSalesBusinessDate()} title="매출관리">
      {today => <SalesFeedBody today={today} />}
    </BusinessDateGate>
  );
}

function SalesFeedBody({ today }: { today: string }) {
  const router = useRouter();
  const period = useMemo(() => ({ from: shiftMonth(today, 0), to: today }), [today]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [calendarTarget, setCalendarTarget] = useState<{ item: SalesFeedItem; kind: 'closed' | 'expected' } | null>(null);
  const feed = useSalesFeed(period.from, period.to);
  const inventoryCount = useSalesInventoryCountRequirement();
  const setCalendarDay = useSetSalesCalendarDay();
  const normalizedQuery = query.replace(/\s+/g, '').toLowerCase();
  const filteredItems = feed.data?.items
    .filter(item => statusFilter === 'all' || item.status === statusFilter)
    .filter(item => normalizedQuery === '' || [
      item.businessDate,
      rangeLabel(item.businessDate, item.businessDate, today),
      statusMeta[item.status].label,
    ].some(value => value.replace(/\s+/g, '').toLowerCase().includes(normalizedQuery))) ?? [];

  const goWrite = (item: SalesFeedItem) => router.push(`/sales/write?date=${item.businessDate}` as Href);
  const goDetail = (item: SalesFeedItem) => router.push(`/sales/day?date=${item.businessDate}` as Href);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <HubHeader title="매출관리"
        actions={<>
          <HubHeaderAction label="검색" icon="search" selected={searching}
            onPress={() => { if (searching) setQuery(''); setSearching(value => !value); }} />
          <HubHeaderAction label="알림" icon="bell" onPress={() => router.push('/my/notifications' as Href)} />
        </>}
        below={searching ? <SearchBar value={query} onChange={setQuery} placeholder="날짜·작성 상태 검색"
          onClose={() => { setSearching(false); setQuery(''); }} /> : null}
      />
      <SalesSectionTabs active="write" />
      <View style={{ paddingHorizontal: 16, paddingVertical: space.md }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          contentContainerStyle={{ gap: space.sm, paddingVertical: COMPONENT.filterChip.hitSlop }}>
          {statusTabs.map(tab => {
            const selected = tab.key === statusFilter;
            return (
              <Pressable key={tab.key} onPress={() => setStatusFilter(tab.key)}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected }} aria-selected={selected}
                hitSlop={{ top: COMPONENT.filterChip.hitSlop, bottom: COMPONENT.filterChip.hitSlop, left: 0, right: 0 }}
                style={{ minHeight: COMPONENT.filterChip.minHeight, flexDirection: 'row', alignItems: 'center', gap: COMPONENT.filterChip.gap,
                  paddingVertical: COMPONENT.filterChip.paddingVertical, paddingHorizontal: space.md,
                  borderWidth: 1, borderColor: selected ? COLOR.state.selectedText : T.line,
                  borderRadius: COMPONENT.filterChip.borderRadius, backgroundColor: T.surface }}>
                <Text style={{ ...COMPONENT.filterChip.label, fontWeight: selected ? '800' : '700', color: selected ? COLOR.state.selectedText : T.sub }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: LAYOUT.scroll.start, paddingBottom: LAYOUT.scroll.end, gap: space.md }}>
        <QueryState isLoading={feed.isLoading} error={feed.error} isEmpty={false}
          onRetry={() => void feed.refetch()} emptyTitle="">
          {feed.data ? (
            <>
              {inventoryCount.error ? (
                <Card pad={space.md}>
                  <View style={{ gap: space.sm }}>
                    <Text accessibilityRole="alert" style={{ ...TYPE.caption, color: COLOR.status.negative }}>
                      재고 실사 필요 여부를 확인하지 못했어요.
                    </Text>
                    <Button kind="ghost" size="sm" onPress={() => void inventoryCount.refetch()}>다시 확인</Button>
                  </View>
                </Card>
              ) : inventoryCount.data?.required ? (
                <Card pad={space.md}>
                  <View style={{ gap: space.sm }}>
                    <Text style={{ ...TYPE.body, fontWeight: '800', color: COLOR.text.primary }}>전체 재고 실사가 필요해요</Text>
                    <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>
                      {inventoryCount.data.reason ?? '현재 재고를 확인해야 매출 작성을 계속할 수 있어요.'}
                    </Text>
                    <Button onPress={() => router.push(`/sales/inventory-count?date=${inventoryCount.data.referenceSalesDate ?? feed.data.clock.recommendedSalesDate}` as Href)}>
                      재고 실사 시작
                    </Button>
                  </View>
                </Card>
              ) : null}

              <Text style={{ marginTop: space.sm, fontSize: 14, fontWeight: '700', color: COLOR.text.secondary }}>영업일 · 최신순</Text>
              {filteredItems.map(item => {
                const meta = statusMeta[item.status];
                const writable = item.canEdit && item.status !== 'closed';
                const hasAction = writable || item.canClassify;
                const actionLabel = item.action === 'resume' ? '이어서 작성' : item.status === 'completed' ? '수정' : '작성하기';
                return (
                  <Card key={item.businessDate} pad={0} style={{ overflow: 'hidden' }}>
                    <Pressable onPress={() => goDetail(item)} accessibilityRole="button"
                      accessibilityLabel={`${rangeLabel(item.businessDate, item.businessDate, today)} 상세 보기`}
                      style={{ paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: hasAction ? space.sm : space.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: COMPONENT.cardFooter.largeFontSize, fontWeight: '800', color: T.ink }}>{rangeLabel(item.businessDate, item.businessDate, today)}</Text>
                        </View>
                        <Badge tone={meta.tone} sm>{meta.label}</Badge>
                        <Icon name="chevron" size={17} color={COLOR.text.tertiary} />
                      </View>
                      {item.status === 'completed' ? (
                        <View style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'flex-end' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: COLOR.text.tertiary }}>매출</Text>
                            <Text style={[{ marginTop: 3, fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(item.sales)}원</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: COLOR.text.tertiary }}>순이익 · 순이익률</Text>
                            <Text style={[{ marginTop: 3, fontSize: 16, fontWeight: '800', color: item.profit == null ? T.ink : item.profit >= 0 ? COLOR.text.accent : COLOR.status.negative }, NUM]}>
                              {item.profit == null ? '미산출' : `${won(item.profit)}원`} · {item.profitRate == null ? '미산출' : `${item.profitRate}%`}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={{ marginTop: space.sm, fontSize: 14, fontWeight: '600', color: COLOR.text.tertiary }}>
                          {item.status === 'editing' ? '임시저장한 내역이 있어요.' : item.status === 'closed' ? '휴무로 등록된 날이에요.' : '아직 매출을 작성하지 않았어요.'}
                        </Text>
                      )}
                      {item.status === 'completed' && item.action === 'resume' ? (
                        <Text style={{ marginTop: space.sm, fontSize: 13, fontWeight: '700', color: COLOR.text.accent }}>수정 중인 임시저장이 있어요.</Text>
                      ) : null}
                      {!hasAction && item.blockedReason ? (
                        <Text style={{ marginTop: space.sm, fontSize: 13, fontWeight: '600', color: COLOR.text.tertiary }}>{item.blockedReason}</Text>
                      ) : null}
                    </Pressable>
                    {hasAction ? (
                      <View style={{ paddingHorizontal: space.md, paddingBottom: space.md, flexDirection: 'row', gap: space.sm }}>
                        {writable ? (
                          <Button kind={item.status === 'completed' ? 'ghost' : 'primary'} style={{ flex: 1 }} onPress={() => goWrite(item)}>{actionLabel}</Button>
                        ) : null}
                        {item.canClassify ? (
                          <Button kind="ghost" style={{ flex: 1 }} onPress={() => setCalendarTarget({
                            item,
                            kind: item.status === 'closed' ? 'expected' : 'closed',
                          })}>{item.status === 'closed' ? '영업일로 변경' : '휴무로 확정'}</Button>
                        ) : null}
                      </View>
                    ) : null}
                  </Card>
                );
              })}
              {filteredItems.length === 0 ? (
                <Text style={{ paddingVertical: space.xl, textAlign: 'center', ...TYPE.caption, color: COLOR.text.tertiary }}>
                  해당 상태의 영업일이 없어요
                </Text>
              ) : null}
            </>
          ) : null}
        </QueryState>
      </ScrollView>

      <Sheet visible={calendarTarget != null}
        title={calendarTarget?.kind === 'closed' ? '휴무로 확정' : '영업일로 변경'}
        onClose={() => { if (!setCalendarDay.isPending) setCalendarTarget(null); }}>
        {calendarTarget ? (
          <View style={{ gap: space.lg }}>
            <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: '600', color: COLOR.text.secondary }}>
              {rangeLabel(calendarTarget.item.businessDate, calendarTarget.item.businessDate, today)}을(를) {calendarTarget.kind === 'closed' ? '휴무로 확정할까요? 이 날짜는 미작성 건수에서 제외됩니다.' : '영업일로 변경할까요? 매출을 작성해야 하는 날짜로 표시됩니다.'}
            </Text>
            {setCalendarDay.error ? (
              <Text accessibilityRole="alert" style={{ fontSize: 13, fontWeight: '700', color: COLOR.status.negative }}>
                {setCalendarDay.error instanceof Error ? setCalendarDay.error.message : '날짜 상태를 변경하지 못했어요.'}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button kind="ghost" style={{ flex: 1 }} disabled={setCalendarDay.isPending} onPress={() => setCalendarTarget(null)}>취소</Button>
              <Button kind="primary" style={{ flex: 1 }} loading={setCalendarDay.isPending} onPress={() => {
                void setCalendarDay.mutateAsync(calendarTarget).then(() => setCalendarTarget(null)).catch(() => undefined);
              }}>확인</Button>
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
