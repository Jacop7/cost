import { useUnitPriceFormat } from '@/lib/unitPriceFormat';
import { useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppHeader, Badge, Card, FAB, QueryState, ScrollTabs, SearchBar } from '@/components/kit';
import { ManageItemRow } from '@/components/kit/ManageItemRow';
import { IngredientDeleteDialog } from '../components/IngredientDeleteDialog';
import { useSettingsLists } from '@/features/master-data/hooks';
import { ManagementOrderAction } from '@/features/master-data/components/ManagementOrderAction';
import { orderItems, useItemOrder } from '@/features/master-data/useItemOrder';
import { IngredientEditMenu } from '../components/IngredientEditMenu';
import { safeBack } from '@/lib/nav';
import { COLOR, LAYOUT, T, space } from '@/theme/tokens';
import { useDeactivateIngredient, useIngredientList, type IngredientRow } from '../hooks';
import { dispUnit } from '../ledger';

const squash = (value: string) => value.replace(/\s+/g, '').toLowerCase();

/** 메뉴에서 사용하는 재료 마스터 관리. 원가·재고 변경은 기존 도메인 흐름에 맡긴다. */
export default function IngredientManageScreen() {
  const formatUnitPrice = useUnitPriceFormat();
  const router = useRouter();
  const list = useIngredientList();
  const itemOrder = useItemOrder('ingredient');
  const lists = useSettingsLists();
  const categories = lists.data?.categories ?? [];
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const categoryIndex = categories.findIndex(category => category.id === categoryId);
  const categoryName = categories[categoryIndex]?.name;
  const deactivate = useDeactivateIngredient();
  const [editId, setEditId] = useState<string | null>(null);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<IngredientRow | null>(null);
  const deleteBusy = useRef(false);
  const items = useMemo(() => {
    const needle = squash(query);
    return orderItems(list.data ?? [], itemOrder.ids).filter(item => (categoryName === undefined || item.categoryName === categoryName)
      && (squash(item.name).includes(needle) || squash(item.categoryName ?? '').includes(needle)));
  }, [list.data, query, categoryName, itemOrder.ids]);
  const edit = (item: IngredientRow) => { setEditId(item.id); setEditMenuOpen(true); };

  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    {editId ? <IngredientEditMenu key={editId} id={editId} visible={editMenuOpen} onClose={() => setEditMenuOpen(false)} /> : null}
    <AppHeader title="재료 설정" onBack={() => safeBack('/recipes')}
      right={<ManagementOrderAction kind="ingredient" />} />
    <SearchBar value={query} onChange={setQuery} placeholder="재료 이름으로 검색" />
    <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3, marginTop: space.md, marginBottom: space.md }}>
      <ScrollTabs tabs={['전체', ...categories.map(category => category.name)]} active={categoryIndex + 1}
        onChange={index => setCategoryId(categories[index - 1]?.id ?? null)} />
    </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: LAYOUT.scroll.endWithFab }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: COLOR.text.tertiary, marginBottom: space.md }}>등록된 재료 {items.length}</Text>
      <QueryState isLoading={list.isLoading || lists.isLoading} error={list.error ?? lists.error} isEmpty={items.length === 0}
        onRetry={() => { void list.refetch(); void lists.refetch(); }}
        emptyTitle={query ? `'${query}' 검색 결과가 없어요` : '등록된 재료가 없어요'}
        emptyHint="메뉴에 사용할 재료를 등록해 주세요">
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {items.map((item, index) => <ManageItemRow key={item.id} name={item.name} last={index === items.length - 1}
            onView={() => router.push(`/ingredients/${item.id}`)} disabled={deactivate.isPending} onEdit={() => edit(item)} onDelete={() => setDeleting(item)}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
                <Text style={{ maxWidth: '100%', flexShrink: 1, fontSize: 16, fontWeight: '700', color: COLOR.text.primary }}>{item.name}</Text>
                {item.categoryName ? <Badge tone="neutral" sm>{item.categoryName}</Badge> : null}
              </View>
              <Text style={{ fontSize: 14, color: COLOR.text.tertiary, marginTop: 4, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                단가 <Text style={{ color: COLOR.text.primary, fontWeight: '700' }}>{item.basePrice === null ? '산출 전' : formatUnitPrice(item.basePrice, dispUnit(item.baseUnit))}</Text>
              </Text>
          </ManageItemRow>)}
        </Card>
      </QueryState>
    </ScrollView>
    <FAB label="재료 등록" onPress={() => router.push('/ingredients/add')} />
    {deleting ? <IngredientDeleteDialog key={deleting.id} id={deleting.id} name={deleting.name}
      loading={deactivate.isPending} onCancel={() => { if (!deleteBusy.current) setDeleting(null); }}
      onConfirm={() => {
        if (!deleting || deleteBusy.current || deactivate.isPending) return;
        deleteBusy.current = true;
        deactivate.mutate(deleting.id, {
          onSuccess: () => setDeleting(null),
          onError: error => Alert.alert('삭제하지 못했어요', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요'),
          onSettled: () => { deleteBusy.current = false; },
        });
      }} /> : null}
  </View>;
}
