// UnitPickerSheet.tsx — 단위 선택 바텀시트 (추가·수정·구매옵션 공용)
import { Platform } from 'react-native';
import { Sheet } from '../../../components/kit';
import { SelectionRow } from '@/components/kit/SelectionRow';

const UNIT_GROUPS: [string, string[]][] = [
  ['무게', ['kg', 'g']],
  ['부피', ['L', 'ml']],
  ['개수', ['박스', '개']],
];

// 기준단위 → 단위 그룹(부모단위+단위). 수정·구매옵션은 같은 그룹만 노출.
const GROUP_OF: Record<'g' | 'ml' | '개', string> = { g: '무게', ml: '부피', 개: '개수' };

export function UnitPickerSheet({
  visible,
  unit,
  onSelect,
  onClose,
  base,
}: {
  visible: boolean;
  unit: string;
  onSelect: (u: string) => void;
  onClose: () => void;
  base?: 'g' | 'ml' | '개'; // 지정 시 해당 그룹만 표시 (수정·구매옵션)
}) {
  const groups = base ? UNIT_GROUPS.filter(([label]) => label === GROUP_OF[base]) : UNIT_GROUPS;
  const options = groups.flatMap(([, units]) => units);
  return (
    <Sheet visible={visible} onClose={onClose} title="단위 선택">
                {options.map((u, i) => {
                  const on = unit === u;
                  return (
                    <SelectionRow
                      key={u}
                      label={u}
                      selected={on}
                      last={i === options.length - 1}
                      accessibilityLabel={Platform.OS === 'web' && on ? `${u}, 현재 선택됨` : u}
                      onPress={() => {
                        onSelect(u);
                        onClose();
                      }}
                    />
                  );
                })}
    </Sheet>
  );
}
