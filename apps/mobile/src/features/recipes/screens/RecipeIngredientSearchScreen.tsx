/**
 * RCP-05/09 식재료 검색 (+ RCP-08 사용량 입력) — 레시피에 담을 식재료 검색·담기.
 * 프로토타입(zip) 디자인: 카테고리 탭 + "설정에서 추가" 배너 + 카드(여유/곧소진·총량·단가).
 * 카드 탭 → 사용량 입력 바텀시트 → 담기.
 * ⚠ 디자인 프로토타입(정적 검색·데모 계산). 실제 담기/저장은 데이터 연결 단계에서.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Button, Card, Icon, ScrollTabs, Select, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatQuantity, round } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { DEMO_INGREDIENTS, IngCardData } from '../../ingredients/demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };
const SERVINGS = 10; // 이 메뉴 기준 인분(데모)

// 식재료 카테고리 (상단 스크롤 탭) — 데모: 시각 선택만.
const CATS = ['전체', '축산·계란', '수산·해조류', '농산 (신선)', '곡물·견과·분말', '유제품', '냉동식품', '소스·유지류·장류', '향신료·허브', '음료·주류', '상온가공·건식', '두부·발효식품', '베이커리'];

// 총 보유량 + 구매단위 단가 — 프로토타입 환산 규칙(개→개/박스, g·ml→kg·L).
function stockLine(g: IngCardData): { total: string; price: string } {
  const count = g.sealed + g.opened;
  const big = g.unit === 'ml' ? 'L' : 'kg';
  if (g.unit === '개') {
    const total = g.per > 1 ? `총 ${count}박스 · ${won(count * g.per)}개` : `총 ${count}개`;
    return { total, price: `${won(Math.round(g.price))}원/개` };
  }
  const amt = count * g.per;
  // 표기 규칙은 @sikjae/core formatQuantity 단일 출처. 총 보유량은 대략값이면 되므로 기본 정밀도.
  const total = `총 ${formatQuantity(amt, g.unit)}`;
  const price = g.per >= 1000 ? `${won(Math.round(g.price * 1000))}원/${big}` : `${won(Math.round(g.price * 10) / 10)}원/${g.unit}`;
  return { total, price };
}

function IngRow({ g, onPress }: { g: IngCardData; onPress: () => void }) {
  const line = stockLine(g);
  return (
    <Pressable onPress={onPress}>
      <Card pad={0} style={{ overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, paddingHorizontal: 15 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {g.soon ? <Badge tone="red" solid sm>곧 소진</Badge> : <Badge tone="green" solid sm>여유</Badge>}
              <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: T.ink }} numberOfLines={1}>{g.name}</Text>
              <Badge tone="neutral" sm>{g.cat}</Badge>
            </View>
            <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, marginTop: 8 }, NUM]}>{line.total}</Text>
            <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: 4 }, NUM]}>{line.price}</Text>
          </View>
          <Icon name="chevron" size={20} color={T.line3} />
        </View>
      </Card>
    </Pressable>
  );
}

export default function RecipeIngredientSearchScreen() {
  const [sel, setSel] = useState<IngCardData | null>(null);
  const [qty, setQty] = useState(0);
  const [cat, setCat] = useState(0);

  const open = (g: IngCardData) => {
    setSel(g);
    setQty(g.unit === '개' ? 1 : 300);
  };

  const batchCost = sel ? round(sel.price * qty) : 0; // N개 분량 총 원가
  const perServing = round(batchCost / SERVINGS); // 1개당

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="식재료 검색" onBack={() => safeBack('/recipes')} />

      {/* 검색 바 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
          <Icon name="search" size={20} color={T.ter} />
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ter }}>식재료 이름으로 검색</Text>
        </View>
      </View>

      {/* 카테고리 스크롤 탭 */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3 }}>
        <ScrollTabs tabs={CATS} active={cat} onChange={setCat} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 10 }}>
        {/* 설정 안내 배너 */}
        <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.blue }}>식재료 추가 및 수정은 설정 페이지에서 진행해 주세요</Text>
          <Icon name="chevron" size={17} color={T.blue} />
        </Pressable>

        <Text style={{ fontSize: 14, fontWeight: '600', color: T.sub2 }}>등록된 식재료 {DEMO_INGREDIENTS.length}</Text>

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
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>{SERVINGS}개 생산량을 입력하세요. (1회 생산량)</Text>
            </View>

            {/* 수량 + 단위 */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1, borderWidth: 1.5, borderColor: T.blue, borderRadius: 12, backgroundColor: T.surface, paddingVertical: 13, paddingHorizontal: 16 }}>
                <Text style={[{ fontSize: 18, fontWeight: '700', color: T.ink }, NUM]}>{won(qty)}</Text>
              </View>
              <View style={{ width: 96 }}>
                <Select value={sel.unit} />
              </View>
            </View>

            {/* 10개 기준 / 1개당 */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <View style={{ flex: 1, backgroundColor: T.surface2, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 15 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub2 }}>{SERVINGS}개 기준</Text>
                <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink, marginTop: 4 }, NUM]}>
                  {won(batchCost)}<Text style={{ fontSize: 16, fontWeight: '700' }}>원</Text>
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: T.blueTint, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 15 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>1개당</Text>
                <Text style={[{ fontSize: 18, fontWeight: '800', color: T.blue, marginTop: 4 }, NUM]}>
                  {won(perServing)}<Text style={{ fontSize: 16, fontWeight: '700' }}>원</Text>
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
