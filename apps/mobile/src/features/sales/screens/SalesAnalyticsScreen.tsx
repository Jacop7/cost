/**
 * SALES-02 매출 분석 — 월 캘린더(일별 순이익) + 선택일 요약 + 이번 달 누적.
 * ⚠ 디자인 프로토타입(정적·데모). 실데이터는 Supabase 손익 스냅샷으로 교체.
 */
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Badge, Card, Icon, SegTabs } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { SALES_CALENDAR, SALES_MONTH } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };
const DOWS = ['일', '월', '화', '수', '목', '금', '토'];
const LEAD = 1; // 6월 1일 = 월요일 → 앞 공백 1칸
const DAYS = 30;
const CELLS: (number | null)[] = [...Array(LEAD).fill(null), ...Array.from({ length: DAYS }, (_, i) => i + 1)];

export default function SalesAnalyticsScreen() {
  const router = useRouter();
  const m = SALES_MONTH;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title="매출 분석"
        onBack={() => safeBack('/sales' as Href)}
        right={
          <Pressable hitSlop={6} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="download" size={22} color={T.ink2} />
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24 }}>
        <View style={{ marginBottom: 14 }}>
          <SegTabs tabs={[{ label: '일별' }, { label: '월별' }]} active={0} />
        </View>

        {/* 월 네비 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
          <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="chevron" size={18} color={T.ter} /></View>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>2026년 6월</Text>
          <Icon name="chevron" size={18} color={T.ter} />
        </View>

        {/* 캘린더 */}
        <Card pad={14} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {DOWS.map((d, i) => (
              <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', color: i === 0 ? T.red : T.ter }}>{d}</Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {CELLS.map((d, i) => {
              if (!d) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
              const rec = SALES_CALENDAR[d];
              const today = rec?.today;
              const sun = i % 7 === 0;
              return (
                <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                  <View style={{ flex: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', gap: 1, backgroundColor: today ? T.blue : rec ? T.surface2 : 'transparent' }}>
                    <Text style={{ fontSize: 13, fontWeight: today ? '800' : '600', color: today ? T.onColor : sun ? T.red : T.ink2 }}>{d}</Text>
                    {rec ? <Text style={[{ fontSize: 13, fontWeight: '800', color: today ? 'rgba(255,255,255,0.9)' : T.green, lineHeight: 15 }, NUM]}>{rec.profit}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line2 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.green }} />
            <Text style={{ fontSize: 13, color: T.ter }}>숫자 = 그날 순이익(천원)</Text>
          </View>
        </Card>

        {/* 선택일 요약 */}
        <Card pad={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>6월 18일 (목)</Text>
            <Badge tone="blue" sm>오늘</Badge>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => router.push('/sales/day' as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>상세</Text>
              <Icon name="chevron" size={14} color={T.blue} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {([['매출', won(950000), T.ink], ['지출', won(642000), T.amberText], ['순이익', won(308000), T.green]] as const).map(([l, v, c], i) => (
              <View key={l} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: T.line2 }}>
                <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}>{l}</Text>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: c, marginTop: 4 }, NUM]}>{v}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* 이번 달 누적 */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: T.sub, marginHorizontal: 2, marginTop: 16, marginBottom: 9 }}>이번 달 누적 (1~18일)</Text>
        <Card pad={16}>
          {([['매출', won(m.rev), '100%', T.ink, false], ['지출', won(m.expense), '60.1%', T.amberText, false], ['순이익', won(m.profit), `${m.rate}%`, T.green, true]] as const).map(([l, v, p, c, bold], i) => (
            <View key={l} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: bold ? '800' : '600', color: bold ? T.green : T.ink2 }}>{l}</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: c, marginRight: 10 }, NUM]}>{v}원</Text>
              <Text style={[{ width: 48, textAlign: 'right', fontSize: 14, fontWeight: '700', color: T.ter }, NUM]}>{p}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <Icon name="info" size={14} color={T.ter} />
            <Text style={{ flex: 1, fontSize: 13, color: T.ter }}>하루 평균 순이익 {won(m.avgProfit)}원 · 마이페이지 월 리포트와 연동</Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
