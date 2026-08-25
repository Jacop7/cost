/**
 * RCP-07 평균 판매량 — 레시피 폼의 '월 평균 판매량'을 실제 판매 실적으로 채워준다.
 *
 * 사장님이 감으로 적는 대신 **최근 30일 실제 판매량**을 보여주고, 원하면 그대로 넣는다.
 * (이전 구현은 고정 숫자와 "전체 판매의 12%" 같은 근거 없는 문구를 보여줬다.)
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Button, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';
import { useSalesRange } from '@/features/sales/hooks';
import { addDays } from '@/features/sales/period';
import { useStoreLocalDate } from '@/features/sales/businessDay';
import { BusinessDateGate } from '@/features/sales/components/BusinessDateGate';
import { useRecipeDraft } from '../draftStore';

const NUM = { fontVariant: ['tabular-nums' as const] };

/**
 * ⚠ 여기 날짜는 **매장 현지 날짜**다(0125). 판매 영업일이 아니다 —
 *   발주·입고는 달력 날짜로 센다. 앱이 직접 계산하지 않고 서버에서 받는다.
 */
export default function AvgSalesScreen() {
  return (
    <BusinessDateGate source={useStoreLocalDate()} title="평균 판매량" onBack={() => safeBack('/recipes/add')}>
      {(localDate) => <AvgSalesScreenBody localDate={localDate} />}
    </BusinessDateGate>
  );
}

function AvgSalesScreenBody({ localDate }: { localDate: string }) {
  const { recipe } = useLocalSearchParams<{ recipe?: string }>();
  const today = localDate;
  const range = useSalesRange(addDays(today, -29), today);

  const draft = useRecipeDraft((s) => s.draft);
  const patch = useRecipeDraft((s) => s.patch);
  const [value, setValue] = useState(draft.avgMonthlySales);

  const recipeId = recipe ?? draft.id;
  const sold = range.data?.menu.find((m) => m.recipeId === recipeId);
  const monthly = Number(value.replace(/,/g, '')) || 0;
  const perDay = Math.round((monthly / 30) * 10) / 10;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="평균 판매량" onBack={() => safeBack('/recipes/add')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24 }}>
        <Text style={{ fontSize: 14, color: T.sub2, fontWeight: '600', lineHeight: 21, marginBottom: 18 }}>
          한 달에 평균 몇 개나 팔리는지 적어 주세요. 손익 미리보기의 ‘월평균 기준’ 계산에 쓰여요.
        </Text>

        {/* 실제 판매 실적 */}
        <QueryState
          isLoading={range.isLoading}
          error={range.error}
          isEmpty={false}
          onRetry={() => void range.refetch()}
          emptyTitle=""
        >
          <Card pad={16} style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginBottom: 8 }}>최근 30일 실제 판매</Text>
            {sold ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={[{ fontSize: 22, fontWeight: '800', color: T.ink }, NUM]}>{sold.qty}<Text style={{ fontSize: 16 }}>개</Text></Text>
                  <Text style={[{ fontSize: 14, color: T.sub2, fontWeight: '600' }, NUM]}>매출 {won(sold.revenue)}원</Text>
                </View>
                <Pressable
                  onPress={() => setValue(String(sold.qty))}
                  accessibilityRole="button" accessibilityLabel="실제 판매량으로 채우기"
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 12, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: T.blue, backgroundColor: T.blueTint }}
                >
                  <Icon name="check" size={16} color={T.blue} sw={2.2} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>이 값으로 채우기</Text>
                </Pressable>
              </>
            ) : (
              <Text style={{ fontSize: 16, color: T.ter }}>
                {recipeId ? '최근 30일 판매 기록이 없어요' : '메뉴를 저장한 뒤에 실제 판매량을 볼 수 있어요'}
              </Text>
            )}
          </Card>
        </QueryState>

        {/* 입력 */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginBottom: 8 }}>월 평균 판매량</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.blue, borderRadius: 14, paddingVertical: 18, paddingHorizontal: 18 }}>
          <Text style={[{ flex: 1, fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }, NUM]}>{value || '0'}</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: T.sub2 }}>개/월</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 11 }}>
          {['100', '200', '300', '500'].map((v) => {
            const on = v === value;
            return (
              <Pressable
                key={v}
                onPress={() => setValue(v)}
                accessibilityRole="button" accessibilityLabel={`${v}개`}
                accessibilityState={{ selected: on }}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}
              >
                <Text style={[{ fontSize: 14, fontWeight: '700', color: on ? T.blue : T.sub }, NUM]}>{v}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 7 }}>
          {['-50', '-10', '+10', '+50'].map((d) => (
            <Pressable
              key={d}
              onPress={() => setValue(String(Math.max(0, monthly + Number(d))))}
              accessibilityRole="button" accessibilityLabel={`${d}개`}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface }}
            >
              <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub }, NUM]}>{d}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: 20, backgroundColor: T.surface2, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{ flex: 1, fontSize: 14, color: T.sub2, fontWeight: '600' }}>하루 환산</Text>
            <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>약 {perDay}개/일</Text>
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 11, paddingBottom: 28, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button
          kind="primary" size="lg" full
          onPress={() => { patch({ avgMonthlySales: clampDecimals(value, 0) }); safeBack('/recipes/add'); }}
        >
          적용
        </Button>
      </View>
    </View>
  );
}
