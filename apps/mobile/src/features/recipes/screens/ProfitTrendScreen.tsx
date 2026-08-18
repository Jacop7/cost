/**
 * RCP-10 순이익률 변동 추이 — profit_trends 스냅샷을 기간별로 그린다.
 *
 * 스냅샷은 사건이 있을 때만 쌓인다(입고·레시피 저장·고정지출 변경). 그래서 점 간격이
 * 일정하지 않다 — 균등한 x축인 척하지 않고 실제 날짜를 라벨로 쓴다.
 */
import { useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Chip, QueryState, TrendChart } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { addDays, todayBusiness } from '@/features/sales/period';
import { useRecipeDetail } from '../hooks';

const MAT = '#97A0AB';
const CW = Dimensions.get('window').width - 60;

const PERIODS = [
  { key: '1개월', days: 30 },
  { key: '3개월', days: 90 },
  { key: '6개월', days: 180 },
  { key: '12개월', days: 365 },
] as const;

export default function ProfitTrendScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const detail = useRecipeDetail(id);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('3개월');

  const r = detail.data;
  const days = PERIODS.find((p) => p.key === period)?.days ?? 90;
  const from = addDays(todayBusiness(), -days);

  const series = useMemo(() => {
    const all = (r?.profitTrends ?? []).filter((t) => t.date >= from);
    return {
      rate: all.map((t) => t.profitRate),
      mat: all.map((t) => t.materialRate),
      labels: all.map((t) => `${Number(t.date.slice(5, 7))}/${Number(t.date.slice(8, 10))}`),
    };
  }, [r, from]);

  const has = series.rate.length >= 2;
  const minOf = (a: number[]) => (a.length ? Math.min(...a) : 0);
  const maxOf = (a: number[]) => (a.length ? Math.max(...a) : 0);

  // 라벨이 빽빽하면 읽히지 않는다. 최대 6개만 고르게 남긴다.
  const labelStep = Math.max(1, Math.ceil(series.labels.length / 6));

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="순이익률 변동 추이" onBack={() => safeBack(id ? `/recipes/${id}` : '/recipes')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24, gap: 11 }}>
        <Text style={{ fontSize: 14, color: T.sub2, fontWeight: '600', lineHeight: 21, paddingHorizontal: 2 }}>
          {r?.name ?? '이 메뉴'}의 순이익률과 재료 원가율 변화예요. 재료 단가가 오르면 원가율이 올라가고 순이익률이 내려가요.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 4 }}>
          {PERIODS.map((p) => (
            <Chip key={p.key} active={p.key === period} onPress={() => setPeriod(p.key)}>최근 {p.key}</Chip>
          ))}
        </ScrollView>

        <QueryState
          isLoading={detail.isLoading}
          error={detail.error}
          isEmpty={!has}
          onRetry={() => void detail.refetch()}
          emptyTitle="그릴 만한 기록이 아직 없어요"
          emptyHint="입고하거나 레시피를 고치면 그 시점 손익이 쌓여요"
        >
          <Card pad={14}>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: T.blue }}>● 순이익률</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: MAT }}>● 재료 원가</Text>
            </View>

            <View style={{ height: 84 }}>
              <View style={{ position: 'absolute', top: 0, left: 0 }}>
                <TrendChart points={series.mat.map((v) => ({ v }))} w={CW} h={84} color={MAT} solidDots markMinMax fmt={(v) => `${v}%`} />
              </View>
              <TrendChart points={series.rate.map((v) => ({ v }))} w={CW} h={84} color={T.blue} solidDots markMinMax fmt={(v) => `${v}%`} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              {series.labels.filter((_, i) => i % labelStep === 0).map((l, i) => (
                <Text key={`${l}-${i}`} style={{ fontSize: 13, color: T.ter }}>{l}</Text>
              ))}
            </View>

            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line2, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, fontSize: 14, color: T.blue, fontWeight: '700' }}>순이익률</Text>
                <Text style={{ fontSize: 14, color: T.sub2, fontWeight: '600' }}>
                  최저 {minOf(series.rate)}% · 최고 {maxOf(series.rate)}%
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, fontSize: 14, color: MAT, fontWeight: '700' }}>재료 원가</Text>
                <Text style={{ fontSize: 14, color: T.sub2, fontWeight: '600' }}>
                  최저 {minOf(series.mat)}% · 최고 {maxOf(series.mat)}%
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: T.ter, marginTop: 4 }}>기록 {series.rate.length}건</Text>
            </View>
          </Card>
        </QueryState>
      </ScrollView>
    </View>
  );
}
