/**
 * ORD-01 발주 현황 홈 — 3탭: 발주 후보 / 입고 예정 / 입고 완료.
 *
 * ⚠ 절대원칙 2: 발주 등록(E7)은 **기록만** 한다 — 재고·기준단가는 그대로다.
 *   재고가 실제로 늘어나는 건 '입고 완료'(E1)를 눌렀을 때뿐이다. 화면도 그렇게 읽히게 쓴다.
 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, Field, Icon, Input, QueryState, SearchBar, Sheet } from '@/components/kit';
import { formatQuantity, formatUnitPrice } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';
import { makeInboundKey } from '@/lib/supabase';
import { useIngredientDetail } from '@/features/ingredients/hooks';
import { dispUnit } from '@/features/ingredients/ledger';
import { addDays, todayBusiness } from '@/features/sales/period';
import {
  useCancelOrder,
  useConfirmInbound,
  useOrderBoard,
  usePlaceOrders,
  useRevertInbound,
  type OrderCandidate,
  type OrderRecord,
} from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

const REASON_LABEL: Record<string, string> = {
  safety_stock: '안전재고 미달',
  soon_out: '소진 임박',
  recipe: '레시피 계산',
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

export default function OrdersHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const today = todayBusiness();

  const board = useOrderBoard();
  const placeOrders = usePlaceOrders();
  const confirmInbound = useConfirmInbound();
  const cancelOrder = useCancelOrder();
  const revertInbound = useRevertInbound();

  const [tab, setTab] = useState<TabKey>('candidate');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  // 주문하기 — 후보에서 구매 옵션을 골라 발주(E7)
  const [orderFor, setOrderFor] = useState<OrderCandidate | null>(null);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [orderQty, setOrderQty] = useState('1');
  const [expected, setExpected] = useState('1');

  // 입고 확정 — 실제 수량을 확인받는다(부분 입고가 흔하다)
  const [receiveFor, setReceiveFor] = useState<OrderRecord | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [inboundKey, setInboundKey] = useState<string | null>(null);

  const detail = useIngredientDetail(orderFor?.ingredientId);

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
    setOptionId(null);
    setOrderQty(String(Math.max(1, Math.ceil(c.recommendedQty))));
    setExpected('1');
  };

  const selectedOption = detail.data?.options.find((o) => o.id === optionId) ?? detail.data?.options[0] ?? null;

  const submitOrder = () => {
    if (!orderFor) return;
    const qty = Number(orderQty) || 0;
    if (qty <= 0) return;
    if (!selectedOption) {
      Alert.alert('구매 옵션이 없어요', '식재료 상세에서 구매 옵션(용량·금액)을 먼저 등록해 주세요.');
      return;
    }
    placeOrders.mutate(
      [{
        ingredientId: orderFor.ingredientId,
        vendorId: selectedOption.vendorId,
        volume: selectedOption.volume,
        amount: selectedOption.amount,
        qty,
        expectedAt: addDays(today, Math.max(0, Number(expected) || 0)),
      }],
      {
        onSuccess: () => { setOrderFor(null); setTab('waiting'); },
        onError: (e) => Alert.alert('발주하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
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

  const confirmCancelOrder = (w: OrderRecord) => {
    Alert.alert(`${w.name} 발주 취소`, '아직 입고되지 않은 발주만 취소할 수 있어요.', [
      { text: '닫기', style: 'cancel' },
      {
        text: '발주 취소',
        style: 'destructive',
        onPress: () => cancelOrder.mutate({ orderId: w.id }, {
          onError: (e) => Alert.alert('취소하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
        }),
      },
    ]);
  };

  const confirmRevert = (d: OrderRecord) => {
    Alert.alert(
      `${d.name} 입고 취소`,
      '재고와 기준단가가 입고 전으로 되돌아가요. 이 재료를 쓰는 메뉴 원가도 함께 바뀝니다.',
      [
        { text: '닫기', style: 'cancel' },
        {
          text: '입고 취소',
          style: 'destructive',
          onPress: () => revertInbound.mutate({ orderId: d.id, ingredientId: d.ingredientId }, {
            onError: (e) => Alert.alert('되돌리지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
          }),
        },
      ],
    );
  };

  const TABS: [TabKey, string, number][] = [
    ['candidate', '발주 후보', counts.candidate],
    ['waiting', '입고 예정', counts.waiting],
    ['received', '입고 완료', counts.received],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ paddingTop: insets.top, backgroundColor: T.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingTop: 6, paddingBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }}>발주</Text>
          <Pressable
            onPress={() => setSearching((v) => !v)}
            accessibilityRole="button" accessibilityLabel="검색" accessibilityState={{ selected: searching }}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="search" size={23} color={searching ? T.blue : T.ink2} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/my/notifications' as Href)}
            accessibilityRole="button" accessibilityLabel="알림"
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="bell" size={24} color={T.ink2} />
          </Pressable>
        </View>
        {searching ? (
          <SearchBar value={query} onChange={setQuery} placeholder="식재료 이름으로 검색" onClose={() => { setSearching(false); setQuery(''); }} />
        ) : null}
      </View>

      {/* 3탭 */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3 }}>
        <View style={{ flexDirection: 'row', gap: 22, paddingHorizontal: 20 }}>
          {TABS.map(([k, label, n]) => {
            const on = tab === k;
            return (
              <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityLabel={`${label} ${n}건`} accessibilityState={{ selected: on }} style={{ paddingBottom: 11 }}>
                <Text style={{ fontSize: 16, fontWeight: on ? '700' : '600', color: on ? T.ink : T.ter }}>
                  {label} <Text style={[{ color: on ? T.blue : T.ter }, NUM]}>{n}</Text>
                </Text>
                {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2.5, backgroundColor: T.ink, borderRadius: 2 }} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 10 }}>
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
                <View style={{ padding: 14 }}>
                  <Pressable
                    onPress={() => router.push(`/ingredients/${c.ingredientId}` as Href)}
                    accessibilityRole="button" accessibilityLabel={`${c.name} 상세`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
                  >
                    <Badge tone={reasonTone(c.reasons)} solid sm>
                      {REASON_LABEL[c.reasons[0] ?? 'manual'] ?? '발주 필요'}
                    </Badge>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{c.name}</Text>
                    {c.status === 'ordered' ? <Badge tone="blue" sm>발주함</Badge> : null}
                    <Icon name="chevron" size={18} color={T.ter} />
                  </Pressable>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 11, marginBottom: 10 }}>
                    <View style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: T.surface2, borderRadius: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>권장 발주</Text>
                      <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, marginTop: 3 }, NUM]}>{c.recommendedQty}개</Text>
                    </View>
                    <View style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: T.surface2, borderRadius: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>현재 재고</Text>
                      <Text style={[{ fontSize: 16, fontWeight: '600', color: T.sub, marginTop: 3 }, NUM]}>
                        {formatQuantity(c.stockTotal, unit)}
                      </Text>
                      <Text style={[{ fontSize: 14, color: T.ter, marginTop: 1 }, NUM]}>
                        안전 {formatQuantity(c.safetyTotal, unit)}
                      </Text>
                    </View>
                  </View>

                  {/* 식재료 상세는 위 제목 줄의 화살표로 간다 — 여기는 행동만 둔다. */}
                  <View style={{ marginTop: 2 }}>
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
                <View style={{ padding: 14 }}>
                  <Pressable
                    onPress={() => router.push(`/ingredients/${w.ingredientId}` as Href)}
                    accessibilityRole="button" accessibilityLabel={`${w.name} 상세`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Badge tone={late ? 'red' : 'blue'} solid sm>{late ? '입고지연' : '입고예정'}</Badge>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{w.name}</Text>
                    {partial ? <Badge tone="amber" sm>부분입고 {w.receivedQty}/{w.qty}</Badge> : null}
                    <Icon name="chevron" size={18} color={T.ter} />
                  </Pressable>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: late ? T.red : T.ink2, marginTop: 9 }}>
                    {dueLabel(w.expectedAt, today)}
                  </Text>
                  <Text style={[{ fontSize: 16, fontWeight: '600', color: T.sub, marginTop: 7 }, NUM]}>
                    {w.vendorName ?? '거래처 미지정'} · {won(w.amount)}원 × {w.qty}개
                    {w.unitPrice !== null ? ` · ${formatUnitPrice(w.unitPrice, dispUnit('g'))}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <Button kind="gray" size="sm" full onPress={() => confirmCancelOrder(w)} style={{ flex: 1 }}>발주 취소</Button>
                    <Button kind="primary" size="sm" full icon="check" onPress={() => openReceive(w)} style={{ flex: 1 }}>입고 완료</Button>
                  </View>
                </View>
              </Card>
            );
          }) : null}

          {tab === 'received' ? received.map((d) => (
            <Card key={d.id} pad={0} style={{ overflow: 'hidden' }}>
              <View style={{ padding: 14 }}>
                <Pressable
                  onPress={() => router.push(`/ingredients/${d.ingredientId}` as Href)}
                  accessibilityRole="button" accessibilityLabel={`${d.name} 상세`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Badge tone="green" solid sm>입고 완료</Badge>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{d.name}</Text>
                  <Icon name="chevron" size={18} color={T.ter} />
                </Pressable>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink2, marginTop: 9 }}>
                  입고 완료 ({Number(d.orderedAt.slice(5, 7))}/{Number(d.orderedAt.slice(8, 10))})
                </Text>
                <Text style={[{ fontSize: 16, fontWeight: '600', color: T.sub, marginTop: 7 }, NUM]}>
                  {d.vendorName ?? '거래처 미지정'} · {won(d.amount)}원 × {d.receivedQty}개
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub2 }}>입고 단가</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>
                    {d.unitPrice === null ? '—' : `${Math.round(d.unitPrice * 100) / 100}원`}
                  </Text>
                </View>
                <View style={{ marginTop: 12 }}>
                  <Button kind="danger" size="sm" full onPress={() => confirmRevert(d)}>입고 취소</Button>
                </View>
              </View>
            </Card>
          )) : null}
        </QueryState>
      </ScrollView>

      {/* 주문하기 — 구매 옵션 선택 + 수량 */}
      <Sheet
        visible={orderFor !== null}
        onClose={() => setOrderFor(null)}
        title="주문하기"
        sub={orderFor ? `${orderFor.name} · 권장 ${orderFor.recommendedQty}개` : undefined}
        height={600}
      >
        {orderFor ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 12, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 10, backgroundColor: T.blueTint }}>
              <Icon name="info" size={15} color={T.blue} />
              <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: 20 }}>
                발주는 <Text style={{ fontWeight: '700' }}>기록만</Text> 돼요. 재고와 단가는 ‘입고 완료’를 눌렀을 때 바뀌어요.
              </Text>
            </View>

            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub2, marginBottom: 8 }}>구매 옵션</Text>
            <QueryState
              isLoading={detail.isLoading}
              error={detail.error}
              isEmpty={(detail.data?.options.length ?? 0) === 0}
              onRetry={() => void detail.refetch()}
              emptyTitle="등록된 구매 옵션이 없어요"
              emptyHint="식재료 상세 → 구매 링크·옵션에서 먼저 등록해 주세요"
            >
              <View style={{ gap: 8, marginBottom: 14 }}>
                {(detail.data?.options ?? []).map((o) => {
                  const on = (optionId ?? detail.data?.options[0]?.id) === o.id;
                  const unit = dispUnit(detail.data?.baseUnit ?? 'g');
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => setOptionId(o.id)}
                      accessibilityRole="button" accessibilityLabel={o.name} accessibilityState={{ selected: on }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{o.name}, {won(o.amount)}원</Text>
                        <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 3 }, NUM]}>
                          {o.vendorName ?? '거래처 미지정'} · {formatQuantity(o.volume, unit)} · {formatUnitPrice(o.amount / (o.volume || 1), unit)}
                        </Text>
                      </View>
                      {on ? <Icon name="check" size={18} color={T.blue} sw={2.4} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </QueryState>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="발주 수량" req>
                  <Input value={orderQty} onChangeText={(t) => setOrderQty(clampDecimals(t, 0))} suffix="개" mono keyboardType="number-pad" accessibilityLabel="발주 수량" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="도착까지" hint="오늘부터">
                  <Input value={expected} onChangeText={(t) => setExpected(clampDecimals(t, 0))} suffix="일 후" mono keyboardType="number-pad" accessibilityLabel="도착까지 일수" />
                </Field>
              </View>
            </View>

            {selectedOption ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, borderRadius: 12, backgroundColor: T.surface2 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.sub }}>발주 금액</Text>
                <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink }, NUM]}>
                  {won(selectedOption.amount * (Number(orderQty) || 0))}원
                </Text>
              </View>
            ) : null}

            <View style={{ marginTop: 18 }}>
              <Button
                kind="primary" size="lg" full
                loading={placeOrders.isPending}
                disabled={!selectedOption || !(Number(orderQty) > 0)}
                onPress={submitOrder}
              >
                발주 등록
              </Button>
            </View>
          </View>
        ) : null}
      </Sheet>

      {/* 입고 완료 — 실제 수량 확인 */}
      <Sheet
        visible={receiveFor !== null}
        onClose={() => setReceiveFor(null)}
        title="입고 완료"
        sub={receiveFor ? `${receiveFor.name} · 발주 ${receiveFor.qty}개` : undefined}
        height={430}
      >
        {receiveFor ? (
          <View>
            <Field label="실제 입고 수량" req hint="주문보다 적게 왔으면 온 만큼만 적어 주세요(부분 입고)">
              <Input
                value={receiveQty}
                onChangeText={(t) => setReceiveQty(clampDecimals(t, 0))}
                suffix="개"
                mono
                keyboardType="number-pad"
                accessibilityLabel="실제 입고 수량"
              />
            </Field>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: T.blueTint }}>
              <Icon name="info" size={15} color={T.blue} />
              <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: 20 }}>
                저장하면 재고가 늘고 기준단가가 다시 계산돼요. 이 재료를 쓰는 메뉴 원가도 함께 바뀝니다.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 18 }}>
              <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={() => setReceiveFor(null)}>취소</Button></View>
              <View style={{ flex: 2 }}>
                <Button kind="primary" size="lg" full loading={confirmInbound.isPending} disabled={!(Number(receiveQty) > 0)} onPress={submitReceive}>
                  입고 확정
                </Button>
              </View>
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
