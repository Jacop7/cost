import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { formatQuantity, recommendedOrderQty, safetyStockShortage } from '@costkeep/core';
import { AppHeader, Button, Card, Field, Icon, QueryState, Sheet } from '@/components/kit';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { useIngredientDetail } from '@/features/ingredients/hooks';
import { dispUnit } from '@/features/ingredients/ledger';
import { addDays } from '@/lib/date';
import { clampDecimals, formatNumericInput } from '@/lib/num';
import { safeBack } from '@/lib/nav';
import { COLOR, COMPONENT, LAYOUT, T, TYPE, radius, space, won } from '@/theme/tokens';
import { useOrderBoard, usePlaceOrders, type OrderCandidate, type PlaceOrderInput } from '../hooks';

type Draft = { ingredientId: string; optionId: string | null; quantity: string; arrivalDate: string };
type OptionSnapshot = { id: string; vendorId: string | null; volume: number; amount: number };

function DateStepper({ value, today, onChange, label }: {
  value: string; today: string; onChange: (value: string) => void; label: string;
}) {
  const canGoBack = value > today;
  const monthDay = value.slice(5).replace('-', '/');
  const dateLabel = `${value === today ? '오늘 ' : value === addDays(today, 1) ? '내일 ' : value.slice(0, 4) !== today.slice(0, 4) ? `${value.slice(0, 4)}/` : ''}${monthDay}`;
  return <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52,
    borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.surface }}>
    <Icon name="calendar" size={18} color={COLOR.text.secondary} />
    <Text style={{ ...TYPE.caption, fontWeight: '700', color: COLOR.text.primary, marginLeft: space.sm, flex: 1 }}>도착일 *</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} 하루 앞당기기`} disabled={!canGoBack}
      onPress={() => onChange(addDays(value, -1))} style={{ width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="back" size={17} color={canGoBack ? COLOR.text.secondary : COLOR.text.tertiary} />
    </Pressable>
    <Text style={{ textAlign: 'center', ...TYPE.caption, fontWeight: '800', color: COLOR.text.accent }}>
      {dateLabel}
    </Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} 하루 늦추기`}
      disabled={value >= addDays(today, 3650)} onPress={() => onChange(addDays(value, 1))}
      style={{ width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="chevron" size={17} color={COLOR.text.secondary} />
    </Pressable>
  </View>;
}

function BulkOrderCard({ candidate, draft, today, onChange, onOptionSnapshot, onRemove }: {
  candidate: OrderCandidate; draft: Draft; today: string;
  onChange: (patch: Partial<Draft>) => void;
  onOptionSnapshot: (option: { id: string; vendorId: string | null; volume: number; amount: number }) => void;
  onRemove: () => void;
}) {
  const detail = useIngredientDetail(candidate.ingredientId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const option = detail.data?.options.find(item => item.id === draft.optionId);
  useEffect(() => {
    if (draft.optionId && detail.isFetched && !detail.isFetching && !detail.error && !option) {
      onChange({ optionId: null, quantity: '' });
    }
  }, [draft.optionId, detail.isFetched, detail.isFetching, detail.error, option, onChange]);
  useEffect(() => {
    if (!option) return;
    onOptionSnapshot({ id: option.id, vendorId: option.vendorId, volume: option.volume, amount: option.amount });
  }, [option?.id, option?.vendorId, option?.volume, option?.amount]);
  const unit = dispUnit(candidate.baseUnit);
  const quantity = Number(draft.quantity);
  const amount = option && Number.isSafeInteger(quantity) && quantity > 0 ? option.amount * quantity : 0;
  const total = option && Number.isSafeInteger(quantity) && quantity > 0 ? option.volume * quantity : 0;
  return <Card pad={0} style={{ overflow: 'hidden' }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 70, paddingLeft: space.lg,
      borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <View style={{ flex: 1, paddingVertical: space.sm }}>
        <Text style={{ ...TYPE.body, fontWeight: '800', color: COLOR.text.primary }}>{candidate.name}</Text>
        <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary, marginTop: space.xs }}>
          현재 {formatQuantity(candidate.stockTotal, unit)} · 최소 {formatQuantity(candidate.safetyTotal, unit)}
        </Text>
      </View>
      <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`${candidate.name} 발주 카드 삭제`}
        style={{ width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" size={20} color={COLOR.text.tertiary} />
      </Pressable>
    </View>
    <View style={{ padding: space.lg, gap: space.md }}>
      <Field label="구매처" req variant="stacked">
        <Pressable accessibilityRole="button" accessibilityLabel={`${candidate.name} 구매처 선택`}
          onPress={() => setPickerOpen(true)} style={{ minHeight: COMPONENT.stackedForm.controlMinHeight,
            paddingHorizontal: space.md, borderWidth: 1, borderColor: T.line, borderRadius: radius.md,
            backgroundColor: T.surface, flexDirection: 'row', alignItems: 'center' }}>
          <Text numberOfLines={1} style={{ flex: 1, ...TYPE.body, color: option ? COLOR.text.primary : COLOR.text.tertiary }}>
            {option ? `${option.vendorName ?? option.name} · ${option.name}` : '미선택'}
          </Text>
          <Icon name="chevronDown" size={16} color={COLOR.text.tertiary} />
        </Pressable>
      </Field>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><Field label="용량" variant="stacked">
          <View style={{ minHeight: COMPONENT.stackedForm.controlMinHeight, paddingHorizontal: space.md,
            justifyContent: 'center', borderRadius: radius.md, backgroundColor: T.surface2 }}>
            <Text style={{ ...TYPE.body, textAlign: 'right', color: option ? COLOR.text.primary : COLOR.text.tertiary }}>
              {option ? formatQuantity(option.volume, unit) : unit}
            </Text>
          </View>
        </Field></View>
        <View style={{ flex: 1 }}><Field label="발주 수량" req variant="stacked">
          <View style={{ minHeight: COMPONENT.stackedForm.controlMinHeight, paddingHorizontal: space.xs,
            borderWidth: 1, borderColor: T.line, borderRadius: radius.md, backgroundColor: T.surface,
            flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${candidate.name} 발주 수량 줄이기`}
              disabled={quantity <= 1} onPress={() => onChange({ quantity: String(Math.max(1, quantity - 1)) })}
              style={{ width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="minus" size={16} color={COLOR.text.secondary} />
            </Pressable>
            <TextInput value={formatNumericInput(draft.quantity)} onChangeText={text => onChange({ quantity: clampDecimals(text, 0) })}
              keyboardType="number-pad" accessibilityLabel={`${candidate.name} 발주 수량`}
              style={{ flex: 1, minWidth: 0, minHeight: 48, textAlign: 'center', ...TYPE.body, fontWeight: '700', color: COLOR.text.primary }} />
            <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>개</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`${candidate.name} 발주 수량 늘리기`}
              onPress={() => onChange({ quantity: String(quantity + 1) })}
              style={{ width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={16} color={COLOR.action.primary} />
            </Pressable>
          </View>
        </Field></View>
      </View>
      <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: COLOR.action.primaryTint,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View><Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>발주 금액</Text>
          <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary, marginTop: space.xs }}>총 {formatQuantity(total, unit)}</Text></View>
        <Text style={{ ...TYPE.body, fontWeight: '800', color: COLOR.text.accent }}>{won(amount)}원</Text>
      </View>
      <DateStepper value={draft.arrivalDate} today={today} onChange={arrivalDate => onChange({ arrivalDate })} label={`${candidate.name} 도착일`} />
    </View>
    <Sheet visible={pickerOpen} title="구매처 선택" onClose={() => setPickerOpen(false)}>
      <Pressable onPress={() => { onChange({ optionId: null, quantity: '' }); setPickerOpen(false); }}
        accessibilityRole="button" accessibilityLabel="미선택"
        style={{ minHeight: 52, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: T.line2 }}>
        <Text style={{ ...TYPE.body, color: COLOR.text.tertiary }}>미선택</Text>
      </Pressable>
      {detail.isLoading ? <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>구매처를 불러오는 중이에요</Text> : null}
      {detail.error ? <Button kind="ghost" size="sm" onPress={() => void detail.refetch()}>구매처 다시 불러오기</Button> : null}
      {(detail.data?.options ?? []).map(item => <Pressable key={item.id} onPress={() => {
        const suggested = recommendedOrderQty(safetyStockShortage(candidate.stockTotal, candidate.safetyTotal), item.volume);
        onOptionSnapshot({ id: item.id, vendorId: item.vendorId, volume: item.volume, amount: item.amount });
        onChange({ optionId: item.id, quantity: String(suggested) }); setPickerOpen(false);
      }} accessibilityRole="button" accessibilityLabel={`${item.name} 구매처 선택`}
        style={{ minHeight: 56, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: T.line2 }}>
        <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{item.vendorName ?? item.name} · {item.name}</Text>
        <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary }}>
          {formatQuantity(item.volume, unit)} · {won(item.amount)}원
        </Text>
      </Pressable>)}
      {!detail.isLoading && !detail.error && !detail.data?.options.length ?
        <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>등록된 구매처가 없어요</Text> : null}
    </Sheet>
  </Card>;
}

export default function BulkOrderScreen() {
  return <BusinessDateGate source={useStoreLocalDate()} title="일괄 발주" onBack={() => safeBack('/orders')}>
    {today => <BulkOrderBody today={today} />}
  </BusinessDateGate>;
}

function BulkOrderBody({ today }: { today: string }) {
  const router = useRouter();
  const board = useOrderBoard();
  const placeOrders = usePlaceOrders();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [date, setDate] = useState(addDays(today, 1));
  const [applyAll, setApplyAll] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const submitting = useRef(false);
  // E7 records the selected option's price and volume snapshot; saving never changes stock.
  const [optionSnapshots, setOptionSnapshots] = useState(() => new Map<string, OptionSnapshot>());
  const candidates = board.data?.candidates ?? [];
  useEffect(() => {
    if (initialized || !board.data) return;
    setDrafts(board.data.candidates.slice(0, 20).map(item => ({ ingredientId: item.ingredientId,
      optionId: null, quantity: '', arrivalDate: addDays(today, 1) })));
    setInitialized(true);
  }, [board.data, initialized, today]);
  useEffect(() => {
    if (!initialized || !board.data) return;
    const liveIds = new Set(board.data.candidates.map(item => item.ingredientId));
    setDrafts(current => {
      const next = current.filter(item => liveIds.has(item.ingredientId));
      if (next.length === current.length) return current;
      return next;
    });
    setOptionSnapshots(current => {
      const next = new Map([...current].filter(([ingredientId]) => liveIds.has(ingredientId)));
      return next.size === current.size ? current : next;
    });
  }, [board.data, initialized]);
  const candidateById = useMemo(() => new Map(candidates.map(item => [item.ingredientId, item])), [candidates]);
  const update = (ingredientId: string, patch: Partial<Draft>) => setDrafts(current => current.map(item => item.ingredientId === ingredientId ? { ...item, ...patch } : item));
  const changeDate = (next: string) => {
    setDate(next);
    if (applyAll) setDrafts(current => current.map(item => ({ ...item, arrivalDate: next })));
  };
  const selected = new Set(drafts.map(item => item.ingredientId));
  const available = candidates.filter(item => !selected.has(item.ingredientId));
  const totalAmount = drafts.reduce((sum, item) => {
    const option = optionSnapshots.get(item.ingredientId);
    const qty = Number(item.quantity);
    return sum + (option?.id === item.optionId && Number.isSafeInteger(qty) && qty > 0 ? option.amount * qty : 0);
  }, 0);
  const valid = drafts.length > 0 && drafts.every(item => candidateById.has(item.ingredientId) && item.optionId && Number.isSafeInteger(Number(item.quantity))
    && Number(item.quantity) > 0 && item.arrivalDate >= today && item.arrivalDate <= addDays(today, 3650));
  const save = () => {
    if (submitting.current || placeOrders.isPending || !valid) return;
    const inputs: PlaceOrderInput[] = [];
    for (const draft of drafts) {
      const option = optionSnapshots.get(draft.ingredientId);
      if (!option || option.id !== draft.optionId || !candidateById.has(draft.ingredientId)) {
        Alert.alert('구매처를 확인해 주세요', '각 카드의 구매처를 다시 선택해 주세요.'); return;
      }
      inputs.push({ ingredientId: draft.ingredientId, vendorId: option.vendorId, volume: option.volume,
        amount: option.amount, qty: Number(draft.quantity), expectedAt: draft.arrivalDate });
    }
    submitting.current = true;
    placeOrders.mutate(inputs, {
      onSuccess: result => {
        submitting.current = false;
        if (result && !Array.isArray(result) && result.resolved === 'not_recorded') {
          Alert.alert('이전 발주는 저장되지 않았어요', '내용을 확인한 뒤 다시 발주해 주세요.'); return;
        }
        router.replace('/orders?tab=waiting' as Href);
      },
      onError: error => { submitting.current = false; Alert.alert('발주하지 못했어요', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요'); },
    });
  };
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="일괄 발주" onBack={() => safeBack('/orders')}
      right={<Text style={{ ...TYPE.caption, fontWeight: '700', color: COLOR.text.secondary }}>{drafts.length}건</Text>} />
    <QueryState isLoading={board.isLoading} error={board.error} isEmpty={candidates.length === 0}
      onRetry={() => void board.refetch()} emptyTitle="발주 후보가 없어요">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.lg,
        paddingTop: space.md, paddingBottom: LAYOUT.scroll.end + 96, gap: space.md }}>
        <Card pad={space.lg}><DateStepper value={date} today={today} onChange={changeDate} label="공통 도착일" />
          <Pressable onPress={() => { const next = !applyAll; setApplyAll(next);
            if (next) setDrafts(current => current.map(item => ({ ...item, arrivalDate: date }))); }}
            accessibilityRole="checkbox" accessibilityLabel={`모든 카드에 적용${applyAll ? ', 선택됨' : ''}`}
            accessibilityState={{ checked: applyAll }}
            style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ width: 20, height: 20, borderWidth: 1.5, borderColor: COLOR.action.primary,
              borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
              backgroundColor: applyAll ? COLOR.action.primaryTint : T.surface }}>
              {applyAll ? <Icon name="check" size={14} color={COLOR.action.primary} sw={2.2} /> : null}
            </View>
            <Text style={{ ...TYPE.caption, color: COLOR.text.primary }}>모든 카드에 적용</Text>
          </Pressable>
        </Card>
        {candidates.length > 20 ? <Text accessibilityRole="alert" style={{ ...TYPE.captionSm, color: COLOR.text.secondary }}>
          후보 {candidates.length}개 중 20개까지 한 번에 발주할 수 있어요
        </Text> : null}
        {drafts.map(draft => { const candidate = candidateById.get(draft.ingredientId);
          return candidate ? <BulkOrderCard key={draft.ingredientId} candidate={candidate} draft={draft} today={today}
            onChange={patch => {
              if (patch.arrivalDate !== undefined && patch.arrivalDate !== date) setApplyAll(false);
              if (patch.optionId === null) setOptionSnapshots(current => {
                if (!current.has(draft.ingredientId)) return current;
                const next = new Map(current); next.delete(draft.ingredientId); return next;
              });
              update(draft.ingredientId, patch);
            }} onOptionSnapshot={option => setOptionSnapshots(current => {
              const previous = current.get(draft.ingredientId);
              if (previous?.id === option.id && previous.vendorId === option.vendorId
                && previous.volume === option.volume && previous.amount === option.amount) return current;
              const next = new Map(current); next.set(draft.ingredientId, option); return next;
            })}
            onRemove={() => { setOptionSnapshots(current => {
                if (!current.has(draft.ingredientId)) return current;
                const next = new Map(current); next.delete(draft.ingredientId); return next;
              });
              setDrafts(current => current.filter(item => item.ingredientId !== draft.ingredientId)); }} /> : null; })}
        <Pressable onPress={() => setAddOpen(true)} disabled={available.length === 0 || drafts.length >= 20}
          accessibilityRole="button" accessibilityLabel="발주 카드 추가"
          style={{ minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed',
            borderColor: COLOR.action.primary, backgroundColor: COLOR.action.primaryTint,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs }}>
          <Icon name="plus" size={18} color={COLOR.action.primary} />
          <Text style={{ ...TYPE.caption, fontWeight: '800', color: COLOR.text.link }}>발주 카드 추가</Text>
        </Pressable>
      </ScrollView>
      <View style={{ padding: space.lg, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.surface }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.sm }}>
          <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>총 발주 금액</Text>
          <Text style={{ ...TYPE.body, fontWeight: '800', color: COLOR.text.primary }}>{won(totalAmount)}원</Text>
        </View>
        <Button kind="primary" full disabled={!valid || placeOrders.isPending} loading={placeOrders.isPending} onPress={save}>{drafts.length}건 일괄 발주</Button>
      </View>
      <Sheet visible={addOpen} title="재료 추가" onClose={() => setAddOpen(false)}>
        {available.map(item => <Pressable key={item.ingredientId} onPress={() => {
          setDrafts(current => [...current, { ingredientId: item.ingredientId, optionId: null, quantity: '', arrivalDate: date }]);
          setAddOpen(false);
        }} accessibilityRole="button" accessibilityLabel={`${item.name} 추가`}
          style={{ minHeight: 52, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: T.line2 }}>
          <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{item.name}</Text>
        </Pressable>)}
      </Sheet>
    </QueryState>
  </View>;
}
