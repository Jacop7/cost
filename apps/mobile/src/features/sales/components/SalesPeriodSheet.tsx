import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Icon, Sheet } from '@/components/kit';
import { parseDay } from '@/lib/date';
import { COLOR, T, TYPE, radius, space } from '@/theme/tokens';

type PeriodMode = 'month' | 'day';
export type SalesPeriodRange = { mode: PeriodMode; from: string; to: string };

const DOWS = ['일', '월', '화', '수', '목', '금', '토'];
const pad2 = (value: number) => String(value).padStart(2, '0');
const monthStart = (value: string) => `${value.slice(0, 7)}-01`;
const monthEnd = (value: string) => {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const date = new Date(Date.UTC(year, month, 0));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
};
const shiftMonth = (value: string, delta: number) => {
  const date = parseDay(monthStart(value));
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-01`;
};
const monthTitle = (value: string) => `${Number(value.slice(0, 4))}년 ${Number(value.slice(5, 7))}월`;
const oneYearBefore = (today: string) => {
  const date = parseDay(today);
  const year = date.getUTCFullYear() - 1;
  const month = date.getUTCMonth();
  const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
};
const monthCells = (anchor: string): (string | null)[] => {
  const start = parseDay(monthStart(anchor));
  const days = Number(monthEnd(anchor).slice(8, 10));
  const cells: (string | null)[] = Array.from({ length: start.getUTCDay() }, () => null);
  for (let day = 1; day <= days; day += 1) cells.push(`${anchor.slice(0, 7)}-${pad2(day)}`);
  while (cells.length % 7) cells.push(null);
  return cells;
};
const monthsBetween = (from: string, to: string) => {
  const result: string[] = [];
  let cursor = monthStart(from);
  const last = monthStart(to);
  while (cursor <= last) {
    result.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return result;
};
export function SalesPeriodSheet({ visible, today, value, onClose, onApply }: {
  visible: boolean;
  today: string;
  value: SalesPeriodRange;
  onClose: () => void;
  onApply: (value: SalesPeriodRange) => void;
}) {
  const minDate = useMemo(() => oneYearBefore(today), [today]);
  const months = useMemo(() => {
    const currentYear = Number(today.slice(0, 4));
    return [currentYear - 1, currentYear].flatMap(year =>
      Array.from({ length: 12 }, (_, index) => `${year}-${pad2(index + 1)}`));
  }, [today]);
  const calendarMonths = useMemo(() => monthsBetween(minDate, today), [minDate, today]);
  const monthGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const month of months) {
      const year = month.slice(0, 4);
      groups.set(year, [...(groups.get(year) ?? []), month]);
    }
    return [...groups.entries()];
  }, [months]);
  const calendarRef = useRef<ScrollView>(null);
  const [mode, setMode] = useState<PeriodMode>(value.mode);
  const [monthFrom, setMonthFrom] = useState(value.from.slice(0, 7));
  const [monthTo, setMonthTo] = useState(value.to.slice(0, 7));
  const [monthEditing, setMonthEditing] = useState<'from' | 'to'>('from');
  const [draftFrom, setDraftFrom] = useState(value.from);
  const [draftTo, setDraftTo] = useState(value.to);
  const [editing, setEditing] = useState<'from' | 'to'>('from');

  useEffect(() => {
    if (!visible) return;
    setMode(value.mode);
    const nextMonthFrom = months.includes(value.from.slice(0, 7)) ? value.from.slice(0, 7) : today.slice(0, 7);
    const nextMonthTo = months.includes(value.to.slice(0, 7)) ? value.to.slice(0, 7) : today.slice(0, 7);
    setMonthFrom(nextMonthFrom);
    setMonthTo(nextMonthTo < nextMonthFrom ? nextMonthFrom : nextMonthTo);
    setMonthEditing('from');
    setDraftFrom(value.from < minDate ? minDate : value.from);
    setDraftTo(value.to > today ? today : value.to);
    setEditing('from');
  }, [minDate, months, today, value, visible]);

  const pickDay = (day: string) => {
    if (editing === 'from') {
      setDraftFrom(day);
      if (day > draftTo) setDraftTo(day);
      setEditing('to');
      return;
    }
    if (day < draftFrom) {
      setDraftFrom(day);
      setEditing('to');
      return;
    }
    setDraftTo(day);
  };

  const pickMonth = (month: string) => {
    if (monthEditing === 'from') {
      setMonthFrom(month);
      if (month > monthTo) setMonthTo(month);
      setMonthEditing('to');
      return;
    }
    if (month < monthFrom) {
      setMonthFrom(month);
      setMonthEditing('to');
      return;
    }
    setMonthTo(month);
    setMonthEditing('from');
  };

  const apply = () => {
    if (mode === 'month') {
      const from = `${monthFrom}-01`;
      const to = monthEnd(`${monthTo}-01`) > today ? today : monthEnd(`${monthTo}-01`);
      onApply({ mode, from, to });
      return;
    }
    onApply({ mode, from: draftFrom, to: draftTo });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`기간선택 - ${mode === 'month' ? '월간' : '일간'}`} height="90%" scroll={false}
      footer={(
        <View style={{ gap: space.sm }}>
          <View accessible accessibilityLabel={`선택 기간 ${mode === 'month' ? `${monthFrom} ~ ${monthTo}` : `${draftFrom} ~ ${draftTo}`}`}
            style={{ width: '100%', minHeight: 52, paddingHorizontal: space.md,
              flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1,
              borderColor: T.line, borderRadius: radius.md, backgroundColor: T.surface }}>
            <Icon name="calendar" size={20} color={T.ink} />
            <Text style={{ ...TYPE.body, fontWeight: '800', color: T.ink }}>
              {mode === 'month' ? `${monthFrom} ~ ${monthTo}` : `${draftFrom} ~ ${draftTo}`}
            </Text>
          </View>
          <Button kind="primary" size="lg" full onPress={apply}>적용</Button>
        </View>
      )}>
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, marginBottom: space.lg,
          borderRadius: radius.md, backgroundColor: T.line2 }}>
          {([['month', '월간'], ['day', '일간']] as const).map(([key, label]) => {
            const selected = mode === key;
            return (
              <Pressable key={key} accessibilityRole="tab" accessibilityLabel={label}
                accessibilityState={{ selected }} onPress={() => setMode(key)}
                style={{ flex: 1, minHeight: 40, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center',
                  borderWidth: selected ? 1 : 0, borderColor: T.line, borderRadius: radius.sm,
                  backgroundColor: selected ? T.surface : 'transparent' }}>
                <Text style={{ ...TYPE.body, fontWeight: selected ? '800' : '700', color: T.ink }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'month' ? (
          <>
            <ScrollView showsVerticalScrollIndicator={false} accessibilityLabel="연도별 월간 달력" contentContainerStyle={{ paddingBottom: space.md }}>
              {monthGroups.map(([year, yearMonths]) => (
                <View key={year} style={{ marginBottom: space.lg }}>
                  <Text style={{ ...TYPE.body, marginBottom: space.sm, fontWeight: '800', color: T.ink }}>{year}년</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                    {yearMonths.map(month => {
                      const inRange = month >= monthFrom && month <= monthTo;
                      const boundary = month === monthFrom || month === monthTo;
                      const unavailable = `${month}-01` > today;
                      return (
                        <View key={month} style={{ width: '25%', padding: 4 }}>
                          <Pressable accessibilityRole="button" accessibilityLabel={`${Number(year)}년 ${Number(month.slice(5, 7))}월 선택`}
                            accessibilityState={{ selected: boundary, disabled: unavailable }} disabled={unavailable} onPress={() => pickMonth(month)}
                            style={{ minHeight: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
                              opacity: unavailable ? 0.28 : 1, borderColor: boundary ? T.ink : inRange ? T.line2 : T.line,
                              borderRadius: radius.md, backgroundColor: boundary ? T.ink : inRange ? T.line2 : T.surface }}>
                            <Text style={{ ...TYPE.body, fontWeight: '800', color: boundary ? T.onColor : T.ink }}>{Number(month.slice(5, 7))}월</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', marginBottom: space.sm }}>
              {DOWS.map((day, index) => <Text key={day} style={{ flex: 1, textAlign: 'center', ...TYPE.captionSm,
                fontWeight: '700', color: index === 0 ? COLOR.status.negative : COLOR.text.tertiary }}>{day}</Text>)}
            </View>
            <ScrollView ref={calendarRef} showsVerticalScrollIndicator={false}
              accessibilityLabel="최근 1년 일간 달력"
              onContentSizeChange={() => calendarRef.current?.scrollToEnd?.({ animated: false })}
              contentContainerStyle={{ paddingBottom: space.md }}>
              {calendarMonths.map(month => (
                <View key={month} style={{ marginBottom: space.xl }}>
                  <Text style={{ ...TYPE.body, marginBottom: space.md, fontWeight: '800', color: T.ink }}>{monthTitle(month)}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {monthCells(month).map((date, index) => {
                      if (!date) {
                        const first = monthStart(month);
                        const last = monthEnd(month);
                        const leadingBlank = index < parseDay(first).getUTCDay();
                        const continuesThroughBlank = leadingBlank
                          ? draftFrom < first && draftTo >= first
                          : draftFrom <= last && draftTo > last;
                        return (
                          <View key={`blank-${month}-${index}`} style={{ width: `${100 / 7}%`, height: 48, paddingVertical: 2 }}>
                            <View style={{ flex: 1, backgroundColor: continuesThroughBlank ? T.line2 : 'transparent' }} />
                          </View>
                        );
                      }
                      const inRange = date >= draftFrom && date <= draftTo;
                      const boundary = date === draftFrom || date === draftTo;
                      const rangeStart = draftFrom !== draftTo && date === draftFrom;
                      const rangeEnd = draftFrom !== draftTo && date === draftTo;
                      const unavailable = date < minDate || date > today;
                      return (
                        <View key={date} style={{ width: `${100 / 7}%`, height: 48, paddingVertical: 2 }}>
                          <Pressable accessibilityRole="button" accessibilityLabel={`${Number(date.slice(0, 4))}년 ${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 선택`}
                            accessibilityState={{ selected: boundary, disabled: unavailable }} disabled={unavailable} onPress={() => pickDay(date)}
                            style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center',
                              opacity: unavailable ? 0.28 : 1 }}>
                            {inRange && draftFrom !== draftTo ? (
                              <View style={{ position: 'absolute', top: 0, bottom: 0, pointerEvents: 'none',
                                left: rangeStart ? '50%' : 0, right: rangeEnd ? '50%' : 0, backgroundColor: T.line2 }} />
                            ) : null}
                            <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
                              borderRadius: radius.full, backgroundColor: boundary ? T.ink : 'transparent' }}>
                              <Text style={{ ...TYPE.caption, fontWeight: boundary ? '800' : '600',
                                color: boundary ? T.onColor : index % 7 === 0 ? COLOR.status.negative : T.ink }}>{Number(date.slice(8, 10))}</Text>
                            </View>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </Sheet>
  );
}
