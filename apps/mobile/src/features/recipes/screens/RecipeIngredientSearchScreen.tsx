import { useUnitPriceFormat } from '@/lib/unitPriceFormat';
import { HeaderOverflowAction } from '@/components/kit/HeaderOverflowAction';
/**
 * RCP-10 재료 검색 — 레시피에 담을 재료 선택.
 *
 * ⚠ 한때 '반제품(메뉴)' 탭이 있었다. 다른 메뉴를 재료로 담는 기능인데,
 *   반제품은 1차 범위 밖이다(레시피 v3 §142 "구조만 예약").
 *   양념장처럼 만들어 쓰는 것도 1차에서는 그냥 재료로 등록한다.
 *
 * 담으면 편집 초안(draftStore)에 들어가고 레시피 폼으로 돌아간다.
 * 같은 재료를 두 번 담으면 줄이 갈라지지 않고 사용량이 합쳐진다.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Badge, Card, Icon, Input, QueryState, ScrollTabs, SearchBar } from '@/components/kit';
import { orderItems, useItemOrder } from '@/features/master-data/useItemOrder';
import { safeBack } from '@/lib/nav';
import { formatQuantity, isNegativeStock, stockStateOf, STOCK_STATE_LABEL } from '@costkeep/core';
import { LAYOUT, COLOR, T, won, space } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';
import { useIngredientList } from '@/features/ingredients/hooks';
import { useSettingsLists } from '@/features/master-data/hooks';
import { dispUnit } from '@/features/ingredients/ledger';
import { useRecipeDraft, type DraftLine } from '../draftStore';
import { UsageSheet } from '../components/UsageSheet';

const NUM = { fontVariant: ['tabular-nums' as const] };
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();


export default function RecipeIngredientSearchScreen() {
  const formatUnitPrice = useUnitPriceFormat();
  const router = useRouter();
  const itemOrder = useItemOrder('ingredient');
  const { exclude } = useLocalSearchParams<{ exclude?: string }>();

  const ingredients = useIngredientList();
  const lists = useSettingsLists();
  const categories = lists.data?.categories ?? [];
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const categoryIndex = categories.findIndex(category => category.id === categoryId);
  const categoryName = categories[categoryIndex]?.name;
  const addLine = useRecipeDraft((s) => s.addLine);
  const draft = useRecipeDraft((s) => s.draft);

  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<DraftLine | null>(null);
  const [qty, setQty] = useState('');

  const servings = Math.max(1, Number(draft.baseServings) || 1);

  const ingList = useMemo(() => {
    const n = squash(query);
    return orderItems((ingredients.data ?? []), itemOrder.ids).filter(
      (g) => (categoryName === undefined || g.categoryName === categoryName)
        && (n === '' || squash(g.name).includes(n) || squash(g.categoryName ?? '').includes(n)),
    );
  }, [ingredients.data, query, categoryName, itemOrder.ids]);

  const openQty = (line: DraftLine) => {
    setPending(line);
    // 이미 담긴 재료면 현재 사용량을 보여준다.
    const cur = draft.lines.find(
      (l) => line.ingredientId !== null && l.ingredientId === line.ingredientId,
    );
    setQty(cur ? String(cur.inputQty) : '');
  };

  const confirm = () => {
    if (!pending) return;
    const v = Number(qty.replace(/,/g, ''));
    if (!Number.isFinite(v) || v <= 0) return;
    addLine({ ...pending, inputQty: v });
    setPending(null);
    safeBack('/recipes/add');
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="재료 검색" onBack={() => safeBack('/recipes/add')}
        right={<HeaderOverflowAction label="재료 검색 메뉴 열기" items={[{ label: "재료 설정", onPress: () => router.push("/recipes/ingredients") }]} />} />

      <SearchBar value={query} onChange={setQuery} placeholder="재료 이름으로 검색" />
      <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3, marginTop: space.md, marginBottom: space.md }}>
        <ScrollTabs tabs={['전체', ...categories.map(category => category.name)]} active={categoryIndex + 1}
          onChange={index => setCategoryId(categories[index - 1]?.id ?? null)} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: LAYOUT.scroll.end, gap: space.sm }}>
                  <QueryState
            isLoading={ingredients.isLoading || lists.isLoading}
            error={ingredients.error ?? lists.error}
            isEmpty={ingList.length === 0}
            onRetry={() => { void ingredients.refetch(); void lists.refetch(); }}
            emptyTitle={query ? `'${query}' 검색 결과가 없어요` : categoryName ? '이 카테고리에 등록된 재료가 없어요' : '등록된 재료가 없어요'}
            emptyHint="재료 탭에서 먼저 등록해 주세요"
          >
            {ingList.map((g) => {
              const unit = dispUnit(g.baseUnit);
              const already = draft.lines.some((l) => l.ingredientId === g.id);
              return (
                <Pressable
                  key={g.id}
                  onPress={() => openQty({ ingredientId: g.id, subRecipeId: null, name: g.name, unit, inputQty: 0, unitPrice: g.basePrice })}
                  accessibilityRole="button" accessibilityLabel={`${g.name} 담기`}
                >
                  <Card pad={0} style={{ overflow: 'hidden' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
                          <Text style={{ maxWidth: '100%', flexShrink: 1, fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{g.name}</Text>
                          {g.categoryName ? <Badge tone="neutral" sm>{g.categoryName}</Badge> : null}
                          {already ? <Badge tone="blue" sm>담김</Badge> : null}
                          {/*
                            ⚠ 재고 상태를 여기서도 보여 준다(0108). 예전엔 회색 문장 한 줄뿐이라
                              소진된 재료인지 모른 채 레시피에 담았다.
                          */}
                          {g.stockTracking !== false && stockStateOf(g) !== 'ok' ? (
                            <Badge tone="red" solid sm>{STOCK_STATE_LABEL[stockStateOf(g)].label}</Badge>
                          ) : null}
                        </View>
                        <Text style={[{ fontSize: 14, color: T.sub2, marginTop: space.sm, fontWeight: '600' }, NUM]}>
                          {g.basePrice === null ? '단가 산출 전' : <>단가 <Text style={{ color: COLOR.text.primary, fontWeight: '700' }}>{formatUnitPrice(g.basePrice, unit)}</Text></>}
                          {g.stockTracking !== false ? <>{'  ·  '}재고{' '}
                          <Text style={{ color: isNegativeStock(g.stockTotal) ? COLOR.status.negative : T.sub2, fontWeight: '800' }}>
                            {formatQuantity(g.stockTotal, unit)}
                          </Text></> : null}
                        </Text>
                      </View>
                      <View style={{ width: 32, height: 32, borderRadius: 16, flexShrink: 0,
                        alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.action.primaryTint }}>
                        <Icon name="plus" size={20} color={COLOR.action.onTint} sw={2.2} />
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </QueryState>
      </ScrollView>

      <UsageSheet visible={pending !== null} title="사용량 입력" itemLabel="재료" name={pending?.name ?? ''}
        quantityLabel={`${servings}인분 사용량`} valid={Number.isFinite(Number(qty)) && Number(qty) > 0}
        onClose={() => setPending(null)} onConfirm={confirm}
        input={<Input value={qty} onChangeText={t => setQty(clampDecimals(t, 2))} placeholder="0"
          suffix={pending?.unit ?? '인분'} mono variant="stacked" keyboardType="decimal-pad"
          accessibilityLabel="사용량" returnKeyType="done" onSubmitEditing={confirm} />}
        costs={[
          { label: `${servings}인분 비용`, value: pending?.unitPrice == null ? '단가 산출 전' : `${won(Math.round((Number(qty) || 0) * pending.unitPrice))}원` },
          { label: '1인분 비용', value: pending?.unitPrice == null ? '단가 산출 전' : `${won(Math.round((Number(qty) || 0) * pending.unitPrice / servings))}원` },
        ]} />
    </View>
  );
}
