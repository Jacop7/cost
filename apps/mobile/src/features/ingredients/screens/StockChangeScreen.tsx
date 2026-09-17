import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Text, View, ScrollView } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AppHeader, Button, ConfirmSheet, Field, Input, QueryState } from '@/components/kit';
import { COLOR, T, TYPE, space, won } from '@/theme/tokens';
import { useSessionState } from '@/lib/SessionProvider';
import { clampSignedDecimals, unitDecimals } from '@/lib/num';
import { safeBack } from '@/lib/nav';
import { showToast } from '@/lib/toast';
import { StockMutationConfirm } from '../components/StockMutationConfirm';
import { estimatedDiscardLoss, formatQuantity } from '@costkeep/core';
import { useIngredientDetail, useInventoryOccurrenceContext, useStockChange } from '../hooks';
import { StockChangeOverview } from '../components/StockChangeOverview';
import { StockResultField } from '../components/StockResultField';
import { InventoryOccurrenceFields, emptyInventoryOccurrence, inventoryOccurrenceInput,
  inventoryOccurrenceReady } from '../components/InventoryOccurrenceFields';
import { QuickInboundScreen } from './QuickInboundScreen';
import { operationKeyFor } from '../operationKey';
import { isStockQuantityRejected } from '../stockQuantityOperation';

/** 화면 탭만 통합한다. 입고 E1 / 차감 E5 / 폐기 E2의 저장 계약은 합치지 않는다. */
export function StockChangeScreen() {
  const { mode, id, initial } = useLocalSearchParams<{ mode?: string; id?: string; initial?: string }>();
  const { userId, storeId } = useSessionState();
  const ownerKey = JSON.stringify([userId, storeId, id, mode]);
  const currentOwner = useRef<string | null>(null);
  currentOwner.current = userId && storeId && id ? ownerKey : null;
  return initial !== '1' && (mode === 'deduct' || mode === 'waste')
    ? (userId && storeId && id ? <StockAdjustment key={ownerKey} id={id} mode={mode}
      scope={{ userId, storeId }} ownerKey={ownerKey} currentOwner={currentOwner} /> : null)
    : <QuickInboundScreen key={id} editLayout initialEntry={initial === '1'} />;
}

function StockAdjustment({ id, mode, scope, ownerKey, currentOwner }: {
  id: string; mode: 'deduct' | 'waste'; scope: { userId: string; storeId: string };
  ownerKey: string; currentOwner: RefObject<string | null>;
}) {
  const instance = `stock-adjustment:${useId()}`;
  const detail = useIngredientDetail(id, { ...scope, instance });
  const occurrenceContext = useInventoryOccurrenceContext(id);
  const detailRef = useRef(detail);
  detailRef.current = detail;
  const save = useStockChange();
  const saveRef = useRef(save);
  saveRef.current = save;
  const [pendingVisible, setPendingVisible] = useState(false);
  const [checkingResult, setCheckingResult] = useState(false);
  const pending = save.isPending || checkingResult;
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [occurrence, setOccurrence] = useState(emptyInventoryOccurrence);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const active = useRef(false);
  const epoch = useRef(0);
  const readSequence = useRef(0);
  const writeSequence = useRef(0);
  const blocked = useRef(false);
  const reading = useRef(false);
  const [focused, setFocused] = useState(false);
  const [recovery, setRecovery] = useState<'loading' | 'failed' | null>(null);
  type Ingredient = NonNullable<typeof detail.data>;
  const [candidate, setCandidate] = useState<{ epoch: number; sequence: number; data: Ingredient } | null>(null);
  const lastDetail = useRef<Ingredient | null>(null);
  const observed = detail.data?.id === id && Number.isFinite(detail.data.stockTotal) ? detail.data : null;
  if (observed) lastDetail.current = observed;
  const submitting = useRef(false);
  const operation = useRef<{ payload: string; key: string; expectedStock: number } | null>(null);
  const confirmation = useRef<{ epoch: number; stock: number; payload: string } | null>(null);
  const isCurrent = (ticket: number) => active.current && currentOwner.current === ownerKey && epoch.current === ticket;
  const invalidate = () => {
    active.current = false;
    epoch.current += 1;
    readSequence.current += 1;
    writeSequence.current += 1;
    blocked.current = true;
    confirmation.current = null;
  };
  useLayoutEffect(() => () => invalidate(), []);
  const reload = async () => {
    const ticket = epoch.current;
    if (!isCurrent(ticket) || reading.current) return;
    const sequence = ++readSequence.current;
    blocked.current = true;
    reading.current = true;
    confirmation.current = null;
    setConfirmOpen(false);
    setCandidate(null);
    setRecovery('loading');
    try {
      const result = await detailRef.current.refetch();
      if (!isCurrent(ticket) || sequence !== readSequence.current) return;
      if (result.error || result.data?.id !== id || !Number.isFinite(result.data.stockTotal)) {
        setRecovery('failed');
      } else {
        setCandidate({ epoch: ticket, sequence, data: result.data });
      }
    } catch {
      if (!isCurrent(ticket) || sequence !== readSequence.current) return;
      setRecovery('failed');
    } finally {
      if (isCurrent(ticket) && sequence === readSequence.current) reading.current = false;
    }
  };
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useFocusEffect(useCallback(() => {
    active.current = true;
    setFocused(true);
    const ticket = epoch.current;
    const pendingSequence = writeSequence.current;
    void saveRef.current.hasPending(id).then(found => {
      if (isCurrent(ticket) && pendingSequence === writeSequence.current) setPendingVisible(found);
    }, () => {
      if (isCurrent(ticket) && pendingSequence === writeSequence.current) setPendingVisible(true);
    });
    if (blocked.current) {
      reading.current = false;
      submitting.current = false;
      void reloadRef.current();
    }
    return () => { invalidate(); setFocused(false); };
  }, []));
  // A completed refetch alone is insufficient: the same scoped observer must expose it.
  useEffect(() => {
    if (!candidate || !isCurrent(candidate.epoch) || candidate.sequence !== readSequence.current) return;
    if (detail.data !== candidate.data || !detail.isSuccess || detail.isFetching || !detail.isFetchedAfterMount) return;
    blocked.current = false;
    setRecovery(null);
    setCandidate(null);
  }, [candidate, detail.data, detail.isSuccess, detail.isFetching, detail.isFetchedAfterMount]);
  const resolvePending = async () => {
    const ticket = epoch.current;
    if (!isCurrent(ticket) || submitting.current || pending) return;
    const sequence = ++writeSequence.current;
    submitting.current = true;
    blocked.current = true;
    confirmation.current = null;
    setConfirmOpen(false);
    setCheckingResult(true);
    try {
      const result = await save.resolvePending(id);
      if (!isCurrent(ticket) || sequence !== writeSequence.current) return;
      operation.current = null;
      setPendingVisible(false);
      setError(null);
      if (result) showToast(result.resolved === 'recorded'
        ? `이전 ${result.previousKind === 'discard' ? '폐기' : '차감'}는 이미 처리됐어요.`
        : '이전 처리는 반영되지 않았어요. 현재 수량을 확인해 주세요.');
      else showToast('확인할 이전 처리가 없어요.');
      void reloadRef.current();
    } catch (e) {
      if (!isCurrent(ticket) || sequence !== writeSequence.current) return;
      setPendingVisible(true);
      setError(e instanceof Error ? e.message : '이전 처리 결과를 확인하지 못했어요.');
    } finally {
      if (isCurrent(ticket) && sequence === writeSequence.current) {
        submitting.current = false;
        setCheckingResult(false);
      }
    }
  };
  const queryReady = () => {
    const latest = detailRef.current;
    return isCurrent(epoch.current) && !blocked.current && latest.isSuccess && !latest.isFetching
      && latest.isFetchedAfterMount && latest.data?.id === id && Number.isFinite(latest.data.stockTotal);
  };
  const g = observed ?? (recovery ? lastDetail.current : null);
  const unit = g?.baseUnit === 'ea' ? '개' : g?.baseUnit ?? 'g';
  const amount = Number(quantity);
  const payload = [g?.id, mode, amount, reason.trim(), occurrence.choice, occurrence.date, occurrence.time];
  const retrying = operation.current?.payload === JSON.stringify(payload);
  // 응답 유실 후 재조회된 재고로 같은 처리를 다시 빼지 않는다. 최초 확인값과
  // 키를 보존하고 도메인 훅이 처리 결과만 조회한다. 입력 변경은 현재 재고로 검증한다.
  const validationStock = retrying ? operation.current!.expectedStock : (g?.stockTotal ?? 0);
  const valid = Number.isFinite(amount) && amount > 0 && !!g && amount <= Math.max(0, validationStock);
  const occurrenceReady = !occurrenceContext.isLoading && !occurrenceContext.error
    && inventoryOccurrenceReady(occurrenceContext.data, occurrence);
  // 과다 차감은 0으로 잘라 다른 수량을 저장하지 않고 입력 오류로 막는다.
  const nextStock = validationStock - (Number.isFinite(amount) ? amount : 0);
  const waste = mode === 'waste';
  const loss = quantity.trim() === '' || valid ? estimatedDiscardLoss(amount, g?.basePrice) : null;
  const cancelConfirmation = () => {
    confirmation.current = null;
    setConfirmOpen(false);
  };
  const capturedConfirmation = confirmation.current;
  const onSave = () => {
    if (!queryReady() || !g || !valid || !occurrenceReady || pending || submitting.current || !reason.trim()
      || !capturedConfirmation || confirmation.current !== capturedConfirmation
      || !isCurrent(capturedConfirmation.epoch) || capturedConfirmation.payload !== JSON.stringify(payload)) return;
    if (!retrying && detailRef.current.data?.stockTotal !== capturedConfirmation.stock) {
      confirmation.current = null;
      setConfirmOpen(false);
      setError('재고가 바뀌었어요. 수량을 확인한 뒤 다시 저장해 주세요.');
      return;
    }
    submitting.current = true;
    const ticket = epoch.current;
    const sequence = ++writeSequence.current;
    const nextOperation = operationKeyFor(operation.current, payload, 'stock');
    if (operation.current !== nextOperation) operation.current = { ...nextOperation, expectedStock: capturedConfirmation.stock };
    save.mutate({ ingredientId: g.id, kind: waste ? 'waste' : 'adj', value: nextStock, quantity: amount,
      expectedStock: operation.current!.expectedStock, idempotencyKey: operation.current!.key, reason: reason.trim(),
      ...inventoryOccurrenceInput(occurrenceContext.data, occurrence) }, {
      onSuccess: result => {
        if (!isCurrent(ticket) || sequence !== writeSequence.current) return;
        writeSequence.current += 1;
        operation.current = null;
        setPendingVisible(false);
        submitting.current = false;
        confirmation.current = null;
        setConfirmOpen(false);
        if (result && 'resolved' in result) {
          showToast(result.resolved === 'recorded'
            ? `이전 ${result.previousKind === 'discard' ? '폐기' : '차감'}는 이미 반영됐어요.`
            : '이전 처리는 반영되지 않았어요. 현재 수량을 확인해 주세요.');
          void reloadRef.current();
        }
        else if (result?.skipped) setError('남은 양이 지금 재고와 같거나 더 많아 버린 양이 0이에요.');
        else { showToast(waste ? '폐기 처리했어요.' : '차감 처리했어요.'); invalidate(); safeBack(`/ingredients/${id}`); }
      },
      onError: e => {
        if (!isCurrent(ticket) || sequence !== writeSequence.current) return;
        writeSequence.current += 1;
        submitting.current = false;
        confirmation.current = null;
        setConfirmOpen(false);
        // Definitive RPC rejection releases the key. Unknown transport outcomes retain
        // the original key and stock until the domain hook resolves the outcome.
        if (isStockQuantityRejected(e)) { operation.current = null; setPendingVisible(false); void reloadRef.current(); }
        else setPendingVisible(true);
        setError(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');
      },
    });
  };
  if (detail.data?.stockTracking === false) return <Redirect href={`/ingredients/${id}`} />;
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="재고 수정" onBack={() => { invalidate(); safeBack(`/ingredients/${id}`); }} />
    <QueryState isLoading={(!g && detail.isLoading) || occurrenceContext.isLoading}
      error={recovery && g ? occurrenceContext.error : detail.error ?? occurrenceContext.error}
      isEmpty={!g} onRetry={() => { void reload(); void occurrenceContext.refetch(); }} emptyTitle="재료를 찾을 수 없어요">
      {g ? <>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingTop: space.sm }}>
          <View style={{ marginBottom: space.md }}>
          <StockChangeOverview id={g.id} name={g.name} stock={g.stockTotal} basePrice={g.basePrice} unit={unit} mode={mode} disabled={pending} />
          </View>
          <Field label={waste ? '폐기할 수량' : '차감할 수량'} req variant="stacked" error={quantity && !valid ? '현재 재고 이내의 수량을 입력해 주세요' : undefined}>
            <Input variant="stacked" value={quantity} onChangeText={s => { cancelConfirmation(); setQuantity(clampSignedDecimals(s, unitDecimals(unit))); }} suffix={unit} placeholder="0"
              keyboardType="decimal-pad" accessibilityLabel={waste ? '폐기할 수량' : '차감할 수량'} />
          </Field>
          <StockResultField label={waste ? '폐기 후 재고' : '차감 후 재고'} value={formatQuantity(nextStock, unit)} negative={nextStock < 0} />
          {!waste ? <Field label="사유" req variant="stacked">
            <Input variant="stacked" value={reason} onChangeText={s => { cancelConfirmation(); setReason(s); }} placeholder="예) 조리 중 사용" accessibilityLabel="차감 사유" />
          </Field> : <>
            <StockResultField label="예상 손실" tone={loss === null ? 'neutral' : 'danger'} value={loss === null ? (g.basePrice == null ? '단가 없음' : '—') : `${won(loss)}원`} />
            <Field label="폐기 사유" req variant="stacked">
              <Input variant="stacked" value={reason} onChangeText={s => { cancelConfirmation(); setReason(s); }} placeholder="예) 유통기한 경과" accessibilityLabel="폐기 사유" />
            </Field>
          </>}
          <InventoryOccurrenceFields context={occurrenceContext.data} value={occurrence}
            disabled={pending} onChange={next => { cancelConfirmation(); setOccurrence(next); }} />
          {recovery ? <View style={{ marginTop: space.md }}>
            <Text style={{ ...TYPE.captionSm, color: recovery === 'failed' ? COLOR.status.negative : COLOR.text.secondary }}>
              {recovery === 'failed' ? '최신 재고를 불러오지 못했어요. 입력한 내용은 유지돼요.' : '최신 재고를 확인하고 있어요. 확인이 끝나면 다시 저장해 주세요.'}
            </Text>
            <Button disabled={reading.current} onPress={() => void reload()}>최신 재고 다시 불러오기</Button>
          </View> : null}
        </ScrollView>
        <View style={{ padding: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.surface }}>
          {pendingVisible ? <View style={{ marginBottom: space.sm }}>
            <Button full disabled={!focused || pending} onPress={() => void resolvePending()}>이전 처리 결과 확인</Button>
          </View> : null}
          <Button accessibilityLabel={waste ? '폐기 기록' : '차감 입력 확인'} size="md" full loading={pending} disabled={!valid || !reason.trim() || !occurrenceReady || !focused || !queryReady()} onPress={() => {
            if (!queryReady() || !valid || !reason.trim() || !occurrenceReady || submitting.current || pending) return;
            confirmation.current = { epoch: epoch.current, stock: validationStock, payload: JSON.stringify(payload) };
            setConfirmOpen(true);
          }}>{waste ? '폐기 기록' : '차감'}</Button>
        </View>
      </> : null}
    </QueryState>
    <StockMutationConfirm visible={confirmOpen} action={waste ? '폐기' : '차감'} ingredientName={g?.name ?? ''}
      quantity={formatQuantity(amount, unit)} remaining={formatQuantity(nextStock, unit)} negative={nextStock < 0} loading={pending}
      onCancel={() => { if (!pending && !submitting.current) { confirmation.current = null; setConfirmOpen(false); } }} onConfirm={onSave} />
    <ConfirmSheet visible={error !== null} title="저장하지 못했어요" message={error ?? ''} confirmText="확인" cancelText="닫기" onCancel={() => setError(null)} onConfirm={() => setError(null)} />
  </View>;
}
