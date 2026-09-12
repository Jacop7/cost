import { EmptyDataText } from '@/components/kit/EmptyDataText';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, Field, Icon, Input, QueryState, Notice } from '@/components/kit';
import { ResultField } from '@/components/kit/ResultField';
import { COLOR, T, TYPE, radius, space, won } from '@/theme/tokens';
import { formatQuantity, formatUnitPrice } from '@margincook/core';
import { clampDecimals } from '@/lib/num';
import { addDays } from '@/lib/date';
import { useIngredientDetail } from '@/features/ingredients/hooks';
import { dispUnit } from '@/features/ingredients/ledger';
import { usePlaceOrders, type OrderCandidate } from '../hooks';
const NUM = { fontVariant: ['tabular-nums' as const] };
/** 주문 페이지·홈 팝업이 함께 사용하는 실제 E7 입력 폼. */
export function CandidateOrderForm({ candidate: orderFor, localDate: today, onSaved, presentation = 'sheet' }: {
  candidate: OrderCandidate; localDate: string; onSaved: () => void; presentation?: 'page' | 'sheet';
}) {
  const isPage = presentation === 'page';
  const detail = useIngredientDetail(orderFor.ingredientId);
  const placeOrders = usePlaceOrders();
  const [optionId, setOptionId] = useState<string | null>(null);
  const [orderQty, setOrderQty] = useState(String(Math.max(1, Math.ceil(orderFor.recommendedQty))));
  const [expected, setExpected] = useState('1');
  const submitting = useRef(false);
  // First opening may default to the first option; an explicit selection must
  // never silently change vendor/price when that option disappears on refetch.
  const selectedOption = optionId === null
    ? detail.data?.options[0] ?? null
    : detail.data?.options.find((o) => o.id === optionId) ?? null;

  const submitOrder = () => {
    const qty = Number(orderQty) || 0;
    if (submitting.current || placeOrders.isPending || detail.isLoading || detail.error || !Number.isFinite(qty) || qty <= 0) return;
    if (!selectedOption) {
      Alert.alert('구매 옵션이 없어요', '식재료 상세에서 구매 옵션(용량·금액)을 먼저 등록해 주세요.');
      return;
    }
    submitting.current = true;
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
        onSuccess: () => { submitting.current = false; onSaved(); },
        onError: (e) => {
          submitting.current = false;
          Alert.alert('발주하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');
        },
      },
    );
  };


  const notice = (
    <Notice>
      발주는 <Text style={{ fontWeight: '700' }}>기록만</Text> 돼요. 재고와 단가는 ‘입고 완료’를 눌렀을 때 바뀌어요.
    </Notice>
  );
  const content = (
  <View>
    {isPage ? <Card style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, marginBottom: space.xl }}>
        <Text style={{ flex: 1, ...TYPE.body, fontWeight: '700', color: T.ink }}>{orderFor.name}</Text>
        <Text style={{ ...TYPE.body, fontWeight: '700', color: T.ink }}>권장 {orderFor.recommendedQty}개</Text>
      </View>
      {notice}
    </Card> : <>
    <Text style={{ ...TYPE.caption, fontWeight: '600', color: T.sub2, marginBottom: space.md }}>
      {orderFor.name} · 권장 {orderFor.recommendedQty}개
    </Text>
    <View style={{ marginBottom: space.lg, marginHorizontal: space.md }}>{notice}</View>
    </>}

    <View style={isPage ? { backgroundColor: T.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: space.lg } : { marginBottom: space.lg }}>
    {isPage ? <View style={{ padding: space.lg, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <Text style={{ ...TYPE.body, fontWeight: '700', color: T.ink }}>구매 링크</Text>
    </View> : null}
    <QueryState
      isLoading={detail.isLoading}
      error={detail.error}
      isEmpty={false}
      onRetry={() => void detail.refetch()}
        emptyTitle="등록된 구매 링크가 없어요"
      emptyHint="식재료 상세 → 구매 링크·옵션에서 먼저 등록해 주세요"
    >
      {(detail.data?.options.length ?? 0) === 0 ? <View style={{ padding: space.lg }}>
        <EmptyDataText >등록된 구매 링크가 없어요</EmptyDataText>
        <EmptyDataText >식재료 상세 → 구매 링크에서 먼저 등록해 주세요</EmptyDataText>
      </View> : <View>
        {(detail.data?.options ?? []).map((o, index) => {
          const on = selectedOption?.id === o.id;
          const unit = dispUnit(detail.data?.baseUnit ?? 'g');
          return (
            <Pressable
              key={o.id}
              onPress={() => setOptionId(o.id)}
              accessibilityRole="button" accessibilityLabel={o.name} accessibilityState={{ selected: on }} aria-pressed={on}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg, borderBottomWidth: index < (detail.data?.options.length ?? 0) - 1 ? 1 : 0, borderBottomColor: T.line2, backgroundColor: T.surface }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{o.name}, {won(o.amount)}원</Text>
                <Text style={[{ fontSize: 14, color: T.sub2, marginTop: space.xs }, NUM]}>
                  {o.vendorName ?? '거래처 미지정'} · {formatQuantity(o.volume, unit)} · {formatUnitPrice(o.amount / (o.volume || 1), unit)}
                </Text>
              </View>
              {on ? <Icon name="check" size={18} color={COLOR.action.primary} sw={2.4} /> : null}
            </Pressable>
          );
        })}
      </View>}
    </QueryState>
    </View>

    {optionId !== null && !selectedOption && !detail.isLoading && !detail.error ? (
        <Text accessibilityRole="alert" style={{ ...TYPE.caption, color: COLOR.status.negative, marginBottom: space.md }}>
        선택한 구매 링크가 없어졌어요. 구매 링크를 다시 선택해 주세요.
      </Text>
    ) : null}

    <View testID="ORD-01/order-fields" style={{ flexDirection: 'column' }}>
      <View>
        <Field label="발주 수량" req variant="stacked">
          <Input value={orderQty} onChangeText={(t) => setOrderQty(clampDecimals(t, 0))} suffix="개" variant="stacked" mono keyboardType="number-pad" accessibilityLabel="발주 수량" />
        </Field>
      </View>
      <View>
        <Field label={isPage ? '도착 예정' : '도착까지'} variant="stacked">
          <Input value={expected} onChangeText={(t) => setExpected(clampDecimals(t, 0))} suffix="일 후" variant="stacked" mono keyboardType="number-pad" accessibilityLabel="도착까지 일수" />
        </Field>
      </View>
    </View>

    {selectedOption ? (
      <ResultField label="발주 금액" value={`${won(selectedOption.amount * (Number(orderQty) || 0))}원`} />
    ) : null}
  </View>
  );
  const action = (
      <Button
        kind="primary" size="lg" full
        loading={placeOrders.isPending}
        disabled={detail.isLoading || Boolean(detail.error) || !selectedOption || !(Number(orderQty) > 0)}
        onPress={submitOrder}
      >
        발주 등록
      </Button>
  );
  return isPage ? <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">{content}</ScrollView>
    <View testID="ORD-02b/footer" style={{ paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>{action}</View>
  </View> : <View>{content}<View style={{ marginTop: space.lg }}>{action}</View></View>;
}
