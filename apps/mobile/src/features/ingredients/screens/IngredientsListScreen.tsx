/**
 * ING-01 식재료 리스트 (① 3장) — 프로토타입 ScreenING01 을 RN으로 이식.
 * 헤더(대형 타이틀+요약+발주하기) · 세그먼트탭 · 카테고리 스트립 · 정렬칩 · 카드 리스트 · FAB.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, Chip, FAB, Icon, ScrollTabs, Sheet, StatusBadge } from '@/components/kit';
import { T } from '@/theme/tokens';
import { CATEGORIES, DEMO_INGREDIENTS, IngCardData, perLabel } from '../demoData';

type SortKey = 'urgent' | 'recent' | 'priceLow' | 'priceHigh';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'urgent', label: '소진 임박순' },
  { key: 'recent', label: '최신 등록순' },
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

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* 헤더 */}
      <View style={{ paddingTop: insets.top, backgroundColor: T.bg }}>
        {/* 검색 바 — 구글 킵 '메모 검색' 스타일 (검색 아이콘 + placeholder) */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}>
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: T.surface,
              borderWidth: 1,
              borderColor: T.line,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
            }}
          >
            <Icon name="search" size={20} color={T.ter} />
            <Text style={{ fontSize: 15, color: T.ter, fontWeight: '500' }}>식자재 검색</Text>
          </Pressable>
        </View>
      </View>

      {/* 카테고리 스트립 — 활성 탭 굵은선 아래 얇은 그레이 구분선 (조금 진하게) */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: '#D1D6DB' }}>
        <ScrollTabs tabs={CATEGORIES} active={cat} onChange={setCat} />
      </View>

      {/* 정렬 필터 — 탭 아래 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row' }}>
        <Chip active tone="blue" onPress={() => setSortOpen(true)}>{`${sortLabel} ▾`}</Chip>
      </View>

      {/* 소진 임박 알림 — 필터 아래 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.redTint, borderWidth: 1, borderColor: T.red, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 }}>
          <Icon name="warn" size={16} color={T.red} />
          <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: T.red }}>소진 임박 1 — {urgentNames}</Text>
        </View>
      </View>

      {/* 카드 리스트 */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 104, gap: 10 }}>
        {sortedIngredients.map((g) => (
          <IngCard key={g.id} g={g} />
        ))}
      </ScrollView>

      <FAB label="추가" bottom={24} />

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
