import { Text, View } from 'react-native';
import { Field, Input } from '@/components/kit';
import { SelectionRow } from '@/components/kit/SelectionRow';
import { COLOR, T, TYPE, space } from '@/theme/tokens';
import type { InventoryOccurrenceContext } from '../hooks';

export type InventoryOccurrenceChoice = 'after_count' | 'before_count' | null;
export interface InventoryOccurrenceValue {
  choice: InventoryOccurrenceChoice;
  date: string;
  time: string;
}

export const emptyInventoryOccurrence = (): InventoryOccurrenceValue => ({
  choice: null,
  date: '',
  time: '',
});

export function inventoryOccurrenceReady(
  context: InventoryOccurrenceContext | undefined,
  value: InventoryOccurrenceValue,
) {
  if (!context?.requiresConfirmation) return true;
  if (value.choice === 'after_count') return true;
  return value.choice === 'before_count'
    && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
    && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.time);
}

export function inventoryOccurrenceInput(
  context: InventoryOccurrenceContext | undefined,
  value: InventoryOccurrenceValue,
) {
  return context?.requiresConfirmation && value.choice === 'before_count'
    ? { occurredDate: value.date, occurredTime: value.time }
    : {};
}

export function InventoryOccurrenceFields({ context, value, onChange, disabled = false }: {
  context: InventoryOccurrenceContext | undefined;
  value: InventoryOccurrenceValue;
  onChange: (next: InventoryOccurrenceValue) => void;
  disabled?: boolean;
}) {
  if (!context?.requiresConfirmation) return null;
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ gap: 3 }}>
        <Text style={{ ...TYPE.body, fontWeight: '800', color: COLOR.text.primary }}>실제 발생 시점</Text>
        <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>
          최근 재고 실사 {context.observationStartedLocal ?? '—'} ~ {context.countedLocal ?? '—'}에 이미 포함된 내역인지 확인해 주세요.
        </Text>
      </View>
      <View style={{ overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: T.line2 }}>
        <SelectionRow label="실사 후에 발생했어요" description="현재 재고에 반영해요."
          accessibilityLabel="실사 후에 발생했어요"
          selected={value.choice === 'after_count'} disabled={disabled}
          onPress={() => onChange({ ...value, choice: 'after_count' })} />
        <SelectionRow label="실사 전에 발생했어요" description="실사 수량에 이미 포함되어 재고를 다시 늘리거나 줄이지 않아요."
          accessibilityLabel="실사 전에 발생했어요"
          selected={value.choice === 'before_count'} disabled={disabled}
          onPress={() => onChange({ ...value, choice: 'before_count' })} />
      </View>
      {value.choice === 'before_count' ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Field label="발생 날짜" req variant="stacked">
              <Input variant="stacked" value={value.date} placeholder="YYYY-MM-DD" disabled={disabled} accessibilityLabel="발생 날짜"
                onChangeText={date => onChange({ ...value, date })} />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="발생 시간" req variant="stacked">
              <Input variant="stacked" value={value.time} placeholder="HH:MM" disabled={disabled} accessibilityLabel="발생 시간"
                onChangeText={time => onChange({ ...value, time })} />
            </Field>
          </View>
        </View>
      ) : null}
    </View>
  );
}
