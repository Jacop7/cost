/**
 * SALES-17 폐기 손실 자세히.
 *
 * ⚠ 두 갈래를 섞지 않는다(0041). 사장님이 할 일이 다르기 때문이다 —
 *     조리 폐기    만들어 놓고 못 팔았다   → 덜 만들어야 한다
 *     식재료 폐기  쓰기도 전에 버렸다      → 발주·보관을 손봐야 한다
 *   한 숫자로 뭉치면 어느 쪽을 손봐야 할지 알 수 없다.
 *
 * 금액은 지어내지 않는다. 조리 폐기는 판매 시점에 굳은 1인분 재료비,
 * 식재료 폐기는 **버린 날** 단가로 되짚는다(0058).
 */
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Card, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatQuantity } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { useWasteBreakdown } from '../hooks';
import { rangeLabel, todayBusiness } from '../period';

const NUM = { fontVariant: ['tabular-nums' as const] };

function Group({ title, hint, total, children }: {
  title: string;
  hint: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2, marginTop: 4 }}>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.sub }}>{title}</Text>
        <Text style={[{ fontSize: 14, fontWeight: '800', color: T.red }, NUM]}>{won(Math.round(total))}원</Text>
      </View>
      <Text style={{ fontSize: 13, color: T.ter, marginHorizontal: 2, marginTop: 2, marginBottom: 7 }}>{hint}</Text>
      <Card pad={0} style={{ overflow: 'hidden', marginBottom: 12 }}>{children}</Card>
    </>
  );
}

function Row({ name, sub, amount, last }: { name: string; sub: string; amount: number; last: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 12, paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: T.ink }} numberOfLines={1}>{name}</Text>
        <Text style={[{ fontSize: 12, color: T.sub, fontWeight: '600', marginTop: 3 }, NUM]}>{sub}</Text>
      </View>
      <Text style={[{ fontSize: 15, fontWeight: '800', color: T.red }, NUM]}>−{won(Math.round(amount))}원</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={{ paddingVertical: 22, alignItems: 'center' }}>
      <Text style={{ fontSize: 14, color: T.ter }}>{text}</Text>
    </View>
  );
}

export default function SalesWasteScreen() {
  const { from: f, to: t } = useLocalSearchParams<{ from?: string; to?: string }>();
  const to = t ?? todayBusiness();
  const from = f ?? to;
  const q = useWasteBreakdown(from, to);
  const d = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={`${rangeLabel(from, to)} 폐기 손실`} onBack={() => safeBack(`/sales/day?date=${to}`)} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <QueryState
          isLoading={q.isLoading}
          error={q.error}
          isEmpty={d !== undefined && d.total === 0}
          onRetry={() => void q.refetch()}
          emptyTitle="이 기간에 버린 게 없어요"
          emptyHint="식재료를 폐기하거나 매출에 못 판 수량을 적으면 여기 쌓여요"
        >
          {d ? (
            <>
              <Card pad={0} style={{ overflow: 'hidden', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 15 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: T.sub }}>폐기 손실</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={[{ fontSize: 18, fontWeight: '800', color: T.red }, NUM]}>
                    {won(Math.round(d.total))}원
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 15, gap: 14, borderTopWidth: 1, borderTopColor: T.line2 }}>
                  {([['조리 폐기', d.menuTotal], ['식재료 폐기', d.ingredientTotal]] as const).map(([k, v]) => (
                    <View key={k} style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 12, color: T.ter, fontWeight: '700', marginBottom: 4 }}>{k}</Text>
                      <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>
                        {won(Math.round(v))}원
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>

              <Group
                title="조리 폐기"
                hint="만들어 놓고 못 판 몫이에요. 자주 남으면 만드는 양을 줄여 보세요."
                total={d.menuTotal}
              >
                {d.menu.length === 0 ? (
                  <Empty text="조리 폐기가 없어요" />
                ) : (
                  d.menu.map((m, i) => (
                    <Row key={m.name} name={m.name} sub={`${m.qty}인분`} amount={m.amount} last={i === d.menu.length - 1} />
                  ))
                )}
              </Group>

              <Group
                title="식재료 폐기"
                hint="쓰기도 전에 버린 몫이에요. 자주 생기면 한 번에 사는 양을 줄여 보세요."
                total={d.ingredientTotal}
              >
                {d.ingredient.length === 0 ? (
                  <Empty text="식재료 폐기가 없어요" />
                ) : (
                  d.ingredient.map((g, i) => (
                    <Row
                      key={g.name}
                      name={g.name}
                      sub={formatQuantity(g.qty, g.baseUnit === 'ea' ? '개' : (g.baseUnit as 'g' | 'ml'))}
                      amount={g.amount}
                      last={i === d.ingredient.length - 1}
                    />
                  ))
                )}
              </Group>

              <Text style={{ fontSize: 13, color: T.ter, lineHeight: 19, marginHorizontal: 2 }}>
                버린 금액은 원가에 얹히지 않고 <Text style={{ fontWeight: '700' }}>월 손익의 폐기 손실</Text>로 잡혀요.
                식재료 폐기 단가는 <Text style={{ fontWeight: '700' }}>버린 날</Text> 기준이에요.
              </Text>
            </>
          ) : null}
        </QueryState>
      </ScrollView>
    </View>
  );
}
