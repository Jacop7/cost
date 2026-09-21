import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, CalendarDateField, Field, Icon, Notice } from '@/components/kit';
import { StockResultField as ResultField } from '@/features/ingredients/components/StockResultField';
import { StockChangeOverview } from '@/features/ingredients/components/StockChangeOverview';
import {
  InventoryOccurrenceFields,
  emptyInventoryOccurrence,
  inventoryOccurrenceInput,
  inventoryOccurrenceReady,
} from '@/features/ingredients/components/InventoryOccurrenceFields';
import { useIngredientDetail, useInventoryOccurrenceContext, useQuickInboundPreview } from '@/features/ingredients/hooks';
import { dispUnit } from '@/features/ingredients/ledger';
import { useUnitPriceFormat } from '@/lib/unitPriceFormat';
import { clampDecimals, formatNumericInput } from '@/lib/num';
import { makeInboundKey } from '@/lib/supabase';
import { storeDateTimeParts } from '@/lib/date';
import { formatQuantity } from '@costkeep/core';
import { COLOR, COMPONENT, LAYOUT, T, TYPE, radius, space, won } from '@/theme/tokens';
import { useConfirmInbound, type OrderRecord } from '../hooks';

type RefreshOrder = () => Promise<OrderRecord | undefined>;

/** 발주값을 그대로 불러와 실제 입고 수량과 도착일만 확인·수정하는 ORD-03 페이지 폼. */
export function InboundOrderForm({ initialOrder, localDate, onSaved, refreshOrder }: {
  initialOrder: OrderRecord;
  localDate: string;
  onSaved: () => void;
  refreshOrder?: RefreshOrder;
}) {
  const formatUnitPrice = useUnitPriceFormat();
  const confirmInbound = useConfirmInbound();
  const [order, setOrder] = useState(initialOrder);
  const [quantityDraft, setQuantityDraft] = useState(String(Math.max(0, initialOrder.qty - initialOrder.receivedQty)));
  const [arrivalDate, setArrivalDate] = useState(initialOrder.expectedAt ?? localDate);
  const [inboundKey, setInboundKey] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [needsCheck, setNeedsCheck] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [occurrence, setOccurrence] = useState(emptyInventoryOccurrence);
  const busy = useRef(false);
  const generation = useRef(0);

  const detail = useIngredientDetail(order.ingredientId);
  const occurrenceContext = useInventoryOccurrenceContext(order.ingredientId);
  const unit = dispUnit(detail.data?.baseUnit ?? 'g');
  const remaining = Math.max(0, order.qty - order.receivedQty);
  const quantity = Number(quantityDraft);
  const quantityValid = Number.isSafeInteger(quantity) && quantity > 0 && quantity <= remaining;
  const quantityError = quantity > remaining ? `남은 입고 수량 ${remaining}개 이하로 입력해 주세요.` : undefined;
  const arrivalValid = /^\d{4}-\d{2}-\d{2}$/.test(arrivalDate) && arrivalDate <= localDate;
  const occurrenceReady = !occurrenceContext.isLoading && !occurrenceContext.error
    && inventoryOccurrenceReady(occurrenceContext.data, occurrence);
  const preview = useQuickInboundPreview(order.ingredientId, order.volume, order.amount,
    quantityValid && !needsCheck && !checking ? quantity : 0);
  const currentTime = useMemo(() => {
    const context = occurrenceContext.data;
    const parts = context?.serverNow ? storeDateTimeParts(context.serverNow, context.timezone) : null;
    return parts ? `${parts.hour}:${parts.minute}` : null;
  }, [occurrenceContext.data]);

  const previewValue = (value: number | null | undefined, price = false) => {
    if (!quantityValid || needsCheck || checking) return '—';
    if (preview.isLoading || detail.isLoading) return '계산 중';
    if (preview.error || detail.error) return '계산 실패';
    if (value == null) return '—';
    return price ? formatUnitPrice(value, unit) : formatQuantity(value, unit);
  };

  const checkPending = async (refresh = false) => {
    if (busy.current) return;
    const run = ++generation.current;
    busy.current = true;
    setChecking(true);
    try {
      const resolution = await confirmInbound.resolvePending({ orderId: order.id, ingredientId: order.ingredientId });
      const latest = refreshOrder ? await refreshOrder() : order;
      if (run !== generation.current) return;
      if (!latest) throw Error('발주 상태가 변경됐어요. 목록에서 다시 확인해 주세요.');
      setOrder(latest);
      setQuantityDraft(String(Math.max(0, latest.qty - latest.receivedQty)));
      if (resolution || refresh) {
        setMessage(resolution?.resolved === 'recorded'
          ? '이전 요청의 입고 기록을 확인했어요. 현재 남은 수량을 확인해 주세요.'
          : '이전 요청 확인을 마쳤어요. 현재 수량을 확인한 뒤 새 입고를 입력해 주세요.');
      }
      setNeedsCheck(false);
      setInboundKey(makeInboundKey(order.id));
    } catch (error) {
      if (run !== generation.current) return;
      setNeedsCheck(true);
      setMessage(error instanceof Error ? error.message : '이전 입고를 확인하지 못했어요.');
    } finally {
      if (run === generation.current) {
        busy.current = false;
        setChecking(false);
      }
    }
  };

  useEffect(() => {
    void checkPending();
    return () => { generation.current += 1; };
    // The order id is the page identity. Refetches are handled explicitly by checkPending.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrder.id]);

  const submit = () => {
    if (busy.current || confirmInbound.isPending) return;
    if (needsCheck) { void checkPending(true); return; }
    if (!quantityValid || !arrivalValid || !occurrenceReady || !inboundKey) return;
    const selectedOccurrence = inventoryOccurrenceInput(occurrenceContext.data, occurrence);
    const datedOccurrence = Object.keys(selectedOccurrence).length > 0
      ? selectedOccurrence
      : arrivalDate < localDate && currentTime
        ? { occurredDate: arrivalDate, occurredTime: currentTime }
        : {};
    busy.current = true;
    confirmInbound.mutate({
      orderId: order.id,
      ingredientId: order.ingredientId,
      actualQty: quantity,
      idempotencyKey: inboundKey,
      ...datedOccurrence,
    }, {
      onSuccess: (result) => {
        busy.current = false;
        if ('resolved' in result) {
          setNeedsCheck(true);
          setMessage(result.resolved === 'recorded'
            ? '이전 요청의 입고 기록을 확인했어요. 현재 남은 수량을 다시 확인해 주세요.'
            : '이전 요청은 반영되지 않았어요. 최신 수량을 다시 확인해 주세요.');
          return;
        }
        if (result.alreadyReceived || (typeof result.receivedQty === 'number' && result.receivedQty !== quantity)) {
          Alert.alert('입고 결과 확인', `현재 남은 발주량 기준으로 ${result.receivedQty}개가 반영됐어요. 목록에서 최신 수량을 확인해 주세요.`);
        }
        onSaved();
      },
      onError: (error) => {
        busy.current = false;
        setNeedsCheck(true);
        setMessage('이전 입고의 반영 여부를 먼저 확인해 주세요.');
        Alert.alert('입고 결과 확인 필요', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요');
      },
    });
  };

  const arrivalError = arrivalDate && /^\d{4}-\d{2}-\d{2}$/.test(arrivalDate) && arrivalDate > localDate
    ? '미래 날짜로는 입고를 완료할 수 없어요.'
    : !arrivalValid ? '도착일을 YYYY-MM-DD 형식으로 입력해 주세요.' : undefined;
  const totalAmount = order.amount * (Number.isFinite(quantity) ? quantity : 0);

  const content = <View>
    <StockChangeOverview id={order.ingredientId} name={order.name}
      stock={detail.data?.stockTotal ?? 0} basePrice={detail.data?.basePrice ?? null}
      unit={unit} minimumStock={detail.data?.safetyStock ?? 0} />
    <Field label="구매처" variant="stacked">
      <View style={{ minHeight: COMPONENT.stackedForm.controlMinHeight, paddingHorizontal: COMPONENT.stackedForm.controlPaddingHorizontal,
        justifyContent: 'center', borderWidth: 1, borderColor: COMPONENT.input.border.default,
        borderRadius: radius.md, backgroundColor: T.line }}>
        <Text style={{ ...COMPONENT.stackedForm.value, color: COLOR.text.primary }}>{order.vendorName ?? '구매처 미지정'}</Text>
      </View>
    </Field>
    <View testID="ORD-03/inbound-fields" style={{ flexDirection: 'column' }}>
      <ResultField label="용량" value={formatQuantity(order.volume, unit)} />
      <Field label="입고 수량" req variant="stacked" error={quantityError}>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.line,
          borderRadius: radius.md, backgroundColor: T.surface, minHeight: COMPONENT.stackedForm.controlMinHeight }}>
          <Pressable accessibilityRole="button" accessibilityLabel="수량 줄이기" disabled={quantity <= 1 || checking}
            onPress={() => setQuantityDraft(String(Math.max(1, quantity - 1)))}
            style={{ width: 50, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="minus" size={16} color={COLOR.text.tertiary} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs }}>
            <TextInput value={formatNumericInput(quantityDraft)} onChangeText={(value) => setQuantityDraft(clampDecimals(value, 0))}
              keyboardType="number-pad" accessibilityLabel="입고 수량" editable={!checking && !confirmInbound.isPending}
              style={{ ...TYPE.body, width: Math.max(28, quantityDraft.length * TYPE.body.fontSize * 0.65), maxWidth: '80%',
                padding: 0, minHeight: 48, textAlign: 'center', fontWeight: '800', color: COLOR.text.primary }} />
            <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>개</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="수량 늘리기" disabled={quantity >= remaining || checking}
            onPress={() => setQuantityDraft(String(Math.min(remaining, quantity + 1)))}
            style={{ width: 50, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={16} color={COLOR.action.primary} />
          </Pressable>
        </View>
      </Field>
      <View testID="ORD-03/results" style={{ flexDirection: 'column' }}>
        <ResultField label="총 입고량" value={quantityValid ? formatQuantity(order.volume * quantity, unit) : '—'} />
        <ResultField label="입고 후 재고" value={previewValue(preview.data?.stockAfter)} />
        <ResultField label="입고 금액" value={quantityValid ? `${won(totalAmount)}원` : '—'} />
        <ResultField label="입고 후 단가" value={previewValue(preview.data?.basePriceAfter, true)} />
      </View>
      <Field label="도착일" req variant="stacked" error={arrivalError}>
        <CalendarDateField value={arrivalDate} onChange={setArrivalDate} label="도착일"
          maxDate={localDate} disabled={checking || confirmInbound.isPending} />
      </Field>
      <InventoryOccurrenceFields context={occurrenceContext.data} value={occurrence}
        disabled={confirmInbound.isPending || checking} onChange={setOccurrence} />
      {occurrenceContext.error ? <Notice>실사 시점을 확인하지 못했어요. 다시 불러온 뒤 입고를 완료해 주세요.</Notice> : null}
      {message || checking ? <Notice>{message ?? '이전 입고 요청을 확인하고 있어요.'}</Notice> : null}
    </View>
  </View>;

  return <View style={{ flex: 1 }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
      {content}
    </ScrollView>
    <View testID="ORD-03/footer" style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: LAYOUT.scroll.end, backgroundColor: T.surface }}>
      <Button kind="primary" size="lg" full loading={confirmInbound.isPending || checking || occurrenceContext.isLoading}
        disabled={checking || occurrenceContext.isLoading || (!needsCheck && (!quantityValid || !arrivalValid || !occurrenceReady || !currentTime))}
        onPress={submit}>
        {needsCheck && !checking ? '이전 입고 확인' : '입고 완료'}
      </Button>
    </View>
  </View>;
}
