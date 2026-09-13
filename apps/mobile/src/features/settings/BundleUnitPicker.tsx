import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Field, Select, Sheet } from '@/components/kit';
import { SelectionRow } from '@/components/kit/SelectionRow';
import { useBundleUnits } from '@/features/settings/bundleUnits';
import { COLOR, TYPE, space } from '@/theme/tokens';

/** Copy a template's base quantity into the input once. Later edits/deletion never recalculate an existing draft. */
export function BundleUnitPicker({ onSelect, value, disabled = false }: { value: string; onSelect: (quantity: number) => void; disabled?: boolean }) {
  const query = useBundleUnits(); const [open, setOpen] = useState(false); const [selected, setSelected] = useState<{ name: string; quantity: number; itemUnitName: string } | null>(null);
  return <View style={{ gap: space.sm }}>
    <Field label="묶음 단위" variant="stacked">
      <Select variant="stacked" value={selected && Number(value) === selected.quantity ? `1${selected.name} = ${selected.quantity}${selected.itemUnitName}` : ''} placeholder="묶음 단위 선택" accessibilityLabel="묶음 단위 선택" expanded={open} onPress={() => { if (!disabled) setOpen(true); }} />
    </Field>
    <Sheet visible={open} onClose={() => setOpen(false)} title="묶음 단위 선택">
      <Text style={{ ...TYPE.caption, color: COLOR.text.secondary, marginBottom: space.md }}>모·병 같은 낱개 단위는 개수로 환산해 용량에 입력돼요. 수량은 아래에서 조절할 수 있어요.</Text>
      {query.isLoading ? <Text>불러오는 중…</Text> : query.isError ? <><Text>묶음 단위를 불러오지 못했어요.</Text><Button kind="gray" onPress={() => void query.refetch()}>다시 불러오기</Button></> : !query.data?.length ? <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>MY → 단위 설정에서 묶음 단위를 추가해 주세요.</Text> : query.data.map((unit, i) => <SelectionRow key={unit.id} label={`1${unit.name} = ${unit.quantity.toLocaleString()}${unit.itemUnitName}`} selected={false} last={i === query.data!.length - 1} onPress={() => { if (!disabled) { setSelected({ name: unit.name, quantity: unit.quantity, itemUnitName: unit.itemUnitName }); onSelect(unit.quantity); setOpen(false); } }} />)}
    </Sheet>
  </View>;
}
