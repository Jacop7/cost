import { useState } from 'react';
import { View } from 'react-native';
import { FilterButton, Sheet } from '@/components/kit';
import { SelectionRow } from '@/components/kit/SelectionRow';
import { space } from '@/theme/tokens';

export function recentFixedMonths(localMonth: string): string[] {
  const [year, month] = localMonth.split('-').map(Number);
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(Date.UTC(year!, month! - 1 - i, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}
const label = (month: string) => `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;

/** Both readers and editors use the server's local month, never the device clock. */
export function FixedMonthPicker({ value, localMonth, onChange, disabled = false }: {
  value: string; localMonth: string; onChange: (month: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const recent = recentFixedMonths(localMonth);
  const months = recent.includes(value) ? recent : [...recent, value];
  return <>
    <View style={{ alignItems: 'flex-start', paddingHorizontal: space.lg, paddingVertical: space.sm }}>
      <FilterButton label={label(value)} onPress={() => { if (!disabled) setOpen(true); }} />
    </View>
    <Sheet visible={open} onClose={() => setOpen(false)} title="월 선택">
      {months.map((month, i) => <SelectionRow key={month} label={label(month)} selected={month === value}
        last={i === months.length - 1} onPress={() => { setOpen(false); if (!disabled && month !== value) onChange(month); }} />)}
    </Sheet>
  </>;
}
