/**
 * MY-09 영업시간 — Claude Design 2a.
 *
 * 영업 요일은 체크 목록에서 바로 켜고 끈다. 체크하지 않은 날은 정기 휴무다.
 * 시작·종료 시각은 모든 영업 요일에 공통 적용하며, 종료일(당일/익일)은 시각과
 * 별도로 저장한다. 서버 판본·적용일·충돌 처리는 기존 권위 계약을 유지한다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { RpcError } from '@/lib/supabase';
import { AppHeader, Button, Card, Icon, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { LAYOUT, COLOR, T, TYPE, radius, space } from '@/theme/tokens';
import { useHoursStatus, useSetOperatingHours } from '@/features/settings/hooks';
import {
  closeDayOffsetOf,
  DEFAULT_DAY,
  DOW_LABEL,
  DOW_ORDER,
  isOvernight,
  WeeklySchedule,
  fromRule,
  toWeeklyJson,
  validateWeeklySchedule,
} from '../weeklySchedule';

const NUM = { fontVariant: ['tabular-nums' as const] };
const FULL_DOW_LABEL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const;
const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];
const WHEEL_ROW_HEIGHT = 40;
const WHEEL_HEIGHT = WHEEL_ROW_HEIGHT * 5;

const mdLabel = (ymd: string) => `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일`;

const firstOpenDay = (schedule: WeeklySchedule) =>
  DOW_ORDER.map((dow) => schedule[dow]).find((day) => day && !day.closed) ?? schedule[DOW_ORDER[0]] ?? DEFAULT_DAY;

const asSharedSchedule = (
  schedule: WeeklySchedule,
  open: string,
  close: string,
  closeDayOffset: 0 | 1,
): WeeklySchedule => Object.fromEntries(DOW_ORDER.map((dow) => {
  const day = schedule[dow] ?? DEFAULT_DAY;
  return [dow, {
    ...day,
    open,
    close,
    closeDayOffset,
    breakStart: null,
    breakEnd: null,
  }];
})) as WeeklySchedule;

function WheelColumn({
  values,
  value,
  suffix,
  width,
  label,
  onChange,
}: {
  values: string[];
  value: string;
  suffix?: string;
  width: number;
  label: string;
  onChange: (value: string) => void;
}) {
  const listRef = useRef<FlatList<string>>(null);
  const selectedIndex = Math.max(0, values.indexOf(value));

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: selectedIndex * WHEEL_ROW_HEIGHT, animated: false });
  }, [selectedIndex]);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.max(0, Math.min(values.length - 1, Math.round(event.nativeEvent.contentOffset.y / WHEEL_ROW_HEIGHT)));
    onChange(values[index] ?? values[0] ?? '');
  };

  return (
    <FlatList
      ref={listRef}
      data={values}
      keyExtractor={(item) => item}
      initialNumToRender={values.length}
      style={{ width, height: WHEEL_HEIGHT }}
      contentContainerStyle={{ paddingVertical: WHEEL_ROW_HEIGHT * 2 }}
      showsVerticalScrollIndicator={false}
      snapToInterval={WHEEL_ROW_HEIGHT}
      decelerationRate="fast"
      contentOffset={{ x: 0, y: selectedIndex * WHEEL_ROW_HEIGHT }}
      getItemLayout={(_data, index) => ({ length: WHEEL_ROW_HEIGHT, offset: WHEEL_ROW_HEIGHT * index, index })}
      onMomentumScrollEnd={settle}
      renderItem={({ item }) => {
        const selected = item === value;
        return (
          <Pressable
            onPress={() => {
              onChange(item);
              listRef.current?.scrollToOffset({ offset: values.indexOf(item) * WHEEL_ROW_HEIGHT, animated: true });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${item}${label} 선택`}
            accessibilityState={{ selected }}
            style={{ height: WHEEL_ROW_HEIGHT, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
          >
            <Text style={[{
              fontSize: selected ? TYPE.title.fontSize : TYPE.body.fontSize,
              lineHeight: selected ? TYPE.title.lineHeight : TYPE.body.lineHeight,
              fontWeight: selected ? '800' : '600',
              color: selected ? COLOR.text.primary : COLOR.text.disabled,
            }, NUM]}>
              {item}
            </Text>
            {suffix ? <Text style={{ ...TYPE.caption, color: selected ? COLOR.text.secondary : COLOR.text.disabled, marginLeft: 2 }}>{suffix}</Text> : null}
          </Pressable>
        );
      }}
    />
  );
}

function TimeWheelSheet({
  visible,
  kind,
  value,
  openTime,
  closeDayOffset,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  kind: 'open' | 'close';
  value: string;
  openTime: string;
  closeDayOffset: 0 | 1;
  onClose: () => void;
  onConfirm: (value: string, closeDayOffset: 0 | 1) => void;
}) {
  const [hour, setHour] = useState(value.slice(0, 2));
  const [minute, setMinute] = useState(value.slice(3, 5));
  const [dayOffset, setDayOffset] = useState<0 | 1>(closeDayOffset);

  useEffect(() => {
    if (!visible) return;
    setHour(value.slice(0, 2));
    setMinute(value.slice(3, 5));
    setDayOffset(closeDayOffset);
  }, [visible, value, closeDayOffset]);

  const setTimePart = (nextHour: string, nextMinute: string) => {
    setHour(nextHour);
    setMinute(nextMinute);
    if (kind === 'close') setDayOffset(isOvernight(openTime, `${nextHour}:${nextMinute}`) ? 1 : 0);
  };

  const time = `${hour}:${minute}`;
  const prefix = kind === 'close' && dayOffset === 1 ? '익일 ' : '';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={kind === 'open' ? '영업 시작' : '영업 종료'}
      height={440}
      scroll={false}
      footer={(
        <Button kind="primary" size="lg" full onPress={() => onConfirm(time, kind === 'open' ? 0 : dayOffset)}>
          {prefix}{time} {kind === 'open' ? '시작' : '종료'}
        </Button>
      )}
    >
      <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: 'center' }}>
        <View style={{ position: 'relative', height: WHEEL_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ pointerEvents: 'none', position: 'absolute', left: 0, right: 0, top: WHEEL_ROW_HEIGHT * 2, height: WHEEL_ROW_HEIGHT, borderRadius: radius.sm, backgroundColor: T.surface2 }} />
          {kind === 'close' ? (
            <WheelColumn
              values={['당일', '익일']}
              value={dayOffset === 1 ? '익일' : '당일'}
              width={88}
              label=" 종료일"
              onChange={(next) => setDayOffset(next === '익일' ? 1 : 0)}
            />
          ) : null}
          <WheelColumn values={HOURS} value={hour} width={82} suffix="시" label="시" onChange={(next) => setTimePart(next, minute)} />
          <WheelColumn values={MINUTES} value={minute} width={82} suffix="분" label="분" onChange={(next) => setTimePart(hour, next)} />
        </View>
      </View>
    </Sheet>
  );
}

function DayBadge({ nextDay }: { nextDay: boolean }) {
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: COLOR.action.primaryTint }}>
      <Text style={{ fontSize: 12, lineHeight: 17, fontWeight: '800', color: COLOR.action.onTint }}>{nextDay ? '익일' : '당일'}</Text>
    </View>
  );
}

export default function MyHoursScreen() {
  const status = useHoursStatus();
  const save = useSetOperatingHours();
  const [days, setDays] = useState<WeeklySchedule | null>(null);
  const [base, setBase] = useState<{ ruleId: string; revision: number } | null>(null);
  const [openTime, setOpenTime] = useState('11:00');
  const [closeTime, setCloseTime] = useState('22:00');
  const [closeDayOffset, setCloseDayOffset] = useState<0 | 1>(0);
  const [picking, setPicking] = useState<null | 'open' | 'close'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const st = status.data;

  const loadEditor = (schedule: WeeklySchedule) => {
    const representative = firstOpenDay(schedule);
    setOpenTime(representative.open);
    setCloseTime(representative.close);
    setCloseDayOffset(closeDayOffsetOf(representative));
  };

  useEffect(() => {
    if (!st || days !== null) return;
    const basis = st.pending ?? st.currentRule;
    if (basis) {
      const parsed = fromRule(basis.weeklyHours, basis.weeklyBreaks);
      if (parsed) {
        setDays(parsed);
        loadEditor(parsed);
        setBase({ ruleId: basis.ruleId, revision: basis.revision });
      }
      return;
    }
    const fresh: WeeklySchedule = {};
    for (let dow = 0; dow < 7; dow += 1) fresh[dow] = { ...DEFAULT_DAY };
    setDays(fresh);
    loadEditor(fresh);
    setBase(null);
  }, [st, days]);

  const brokenRule = Boolean(st?.pending ?? st?.currentRule) && days === null && !status.isLoading;
  const saveDays = useMemo(
    () => (days ? asSharedSchedule(days, openTime, closeTime, closeDayOffset) : null),
    [days, openTime, closeTime, closeDayOffset],
  );
  const validationError = useMemo(() => (saveDays ? validateWeeklySchedule(saveDays) : null), [saveDays]);
  const allOpen = Boolean(days && DOW_ORDER.every((dow) => days[dow]?.closed === false));

  const replaceOpenDayTimes = (nextOpen: string, nextClose: string, nextOffset: 0 | 1) => {
    setDays((current) => {
      if (!current) return current;
      const next: WeeklySchedule = { ...current };
      for (const dow of DOW_ORDER) {
        const day = current[dow] ?? DEFAULT_DAY;
        if (!day.closed) {
          next[dow] = {
            ...day,
            open: nextOpen,
            close: nextClose,
            closeDayOffset: nextOffset,
            breakStart: null,
            breakEnd: null,
          };
        }
      }
      return next;
    });
  };

  const toggleDay = (dow: number) => {
    setDays((current) => {
      if (!current) return current;
      const before = current[dow] ?? DEFAULT_DAY;
      const opening = before.closed;
      return {
        ...current,
        [dow]: opening
          ? { ...before, open: openTime, close: closeTime, closeDayOffset, closed: false, breakStart: null, breakEnd: null }
          : { ...before, closed: true, breakStart: null, breakEnd: null },
      };
    });
  };

  const openEveryDay = () => {
    setDays((current) => {
      if (!current) return current;
      const next: WeeklySchedule = { ...current };
      for (const dow of DOW_ORDER) {
        next[dow] = {
          ...(current[dow] ?? DEFAULT_DAY),
          open: openTime,
          close: closeTime,
          closeDayOffset,
          closed: false,
          breakStart: null,
          breakEnd: null,
        };
      }
      return next;
    });
  };

  const applyPickedTime = (value: string, pickedOffset: 0 | 1) => {
    if (picking === 'open') {
      const autoOffset = isOvernight(value, closeTime) ? 1 : 0;
      setOpenTime(value);
      setCloseDayOffset(autoOffset);
      replaceOpenDayTimes(value, closeTime, autoOffset);
    } else if (picking === 'close') {
      setCloseTime(value);
      setCloseDayOffset(pickedOffset);
      replaceOpenDayTimes(openTime, value, pickedOffset);
    }
    setPicking(null);
  };

  const reloadFromServer = async () => {
    const result = await status.refetch();
    if (result.isError || !result.data) return false;
    const basis = result.data.pending ?? result.data.currentRule;
    if (!basis) return false;
    const parsed = fromRule(basis.weeklyHours, basis.weeklyBreaks);
    if (!parsed) return false;
    setDays(parsed);
    loadEditor(parsed);
    setBase({ ruleId: basis.ruleId, revision: basis.revision });
    return true;
  };

  const submit = () => {
    if (!saveDays) return;
    const error = validateWeeklySchedule(saveDays);
    if (error) {
      Alert.alert('저장할 수 없어요', error);
      setToast(error);
      return;
    }
    if (!base) {
      void reloadFromServer().then((ok) => setToast(ok
        ? '수정 기준을 다시 불러왔어요 · 다시 저장해 주세요'
        : '최신 값을 못 받았어요 · 잠시 뒤 다시 시도해 주세요'));
      return;
    }
    const { hours, breaks } = toWeeklyJson(saveDays);
    save.mutate(
      { weeklyHours: hours, weeklyBreaks: breaks, baseRuleId: base.ruleId, baseRevision: base.revision },
      {
        onSuccess: (result) => {
          setBase({ ruleId: result.ruleId, revision: result.ruleRevision });
          setToast(result.appliesToday
            ? '저장했어요 · 오늘부터 적용돼요'
            : `저장했어요 · ${mdLabel(result.effectiveFrom)}부터 적용돼요`);
        },
        onError: (error) => {
          if (error instanceof RpcError && error.code === '45009') {
            setBase(null);
            void reloadFromServer().then((ok) => setToast(ok
              ? '다른 기기에서 영업시간이 변경됐어요 · 최신 값을 다시 불러왔어요'
              : '다른 기기에서 영업시간이 변경됐어요 · 최신 값을 못 받았어요. 다시 시도해 주세요'));
            return;
          }
          const message = error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요';
          Alert.alert('저장하지 못했어요', message);
          setToast(message);
        },
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="영업시간" onBack={() => safeBack('/my')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: space.sm, paddingBottom: 112, gap: space.md }}>
        <QueryState
          isLoading={status.isLoading}
          error={status.error ?? (brokenRule ? new Error('영업시간 규칙을 읽지 못했어요. 잠시 후 다시 시도해 주세요') : null)}
          isEmpty={false}
          onRetry={() => { void reloadFromServer(); }}
          emptyTitle="설정을 불러오지 못했어요"
        >
          {st?.pending ? (
            <Card pad={0} style={{ overflow: 'hidden', borderColor: COLOR.action.primary }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.lg }}>
                <View style={{ paddingTop: 1 }}><Icon name="calendar" size={18} color={COLOR.action.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...TYPE.caption, fontWeight: '800', color: COLOR.text.accent }}>
                    변경한 영업시간은 {mdLabel(st.pending.effectiveFrom)}부터 적용돼요
                  </Text>
                  <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary, marginTop: space.xs }}>
                    오늘 영업시간은 {st.today.openTime.slice(0, 5)}~{st.today.closeDayOffset === 1 ? '익일 ' : ''}{st.today.closeTime.slice(0, 5)} 그대로예요.
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          <Card pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ ...TYPE.body, flex: 1, color: COLOR.text.primary }}>영업 요일</Text>
              <Pressable onPress={openEveryDay} accessibilityRole="button" accessibilityLabel="매일 영업" accessibilityState={{ selected: allOpen }} hitSlop={10}>
                <Text style={{ ...TYPE.caption, fontWeight: '800', color: COLOR.text.link }}>매일</Text>
              </Pressable>
            </View>

            {days ? DOW_ORDER.map((dow, index) => {
              const checked = days[dow]?.closed === false;
              return (
                <Pressable
                  key={dow}
                  onPress={() => toggleDay(dow)}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${DOW_LABEL[dow]}요일`}
                  accessibilityState={{ checked }}
                  style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, borderBottomWidth: index === DOW_ORDER.length - 1 ? 0 : 1, borderBottomColor: T.line2 }}
                >
                  <View style={{ width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginRight: space.md, borderWidth: 1, borderColor: checked ? COLOR.action.primary : T.line, backgroundColor: checked ? COLOR.action.primary : T.surface }}>
                    {checked ? <Icon name="check" size={17} color={T.onColor} sw={2.3} /> : null}
                  </View>
                  <Text style={{ ...TYPE.body, flex: 1, color: checked ? COLOR.text.primary : COLOR.text.disabled }}>{FULL_DOW_LABEL[dow]}</Text>
                  {!checked ? <Text style={{ ...TYPE.caption, color: COLOR.text.disabled }}>휴무</Text> : null}
                </Pressable>
              );
            }) : null}
          </Card>

          <Card pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ minHeight: 54, justifyContent: 'center', paddingHorizontal: space.lg }}>
              <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>영업 시각</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.lg }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary, marginBottom: 7 }}>시작</Text>
                <Pressable onPress={() => setPicking('open')} accessibilityRole="button" accessibilityLabel="시작 선택" style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: T.line, borderRadius: radius.md, backgroundColor: T.surface }}>
                  <DayBadge nextDay={false} />
                  <Text style={[{ ...TYPE.title, color: COLOR.text.primary }, NUM]}>{openTime}</Text>
                </Pressable>
              </View>
              <Text style={{ ...TYPE.title, color: COLOR.text.disabled, paddingBottom: 20 }}>→</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary, marginBottom: 7 }}>종료</Text>
                <Pressable onPress={() => setPicking('close')} accessibilityRole="button" accessibilityLabel="종료 선택" style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: T.line, borderRadius: radius.md, backgroundColor: T.surface }}>
                  <DayBadge nextDay={closeDayOffset === 1} />
                  <Text style={[{ ...TYPE.title, color: COLOR.text.primary }, NUM]}>{closeTime}</Text>
                </Pressable>
              </View>
            </View>
          </Card>

          {validationError ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingHorizontal: 2 }}>
              <Icon name="info" size={16} color={COLOR.status.negative} />
              <Text style={{ ...TYPE.caption, flex: 1, color: COLOR.status.negative }}>{validationError}</Text>
            </View>
          ) : null}
        </QueryState>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: space.md, paddingBottom: LAYOUT.scroll.end, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full loading={save.isPending} disabled={!days || validationError !== null} onPress={submit}>저장</Button>
      </View>

      <TimeWheelSheet visible={picking !== null} kind={picking ?? 'open'} value={picking === 'close' ? closeTime : openTime} openTime={openTime} closeDayOffset={closeDayOffset} onClose={() => setPicking(null)} onConfirm={applyPickedTime} />

      {toast ? (
        <Pressable onPress={() => setToast(null)} accessibilityRole="button" accessibilityLabel="알림 닫기" style={{ position: 'absolute', left: 16, right: 16, bottom: 104, paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: 'rgba(25,31,40,0.92)' }}>
          <Text style={{ ...TYPE.caption, fontWeight: '700', color: T.onColor }}>{toast}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
