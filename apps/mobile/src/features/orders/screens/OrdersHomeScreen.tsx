/**
 * ORD-01 발주 현황 홈 — 3탭: 발주 후보 / 입고 예정 / 입고 완료.
 *
 * ⚠ 절대원칙 2: 발주 등록(E7)은 **기록만** 한다 — 재고·기준단가는 그대로다.
 *   재고가 실제로 늘어나는 건 '입고 완료'(E1)를 눌렀을 때뿐이다. 화면도 그렇게 읽히게 쓴다.
 */
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Badge, Button, Card, Field, HubHeader, HubHeaderAction, Icon, Input, QueryState, ScrollTabs, SearchBar, Sheet } from '@/components/kit';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { ResultField } from '@/components/kit/ResultField';
import { formatQuantity, formatUnitPrice, isNegativeStock } from '@margincook/core';
import { LAYOUT, COLOR, T, won, TYPE, radius, space } from '@/theme/tokens';
import { clampDecimals, packSummary } from '@/lib/num';
import { makeInboundKey } from '@/lib/supabase';
import { useIngredientList, useQuickInboundPreview } from '@/features/ingredients/hooks';
import { CandidateOrderForm } from '../components/CandidateOrderForm';
import { OrderBoardSummary, type OrderSummaryRow } from '../components/OrderBoardSummary';
import { dispUnit } from '@/features/ingredients/ledger';
import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import {
  useCancelOrder,
  useConfirmInbound,
  useOrderBoard,
  useRevertInbound,
  type OrderCandidate,
  type OrderRecord,
} from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

const REASON_LABEL: Record<string, string> = {
  safety_stock: '안전재고 미달',
  soon_out: '소진 임박',
  manual: '직접 추가',
};
const reasonTone = (rs: string[]): 'red' | 'amber' | 'blue' =>
  rs.includes('soon_out') ? 'red' : rs.includes('safety_stock') ? 'amber' : 'blue';

/** 도착 예정일 문구 — 지연이면 며칠 늦었는지 먼저 말한다. */
function dueLabel(expected: string | null, today: string): string {
  if (!expected) return '도착일 미정';
  const md = `${Number(expected.slice(5, 7))}/${Number(expected.slice(8, 10))}`;
  const diff = Math.round((Date.parse(`${expected}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (diff < 0) return `${-diff}일 지연 (${md})`;
  if (diff === 0) return `오늘 도착 (${md})`;
  if (diff === 1) return `내일 도착 (${md})`;
  return `${diff}일 후 도착 (${md})`;
}
const isLate = (expected: string | null, today: string) => Boolean(expected) && expected! < today;

type TabKey = 'candidate' | 'waiting' | 'received';

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
  const router = useRouter();
  const today = localDate;

  const board = useOrderBoard();
  const confirmInbound = useConfirmInbound();
  const cancelOrder = useCancelOrder();
  const revertInbound = useRevertInbound();

  const [tab, setTab] = useState<TabKey>('candidate');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);

  // 주문하기 — 후보에서 구매 옵션을 골라 발주(E7)
  const [orderFor, setOrderFor] = useState<OrderCandidate | null>(null);

  // 입고 확정 — 실제 수량을 확인받는다(부분 입고가 흔하다)
  const [receiveFor, setReceiveFor] = useState<OrderRecord | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [inboundKey, setInboundKey] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<OrderRecord | null>(null);
  const [revertFor, setRevertFor] = useState<OrderRecord | null>(null);
  const cancelBusy = useRef(false);
  const revertBusy = useRef(false);

  // One cached domain query supplies units for all records; never guess that every ingredient is grams.
  const ingredients = useIngredientList();
  const units = useMemo(() => new Map((ingredients.data ?? []).map((g) => [g.id, dispUnit(g.baseUnit)])), [ingredients.data]);
  const receiveUnit = receiveFor ? units.get(receiveFor.ingredientId) : undefined;
  const receivePreview = useQuickInboundPreview(receiveFor?.ingredientId, receiveFor?.volume ?? 0,
    receiveFor?.amount ?? 0, Number(receiveQty));
  const previewValue = (value: number | null | undefined, price = false) => {
    if (receivePreview.isLoading || ingredients.isLoading) return '계산 중';
    if (receivePreview.error || ingredients.error) return '계산 실패';
    if (value == null || !receiveUnit) return '—';
    return price ? formatUnitPrice(value, receiveUnit) : formatQuantity(value, receiveUnit);
  };

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
    setOrderFor(c);
  };


  const openReceive = (w: OrderRecord) => {
    setReceiveFor(w);
    setReceiveQty(String(w.qty - w.receivedQty));
    // 멱등성 키는 **버튼을 누른 시점에 한 번** 만든다. 재시도에는 같은 키를 다시 보내
    // 중복 입고를 막는다(방어는 DB 유니크 인덱스가 한다).
    setInboundKey(makeInboundKey(w.id));
  };

  const submitReceive = () => {
    if (!receiveFor) return;
    const qty = Number(receiveQty) || 0;
    if (qty <= 0) return;
    confirmInbound.mutate(
      {
        orderId: receiveFor.id,
        ingredientId: receiveFor.ingredientId,
        actualQty: qty,
        idempotencyKey: inboundKey ?? undefined,
      },
      {
        onSuccess: (res) => {
          setReceiveFor(null);
          if (res.duplicate) return;
          if (res.priceSpike) {
            Alert.alert(
              '입고 단가가 크게 올랐어요',
              `${receiveFor.name} 단가가 직전 평균보다 20% 이상 높아요. 이 메뉴들의 원가가 함께 올라갑니다.`,
              [{ text: '확인' }],
            );
          }
        },
        onError: (e) => Alert.alert('입고하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  const submitCancelOrder = () => {
    if (!cancelFor || cancelBusy.current || cancelOrder.isPending) return;
    cancelBusy.current = true;
    cancelOrder.mutate({ orderId: cancelFor.id }, {
      onSuccess: () => setCancelFor(null),
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
  const summaryTitle = TABS.find(([key]) => key === tab)![1];
  const summaryRows: OrderSummaryRow[] = tab === 'candidate' ? candidates.map((c) => ({
    id: c.ingredientId, name: c.name,
    description: `${REASON_LABEL[c.reasons[0] ?? 'manual'] ?? '발주 필요'} · 현재 ${formatQuantity(c.stockTotal, dispUnit(c.baseUnit))}`,
    value: `권장 ${c.recommendedQty}개`, onPress: () => openOrder(c),
  })) : tab === 'waiting' ? waiting.map((w) => ({
    id: w.id, name: w.name,
    description: `${dueLabel(w.expectedAt, today)} · ${w.vendorName ?? '구매처 미지정'}${units.has(w.ingredientId) ? ` · 총 ${formatQuantity(w.volume * w.qty, units.get(w.ingredientId)!)}` : ''}${w.receivedQty > 0 ? ` · 부분입고 ${w.receivedQty}/${w.qty}` : ''}`,
    value: `발주 ${w.qty}개`, onPress: () => openReceive(w),
  })) : received.map((d) => ({
    id: d.id, name: d.name,
    // order_board exposes the order date, not the inbound event timestamp.
    description: `발주 ${d.orderedAt.slice(0, 10)} · ${d.vendorName ?? '구매처 미지정'} · ${won(d.amount)}원 × ${d.receivedQty}개`,
    value: d.unitPrice === null || !units.has(d.ingredientId) ? '—' : formatUnitPrice(d.unitPrice, units.get(d.ingredientId)!),
    onPress: () => router.push(`/ingredients/${d.ingredientId}` as Href),
  }));

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
        below={searching ? <SearchBar value={query} onChange={setQuery} placeholder="식재료 이름으로 검색" onClose={() => { setSearching(false); setQuery(''); }} /> : null}
      />

      {/* 3탭 */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3 }}>
        <ScrollTabs tabs={TABS.map(([, label]) => label)} counts={TABS.map(([, , n]) => n)}
          active={TABS.findIndex(([k]) => k === tab)} onChange={(i) => setTab(TABS[i]![0])} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: LAYOUT.scroll.end, gap: space.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${summaryTitle} 목록 보기`}
          onPress={() => setSummaryOpen(true)} disabled={board.isLoading || Boolean(board.error)}
          style={{ alignSelf: 'flex-end', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Text style={{ ...TYPE.caption, color: T.sub }}>목록 보기</Text>
          <Icon name="chevron" size={16} color={T.sub2} />
        </Pressable>
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
          emptyHint={tab === 'candidate' ? '재고가 안전재고 아래로 내려가면 여기 나타나요' : undefined}
        >
          {tab === 'candidate' ? candidates.map((c) => {
            const unit = dispUnit(c.baseUnit);
            return (
              <Card key={c.ingredientId} pad={0} style={{ overflow: 'hidden' }}>
                <View style={{ padding: space.md }}>
                  <Pressable
                    onPress={() => router.push(`/ingredients/${c.ingredientId}` as Href)}
                    accessibilityRole="button" accessibilityLabel={`${c.name} 상세`}
                    style={{ minHeight: 44, gap: space.sm }}
                  >
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                    <Badge tone={reasonTone(c.reasons)} solid sm>
                      {REASON_LABEL[c.reasons[0] ?? 'manual'] ?? '발주 필요'}
                    </Badge>
                    {c.status === 'ordered' ? <Badge tone="blue" sm>발주함</Badge> : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Text style={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{c.name}</Text>
                    <Icon name="chevron" size={18} color={COLOR.text.tertiary} />
                    </View>
                  </Pressable>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: space.md, marginBottom: space.sm }}>
                    <View style={{ flex: 1, paddingVertical: space.sm, paddingHorizontal: 12, backgroundColor: T.surface2, borderRadius: radius.md }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>권장 발주</Text>
                      <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, marginTop: space.xs }, NUM]}>{c.recommendedQty}개</Text>
                    </View>
                    <View style={{ flex: 1, paddingVertical: space.sm, paddingHorizontal: 12, backgroundColor: T.surface2, borderRadius: radius.md }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>현재 재고</Text>
                      {/* ⚠ 발주 후보에서도 음수는 빨강 그대로다(0102). 권장 발주량에 부족분이 들어 있다. */}
                      <Text style={[{ fontSize: 16, fontWeight: isNegativeStock(c.stockTotal) ? '800' : '600', color: isNegativeStock(c.stockTotal) ? COLOR.status.negative : T.sub, marginTop: space.xs }, NUM]}>
                        {formatQuantity(c.stockTotal, unit)}
                      </Text>
                      <Text style={[{ fontSize: 14, color: COLOR.text.tertiary, marginTop: 1 }, NUM]}>
                        안전 {formatQuantity(c.safetyTotal, unit)}
                      </Text>
                    </View>
                  </View>

                  {/* 식재료 상세는 위 제목 줄의 화살표로 간다 — 여기는 행동만 둔다. */}
                  <View style={{ marginTop: space.xs }}>
                    <Button kind="primary" size="sm" full onPress={() => openOrder(c)}>주문하기</Button>
                  </View>
                </View>
              </Card>
            );
          }) : null}

          {tab === 'waiting' ? waiting.map((w) => {
            const late = isLate(w.expectedAt, today);
            const partial = w.receivedQty > 0;
            return (
              <Card key={w.id} pad={0} style={{ overflow: 'hidden' }}>
                <View style={{ padding: space.md }}>
                  <Pressable
                    onPress={() => router.push(`/ingredients/${w.ingredientId}` as Href)}
                    accessibilityRole="button" accessibilityLabel={`${w.name} 상세`}
                    style={{ minHeight: 44, gap: space.sm }}
                  >
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                    <Badge tone={late ? 'red' : 'blue'} solid sm>{late ? '입고지연' : '입고예정'}</Badge>
                    {partial ? <Badge tone="amber" sm>부분입고 {w.receivedQty}/{w.qty}</Badge> : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Text style={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{w.name}</Text>
                    <Icon name="chevron" size={18} color={COLOR.text.tertiary} />
                    </View>
                  </Pressable>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: late ? COLOR.status.negative : T.ink2, marginTop: space.sm }}>
                    {dueLabel(w.expectedAt, today)}
                  </Text>
                  <Text style={[{ fontSize: 16, fontWeight: '600', color: T.sub, marginTop: space.sm }, NUM]}>
                    {/* ⚠ 아직 안 받았다. receivedQty 를 넘기면 '총 0kg' 이 된다 — 주문한 양을 보여 준다. */}
                    {w.vendorName ?? '거래처 미지정'} · {packSummary({
                      volume: w.volume, qty: w.qty, amount: w.amount,
                      fmtQty: (v) => units.has(w.ingredientId) ? formatQuantity(v, units.get(w.ingredientId)!) : '—',
                      fmtWon: won,
                    })}
                    {w.unitPrice !== null && units.has(w.ingredientId) ? ` · ${formatUnitPrice(w.unitPrice, units.get(w.ingredientId)!)}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <Button kind="gray" size="sm" full onPress={() => setCancelFor(w)} style={{ flex: 1 }}>발주 취소</Button>
                    <Button kind="primary" size="sm" full icon="check" onPress={() => openReceive(w)} style={{ flex: 1 }}>입고 완료</Button>
                  </View>
                </View>
              </Card>
            );
          }) : null}

          {tab === 'received' ? received.map((d) => (
            <Card key={d.id} pad={0} style={{ overflow: 'hidden' }}>
              <View style={{ padding: space.md }}>
                <Pressable
                  onPress={() => router.push(`/ingredients/${d.ingredientId}` as Href)}
                  accessibilityRole="button" accessibilityLabel={`${d.name} 상세`}
                  style={{ minHeight: 44, gap: space.sm }}
                >
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  <Badge tone="green" solid sm>입고 완료</Badge>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Text style={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{d.name}</Text>
                  <Icon name="chevron" size={18} color={COLOR.text.tertiary} />
                  </View>
                </Pressable>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink2, marginTop: space.sm }}>
                  발주일 {d.orderedAt.slice(0, 10)}
                </Text>
                <Text style={[{ fontSize: 16, fontWeight: '600', color: T.sub, marginTop: space.sm }, NUM]}>
                  {d.vendorName ?? '거래처 미지정'} · {won(d.amount)}원 × {d.receivedQty}개
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub2 }}>입고 단가</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>
                    {d.unitPrice === null || !units.has(d.ingredientId) ? '—' : formatUnitPrice(d.unitPrice, units.get(d.ingredientId)!)}
                  </Text>
                </View>
                <View style={{ marginTop: 12 }}>
                  <Button kind="gray" size="sm" full onPress={() => setRevertFor(d)}>입고 취소</Button>
                </View>
              </View>
            </Card>
          )) : null}
        </QueryState>
      </ScrollView>

      {/* 주문하기 — 구매 옵션 선택 + 수량 */}
      <OrderBoardSummary visible={summaryOpen} title={summaryTitle} rows={summaryRows} onClose={() => setSummaryOpen(false)} />
      <Sheet
        visible={orderFor !== null}
        onClose={() => setOrderFor(null)}
        title="주문하기"
      >
        {orderFor ? <CandidateOrderForm key={orderFor.ingredientId} candidate={orderFor} localDate={today}
          onSaved={() => { setOrderFor(null); setTab('waiting'); }} /> : null}
      </Sheet>

      {/* 입고 완료 — 실제 수량 확인 */}
      <Sheet
        visible={receiveFor !== null}
        onClose={() => setReceiveFor(null)}
        title="입고 완료"
      >
        {receiveFor ? (
          <View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub2, marginBottom: space.md }}>
              {receiveFor.name} · 발주 {receiveFor.qty}개
            </Text>
            <Field label="실제 입고 수량 (부분 입고 가능)" variant="stacked">
              <Input
                value={receiveQty}
                onChangeText={(t) => setReceiveQty(clampDecimals(t, 0))}
                suffix="개"
                mono
                variant="stacked"
                keyboardType="number-pad"
                accessibilityLabel="실제 입고 수량"
              />
            </Field>
            <ResultField label="입고 후 재고" value={previewValue(receivePreview.data?.stockAfter)} />
            <ResultField label="입고 후 기준단가" value={previewValue(receivePreview.data?.basePriceAfter, true)} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: 12, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: COLOR.action.primaryTint }}>
              <Icon name="info" size={15} color={COLOR.action.primary} />
              <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: TYPE.caption.lineHeight }}>
                저장하면 재고와 기준단가가 바뀌고 연결된 메뉴 원가도 다시 계산돼요.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
              <Button kind="gray" size="lg" full style={{ flex: 1 }} onPress={() => setReceiveFor(null)}>취소</Button>
                <Button kind="primary" size="lg" full style={{ flex: 1 }} loading={confirmInbound.isPending} disabled={!(Number(receiveQty) > 0)} onPress={submitReceive}>
                  입고 확정
                </Button>
            </View>
          </View>
        ) : null}
      </Sheet>
      <ConfirmDialog visible={cancelFor !== null} title="발주 취소"
        message={`${cancelFor?.name ?? ''}\n\n아직 입고되지 않은 발주만 취소할 수 있어요.`}
        confirmText="발주 취소" closeLabel="발주 취소 확인 닫기" loading={cancelOrder.isPending}
        onCancel={() => setCancelFor(null)} onConfirm={submitCancelOrder} />
      <ConfirmDialog visible={revertFor !== null} title="입고 취소"
        message={`${revertFor?.name ?? ''}\n\n재고와 기준단가가 입고 전으로 되돌아가요. 이 재료를 쓰는 메뉴 원가도 함께 바뀝니다.`}
        confirmText="입고 취소" closeLabel="입고 취소 확인 닫기" loading={revertInbound.isPending}
        onCancel={() => setRevertFor(null)} onConfirm={submitRevert} />
    </View>
  );
}
