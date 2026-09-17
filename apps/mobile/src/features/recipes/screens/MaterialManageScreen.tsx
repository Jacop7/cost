/**
 * RCP-13 부자재 관리 (부자재 추가·수정은 RCP-14 페이지) — 부자재 마스터 CRUD.
 *
 * 구매 단위(박스)로 입력하면 낱개 단가로 환산해 저장한다(절대원칙 1 — 저장 직전 1회 환산).
 * 여기서 단가를 고치면 이 부자재를 쓰는 **모든 메뉴의 원가**가 서버에서 함께 갱신된다.
 */
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Card, FAB, QueryState, ScrollTabs, SearchBar } from '@/components/kit';
import { useRouter } from 'expo-router';
import { safeBack } from '@/lib/nav';
import { useMaterialActions } from '../components/useMaterialActions';
import { LAYOUT, COLOR, T, won, space } from '@/theme/tokens';
import { ManagementOrderAction } from '@/features/master-data/components/ManagementOrderAction';
import { orderItems, useItemOrder } from '@/features/master-data/useItemOrder';
import { ManageItemRow } from '@/components/kit/ManageItemRow';
import {
  useSettingsLists,
} from '@/features/master-data/hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();
export default function MaterialManageScreen() {
  const actions = useMaterialActions();
  const router = useRouter();
  const lists = useSettingsLists();
  const itemOrder = useItemOrder('material');
  const categories = lists.data?.materialCategories ?? [];
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const categoryIndex = categories.findIndex(category => category.id === categoryId);
  const activeCategoryId = categories[categoryIndex]?.id;

  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const n = squash(query);
    return orderItems(lists.data?.materials ?? [], itemOrder.ids).filter(
      (m) => (activeCategoryId === undefined || m.categoryId === activeCategoryId)
        && (n === '' || squash(m.name).includes(n) || squash(m.categoryName ?? '').includes(n)),
    );
  }, [lists.data, query, activeCategoryId, itemOrder.ids]);

  const openNew = () => router.push('/recipes/material-edit');
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {actions.dialogs}
      <AppHeader title="부자재 관리" onBack={() => safeBack('/my/categories')}
        right={<ManagementOrderAction kind="material" />} />
      <SearchBar value={query} onChange={setQuery} placeholder="부자재 이름으로 검색" />

      <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3, marginTop: space.md, marginBottom: space.md }}>
        <ScrollTabs tabs={['전체', ...categories.map(category => category.name)]} active={categoryIndex + 1}
          onChange={index => setCategoryId(categories[index - 1]?.id ?? null)} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: LAYOUT.scroll.endWithFab }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: T.sub2, marginBottom: space.md }}>등록된 부자재 {items.length}</Text>

        <QueryState
          isLoading={lists.isLoading}
          error={lists.error}
          isEmpty={items.length === 0}
          onRetry={() => void lists.refetch()}
          emptyTitle={query ? `'${query}' 검색 결과가 없어요` : '등록된 부자재가 없어요'}
          emptyHint="포장용기·소스팩처럼 메뉴에 딸려 나가는 것들을 등록해 주세요"
        >
          <Card pad={0} style={{ overflow: 'hidden' }}>
            {items.map((m, i) => (
              <ManageItemRow key={m.id} name={m.name} last={i === items.length - 1}
                disabled={actions.isPending} onEdit={() => actions.edit(m)} onDelete={() => actions.remove(m)}
                onView={() => router.push({ pathname: '/recipes/material-detail', params: { id: m.id } })}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
                    <Text style={{ maxWidth: '100%', flexShrink: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>{m.name}</Text>
                    {m.categoryName ? <Badge tone="neutral" sm>{m.categoryName}</Badge> : null}
                  </View>
                  <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 4, fontWeight: '600' }, NUM]}>
                    단가 <Text style={{ color: T.ink, fontWeight: '700' }}>{won(m.unitCost)}원/{m.unitLabel}</Text>
                    {m.usedCount > 0 ? <Text style={{ color: COLOR.text.tertiary }}>  ·  메뉴 {m.usedCount}개</Text> : null}
                  </Text>
              </ManageItemRow>
            ))}
          </Card>
        </QueryState>
      </ScrollView>

      <FAB label="부자재 추가" onPress={openNew} />

    </View>
  );
}
