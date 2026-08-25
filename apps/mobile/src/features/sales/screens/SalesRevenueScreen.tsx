/**
 * SALES-12 매출 자세히 — 메뉴 매출(TOP + 더보기) + 기타 매출 + 매출 합계.
 * 손익 상세의 '매출' 행에서 진입.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { useSalesDay, useSalesRange } from '../hooks';
import { channelName } from '../channels';
import { rangeLabel } from '../period';
import { useSalesBusinessDate } from '../businessDay';

const NUM = { fontVariant: ['tabular-nums' as const] };

export default function SalesRevenueScreen() {
  const params = useLocalSearchParams<{ from?: string; to?: string; date?: string }>();
    /*
   * ⚠ **서버가 정한 장부 날짜**를 쓴다(0125). 앱이 `+09:00` 고정 오프셋으로 직접
   *   계산하면 앱과 DB 가 각자 오늘을 갖게 된다(기획서 §2.1).
   *   못 받았으면 빈 문자열이고, 그동안 조회가 꺼진다 — 잘못된 날의 숫자보다 낫다.
   */
  const serverToday = useSalesBusinessDate() ?? '';
  const today = serverToday;
  const from = params.from ?? params.date ?? today;
  const to = params.to ?? params.date ?? today;
  const isOneDay = from === to;

  const range = useSalesRange(from, to);
  // 기타 매출 내역(항목별)은 하루 장부에만 있다. 기간 조회에서는 합계만 보여준다.
  const day = useSalesDay(isOneDay ? from : '');

  const [showAll, setShowAll] = useState(false);

  const s = range.data?.summary;
  const sorted = [...(range.data?.menu ?? [])].sort((a, b) => b.revenue - a.revenue);
  const menuSum = sorted.reduce((a, m) => a + m.revenue, 0);
  const list = showAll ? sorted : sorted.slice(0, 5);
  const etcItems = isOneDay ? (day.data?.etcItems ?? []) : [];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="매출 자세히" onBack={() => safeBack(`/sales/day?date=${to}`)} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28 }}>
        <QueryState
          isLoading={range.isLoading}
          error={range.error}
          isEmpty={false}
          onRetry={() => void range.refetch()}
          emptyTitle=""
        >
          <Card onLine pad={0} style={{ overflow: 'hidden' }}>
            {/*
              프로토타입 `.revenue-summary` — 영업일·판매 수량·매출 합계가 **머리에** 온다.
              합계를 맨 아래 두면 메뉴가 길어질수록 "그래서 얼마?"를 스크롤해야 찾는다.
            */}
            <View style={{ backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line }}>
              {([
                ['영업일', rangeLabel(from, to)],
                ['판매 수량', `${s?.qty ?? 0}개`],
                ['매출 합계', `${won(s?.revenue ?? 0)}원`],
              ] as const).map(([k, v], i) => (
                <View
                  key={k}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 47,
                    paddingVertical: 12, paddingHorizontal: 15,
                    borderBottomWidth: i === 2 ? 0 : 1, borderBottomColor: T.line2,
                  }}
                >
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: T.sub }}>{k}</Text>
                  <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>{v}</Text>
                </View>
              ))}
            </View>

            <View style={{ paddingHorizontal: 15, paddingBottom: 15 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: T.ink, paddingTop: 12, paddingBottom: 2 }}>메뉴 매출</Text>
              {list.map((m) => (
                <View key={m.recipeId ?? m.menuName} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }} numberOfLines={1}>
                    {m.menuName} <Text style={{ color: T.ter }}>×{m.qty}</Text>
                  </Text>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(m.revenue)}원</Text>
                </View>
              ))}
              {list.length === 0 ? (
                <Text style={{ fontSize: 14, color: T.ter, paddingVertical: 16 }}>판매된 메뉴가 없어요</Text>
              ) : null}
              {!showAll && sorted.length > 5 ? (
                <Pressable
                  onPress={() => setShowAll(true)}
                  accessibilityRole="button" accessibilityLabel={`메뉴 ${sorted.length - 5}개 더 보기`}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>더보기 ({sorted.length - 5}개)</Text>
                  <Icon name="chevronDown" size={15} color={T.blue} />
                </Pressable>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: T.line }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.sub2 }}>소계</Text>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink2 }, NUM]}>{won(menuSum)}원</Text>
              </View>

              <Text style={{ fontSize: 13, fontWeight: '800', color: T.ink, paddingTop: 16, paddingBottom: 4 }}>기타 매출</Text>
              {etcItems.map((e, i) => (
                <View key={`${e.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub }}>{e.name} <Text style={{ color: T.ter }}>×{e.qty}</Text></Text>
                    {/* 미지정은 회색이다 — 매장으로 보이면 안 된다(0093). */}
                    <Text style={{ fontSize: 13, fontWeight: '700', color: e.channel ? T.blue : T.ter, marginTop: 2 }}>
                      {channelName(e.channel)}
                    </Text>
                  </View>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(e.price * e.qty)}원</Text>
                </View>
              ))}
              {etcItems.length === 0 && (s?.etcRevenue ?? 0) > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>기간 합계</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(s?.etcRevenue ?? 0)}원</Text>
                </View>
              ) : null}
              {(s?.etcRevenue ?? 0) === 0 ? (
                <Text style={{ fontSize: 14, color: T.ter, paddingVertical: 12, paddingLeft: 12 }}>기록된 기타 매출이 없어요</Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.sub2 }}>소계</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink2 }, NUM]}>{won(s?.etcRevenue ?? 0)}원</Text>
                </View>
              )}
            </View>
          </Card>
        </QueryState>
      </ScrollView>
    </View>
  );
}
