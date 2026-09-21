import { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, Badge, Card, FAB, QueryState, ScrollTabs, SearchBar } from '@/components/kit';
import { ManageItemRow } from '@/components/kit/ManageItemRow';
import { useBusinessEditConfirmation } from '@/features/business-day/useBusinessEditConfirmation';
import { ManagementOrderAction } from '@/features/master-data/components/ManagementOrderAction';
import { useSettingsLists } from '@/features/master-data/hooks';
import { orderItems, useItemOrder } from '@/features/master-data/useItemOrder';
import { safeBack } from '@/lib/nav';
import { COLOR, LAYOUT, T, space, won } from '@/theme/tokens';
import { useRecipeList, type RecipeRow } from '../hooks';

const squash = (value: string) => value.replace(/\s+/g, '').toLowerCase();

/** 판매 손익 홈과 별도로 메뉴 마스터를 관리한다. 서버 가격·판매 상태를 그대로 표시한다. */
export default function RecipeManageScreen() {
  const router = useRouter();
  const list = useRecipeList();
  const lists = useSettingsLists();
  const order = useItemOrder('recipe');
  const edit = useBusinessEditConfirmation('메뉴');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const categories = lists.data?.recipeCategories ?? [];
  const categoryIndex = categories.findIndex(row => row.id === categoryId);
  const selectedCategory = categories[categoryIndex]?.id;
  const items = useMemo(() => orderItems(list.data ?? [], order.ids).filter(item =>
    (!selectedCategory || item.categoryId === selectedCategory)
    && (squash(item.name).includes(squash(query)) || squash(item.categoryName ?? '').includes(squash(query)))),
  [list.data, order.ids, selectedCategory, query]);
  const editItem = (item: RecipeRow) => {
    if (!item.editRevision) {
      Alert.alert('수정 정보를 확인하지 못했어요', '목록을 다시 불러온 후 시도해 주세요.');
      void list.refetch(); return;
    }
    edit.request(() => router.push(`/recipes/add?id=${item.id}`));
  };
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    {edit.dialog}
    <AppHeader title="메뉴 설정" onBack={() => safeBack('/recipes')} right={<ManagementOrderAction kind="recipe" />} />
    <SearchBar value={query} onChange={setQuery} placeholder="메뉴 이름으로 검색" />
    <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3, marginTop: space.md, marginBottom: space.md }}>
      <ScrollTabs tabs={['전체', ...categories.map(row => row.name)]} active={categoryIndex + 1}
        onChange={index => setCategoryId(categories[index - 1]?.id ?? null)} />
    </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: LAYOUT.scroll.endWithFab }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: COLOR.text.tertiary, marginBottom: space.md }}>등록된 메뉴 {items.length}</Text>
      <QueryState isLoading={list.isLoading || lists.isLoading} error={list.error ?? lists.error} isEmpty={items.length === 0}
        onRetry={() => { void list.refetch(); void lists.refetch(); }} emptyTitle={query ? `'${query}' 검색 결과가 없어요` : '등록된 메뉴가 없어요'}>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {items.map((item, index) => <ManageItemRow key={item.id} name={item.name} last={index === items.length - 1}
            onView={() => router.push(`/recipes/${item.id}`)} onEdit={() => editItem(item)}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
              <Text style={{ maxWidth: '100%', flexShrink: 1, fontSize: 16, fontWeight: '700', color: COLOR.text.primary }}>{item.name}</Text>
              {item.categoryName ? <Badge tone="neutral" sm>{item.categoryName}</Badge> : null}
              {!item.active ? <Badge tone="neutral" sm>판매중지</Badge> : null}
            </View>
            <Text style={{ fontSize: 14, color: COLOR.text.tertiary, marginTop: 4, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
              판매가 <Text style={{ color: COLOR.text.primary, fontWeight: '700' }}>{won(item.price)}원</Text> · 기준 {item.baseServings}인분
            </Text>
          </ManageItemRow>)}
        </Card>
      </QueryState>
    </ScrollView>
    <FAB label="메뉴 등록" onPress={() => router.push('/recipes/add')} />
  </View>;
}
