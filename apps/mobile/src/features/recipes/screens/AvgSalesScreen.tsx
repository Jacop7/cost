/**
 * RCP-07 평균 판매량 입력 — 메뉴 평균 판매량으로 고정지출을 1개당 원가에 배분.
 * 집계 기간(일/주/월) 선택 → 수량 입력 → 하루 환산·배분 비율 안내.
 * ⚠ 디자인 프로토타입(정적·데모 환산). 실제 반영은 데이터 연결 단계에서.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Button, Icon } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };
const PERIODS = [
  { u: '일', ex: '하루 평균' },
  { u: '주', ex: '일주일 평균' },
  { u: '월', ex: '한 달 평균' },
];
const QUICK = ['100', '200', '300', '500'];

export default function AvgSalesScreen() {
  const [period, setPeriod] = useState(2); // 월
  const [value, setValue] = useState('300');

  const monthly = Number(value.replace(/,/g, '')) || 0;
  const perDay = Math.round(monthly / 30);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="평균 판매량" onBack={() => safeBack('/recipes')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24 }}>
        <Text style={{ fontSize: 14, color: T.sub2, fontWeight: '600', lineHeight: 21, marginBottom: 18 }}>
          이 메뉴가 평균적으로 얼마나 팔리는지 입력하면, 고정 지출을 메뉴별로 나눠 1개 원가에 반영해요.
        </Text>

        {/* 집계 기간 */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginBottom: 8 }}>집계 기간</Text>
        <View style={{ flexDirection: 'row', gap: 4, padding: 4, backgroundColor: T.line, borderRadius: 12, marginBottom: 20 }}>
          {PERIODS.map((p, i) => {
            const on = i === period;
            return (
              <Pressable
                key={p.u}
                onPress={() => setPeriod(i)}
                style={[{ flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 9, backgroundColor: on ? T.surface : 'transparent' }, on ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 } : null]}
              >
                <Text style={{ fontSize: 16, fontWeight: on ? '700' : '600', color: on ? T.ink : T.ter }}>{p.u}</Text>
                <Text style={{ fontSize: 14, color: on ? T.sub2 : T.ter, marginTop: 2 }}>{p.ex}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 입력 */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginBottom: 8 }}>{PERIODS[period]?.ex} 판매량</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.blue, borderRadius: 14, paddingVertical: 18, paddingHorizontal: 18 }}>
          <Text style={[{ flex: 1, fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }, NUM]}>{value || '0'}</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: T.sub2 }}>개/{PERIODS[period]?.u}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 11 }}>
          {QUICK.map((v) => {
            const on = v === value;
            return (
              <Pressable
                key={v}
                onPress={() => setValue(v)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}
              >
                <Text style={[{ fontSize: 14, fontWeight: '700', color: on ? T.blue : T.sub }, NUM]}>{v}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 환산 안내 */}
        <View style={{ marginTop: 20, backgroundColor: T.surface2, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{ flex: 1, fontSize: 14, color: T.sub2, fontWeight: '600' }}>하루 환산</Text>
            <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>약 {perDay}개/일</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: T.line2 }}>
            <Text style={{ flex: 1, fontSize: 14, color: T.sub2, fontWeight: '600' }}>메뉴별 고정지출 배분 비율</Text>
            <Text style={[{ fontSize: 16, fontWeight: '700', color: T.blue }, NUM]}>전체 판매의 12%</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12 }}>
          <Icon name="info" size={15} color={T.ter} />
          <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>판매량이 높을수록 메뉴 1개가 떠안는 고정지출이 줄어들어 순이익률이 올라가요.</Text>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 11, paddingBottom: 28, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full onPress={() => safeBack('/recipes')}>적용</Button>
      </View>
    </View>
  );
}
