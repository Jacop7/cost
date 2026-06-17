/**
 * RCP-01 레시피 리스트 (② 4.1) — 프로토타입을 kit 컴포넌트로 RN 이식.
 * 카드: 메뉴명 · 판매가 · 재료 원가율 · 순이익(원·%) · 상태(정상/▼목표 미달) · 미달 시 권장가.
 * 정렬 기본 '순이익률 낮은순'(돈 안 되는 메뉴가 위로) · 검색 · 판매 상태 필터(중지 흐리게).
 * 손익은 @sikjae/core computeProfit 미리보기, 확정값은 E3 RPC(향후).
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, Chip, FAB, Icon, Sheet } from '@/components/kit';
import { T, won } from '@/theme/tokens';
import { DEMO_RECIPES, pct, RecipeCardData, recipeProfit } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };

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

function RecipeCard({ r }: { r: RecipeCardData }) {
  const p = recipeProfit(r);
  const stopped = r.status === 'stopped';
  const warn = !stopped && p.belowTarget;

  return (
    <Card pad={0} style={{ overflow: 'hidden', opacity: stopped ? 0.6 : 1 }}>
      <View style={{ paddingVertical: 13, paddingHorizontal: 15 }}>
        {/* 상태 뱃지 + 메뉴명 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          {stopped ? (
            <Badge tone="neutral" sm solid>판매중지</Badge>
          ) : warn ? (
            <Badge tone="red" sm solid>▼ 목표 미달</Badge>
          ) : (
            <Badge tone="green" sm solid>목표 달성</Badge>
          )}
          <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{r.name}</Text>
        </View>

        {/* 판매가 */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 10 }}>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: T.sub }}>판매가 </Text>
          <Text style={[{ fontSize: 15, fontWeight: '700', color: T.sub2 }, NUM]}>{won(r.price)}원</Text>
        </View>

        {/* 순이익(원·%) · 재료 원가율(원·%) */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 6 }}>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: T.sub }}>순이익 </Text>
          <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>{won(p.profit)}원 </Text>
          <Text style={[{ fontSize: 13.5, fontWeight: '700', color: T.ink }, NUM]}>{pct(p.profitRate)}%</Text>
          <Text style={{ fontSize: 13, color: T.ter, marginHorizontal: 7 }}>·</Text>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: T.sub }}>재료비 </Text>
          <Text style={[{ fontSize: 15, fontWeight: '700', color: T.sub2 }, NUM]}>{won(r.materialPerServing)}원 </Text>
          <Text style={[{ fontSize: 13.5, fontWeight: '600', color: T.sub2 }, NUM]}>{pct(p.materialRate)}%</Text>
        </View>

        {/* 목표 미달 → 권장가 힌트 */}
        {warn && p.recommended != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9, backgroundColor: T.line2, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 11 }}>
            <Icon name="up" size={15} color={T.ink} sw={2.2} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: T.sub }}>
              목표 판매가 <Text style={[{ fontWeight: '800', color: T.ink }, NUM]}>{won(p.recommended)}원 {pct(r.target)}%</Text>
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

export default function RecipesListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [sort, setSort] = useState<SortKey>('rateLow');
  const [sortOpen, setSortOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusKey>('all');
  const [statusOpen, setStatusOpen] = useState(false);
  const [targetFilter, setTargetFilter] = useState<TargetKey>('all');
  const [targetOpen, setTargetOpen] = useState(false);

  // 판매 상태 + 목표 필터.
  const filtered = DEMO_RECIPES.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (targetFilter !== 'all' && recipeProfit(r).belowTarget !== (targetFilter === 'below')) return false;
    return true;
  });
  const statusLabel = statusFilter === 'all' ? '판매상태' : STATUS_OPTS.find((s) => s.key === statusFilter)!.label;
  const targetLabel = targetFilter === 'all' ? '목표' : TARGET_OPTS.find((s) => s.key === targetFilter)!.label;

  // 정렬 — 중지 메뉴는 항상 아래로.
  const rate = (r: RecipeCardData) => recipeProfit(r).profitRate;
  const sorted = [...filtered].sort((a, b) => {
    if ((a.status === 'stopped') !== (b.status === 'stopped')) return a.status === 'stopped' ? 1 : -1;
    switch (sort) {
      case 'rateHigh':
        return rate(b) - rate(a);
      case 'priceHigh':
        return b.price - a.price;
      case 'priceLow':
        return a.price - b.price;
      default:
        return rate(a) - rate(b);
    }
  });
  const sortLabel = SORTS.find((s) => s.key === sort)!.label;

  // 목표 미달(판매중) 메뉴 요약.
  const belowList = DEMO_RECIPES.filter((r) => r.status === 'selling' && recipeProfit(r).belowTarget);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* 헤더 — 타이틀(좌) + 검색 아이콘(우) */}
      <View style={{ paddingTop: insets.top, backgroundColor: T.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingTop: 6, paddingBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 24, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }}>레시피</Text>
          <Pressable style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="search" size={23} color={T.ink2} />
          </Pressable>
        </View>
      </View>

      {/* 헤더-필터 구분선 */}
      <View style={{ height: 1, backgroundColor: '#D1D6DB' }} />

      {/* 필터 행 — 정렬 + 판매상태 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', gap: 8 }}>
        <Chip active tone="blue" onPress={() => setSortOpen(true)}>{`${sortLabel} ▾`}</Chip>
        <Chip active={statusFilter !== 'all'} tone="blue" onPress={() => setStatusOpen(true)}>{`${statusLabel} ▾`}</Chip>
        <Chip active={targetFilter !== 'all'} tone="blue" onPress={() => setTargetOpen(true)}>{`${targetLabel} ▾`}</Chip>
      </View>

      {/* 카드 리스트 */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 104, gap: 10, flexGrow: 1 }}>
        {sorted.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
            <Text style={{ fontSize: 15, color: T.ter }}>등록된 메뉴가 없습니다.</Text>
          </View>
        ) : (
          <>
            {belowList.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.redTint, borderWidth: 1, borderColor: T.red, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 }}>
                <Icon name="warn" size={16} color={T.red} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.red }} numberOfLines={1}>
                  목표 미달 {belowList.length} — {belowList.map((r) => r.name).join(', ')}
                </Text>
              </View>
            ) : null}
            {sorted.map((r) => (
              <Pressable key={r.id} onPress={() => router.push(`/recipes/${r.id}` as Href)}>
                <RecipeCard r={r} />
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      <FAB label="추가" bottom={24} onPress={() => router.push('/recipes/add' as Href)} />

      {/* 정렬 선택 시트 */}
      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="정렬" height={320}>
        {SORTS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => { setSort(s.key); setSortOpen(false); }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: T.line2 }}
          >
            <Text style={{ flex: 1, fontSize: 16, fontWeight: sort === s.key ? '700' : '500', color: sort === s.key ? T.blue : T.ink }}>{s.label}</Text>
            {sort === s.key ? <Icon name="check" size={20} color={T.blue} /> : null}
          </Pressable>
        ))}
      </Sheet>

      {/* 판매 상태 선택 시트 */}
      <Sheet visible={statusOpen} onClose={() => setStatusOpen(false)} title="판매 상태" height={300}>
        {STATUS_OPTS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => { setStatusFilter(s.key); setStatusOpen(false); }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: T.line2 }}
          >
            <Text style={{ flex: 1, fontSize: 16, fontWeight: statusFilter === s.key ? '700' : '500', color: statusFilter === s.key ? T.blue : T.ink }}>{s.label}</Text>
            {statusFilter === s.key ? <Icon name="check" size={20} color={T.blue} /> : null}
          </Pressable>
        ))}
      </Sheet>

      {/* 목표 선택 시트 */}
      <Sheet visible={targetOpen} onClose={() => setTargetOpen(false)} title="목표" height={300}>
        {TARGET_OPTS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => { setTargetFilter(s.key); setTargetOpen(false); }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: T.line2 }}
          >
            <Text style={{ flex: 1, fontSize: 16, fontWeight: targetFilter === s.key ? '700' : '500', color: targetFilter === s.key ? T.blue : T.ink }}>{s.label}</Text>
            {targetFilter === s.key ? <Icon name="check" size={20} color={T.blue} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}
