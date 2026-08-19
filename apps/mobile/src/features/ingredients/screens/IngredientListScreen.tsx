// IngredientListScreen.tsx — ING-01 식재료 리스트
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenShell, ScrollTabs, Icon, FAB, SearchBar, SortChip, SortSheet, QueryState, type SortOption } from '../../../components/kit';
import { T } from '../../../theme/tokens';
import { useIngredientList, type IngredientRow } from '../hooks';
import { useSettingsLists } from '@/features/my/hooks';
import { IngCard, stockStateOf } from '../components/IngCard';

// 추천순: 소진 임박 → 부족 → 여유. 배지와 **같은 판정**을 쓴다.
const ORDER = { out: 0, low: 1, ok: 2 } as const;
const rank = (g: IngredientRow) => ORDER[stockStateOf(g)];

type SortKey = 'recommended' | 'name' | 'stockLow' | 'priceHigh';

const SORTS: readonly SortOption<SortKey>[] = [
  { key: 'recommended', label: '추천순', hint: '소진 임박 → 안전재고 미달 → 여유' },
  { key: 'stockLow', label: '잔여 적은 순', hint: '지금 남은 양이 적은 것부터' },
  { key: 'priceHigh', label: '단가 높은 순', hint: '기준단가(원/최소단위) 기준' },
  { key: 'name', label: '이름순', hint: '가나다순' },
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
  const insets = useSafeAreaInsets();
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

  // 상단 배너는 **지금 사야 하는 것**만 센다. '부족'까지 넣으면 배너가 늘 떠 있어
  // 아무도 안 본다. 부족은 목록에서 노란 배지로 이미 보인다.
  const soonList = sorted.filter((g) => stockStateOf(g) === 'out');
  const lowCount = sorted.filter((g) => stockStateOf(g) === 'low').length;
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? '추천순';
  const isSearch = searching && query.trim() !== '';

  const closeSearch = () => { setSearching(false); setQuery(''); };

  return (
    <ScreenShell
      header={
        <View style={{ paddingTop: insets.top, backgroundColor: T.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingTop: 6, paddingBottom: 12 }}>
            <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }}>식재료</Text>
            <Pressable
              onPress={() => setSearching((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="검색"
              accessibilityState={{ selected: searching }}
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="search" size={23} color={searching ? T.blue : T.ink2} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/my/notifications')}
              accessibilityRole="button"
              accessibilityLabel="알림"
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="bell" size={24} color={T.ink2} />
              <View style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: T.red, borderWidth: 1.5, borderColor: T.surface }} />
            </Pressable>
          </View>
          {searching ? (
            <SearchBar value={query} onChange={setQuery} placeholder="식재료·카테고리·구매처 검색" onClose={closeSearch} />
          ) : null}
        </View>
      }
    >
      <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3 }}>
        <ScrollTabs tabs={tabs} active={cat} onChange={setCat} />
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 }}>
        <SortChip label={sortLabel} onPress={() => setSortOpen(true)} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 104, gap: 10 }} showsVerticalScrollIndicator={false}>
        {soonList.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: T.redTint,
              borderWidth: 1,
              borderColor: T.red,
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 12,
            }}
          >
            <Icon name="warn" size={16} color={T.red} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.red }} numberOfLines={1}>
                소진 임박 {soonList.length} — {soonList.map((g) => g.name).join(', ')}
              </Text>
              {/* 부족은 급하지 않다. 같은 줄에서 색만 달리해 "오늘 살 것"과 구분한다. */}
              {lowCount > 0 ? (
                <Text style={{ fontSize: 14, fontWeight: '600', color: T.amberText, marginTop: 2 }}>
                  안전재고 미달 {lowCount}종은 슬슬 시켜 두세요
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
