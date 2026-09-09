import { useEffect, useRef, useState } from 'react';
import { Text, View, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Button, Card, ConfirmSheet, Field, Input, QueryState } from '@/components/kit';
import { COLOR, T, TYPE, space, tnum } from '@/theme/tokens';
import { clampSignedDecimals, unitDecimals } from '@/lib/num';
import { safeBack } from '@/lib/nav';
import { formatQuantity } from '@margincook/core';
import { useIngredientDetail, useStockChange } from '../hooks';
import { StockChangeOverview } from '../components/StockChangeOverview';
import { QuickInboundScreen } from './QuickInboundScreen';

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
  const active = useRef(true);
  const submitting = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const g = detail.data;
  const unit = g?.baseUnit === 'ea' ? '개' : g?.baseUnit ?? 'g';
  const amount = Number(quantity);
  const valid = Number.isFinite(amount) && amount > 0 && !!g && amount <= Math.max(0, g.stockTotal);
  // 과다 차감은 0으로 잘라 다른 수량을 저장하지 않고 입력 오류로 막는다.
  const nextStock = (g?.stockTotal ?? 0) - (Number.isFinite(amount) ? amount : 0);
  const waste = mode === 'waste';
  const onSave = () => {
    if (!g || !valid || save.isPending || submitting.current || (!waste && !reason.trim())) return;
    submitting.current = true;
    save.mutate({ ingredientId: g.id, kind: waste ? 'waste' : 'adj', value: nextStock, reason: reason.trim() }, {
      onSuccess: result => {
        submitting.current = false;
        if (!active.current) return;
        if (result?.skipped) setError('남은 양이 지금 재고와 같거나 더 많아 버린 양이 0이에요.');
        else safeBack(`/ingredients/${id}`);
      },
      onError: e => { submitting.current = false; if (active.current) setError(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'); },
    });
  };
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="재고 수정" onBack={() => safeBack(`/ingredients/${id}`)} />
    <QueryState isLoading={detail.isLoading} error={detail.error} isEmpty={!g} onRetry={() => void detail.refetch()} emptyTitle="식재료를 찾을 수 없어요">
      {g ? <>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingTop: space.xs, gap: space.lg }}>
          <StockChangeOverview id={g.id} name={g.name} stock={g.stockTotal} basePrice={g.basePrice} unit={unit} mode={mode} disabled={save.isPending} />
          <Field label={waste ? '폐기할 수량' : '차감할 수량'} req variant="stacked" error={quantity && !valid ? '현재 재고 이내의 수량을 입력해 주세요' : undefined}>
            <Input variant="stacked" value={quantity} onChangeText={s => setQuantity(clampSignedDecimals(s, unitDecimals(unit)))} suffix={unit} mono placeholder="0"
              keyboardType="decimal-pad" accessibilityLabel={waste ? '폐기할 수량' : '차감할 수량'} />
          </Field>
          <Card pad={space.lg}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
              <Text style={{ ...TYPE.caption, color: T.sub }}>{waste ? '폐기 후 재고' : '차감 후 재고'}</Text>
              <Text style={[{ ...TYPE.body, color: nextStock < 0 ? COLOR.status.negative : COLOR.text.accent }, tnum]}>{formatQuantity(nextStock, unit)}</Text>
            </View>
          </Card>
          {/* 현 E2 RPC는 사유를 저장하지 않는다. 입력을 받았다고 오인시키지 않는다. */}
          {!waste ? <Field label="사유" req variant="stacked">
            <Input variant="stacked" value={reason} onChangeText={setReason} placeholder="예) 조리 중 사용" accessibilityLabel="차감 사유" />
          </Field> : <Text style={{ ...TYPE.captionSm, color: T.sub2 }}>폐기 사유·예상 손실은 현재 저장 계약에서 지원하지 않습니다. 확정 손실은 저장 후 서버 기록을 사용합니다.</Text>}
        </ScrollView>
        <View style={{ padding: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.surface }}>
          <Button size="md" full loading={save.isPending} disabled={!valid || (!waste && !reason.trim())} onPress={onSave}>{waste ? '폐기 기록' : '재고 차감'}</Button>
        </View>
      </> : null}
    </QueryState>
    <ConfirmSheet visible={error !== null} title="저장하지 못했어요" message={error ?? ''} confirmText="확인" cancelText="닫기" onCancel={() => setError(null)} onConfirm={() => setError(null)} />
  </View>;
}
