import { HeaderOverflowAction } from '@/components/kit/HeaderOverflowAction';
/**
 * RCP-11 부자재 검색 — 레시피에 담을 부자재 선택.
 * 마스터를 가리켜 담으므로, 나중에 마스터 단가를 고치면 이 메뉴 원가도 함께 바뀐다.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Badge, Card, Icon, Input, QueryState, ScrollTabs, SearchBar } from '@/components/kit';
import { UsageSheet } from '../components/UsageSheet';
import { clampDecimals } from '@/lib/num';
import { orderItems, useItemOrder } from '@/features/master-data/useItemOrder';
import { safeBack } from '@/lib/nav';
import { LAYOUT, COLOR, T, won, space } from '@/theme/tokens';
import { useSettingsLists, type MaterialRow } from '@/features/master-data/hooks';
import { useRecipeDraft } from '../draftStore';

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

export default function MaterialSearchScreen() {
  const router = useRouter();
  const itemOrder = useItemOrder('material');
  const lists = useSettingsLists();
  const categories = lists.data?.materialCategories ?? [];
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const categoryIndex = categories.findIndex(category => category.id === categoryId);
  const activeCategoryId = categories[categoryIndex]?.id;
  const addExtra = useRecipeDraft((s) => s.addExtra);
  const draft = useRecipeDraft((s) => s.draft);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MaterialRow | null>(null);
  const [quantity, setQuantity] = useState('1');
  const servings = Math.max(1, Number(draft.baseServings) || 1);
  const batchQuantity = Number(quantity);
  const canAdd = quantity.trim() !== '' && Number.isFinite(batchQuantity) && batchQuantity > 0;
  const closeUsage = () => { setSelected(null); setQuantity('1'); };
  const confirmUsage = () => {
    if (!selected || !canAdd) return;
    // recipe_extras.qty is per serving; the prototype input is for the whole batch.
    addExtra({ materialId: selected.id, name: selected.name, unitCost: selected.unitCost,
      amountPerServing: selected.unitCost * batchQuantity / servings, qty: batchQuantity / servings });
    closeUsage();
    safeBack('/recipes/add');
  };

  const items = useMemo(() => {
    const n = squash(query);
    return orderItems((lists.data?.materials ?? []), itemOrder.ids).filter(
      (m) => (activeCategoryId === undefined || m.categoryId === activeCategoryId)
        && (n === '' || squash(m.name).includes(n) || squash(m.categoryName ?? '').includes(n)),
    );
  }, [lists.data, query, activeCategoryId, itemOrder.ids]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="부자재 검색" onBack={() => safeBack('/recipes/add')}
        right={<HeaderOverflowAction label="부자재 검색 메뉴 열기" items={[{ label: "부자재 관리", onPress: () => router.push("/recipes/materials") }]} />} />
      <SearchBar value={query} onChange={setQuery} placeholder="부자재 이름으로 검색" />
      <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3, marginTop: space.md, marginBottom: space.md }}>
        <ScrollTabs tabs={['전체', ...categories.map(category => category.name)]} active={categoryIndex + 1}
          onChange={index => setCategoryId(categories[index - 1]?.id ?? null)} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: LAYOUT.scroll.end, gap: space.sm }}>
        <QueryState
          isLoading={lists.isLoading}
          error={lists.error}
          isEmpty={items.length === 0}
          onRetry={() => void lists.refetch()}
          emptyTitle={query ? `'${query}' 검색 결과가 없어요` : activeCategoryId ? '이 카테고리에 등록된 부자재가 없어요' : '등록된 부자재가 없어요'}
          emptyHint="부자재 관리에서 포장용기·소스팩 등을 먼저 등록해 주세요"
        >
          {items.map((m) => {
            const already = draft.extras.some((e) => e.materialId === m.id);
            return (
              <Pressable
                key={m.id}
                onPress={() => {
                  setQuantity('1'); setSelected(m);
                }}
                accessibilityRole="button" accessibilityLabel={`${m.name} 담기`}
              >
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.md }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
                        <Text style={{ maxWidth: '100%', flexShrink: 1, fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{m.name}</Text>
                        {m.categoryName ? <Badge tone="neutral" sm>{m.categoryName}</Badge> : null}
                        {already ? <Badge tone="blue" sm>담김</Badge> : null}
                      </View>
                      <Text style={{ fontSize: 14, color: T.sub2, marginTop: space.sm, fontWeight: '600' }}>
                        기준 단가 <Text style={{ color: T.ink, fontWeight: '700' }}>{won(m.unitCost)}원/{m.unitLabel}</Text>
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
      <UsageSheet visible={selected !== null} title="사용량 입력" itemLabel="부자재" name={selected?.name ?? ''}
        quantityLabel={`${servings}인분 사용량`} valid={canAdd} onClose={closeUsage} onConfirm={confirmUsage}
        input={<Input value={quantity} onChangeText={value => setQuantity(clampDecimals(value, 2))}
          suffix={selected?.unitLabel ?? '개'} mono variant="stacked" keyboardType="decimal-pad" accessibilityLabel="부자재 사용량" />}
        costs={[
          { label: `${servings}인분 비용`, value: `${won(canAdd && selected ? selected.unitCost * batchQuantity : 0)}원` },
          { label: '1인분 비용', value: `${won(canAdd && selected ? selected.unitCost * batchQuantity / servings : 0)}원` },
        ]} />
    </View>
  );
}
