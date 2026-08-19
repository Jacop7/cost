/**
 * RCP-03 레시피 추가 / RCP-04 수정 — 같은 폼이다(`?id=` 유무로 갈린다).
 *
 * 손익 미리보기는 `@sikjae/core` 공식으로 즉시 계산하고, **확정값은 저장 시 서버**가 낸다.
 * 두 공식이 어긋나면 저장 전후 숫자가 달라지므로 core 와 SQL 의 식이 같아야 한다(절대원칙 3).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Badge, Button, Card, Field, Icon, Input, QueryState, Select, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatPercent, formatQuantity, formatUnitPrice, recommendedPrice, round, taxAmount, taxRate } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';
import { useSettingsLists } from '@/features/my/hooks';
import { useRecipeDetail, useSaveRecipe } from '../hooks';
import { emptyDraft, useRecipeDraft, type DraftLine } from '../draftStore';

const NUM = { fontVariant: ['tabular-nums' as const] };

const num = (s: string) => {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

function SecHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>{title}</Text>
      {sub ? <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}>{sub}</Text> : null}
      {right ? (<><View style={{ flex: 1 }} />{right}</>) : null}
    </View>
  );
}

function InfoBtn({ active, onPress }: { active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={{ padding: 2 }} accessibilityRole="button" accessibilityLabel="설명 보기">
      <Icon name="info" size={14} color={active ? T.blue : T.ter} />
    </Pressable>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 15, backgroundColor: T.surface2, borderTopWidth: 1, borderTopColor: T.line2 }}>
      <Text style={{ fontSize: 14, color: T.ter, lineHeight: 20 }}>{children}</Text>
    </View>
  );
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

  const [info, setInfo] = useState<'sales' | 'target' | null>(null);
  const [costMode, setCostMode] = useState<'batch' | 'one'>('one');
  const [plMode, setPlMode] = useState<'batch' | 'one' | 'month'>('one');
  const [catOpen, setCatOpen] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const [qtyEdit, setQtyEdit] = useState<number | null>(null);
  const [qtyDraft, setQtyDraft] = useState('');

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
  const monthly = num(draft.avgMonthlySales);

  /** 1인분 재료비 — 단가가 없는 줄은 0 이 아니라 **계산 불가**로 다룬다. */
  const lineCost = (l: DraftLine) => (l.unitPrice === null ? null : (l.inputQty / servings) * l.unitPrice);
  const material = draft.lines.reduce((s, l) => s + (lineCost(l) ?? 0), 0);
  const unknownLines = draft.lines.filter((l) => l.unitPrice === null).length;
  const extra = draft.extras.reduce((s, e) => s + e.amount * e.qty, 0);
  const fixedRate = d?.fixedRate ?? 0;
  /** 요율이 숫자로 읽히는 항목만 계산에 넣는다 — 서버 `tax_of()` 의 `where rate > 0` 과 같다. */
  const taxItems = draft.taxItems
    .map((t) => ({ name: t.name.trim(), rate: num(t.rate) }))
    .filter((t) => t.rate > 0);
  const tax = round(taxAmount(price, draft.taxMode, taxItems));
  const fixed = round(fixedRate * price);
  const profit = price - tax - material - fixed - extra;
  const profitRate = price > 0 ? profit / price : 0;
  const warn = profitRate < target;
  const PROFIT = warn ? T.red : T.green;
  // 권장가 분모에도 세금 항목이 들어간다 — 빼면 카드 수수료만큼 낮게 나온다.
  const recRaw = recommendedPrice(material + extra, fixedRate, target, taxRate(draft.taxMode, taxItems));
  const recommended = recRaw == null ? null : Math.round(recRaw / 100) * 100;

  const cm = costMode === 'batch' ? servings : 1;
  const m = plMode === 'batch' ? servings : plMode === 'month' ? monthly : 1;
  const wm = (v: number) => `${won(Math.round(v * m))}원`;
  const p = (v: number) => (price > 0 ? formatPercent(v / price) : '0.0%');

  const nameError = draft.name.trim() === '' ? '메뉴 이름을 입력해 주세요' : undefined;
  const priceError = price < 0 ? '판매가는 0 이상이어야 해요' : undefined;
  /** 서버(assert_tax_items)와 같은 규칙으로 미리 막는다 — 저장 눌러서 알게 하지 않는다. */
  const taxError = draft.taxItems.some((t) => t.name.trim() === '')
    ? '세금 항목 이름을 입력해 주세요'
    : draft.taxItems.some((t) => num(t.rate) < 0 || num(t.rate) >= 100)
      ? '세금 요율은 0 이상 100 미만이어야 해요'
      : undefined;
  const canSave = !nameError && !priceError && !taxError && servings >= 1 && !save.isPending;

  const onSave = () => {
    if (!canSave) return;
    save.mutate(
      {
        id: draft.id,
        name: draft.name.trim(),
        price,
        taxMode: draft.taxMode,
        taxItems,
        baseServings: servings,
        targetProfitRate: num(draft.targetProfitRate),
        avgMonthlySales: draft.avgMonthlySales.trim() === '' ? null : monthly,
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
    if (qtyEdit === null) return;
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }}>
          {/* 기본 정보 */}
          <View style={{ marginBottom: 14 }}>
            <Field label="메뉴명" req error={draft.name !== '' ? nameError : undefined}>
              <Input value={draft.name} onChangeText={(t) => patch({ name: t })} placeholder="예) 제육볶음" error={draft.name !== '' && Boolean(nameError)} accessibilityLabel="메뉴명" />
            </Field>
            <Field label="카테고리">
              <Select value={catLabel} placeholder="카테고리 선택" onPress={() => setCatOpen(true)} />
            </Field>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1.4 }}>
                <Field label="판매가" req error={draft.price !== '' ? priceError : undefined}>
                  <Input value={draft.price} onChangeText={(t) => patch({ price: clampDecimals(t, 0) })} placeholder="0" suffix="원" mono keyboardType="number-pad" accessibilityLabel="판매가" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="세금">
                  <Select
                    value={`${draft.taxMode === 'included' ? '포함' : draft.taxMode === 'separate' ? '별도' : '면세'}${
                      taxItems.length > 0 ? ` +${taxItems.length}` : ''
                    }`}
                    onPress={() => setTaxOpen(true)}
                  />
                </Field>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="월 평균 판매량" right={<InfoBtn active={info === 'sales'} onPress={() => setInfo((v) => (v === 'sales' ? null : 'sales'))} />}>
                  <Input value={draft.avgMonthlySales} onChangeText={(t) => patch({ avgMonthlySales: clampDecimals(t, 0) })} placeholder="0" suffix="개" mono keyboardType="number-pad" accessibilityLabel="월 평균 판매량" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="기준 인분" req hint="한 번에 만드는 양">
                  <Input value={draft.baseServings} onChangeText={(t) => patch({ baseServings: clampDecimals(t, 0) })} placeholder="10" suffix="인분" mono keyboardType="number-pad" accessibilityLabel="기준 인분" />
                </Field>
              </View>
            </View>
            <Field label="목표 순이익률" right={<InfoBtn active={info === 'target'} onPress={() => setInfo((v) => (v === 'target' ? null : 'target'))} />}>
              <Input value={draft.targetProfitRate} onChangeText={(t) => patch({ targetProfitRate: clampDecimals(t, 1) })} placeholder="40" suffix="%" mono keyboardType="decimal-pad" accessibilityLabel="목표 순이익률" />
            </Field>
          </View>

          {info ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: -8, marginBottom: 18, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: T.blueTint, borderRadius: 10 }}>
              <Icon name="info" size={15} color={T.blue} />
              <Text style={{ flex: 1, fontSize: 14, color: T.sub, fontWeight: '600', lineHeight: 21 }}>
                {info === 'sales'
                  ? '한 달 평균 판매 수량이에요. 손익 미리보기의 ‘월평균 기준’ 계산에 쓰여요.'
                  : '이 메뉴에서 남기고 싶은 순이익 비율이에요. 현재 순이익률이 목표보다 낮으면 권장 판매가를 알려드려요.'}
              </Text>
            </View>
          ) : null}

          {/* 재료 */}
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <SecHead title="재료" sub={`${draft.lines.length}개`} />
            <View style={{ flexDirection: 'row', gap: 22, paddingHorizontal: 15, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.line }}>
              {([['batch', `${servings}인분 기준`], ['one', '1인분 기준']] as const).map(([k, label]) => {
                const on = costMode === k;
                return (
                  <Pressable key={k} onPress={() => setCostMode(k)} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on }} style={{ paddingTop: 13, paddingBottom: 11 }}>
                    <Text style={{ fontSize: 16, fontWeight: on ? '700' : '600', color: on ? T.ink : T.ter }}>{label}</Text>
                    {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2.5, backgroundColor: T.ink, borderRadius: 2 }} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
              {draft.lines.length === 0 ? (
                <Text style={{ fontSize: 16, color: T.ter, paddingVertical: 14 }}>아래 ‘재료 검색’으로 재료를 담아 주세요</Text>
              ) : (
                draft.lines.map((l, i) => {
                  const cost = lineCost(l);
                  return (
                    <View key={`${l.ingredientId ?? l.subRecipeId}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                      <Pressable onPress={() => openQty(i)} accessibilityRole="button" accessibilityLabel={`${l.name} 사용량 수정`} style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>
                          {l.name}
                        </Text>
                        <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>
                          {l.unitPrice === null ? '단가 산출 전' : l.unit === null ? `${won(Math.round(l.unitPrice))}원/인분` : formatUnitPrice(l.unitPrice, l.unit)}
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => openQty(i)} accessibilityRole="button" accessibilityLabel={`${l.name} 사용량`} style={{ alignItems: 'flex-end', marginRight: 8 }}>
                        <Text style={[{ fontSize: 16, fontWeight: '800', color: cost === null ? T.ter : T.ink }, NUM]}>
                          {cost === null ? '—' : `${won(Math.round(cost * cm))}원`}
                        </Text>
                        <Text style={[{ fontSize: 14, color: T.blue, marginTop: 1, fontWeight: '700' }, NUM]}>
                          {l.unit === null ? `${(l.inputQty / servings) * cm}인분` : formatQuantity((l.inputQty / servings) * cm, l.unit)}
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => removeLine(i)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${l.name} 삭제`}>
                        <Icon name="close" size={18} color={T.ter} />
                      </Pressable>
                    </View>
                  );
                })
              )}
              <Pressable
                onPress={() => router.push(`/recipes/ingredient-search${draft.id ? `?exclude=${draft.id}` : ''}` as Href)}
                accessibilityRole="button" accessibilityLabel="재료 검색"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.blue, backgroundColor: T.blueTint }}
              >
                <Icon name="search" size={17} color={T.blue} sw={2.1} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>재료 검색</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.line }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>재료비 소계</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round(material * cm))}원</Text>
                  <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: 2 }, NUM]}>{p(material)}</Text>
                </View>
              </View>
              {unknownLines > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: T.amberTint }}>
                  <Icon name="info" size={15} color={T.amberText} />
                  <Text style={{ flex: 1, fontSize: 14, color: T.amberText, lineHeight: 20 }}>
                    단가가 없는 재료 {unknownLines}개는 원가에서 빠져 있어요. 발주 → 입고를 등록하면 자동으로 반영돼요.
                  </Text>
                </View>
              ) : null}
            </View>
            <Footer>식재료는 검색해서만 담을 수 있어요(단가 자동 연동). 사용량은 기준 인분 전체 양이에요.</Footer>
          </Card>

          <View style={{ height: 9 }} />

          {/* 부자재 */}
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <SecHead title="부자재" sub="(이 메뉴에만 들어가는 부가 원가)" />
            <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
              {draft.extras.length === 0 ? (
                <Text style={{ fontSize: 16, color: T.ter, paddingVertical: 14 }}>등록된 부자재가 없어요</Text>
              ) : (
                draft.extras.map((e, i) => (
                  <View key={`${e.materialId ?? e.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>{e.name}</Text>
                      <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>{won(e.amount)}원 × {e.qty}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Pressable onPress={() => updateExtra(i, { qty: Math.max(0, e.qty - 1) })} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${e.name} 수량 줄이기`} style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: T.line2, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="minus" size={16} color={T.sub} sw={2.4} />
                      </Pressable>
                      <Text style={[{ minWidth: 22, textAlign: 'center', fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{e.qty}</Text>
                      <Pressable onPress={() => updateExtra(i, { qty: e.qty + 1 })} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${e.name} 수량 늘리기`} style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: T.blue, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="plus" size={16} color={T.onColor} sw={2.4} />
                      </Pressable>
                    </View>
                    <Pressable onPress={() => removeExtra(i)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${e.name} 삭제`}>
                      <Icon name="close" size={18} color={T.ter} />
                    </Pressable>
                  </View>
                ))
              )}
              <Pressable
                onPress={() => router.push('/recipes/material-search' as Href)}
                accessibilityRole="button" accessibilityLabel="부자재 검색"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.blue, backgroundColor: T.blueTint }}
              >
                <Icon name="search" size={17} color={T.blue} sw={2.1} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>부자재 검색</Text>
              </Pressable>
            </View>
            <Footer>부자재 단가는 마스터에서 관리돼요. 단가를 고치면 이 메뉴 원가도 함께 바뀌어요.</Footer>
          </Card>

          <View style={{ height: 9 }} />

          {/* 손익 미리보기 */}
          <Card onLine pad={0} style={{ overflow: 'hidden' }}>
            <SecHead title="손익 미리보기" sub="판매가 대비 %" />
            <View style={{ flexDirection: 'row', gap: 22, paddingHorizontal: 15, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.line }}>
              {([['batch', `${servings}인분`], ['one', '1인분'], ['month', '월평균']] as const).map(([k, label]) => {
                const on = plMode === k;
                const disabled = k === 'month' && monthly <= 0;
                return (
                  <Pressable key={k} onPress={() => setPlMode(k)} disabled={disabled} accessibilityRole="tab" accessibilityLabel={`${label} 기준`} accessibilityState={{ selected: on, disabled }} style={{ paddingTop: 13, paddingBottom: 11, opacity: disabled ? 0.4 : 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: on ? '700' : '600', color: on ? T.ink : T.ter }}>{label} 기준</Text>
                    {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2.5, backgroundColor: T.ink, borderRadius: 2 }} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>판매가</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{wm(price)}</Text>
                  <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>100%</Text>
                </View>
              </View>
              {[
                ...(tax > 0 ? [{ label: '세금', amt: tax }] : []),
                { label: '재료 원가', amt: material },
                { label: '고정 지출', amt: fixed },
                ...(extra > 0 ? [{ label: '부자재', amt: extra }] : []),
              ].map((c) => (
                <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>
                    <Text style={{ color: T.ter }}>(−) </Text>{c.label}
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ter }, NUM]}>{wm(c.amt)}</Text>
                    <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>{p(c.amt)}</Text>
                  </View>
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>순이익</Text>
                <View style={{ marginLeft: 7 }}>{warn ? <Badge tone="red" sm solid>목표 미달</Badge> : <Badge tone="green" sm solid>목표 달성</Badge>}</View>
                <View style={{ flex: 1 }} />
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: PROFIT }, NUM]}>{wm(profit)}</Text>
                  <Text style={[{ fontSize: 14, fontWeight: '800', color: PROFIT, marginTop: 2 }, NUM]}>{formatPercent(profitRate)}</Text>
                </View>
              </View>
              {warn && recommended != null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: T.line }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink2 }}>권장 판매가</Text>
                    <Text style={{ fontSize: 14, color: T.ter, marginTop: 1 }}>목표 {draft.targetProfitRate}% 기준</Text>
                  </View>
                  <Pressable onPress={() => patch({ price: String(recommended) })} accessibilityRole="button" accessibilityLabel="권장 판매가 적용" style={{ alignItems: 'flex-end' }}>
                    <Text style={[{ fontSize: 16, fontWeight: '800', color: T.blue }, NUM]}>{won(recommended)}원</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue, marginTop: 2 }}>적용하기</Text>
                  </Pressable>
                </View>
              ) : null}
              {!id ? (
                <Text style={{ fontSize: 14, color: T.ter, lineHeight: 20, marginTop: 12 }}>
                  고정지출률은 저장 후 이번 달 값으로 반영돼요.
                </Text>
              ) : null}
            </View>
          </Card>
        </ScrollView>
      </QueryState>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full disabled={!canSave} loading={save.isPending} onPress={onSave}>
          {id ? '저장' : '추가'}
        </Button>
      </View>

      {/* 카테고리 */}
      <Sheet visible={catOpen} onClose={() => setCatOpen(false)} title="카테고리 선택" height={520}>
        <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={() => { patch({ categoryId: null, categoryName: '' }); setCatOpen(false); }}
            accessibilityRole="button" accessibilityLabel="지정 안 함"
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: draft.categoryId === null ? T.blue : T.line, backgroundColor: draft.categoryId === null ? T.blueTint : T.surface }}
          >
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: draft.categoryId === null ? T.blue : T.ter }}>지정 안 함</Text>
            {draft.categoryId === null ? <Icon name="check" size={17} color={T.blue} sw={2.4} /> : null}
          </Pressable>
          {(lists.data?.recipeCategories ?? []).map((c) => {
            const on = draft.categoryId === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => { patch({ categoryId: c.id, categoryName: c.name }); setCatOpen(false); }}
                accessibilityRole="button" accessibilityLabel={c.name} accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}
              >
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: on ? T.blue : T.ink2 }}>{c.name}</Text>
                {on ? <Icon name="check" size={17} color={T.blue} sw={2.4} /> : null}
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => { setCatOpen(false); router.push('/recipes/category' as Href); }}
            accessibilityRole="button" accessibilityLabel="카테고리 관리"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: T.blue }}
          >
            <Icon name="plus" size={17} color={T.blue} sw={2.2} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>카테고리 관리</Text>
          </Pressable>
        </ScrollView>
      </Sheet>

      {/* 세금 — 부가세(기본) + 사장님이 더하는 항목 */}
      <Sheet visible={taxOpen} onClose={() => setTaxOpen(false)} title="세금" sub="부가세와 그 밖에 판매가에서 빠지는 몫" height={620}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 14, fontWeight: '800', color: T.sub, marginBottom: 2 }}>부가세</Text>
          {([
            ['included', '포함', '판매가 × 10/110 을 부가세로 잡아요'],
            ['separate', '별도', '판매가와 별도로 받아 손익에서 빼지 않아요'],
            ['exempt', '면세', '부가세가 없는 품목이에요'],
          ] as const).map(([k, label, hint]) => {
            const on = draft.taxMode === k;
            return (
              <Pressable
                key={k}
                onPress={() => patch({ taxMode: k })}
                accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: on ? T.blue : T.ink }}>{label}</Text>
                  <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{hint}</Text>
                </View>
                {on ? <Icon name="check" size={18} color={T.blue} sw={2.4} /> : null}
              </Pressable>
            );
          })}

          {/* 추가 항목 — 카드 수수료처럼 판매가에서 비율로 빠지는 것들 */}
          <View style={{ height: 1, backgroundColor: T.line, marginVertical: 14 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '800', color: T.sub }}>그 밖의 세금·수수료</Text>
            <Text style={[{ fontSize: 14, fontWeight: '700', color: T.ter }, NUM]}>판매가 대비 %</Text>
          </View>
          {/* ⚠ 플랫폼 수수료는 여기 넣지 마세요 — 고정 지출에서 이미 빠집니다(0043). */}
          <Text style={{ fontSize: 13, color: T.ter, marginBottom: 10, lineHeight: 19 }}>
            배달앱 중개 수수료는 여기가 아니라 MY {'>'} 고정 지출에서 관리해요. 두 곳에 넣으면 같은 돈이 두 번 빠져요.
          </Text>

          {draft.taxItems.map((t, i) => (
            <View key={`tax-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 }}>
              <View style={{ flex: 1.6 }}>
                <Input
                  value={t.name}
                  onChangeText={(v) => updateTaxItem(i, { name: v })}
                  placeholder="예) 카드 수수료"
                  accessibilityLabel={`세금 항목 ${i + 1} 이름`}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  value={t.rate}
                  onChangeText={(v) => updateTaxItem(i, { rate: clampDecimals(v, 2) })}
                  placeholder="0"
                  suffix="%"
                  mono
                  keyboardType="decimal-pad"
                  accessibilityLabel={`세금 항목 ${i + 1} 요율`}
                />
              </View>
              <Pressable
                onPress={() => removeTaxItem(i)}
                accessibilityRole="button" accessibilityLabel={`${t.name || `세금 항목 ${i + 1}`} 삭제`}
                hitSlop={8}
                style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="close" size={18} color={T.ter} />
              </Pressable>
            </View>
          ))}

          <Pressable
            onPress={addTaxItem}
            accessibilityRole="button" accessibilityLabel="세금 항목 추가"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: T.blue, marginTop: 2 }}
          >
            <Icon name="plus" size={17} color={T.blue} sw={2.2} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>항목 추가</Text>
          </Pressable>

          {taxError ? (
            <Text style={{ fontSize: 14, fontWeight: '600', color: T.red, marginTop: 10 }}>{taxError}</Text>
          ) : null}

          {/* 합계 — 지금 판매가로 얼마가 빠지는지 바로 보여 준다 */}
          <View style={{ marginTop: 14, padding: 13, borderRadius: 12, backgroundColor: T.surface2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>세금 합계</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round(tax))}원</Text>
            </View>
            <Text style={[{ fontSize: 14, color: T.ter, marginTop: 3 }, NUM]}>
              판매가 {won(Math.round(price))}원의 {formatPercent(price > 0 ? tax / price : 0)}
            </Text>
          </View>

          <View style={{ marginTop: 14, marginBottom: 4 }}>
            <Button kind="primary" size="lg" full disabled={Boolean(taxError)} onPress={() => setTaxOpen(false)}>
              확인
            </Button>
          </View>
        </ScrollView>
      </Sheet>

      {/* 사용량 수정 */}
      <Sheet
        visible={qtyEdit !== null}
        onClose={() => setQtyEdit(null)}
        title="사용량 수정"
        sub={qtyEdit !== null ? `${draft.lines[qtyEdit]?.name} · ${servings}인분 전체 양` : undefined}
        height={340}
      >
        {qtyEdit !== null ? (
          <View>
            <Field label={`${servings}인분 사용량`} req hint="1인분 양이 아니라 한 번에 만드는 전체 양이에요">
              <Input
                value={qtyDraft}
                onChangeText={(t) => setQtyDraft(clampDecimals(t, 2))}
                suffix={draft.lines[qtyEdit]?.unit ?? '인분'}
                mono
                keyboardType="decimal-pad"
                accessibilityLabel="사용량"
              />
            </Field>
            <Text style={[{ fontSize: 14, color: T.sub2, marginTop: -8, marginBottom: 12 }, NUM]}>
              1인분 {draft.lines[qtyEdit]?.unit === null
                ? `${num(qtyDraft) / servings}인분`
                : formatQuantity(num(qtyDraft) / servings, draft.lines[qtyEdit]?.unit ?? 'g')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 9 }}>
              <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={() => setQtyEdit(null)}>취소</Button></View>
              <View style={{ flex: 2 }}><Button kind="primary" size="lg" full onPress={applyQty}>적용</Button></View>
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
