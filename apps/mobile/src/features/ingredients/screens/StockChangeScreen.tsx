import { useEffect, useRef, useState } from 'react';
import { Text, View, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Button, ConfirmSheet, Field, Input, QueryState } from '@/components/kit';
import { T, TYPE, space, won } from '@/theme/tokens';
import { clampSignedDecimals, unitDecimals } from '@/lib/num';
import { safeBack } from '@/lib/nav';
import { showToast } from '@/lib/toast';
import { StockMutationConfirm } from '../components/StockMutationConfirm';
import { estimatedDiscardLoss, formatQuantity } from '@margincook/core';
import { useIngredientDetail, useStockChange } from '../hooks';
import { StockChangeOverview } from '../components/StockChangeOverview';
import { StockResultField } from '../components/StockResultField';
import { QuickInboundScreen } from './QuickInboundScreen';
import { operationKeyFor } from '../operationKey';

/** 화면 탭만 통합한다. 입고 E1 / 차감 E5 / 폐기 E2의 저장 계약은 합치지 않는다. */
export function StockChangeScreen() {
  const { mode, id } = useLocalSearchParams<{ mode?: string; id?: string }>();
  return mode === 'deduct' || mode === 'waste'
    ? <StockAdjustment key={`${id}:${mode}`} mode={mode} /> : <QuickInboundScreen key={id} editLayout />;
}

function StockAdjustment({ mode }: { mode: 'deduct' | 'waste' }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useIngredientDetail(id);
  const save = useStockChange();
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const active = useRef(true);
  const submitting = useRef(false);
  const operation = useRef<{ payload: string; key: string; expectedStock: number } | null>(null);
  const confirmedStock = useRef<number | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const g = detail.data;
  const unit = g?.baseUnit === 'ea' ? '개' : g?.baseUnit ?? 'g';
  const amount = Number(quantity);
  const valid = Number.isFinite(amount) && amount > 0 && !!g && amount <= Math.max(0, g.stockTotal);
  // 과다 차감은 0으로 잘라 다른 수량을 저장하지 않고 입력 오류로 막는다.
  const nextStock = (g?.stockTotal ?? 0) - (Number.isFinite(amount) ? amount : 0);
  const waste = mode === 'waste';
  const loss = quantity.trim() === '' || valid ? estimatedDiscardLoss(amount, g?.basePrice) : null;
  const onSave = () => {
    if (!g || !valid || save.isPending || submitting.current || !reason.trim() || confirmedStock.current === null) return;
    submitting.current = true;
    const nextOperation = operationKeyFor(operation.current, [g.id, mode, amount, reason.trim()], 'stock');
    if (operation.current !== nextOperation) operation.current = { ...nextOperation, expectedStock: confirmedStock.current };
    save.mutate({ ingredientId: g.id, kind: waste ? 'waste' : 'adj', value: nextStock, quantity: amount,
      expectedStock: operation.current!.expectedStock, idempotencyKey: operation.current!.key, reason: reason.trim() }, {
      onSuccess: result => {
        operation.current = null;
        submitting.current = false;
        if (!active.current) return;
        setConfirmOpen(false);
        if (result?.skipped) setError('남은 양이 지금 재고와 같거나 더 많아 버린 양이 0이에요.');
        else { showToast(waste ? '폐기 처리했어요.' : '차감 처리했어요.'); safeBack(`/ingredients/${id}`); }
      },
      onError: e => {
        submitting.current = false;
        if (!active.current) return;
        setConfirmOpen(false);
        // 40001은 서버가 저장 전에 거절한 경우다. 통신 오류는 성공 여부를 모르므로
        // 원래 요청 키·확인값을 보존해야 재시도가 다시 차감하지 않는다.
        if ((e as { code?: string })?.code === '40001') { operation.current = null; void detail.refetch(); }
        setError(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');
      },
    });
  };
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="재고 수정" onBack={() => safeBack(`/ingredients/${id}`)} />
    <QueryState isLoading={detail.isLoading} error={detail.error} isEmpty={!g} onRetry={() => void detail.refetch()} emptyTitle="식재료를 찾을 수 없어요">
      {g ? <>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingTop: space.sm }}>
          <View style={{ marginBottom: space.md }}>
          <StockChangeOverview id={g.id} name={g.name} stock={g.stockTotal} basePrice={g.basePrice} unit={unit} mode={mode} disabled={save.isPending} />
          </View>
          <Field label={waste ? '폐기할 수량' : '차감할 수량'} req variant="stacked" error={quantity && !valid ? '현재 재고 이내의 수량을 입력해 주세요' : undefined}>
            <Input variant="stacked" value={quantity} onChangeText={s => setQuantity(clampSignedDecimals(s, unitDecimals(unit)))} suffix={unit} placeholder="0"
              keyboardType="decimal-pad" accessibilityLabel={waste ? '폐기할 수량' : '차감할 수량'} />
          </Field>
          <StockResultField label={waste ? '폐기 후 재고' : '차감 후 재고'} value={formatQuantity(nextStock, unit)} negative={nextStock < 0} />
          {!waste ? <Field label="사유" req variant="stacked">
            <Input variant="stacked" value={reason} onChangeText={setReason} placeholder="예) 조리 중 사용" accessibilityLabel="차감 사유" />
          </Field> : <>
            <StockResultField label="예상 손실" tone={loss === null ? 'neutral' : 'danger'} value={loss === null ? (g.basePrice == null ? '기준단가 없음' : '—') : `${won(loss)}원`} />
            <Field label="폐기 사유" req variant="stacked">
              <Input variant="stacked" value={reason} onChangeText={setReason} placeholder="예) 유통기한 경과" accessibilityLabel="폐기 사유" />
            </Field>
            <Text style={{ ...TYPE.captionSm, color: T.sub2 }}>예상 손실은 현재 기준단가로 계산한 미리보기입니다. 확정 손실은 저장 후 서버 기록을 사용합니다.</Text>
          </>}
        </ScrollView>
        <View style={{ padding: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.surface }}>
          <Button size="md" full loading={save.isPending} disabled={!valid || !reason.trim()} onPress={() => { confirmedStock.current = g.stockTotal; setConfirmOpen(true); }}>{waste ? '폐기 기록' : '재고 차감'}</Button>
        </View>
      </> : null}
    </QueryState>
    <StockMutationConfirm visible={confirmOpen} action={waste ? '폐기' : '차감'} ingredientName={g?.name ?? ''}
      quantity={formatQuantity(amount, unit)} remaining={formatQuantity(nextStock, unit)} negative={nextStock < 0} loading={save.isPending}
      onCancel={() => { if (!save.isPending && !submitting.current) setConfirmOpen(false); }} onConfirm={onSave} />
    <ConfirmSheet visible={error !== null} title="저장하지 못했어요" message={error ?? ''} confirmText="확인" cancelText="닫기" onCancel={() => setError(null)} onConfirm={() => setError(null)} />
  </View>;
}
