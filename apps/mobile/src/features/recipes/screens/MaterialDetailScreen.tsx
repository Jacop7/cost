import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionSheet, AppHeader, Card, Icon, QueryState } from '@/components/kit';
import { useSettingsLists } from '@/features/master-data/hooks';
import { safeBack } from '@/lib/nav';
import { useUnitPriceFormat } from '@/lib/unitPriceFormat';
import { COLOR, LAYOUT, T, TYPE, minTouchTarget, space } from '@/theme/tokens';
import { RecipeDetailRow } from '../components/RecipeDetailParts';
import { useMaterialActions } from '../components/useMaterialActions';

/** RCP-14b 부자재 상세 — 서버 마스터 값으로 표시하고 편집은 공용 페이지로 연결한다. */
export default function MaterialDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <MaterialDetailPage key={id ?? 'missing'} id={id} />;
}

function MaterialDetailPage({ id }: { id?: string }) {
  const formatUnitPrice = useUnitPriceFormat();
  const router = useRouter();
  const lists = useSettingsLists();
  const material = lists.data?.materials.find(item => item.id === id);
  const [menuOpen, setMenuOpen] = useState(false);
  const actions = useMaterialActions(() => router.replace('/recipes/materials'));
  const ready = !!material && !lists.error && !actions.isPending;
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title="부자재" onBack={() => safeBack('/recipes/materials')}
      right={<Pressable accessibilityRole="button" accessibilityLabel="수정 메뉴 열기"
        accessibilityState={{ expanded: menuOpen, disabled: !ready }} disabled={!ready} onPress={() => setMenuOpen(true)}
        style={{ minWidth: minTouchTarget, minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="more" size={19} color={COLOR.text.secondary} />
      </Pressable>} />
    <ScrollView showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: LAYOUT.scroll.end, gap: space.md }}>
      <QueryState isLoading={lists.isLoading} error={lists.error} isEmpty={!material}
        emptyTitle="부자재를 찾을 수 없어요" onRetry={() => void lists.refetch()}>
        {material ? <>
          <Card pad={0}>
            <View style={{ padding: space.lg }}>
              <Text style={{ ...TYPE.title, color: COLOR.text.primary }}>{material.name}</Text>
            </View>
            <RecipeDetailRow label="카테고리" value={material.categoryName ?? '지정 안 함'} />
            <RecipeDetailRow label="단가" value={formatUnitPrice(material.unitCost, material.unitLabel)} />
            <RecipeDetailRow label="사용 메뉴" value={`${material.usedCount}개`} last />
          </Card>
          {material.memo ? <Card>
            <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary, marginBottom: space.sm }}>메모</Text>
            <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{material.memo}</Text>
          </Card> : null}
        </> : null}
      </QueryState>
    </ScrollView>
    {material && ready ? <ActionSheet floating visible={menuOpen} onClose={() => setMenuOpen(false)} items={[
      { label: '수정', onPress: () => actions.edit(material) },
      { label: '삭제', danger: true, onPress: () => actions.remove(material) },
    ]} /> : null}
    {actions.dialogs}
  </View>;
}
