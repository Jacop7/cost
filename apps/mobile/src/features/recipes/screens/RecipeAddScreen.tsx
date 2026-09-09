/**
 * RCP-03 레시피 추가 / RCP-04 수정 — 같은 폼이다(`?id=` 유무로 갈린다).
 *
 * 손익 미리보기는 `@margincook/core` 공식으로 즉시 계산하고, **확정값은 저장 시 서버**가 낸다.
 * 두 공식이 어긋나면 저장 전후 숫자가 달라지므로 core 와 SQL 의 식이 같아야 한다(절대원칙 3).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Badge, Button, Card, Field, Icon, Input, QueryState, ScrollTabs, Select, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatPercent, formatQuantity, formatUnitPrice, recommendedPrice, round, taxAmount, taxRate } from '@margincook/core';
import { LAYOUT, COLOR, T, won, TYPE, radius, space } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';
import { useSettingsLists } from '@/features/master-data/hooks';
import { useStoreSettings } from '@/features/settings/hooks';
import { useRecipeDetail, useSaveRecipe } from '../hooks';
import { emptyDraft, useRecipeDraft, type DraftLine } from '../draftStore';
import { SelectionRow } from '@/components/kit/SelectionRow';
import { ResultField } from '@/components/kit/ResultField';

const NUM = { fontVariant: ['tabular-nums' as const] };

const num = (s: string) => {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

function SecHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.md, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>{title}</Text>
      {sub ? <Text style={{ maxWidth: '100%', fontSize: 14, color: COLOR.text.tertiary, fontWeight: '600' }}>{sub}</Text> : null}
      {right ? (<><View style={{ flex: 1 }} />{right}</>) : null}
    </View>
  );
}

// The card owns the outer shape. The shared Button owns type, color, icon,
// pressed/disabled behavior and touch sizing; no second button system here.
function AddFooter({ children, onPress }: { children: string; onPress: () => void }) {
  return <Button kind="tint" full icon="plus" onPress={onPress}
    accessibilityLabel={children} style={{ borderRadius: 0 }}>{children}</Button>;
}

export default function RecipeAddScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const detail = useRecipeDetail(id);
  const lists = useSettingsLists();
  const save = useSaveRecipe();

  const draft = useRecipeDraft((s) => s.draft);
  const reset = useRecipeDraft((s) => s.reset);
  const patch = useRecipeDraft((s) => s.patch);
  const updateLine = useRecipeDraft((s) => s.updateLine);
  const removeLine = useRecipeDraft((s) => s.removeLine);
  const updateExtra = useRecipeDraft((s) => s.updateExtra);
  const addTaxItem = useRecipeDraft((s) => s.addTaxItem);
  const updateTaxItem = useRecipeDraft((s) => s.updateTaxItem);
  const removeTaxItem = useRecipeDraft((s) => s.removeTaxItem);
  const removeExtra = useRecipeDraft((s) => s.removeExtra);

  const [costMode, setCostMode] = useState<'batch' | 'one'>('one');
  const [plMode, setPlMode] = useState<'batch' | 'one'>('one');
  const [catOpen, setCatOpen] = useState(false);
  const settings = useStoreSettings();   // 세금은 매장이 정한다(0087)
  const [qtyEdit, setQtyEdit] = useState<number | null>(null);
  const [qtyDraft, setQtyDraft] = useState('');
  const [extraEdit, setExtraEdit] = useState<number | null>(null);
  const [extraQtyDraft, setExtraQtyDraft] = useState('');

  // 진입 시 초안 준비. 수정이면 서버 값으로, 추가면 빈 값으로 한 번만 채운다.
  const d = detail.data;
  useEffect(() => {
    if (id) {
      if (!d || draft.loaded === true && draft.id === id) return;
      reset({
        id: d.id,
        name: d.name,
        categoryId: d.categoryId,
        categoryName: '',
        price: String(d.price),
        memo: d.memo ?? '',
        taxMode: d.taxMode,
        taxItems: d.taxItems.map((t) => ({ name: t.name, rate: String(t.rate) })),
        baseServings: String(d.baseServings),
        avgMonthlySales: d.avgMonthlySales === null ? '' : String(d.avgMonthlySales),
        targetProfitRate: String(d.targetProfitRate),
        lines: d.lines.map((l) => ({
          ingredientId: l.ingredientId,
          subRecipeId: l.subRecipeId,
          name: l.name,
          unit: l.baseUnit === null ? null : l.baseUnit === 'ea' ? '개' : l.baseUnit,
          inputQty: l.inputQty,
          unitPrice: l.unitPrice,
        })),
        extras: d.extras.map((e) => ({ materialId: e.materialId, name: e.name, amount: e.amount, qty: e.qty })),
        loaded: true,
      });
    } else if (draft.loaded === false && draft.id !== undefined) {
      reset(emptyDraft());
    } else if (draft.id !== undefined) {
      // 수정하다 '추가'로 들어온 경우 — 남은 초안을 비운다.
      reset(emptyDraft());
    }
  }, [id, d, draft.loaded, draft.id, reset]);

  const catLabel = useMemo(() => {
    if (draft.categoryName) return draft.categoryName;
    return lists.data?.recipeCategories.find((c) => c.id === draft.categoryId)?.name ?? '';
  }, [draft.categoryName, draft.categoryId, lists.data]);

  const servings = Math.max(1, Math.round(num(draft.baseServings) || 1));
  const price = num(draft.price);
  const target = num(draft.targetProfitRate) / 100;

  /** 1인분 재료비 — 단가가 없는 줄은 0 이 아니라 **계산 불가**로 다룬다. */
  const lineCost = (l: DraftLine) => (l.unitPrice === null ? null : (l.inputQty / servings) * l.unitPrice);
  const material = draft.lines.reduce((s, l) => s + (lineCost(l) ?? 0), 0);
  const unknownLines = draft.lines.filter((l) => l.unitPrice === null).length;
  const extra = draft.extras.reduce((s, e) => s + e.amount * e.qty, 0);
  const fixedRate = d?.fixedRate ?? 0;
  /** 요율이 숫자로 읽히는 항목만 계산에 넣는다 — 서버 `tax_of()` 의 `where rate > 0` 과 같다. */
  /*
   * ⚠ 세금은 **매장 설정**에서 읽는다(0087). 초안에 담아 두면 새 메뉴에서 0원으로
   *   보이다가 저장 후 서버가 매장 값을 얹어 숫자가 달라진다.
   *   고치는 곳은 MY > 세금 한 곳뿐이다.
   */
  const taxItems = settings.data?.taxItems ?? [];
  const tax = round(taxAmount(price, taxItems));
  const fixed = round(fixedRate * price);
  const profit = price - tax - material - fixed - extra;
  const profitRate = price > 0 ? profit / price : 0;
  const warn = profitRate < target;
  const PROFIT = warn ? COLOR.status.negative : COLOR.status.positive;
  // 권장가 분모에도 세금 항목이 들어간다 — 빼면 카드 수수료만큼 낮게 나온다.
  const recRaw = recommendedPrice(material + extra, fixedRate, target, taxRate(taxItems));
  const recommended = recRaw == null ? null : Math.round(recRaw / 100) * 100;

  const cm = costMode === 'batch' ? servings : 1;
  const m = plMode === 'batch' ? servings : 1;
  const wm = (v: number) => `${won(Math.round(v * m))}원`;
  const p = (v: number) => (price > 0 ? formatPercent(v / price) : '0.0%');

  const nameError = draft.name.trim() === '' ? '메뉴 이름을 입력해 주세요' : undefined;
  const priceError = price < 0 ? '판매가는 0 이상이어야 해요' : undefined;
  const categoryReady = Boolean(lists.data?.recipeCategories.some(c => c.id === draft.categoryId));
  const numericReady = [draft.price || '0', draft.baseServings, draft.targetProfitRate]
    .every(value => value.trim() !== '' && Number.isFinite(Number(value.replace(/,/g, ''))));
  const canSave = !nameError && !priceError && categoryReady && numericReady
    && num(draft.baseServings) >= 1 && !save.isPending;

  const onSave = () => {
    if (!canSave) return;
    save.mutate(
      {
        id: draft.id,
        name: draft.name.trim(),
        price,
        memo: draft.memo.trim() || null,
        baseServings: servings,
        targetProfitRate: num(draft.targetProfitRate),
        categoryId: draft.categoryId,
        lines: draft.lines.map((l) => ({
          ingredientId: l.ingredientId,
          subRecipeId: l.subRecipeId,
          inputQty: l.inputQty,
        })),
        extras: draft.extras.map((e) => ({
          materialId: e.materialId,
          name: e.name,
          amount: e.amount,
          qty: e.qty,
        })),
      },
      {
        onSuccess: (savedId) => {
          reset(emptyDraft());
          if (draft.id) safeBack(`/recipes/${savedId}`);
          else router.replace(`/recipes/${savedId}` as Href);
        },
        onError: (e) => Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  const openQty = (i: number) => {
    setQtyEdit(i);
    setQtyDraft(String(draft.lines[i]?.inputQty ?? 0));
  };
  const applyQty = () => {
    if (qtyEdit === null || num(qtyDraft) <= 0) return;
    updateLine(qtyEdit, { inputQty: Math.max(0, num(qtyDraft)) });
    setQtyEdit(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={id ? '레시피 수정' : '레시피 추가'} onBack={() => safeBack('/recipes')} />

      <QueryState
        isLoading={Boolean(id) && detail.isLoading}
        error={detail.error}
        isEmpty={Boolean(id) && detail.isFetched && !d}
        onRetry={() => void detail.refetch()}
        emptyTitle="메뉴를 찾을 수 없어요"
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.xl }}>
          {/* 기본 정보 */}
          <View>
            <Field label="메뉴명" req variant="stacked" error={draft.name !== '' ? nameError : undefined}>
              <Input variant="stacked" value={draft.name} onChangeText={(t) => patch({ name: t })} placeholder="메뉴명을 입력하세요" error={draft.name !== '' && Boolean(nameError)} accessibilityLabel="메뉴명" />
            </Field>
            <Field label="카테고리" req variant="stacked">
              <Select variant="stacked" value={catLabel} placeholder="카테고리 선택" accessibilityLabel={`카테고리 선택: ${catLabel || '선택 안 됨'}`} expanded={catOpen} onPress={() => setCatOpen(true)} />
            </Field>
            <Field label="판매가" req variant="stacked" error={draft.price !== '' ? priceError : undefined}>
              <Input value={draft.price} onChangeText={(t) => patch({ price: clampDecimals(t, 0) })} placeholder="0" suffix="원" mono variant="stacked" keyboardType="number-pad" accessibilityLabel="판매가" />
            </Field>
            <Field label="기준 인분" req variant="stacked">
              <Input value={draft.baseServings} onChangeText={(t) => patch({ baseServings: clampDecimals(t, 0) })} placeholder="10" suffix="인분" mono variant="stacked" keyboardType="number-pad" accessibilityLabel="기준 인분" />
            </Field>
            <Field label="목표 순이익률" req variant="stacked">
              <Input value={draft.targetProfitRate} onChangeText={(t) => patch({ targetProfitRate: clampDecimals(t, 1) })} placeholder="40" suffix="%" mono variant="stacked" keyboardType="decimal-pad" accessibilityLabel="목표 순이익률" />
            </Field>
          </View>

          {/* 재료 */}
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <SecHead title="재료" sub={`${draft.lines.length}개`} />
            <View style={{ paddingTop: space.md, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.line }}>
              <ScrollTabs tabs={[`${servings}인분`, '1인분']} active={costMode === 'batch' ? 0 : 1} onChange={i => setCostMode(i === 0 ? 'batch' : 'one')} />
            </View>
            <View style={{ paddingHorizontal: space.md, paddingTop: 4, paddingBottom: space.md }}>
              {draft.lines.length === 0 ? (
                <Text style={{ fontSize: 16, color: COLOR.text.tertiary, paddingVertical: space.md }}>등록된 식재료가 없습니다.</Text>
              ) : (
                draft.lines.map((l, i) => {
                  const cost = lineCost(l);
                  return (
                    <Pressable key={`${l.ingredientId ?? l.subRecipeId}-${i}`} onPress={() => openQty(i)} accessibilityRole="button" accessibilityLabel={`${l.name} 사용량 수정`}
                      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 76, gap: space.sm, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>
                          {l.name}
                        </Text>
                        <Text style={[{ fontSize: 14, color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>
                          {l.unitPrice === null ? '단가 산출 전' : l.unit === null ? `${won(Math.round(l.unitPrice))}원/인분` : formatUnitPrice(l.unitPrice, l.unit)}
                        </Text>
                      </View>
                      <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>
                        <Text style={[{ fontSize: 16, fontWeight: '800', color: cost === null ? COLOR.text.tertiary : T.ink }, NUM]}>
                          {cost === null ? '—' : `${won(Math.round(cost * cm))}원`}
                        </Text>
                        <Text style={[{ fontSize: 14, color: COLOR.text.tertiary, marginTop: space.xs, fontWeight: '700', textAlign: 'right' }, NUM]}>
                          {l.unit === null ? `${(l.inputQty / servings) * cm}인분` : formatQuantity((l.inputQty / servings) * cm, l.unit)}
                          {' / '}{cost === null ? '—' : p(cost)}
                        </Text>
                      </View>
                      <Icon name="chevron" size={16} color={COLOR.text.tertiary} />
                    </Pressable>
                  );
                })
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.line }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>재료비 소계</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round(material * cm))}원</Text>
                  <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: space.xs }, NUM]}>{p(material)}</Text>
                </View>
              </View>
              {unknownLines > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: space.sm, paddingVertical: space.sm, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: COLOR.status.cautionTint }}>
                  <Icon name="info" size={15} color={COLOR.status.caution} />
                  <Text style={{ flex: 1, fontSize: 14, color: COLOR.status.caution, lineHeight: TYPE.caption.lineHeight }}>
                    단가가 없는 재료 {unknownLines}개는 원가에서 빠져 있어요. 재고 추가나 입고를 등록하면 원가에 들어가요.
                  </Text>
                </View>
              ) : null}
            </View>
            <AddFooter onPress={() => router.push(`/recipes/ingredient-search${draft.id ? `?exclude=${draft.id}` : ''}` as Href)}>식재료 추가</AddFooter>
          </Card>

          <View style={{ height: space.sm }} />

          {/* 부자재 */}
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <SecHead title="부자재" sub="해당 메뉴 전용 비용" />
            <View style={{ paddingHorizontal: space.md, paddingTop: 4, paddingBottom: space.md }}>
              {draft.extras.length === 0 ? (
                <Text style={{ fontSize: 16, color: COLOR.text.tertiary, paddingVertical: space.md }}>등록된 부자재가 없습니다.</Text>
              ) : (
                draft.extras.map((e, i) => (
                  <Pressable key={`${e.materialId ?? e.name}-${i}`} onPress={() => { setExtraEdit(i); setExtraQtyDraft(String(e.qty)); }}
                    accessibilityRole="button" accessibilityLabel={`${e.name} 부자재 사용량 수정`}
                    style={{ flexDirection: 'row', alignItems: 'center', minHeight: 76, gap: space.sm, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>{e.name}</Text>
                      <Text style={[{ fontSize: 14, color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>{won(e.amount)}원 × {e.qty}개</Text>
                    </View>
                    <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>
                      <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round(e.amount * e.qty))}원</Text>
                      <Text style={[{ fontSize: 14, fontWeight: '700', color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>{p(e.amount * e.qty)}</Text>
                    </View>
                    <Icon name="chevron" size={16} color={COLOR.text.tertiary} />
                  </Pressable>
                ))
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: T.line }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>부자재비 소계</Text>
                <View style={{ alignItems: 'flex-end', maxWidth: '100%' }}>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round(extra))}원</Text>
                  <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: space.xs }, NUM]}>{p(extra)}</Text>
                </View>
              </View>
            </View>
            <AddFooter onPress={() => router.push('/recipes/material-search' as Href)}>부자재 추가</AddFooter>
          </Card>

          <View style={{ height: space.sm }} />

          {/* 손익 미리보기 */}
          <Card onLine pad={0} style={{ overflow: 'hidden' }}>
            <SecHead title="판매 손익" />
            <View style={{ paddingTop: space.md, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.line }}>
              <ScrollTabs tabs={[`${servings}인분`, '1인분']} active={plMode === 'batch' ? 0 : 1} onChange={i => setPlMode(i === 0 ? 'batch' : 'one')} />
            </View>
            <View style={{ paddingHorizontal: space.md, paddingTop: 4, paddingBottom: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: T.line }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>판매가</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{wm(price)}</Text>
                  <Text style={[{ fontSize: 14, fontWeight: '600', color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>{price > 0 ? '100%' : '0%'}</Text>
                </View>
              </View>
              {[
                { label: '재료 원가', amt: material },
                { label: '고정 지출', amt: fixed },
                ...(extra > 0 ? [{ label: '부자재', amt: extra }] : []),
                ...(tax > 0 ? [{ label: '세금', amt: tax }] : []),
              ].map((c) => (
                <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>
                    <Text style={{ color: COLOR.text.tertiary }}>(−) </Text>{c.label}
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[{ fontSize: 16, fontWeight: '700', color: COLOR.text.tertiary }, NUM]}>{wm(c.amt)}</Text>
                    <Text style={[{ fontSize: 14, fontWeight: '600', color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>{p(c.amt)}</Text>
                  </View>
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>순이익</Text>
                <View style={{ marginLeft: space.sm }}>{warn ? <Badge tone="red" sm solid>목표 미달</Badge> : <Badge tone="green" sm solid>목표 달성</Badge>}</View>
                <View style={{ flex: 1 }} />
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: PROFIT }, NUM]}>{wm(profit)}</Text>
                  <Text style={[{ fontSize: 14, fontWeight: '800', color: PROFIT, marginTop: space.xs }, NUM]}>{formatPercent(profitRate)}</Text>
                </View>
              </View>
              {warn && recommended != null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: T.line }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink2 }}>권장 판매가</Text>
                    <Text style={{ fontSize: 14, color: COLOR.text.tertiary, marginTop: 1 }}>목표 {draft.targetProfitRate}% 기준</Text>
                  </View>
                  <Pressable onPress={() => patch({ price: String(recommended) })} hitSlop={{ top: 7 }} accessibilityRole="button" accessibilityLabel="권장 판매가 적용" style={{ alignItems: 'flex-end' }}>
                    <Text style={[{ fontSize: 16, fontWeight: '800', color: COLOR.text.accent }, NUM]}>{won(recommended)}원</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: COLOR.text.link, marginTop: space.xs }}>적용하기</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </Card>
        </ScrollView>
      </QueryState>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: LAYOUT.scroll.end, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full disabled={!canSave} loading={save.isPending} onPress={onSave}>
          {id ? '저장' : '레시피 추가'}
        </Button>
      </View>

      {/* 카테고리 */}
      <Sheet visible={catOpen} onClose={() => setCatOpen(false)} title="카테고리 선택">
          {(lists.data?.recipeCategories ?? []).map((c, i, categories) => {
            const on = draft.categoryId === c.id;
            return (
              <SelectionRow
                key={c.id} label={c.name} selected={on} last={i === categories.length - 1}
                onPress={() => { patch({ categoryId: c.id, categoryName: c.name }); setCatOpen(false); }}
              />
            );
          })}
      </Sheet>

      {/* 사용량 수정 */}
      <Sheet
        visible={qtyEdit !== null}
        onClose={() => setQtyEdit(null)}
        title="사용량 수정"
      >
        {qtyEdit !== null ? (
          <View>
            <Field label={`${servings}인분 사용량`} req variant="stacked">
              <Input
                value={qtyDraft}
                onChangeText={(t) => setQtyDraft(clampDecimals(t, 2))}
                suffix={draft.lines[qtyEdit]?.unit ?? '인분'}
                mono variant="stacked"
                keyboardType="decimal-pad"
                accessibilityLabel="사용량"
              />
            </Field>
            <ResultField label={`${servings}인분 비용`} value={draft.lines[qtyEdit]?.unitPrice == null ? '단가 산출 전' : `${won(Math.round(num(qtyDraft) * draft.lines[qtyEdit]!.unitPrice!))}원`} />
            <ResultField label="1인분 비용" value={draft.lines[qtyEdit]?.unitPrice == null ? '단가 산출 전' : `${won(Math.round(num(qtyDraft) * draft.lines[qtyEdit]!.unitPrice! / servings))}원`} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}><Button kind="gray" size="lg" full onPress={() => { removeLine(qtyEdit); setQtyEdit(null); }}>삭제</Button></View>
              <View style={{ flex: 1 }}><Button kind="primary" size="lg" full disabled={num(qtyDraft) <= 0} onPress={applyQty}>저장</Button></View>
            </View>
          </View>
        ) : null}
      </Sheet>
      <Sheet visible={extraEdit !== null} onClose={() => setExtraEdit(null)} title="부자재 사용량 수정">
        {extraEdit !== null && draft.extras[extraEdit] ? <View>
          <Text style={{ ...TYPE.body, fontWeight: '700', color: T.ink, marginBottom: space.md }}>{draft.extras[extraEdit]!.name}</Text>
          <Field label="1인분 사용량" req variant="stacked">
            <Input value={extraQtyDraft} onChangeText={(value) => setExtraQtyDraft(clampDecimals(value, 4))}
              suffix="개" mono variant="stacked" keyboardType="decimal-pad" accessibilityLabel="부자재 1인분 사용량" />
          </Field>
          <ResultField label="1인분 비용" value={`${won(Math.round(draft.extras[extraEdit]!.amount * num(extraQtyDraft)))}원`} />
          <ResultField label={`${servings}인분 비용`} value={`${won(Math.round(draft.extras[extraEdit]!.amount * num(extraQtyDraft) * servings))}원`} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button kind="gray" size="lg" style={{ flex: 1 }} onPress={() => { removeExtra(extraEdit); setExtraEdit(null); }}>삭제</Button>
            <Button kind="primary" size="lg" style={{ flex: 1 }} disabled={!Number.isFinite(num(extraQtyDraft)) || num(extraQtyDraft) <= 0}
              onPress={() => { if (Number.isFinite(num(extraQtyDraft)) && num(extraQtyDraft) > 0) { updateExtra(extraEdit, { qty: num(extraQtyDraft) }); setExtraEdit(null); } }}>저장</Button>
          </View>
        </View> : null}
      </Sheet>
    </View>
  );
}
