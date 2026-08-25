/**
 * SALES-19 재고 확인 — 프로토타입 `business-hours-negative-stock-flow.html?screen=sales` 규격.
 *
 * 매출 상단의 `식재료 부족 N개` 를 누르면 여기로 온다.
 *
 * ⚠ 식재료 목록으로 보내면 안 된다. 거기엔 **어느 메뉴가 왜 막혔는지**가 없다.
 *   사장님이 알아야 할 건 "소불고기를 못 만든다, 소고기가 없어서"이지
 *   "재고 0인 재료가 하나 있다"가 아니다.
 *
 * ⚠ 재료를 누르면 **바로 재고 추가**로 간다. `입고 등록 / 재고 수정` 을 고르게 하지 않는다
 *   (기획안 §4.4). 여기서 할 일은 채우는 것 하나뿐이다.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Card, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatQuantity } from '@sikjae/core';
import { T } from '@/theme/tokens';
import { useRecipeShortages, type ShortageIngredient } from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 최대 3개까지 먼저 보여 준다(프로토타입). 넘치면 `N개 더보기`. */
const HEAD = 3;

const unitOf = (u: string) => (u === 'ea' ? '개' : (u as 'g' | 'ml'));

/** 안전재고는 구매단위로 적어 둘 수 있다 — 최소단위로 맞춰서 비교한다. */
function safetyBase(g: ShortageIngredient): number {
  return g.safetyStockIsBase ? g.safetyStock : g.safetyStock * (g.perVolume || 1);
}

export default function SalesStockCheckScreen() {
  const router = useRouter();
  const q = useRecipeShortages();
  const [openAll, setOpenAll] = useState<Record<string, boolean>>({});

  const recipes = q.data?.recipes ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="재고 확인" onBack={() => safeBack('/sales' as Href)} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28, gap: 11 }}>
        <QueryState
          isLoading={q.isLoading}
          error={q.error}
          isEmpty={false}
          onRetry={() => void q.refetch()}
          emptyTitle=""
        >
          {recipes.length === 0 ? (
            <Card pad={20}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>확인이 필요한 재고가 없어요</Text>
              <Text style={{ fontSize: 14, color: T.ter, marginTop: 6, lineHeight: 20 }}>
                추가한 재고가 연결된 모든 레시피에 반영됐어요.
              </Text>
            </Card>
          ) : (
            recipes.map((r) => {
              const expanded = openAll[r.recipeId] === true;
              const shown = expanded ? r.ingredients : r.ingredients.slice(0, HEAD);
              const hidden = r.ingredients.length - shown.length;
              return (
                <Card key={r.recipeId} pad={0} style={{ overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }} numberOfLines={1}>{r.name}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: T.red }}>부족 재료 {r.ingredients.length}개</Text>
                  </View>

                  {shown.map((g, i) => (
                    <Pressable
                      key={g.ingredientId}
                      onPress={() => router.push(`/ingredients/add-stock/${g.ingredientId}` as Href)}
                      accessibilityRole="button"
                      accessibilityLabel={`${g.name} 재고 추가`}
                      style={{
                        paddingVertical: 12, paddingHorizontal: 15,
                        borderBottomWidth: i === shown.length - 1 && hidden === 0 ? 0 : 1, borderBottomColor: T.line2,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: T.ink }} numberOfLines={1}>{g.name}</Text>
                        <Icon name="chevron" size={16} color={T.line3} />
                      </View>
                      {/* 안전재고와 현재 재고를 나란히 — 얼마나 모자란지 눈으로 바로 보이게. */}
                      <View style={{ flexDirection: 'row', gap: 16, marginTop: 5 }}>
                        <Text style={[{ fontSize: 12, fontWeight: '700', color: T.ter }, NUM]}>
                          안전재고 <Text style={{ color: T.sub }}>{formatQuantity(safetyBase(g), unitOf(g.baseUnit))}</Text>
                        </Text>
                        <Text style={[{ fontSize: 12, fontWeight: '700', color: T.ter }, NUM]}>
                          현재 재고 <Text style={{ color: T.red }}>{formatQuantity(g.stock, unitOf(g.baseUnit))}</Text>
                        </Text>
                      </View>
                    </Pressable>
                  ))}

                  {hidden > 0 || expanded ? (
                    <Pressable
                      onPress={() => setOpenAll((p) => ({ ...p, [r.recipeId]: !expanded }))}
                      accessibilityRole="button"
                      accessibilityLabel={expanded ? '접기' : `재료 ${hidden}개 더 보기`}
                      style={{ minHeight: 46, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: T.line2 }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '800', color: T.blue }}>
                        {expanded ? '접기' : `${hidden}개 더보기`}
                      </Text>
                    </Pressable>
                  ) : null}
                </Card>
              );
            })
          )}

          {/* 프로토타입 `.outline-action` — 부족 판정과 무관하게 전체를 볼 수 있는 길. */}
          <Pressable
            onPress={() => router.push('/ingredients' as Href)}
            accessibilityRole="button" accessibilityLabel="전체 부족 재고 보기"
            style={{ minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface }}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: T.sub }}>전체 부족 재고 보기</Text>
          </Pressable>
        </QueryState>
      </ScrollView>
    </View>
  );
}
