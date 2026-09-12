import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Button, Field, Input, Sheet } from '@/components/kit';
import { ResultField } from '@/components/kit/ResultField';
import { clampDecimals } from '@/lib/num';
import { COLOR, TYPE, space, won } from '@/theme/tokens';

export function IngredientUsageSheet({ visible, name, value, unit, unitPrice, servings, onChange, onClose, onSave, onDelete, busy = false, blocked = false, children }: {
  visible: boolean; name: string; value: string; unit: string; unitPrice: number | null; servings: number;
  onChange: (value: string) => void; onClose: () => void; onSave: () => void; onDelete: () => void;
  busy?: boolean; blocked?: boolean; children?: ReactNode;
}) {
  const quantity = Number(value.replace(/,/g, ''));
  const valid = value.trim() !== '' && Number.isFinite(quantity) && quantity > 0;
  const cost = unitPrice === null ? null : quantity * unitPrice;
  return <Sheet visible={visible} title="식재료 사용량 수정" onClose={() => { if (!busy) onClose(); }}>
    <Text style={{ ...TYPE.body, color: COLOR.text.primary, marginBottom: space.md }}>{name}</Text>
    {children}
    <Field label={`${servings}인분 사용량`} req variant="stacked">
      <Input value={value} onChangeText={v => onChange(clampDecimals(v, 2))} suffix={unit}
        disabled={busy || blocked} mono variant="stacked" keyboardType="decimal-pad" accessibilityLabel="사용량" />
    </Field>
    <ResultField label={`${servings}인분 비용`} value={cost === null ? '단가 산출 전' : `${won(Math.round(cost))}원`} />
    <ResultField label="1인분 비용" value={cost === null ? '단가 산출 전' : `${won(Math.round(cost / servings))}원`} />
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Button kind="gray" size="lg" style={{ flex: 1 }} disabled={busy || blocked} onPress={onDelete}>삭제</Button>
      <Button kind="primary" size="lg" style={{ flex: 1 }} disabled={busy || blocked || !valid} loading={busy} onPress={onSave}>저장</Button>
    </View>
  </Sheet>;
}
