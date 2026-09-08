// IngredientListScreen.tsx — ING-01 식재료 리스트
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell, ScrollTabs, Icon, FAB, HubHeader, HubHeaderAction, SearchBar, SortChip, SortSheet, QueryState, type SortOption } from '../../../components/kit';
import { LAYOUT, COLOR, T, radius, space } from '../../../theme/tokens';
import { useIngredientList, type IngredientRow } from '../hooks';
import { useSettingsLists } from '@/features/master-data/hooks';
import { IngCard, stockStateOf } from '../components/IngCard';

// 추천순: 소진 → 소진 임박 → 여유. 배지와 **같은 core 판정**을 쓴다.
const ORDER = { out: 0, low: 1, ok: 2 } as const;
const rank = (g: IngredientRow) => ORDER[stockStateOf(g)];

type SortKey = 'recommended' | 'name' | 'stockLow' | 'priceHigh';

const SORTS: readonly SortOption<SortKey>[] = [
  { key: 'recommended', label: '추천순' },
  { key: 'stockLow', label: '잔여 적은 순' },
  { key: 'priceHigh', label: '단가 높은 순' },
  { key: 'name', label: '이름순' },
];

/** 검색어 매칭 — 이름·카테고리·구매처를 함께 본다. 공백은 무시해 "대 파"도 찾히게 한다. */
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();
function matches(g: IngredientRow, q: string): boolean {
  const n = squash(q);
  if (n === '') return true;
  return squash(g.name).includes(n)
    || squash(g.categoryName ?? '').includes(n)
    || squash(g.vendorName ?? '').includes(n);
}

export function IngredientListScreen() {
  const router = useRouter();
  // 실데이터. 로딩·오류·빈 상태는 QueryState 가 구분해 그린다(가이드 §9.8).
  const { data, isLoading, error, refetch } = useIngredientList();
  const items = data ?? [];
  // 탭은 **등록된 카테고리**에서 만든다. 고정 배열을 쓰면 새 카테고리의 식재료가
  // 어느 탭에도 안 잡혀 목록에서 사라진다.
  const lists = useSettingsLists();
  const tabs = useMemo(() => ['전체', ...(lists.data?.categories.map((c) => c.name) ?? [])], [lists.data]);
  const [cat, setCat] = useState(0);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recommended');
  const [sortOpen, setSortOpen] = useState(false);

  const selCat = tabs[cat] ?? '전체';

  const sorted = useMemo(() => {
    const byCat = cat === 0 ? items : items.filter((g) => (g.categoryName ?? '') === selCat);
    const byQuery = byCat.filter((g) => matches(g, query));
    const list = [...byQuery];
    switch (sort) {
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      case 'stockLow':
        return list.sort((a, b) => a.stockTotal - b.stockTotal);
      case 'priceHigh':
        // 산출 불가(null)는 맨 뒤로 — 0원으로 취급해 위로 올리면 잘못된 신호를 준다.
        return list.sort((a, b) => (b.basePrice ?? -1) - (a.basePrice ?? -1));
      default:
        return list.sort((a, b) => rank(a) - rank(b));
    }
  }, [items, cat, selCat, query, sort]);

  // 상단 배너는 이미 소진된 것만 크게 알린다. 소진 임박은 같은 core 판정으로 세어 부제로 설명한다.
  const outList = sorted.filter((g) => stockStateOf(g) === 'out');
  const lowCount = sorted.filter((g) => stockStateOf(g) === 'low').length;
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? '추천순';
  const isSearch = searching && query.trim() !== '';

  const closeSearch = () => { setSearching(false); setQuery(''); };

  return (
    <ScreenShell
      header={
        <HubHeader
          testID="ING-01/header"
          title="식재료"
          actions={
            <>
              <HubHeaderAction label="검색" icon="search" selected={searching} onPress={() => setSearching((v) => !v)} />
              <HubHeaderAction label="알림" icon="bell" dot onPress={() => router.push('/my/notifications')} />
            </>
          }
          below={searching ? <SearchBar value={query} onChange={setQuery} placeholder="식재료·카테고리·구매처 검색" onClose={closeSearch} /> : null}
        />
      }
    >
      <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3 }}>
        <ScrollTabs tabs={tabs} active={cat} onChange={setCat} />
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: space.sm }}>
        <SortChip label={sortLabel} onPress={() => setSortOpen(true)} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: LAYOUT.scroll.endWithFab, gap: space.sm }} showsVerticalScrollIndicator={false}>
        {outList.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              backgroundColor: COLOR.status.negativeTint,
              borderWidth: 1,
              borderColor: COLOR.status.negative,
              borderRadius: radius.md,
              paddingVertical: space.sm,
              paddingHorizontal: 12,
            }}
          >
            <Icon name="warn" size={16} color={COLOR.status.negative} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLOR.status.negative }} numberOfLines={1}>
                소진 {outList.length} — {outList.map((g) => g.name).join(', ')}
              </Text>
              {/* 소진 임박은 같은 줄에서 색을 달리해 이미 소진된 재료와 구분한다. */}
              {lowCount > 0 ? (
                <Text style={{ fontSize: 14, fontWeight: '600', color: COLOR.status.caution, marginTop: space.xs }}>
                  소진 임박 {lowCount}종은 슬슬 시켜 두세요
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
        {/* 로딩·오류·빈 상태를 뭉뚱그리지 않는다. 통신 실패를 빈 목록으로 그리면
            사장님이 "정말 없다"고 오해한다(가이드 §9.8). */}
        <QueryState
          isLoading={isLoading}
          error={error}
          isEmpty={sorted.length === 0}
          onRetry={() => void refetch()}
          emptyTitle={isSearch ? `'${query.trim()}' 검색 결과가 없어요` : '해당 카테고리의 식재료가 없어요'}
          emptyHint={isSearch ? '다른 이름이나 구매처로 찾아보세요' : '아래 버튼으로 식재료를 추가해 보세요'}
        >
          {sorted.map((g) => <IngCard key={g.id} g={g} onPress={() => router.push(`/ingredients/${g.id}`)} />)}
        </QueryState>
      </ScrollView>
      <FAB label="식재료 추가" onPress={() => router.push('/ingredients/add')} />

      <SortSheet visible={sortOpen} options={SORTS} value={sort} onSelect={setSort} onClose={() => setSortOpen(false)} />
    </ScreenShell>
  );
}
