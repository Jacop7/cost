/**
 * RCP-01 레시피 리스트 — 메뉴별 손익 한눈에.
 *
 * 카드의 순이익·원가율은 **서버가 낸 값**이다(recipe_list). 앱이 다시 계산하면
 * 매출 화면의 숫자와 어긋난다 — 같은 메뉴가 화면마다 다른 이익률로 보이게 된다.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, Chip, FAB, Icon, QueryState, ScrollTabs, SearchBar, Sheet } from '@/components/kit';
import { T, won } from '@/theme/tokens';
import { formatPercent } from '@sikjae/core';
import { useSettingsLists } from '@/features/master-data/hooks';
import { useRecipeList, type RecipeRow } from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 검색어 매칭 — 메뉴명·카테고리. 공백은 무시해 "제육 볶음"도 찾히게 한다. */
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();
function matchesQuery(r: RecipeRow, q: string): boolean {
  const n = squash(q);
  if (n === '') return true;
  return squash(r.name).includes(n) || squash(r.categoryName ?? '').includes(n);
}

type SortKey = 'rateLow' | 'rateHigh' | 'priceHigh' | 'priceLow' | 'salesHigh';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'rateLow', label: '순이익률 낮은순' },
  { key: 'rateHigh', label: '순이익률 높은순' },
  { key: 'salesHigh', label: '판매량 많은순' },
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
  const rateColor = warn ? T.red : T.green;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${r.name} 상세`}>
      <Card pad={0} style={{ overflow: 'hidden', opacity: stopped || short ? 0.55 : 1 }}>
        <View style={{ paddingVertical: 15, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 }}>
            {stopped ? null : warn ? <Badge tone="red" solid sm>목표 미달</Badge> : <Badge tone="green" solid sm>목표 달성</Badge>}
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: T.ink }} numberOfLines={1}>{r.name}</Text>
            {stopped ? <Badge tone="neutral" sm>판매중지</Badge> : null}
            {short ? <Badge tone="red" sm>재료 부족</Badge> : null}
            {r.categoryName ? <Badge tone="neutral" sm>{r.categoryName}</Badge> : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.sub }}>판매가</Text>
            <Text style={[{ fontSize: 14, fontWeight: '800', color: T.ink }, NUM]}>{won(r.price)}원</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>순이익</Text>
            {!stopped ? (
              <View style={{ marginLeft: 6, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6, backgroundColor: T.line2 }}>
                <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub }, NUM]}>목표 {r.targetProfitRate}%</Text>
              </View>
            ) : null}
            <View style={{ flex: 1 }} />
            <Text style={[{ fontSize: 14, fontWeight: '800', color: rateColor, marginRight: 8 }, NUM]}>{formatPercent(r.profitRate)}</Text>
            <Text style={[{ fontSize: 14, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round(r.profit))}원</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.sub }}>재료비</Text>
            <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginRight: 8 }, NUM]}>{formatPercent(r.materialRate)}</Text>
            <Text style={[{ fontSize: 14, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round(r.materialCost))}원</Text>
          </View>

          {/* 단가가 없는 재료는 원가에서 조용히 빠진다. 숨기면 순이익이 부풀려 보인다. */}
          {r.unknownCostLines > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: T.amberTint }}>
              <Icon name="warn" size={14} color={T.amberText} />
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.amberText }}>
                단가 없는 재료 {r.unknownCostLines}개가 원가에서 빠져 있어요
              </Text>
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

export default function RecipesListScreen() {
  const insets = useSafeAreaInsets();
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
      case 'salesHigh': return rows.sort((a, b) => (b.avgMonthlySales ?? 0) - (a.avgMonthlySales ?? 0));
      // 기본은 돈 안 되는 메뉴가 위로.
      default: return rows.sort((a, b) => a.profitRate - b.profitRate);
    }
  }, [recipes.data, cat, selCat, statusFilter, targetFilter, query, sort]);

  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? '순이익률 낮은순';
  const statusLabel = statusFilter === 'all' ? '판매상태' : STATUS_OPTS.find((s) => s.key === statusFilter)!.label;
  const targetLabel = targetFilter === 'all' ? '목표' : TARGET_OPTS.find((s) => s.key === targetFilter)!.label;
  const isSearch = searching && query.trim() !== '';

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ paddingTop: insets.top, backgroundColor: T.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingTop: 6, paddingBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }}>레시피</Text>
          <Pressable
            onPress={() => setSearching((v) => !v)}
            accessibilityRole="button" accessibilityLabel="검색"
            accessibilityState={{ selected: searching }}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="search" size={23} color={searching ? T.blue : T.ink2} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/my/notifications' as Href)}
            accessibilityRole="button" accessibilityLabel="알림"
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="bell" size={24} color={T.ink2} />
          </Pressable>
        </View>
        {searching ? (
          <SearchBar value={query} onChange={setQuery} placeholder="메뉴·카테고리 검색" onClose={() => { setSearching(false); setQuery(''); }} />
        ) : null}
      </View>

      <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3 }}>
        <ScrollTabs tabs={tabs} active={cat} onChange={setCat} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 7, paddingHorizontal: 20, paddingVertical: 12 }}>
        <Chip active onPress={() => setSortOpen(true)}>{sortLabel}</Chip>
        <Chip active={statusFilter !== 'all'} onPress={() => setStatusOpen(true)}>{statusLabel}</Chip>
        <Chip active={targetFilter !== 'all'} onPress={() => setTargetOpen(true)}>{targetLabel}</Chip>
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 104, gap: 10 }}>
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
      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="정렬" height={420}>
        {SORTS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => { setSort(s.key); setSortOpen(false); }}
            accessibilityRole="button" accessibilityLabel={s.label}
            accessibilityState={{ selected: sort === s.key }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 4 }}
          >
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: sort === s.key ? T.blue : T.ink }}>{s.label}</Text>
            {sort === s.key ? <Icon name="check" size={18} color={T.blue} sw={2.4} /> : null}
          </Pressable>
        ))}
      </Sheet>

      {/* 판매 상태 */}
      <Sheet visible={statusOpen} onClose={() => setStatusOpen(false)} title="판매 상태" height={320}>
        {STATUS_OPTS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => { setStatusFilter(s.key); setStatusOpen(false); }}
            accessibilityRole="button" accessibilityLabel={s.label}
            accessibilityState={{ selected: statusFilter === s.key }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 4 }}
          >
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: statusFilter === s.key ? T.blue : T.ink }}>{s.label}</Text>
            {statusFilter === s.key ? <Icon name="check" size={18} color={T.blue} sw={2.4} /> : null}
          </Pressable>
        ))}
      </Sheet>

      {/* 목표 달성 여부 */}
      <Sheet visible={targetOpen} onClose={() => setTargetOpen(false)} title="목표 달성" height={320}>
        {TARGET_OPTS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => { setTargetFilter(s.key); setTargetOpen(false); }}
            accessibilityRole="button" accessibilityLabel={s.label}
            accessibilityState={{ selected: targetFilter === s.key }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 4 }}
          >
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: targetFilter === s.key ? T.blue : T.ink }}>{s.label}</Text>
            {targetFilter === s.key ? <Icon name="check" size={18} color={T.blue} sw={2.4} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}
