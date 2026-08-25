/**
 * SALES-17 고정지출 자세히 — 월 고정지출을 이 기간 매출 비중으로 나눈 금액.
 *
 * 고정지출은 "월 얼마"로 입력하고 손익에는 **매출 비율**로 반영한다(고정지출률).
 * 그래서 여기 금액은 월 입력값이 아니라 이 기간에 귀속된 몫이다 — 그 사실을 화면에 적는다.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AppHeader, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { useFixedBreakdown } from '../hooks';
import { rangeLabel } from '../period';
import { useSalesBusinessDate } from '../businessDay';

import { DetailSummary } from '../components/ProfitBlocks';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 고정지출 항목 키 → 한글 라벨. 키를 그대로 보여주면 사장님이 못 읽는다. */
const LABEL: Record<string, string> = {
  labor: '인건비', rent: '임대료', utility: '공과금', commission: '플랫폼 수수료',
  packing: '포장비', delivery: '배달/배송', ads: '광고/홍보', etc: '기타',
};

export default function SalesFixedScreen() {
  const router = useRouter();
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

  const fixed = useFixedBreakdown(from, to);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const items = fixed.data?.items ?? [];
  const total = fixed.data?.total ?? 0;
  const ratePct = fixed.data?.rate != null ? Math.round(fixed.data.rate * 1000) / 10 : null;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title="고정 지출"
        onBack={() => safeBack(`/sales/day?date=${to}`)}
        right={
          <Pressable
            onPress={() => router.push('/recipes/fixed-cost' as Href)}
            hitSlop={6}
            accessibilityRole="button" accessibilityLabel="고정지출 수정"
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="edit" size={20} color={T.ink2} />
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28, gap: 11 }}>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <DetailSummary
            rows={[
              ['영업일', `${rangeLabel(from, to)} · ${fixed.data?.month ?? ''} 기준`],
              ['고정 지출 합계', `${won(Math.round(total))}원`, ratePct != null ? `${ratePct}%` : undefined],
            ]}
          />
        </Card>

        {fixed.data?.provisional ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: T.amberTint }}>
            <Icon name="info" size={15} color={T.amberText} />
            <Text style={{ flex: 1, fontSize: 14, color: T.amberText, fontWeight: '600', lineHeight: 20 }}>
              이 달 고정지출이 아직 없어 {fixed.data.month} 값으로 잠정 계산했어요.
            </Text>
          </View>
        ) : null}

        <QueryState
          isLoading={fixed.isLoading}
          error={fixed.error}
          isEmpty={items.length === 0}
          onRetry={() => void fixed.refetch()}
          emptyTitle="등록된 고정지출이 없어요"
          emptyHint="마이페이지 → 고정지출에서 월 지출을 등록해 주세요"
        >
          {items.map((g) => {
            const isOpen = open[g.key];
            const pct = total > 0 ? Math.round((g.amount / total) * 1000) / 10 : 0;
            return (
              <Card key={g.key} pad={0} style={{ overflow: 'hidden' }}>
                <Pressable
                  onPress={() => toggle(g.key)}
                  disabled={g.lines.length === 0}
                  accessibilityRole="button"
                  accessibilityLabel={`${LABEL[g.key] ?? g.key} 세부 내역`}
                  accessibilityState={{ expanded: Boolean(isOpen) }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15 }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>{LABEL[g.key] ?? g.key}</Text>
                    <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600', marginTop: 3 }, NUM]}>
                      월 {won(g.monthTotal)}원 · 이 기간 몫 {pct}%
                    </Text>
                  </View>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 8 }, NUM]}>{won(Math.round(g.amount))}원</Text>
                  {g.lines.length > 0 ? (
                    <View style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>
                      <Icon name="chevronDown" size={16} color={T.ter} />
                    </View>
                  ) : <View style={{ width: 16 }} />}
                </Pressable>
                {isOpen && g.lines.length > 0 ? (
                  <View style={{ backgroundColor: T.surface2, paddingVertical: 10, paddingHorizontal: 15, borderTopWidth: 1, borderTopColor: T.line2 }}>
                    {g.lines.map((l) => (
                      <View key={l.name} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                        <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub }}>{l.name}</Text>
                        <Text style={[{ fontSize: 14, fontWeight: '700', color: T.ink2 }, NUM]}>월 {won(l.amount)}원</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </QueryState>

      </ScrollView>
    </View>
  );
}
