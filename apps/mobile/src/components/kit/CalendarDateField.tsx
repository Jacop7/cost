import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { COLOR, COMPONENT, T, TYPE, radius, space } from '@/theme/tokens';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

const DOWS = ['일', '월', '화', '수', '목', '금', '토'];
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const pad = (value: number) => String(value).padStart(2, '0');

const monthStart = (value: string) => `${value.slice(0, 7)}-01`;
const monthTitle = (value: string) => `${Number(value.slice(0, 4))}년 ${Number(value.slice(5, 7))}월`;
const shiftMonth = (value: string, delta: number) => {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7)) - 1 + delta;
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-01`;
};
const monthEnd = (value: string) => {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const date = new Date(Date.UTC(year, month, 0));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};
const monthCells = (anchor: string): (string | null)[] => {
  const start = new Date(`${monthStart(anchor)}T00:00:00Z`);
  const days = Number(monthEnd(anchor).slice(8, 10));
  const cells: (string | null)[] = Array.from({ length: start.getUTCDay() }, () => null);
  for (let day = 1; day <= days; day += 1) cells.push(`${anchor.slice(0, 7)}-${pad(day)}`);
  while (cells.length % 7) cells.push(null);
  return cells;
};

/** 텍스트 날짜 입력 대신 달력에서 하루를 고르는 공용 필드. */
export function CalendarDateField({ value, onChange, label = '날짜', minDate, maxDate, disabled = false,
  presentation = 'field', displayValue }: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  presentation?: 'field' | 'row';
  displayValue?: string;
}) {
  const safeValue = YMD.test(value) ? value : minDate ?? maxDate ?? '2000-01-01';
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(monthStart(safeValue));
  const cells = useMemo(() => monthCells(anchor), [anchor]);
  const previous = shiftMonth(anchor, -1);
  const next = shiftMonth(anchor, 1);
  const previousDisabled = Boolean(minDate && monthEnd(previous) < minDate);
  const nextDisabled = Boolean(maxDate && next > maxDate);
  const openCalendar = () => {
    setAnchor(monthStart(safeValue));
    setOpen(true);
  };
  const select = (date: string) => {
    onChange(date);
    setOpen(false);
  };

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${value} 고르기`}
      accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={openCalendar}
      style={presentation === 'row'
        ? { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.sm,
          borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: disabled ? T.surface2 : T.surface }
        : { minHeight: COMPONENT.stackedForm.controlMinHeight, paddingHorizontal: COMPONENT.stackedForm.controlPaddingHorizontal,
          flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1,
          borderColor: open ? COLOR.action.primary : COMPONENT.input.border.default,
          borderRadius: radius.md, backgroundColor: disabled ? T.surface2 : T.surface }}>
      {presentation === 'row' ? <>
        <Icon name="calendar" size={18} color={COLOR.text.secondary} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ ...TYPE.caption, fontWeight: '800', color: COLOR.text.primary }}>{label}</Text>
          <Text style={{ ...TYPE.caption, fontWeight: '800', color: COLOR.text.accent }}>*</Text>
        </View>
        <Text style={{ ...TYPE.caption, fontWeight: '800', color: COLOR.text.accent }}>{displayValue ?? value}</Text>
        <Icon name="chevron" size={17} color={COLOR.text.secondary} />
      </> : <>
        <Text style={{ flex: 1, ...COMPONENT.stackedForm.value, color: disabled ? COLOR.text.disabled : COLOR.text.primary }}>
          {displayValue ?? value}
        </Text>
        <Icon name="calendar" size={19} color={open ? COLOR.action.primary : COLOR.text.tertiary} />
      </>}
    </Pressable>
    <Sheet visible={open} onClose={() => setOpen(false)} title={`${label} 선택`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: space.lg }}>
        <Pressable accessibilityRole="button" accessibilityLabel="이전 달" disabled={previousDisabled}
          onPress={() => setAnchor(previous)} hitSlop={10}
          style={{ width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: previousDisabled ? 0.3 : 1 }}>
          <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="chevron" size={18} color={COLOR.text.tertiary} /></View>
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', ...TYPE.body, fontWeight: '800', color: COLOR.text.primary }}>{monthTitle(anchor)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="다음 달" disabled={nextDisabled}
          onPress={() => setAnchor(next)} hitSlop={10}
          style={{ width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: nextDisabled ? 0.3 : 1 }}>
          <Icon name="chevron" size={18} color={COLOR.text.tertiary} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: space.sm }}>
        {DOWS.map((day, index) => <Text key={day} style={{ flex: 1, textAlign: 'center', ...TYPE.captionSm,
          fontWeight: '700', color: index === 0 ? COLOR.status.negative : COLOR.text.tertiary }}>{day}</Text>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.md }}>
        {cells.map((date, index) => {
          if (!date) return <View key={`blank-${index}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          const selected = date === value;
          const unavailable = Boolean((minDate && date < minDate) || (maxDate && date > maxDate));
          return <View key={date} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${Number(date.slice(8, 10))}일 선택`}
              accessibilityState={{ selected, disabled: unavailable }} disabled={unavailable} onPress={() => select(date)}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md,
                opacity: unavailable ? 0.28 : 1, backgroundColor: selected ? COLOR.action.primary : 'transparent' }}>
              <Text style={{ ...TYPE.caption, fontWeight: selected ? '800' : '600',
                color: selected ? T.onColor : index % 7 === 0 ? COLOR.status.negative : COLOR.text.primary }}>
                {Number(date.slice(8, 10))}
              </Text>
            </Pressable>
          </View>;
        })}
      </View>
    </Sheet>
  </>;
}
