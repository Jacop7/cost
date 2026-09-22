import { useUnitPriceFormat } from '@/lib/unitPriceFormat';
import { EmptyDataText } from '@/components/kit/EmptyDataText';
import { useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, CalendarDateField, Card, Field, Icon, QueryState, Sheet } from '@/components/kit';
import { DetailPreviewRow } from '@/features/ingredients/components/DetailPreview';
import { PurchaseAmount } from '@/features/ingredients/components/PurchaseAmount';
import { StockChangeOverview } from '@/features/ingredients/components/StockChangeOverview';
import { normalizePurchaseUrl } from '@/features/ingredients/purchaseUrl';
import { COLOR, COMPONENT, LAYOUT, T, TYPE, radius, space, won } from '@/theme/tokens';
import { formatQuantity, recommendedOrderQty, safetyStockShortage } from '@costkeep/core';
import { clampDecimals, formatNumericInput } from '@/lib/num';
import { addDays } from '@/lib/date';
import { useIngredientDetail } from '@/features/ingredients/hooks';
import { dispUnit } from '@/features/ingredients/ledger';
import { usePlaceOrders, type OrderCandidate } from '../hooks';
/** 주문 페이지·홈 팝업이 함께 사용하는 실제 E7 입력 폼. */
export function CandidateOrderForm({ candidate: orderFor, localDate: today, onSaved, presentation = 'page' }: {
  candidate: OrderCandidate; localDate: string; onSaved: () => void; presentation?: 'page' | 'sheet';
}) {
  const formatUnitPrice = useUnitPriceFormat();
  const isPage = presentation === 'page';
  const detail = useIngredientDetail(orderFor.ingredientId);
  const placeOrders = usePlaceOrders();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [quantityDraft, setQuantityDraft] = useState<string | null>(null);
  const [arrivalDate, setArrivalDate] = useState(addDays(today, 1));
  const submitting = useRef(false);
  // 구매처는 사용자가 직접 고른 뒤에만 발주 입력을 연다. 선택한 옵션이
  // 재조회에서 사라져도 다른 옵션으로 자동 대체하지 않는다.
  const selectedOption = optionId
    ? detail.data?.options.find((o) => o.id === optionId) ?? null
    : null;

  const shortage = safetyStockShortage(orderFor.stockTotal, orderFor.safetyTotal);
  const orderQty = quantityDraft ?? (selectedOption ? String(recommendedOrderQty(shortage, selectedOption.volume)) : '');
  const unit = dispUnit(detail.data?.baseUnit ?? orderFor.baseUnit);
  const purchaseUrl = normalizePurchaseUrl(selectedOption?.url ?? '');
  const quantity = Number(orderQty) || 0;
  const arrivalValid = /^\d{4}-\d{2}-\d{2}$/.test(arrivalDate)
    && arrivalDate >= today && arrivalDate <= addDays(today, 3650);
  const arrivalMonthDay = arrivalDate.slice(5).replace('-', '/');
  const arrivalLabel = `${arrivalDate === today ? '오늘 ' : arrivalDate === addDays(today, 1) ? '내일 ' : ''}${arrivalMonthDay}`;
  const openPurchaseLink = () => {
    if (purchaseUrl) void Linking.openURL(purchaseUrl).catch(() => Alert.alert('링크를 열 수 없어요', '주소를 확인한 뒤 다시 시도해 주세요.'));
  };

  const submitOrder = () => {
    const qty = Number(orderQty) || 0;
    if (submitting.current || placeOrders.isPending || detail.isLoading || detail.error || !Number.isFinite(qty) || !Number.isSafeInteger(qty) || qty <= 0 || !arrivalDate) return;
    if (!selectedOption) {
      Alert.alert('구매 옵션이 없어요', '재료 상세에서 구매 옵션(용량·금액)을 먼저 등록해 주세요.');
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
        expectedAt: arrivalDate,
      }],
      {
        onSuccess: (result) => {
          submitting.current = false;
          if (result && !Array.isArray(result) && result.resolved === 'not_recorded') {
            Alert.alert('이전 발주는 저장되지 않았어요', '현재 내용을 확인한 뒤 발주 완료를 다시 눌러 주세요.');
            return;
          }
          onSaved();
        },
        onError: (e) => {
          submitting.current = false;
          Alert.alert('발주하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');
        },
      },
    );
  };


  const content = (
  <View>
    <StockChangeOverview id={orderFor.ingredientId} name={orderFor.name} stock={detail.data?.stockTotal ?? orderFor.stockTotal}
      basePrice={detail.data?.basePrice ?? null} unit={unit} minimumStock={orderFor.safetyTotal} compact inlineSummary />
    <Card pad={space.lg} style={{ marginTop: space.md }}>
    <Field label="구매처" req variant="stacked">
      <Pressable accessibilityRole="button" accessibilityLabel="구매처 선택" accessibilityState={{ expanded: pickerOpen }}
        onPress={() => setPickerOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm,
          minHeight: COMPONENT.stackedForm.controlMinHeight, padding: space.md, borderWidth: 1, borderColor: T.line,
          borderRadius: radius.md, backgroundColor: selectedOption ? T.surface : T.line }}>
        <Text style={{ flex: 1, ...TYPE.body, fontWeight: '700', color: selectedOption ? T.ink : COLOR.text.tertiary }}>
          {selectedOption ? `${selectedOption.vendorName ?? '구매처 미지정'} · ${selectedOption.name}` : '미 선택'}
        </Text>
        <Icon name="chevronDown" size={16} color={COLOR.text.tertiary} />
      </Pressable>
    </Field>
    <QueryState isLoading={detail.isLoading} error={detail.error} isEmpty={false} onRetry={() => void detail.refetch()} emptyTitle="등록된 구매 링크가 없어요">
      {selectedOption ? <Field label="구매 링크" variant="stacked">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm,
          minHeight: COMPONENT.stackedForm.controlMinHeight, paddingHorizontal: COMPONENT.stackedForm.controlPaddingHorizontal,
          borderWidth: 1, borderColor: COMPONENT.input.border.default, borderRadius: radius.md, backgroundColor: T.line }}>
          <Text numberOfLines={2} style={{ flex: 1, minWidth: 0, ...TYPE.caption, color: COLOR.text.accent, textDecorationLine: purchaseUrl ? 'underline' : 'none' }}>
            {purchaseUrl ?? '등록된 구매 링크가 없어요'}
          </Text>
          <Button kind="primary" size="sm" presentation="status" style={{ borderRadius: radius.sm, minHeight: 32 }} accessibilityLabel="구매 링크 열기" disabled={!purchaseUrl}
            onPress={openPurchaseLink}><Text style={{ fontSize: TYPE.caption.fontSize - 1 }}>링크 열기</Text></Button>
        </View>
      </Field> : null}
    </QueryState>
    <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="구매처 선택">
      <DetailPreviewRow title="미 선택" value="" accessibilityLabel="미 선택"
        last={!detail.data?.options.length}
        titleStyle={{ color: COLOR.text.tertiary }}
        onPress={() => { setOptionId(null); setQuantityDraft(null); setPickerOpen(false); }} />
      {(detail.data?.options ?? []).map((o, index) => <DetailPreviewRow key={o.id}
        title={o.brandName ?? o.vendorName ?? '구매처 미지정'}
        subAfter={<PurchaseAmount>{`${won(o.amount)}원`}</PurchaseAmount>}
        value={formatQuantity(o.volume, unit)} detail={o.volume > 0 ? formatUnitPrice(o.amount / o.volume, unit) : '단가 산출 전'}
        showChevron accessibilityLabel={o.name} last={index === (detail.data?.options.length ?? 0) - 1}
        onPress={() => {
          setOptionId(o.id); setQuantityDraft(null); setPickerOpen(false);
        }} />)}
      {!detail.data?.options.length ? <EmptyDataText>등록된 구매 링크가 없어요</EmptyDataText> : null}
    </Sheet>

    {optionId !== null && !selectedOption && !detail.isLoading && !detail.error ? (
        <Text accessibilityRole="alert" style={{ ...TYPE.caption, color: COLOR.status.negative, marginBottom: space.md }}>
        선택한 구매 링크가 없어졌어요. 구매 링크를 다시 선택해 주세요.
      </Text>
    ) : null}

    {selectedOption ? <View testID="ORD-01/order-fields" style={{ flexDirection: 'column' }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
      <View style={{ flex: 1 }}><Field label="용량" variant="stacked">
        <View style={{ minHeight: COMPONENT.stackedForm.controlMinHeight, paddingHorizontal: space.md,
          borderRadius: radius.md, backgroundColor: T.surface2, justifyContent: 'center' }}>
          <Text style={{ ...TYPE.body, textAlign: 'right', fontWeight: '700', color: COLOR.text.primary }}>{formatQuantity(selectedOption.volume, unit)}</Text>
        </View>
      </Field></View>
      <View style={{ flex: 1 }}><Field label="발주 수량" req variant="stacked">
        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.line,
          borderRadius: radius.md, backgroundColor: T.surface, minHeight: COMPONENT.stackedForm.controlMinHeight }}>
          <Pressable accessibilityRole="button" accessibilityLabel="수량 줄이기" disabled={quantity <= 1}
            onPress={() => setQuantityDraft(String(Math.max(1, quantity - 1)))}
            style={{ width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="minus" size={16} color={T.sub} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs }}>
            <TextInput value={formatNumericInput(orderQty)} onChangeText={(t) => setQuantityDraft(clampDecimals(t, 0))}
              keyboardType="number-pad" accessibilityLabel="발주 수량"
              style={{ ...TYPE.body, width: Math.max(28, orderQty.length * TYPE.body.fontSize * 0.65), maxWidth: '80%',
                padding: 0, minHeight: 48, textAlign: 'center', fontWeight: '800', color: T.ink }} />
            <Text style={{ ...TYPE.caption, color: T.sub }}>개</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="수량 늘리기"
            onPress={() => setQuantityDraft(String(quantity + 1))}
            style={{ width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={16} color={COLOR.action.primary} />
          </Pressable>
        </View>
      </Field></View></View>
      <View style={{ marginVertical: space.md, padding: space.md, borderRadius: radius.md,
        backgroundColor: COLOR.action.primaryTint, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View><Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>발주 금액</Text>
          <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary, marginTop: space.xs }}>총 발주량 {formatQuantity(selectedOption.volume * quantity, unit)}</Text></View>
        <Text style={{ ...TYPE.body, fontWeight: '800', color: COLOR.text.accent }}>{won(selectedOption.amount * quantity)}원</Text>
      </View>
      <CalendarDateField value={arrivalDate} onChange={setArrivalDate} label="도착일"
        minDate={today} maxDate={addDays(today, 3650)} disabled={placeOrders.isPending}
        presentation="row" displayValue={arrivalLabel} />
      {!arrivalValid ? <Text accessibilityRole="alert" style={{ ...TYPE.captionSm, color: COLOR.status.negative }}>
        오늘부터 10년 안의 도착일을 선택해 주세요.
      </Text> : null}
    </View> : null}
    </Card>

  </View>
  );
  const action = (
      <Button
        kind="primary" size="lg" full
        loading={placeOrders.isPending}
        disabled={detail.isLoading || Boolean(detail.error) || !selectedOption || !Number.isSafeInteger(quantity) || quantity <= 0 || !arrivalValid}
        onPress={submitOrder}
      >
        발주 완료
      </Button>
  );
  return isPage ? <View style={{ flex: 1 }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">{content}</ScrollView>
    <View testID="ORD-02b/footer" style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: LAYOUT.scroll.end, backgroundColor: T.surface }}>{action}</View>
  </View> : <View>{content}<View style={{ marginTop: space.lg }}>{action}</View></View>;
}
