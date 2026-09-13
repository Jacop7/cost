import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Field, Sheet } from '@/components/kit';
import { ResultField } from '@/components/kit/ResultField';
import { space } from '@/theme/tokens';

/** 사용량 입력·수정의 공통 표시. 수량 기준·계산·저장은 호출 화면이 소유한다. */
export function UsageSheet({ visible, title, itemLabel, name, quantityLabel, input, costs, onClose,
  onCancel = onClose, onConfirm, editing = false, valid, busy = false, blocked = false, children }: {
  visible: boolean; title: string; itemLabel: string; name: string; quantityLabel: string; input: ReactNode;
  costs: { label: string; value: string }[]; onClose: () => void; onCancel?: () => void; onConfirm: () => void;
  editing?: boolean; valid: boolean; busy?: boolean; blocked?: boolean; children?: ReactNode;
}) {
  return <Sheet visible={visible} title={title} onClose={() => { if (!busy) onClose(); }}>
    <ResultField label={itemLabel} value={name} align="left" />
    {children}
    <Field label={quantityLabel} req variant="stacked">{input}</Field>
    {costs.map((cost, index) => <ResultField key={index} label={cost.label} value={cost.value} />)}
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Button kind="gray" size="lg" style={{ flex: 1 }} disabled={busy || blocked} onPress={onCancel}>{editing ? '삭제' : '취소'}</Button>
      <Button kind="primary" size="lg" style={{ flex: 1 }} disabled={busy || blocked || !valid} loading={busy} onPress={onConfirm}>{editing ? '저장' : '담기'}</Button>
    </View>
  </Sheet>;
}
