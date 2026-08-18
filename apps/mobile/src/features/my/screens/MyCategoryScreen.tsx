/**
 * MY-03 카테고리 관리 — 식재료 카테고리(12종) · 로스율 기본값. ⚠ 디자인 프로토타입(정적·데모).
 */
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Card, Icon } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { MY_CATEGORIES, MY_CAT_LOSS } from '../demoData';

export default function MyCategoryScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title="카테고리 관리"
        onBack={() => safeBack('/my')}
        right={
          <Pressable hitSlop={6} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="카테고리 추가">
            <Icon name="plus" size={24} color={T.blue} />
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 }}>
        <Text style={{ fontSize: 14, color: T.ter, marginHorizontal: 4, marginBottom: 10 }}>드래그로 순서 변경 · 탭하면 이름·로스율 수정</Text>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {MY_CATEGORIES.map((cat, i) => {
            const loss = MY_CAT_LOSS[cat];
            return (
              <View key={cat} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: i < MY_CATEGORIES.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <Icon name="grip" size={18} color={T.line3} />
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink }}>{cat}</Text>
                {loss != null ? <Badge tone="neutral" sm>로스 {loss}%</Badge> : null}
                <Icon name="chevron" size={16} color={T.line3} />
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}
