/**
 * RCP-16 손익 변동 상세 — profit_trends 스냅샷.
 *
 * 스냅샷에는 **비율만** 저장돼 있다(순이익률·재료비율). 금액은 그 시점 판매가를 곱해야
 * 나오는데 과거 판매가는 남기지 않으므로, 여기서는 비율과 변동 원인을 보여준다.
 * 없는 금액을 그럴듯하게 지어내지 않는다.
 */
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Badge, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { useRecipeDetail } from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };

const CAUSE: Record<string, { label: string; hint: string }> = {
  material: { label: '재료 단가', hint: '입고로 기준단가가 바뀌었어요' },
  recipe: { label: '레시피 변경', hint: '재료·판매가를 고쳤어요' },
  fixed: { label: '고정지출', hint: '월 고정지출이 바뀌었어요' },
};

export default function ProfitHistoryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const detail = useRecipeDetail(id);
  const r = detail.data;

  /** 최신순 + 직전 대비 증감. 추이는 "얼마인가"보다 "어느 쪽으로 움직였나"가 중요하다. */
  const rows = useMemo(() => {
    const asc = r?.profitTrends ?? [];
    return asc
      .map((t, i) => ({ ...t, prev: i > 0 ? asc[i - 1]!.profitRate : null }))
      .reverse();
  }, [r]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="손익 변동" onBack={() => safeBack(id ? `/recipes/${id}` : '/recipes')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: T.line }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink2 }}>{r?.name ?? '메뉴'} · {rows.length}건</Text>
          <Text style={{ fontSize: 14, color: T.ter, marginTop: 3 }}>재료 단가·레시피·고정지출이 바뀔 때마다 기록돼요</Text>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
          <QueryState
            isLoading={detail.isLoading}
            error={detail.error}
            isEmpty={rows.length === 0}
            onRetry={() => void detail.refetch()}
            emptyTitle="아직 기록된 변동이 없어요"
            emptyHint="입고하거나 레시피를 고치면 그 시점 손익이 기록돼요"
          >
            {rows.map((t, i) => {
              const diff = t.prev === null ? null : t.profitRate - t.prev;
              const up = (diff ?? 0) > 0;
              const cause = CAUSE[t.cause] ?? { label: '변동', hint: '' };
              return (
                <Card key={`${t.date}-${i}`} pad={0} style={{ overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <Text style={[{ fontSize: 14, color: T.sub, fontWeight: '700' }, NUM]}>{t.date.replace(/-/g, '.')}</Text>
                    <Badge tone="neutral" sm>{cause.label}</Badge>
                    {i === 0 ? <Badge tone="blue" sm>최근</Badge> : null}
                  </View>
                  <View style={{ paddingHorizontal: 15, paddingVertical: 13, gap: 9 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>순이익률</Text>
                      {diff !== null && Math.abs(diff) >= 0.05 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 8 }}>
                          <Icon name={up ? 'up' : 'down'} size={14} color={up ? T.green : T.red} />
                          <Text style={[{ fontSize: 14, fontWeight: '700', color: up ? T.green : T.red }, NUM]}>
                            {Math.abs(diff).toFixed(1)}%p
                          </Text>
                        </View>
                      ) : null}
                      <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{t.profitRate}%</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>재료비율</Text>
                      <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink2 }, NUM]}>{t.materialRate}%</Text>
                    </View>
                    {cause.hint ? <Text style={{ fontSize: 14, color: T.ter }}>{cause.hint}</Text> : null}
                  </View>
                </Card>
              );
            })}
          </QueryState>
        </View>
      </ScrollView>
    </View>
  );
}
