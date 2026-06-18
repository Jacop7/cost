/**
 * RCP-09 식재료 검색 + RCP-08 사용량 입력 — 레시피에 담을 식재료 검색·담기.
 * 식재료 리스트(ING-01) 카드 스타일. 카드 탭 → 사용량 입력 바텀시트 → 담기.
 * ⚠ 디자인 프로토타입(정적 검색·데모 계산). 실제 담기/저장은 데이터 연결 단계에서.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, Badge, Button, Card, Icon, Select, Sheet } from '@/components/kit';
import { round } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { DEMO_INGREDIENTS, IngCardData, perLabel } from '../../ingredients/demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };
const SERVINGS = 10; // 이 메뉴 기준 인분(데모)

// 상태 뱃지 — 여유(초록)/소진 임박(빨강) 2단계. 솔리드.
function StatusTag({ g }: { g: IngCardData }) {
  const conf =
    g.soon || g.status === 'out' || g.status === 'low'
      ? { label: '소진 임박', c: T.red }
      : { label: '여유', c: T.green };
  return (
    <View style={{ backgroundColor: conf.c, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7 }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>{conf.label}</Text>
    </View>
  );
}

function IngRow({ g, onPress }: { g: IngCardData; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card pad={0} style={{ overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 15 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <StatusTag g={g} />
              <Text style={{ fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{g.name}</Text>
              <Badge tone="neutral" sm>{g.cat}</Badge>
            </View>
            <Text style={[{ fontSize: 13, fontWeight: '600', color: T.ink2, marginTop: 7 }, NUM]}>
              미개봉 {g.sealed} · 개봉 {g.opened} <Text style={{ color: T.ter, fontWeight: '500' }}>(개당 {perLabel(g.unit, g.per)})</Text>
            </Text>
            <Text style={[{ fontSize: 13, color: T.sub2, marginTop: 3 }, NUM]}>
              기준 단가 <Text style={{ fontWeight: '700', color: T.ink }}>{g.price}{g.priceUnit}</Text>
            </Text>
          </View>
          <Icon name="chevron" size={18} color="#C5CCD3" />
        </View>
      </Card>
    </Pressable>
  );
}

export default function RecipeIngredientSearchScreen() {
  const router = useRouter();
  const [sel, setSel] = useState<IngCardData | null>(null);
  const [qty, setQty] = useState(0);

  const open = (g: IngCardData) => {
    setSel(g);
    setQty(g.unit === '개' ? 1 : 300);
  };

  const batchCost = sel ? round(sel.price * qty) : 0; // N개 분량 총 원가
  const perServing = round(batchCost / SERVINGS); // 1개당

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="식재료 검색" onBack={() => router.back()} />

      {/* 검색 바 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
          <Icon name="search" size={20} color={T.ter} />
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: T.ter }}>식재료 이름으로 검색</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 9 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: T.sub2 }}>등록된 식재료 {DEMO_INGREDIENTS.length}</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: T.blue }}>+ 새 식재료 등록</Text>
        </View>

        {DEMO_INGREDIENTS.map((g) => (
          <IngRow key={g.id} g={g} onPress={() => open(g)} />
        ))}
      </ScrollView>

      {/* 사용량 입력 시트 */}
      <Sheet visible={sel != null} onClose={() => setSel(null)} title={sel?.name} height={440}>
        {sel ? (
          <View>
            {/* 안내 뱃지 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, backgroundColor: T.blueTint, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11, marginTop: 2, marginBottom: 14 }}>
              <Icon name="box" size={15} color={T.blue} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: T.blue }}>{SERVINGS}개 생산량을 입력하세요. (1회 생산량)</Text>
            </View>

            {/* 수량 + 단위 */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1, borderWidth: 1.5, borderColor: T.blue, borderRadius: 12, backgroundColor: T.surface, paddingVertical: 13, paddingHorizontal: 16 }}>
                <Text style={[{ fontSize: 20, fontWeight: '700', color: T.ink }, NUM]}>{qty.toLocaleString('ko-KR')}</Text>
              </View>
              <View style={{ width: 96 }}>
                <Select value={sel.unit} />
              </View>
            </View>

            {/* 10개 기준 / 1개당 */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <View style={{ flex: 1, backgroundColor: T.surface2, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 15 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: T.sub2 }}>{SERVINGS}개 기준</Text>
                <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink, marginTop: 4 }, NUM]}>
                  {won(batchCost)}<Text style={{ fontSize: 13, fontWeight: '700' }}>원</Text>
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: T.blueTint, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 15 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: T.blue }}>1개당</Text>
                <Text style={[{ fontSize: 18, fontWeight: '800', color: T.blue, marginTop: 4 }, NUM]}>
                  {won(perServing)}<Text style={{ fontSize: 13, fontWeight: '700' }}>원</Text>
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 20 }}>
              <Button kind="primary" size="lg" full onPress={() => setSel(null)}>
                담기
              </Button>
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
