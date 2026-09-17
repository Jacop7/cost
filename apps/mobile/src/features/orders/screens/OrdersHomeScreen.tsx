/**
 * ORD-01 발주 현황 홈 — 3탭: 발주 후보 / 입고 예정 / 입고 완료.
 *
 * ⚠ 절대원칙 2: 발주 등록(E7)은 **기록만** 한다 — 재고·기준단가는 그대로다.
 *   재고가 실제로 늘어나는 건 '입고 완료'(E1)를 눌렀을 때뿐이다. 화면도 그렇게 읽히게 쓴다.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, HubHeader, HubHeaderAction, Icon, QueryState, ScrollTabs, SearchBar } from '@/components/kit';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { historyRowStyles } from '@/components/history/historyRowStyles';
import { formatQuantity, isNegativeStock } from '@costkeep/core';
import { LAYOUT, COLOR, T, won, TYPE, space } from '@/theme/tokens';
import { packSummaryParts } from '@/lib/num';
import { useIngredientList } from '@/features/ingredients/hooks';
import { CandidatePurchaseLinksSheet } from '../components/CandidatePurchaseLinksSheet';
import { dispUnit } from '@/features/ingredients/ledger';
import { useBusinessDay, useStoreLocalDate } from '@/features/business-day/businessDay';
import { storeDateTimeParts } from '@/lib/date';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import {
  useCancelOrder,
  useOrderBoard,
  useRevertInbound,
  type OrderCandidate,
  type OrderRecord,
} from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

const REASON_LABEL: Record<string, string> = {
  safety_stock: '최소재고 미달',
  soon_out: '소진 임박',
  manual: '직접 추가',
};
const reasonTone = (rs: string[]): 'red' | 'amber' | 'blue' =>
  rs.includes('soon_out') ? 'red' : rs.includes('safety_stock') ? 'amber' : 'blue';

/** 도착 예정일 문구 — 날짜 뒤에 서버 매장 날짜 기준 도착 상태를 표시한다. */
function dueLabel(expected: string | null, today: string): string {
  if (!expected) return '도착일 미정';
  const md = `${Number(expected.slice(5, 7))}/${Number(expected.slice(8, 10))}`;
  const diff = Math.round((Date.parse(`${expected}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (diff < 0) return `${md} (${-diff}일 지연)`;
  if (diff === 0) return `${md} (오늘 도착)`;
  if (diff === 1) return `${md} (내일 도착)`;
  return `${md} (${diff}일 후 도착)`;
}
const isLate = (expected: string | null, today: string) => Boolean(expected) && expected! < today;

type TabKey = 'candidate' | 'waiting' | 'received';

function OrderCardDetails({ date, vendor, pack, late = false }: {
  date: string; vendor: string | null;
  pack: ReturnType<typeof packSummaryParts>; late?: boolean;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
        <Text style={[historyRowStyles.date, { flex: 1, minWidth: 0, color: late ? COLOR.status.negative : COLOR.text.tertiary }, NUM]}>{date}</Text>
        <Text style={[historyRowStyles.description, { maxWidth: '44%', flexShrink: 1, textAlign: 'right' }, NUM]}>{pack.amount}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
        <Text style={[historyRowStyles.title, { flex: 1, minWidth: 0 }]}>{vendor ?? '구매처 미지정'}</Text>
        <Text style={[{ ...TYPE.body, maxWidth: '44%', flexShrink: 1, fontWeight: '800', color: COLOR.text.primary, textAlign: 'right' }, NUM]}>{pack.total}</Text>
      </View>
    </View>
  );
}

function OrderCardHeading({ name, badge, secondaryBadge, onPress }: {
  name: string; badge: ReactNode; secondaryBadge?: ReactNode; onPress: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md }}>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
        {badge}
        <Text style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, maxWidth: '100%', fontSize: TYPE.body.fontSize, fontWeight: '800', letterSpacing: -0.3, color: COLOR.text.primary }}>{name}</Text>
        {secondaryBadge}
      </View>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name} 상세 보기`}
        style={{ width: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
        <Icon name="chevron" size={18} color={COLOR.text.tertiary} />
      </Pressable>
    </View>
  );
}

/**
 * ⚠ 여기 날짜는 **매장 현지 날짜**다(0125). 판매 영업일이 아니다 —
 *   발주·입고는 달력 날짜로 센다. 앱이 직접 계산하지 않고 서버에서 받는다.
 */
export default function OrdersHomeScreen() {
  return (
    <BusinessDateGate source={useStoreLocalDate()} title="발주">
      {(localDate) => <OrdersHomeScreenBody localDate={localDate} />}
    </BusinessDateGate>
  );
}

function OrdersHomeScreenBody({ localDate }: { localDate: string }) {
  const timezone = useBusinessDay().data?.timezone;
  const router = useRouter();
  const today = localDate;

  const board = useOrderBoard();
  const cancelOrder = useCancelOrder();
  const revertInbound = useRevertInbound();

  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<TabKey>(params.tab === 'waiting' ? 'waiting' : 'candidate');
  useEffect(() => { if (params.tab === 'waiting') setTab('waiting'); }, [params.tab]);
  const [purchaseLinksFor, setPurchaseLinksFor] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const [cancelFor, setCancelFor] = useState<OrderRecord | null>(null);
  const [revertFor, setRevertFor] = useState<OrderRecord | null>(null);
  const cancelBusy = useRef(false);
  const revertBusy = useRef(false);

  // One cached domain query supplies units for all records; never guess that every ingredient is grams.
  const ingredients = useIngredientList();
  const units = useMemo(() => new Map((ingredients.data ?? []).map((g) => [g.id, dispUnit(g.baseUnit)])), [ingredients.data]);
  const data = board.data;
  const filt = <X extends { name: string }>(xs: X[]) => {
    const n = squash(query);
    return n === '' ? xs : xs.filter((x) => squash(x.name).includes(n));
  };

  const candidates = useMemo(() => filt(data?.candidates ?? []), [data, query]);
  const waiting = useMemo(() => filt(data?.waiting ?? []), [data, query]);
  const received = useMemo(() => filt(data?.received ?? []), [data, query]);

  const counts = {
    candidate: data?.candidates.length ?? 0,
    waiting: data?.waiting.length ?? 0,
    received: data?.received.length ?? 0,
  };

  const openOrder = (c: OrderCandidate) => {
    router.push(`/orders/place?ingredient=${c.ingredientId}` as Href);
  };

  const submitCancelOrder = () => {
    if (!cancelFor || cancelBusy.current || cancelOrder.isPending) return;
    cancelBusy.current = true;
    cancelOrder.mutate({ orderId: cancelFor.id }, {
      onSuccess: () => { setCancelFor(null); setTab('candidate'); },
      onError: (e) => Alert.alert('취소하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      onSettled: () => { cancelBusy.current = false; },
    });
  };

  const submitRevert = () => {
    if (!revertFor || revertBusy.current || revertInbound.isPending) return;
    revertBusy.current = true;
    revertInbound.mutate({ orderId: revertFor.id, ingredientId: revertFor.ingredientId }, {
      onSuccess: () => setRevertFor(null),
      onError: (e) => Alert.alert('되돌리지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      onSettled: () => { revertBusy.current = false; },
    });
  };

  const TABS: [TabKey, string, number][] = [
    ['candidate', '발주 후보', counts.candidate],
    ['waiting', '입고 예정', counts.waiting],
    ['received', '입고 완료', counts.received],
  ];
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <HubHeader
        testID="ORD-01/header"
        title="발주"
        actions={
          <>
            <HubHeaderAction label="검색" icon="search" selected={searching} onPress={() => { if (searching) setQuery(''); setSearching((v) => !v); }} />
            <HubHeaderAction label="알림" icon="bell" onPress={() => router.push('/my/notifications' as Href)} />
          </>
        }
        below={searching ? <SearchBar value={query} onChange={setQuery} placeholder="재료 이름으로 검색" onClose={() => { setSearching(false); setQuery(''); }} /> : null}
      />

      {/* 3탭 */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3 }}>
        <ScrollTabs tabs={TABS.map(([, label]) => label)} counts={TABS.map(([, , n]) => n)}
          active={TABS.findIndex(([k]) => k === tab)} onChange={(i) => setTab(TABS[i]![0])} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: LAYOUT.scroll.end, gap: space.sm }}>
        <QueryState
          isLoading={board.isLoading}
          error={board.error}
          isEmpty={
            (tab === 'candidate' && candidates.length === 0) ||
            (tab === 'waiting' && waiting.length === 0) ||
            (tab === 'received' && received.length === 0)
          }
          onRetry={() => void board.refetch()}
          emptyTitle={
            query ? `'${query}' 검색 결과가 없어요`
            : tab === 'candidate' ? '지금 발주할 것이 없어요'
            : tab === 'waiting' ? '입고 예정인 발주가 없어요'
            : '입고 완료된 발주가 없어요'
          }
          emptyHint={tab === 'candidate' ? '재고가 최소재고 아래로 내려가면 여기 나타나요' : undefined}
        >
          {tab === 'candidate' ? candidates.map((c) => {
            const unit = dispUnit(c.baseUnit);
            return (
              <Card key={c.ingredientId} pad={0} style={{ overflow: 'hidden' }}>
                <View style={{ paddingVertical: space.md, paddingHorizontal: 16 }}>
                  <View style={{ minHeight: 44 }}>
                    <OrderCardHeading name={c.name}
                      badge={<Badge tone={reasonTone(c.reasons)} solid sm alignSelf="center">
                          {REASON_LABEL[c.reasons[0] ?? 'manual'] ?? '발주 필요'}
                        </Badge>}
                      secondaryBadge={c.status === 'ordered' ? <Badge tone="blue" sm alignSelf="center">발주함</Badge> : null}
                      onPress={() => router.push(`/ingredients/${c.ingredientId}` as Href)}
                    />

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginBottom: space.sm }}>
                      <Text style={{ fontSize: TYPE.caption.fontSize, fontWeight: '700', color: COLOR.text.secondary }}>현재 / 최소 재고</Text>
                      {/* 음수 재고도 원래 수량과 위험 색상을 유지한다. */}
                      <Text style={[{ marginLeft: 'auto', maxWidth: '100%', fontSize: TYPE.body.fontSize, fontWeight: '800', color: COLOR.text.primary }, NUM]}>
                        <Text style={{ color: isNegativeStock(c.stockTotal) ? COLOR.status.negative : COLOR.text.primary }}>{formatQuantity(c.stockTotal, unit, { scale: 'base' }).slice(0, -unit.length)}</Text>
                        {' / '}{formatQuantity(c.safetyTotal, unit, { scale: 'base' }).slice(0, -unit.length)} {unit}
                      </Text>
                    </View>
                  </View>

                  {/* 제목·재고 영역은 상세로 연결하고 주문 버튼은 독립 행동으로 둔다. */}
                  <View style={{ marginTop: space.xs, flexDirection: 'row', gap: space.sm }}>
                    <Button kind="tint" size="sm" style={{ flex: 1 }} onPress={() => setPurchaseLinksFor(c.ingredientId)}>구매링크 열기</Button>
                    <Button kind="primary" size="sm" style={{ flex: 1 }} onPress={() => openOrder(c)}>발주완료</Button>
                  </View>
                </View>
              </Card>
            );
          }) : null}

          {tab === 'waiting' ? waiting.map((w) => {
            const late = isLate(w.expectedAt, today);
            const partial = w.receivedQty > 0;
            // 예정 목록은 이미 받은 수량이 아니라 발주한 전체 수량을 표시한다.
            const pack = packSummaryParts({
              volume: w.volume, qty: w.qty, amount: w.amount,
              fmtQty: (v) => units.has(w.ingredientId) ? formatQuantity(v, units.get(w.ingredientId)!) : '—',
              fmtWon: won,
            });
            return (
              <Card key={w.id} pad={0} style={{ overflow: 'hidden' }}>
                <View style={{ paddingVertical: space.md, paddingHorizontal: 16 }}>
                  <View style={{ minHeight: 44 }}>
                    <OrderCardHeading name={w.name}
                      badge={<Badge tone={late ? 'red' : 'blue'} solid sm alignSelf="center">{late ? '입고지연' : '입고예정'}</Badge>}
                      secondaryBadge={partial ? <Badge tone="amber" sm alignSelf="center">부분입고 {w.receivedQty}/{w.qty}</Badge> : null}
                      onPress={() => router.push(`/ingredients/${w.ingredientId}` as Href)}
                    />
                    <OrderCardDetails date={dueLabel(w.expectedAt, today)} vendor={w.vendorName} pack={pack} late={late} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <Button kind="gray" size="sm" full onPress={() => setCancelFor(w)} style={{ flex: 1 }}>발주 취소</Button>
                    <Button kind="primary" size="sm" full icon="check"
                      onPress={() => router.push(`/orders/receive?order=${w.id}` as Href)} style={{ flex: 1 }}>입고 완료</Button>
                  </View>
                </View>
              </Card>
            );
          }) : null}

          {tab === 'received' ? received.map((d) => {
            const receivedDate = d.receivedAt ? storeDateTimeParts(d.receivedAt, timezone) : null;
            const pack = packSummaryParts({
              volume: d.volume, qty: d.receivedQty, amount: d.amount,
              fmtQty: (v) => units.has(d.ingredientId) ? formatQuantity(v, units.get(d.ingredientId)!) : '—',
              fmtWon: won,
            });
            return (
            <Card key={d.id} pad={0} style={{ overflow: 'hidden' }}>
              <View style={{ paddingVertical: space.md, paddingHorizontal: 16 }}>
                <View style={{ minHeight: 44 }}>
                  <OrderCardHeading name={d.name} badge={<Badge tone="green" solid sm alignSelf="center">입고 완료</Badge>}
                    onPress={() => router.push(`/ingredients/${d.ingredientId}` as Href)} />
                  <OrderCardDetails date={receivedDate ? `${Number(receivedDate.month)}/${Number(receivedDate.day)} 입고` : '입고일 미기록'} vendor={d.vendorName} pack={pack} />
                </View>
                <View style={{ marginTop: 12 }}>
                  <Button kind="gray" size="sm" full onPress={() => setRevertFor(d)}>입고 취소</Button>
                </View>
              </View>
            </Card>
          ); }) : null}
        </QueryState>
      </ScrollView>

      {purchaseLinksFor ? <CandidatePurchaseLinksSheet key={purchaseLinksFor} ingredientId={purchaseLinksFor}
        onClose={() => setPurchaseLinksFor(null)} /> : null}

      <ConfirmDialog visible={cancelFor !== null} title="발주 취소"
        message="취소 시, 발주후보 페이지로 이동합니다."
        confirmText="발주취소" cancelText="닫기" closeLabel="발주 취소 확인 닫기" loading={cancelOrder.isPending}
        onCancel={() => setCancelFor(null)} onConfirm={submitCancelOrder} />
      <ConfirmDialog visible={revertFor !== null} title="입고 취소"
        message="취소 시, 입고된 재고 수량이 다시 차감됩니다."
        confirmText="입고취소" cancelText="닫기" closeLabel="입고 취소 확인 닫기" loading={revertInbound.isPending}
        onCancel={() => setRevertFor(null)} onConfirm={submitRevert} />
    </View>
  );
}
