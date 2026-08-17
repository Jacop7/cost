/**
 * 카테고리 관리 허브 — 식재료 · 레시피 · 부자재 카테고리 편집으로 분기.
 * ('관리' 허브는 항목 CRUD, 여기는 분류(카테고리) 편집으로 역할 분리)
 */
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Card, Icon, IconName } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { MATERIAL_CATS, RECIPE_CATS } from '@/features/recipes/demoData';
import { MY_CATEGORIES } from '../demoData';

interface Item { icon: IconName; bg: string; fg: string; t: string; count: number; route: Href; }
const ITEMS: Item[] = [
  { icon: 'box', bg: T.blueTint, fg: T.blue, t: '식재료 카테고리', count: MY_CATEGORIES.length, route: '/my/category' as Href },
  { icon: 'receipt', bg: '#F0EDFB', fg: '#7C5CE0', t: '레시피 카테고리', count: RECIPE_CATS.length, route: '/recipes/category' as Href },
  { icon: 'box', bg: '#EAF6F0', fg: '#179E6B', t: '부자재 카테고리', count: MATERIAL_CATS.length, route: '/recipes/material-category' as Href },
];

export default function MyCategoryHubScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="카테고리 관리" onBack={() => safeBack('/my')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 }}>
        <Text style={{ fontSize: 14, color: T.ter, marginHorizontal: 4, marginBottom: 10 }}>분류(카테고리)를 편집해요. 항목 추가·수정은 '관리'에서.</Text>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {ITEMS.map((m, i) => (
            <Pressable key={m.t} onPress={() => router.push(m.route)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, paddingHorizontal: 15, borderBottomWidth: i < ITEMS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: m.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={m.icon} size={20} color={m.fg} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{m.t}</Text>
                <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{m.count}종</Text>
              </View>
              <Icon name="chevron" size={18} color={T.line3} />
            </Pressable>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
