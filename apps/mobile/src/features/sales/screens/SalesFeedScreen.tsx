import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Badge, Button, Card, ConfirmDialog, FilterChip, HubHeader, HubHeaderAction, Icon, QueryState, SearchBar, Sheet, SortChip, SortSheet, type SortOption } from '@/components/kit';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { useSalesBusinessDate } from '@/features/business-day/businessDay';
import { rangeLabel } from '@/lib/date';
import { COLOR, COMPONENT, LAYOUT, T, TYPE, space, won } from '@/theme/tokens';
import { useSalesFeed, useSalesInventoryCountRequirement, useSetSalesCalendarDay, type SalesEntryStatus, type SalesFeedItem } from '../lifecycle';
import { SalesSectionTabs } from '../components/SalesSectionTabs';

const NUM = { fontVariant: ['tabular-nums' as const] };
const pad = (n: number) => String(n).padStart(2, '0');
type StatusFilter = 'all' | Exclude<SalesEntryStatus, 'closed'>;
type SortKey = 'newest' | 'oldest';

const SORTS: readonly SortOption<SortKey>[] = [
  { key: 'newest', label: '최신순' },
  { key: 'oldest', label: '오래된순' },
];

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

function displayStatusOf(item: SalesFeedItem): SalesEntryStatus {
  return item.draftId != null && item.action === 'resume' ? 'editing' : item.status;
}

const salesGuidance = [
  '매출 작성/수정: 이번 달 및 지난달 내역에 한함.',
  '재고 연동: 매출 등록 시, 메뉴 수량에 따라 식자재 자동 차감.',
] as const;

function SalesGuidanceNotice() {
  const [expanded, setExpanded] = useState(true);
  return (
    <View style={{ backgroundColor: COLOR.action.primaryTint, borderWidth: 1, borderColor: COMPONENT.notice.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: space.md }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`필독사항 ${expanded ? '접기' : '펼치기'}`}
        accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => setExpanded(value => !value)}
        style={{ minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="info" size={18} color={COLOR.action.primary} fill />
        <Text style={{ ...TYPE.caption, flex: 1, fontWeight: '800', color: COLOR.action.onTint }}>필독사항</Text>
        <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={16} color={COLOR.action.onTint} />
        </View>
      </Pressable>
      {expanded ? (
        <View style={{ marginTop: 8, gap: 5 }}>
          {salesGuidance.map(line => (
            <View key={line} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
              <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                style={{ ...TYPE.caption, color: COLOR.action.onTint }}>-</Text>
              <Text style={{ ...TYPE.caption, flex: 1, fontWeight: '600', color: COLOR.action.onTint }}>{line}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function SalesFeedScreen() {
  return (
    <BusinessDateGate source={useSalesBusinessDate()} title="매출관리">
      {today => <SalesFeedBody today={today} />}
    </BusinessDateGate>
  );
}

function SalesFeedBody({ today }: { today: string }) {
  const router = useRouter();
  const period = useMemo(() => ({ from: shiftMonth(today, -1), to: today }), [today]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [calendarMenuTarget, setCalendarMenuTarget] = useState<SalesFeedItem | null>(null);
  const [calendarTarget, setCalendarTarget] = useState<{ item: SalesFeedItem; kind: 'closed' | 'expected' } | null>(null);
  const [writeConfirmTarget, setWriteConfirmTarget] = useState<SalesFeedItem | null>(null);
  const feed = useSalesFeed(period.from, period.to);
  const inventoryCount = useSalesInventoryCountRequirement();
  const setCalendarDay = useSetSalesCalendarDay();
  const normalizedQuery = query.replace(/\s+/g, '').toLowerCase();
  const filteredItems = feed.data?.items
    .filter(item => statusFilter === 'all' || displayStatusOf(item) === statusFilter)
    .filter(item => normalizedQuery === '' || [
      item.businessDate,
      rangeLabel(item.businessDate, item.businessDate, today),
      statusMeta[displayStatusOf(item)].label,
    ].some(value => value.replace(/\s+/g, '').toLowerCase().includes(normalizedQuery)))
    .sort((a, b) => sort === 'newest'
      ? b.businessDate.localeCompare(a.businessDate)
      : a.businessDate.localeCompare(b.businessDate)) ?? [];
  const sortLabel = SORTS.find(option => option.key === sort)?.label ?? '최신순';

  const goWrite = (item: SalesFeedItem, start = false) => router.push(
    `/sales/write?date=${item.businessDate}${start ? '&start=1' : ''}` as Href,
  );
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
      <View style={{ paddingLeft: 16, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ paddingVertical: COMPONENT.filterChip.hitSlop }}>
          <SortChip label={sortLabel} onPress={() => setSortOpen(true)} />
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ width: 1, height: 24, marginHorizontal: space.sm, backgroundColor: T.line }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}
          accessibilityRole="tablist"
          contentContainerStyle={{ gap: space.sm, paddingVertical: COMPONENT.filterChip.hitSlop, paddingRight: 16 }}>
          {statusTabs.map(tab => {
            const selected = tab.key === statusFilter;
            return (
              <FilterChip key={tab.key} label={tab.label} accessibilityLabel={tab.label}
                selected={selected} paddingHorizontal={space.md} onPress={() => setStatusFilter(tab.key)} />
            );
          })}
        </ScrollView>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: LAYOUT.scroll.start, paddingBottom: LAYOUT.scroll.end, gap: space.md }}>
        <SalesGuidanceNotice />
        <QueryState isLoading={feed.isLoading} error={feed.error} isEmpty={false}
          onRetry={() => void feed.refetch()} emptyTitle="">
          {feed.data ? (
            <>
              {inventoryCount.error ? (
                <Card>
                  <View style={{ gap: space.sm }}>
                    <Text accessibilityRole="alert" style={{ ...TYPE.caption, color: COLOR.status.negative }}>
                      재고 실사 필요 여부를 확인하지 못했어요.
                    </Text>
                    <Button kind="ghost" size="sm" onPress={() => void inventoryCount.refetch()}>다시 확인</Button>
                  </View>
                </Card>
              ) : inventoryCount.data?.required ? (
                <Card>
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

              {filteredItems.map(item => {
                const displayStatus = displayStatusOf(item);
                const meta = statusMeta[displayStatus];
                const writable = item.canEdit && item.status !== 'closed';
                const hasAction = writable || item.canClassify;
                const actionLabel = item.action === 'resume' ? '이어서 작성' : item.status === 'completed' ? '수정' : '작성하기';
                const missingMenu = displayStatus === 'missing';
                const mainContent = (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <Badge tone={meta.tone} sm>{meta.label}</Badge>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: COMPONENT.salesFeed.dateFontSize, fontWeight: '800', color: T.ink }}>{rangeLabel(item.businessDate, item.businessDate, today)}</Text>
                      </View>
                      {missingMenu ? (
                        <Pressable accessibilityRole="button"
                          accessibilityLabel={`${rangeLabel(item.businessDate, item.businessDate, today)} 더보기`}
                          onPress={() => setCalendarMenuTarget(item)} hitSlop={8}
                          style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="more" size={18} color={COLOR.text.tertiary} />
                        </Pressable>
                      ) : <Icon name="chevron" size={17} color={COLOR.text.tertiary} />}
                    </View>
                    {displayStatus === 'completed' ? (
                      <View style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'flex-end' }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: COLOR.text.tertiary }}>매출</Text>
                          <Text style={[{ marginTop: 3, fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(item.sales)}원</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: COLOR.text.tertiary }}>순이익</Text>
                          <Text style={[{ marginTop: 3, fontSize: 16, fontWeight: '800', color: item.profit == null ? T.ink : item.profit >= 0 ? COLOR.text.accent : COLOR.status.negative }, NUM]}>
                            {item.profit == null ? '미산출' : `${won(item.profit)}원`} · {item.profitRate == null ? '미산출' : `${item.profitRate}%`}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={{ marginTop: space.sm, fontSize: 14, fontWeight: '600', color: COLOR.text.tertiary }}>
                        {displayStatus === 'editing' ? '임시저장한 내역이 있어요.' : displayStatus === 'closed' ? '휴무로 등록된 날이에요.' : '아직 매출을 작성하지 않았어요.'}
                      </Text>
                    )}
                    {!hasAction && item.blockedReason ? (
                      <Text style={{ marginTop: space.sm, fontSize: 13, fontWeight: '600', color: COLOR.text.tertiary }}>{item.blockedReason}</Text>
                    ) : null}
                  </>
                );
                return (
                  <Card key={item.businessDate} pad={0} style={{ overflow: 'hidden' }}>
                    {missingMenu ? (
                      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: hasAction ? space.sm : space.md }}>
                        {mainContent}
                      </View>
                    ) : (
                      <Pressable onPress={() => goDetail(item)} accessibilityRole="button"
                        accessibilityLabel={`${rangeLabel(item.businessDate, item.businessDate, today)} 상세 보기`}
                        style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: hasAction ? space.sm : space.md }}>
                        {mainContent}
                      </Pressable>
                    )}
                    {hasAction ? (
                      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, flexDirection: 'row', gap: space.sm }}>
                        {writable ? (
                          <Button kind={displayStatus === 'completed' ? 'ghost' : 'primary'} style={{ flex: 1 }} onPress={() => {
                            if (displayStatus === 'missing') setWriteConfirmTarget(item);
                            else goWrite(item);
                          }}>{actionLabel}</Button>
                        ) : null}
                        {item.canClassify && !missingMenu ? (
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

      <SortSheet visible={sortOpen} options={SORTS} value={sort} onSelect={setSort} onClose={() => setSortOpen(false)} />

      <Sheet visible={calendarMenuTarget != null}
        title={calendarMenuTarget ? rangeLabel(calendarMenuTarget.businessDate, calendarMenuTarget.businessDate, today) : undefined}
        onClose={() => setCalendarMenuTarget(null)}>
        <View style={{ gap: space.sm }}>
          <Button kind="ghost" full disabled={!calendarMenuTarget?.canClassify} onPress={() => {
            if (!calendarMenuTarget) return;
            setCalendarTarget({ item: calendarMenuTarget, kind: 'closed' });
            setCalendarMenuTarget(null);
          }}>휴무 처리</Button>
          <Button kind="ghost" full onPress={() => setCalendarMenuTarget(null)}>닫기</Button>
        </View>
      </Sheet>

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

      <ConfirmDialog visible={writeConfirmTarget != null} title="작성 하시겠습니까?"
        kind="primary" confirmText="확인" cancelText="취소" closeLabel="매출 작성 확인 닫기"
        onCancel={() => setWriteConfirmTarget(null)} onConfirm={() => {
          if (!writeConfirmTarget) return;
          const target = writeConfirmTarget;
          setWriteConfirmTarget(null);
          goWrite(target, true);
        }} />
    </View>
  );
}
