// IngredientListScreen.tsx — ING-01 식재료 리스트
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenShell, ScrollTabs, Icon, FAB } from '../../../components/kit';
import { T } from '../../../theme/tokens';
import { listCategories } from '../demoData';
import { useIngredients } from '../store';
import { IngCard } from '../components/IngCard';

// 카테고리 표기 차이(공백·· vs -) 정규화 후 비교.
const normCat = (s: string) => s.replace(/[\s·\-()]/g, '');
// 추천순: 소진임박/소진 → 안전재고 미달 → 여유 순.
const rank = (g: { soon: boolean; status: string }) => (g.soon || g.status === 'out' ? 0 : g.status === 'low' ? 1 : 2);

export function IngredientListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useIngredients((s) => s.items);
  const [cat, setCat] = useState(0);

  const selCat = listCategories[cat] ?? '전체';
  const filtered = cat === 0 ? items : items.filter((g) => normCat(g.cat) === normCat(selCat));
  const sorted = [...filtered].sort((a, b) => rank(a) - rank(b));
  const soonList = filtered.filter((g) => g.soon || g.status === 'out');

  return (
    <ScreenShell
      header={
        <View style={{ paddingTop: insets.top, backgroundColor: T.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingTop: 6, paddingBottom: 12 }}>
            <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }}>식재료</Text>
            <Pressable style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="search" size={23} color={T.ink2} />
            </Pressable>
            <Pressable style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="bell" size={24} color={T.ink2} />
              <View style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: T.red, borderWidth: 1.5, borderColor: '#fff' }} />
            </Pressable>
          </View>
        </View>
      }
    >
      <View style={{ borderBottomWidth: 1, borderBottomColor: '#D1D6DB' }}>
        <ScrollTabs tabs={listCategories} active={cat} onChange={setCat} />
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 }}>
        <Pressable
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: T.line,
            backgroundColor: T.surface,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: T.ink2 }}>추천순</Text>
          <Icon name="chevronDown" size={15} color={T.sub2} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 104, gap: 10 }} showsVerticalScrollIndicator={false}>
        {soonList.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: T.redTint,
              borderWidth: 1,
              borderColor: T.red,
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 12,
            }}
          >
            <Icon name="warn" size={16} color={T.red} />
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.red }} numberOfLines={1}>
              소진 임박 {soonList.length} — {soonList.map((g) => g.name).join(', ')}
            </Text>
          </View>
        ) : null}
        {sorted.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: T.ter }}>해당 카테고리의 식재료가 없어요</Text>
          </View>
        ) : (
          sorted.map((g) => <IngCard key={g.id} g={g} onPress={() => router.push(`/ingredients/${g.id}`)} />)
        )}
      </ScrollView>
      <FAB label="식재료 추가" onPress={() => router.push('/ingredients/add')} />
    </ScreenShell>
  );
}
