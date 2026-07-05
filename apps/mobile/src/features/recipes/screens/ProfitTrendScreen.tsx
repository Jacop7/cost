/**
 * RCP-10 순이익률 변동 추이 — 기간별(1·3·6·12개월) 순이익률·재료 원가율 라인.
 * 재료 단가가 오르면 원가율↑·순이익률↓. 추이 스냅샷은 profit_trends(E1~E4)에서 적재.
 * ⚠ 디자인 프로토타입(데모 데이터). 실데이터는 Supabase 손익 스냅샷으로 교체.
 */
import { Dimensions, ScrollView, Text, View } from 'react-native';
import { AppHeader, Card, PeriodChip, TrendChart } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';

const MAT = '#97A0AB'; // 재료 원가율 라인색(그레이)
const CW = Dimensions.get('window').width - 60; // 카드 내부 차트 폭(스크롤 16*2 + 카드 pad 14*2)

interface Period {
  key: string;
  labels: string[];
  rate: number[]; // 순이익률(%)
  mat: number[]; // 재료 원가율(%)
}
const PERIODS: Period[] = [
  { key: '1개월', labels: ['4주 전', '3주 전', '2주 전', '지난주', '이번주'], rate: [34.0, 33.6, 33.2, 33.5, 33.4], mat: [28.2, 28.6, 29.0, 28.7, 28.8] },
  { key: '3개월', labels: ['4월', '4월 말', '5월', '5월 말', '6월', '현재'], rate: [36.0, 35.1, 34.0, 33.6, 33.5, 33.4], mat: [26.5, 27.2, 28.0, 28.4, 28.6, 28.8] },
  { key: '6개월', labels: ['1월', '2월', '3월', '4월', '5월', '6월'], rate: [38.1, 37.0, 36.0, 35.0, 34.0, 33.4], mat: [24.8, 25.6, 26.5, 27.4, 28.2, 28.8] },
  { key: '12개월', labels: ['작년 7월', '9월', '11월', '1월', '3월', '5월', '현재'], rate: [40.2, 39.0, 38.1, 36.5, 35.0, 34.0, 33.4], mat: [22.5, 23.8, 24.8, 26.2, 27.4, 28.2, 28.8] },
];

const pts = (arr: number[]) => arr.map((v) => ({ v }));
const min = (arr: number[]) => Math.min(...arr);
const max = (arr: number[]) => Math.max(...arr);

export default function ProfitTrendScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="순이익률 변동 추이" onBack={() => safeBack('/recipes')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24, gap: 11 }}>
        <Text style={{ fontSize: 14, color: T.sub2, fontWeight: '600', lineHeight: 21, paddingHorizontal: 2 }}>
          제육볶음의 순이익률과 재료 원가율 변화를 기간별로 보여줘요. 재료 단가가 오르면 재료 원가율이 올라가고 순이익률이 내려가요.
        </Text>

        {PERIODS.map((p) => (
          <Card key={p.key} pad={14}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>최근 {p.key}</Text>
              <PeriodChip value={`최근 ${p.key}`} />
            </View>

            {/* 범례 */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: T.blue }}>● 순이익률</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: MAT }}>● 재료 원가</Text>
            </View>

            {/* 겹쳐 그린 두 라인(재료 원가=아래, 순이익률=위) */}
            <View style={{ height: 84 }}>
              <View style={{ position: 'absolute', top: 0, left: 0 }}>
                <TrendChart points={pts(p.mat)} w={CW} h={84} color={MAT} solidDots markMinMax fmt={(v) => `${v}%`} />
              </View>
              <TrendChart points={pts(p.rate)} w={CW} h={84} color={T.blue} solidDots markMinMax fmt={(v) => `${v}%`} />
            </View>

            {/* x축 라벨 */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              {p.labels.map((l, i) => (
                <Text key={i} style={{ fontSize: 13, color: T.ter }}>{l}</Text>
              ))}
            </View>

            {/* 최저·최고 요약 */}
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line2, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, fontSize: 14, color: T.blue, fontWeight: '700' }}>순이익률</Text>
                <Text style={{ fontSize: 14, color: T.sub2, fontWeight: '600' }}>최저 {min(p.rate)}% · 최고 {max(p.rate)}%</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, fontSize: 14, color: MAT, fontWeight: '700' }}>재료 원가</Text>
                <Text style={{ fontSize: 14, color: T.sub2, fontWeight: '600' }}>최저 {min(p.mat)}% · 최고 {max(p.mat)}%</Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
