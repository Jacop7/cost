/**
 * SortSheet — 정렬 선택 바텀시트 + 이를 여는 칩.
 *
 * 정렬은 "현재 맥락을 유지해야 하는 짧은 선택"이라 바텀시트가 맞다(가이드 §9.9).
 * 선택은 색이 아니라 체크 아이콘 + 접근성 state 로도 전달한다(§9.6-6, §9.4-3).
 */
import { SelectionRow } from './SelectionRow';
import { Sheet } from './Sheet';
import { FilterChip } from './FilterChip';

export interface SortOption<K extends string> {
  key: K;
  label: string;
}

/** 정렬 기준을 여는 칩. 현재 선택된 라벨을 그대로 보여준다. */
export function SortChip({ label, onPress }: { label: string; onPress: () => void }) {
  return <FilterChip label={label} onPress={onPress} accessibilityLabel={`정렬 기준: ${label}`}
    accessibilityHint="정렬 기준을 바꿉니다" />;
}

export function SortSheet<K extends string>({ visible, options, value, onSelect, onClose }: {
  visible: boolean;
  options: readonly SortOption<K>[];
  value: K;
  onSelect: (k: K) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="정렬 기준">
      {options.map((o, i) => {
        const on = o.key === value;
        return (
          <SelectionRow
            key={o.key}
            label={o.label}
            selected={on}
            last={i === options.length - 1}
            onPress={() => { onSelect(o.key); onClose(); }}
          />
        );
      })}
    </Sheet>
  );
}
