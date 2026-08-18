/**
 * RCP-10 재료 검색 — 레시피에 담을 식재료·반제품 선택.
 *
 * 담으면 편집 초안(draftStore)에 들어가고 레시피 폼으로 돌아간다.
 * 같은 재료를 두 번 담으면 줄이 갈라지지 않고 사용량이 합쳐진다.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Badge, Button, Card, Field, Icon, Input, QueryState, SearchBar, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatQuantity, formatUnitPrice } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';
import { useIngredientList } from '@/features/ingredients/hooks';
import { dispUnit } from '@/features/ingredients/ledger';
import { useRecipePickList } from '../hooks';
import { useRecipeDraft, type DraftLine } from '../draftStore';

const NUM = { fontVariant: ['tabular-nums' as const] };
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

type Tab = 'ingredient' | 'subRecipe';

export default function RecipeIngredientSearchScreen() {
  const { exclude } = useLocalSearchParams<{ exclude?: string }>();

  const ingredients = useIngredientList();
  const recipes = useRecipePickList(exclude);
  const addLine = useRecipeDraft((s) => s.addLine);
  const draft = useRecipeDraft((s) => s.draft);

  const [tab, setTab] = useState<Tab>('ingredient');
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<DraftLine | null>(null);
  const [qty, setQty] = useState('');

  const servings = Math.max(1, Number(draft.baseServings) || 1);

  const ingList = useMemo(() => {
    const n = squash(query);
    return (ingredients.data ?? []).filter(
      (g) => n === '' || squash(g.name).includes(n) || squash(g.categoryName ?? '').includes(n),
    );
  }, [ingredients.data, query]);

  const recList = useMemo(() => {
    const n = squash(query);
    return (recipes.data ?? []).filter((r) => n === '' || squash(r.name).includes(n));
  }, [recipes.data, query]);

  const openQty = (line: DraftLine) => {
    setPending(line);
    // 이미 담긴 재료면 현재 사용량을 보여준다.
    const cur = draft.lines.find(
      (l) => (line.ingredientId && l.ingredientId === line.ingredientId) || (line.subRecipeId && l.subRecipeId === line.subRecipeId),
    );
    setQty(cur ? String(cur.inputQty) : '');
  };

  const confirm = () => {
    if (!pending) return;
    const v = Number(qty.replace(/,/g, ''));
    if (!Number.isFinite(v) || v <= 0) return;
    addLine({ ...pending, inputQty: v });
    setPending(null);
    safeBack('/recipes/add');
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="재료 검색" onBack={() => safeBack('/recipes/add')} />

      <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3 }}>
        <View style={{ flexDirection: 'row', gap: 22, paddingHorizontal: 20 }}>
          {([['ingredient', '식재료'], ['subRecipe', '반제품(메뉴)']] as const).map(([k, label]) => {
            const on = tab === k;
            return (
              <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on }} style={{ paddingTop: 10, paddingBottom: 11 }}>
                <Text style={{ fontSize: 16, fontWeight: on ? '700' : '600', color: on ? T.ink : T.ter }}>{label}</Text>
                {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2.5, backgroundColor: T.ink, borderRadius: 2 }} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <SearchBar value={query} onChange={setQuery} placeholder={tab === 'ingredient' ? '식재료 이름으로 검색' : '메뉴 이름으로 검색'} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}>
        {tab === 'ingredient' ? (
          <QueryState
            isLoading={ingredients.isLoading}
            error={ingredients.error}
            isEmpty={ingList.length === 0}
            onRetry={() => void ingredients.refetch()}
            emptyTitle={query ? `'${query}' 검색 결과가 없어요` : '등록된 식재료가 없어요'}
            emptyHint="식재료 탭에서 먼저 등록해 주세요"
          >
            {ingList.map((g) => {
              const unit = dispUnit(g.baseUnit);
              const already = draft.lines.some((l) => l.ingredientId === g.id);
              return (
                <Pressable
                  key={g.id}
                  onPress={() => openQty({ ingredientId: g.id, subRecipeId: null, name: g.name, unit, inputQty: 0, unitPrice: g.basePrice })}
                  accessibilityRole="button" accessibilityLabel={`${g.name} 담기`}
                >
                  <Card pad={0} style={{ overflow: 'hidden' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, paddingHorizontal: 15 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: T.ink }} numberOfLines={1}>{g.name}</Text>
                          {g.categoryName ? <Badge tone="neutral" sm>{g.categoryName}</Badge> : null}
                          {already ? <Badge tone="blue" sm>담김</Badge> : null}
                        </View>
                        <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 6, fontWeight: '600' }, NUM]}>
                          {g.basePrice === null ? '단가 산출 전' : `기준 단가 ${formatUnitPrice(g.basePrice, unit)}`}
                          {'  ·  '}재고 {formatQuantity(g.stockTotal, unit)}
                        </Text>
                      </View>
                      <Icon name="plus" size={20} color={T.blue} sw={2.2} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </QueryState>
        ) : (
          <QueryState
            isLoading={recipes.isLoading}
            error={recipes.error}
            isEmpty={recList.length === 0}
            onRetry={() => void recipes.refetch()}
            emptyTitle={query ? `'${query}' 검색 결과가 없어요` : '담을 수 있는 메뉴가 없어요'}
            emptyHint="양념장처럼 다른 메뉴에 들어가는 반제품을 먼저 만들어 주세요"
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: T.blueTint }}>
              <Icon name="info" size={15} color={T.blue} />
              <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: 20 }}>
                다른 메뉴를 재료로 담으면 그 메뉴의 1인분 원가가 그대로 반영돼요(반제품).
              </Text>
            </View>
            {recList.map((r) => {
              const already = draft.lines.some((l) => l.subRecipeId === r.id);
              return (
                <Pressable
                  key={r.id}
                  onPress={() => openQty({ ingredientId: null, subRecipeId: r.id, name: r.name, unit: null, inputQty: 0, unitPrice: r.unitCost })}
                  accessibilityRole="button" accessibilityLabel={`${r.name} 담기`}
                >
                  <Card pad={0} style={{ overflow: 'hidden', opacity: r.active ? 1 : 0.6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, paddingHorizontal: 15 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: T.ink }} numberOfLines={1}>{r.name}</Text>
                          {!r.active ? <Badge tone="neutral" sm>판매중지</Badge> : null}
                          {already ? <Badge tone="blue" sm>담김</Badge> : null}
                        </View>
                        <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 6, fontWeight: '600' }, NUM]}>
                          1인분 원가 {won(Math.round(r.unitCost))}원 · 기준 {r.baseServings}인분
                        </Text>
                      </View>
                      <Icon name="plus" size={20} color={T.blue} sw={2.2} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </QueryState>
        )}
      </ScrollView>

      {/* 사용량 입력 */}
      <Sheet
        visible={pending !== null}
        onClose={() => setPending(null)}
        title="사용량 입력"
        sub={pending ? `${pending.name} · ${servings}인분 전체 양` : undefined}
        height={360}
      >
        {pending ? (
          <View>
            <Field label={`${servings}인분 사용량`} req hint="1인분 양이 아니라 한 번에 만드는 전체 양이에요">
              <Input
                value={qty}
                onChangeText={(t) => setQty(clampDecimals(t, 2))}
                placeholder="0"
                suffix={pending.unit ?? '인분'}
                mono
                keyboardType="decimal-pad"
                accessibilityLabel="사용량"
                returnKeyType="done"
                onSubmitEditing={confirm}
              />
            </Field>
            <Text style={[{ fontSize: 14, color: T.sub2, marginTop: -8, marginBottom: 12 }, NUM]}>
              {pending.unitPrice === null
                ? '단가가 아직 없어 원가에는 반영되지 않아요'
                : `1인분 ${pending.unit === null
                    ? `${(Number(qty) || 0) / servings}인분`
                    : formatQuantity((Number(qty) || 0) / servings, pending.unit)} · ${won(Math.round(((Number(qty) || 0) / servings) * pending.unitPrice))}원`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 9 }}>
              <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={() => setPending(null)}>취소</Button></View>
              <View style={{ flex: 2 }}>
                <Button kind="primary" size="lg" full disabled={!(Number(qty) > 0)} onPress={confirm}>담기</Button>
              </View>
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
