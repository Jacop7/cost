/**
 * RCP-11 부자재 검색 — 레시피에 담을 부자재 선택.
 * 부자재 마스터(DEMO_MATERIALS) 리스트. 추가·수정은 부자재 관리(RCP-13)에서.
 * ⚠ 디자인 프로토타입(정적 검색). 실제 담기/저장은 데이터 연결 단계에서.
 */
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Badge, Card, Icon } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { DEMO_MATERIALS } from '../demoData';

export default function MaterialSearchScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="부자재 검색" onBack={() => safeBack('/recipes')} />

      {/* 검색 바 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
          <Icon name="search" size={20} color={T.ter} />
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: T.ter }}>부자재 이름으로 검색</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}>
        {/* 관리 안내 배너 */}
        <Pressable
          onPress={() => router.push('/recipes/materials' as Href)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}
        >
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.blue }}>부자재 추가 및 수정은 부자재 관리에서 진행해 주세요</Text>
          <Icon name="chevron" size={17} color={T.blue} />
        </Pressable>

        <Text style={{ fontSize: 14, fontWeight: '600', color: T.sub2 }}>등록된 부자재 {DEMO_MATERIALS.length}</Text>

        {DEMO_MATERIALS.map((m, i) => (
          <Pressable key={i} onPress={() => safeBack('/recipes')}>
            <Card pad={0} style={{ overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, paddingHorizontal: 15 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: T.ink }} numberOfLines={1}>{m.name}</Text>
                    <Badge tone="neutral" sm>{m.cat}</Badge>
                  </View>
                  <Text style={{ fontSize: 14, color: T.sub2, marginTop: 7, fontWeight: '600' }}>
                    기준 단가 <Text style={{ color: T.ink, fontWeight: '700' }}>{won(m.price)}원/{m.unit}</Text>
                  </Text>
                </View>
                <Icon name="chevron" size={18} color={T.line3} />
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
