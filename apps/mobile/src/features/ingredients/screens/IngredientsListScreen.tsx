/**
 * ING-01 식재료 리스트 (① 3장) — 프로토타입 ScreenING01 을 RN으로 이식.
 * 헤더(대형 타이틀+요약+발주하기) · 세그먼트탭 · 카테고리 스트립 · 정렬칩 · 카드 리스트 · FAB.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, Chip, FAB, Icon, ScrollTabs, Sheet, StatusBadge } from '@/components/kit';
import { T } from '@/theme/tokens';
import { CATEGORIES, DEMO_INGREDIENTS, IngCardData, perLabel } from '../demoData';

type SortKey = 'urgent' | 'recent' | 'priceLow' | 'priceHigh';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'urgent', label: '소진 임박순' },
  { key: 'recent', label: '최근 입고순' },
  { key: 'priceLow', label: '단가 낮은순' },
  { key: 'priceHigh', label: '단가 높은순' },
];

function IngCard({ g }: { g: IngCardData }) {
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ paddingVertical: 13, paddingHorizontal: 15 }}>
        {/* 상태 + 이름 + 카테고리 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <StatusBadge status={g.soon ? 'out' : g.status} sm />
          <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{g.name}</Text>
          {g.warn ? <Icon name="warn" size={16} color={T.red} /> : null}
          <View style={{ flex: 1 }} />
          <Badge tone="neutral" sm>{g.cat}</Badge>
        </View>
        {/* 잔여 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 }}>
          <Text style={[{ fontSize: 14.5, fontWeight: '700', color: T.ink2 }, { fontVariant: ['tabular-nums'] }]}>
            미개봉 {g.sealed} · 개봉 {g.opened}
          </Text>
          <Text style={{ fontSize: 13, color: T.ter }}>(개당 {perLabel(g.unit, g.per)})</Text>
        </View>
        {/* 단가 + 최근입고 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 }}>
          <Text style={[{ fontSize: 13.5, fontWeight: '700', color: g.warn ? T.red : T.sub }, { fontVariant: ['tabular-nums'] }]}>
            {g.price}
            {g.priceUnit}
          </Text>
          {g.warn ? <Badge tone="red" sm>{`▲${g.warnPct}%`}</Badge> : null}
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 13.5, color: T.sub2 }}>최근입고 {g.last}</Text>
        </View>
      </View>
    </Card>
  );
}

export default function IngredientsListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [cat, setCat] = useState(0);
  const [sort, setSort] = useState<SortKey>('urgent');
  const [sortOpen, setSortOpen] = useState(false);
  const urgentNames = '다진마늘';

  // 정렬: 소진 임박순(기본) · 최신 등록순 · 단가 낮은/높은순.
  const isUrgent = (g: IngCardData) => g.soon || g.status === 'out';
  const sortedIngredients = [...DEMO_INGREDIENTS].sort((a, b) => {
    switch (sort) {
      case 'recent':
        return b.last.localeCompare(a.last);
      case 'priceLow':
        return a.price - b.price;
      case 'priceHigh':
        return b.price - a.price;
      default:
        return Number(isUrgent(b)) - Number(isUrgent(a));
    }
  });
  const sortLabel = SORTS.find((s) => s.key === sort)!.label;

  // 카테고리 필터 — 탭 라벨(·/공백/괄호)과 데이터(-)를 정규화해 매칭. cat===0 은 '전체'.
  const norm = (s: string) => s.replace(/[·\s()\-]/g, '');
  const visibleIngredients =
    cat === 0
      ? sortedIngredients
      : sortedIngredients.filter((g) => norm(g.cat) === norm(CATEGORIES[cat]!));

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* 헤더 — 타이틀(좌) + 검색 아이콘(우) */}
      <View style={{ paddingTop: insets.top, backgroundColor: T.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingTop: 6, paddingBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 24, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }}>식재료</Text>
          <Pressable style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="search" size={23} color={T.ink2} />
          </Pressable>
        </View>
      </View>

      {/* 카테고리 스트립 — 활성 탭 굵은선 아래 얇은 그레이 구분선 (조금 진하게) */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: '#D1D6DB' }}>
        <ScrollTabs tabs={CATEGORIES} active={cat} onChange={setCat} />
      </View>

      {/* 정렬 필터 — 탭 아래 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row' }}>
        <Chip active tone="blue" onPress={() => setSortOpen(true)}>{`${sortLabel} ▾`}</Chip>
      </View>

      {/* 카드 리스트 — 소진 임박 알림을 리스트 최상단에 넣어 함께 스크롤 */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 0, paddingBottom: 104, gap: 10, flexGrow: 1 }}>
        {visibleIngredients.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
            <Text style={{ fontSize: 15, color: T.ter }}>등록된 식자재가 없습니다.</Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.redTint, borderWidth: 1, borderColor: T.red, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 }}>
              <Icon name="warn" size={16} color={T.red} />
              <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: T.red }}>소진 임박 1 — {urgentNames}</Text>
            </View>
            {visibleIngredients.map((g) => (
              <Pressable key={g.id} onPress={() => router.push(`/ingredients/${g.id}` as Href)}>
                <IngCard g={g} />
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      <FAB label="추가" bottom={24} onPress={() => router.push('/ingredients/add' as Href)} />

      {/* 정렬 선택 시트 */}
      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="정렬" height={320}>
        {SORTS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => {
              setSort(s.key);
              setSortOpen(false);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 15,
              borderBottomWidth: 1,
              borderBottomColor: T.line2,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: sort === s.key ? '700' : '500',
                color: sort === s.key ? T.blue : T.ink,
              }}
            >
              {s.label}
            </Text>
            {sort === s.key ? <Icon name="check" size={20} color={T.blue} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}
