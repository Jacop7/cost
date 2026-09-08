/**
 * ING-02 식재료 추가 / ING-04 식재료 수정 — 같은 폼이다.
 *
 * 추가와 수정을 두 파일로 두면 필드 하나를 고칠 때 한쪽만 고쳐 어긋난다.
 * 기본 거래처·메모 입력은 제거했다. 기존 저장 기록은 화면 수정과 별도로 보존한다.
 *
 * ⚠ 절대원칙 1: 화면은 구매단위(kg·L)로 받고, **저장 직전 한 번** 기준단위(g/ml/개)로 환산한다.
 *   환산을 두 군데서 하면 값이 두 번 나뉘거나 곱해진다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { displayToBase, formatQuantity, isDisplayUnit, previewBaseUnitPrice, roundOrNull } from '@margincook/core';
import { AppHeader, Button, ConfirmSheet, Field, Icon, Input, QueryState, Select } from '../../../components/kit';
import { LAYOUT, COLOR, COMPONENT, T, TYPE, radius, space } from '../../../theme/tokens';
import { UnitPickerSheet } from '../components/UnitPickerSheet';
import { CategoryPickerSheet } from '../components/CategoryPickerSheet';
import { safeBack } from '@/lib/nav';
import { clampByUnit, clampDecimals } from '@/lib/num';
import { useSettingsLists } from '@/features/master-data/hooks';
import { useIngredientDetail, useSaveIngredient, type BaseUnit } from '../hooks';


const num = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

/** 화면 단위 → DB 기준단위. 저장은 언제나 g/ml/ea 다. */
const baseUnitOf = (u: string): BaseUnit => (u === 'kg' || u === 'g' ? 'g' : u === 'L' || u === 'ml' ? 'ml' : 'ea');
/** DB 기준단위 → 화면 기본 단위. 수정 화면 진입 시 되돌린다. */
const displayUnitOf = (b: BaseUnit): string => (b === 'g' ? 'g' : b === 'ml' ? 'ml' : '개');

export function IngredientFormScreen({ id }: { id?: string }) {
  const router = useRouter();
  const detail = useIngredientDetail(id);
  const lists = useSettingsLists();
  const save = useSaveIngredient();

  const [unit, setUnit] = useState('kg');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [name, setName] = useState('');
  const [catId, setCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [vol, setVol] = useState('');
  const [boxQty, setBoxQty] = useState('');
  const [price, setPrice] = useState('');
  const [safe, setSafe] = useState('');
  const [minOrder, setMinOrder] = useState('1');
  const [saveError, setSaveError] = useState<string | null>(null);

  // 수정 진입 — 서버 값이 도착하면 폼을 채운다. 사용자가 이미 고친 뒤에는 덮어쓰지 않는다.
  const d = detail.data;
  useEffect(() => {
    if (!id || !d || loaded) return;
    const u = displayUnitOf(d.baseUnit);
    setUnit(u);
    setName(d.name);
    setCatId(d.categoryId);
    setCatName(d.categoryName ?? '');
    setVol(String(d.perVolume));
    setPrice('');
    // 안전재고는 기준단위로 저장된다(0073). 화면에는 용량과 같은 단위로 보여 준다.
    setSafe(String(isDisplayUnit(u) ? d.safetyStock / displayToBase(1, u) : d.safetyStock));
    setMinOrder(String(d.minOrderQty));
    setLoaded(true);
  }, [id, d, loaded]);

  // 카테고리 이름은 목록에서 되찾는다(추가 화면에서 고른 직후에는 state 값 사용).
  const catLabel = useMemo(() => {
    if (catName) return catName;
    return lists.data?.categories.find((c) => c.id === catId)?.name ?? '';
  }, [catName, catId, lists.data]);

  const isMeasure = !(unit === '박스' || unit === '개');
  const base = baseUnitOf(unit);
  const dispBase = base === 'ea' ? '개' : base;

  // 개당 용량(기준단위). 환산은 @margincook/core displayToBase 한 곳에서만 한다.
  const perBase = unit === '박스' ? num(boxQty) : isDisplayUnit(unit) ? displayToBase(num(vol), unit) : num(vol);

  // 산출 불가(용량 0·로스율 100% 이상)는 null 로 둔다. 0원으로 위장하면 원가가 0이 되어
  // 순이익이 과대 계상되고 그대로 저장된다(@margincook/core 경계 계약).
  const realPer = roundOrNull(previewBaseUnitPrice(num(price), perBase), 2);
  const formVariant = id ? undefined : 'stacked' as const;
  // 초기 미입력의 0은 표시용이다. 가격 입력 후 용량이 0이면 계산 불가를 명시한다.
  const previewText = price.trim() === '' ? `0원/${dispBase}` : realPer === null ? '계산 불가' : `${realPer}원/${dispBase}`;

  const nameError = name.trim() === '' ? '식재료 이름을 입력해 주세요' : undefined;
  const volError = perBase <= 0 ? '용량은 0보다 커야 해요' : undefined;

  const canSave = !nameError && !volError && catId !== null && !save.isPending;

  const onSave = () => {
    if (!canSave) return;
    save.mutate(
      {
        id,
        name: name.trim(),
        categoryId: catId,
        baseUnit: base,
        perVolume: perBase,
        // ⚠ 저장은 기준단위다(절대원칙 1 · 0073). 화면 단위를 그대로 보내면
        //   2kg 이 2g 으로 들어간다.
        safetyStock: isDisplayUnit(unit) ? displayToBase(num(safe), unit) : num(safe),
        minOrderQty: num(minOrder) || 1,
        // 기본 거래처 지정 UI는 폐기했다. 기존 수정값을 소리 없이 지우지는 않는다.
        defaultVendorId: id ? d?.defaultVendorId ?? null : null,
        memo: id ? d?.memo ?? null : null,
      },
      {
        onSuccess: (savedId) => {
          if (id) safeBack(`/ingredients/${id}`);
          else router.replace(`/ingredients/${savedId}`);
        },
        onError: (e) => setSaveError(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={id ? '식재료 수정' : '식재료 추가'} onBack={() => safeBack()} />

      <QueryState
        isLoading={Boolean(id) && detail.isLoading}
        error={detail.error}
        isEmpty={Boolean(id) && detail.isFetched && !d}
        onRetry={() => void detail.refetch()}
        emptyTitle="식재료를 찾을 수 없어요"
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: id ? 20 : space.lg, paddingTop: id ? 4 : space.sm, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <Field variant={formVariant} label="식재료명" req error={name !== '' ? nameError : undefined}>
            <Input variant={formVariant} value={name} placeholder={id ? '예) 대파' : '식재료명을 입력하세요'} onChangeText={setName} error={name !== '' && Boolean(nameError)} accessibilityLabel="식재료명" />
          </Field>

          <Field variant={formVariant} label="카테고리" req>
            <Select variant={formVariant} value={catLabel} placeholder="카테고리 선택" onPress={() => setCatOpen(true)}
              accessibilityLabel={`카테고리 변경, ${catLabel || '선택 안 함'}`} expanded={catOpen} />
          </Field>

          <Field variant={formVariant} label="개당 용량" req error={vol !== '' ? volError : undefined} hint={id ? "kg·L 입력 시 자동 환산 · '개'는 포장당 개수" : undefined}>
            <View style={{ flexDirection: 'row', gap: id ? space.sm : COMPONENT.stackedForm.columnGap }}>
              <View style={{ flex: id ? 2 : 1 }}>
                <Input variant={formVariant} value={vol} placeholder="0" onChangeText={(t) => setVol(clampByUnit(t, unit))} mono keyboardType="decimal-pad" error={vol !== '' && Boolean(volError)} accessibilityLabel="개당 용량" />
              </View>
              <View style={{ flex: 1 }}>
                <Select variant={formVariant} value={unit} onPress={() => setPickerOpen(true)}
                  accessibilityLabel={`단위 ${unit} 변경`} expanded={pickerOpen} />
              </View>
            </View>
          </Field>

          {unit === '박스' ? (
            <Field variant={formVariant} label="박스당 수량" req>
              <Input variant={formVariant} value={boxQty} placeholder="0" onChangeText={(t) => setBoxQty(clampDecimals(t, 0))} suffix="개" mono keyboardType="number-pad" accessibilityLabel="박스당 수량" />
            </Field>
          ) : null}

          {/*
            구매 가격은 **저장되지 않는다.** 기준단가는 입고(E1) 이력의 가중평균이라
            여기 값은 "이 조건이면 얼마쯤"을 미리 보여주는 계산기다(절대원칙 2).
          */}
          {!id ? <Field variant="stacked" label="구매 단가">
            <View accessibilityLabel="구매 단가 미리보기, 저장되지 않음" style={{ minHeight: COMPONENT.stackedForm.controlMinHeight, paddingHorizontal: COMPONENT.stackedForm.controlPaddingHorizontal, paddingVertical: space.md, justifyContent: 'center', borderWidth: 1, borderColor: COLOR.action.primary, borderRadius: radius.md, backgroundColor: COLOR.action.primaryTint }}>
              <Text style={{ ...TYPE.body, textAlign: 'right', color: COLOR.action.onTint }}>{previewText}</Text>
            </View>
          </Field> : null}
          <Field variant={formVariant} label="구매 가격" hint={id ? '단가 미리보기용 — 실제 단가는 입고 시 기록돼요' : undefined}>
            <Input variant={formVariant} value={price} placeholder="0" onChangeText={(t) => setPrice(clampDecimals(t, 0))} suffix="원" mono keyboardType="number-pad" accessibilityLabel="구매 가격" />
          </Field>

          {/* 단가 미리보기 — 저장 전에 결과를 눈으로 확인하게 한다. */}
          {id && num(price) > 0 && perBase > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 16, paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: 12, backgroundColor: COLOR.action.primaryTint }}>
              <Icon name="info" size={15} color={COLOR.action.primary} />
              <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: TYPE.caption.lineHeight }}>
                {realPer === null
                  ? '입력값으로는 단가를 계산할 수 없어요'
                  : `기준단가 ${realPer}원/${dispBase}`}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: id ? space.sm : COMPONENT.stackedForm.columnGap }}>
            <View style={{ flex: 1 }}>
              {/* 안전재고는 재고와 **같은 단위**다(0073). 팩 개수로 받으면
                  팩 용량을 고칠 때 기준이 소리 없이 따라 움직인다. */}
              <Field variant={formVariant} label="안전재고" req hint={id ? '이 양 아래로 내려가면 발주 후보' : undefined}>
                <Input variant={formVariant} value={safe} placeholder="0" onChangeText={(t) => setSafe(clampDecimals(t, 2))} suffix={isMeasure ? unit : dispBase} mono keyboardType="decimal-pad" accessibilityLabel="안전재고" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field variant={formVariant} label="최소 발주" req hint={id ? '개수 기준' : undefined}>
                <Input variant={formVariant} value={minOrder} placeholder="1" onChangeText={(t) => setMinOrder(clampDecimals(t, 0))} suffix="개" mono keyboardType="number-pad" accessibilityLabel="최소 발주" />
              </Field>
            </View>
          </View>

          {id ? (
            <View style={{ marginTop: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 8 }}>
                구매 링크 · 옵션 <Text style={{ color: COLOR.text.tertiary, fontWeight: '600' }}>({d?.options.length ?? 0}개)</Text>
              </Text>
              <Pressable
                onPress={() => router.push(`/ingredients/option?ingredient=${id}`)}
                accessibilityRole="button" accessibilityLabel="구매 링크·옵션 관리"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingVertical: space.md, borderRadius: 12, borderWidth: 1, borderColor: COLOR.action.primary, backgroundColor: COLOR.action.primaryTint }}
              >
                <Icon name="plus" size={18} color={COLOR.action.primary} sw={2.2} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLOR.text.link }}>구매 링크 · 옵션 관리</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: 4, paddingVertical: 12, paddingHorizontal: space.md, borderRadius: 12, backgroundColor: T.surface2 }}>
              <Icon name="info" size={15} color={T.sub2} />
              <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: TYPE.caption.lineHeight }}>
                구매 링크는 저장한 뒤 상세 화면에서 추가할 수 있어요.
              </Text>
            </View>
          )}
        </ScrollView>
      </QueryState>

      <View style={{ paddingHorizontal: id ? 20 : space.lg, paddingTop: 12, paddingBottom: id ? LAYOUT.scroll.end : space.md, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size={id ? 'lg' : 'md'} full disabled={!canSave} loading={save.isPending} onPress={onSave}>
          {id ? '저장' : '추가'}
        </Button>
      </View>

      <UnitPickerSheet
        visible={pickerOpen}
        unit={unit}
        onSelect={(u) => {
          setUnit(u);
          setVol((p) => clampByUnit(p, u));
        }}
        onClose={() => setPickerOpen(false)}
      />
      <CategoryPickerSheet
        visible={catOpen}
        value={catId}
        onSelect={(cid, cname) => {
          setCatId(cid);
          setCatName(cname);
          // 카테고리 기본 로스율을 비어 있을 때만 채운다. 사용자가 넣은 값을 덮으면 안 된다.
        }}
        onClose={() => setCatOpen(false)}
      />
      <ConfirmSheet
        visible={saveError !== null}
        title="저장하지 못했어요"
        message={saveError ?? ''}
        confirmText="확인"
        cancelText="닫기"
        onConfirm={() => setSaveError(null)}
        onCancel={() => setSaveError(null)}
      />
    </View>
  );
}

/** 표기용 — 저장값(기준단위)에서 라벨을 만든다. 입력 문자열을 그대로 쓰면 환산 전 값이 남는다. */
export const perLabelOf = (perBase: number, base: BaseUnit) =>
  formatQuantity(perBase, base === 'ea' ? '개' : base, { maxDigits: 3 });
