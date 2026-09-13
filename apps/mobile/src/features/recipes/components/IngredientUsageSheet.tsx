import type { ReactNode } from 'react';
import { Input } from '@/components/kit';
import { UsageSheet } from './UsageSheet';
import { clampDecimals } from '@/lib/num';
import { won } from '@/theme/tokens';

export function IngredientUsageSheet({ visible, name, value, unit, unitPrice, servings, onChange, onClose, onSave, onDelete, busy = false, blocked = false, children }: {
  visible: boolean; name: string; value: string; unit: string; unitPrice: number | null; servings: number;
  onChange: (value: string) => void; onClose: () => void; onSave: () => void; onDelete: () => void;
  busy?: boolean; blocked?: boolean; children?: ReactNode;
}) {
  const quantity = Number(value.replace(/,/g, ''));
  const valid = value.trim() !== '' && Number.isFinite(quantity) && quantity > 0;
  const cost = unitPrice === null ? null : quantity * unitPrice;
  return <UsageSheet visible={visible} title="재료 사용량 수정" itemLabel="재료" name={name}
    quantityLabel={`${servings}인분 사용량`} editing valid={valid} busy={busy} blocked={blocked}
    onClose={onClose} onCancel={onDelete} onConfirm={onSave}
    input={<Input value={value} onChangeText={v => onChange(clampDecimals(v, 2))} suffix={unit}
      disabled={busy || blocked} mono variant="stacked" keyboardType="decimal-pad" accessibilityLabel="사용량" />}
    costs={[
      { label: `${servings}인분 비용`, value: cost === null ? '단가 산출 전' : `${won(Math.round(cost))}원` },
      { label: '1인분 비용', value: cost === null ? '단가 산출 전' : `${won(Math.round(cost / servings))}원` },
    ]}>{children}</UsageSheet>;
}
