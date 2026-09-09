import { Sheet } from '@/components/kit';
import { SelectionRow } from '@/components/kit/SelectionRow';
import type { HistoryFilter } from '../screens/HistoryFilterSheet';

export type StockFilterGroup = 'period' | 'kind' | 'order';
const CONFIG = {
  period: { title: '조회 기간', items: ['최근 1개월', '최근 3개월', '최근 6개월', '전체'] },
  kind: { title: '유형', items: ['전체', '입고', '판매 소진', '차감', '폐기'] },
  order: { title: '정렬 기준', items: ['최신순', '오래된순'] },
} as const;

/** Three independent immediate pickers; shared rows preserve the common filter style. */
export function StockHistoryPicker({ group, value, onSelect, onClose }: {
  group: StockFilterGroup | null; value: HistoryFilter;
  onSelect: (value: HistoryFilter) => void; onClose: () => void;
}) {
  const config = CONFIG[group ?? 'period'];
  return <Sheet visible={group !== null} title={config.title} onClose={onClose}>
    {config.items.map((item, index) => <SelectionRow key={item} label={item}
      accessibilityLabel={`${item}${group && value[group] === item ? ', 현재 선택됨' : ''}`}
      selected={group !== null && value[group] === item} last={index === config.items.length - 1}
      onPress={() => { if (group) onSelect({ ...value, [group]: item } as HistoryFilter); }} />)}
  </Sheet>;
}
