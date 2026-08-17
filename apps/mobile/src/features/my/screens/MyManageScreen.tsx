/**
 * MY-09 관리 — 식재료·레시피·부자재 관리 허브(세로 리스트). ⚠ 디자인 프로토타입(정적·데모).
 */
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Card, Icon } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';

interface Item { t: string; d: string; route: Href | null; }
// 항목 CRUD 전용 — 분류(카테고리) 편집은 '카테고리 관리' 허브로 분리.
const ITEMS: Item[] = [
  { t: '식재료 관리', d: '추가 · 수정 · 정렬 · 삭제', route: '/ingredients' as Href },
  { t: '레시피 관리', d: '메뉴 추가 · 수정 · 정렬', route: '/recipes' as Href },
  { t: '부자재 관리', d: '포장용기 · 전용 소스팩 외', route: '/recipes/materials' as Href },
];

export default function MyManageScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="관리" onBack={() => safeBack('/my')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 }}>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {ITEMS.map((m, i) => (
            <Pressable key={m.t} onPress={() => m.route && router.push(m.route)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 17, paddingHorizontal: 16, borderBottomWidth: i < ITEMS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{m.t}</Text>
                <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600', marginTop: 3 }}>{m.d}</Text>
              </View>
              <Icon name="chevron" size={18} color={T.line3} />
            </Pressable>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
