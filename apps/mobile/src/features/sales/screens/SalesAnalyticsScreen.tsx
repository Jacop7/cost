/**
 * SALES-02 매출 분석 — 기간 선택 기준의 손익 한 장.
 *
 * 구성: 기간 칩 → 월 캘린더(선택 기간 하이라이트) → 매출 분석 → 채널 구성 → 손익 계산 → 메뉴별 판매량.
 * 아래 세 블록은 일 손익 상세(SALES-03)와 같은 구성이고, 넣는 수치만 기간 집계로 바뀐다.
 *
 * 캘린더 숫자는 **그날의 실제 순이익**이다(sales_range.daily). 기간 합계를 비례 확대해
 * 그리면 캘린더를 더한 값과 아래 손익표가 어긋난다 — 그렇게 하지 않는다.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Button, Card, FilterButton, Icon, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { useSalesRange, type RangeMenu } from '../hooks';
import { ChannelMixCard, MenuSalesList, ProfitBreakdownCard, SalesRow, SecLabel } from '../components/ProfitBlocks';
import { MenuProfitSheet } from '../components/MenuProfitSheet';
import { addDays, parseDay, periods, rangeLabel, type PeriodKey } from '../period';
import { useSalesBusinessDate } from '../businessDay';
import { BusinessDateGate } from '../components/BusinessDateGate';

const NUM = { fontVariant: ['tabular-nums' as const] };
const DOWS = ['일', '월', '화', '수', '목', '금', '토'];
const pad2 = (n: number) => String(n).padStart(2, '0');

/** 캘린더가 그리는 달의 셀 배열. 앞 공백 + 1..말일. */
function monthCells(anchor: string): (string | null)[] {
  const d = parseDay(anchor);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const lead = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: last }, (_, i) => `${y}-${pad2(m + 1)}-${pad2(i + 1)}`),
  ];
}

const monthTitle = (anchor: string) => {
  const d = parseDay(anchor);
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월`;
};

/** 두 날짜 사이의 일수(양끝 포함). 직접설정 시트에서 "며칠치인지"를 말해 준다. */
function dayGap(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000) + 1;
}

/**
 * ⚠ 이 화면만 **감싸는 층**이 필요하다.
 *
 * 다른 조회 화면은 날짜를 조회 인자로만 쓰므로 빈 값이면 조회가 꺼지고 끝이다.
 * 그런데 여기는 `useState(today)` 로 **상태를 씨앗 삼는다**(달력 기준월).
 * 훅은 조건부로 못 부르니, 빈 날짜로 한 번 렌더되면 그 빈 값이 상태에 굳어
 * 나중에 서버 날짜가 와도 안 바뀐다.
 *
 * 그래서 날짜를 받은 **뒤에** 본체를 처음 붙인다. 본체는 날짜를 prop 으로 받으므로
 * 그 안의 훅들은 언제나 진짜 날짜를 본다.
 *
 * ⚠ 게이트가 `key={date}` 로 **날짜가 바뀌면 본체를 다시 만든다.** 화면을 열어 둔 채
 *   자정을 넘기거나 영업일이 바뀌면 `monthAnchor` 가 옛 날짜에 남기 때문이다.
 */
export default function SalesAnalyticsScreen() {
  return (
    <BusinessDateGate
      source={useSalesBusinessDate()}
      title="매출 분석"
      onBack={() => safeBack('/sales' as Href)}
    >
      {(today) => <SalesAnalyticsBody today={today} />}
    </BusinessDateGate>
  );
}

function SalesAnalyticsBody({ today }: { today: string }) {
  const PRESETS = useMemo(() => periods(today), [today]);

  const [periodKey, setPeriodKey] = useState<PeriodKey>('today');
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  /** 기간 고르는 입구는 여기 하나다(0096). 칩 여섯 개를 이 시트로 옮겼다. */
  const [periodOpen, setPeriodOpen] = useState(false);
  /** 직접설정에서 지금 고치는 칸. 달력 탭이 여기로 들어간다. */
  const [editing, setEditing] = useState<'from' | 'to'>('from');
  const [monthAnchor, setMonthAnchor] = useState(today);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState<string | null>(null);

  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [sel, setSel] = useState<RangeMenu | null>(null);

  const active = periodKey === 'custom' && custom
    ? { key: 'custom' as PeriodKey, short: '직접설정', label: rangeLabel(custom.from, custom.to), ...custom }
    : (PRESETS.find((p) => p.key === periodKey) ?? PRESETS[0]!);

  const range = useSalesRange(active.from, active.to);
  const s = range.data?.summary;

  // 캘린더에 찍을 날짜별 순이익. 보이는 달만 필요하므로 별도 조회한다.
  const cells = useMemo(() => monthCells(monthAnchor), [monthAnchor]);
  const monthFrom = cells.find((c): c is string => c !== null) ?? monthAnchor;
  const monthTo = [...cells].reverse().find((c): c is string => c !== null) ?? monthAnchor;
  const monthRange = useSalesRange(monthFrom, monthTo);
  const dailyBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of monthRange.data?.daily ?? []) m.set(d.date, d.profit);
    return m;
  }, [monthRange.data]);

  const inRange = (day: string) => day >= active.from && day <= active.to;

  const expense = (s?.revenue ?? 0) - (s?.profit ?? 0);
  const expenseRate = s && s.revenue > 0 ? Math.round((expense / s.revenue) * 1000) / 10 : 0;
  const profitRate = s && s.revenue > 0 ? Math.round((s.profit / s.revenue) * 1000) / 10 : 0;
  const dayCount = s?.days ?? 0;
  const avgProfit = dayCount > 0 ? Math.round((s?.profit ?? 0) / dayCount) : 0;

  const openPicker = () => {
    setDraftFrom(custom?.from ?? addDays(today, -6));
    setDraftTo(custom?.to ?? today);
    setEditing('from');
    setPickerOpen(true);
  };

  /**
   * 달력 탭은 **지금 고르고 있는 칸**에 들어간다.
   *
   * ⚠ 예전엔 "첫 탭은 시작, 두 번째 탭은 끝"이었다. 화면 어디에도 지금이 몇 번째
   *   탭인지 안 적혀 있어서, 끝을 고치려면 처음부터 다시 눌러야 했다.
   *   이제 시작일·종료일이 각각 칸으로 보이고, 고칠 칸을 눌러 그것만 바꾼다.
   */
  const pickDay = (day: string) => {
    if (editing === 'from') {
      setDraftFrom(day);
      // 시작이 끝을 넘어서면 끝을 끌고 간다 — 거꾸로인 구간을 만들지 않는다.
      if (draftTo !== null && day > draftTo) setDraftTo(day);
      setEditing('to');
      return;
    }
    if (draftFrom !== null && day < draftFrom) { setDraftFrom(day); return; }
    setDraftTo(day);
  };

  const applyCustom = () => {
    const from = draftFrom ?? today;
    const to = draftTo ?? draftFrom ?? today;
    setCustom({ from, to });
    setPeriodKey('custom');
    setPickerOpen(false);
  };

  const shiftMonth = (n: number) => {
    const d = parseDay(monthAnchor);
    setMonthAnchor(`${d.getUTCFullYear() + Math.floor((d.getUTCMonth() + n) / 12)}-${pad2(((d.getUTCMonth() + n) % 12 + 12) % 12 + 1)}-01`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="매출 분석" onBack={() => safeBack('/sales' as Href)} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24, gap: 11 }}>
        {/*
          프로토타입 `.condition-filter` — 기간은 **버튼 하나**로 고른다.
          예전엔 칩 6개 + 달력 + 직접설정 시트로 같은 일을 하는 길이 셋이었다.
        */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, marginTop: 4 }}>
          <FilterButton label={`${active.short}, ${active.label}`} onPress={() => setPeriodOpen(true)} />
          <View style={{ flex: 1 }} />
          {dayCount > 1 ? (
            <Text style={[{ fontSize: 13, fontWeight: '700', color: T.ter }, NUM]}>{dayCount}일</Text>
          ) : null}
        </View>

        <QueryState
          isLoading={range.isLoading}
          error={range.error}
          isEmpty={false}
          onRetry={() => void range.refetch()}
          emptyTitle=""
        >
          {s ? (
            <>
              <SecLabel title="매출 분석" />
              <Card pad={0} style={{ overflow: 'hidden' }}>
                <View style={{ paddingHorizontal: 14, paddingTop: 5, paddingBottom: 5 }}>
                  {/*
                    ⚠ 비율은 **항상 회색**이다(프로토타입 `.analysis-summary-value small`).
                      값만 칠하고, 순이익 줄만 라벨까지 초록으로 간다.
                  */}
                  {([
                    ['매출', won(s.revenue), '100%', undefined, false],
                    ['지출', won(expense), `${expenseRate}%`, T.amberText, false],
                    ['순이익', won(s.profit), `${profitRate}%`, T.green, true],
                  ] as const).map(([l, v, p, c, isProfit], i) => (
                    <SalesRow
                      key={l}
                      label={l}
                      amount={`${v}원`}
                      percent={p}
                      strong
                      tone={c}
                      labelTone={isProfit ? T.green : undefined}
                      percentTone={T.ter}
                      last={i === 2}
                    />
                  ))}
                </View>
                {dayCount > 1 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 12 }}>
                    <Icon name="info" size={14} color={T.ter} />
                    <Text style={[{ flex: 1, fontSize: 13, color: T.ter }, NUM]}>하루 평균 순이익 {won(avgProfit)}원 · {dayCount}일 기준</Text>
                  </View>
                ) : null}
              </Card>

              {/* '자세히 보기'는 카드 안 맨 아래다(프로토타입 `.channel-more`). */}
              <SecLabel title="채널별 매출" />
              <ChannelMixCard
                summary={s}
                channels={range.data?.channels ?? []}
                onMore={() => router.push(`/sales/channel?from=${active.from}&to=${active.to}` as Href)}
              />

              <SecLabel title="손익 계산" />
              <ProfitBreakdownCard
                summary={s}
                qtyLabel={dayCount > 1 ? `${dayCount}일 · ${s.qty}개` : `${s.qty}개`}
                from={active.from}
                to={active.to}
                profitFirst
                blackAmounts
              />

              <SecLabel title="메뉴별 판매량" right={`총 ${range.data?.menu.length ?? 0}개`} />
              <MenuSalesList menu={range.data?.menu ?? []} showAll={showAll} onShowAll={() => setShowAll(true)} onSelect={setSel} />
            </>
          ) : null}
        </QueryState>
      </ScrollView>

      {s ? (
        <MenuProfitSheet sel={sel} summary={s} periodLabel={active.label} from={active.from} to={active.to} onClose={() => setSel(null)} />
      ) : null}

      {/*
        기간 고르기 — 프로토타입 `.condition-filter` 가 여는 자리.
        ⚠ 여기가 **유일한 입구**다. 칩을 화면에 다시 뿌리면 같은 일을 하는 길이 둘이 된다.
      */}
      <Sheet visible={periodOpen} onClose={() => setPeriodOpen(false)} title="기간" sub="언제를 볼까요?" height={470}>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {PRESETS.map((pp, i) => {
            const on = periodKey === pp.key;
            return (
              <Pressable
                key={pp.key}
                onPress={() => { setPeriodKey(pp.key); setPeriodOpen(false); }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${pp.short} ${pp.label}`}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 55,
                  paddingHorizontal: 15,
                  borderBottomWidth: i === PRESETS.length - 1 ? 0 : 1, borderBottomColor: T.line2,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 15, fontWeight: on ? '800' : '700', color: on ? T.blue : T.ink }}>{pp.short}</Text>
                  <Text style={[{ fontSize: 12, fontWeight: '600', color: T.ter, marginTop: 3 }, NUM]}>{pp.label}</Text>
                </View>
                {on ? <Icon name="check" size={18} color={T.blue} /> : null}
              </Pressable>
            );
          })}
        </Card>

        <View style={{ marginTop: 12 }}>
          <Button kind="ghost" size="lg" full onPress={() => { setPeriodOpen(false); openPicker(); }}>
            직접 설정하기
          </Button>
        </View>
      </Sheet>

      {/* 직접설정 — 시작일·종료일을 눌러 구간 지정 */}
      <Sheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="기간 직접 설정"
        sub={draftFrom && draftTo ? `${rangeLabel(draftFrom, draftTo)} · ${dayGap(draftFrom, draftTo)}일` : '고칠 칸을 누르고 날짜를 골라 주세요'}
        height={600}
      >
        {/*
          시작일·종료일을 **각각 칸으로** 보여 준다.
          ⚠ 예전엔 달력을 두 번 눌러 구간을 정했는데, 지금이 몇 번째 탭인지 화면에
            안 적혀 있었다. 끝만 고치고 싶어도 처음부터 다시 눌러야 했다.
        */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          {([['시작일', 'from', draftFrom], ['종료일', 'to', draftTo]] as const).map(([label, key, value]) => {
            const on = editing === key;
            return (
              <View key={key} style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: T.sub2, marginBottom: 6 }}>{label}</Text>
                <Pressable
                  onPress={() => setEditing(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${label} ${value ?? '없음'} 고르기`}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50,
                    paddingHorizontal: 13, borderRadius: 12,
                    borderWidth: on ? 1.5 : 1, borderColor: on ? T.blue : T.line,
                    backgroundColor: on ? T.blueTint : T.surface,
                  }}
                >
                  <Text style={[{ flex: 1, fontSize: 16, fontWeight: '700', color: value ? T.ink : T.ter }, NUM]} numberOfLines={1}>
                    {value ?? '선택'}
                  </Text>
                  <Icon name="calendar" size={17} color={on ? T.blue : T.ter} />
                </Pressable>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="이전 달">
            <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="chevron" size={18} color={T.ter} /></View>
          </Pressable>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, minWidth: 110, textAlign: 'center' }}>{monthTitle(monthAnchor)}</Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="다음 달">
            <Icon name="chevron" size={18} color={T.ter} />
          </Pressable>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: T.blue, textAlign: 'center', marginBottom: 8 }}>
          {editing === 'from' ? '시작일' : '종료일'}을 고르는 중이에요
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          {DOWS.map((d, i) => (
            <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', color: i === 0 ? T.red : T.ter }}>{d}</Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }}>
          {cells.map((day, i) => {
            if (!day) return <View key={`pk-${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
            const on = draftFrom != null && day >= draftFrom && day <= (draftTo ?? draftFrom);
            const has = dailyBy.has(day);
            // 미래는 고를 수 없다 — 서버가 미래 날짜 저장을 거부하므로 화면에서도 막는다.
            const future = day > today;
            return (
              <View key={day} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                <Pressable
                  onPress={() => pickDay(day)}
                  disabled={future}
                  accessibilityRole="button"
                  accessibilityLabel={`${Number(day.slice(8))}일 선택`}
                  accessibilityState={{ selected: on, disabled: future }}
                  style={{ flex: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', opacity: future ? 0.35 : 1, backgroundColor: on ? T.blue : has ? T.surface2 : 'transparent' }}
                >
                  <Text style={{ fontSize: 14, fontWeight: on ? '800' : '600', color: on ? T.onColor : has ? T.ink2 : T.line3 }}>{Number(day.slice(8))}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={() => setPickerOpen(false)}>취소</Button></View>
          <View style={{ flex: 2 }}><Button kind="primary" size="lg" full disabled={draftFrom === null} onPress={applyCustom}>적용</Button></View>
        </View>
      </Sheet>
    </View>
  );
}
