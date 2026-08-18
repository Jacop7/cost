/**
 * 카테고리 관리 허브 — 식재료 · 레시피 · 부자재 분류 편집으로 분기.
 * 개수는 실제 등록된 카테고리 수다. 고정 숫자를 보여주면 추가해도 그대로라 "저장이 안 됐나" 싶다.
 */
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Card, Icon, IconName, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { useSettingsLists } from '../hooks';

export default function MyCategoryHubScreen() {
  const router = useRouter();
  const lists = useSettingsLists();

  const items: { icon: IconName; bg: string; fg: string; t: string; count: number; sub: string; route: Href }[] = [
    { icon: 'box', bg: T.blueTint, fg: T.blue, t: '식재료 카테고리', count: lists.data?.categories.length ?? 0, sub: '분류 · 기본 로스율', route: '/my/category' as Href },
    { icon: 'receipt', bg: '#F0EDFB', fg: '#7C5CE0', t: '레시피 카테고리', count: lists.data?.recipeCategories.length ?? 0, sub: '메뉴 분류', route: '/recipes/category' as Href },
    { icon: 'box', bg: '#EAF6F0', fg: '#179E6B', t: '부자재 카테고리', count: lists.data?.materialCategories.length ?? 0, sub: '포장·소모품 분류', route: '/recipes/material-category' as Href },
    { icon: 'tag', bg: '#FEF1E6', fg: '#E08A2B', t: '부자재 관리', count: lists.data?.materials.length ?? 0, sub: '포장용기·소스팩 단가', route: '/recipes/materials' as Href },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="카테고리 관리" onBack={() => safeBack('/my')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 }}>
        <Text style={{ fontSize: 14, color: T.ter, marginHorizontal: 4, marginBottom: 10 }}>분류와 부자재 단가를 관리해요.</Text>
        <QueryState
          isLoading={lists.isLoading}
          error={lists.error}
          isEmpty={false}
          onRetry={() => void lists.refetch()}
          emptyTitle=""
        >
          <Card pad={0} style={{ overflow: 'hidden' }}>
            {items.map((m, i) => (
              <Pressable
                key={m.t}
                onPress={() => router.push(m.route)}
                accessibilityRole="button" accessibilityLabel={m.t}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, paddingHorizontal: 15, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: m.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={m.icon} size={20} color={m.fg} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{m.t}</Text>
                  <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{m.sub} · {m.count}종</Text>
                </View>
                <Icon name="chevron" size={18} color={T.line3} />
              </Pressable>
            ))}
          </Card>
        </QueryState>
      </ScrollView>
    </View>
  );
}
