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
import { type Href } from 'expo-router';
import { AppHeader, Button, Card, Chip, Icon, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { useSalesRange, type RangeMenu } from '../hooks';
import { ChannelMixCard, MenuSalesList, ProfitBreakdownCard, SecLabel } from '../components/ProfitBlocks';
import { MenuProfitSheet } from '../components/MenuProfitSheet';
import { addDays, parseDay, periods, rangeLabel, todayBusiness, type PeriodKey } from '../period';

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

export default function SalesAnalyticsScreen() {
  const today = todayBusiness();
  const PRESETS = useMemo(() => periods(today), [today]);

  const [periodKey, setPeriodKey] = useState<PeriodKey>('today');
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [monthAnchor, setMonthAnchor] = useState(today);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState<string | null>(null);

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
    setPickerOpen(true);
  };

  /** 두 번 눌러 구간을 정한다. 첫 탭은 시작, 두 번째 탭은 끝(거꾸로 누르면 뒤집는다). */
  const pickDay = (day: string) => {
    if (draftFrom === null || draftTo !== null) { setDraftFrom(day); setDraftTo(null); return; }
    if (day < draftFrom) { setDraftTo(draftFrom); setDraftFrom(day); return; }
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 8, paddingRight: 4 }}>
          {PRESETS.map((p) => (
            <Chip key={p.key} active={p.key === periodKey} onPress={() => setPeriodKey(p.key)}>{p.short}</Chip>
          ))}
          <Chip active={periodKey === 'custom'} onPress={openPicker}>직접설정</Chip>
        </ScrollView>

        <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, marginHorizontal: 2, marginTop: -2 }}>
          {active.label}
          {dayCount > 1 ? <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter }}>  {dayCount}일</Text> : null}
        </Text>

        {/* 캘린더 — 선택 기간을 파랑으로 */}
        <Card pad={14}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="이전 달">
              <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="chevron" size={18} color={T.ter} /></View>
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, minWidth: 110, textAlign: 'center' }}>{monthTitle(monthAnchor)}</Text>
            <Pressable onPress={() => shiftMonth(1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="다음 달">
              <Icon name="chevron" size={18} color={T.ter} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {DOWS.map((d, i) => (
              <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', color: i === 0 ? T.red : T.ter }}>{d}</Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((day, i) => {
              if (!day) return <View key={`pad-${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
              const profit = dailyBy.get(day);
              const on = inRange(day);
              const sun = i % 7 === 0;
              const dnum = Number(day.slice(8));
              return (
                <View key={day} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                  <Pressable
                    onPress={() => { setCustom({ from: day, to: day }); setPeriodKey('custom'); }}
                    accessibilityRole="button"
                    accessibilityLabel={`${dnum}일${profit != null ? ` 순이익 ${Math.round(profit / 1000)}천원` : ''}`}
                    style={{ flex: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', gap: 1, backgroundColor: on ? T.blue : profit != null ? T.surface2 : 'transparent' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: on ? '800' : '600', color: on ? T.onColor : sun ? T.red : T.ink2 }}>{dnum}</Text>
                    {profit != null ? (
                      <Text style={[{ fontSize: 13, fontWeight: '800', color: on ? 'rgba(255,255,255,0.9)' : profit >= 0 ? T.green : T.red, lineHeight: 15 }, NUM]}>
                        {Math.round(profit / 1000)}
                      </Text>
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line2 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.green }} />
            <Text style={{ fontSize: 13, color: T.ter }}>숫자 = 그날 순이익(천원) · 파랑 = 선택 기간</Text>
          </View>
        </Card>

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
              <Card pad={16}>
                {([
                  ['매출', won(s.revenue), '100%', T.ink, false],
                  ['지출', won(expense), `${expenseRate}%`, T.amberText, false],
                  ['순이익', won(s.profit), `${profitRate}%`, T.green, true],
                ] as const).map(([l, v, p, c, bold], i) => (
                  <View key={l} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: T.line2 }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: bold ? '800' : '600', color: bold ? T.green : T.ink2 }}>{l}</Text>
                    <Text style={[{ fontSize: 16, fontWeight: '800', color: c, marginRight: 10 }, NUM]}>{v}원</Text>
                    <Text style={[{ width: 48, textAlign: 'right', fontSize: 14, fontWeight: '700', color: T.ter }, NUM]}>{p}</Text>
                  </View>
                ))}
                {dayCount > 1 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                    <Icon name="info" size={14} color={T.ter} />
                    <Text style={[{ flex: 1, fontSize: 13, color: T.ter }, NUM]}>하루 평균 순이익 {won(avgProfit)}원 · {dayCount}일 기준</Text>
                  </View>
                ) : null}
              </Card>

              <SecLabel title="채널 구성" />
              <ChannelMixCard summary={s} channels={range.data?.channels ?? []} />

              <SecLabel title="손익 계산" />
              <ProfitBreakdownCard
                summary={s}
                qtyLabel={dayCount > 1 ? `${dayCount}일 · ${s.qty}개` : `${s.qty}개`}
                from={active.from}
                to={active.to}
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2, marginTop: 4 }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.sub }}>메뉴별 판매량</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter }}>총 {range.data?.menu.length ?? 0}개 · 판매량순</Text>
              </View>
              <MenuSalesList menu={range.data?.menu ?? []} showAll={showAll} onShowAll={() => setShowAll(true)} onSelect={setSel} />
            </>
          ) : null}
        </QueryState>
      </ScrollView>

      {s ? (
        <MenuProfitSheet sel={sel} summary={s} periodLabel={active.label} from={active.from} to={active.to} onClose={() => setSel(null)} />
      ) : null}

      {/* 직접설정 — 시작일·종료일을 눌러 구간 지정 */}
      <Sheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="기간 직접 설정"
        sub={draftFrom ? (draftTo ? rangeLabel(draftFrom, draftTo) : '종료일을 눌러 주세요') : '시작일을 눌러 주세요'}
        height={520}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="이전 달">
            <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="chevron" size={18} color={T.ter} /></View>
          </Pressable>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, minWidth: 110, textAlign: 'center' }}>{monthTitle(monthAnchor)}</Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="다음 달">
            <Icon name="chevron" size={18} color={T.ter} />
          </Pressable>
        </View>
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
