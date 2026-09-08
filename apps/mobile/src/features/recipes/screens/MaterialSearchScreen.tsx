/**
 * RCP-11 부자재 검색 — 레시피에 담을 부자재 선택.
 * 마스터를 가리켜 담으므로, 나중에 마스터 단가를 고치면 이 메뉴 원가도 함께 바뀐다.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Badge, Card, Icon, QueryState, SearchBar } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { LAYOUT, COLOR, T, won, space } from '@/theme/tokens';
import { useSettingsLists } from '@/features/master-data/hooks';
import { useRecipeDraft } from '../draftStore';

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

export default function MaterialSearchScreen() {
  const router = useRouter();
  const lists = useSettingsLists();
  const addExtra = useRecipeDraft((s) => s.addExtra);
  const draft = useRecipeDraft((s) => s.draft);
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const n = squash(query);
    return (lists.data?.materials ?? []).filter(
      (m) => n === '' || squash(m.name).includes(n) || squash(m.categoryName ?? '').includes(n),
    );
  }, [lists.data, query]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="부자재 검색" onBack={() => safeBack('/recipes/add')} />
      <SearchBar value={query} onChange={setQuery} placeholder="부자재 이름으로 검색" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: LAYOUT.scroll.end, gap: space.sm }}>
        <Pressable
          onPress={() => router.push('/recipes/materials' as Href)}
          accessibilityRole="button" accessibilityLabel="부자재 관리로 이동"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLOR.action.primaryTint, borderWidth: 1, borderColor: COLOR.action.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: space.md }}
        >
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: COLOR.text.accent }}>부자재 추가·수정은 부자재 관리에서 해요</Text>
          <Icon name="chevron" size={17} color={COLOR.action.primary} />
        </Pressable>

        <QueryState
          isLoading={lists.isLoading}
          error={lists.error}
          isEmpty={items.length === 0}
          onRetry={() => void lists.refetch()}
          emptyTitle={query ? `'${query}' 검색 결과가 없어요` : '등록된 부자재가 없어요'}
          emptyHint="부자재 관리에서 포장용기·소스팩 등을 먼저 등록해 주세요"
        >
          {items.map((m) => {
            const already = draft.extras.some((e) => e.materialId === m.id);
            return (
              <Pressable
                key={m.id}
                onPress={() => {
                  addExtra({ materialId: m.id, name: m.name, amount: m.unitCost, qty: 1 });
                  safeBack('/recipes/add');
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
                    <Icon name="plus" size={20} color={COLOR.action.primary} sw={2.2} />
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </QueryState>
      </ScrollView>
    </View>
  );
}
