/**
 * RCP-10 재료 검색 — 레시피에 담을 식재료 선택.
 *
 * ⚠ 한때 '반제품(메뉴)' 탭이 있었다. 다른 메뉴를 재료로 담는 기능인데,
 *   반제품은 1차 범위 밖이다(레시피 v3 §142 "구조만 예약").
 *   양념장처럼 만들어 쓰는 것도 1차에서는 그냥 식재료로 등록한다.
 *
 * 담으면 편집 초안(draftStore)에 들어가고 레시피 폼으로 돌아간다.
 * 같은 재료를 두 번 담으면 줄이 갈라지지 않고 사용량이 합쳐진다.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Badge, Button, Card, Field, Icon, Input, QueryState, SearchBar, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import {
  formatQuantity,
  formatUnitPrice,
  isNegativeStock,
  stockStateOf,
  STOCK_STATE_LABEL,
} from '@margincook/core';
import { T, won } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';
import { useIngredientList } from '@/features/ingredients/hooks';
import { dispUnit } from '@/features/ingredients/ledger';
import { useRecipeDraft, type DraftLine } from '../draftStore';

const NUM = { fontVariant: ['tabular-nums' as const] };
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();


export default function RecipeIngredientSearchScreen() {
  const { exclude } = useLocalSearchParams<{ exclude?: string }>();

  const ingredients = useIngredientList();
  const addLine = useRecipeDraft((s) => s.addLine);
  const draft = useRecipeDraft((s) => s.draft);

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

  const openQty = (line: DraftLine) => {
    setPending(line);
    // 이미 담긴 재료면 현재 사용량을 보여준다.
    const cur = draft.lines.find(
      (l) => line.ingredientId !== null && l.ingredientId === line.ingredientId,
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

      <SearchBar value={query} onChange={setQuery} placeholder="식재료 이름으로 검색" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}>
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
                          {/*
                            ⚠ 재고 상태를 여기서도 보여 준다(0108). 예전엔 회색 문장 한 줄뿐이라
                              소진된 재료인지 모른 채 레시피에 담았다.
                          */}
                          {stockStateOf(g) !== 'ok' ? (
                            <Badge tone="red" solid sm>{STOCK_STATE_LABEL[stockStateOf(g)].label}</Badge>
                          ) : null}
                        </View>
                        <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 6, fontWeight: '600' }, NUM]}>
                          {g.basePrice === null ? '단가 산출 전' : `기준 단가 ${formatUnitPrice(g.basePrice, unit)}`}
                          {'  ·  '}재고{' '}
                          <Text style={{ color: isNegativeStock(g.stockTotal) ? T.red : T.sub2, fontWeight: '800' }}>
                            {formatQuantity(g.stockTotal, unit)}
                          </Text>
                        </Text>
                      </View>
                      <Icon name="plus" size={20} color={T.blue} sw={2.2} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </QueryState>
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
