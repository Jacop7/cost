/**
 * SALES-02 매출 분석 — 기간 선택(오늘·어제·이번주·이번달·지난달·직접설정) 기준의 손익 한 장.
 *
 * 구성: 기간 칩 → 월 캘린더(선택 기간 하이라이트) → 매출 분석(매출·지출·순이익)
 *       → 채널 구성 → 손익 계산 → 메뉴별 판매량.
 * 아래 세 블록은 일 손익 상세(SALES-03)와 같은 구성이고, 넣는 수치만 기간 집계로 바뀐다.
 *
 * ⚠ 디자인 프로토타입(데모 근사). 실데이터는 Supabase 손익 스냅샷의 기간 합산으로 교체.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href } from 'expo-router';
import { AppHeader, Button, Card, Chip, Icon, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import {
  CUSTOM_DEFAULT,
  PERIODS,
  SALES_CALENDAR,
  customLabel,
  salesForPeriod,
  type PeriodKey,
  type SaleMenu,
} from '../demoData';
import { ChannelMixCard, MenuSalesList, ProfitBreakdownCard, SecLabel } from '../components/ProfitBlocks';
import { MenuProfitSheet } from '../components/MenuProfitSheet';

const NUM = { fontVariant: ['tabular-nums' as const] };
const DOWS = ['일', '월', '화', '수', '목', '금', '토'];
const LEAD = 1; // 6월 1일 = 월요일 → 앞 공백 1칸
const DAYS = 30;
const CELLS: (number | null)[] = [...Array(LEAD).fill(null), ...Array.from({ length: DAYS }, (_, i) => i + 1)];

export default function SalesAnalyticsScreen() {
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [customDays, setCustomDays] = useState<number[]>(CUSTOM_DEFAULT);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftDays, setDraftDays] = useState<number[]>(CUSTOM_DEFAULT);
  const [showAll, setShowAll] = useState(false);
  const [sel, setSel] = useState<SaleMenu | null>(null);

  const s = salesForPeriod(period, customDays);
  // 캘린더 하이라이트 대상 — 지난달은 6월에 표시할 날이 없다.
  const active = new Set(period === 'custom' ? customDays : (PERIODS.find((p) => p.key === period)?.days ?? []));
  const expenseRate = s.revenue > 0 ? Math.round((s.expense / s.revenue) * 1000) / 10 : 0;
  const profitRate = s.revenue > 0 ? Math.round((s.profit / s.revenue) * 1000) / 10 : 0;
  const avgProfit = s.dayCount > 0 ? Math.round(s.profit / s.dayCount) : 0;

  const openPicker = () => { setDraftDays(period === 'custom' ? customDays : CUSTOM_DEFAULT); setPickerOpen(true); };
  const pickDay = (d: number) => setDraftDays((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d].sort((a, b) => a - b)));
  const applyCustom = () => { setCustomDays(draftDays); setPeriod('custom'); setPickerOpen(false); };

  const onChip = (key: PeriodKey) => (key === 'custom' ? openPicker() : setPeriod(key));

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title="매출 분석"
        onBack={() => safeBack('/sales' as Href)}
        right={
          <Pressable hitSlop={6} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="내보내기">
            <Icon name="download" size={22} color={T.ink2} />
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24, gap: 11 }}>
        {/* 기간 선택 — 프리셋 5개 + 직접설정 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 8, paddingRight: 4 }}>
          {PERIODS.map((p) => (
            <Chip key={p.key} active={p.key === period} onPress={() => onChip(p.key)}>{p.short}</Chip>
          ))}
        </ScrollView>

        {/* 선택 기간 */}
        <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, marginHorizontal: 2, marginTop: -2 }}>
          {s.label}
          {s.dayCount > 1 ? <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter }}>  {s.dayCount}일</Text> : null}
        </Text>

        {/* 캘린더 — 선택 기간을 파랑으로 표시 */}
        <Card pad={14}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
            <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="chevron" size={18} color={T.ter} /></View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>2026년 6월</Text>
            <Icon name="chevron" size={18} color={T.ter} />
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {DOWS.map((d, i) => (
              <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', color: i === 0 ? T.red : T.ter }}>{d}</Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {CELLS.map((d, i) => {
              if (!d) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
              const rec = SALES_CALENDAR[d];
              const on = active.has(d);
              const sun = i % 7 === 0;
              return (
                <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                  <View style={{ flex: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', gap: 1, backgroundColor: on ? T.blue : rec ? T.surface2 : 'transparent' }}>
                    <Text style={{ fontSize: 13, fontWeight: on ? '800' : '600', color: on ? T.onColor : sun ? T.red : T.ink2 }}>{d}</Text>
                    {rec ? <Text style={[{ fontSize: 13, fontWeight: '800', color: on ? 'rgba(255,255,255,0.9)' : T.green, lineHeight: 15 }, NUM]}>{rec.profit}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line2 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.green }} />
            <Text style={{ fontSize: 13, color: T.ter }}>숫자 = 그날 순이익(천원) · 파랑 = 선택 기간</Text>
          </View>
        </Card>

        {/* 매출 분석 — 선택 기간 합계 */}
        <SecLabel title="매출 분석" />
        <Card pad={16}>
          {([['매출', won(s.revenue), '100%', T.ink, false], ['지출', won(s.expense), `${expenseRate}%`, T.amberText, false], ['순이익', won(s.profit), `${profitRate}%`, T.green, true]] as const).map(([l, v, p, c, bold], i) => (
            <View key={l} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: bold ? '800' : '600', color: bold ? T.green : T.ink2 }}>{l}</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: c, marginRight: 10 }, NUM]}>{v}원</Text>
              <Text style={[{ width: 48, textAlign: 'right', fontSize: 14, fontWeight: '700', color: T.ter }, NUM]}>{p}</Text>
            </View>
          ))}
          {s.dayCount > 1 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <Icon name="info" size={14} color={T.ter} />
              <Text style={[{ flex: 1, fontSize: 13, color: T.ter }, NUM]}>하루 평균 순이익 {won(avgProfit)}원 · {s.dayCount}일 기준</Text>
            </View>
          ) : null}
        </Card>

        {/* 아래 세 블록은 일 손익 상세와 같은 구성 — 기간 집계 수치만 다르다 */}
        <SecLabel title="채널 구성" />
        <ChannelMixCard revenue={s.revenue} profit={s.profit} mix={s.channelMix} />

        <SecLabel title="손익 계산" />
        <ProfitBreakdownCard b={s} qtyLabel={s.dayCount > 1 ? `${s.dayCount}일 · ${s.qty}개` : `${s.qty}개`} />

        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2, marginTop: 4 }}>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.sub }}>메뉴별 판매량</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter }}>총 {s.menu.length}개 · 판매량순</Text>
        </View>
        <MenuSalesList menu={s.menu} showAll={showAll} onShowAll={() => setShowAll(true)} onSelect={setSel} />
      </ScrollView>

      <MenuProfitSheet sel={sel} totals={s} periodLabel={s.label} onClose={() => setSel(null)} />

      {/* 직접설정 — 캘린더에서 날짜를 눌러 구간 지정 */}
      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="기간 직접 설정" sub={customLabel(draftDays)} height={480}>
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          {DOWS.map((d, i) => (
            <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', color: i === 0 ? T.red : T.ter }}>{d}</Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }}>
          {CELLS.map((d, i) => {
            if (!d) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
            const on = draftDays.includes(d);
            const has = SALES_CALENDAR[d] != null;
            return (
              <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                <Pressable onPress={() => pickDay(d)} style={{ flex: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? T.blue : has ? T.surface2 : 'transparent' }}>
                  <Text style={{ fontSize: 14, fontWeight: on ? '800' : '600', color: on ? T.onColor : has ? T.ink2 : T.line3 }}>{d}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={() => setPickerOpen(false)}>취소</Button></View>
          <View style={{ flex: 2 }}><Button kind="primary" size="lg" full onPress={applyCustom}>적용</Button></View>
        </View>
      </Sheet>
    </View>
  );
}
