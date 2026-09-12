/**
 * RCP-01 레시피 리스트 — 메뉴별 손익 한눈에.
 *
 * 카드의 순이익·원가율은 **서버가 낸 값**이다(recipe_list). 앱이 다시 계산하면
 * 매출 화면의 숫자와 어긋난다 — 같은 메뉴가 화면마다 다른 이익률로 보이게 된다.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Badge, Card, FilterButton, FAB, HubHeader, HubHeaderAction, Icon, QueryState, ScrollTabs, SearchBar, Sheet, SortSheet } from '@/components/kit';
import { LAYOUT, COLOR, COMPONENT, T, won, TYPE, space } from '@/theme/tokens';
import { formatPercent } from '@margincook/core';
import { useSettingsLists } from '@/features/master-data/hooks';
import { useRecipeList, type RecipeRow } from '../hooks';
import { SelectionRow } from '@/components/kit/SelectionRow';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 검색어 매칭 — 메뉴명·카테고리. 공백은 무시해 "제육 볶음"도 찾히게 한다. */
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();
function matchesQuery(r: RecipeRow, q: string): boolean {
  const n = squash(q);
  if (n === '') return true;
  return squash(r.name).includes(n) || squash(r.categoryName ?? '').includes(n);
}

type SortKey = 'rateLow' | 'rateHigh' | 'priceHigh' | 'priceLow';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'rateLow', label: '순이익률 낮은순' },
  { key: 'rateHigh', label: '순이익률 높은순' },
  { key: 'priceHigh', label: '판매가 높은순' },
  { key: 'priceLow', label: '판매가 낮은순' },
];

type StatusKey = 'all' | 'selling' | 'stopped';
const STATUS_OPTS: { key: StatusKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'selling', label: '판매중' },
  { key: 'stopped', label: '판매중지' },
];

type TargetKey = 'all' | 'below' | 'met';
const TARGET_OPTS: { key: TargetKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'below', label: '목표 미달' },
  { key: 'met', label: '목표 달성' },
];

/** 목표 달성 여부 — 목표는 %(0~100), 실제는 비율(0~1)이라 맞춰서 비교한다. */
const belowTarget = (r: RecipeRow) => r.profitRate * 100 < r.targetProfitRate;

function RecipeCard({ r, onPress }: { r: RecipeRow; onPress: () => void }) {
  const stopped = !r.active;
  // 재료가 바닥나 지금은 못 만드는 메뉴. 판매중지와 달리 입고하면 저절로 풀린다.
  const short = !stopped && r.blockedBy !== null;
  const warn = !stopped && belowTarget(r);
  const rateColor = warn ? COLOR.status.negative : COLOR.status.positive;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${r.name} 상세`}>
      <Card pad={0} style={{ overflow: 'hidden', opacity: stopped || short ? 0.55 : 1 }}>
        <View style={{ paddingVertical: space.md, paddingHorizontal: 16 }}>
          {/* Keep names and numeric values readable at large text sizes; do not shrink the font. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginBottom: space.md }}>
            {stopped ? null : warn ? <Badge tone="red" solid sm>목표 미달</Badge> : <Badge tone="green" solid sm>목표 달성</Badge>}
            <Text style={{ flexGrow: 1, flexShrink: 1, flexBasis: '50%', maxWidth: '100%', fontSize: TYPE.body.fontSize, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{r.name}</Text>
            {stopped ? <Badge tone="neutral" sm>판매중지</Badge> : null}
            {short ? <Badge tone="red" sm>식재료 부족</Badge> : null}
            {r.categoryName ? <Badge tone="neutral" sm>{r.categoryName}</Badge> : null}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, marginBottom: space.sm }}>
            <Text style={{ fontSize: TYPE.caption.fontSize, fontWeight: '700', color: T.sub }}>판매가</Text>
            <Text style={[{ marginLeft: 'auto', maxWidth: '100%', fontSize: TYPE.body.fontSize, fontWeight: '800', color: T.ink }, NUM]}>{won(r.price)}원</Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, marginBottom: space.sm }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, maxWidth: '100%' }}>
              <Text style={{ fontSize: TYPE.caption.fontSize, fontWeight: '700', color: T.sub }}>순이익</Text>
              {!stopped ? (
                <View style={{ maxWidth: '100%', ...COMPONENT.badge.small, borderRadius: COMPONENT.badge.borderRadius, backgroundColor: T.line2 }}>
                  <Text style={[{ ...COMPONENT.badge.text, color: T.sub }, NUM]}>목표 {r.targetProfitRate}%</Text>
                </View>
              ) : null}
            </View>
            <View style={{ marginLeft: 'auto', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: space.sm, maxWidth: '100%' }}>
              <Text style={[{ fontSize: TYPE.caption.fontSize, fontWeight: TYPE.body.fontWeight, color: rateColor }, NUM]}>{formatPercent(r.profitRate)}</Text>
              <Text style={[{ maxWidth: '100%', fontSize: TYPE.body.fontSize, fontWeight: '800', color: rateColor }, NUM]}>{won(Math.round(r.profit))}원</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs }}>
            <Text style={{ fontSize: TYPE.caption.fontSize, fontWeight: '700', color: T.sub }}>재료비</Text>
            <View style={{ marginLeft: 'auto', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: space.sm, maxWidth: '100%' }}>
              <Text style={[{ fontSize: TYPE.caption.fontSize, fontWeight: '700', color: T.sub2 }, NUM]}>{formatPercent(r.materialRate)}</Text>
              <Text style={[{ maxWidth: '100%', fontSize: TYPE.body.fontSize, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round(r.materialCost))}원</Text>
            </View>
          </View>

          {/* 단가가 없는 재료는 원가에서 조용히 빠진다. 숨기면 순이익이 부풀려 보인다. */}
          {r.unknownCostLines > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm, paddingVertical: 8, paddingHorizontal: space.sm, borderRadius: 8, backgroundColor: COLOR.status.cautionTint }}>
              <Icon name="warn" size={14} color={COLOR.status.caution} />
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: COLOR.status.caution }}>
                단가 없는 식재료 {r.unknownCostLines}개가 원가에서 빠져 있어요
              </Text>
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

export default function RecipesListScreen() {
  const router = useRouter();

  const recipes = useRecipeList();
  const lists = useSettingsLists();

  const [sort, setSort] = useState<SortKey>('rateLow');
  const [sortOpen, setSortOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusKey>('selling');
  const [statusOpen, setStatusOpen] = useState(false);
  const [targetFilter, setTargetFilter] = useState<TargetKey>('all');
  const [targetOpen, setTargetOpen] = useState(false);
  const [cat, setCat] = useState(0);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const tabs = useMemo(() => ['전체', ...(lists.data?.recipeCategories.map((c) => c.name) ?? [])], [lists.data]);
  const selCat = tabs[cat] ?? '전체';

  const filtered = useMemo(() => {
    const rows = (recipes.data ?? []).filter((r) => {
      if (cat !== 0 && (r.categoryName ?? '') !== selCat) return false;
      if (statusFilter === 'selling' && !r.active) return false;
      if (statusFilter === 'stopped' && r.active) return false;
      if (targetFilter !== 'all' && belowTarget(r) !== (targetFilter === 'below')) return false;
      if (!matchesQuery(r, query)) return false;
      return true;
    });
    switch (sort) {
      case 'rateHigh': return rows.sort((a, b) => b.profitRate - a.profitRate);
      case 'priceHigh': return rows.sort((a, b) => b.price - a.price);
      case 'priceLow': return rows.sort((a, b) => a.price - b.price);
      // 기본은 돈 안 되는 메뉴가 위로.
      default: return rows.sort((a, b) => a.profitRate - b.profitRate);
    }
  }, [recipes.data, cat, selCat, statusFilter, targetFilter, query, sort]);

  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? '순이익률 낮은순';
  const statusLabel = statusFilter === 'all' ? '판매상태' : STATUS_OPTS.find((s) => s.key === statusFilter)!.label;
  const targetLabel = targetFilter === 'all' ? '목표 상태' : TARGET_OPTS.find((s) => s.key === targetFilter)!.label;
  const isSearch = searching && query.trim() !== '';

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <HubHeader
        testID="RCP-01/header"
        title="메뉴"
        actions={
          <>
            <HubHeaderAction label="검색" icon="search" selected={searching} onPress={() => { if (searching) setQuery(''); setSearching((v) => !v); }} />
            <HubHeaderAction label="알림" icon="bell" onPress={() => router.push('/my/notifications' as Href)} />
          </>
        }
      />

      <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3 }}>
        <ScrollTabs tabs={tabs} active={cat} onChange={setCat} />
      </View>

      {searching ? <SearchBar value={query} onChange={setQuery} placeholder="메뉴·카테고리 검색" onClose={() => { setSearching(false); setQuery(''); }} /> : null}

      {/* Wrapped rows must leave room for both chips' vertical touch extensions. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.sm, rowGap: Math.max(space.sm, COMPONENT.filterChip.hitSlop * 2), paddingHorizontal: space.xl, paddingVertical: space.md }}>
        <FilterButton label={sortLabel} onPress={() => setSortOpen(true)} />
        <FilterButton label={statusLabel} onPress={() => setStatusOpen(true)} />
        <FilterButton label={targetLabel} onPress={() => setTargetOpen(true)} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: LAYOUT.scroll.endWithFab, gap: space.sm }}>
        <QueryState
          isLoading={recipes.isLoading}
          error={recipes.error}
          isEmpty={filtered.length === 0}
          onRetry={() => void recipes.refetch()}
          emptyTitle={isSearch ? `'${query.trim()}' 검색 결과가 없어요` : '해당 조건의 메뉴가 없어요'}
          emptyHint={isSearch ? '다른 이름으로 찾아보세요' : '아래 버튼으로 메뉴를 추가해 보세요'}
        >
          {filtered.map((r) => (
            <RecipeCard key={r.id} r={r} onPress={() => router.push(`/recipes/${r.id}` as Href)} />
          ))}
        </QueryState>
      </ScrollView>

      <FAB label="메뉴 추가" onPress={() => router.push('/recipes/add' as Href)} />

      {/* 정렬 */}
      <SortSheet visible={sortOpen} options={SORTS} value={sort} onSelect={setSort} onClose={() => setSortOpen(false)} />

      {/* 판매 상태 */}
      <Sheet visible={statusOpen} onClose={() => setStatusOpen(false)} title="판매 상태">
        {STATUS_OPTS.map((s, i) => (
          <SelectionRow key={s.key} label={s.label} selected={statusFilter === s.key}
            last={i === STATUS_OPTS.length - 1}
            onPress={() => { setStatusFilter(s.key); setStatusOpen(false); }} />
        ))}
      </Sheet>

      {/* 목표 달성 여부 */}
      <Sheet visible={targetOpen} onClose={() => setTargetOpen(false)} title="목표">
        {TARGET_OPTS.map((s, i) => (
          <SelectionRow key={s.key} label={s.label} selected={targetFilter === s.key}
            last={i === TARGET_OPTS.length - 1}
            onPress={() => { setTargetFilter(s.key); setTargetOpen(false); }} />
        ))}
      </Sheet>
    </View>
  );
}
