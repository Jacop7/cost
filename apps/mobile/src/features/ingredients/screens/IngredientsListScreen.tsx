/**
 * ING-01 식재료 리스트 (① 3장) — 프로토타입 ScreenING01 을 RN으로 이식.
 * 헤더(대형 타이틀+요약+발주하기) · 세그먼트탭 · 카테고리 스트립 · 정렬칩 · 카드 리스트 · FAB.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, Chip, FAB, Icon, ScrollTabs, SegTabs, StatusBadge } from '@/components/kit';
import { T } from '@/theme/tokens';
import { CATEGORIES, DEMO_INGREDIENTS, IngCardData, perLabel } from '../demoData';

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
  const [seg, setSeg] = useState(0);
  const [cat, setCat] = useState(0);
  const urgentNames = '다진마늘';

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* 헤더 */}
      <View style={{ paddingTop: insets.top, backgroundColor: T.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingLeft: 12, paddingRight: 10 }}>
          <View style={{ flex: 1 }} />
          <Pressable style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="search" size={23} color={T.ink2} />
          </Pressable>
        </View>
        <View style={{ paddingLeft: 20, paddingRight: 16, paddingBottom: 12, paddingTop: 2 }}>
          <Text style={{ fontSize: 27, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }}>식재료</Text>
          <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.redTint, borderWidth: 1, borderColor: T.red, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 }}>
            <Icon name="warn" size={16} color={T.red} />
            <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: T.red }}>소진 임박 1 — {urgentNames}</Text>
          </View>
        </View>
      </View>

      {/* 세그먼트 탭 */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <SegTabs active={seg} onChange={setSeg} tabs={[{ label: '전체', count: 7 }, { label: '소진 임박', count: 1 }]} />
      </View>

      {/* 카테고리 스트립 */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: T.line2 }}>
        <ScrollTabs tabs={CATEGORIES} active={cat} onChange={setCat} />
      </View>

      {/* 정렬 칩 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, flexDirection: 'row' }}>
        <Chip active tone="blue">재고 상태순 ▾</Chip>
      </View>

      {/* 카드 리스트 */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 104, gap: 10 }}>
        {DEMO_INGREDIENTS.map((g) => (
          <IngCard key={g.id} g={g} />
        ))}
      </ScrollView>

      <FAB label="식재료 추가" bottom={24} />
    </View>
  );
}
