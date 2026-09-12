/**
 * ING-02 식재료 추가 / ING-04 식재료 수정 — 같은 폼이다.
 *
 * 추가와 수정을 두 파일로 두면 필드 하나를 고칠 때 한쪽만 고쳐 어긋난다.
 * 기본 거래처·메모 입력은 제거했다. 기존 저장 기록은 화면 수정과 별도로 보존한다.
 *
 * ⚠ 절대원칙 1: 화면은 구매단위(kg·L)로 받고, **저장 직전 한 번** 기준단위(g/ml/개)로 환산한다.
 *   환산을 두 군데서 하면 값이 두 번 나뉘거나 곱해진다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { displayToBase, formatQuantity, isDisplayUnit, previewBaseUnitPrice, roundOrNull } from '@margincook/core';
import { AppHeader, Button, ConfirmSheet, Field, Input, Notice, QueryState, Select } from '../../../components/kit';
import { COLOR, COMPONENT, T, TYPE, space } from '../../../theme/tokens';
import { StockResultField } from '../components/StockResultField';
import { UnitPickerSheet } from '../components/UnitPickerSheet';
import { CategoryPickerSheet } from '../components/CategoryPickerSheet';
import { safeBack } from '@/lib/nav';
import { clampByUnit, clampDecimals, clampSignedDecimals } from '@/lib/num';
import { useSettingsLists } from '@/features/master-data/hooks';
import { useIngredientDetail, useSaveIngredient, type BaseUnit } from '../hooks';
import { convertUnitInput } from '../unitInput';
import { EditConflictNotice, ingredientEditBaseline, useIngredientEditConflict } from '../editConflict';


const num = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

/** 화면 단위 → DB 기준단위. 저장은 언제나 g/ml/ea 다. */
const baseUnitOf = (u: string): BaseUnit => (u === 'kg' || u === 'g' ? 'g' : u === 'L' || u === 'ml' ? 'ml' : 'ea');
/** DB 기준단위 → 화면 기본 단위. 수정 화면 진입 시 되돌린다. */
const displayUnitOf = (b: BaseUnit): string => (b === 'g' ? 'g' : b === 'ml' ? 'ml' : '개');

export function IngredientFormScreen({ id }: { id?: string }) {
  return <IngredientFormEditor key={id ?? 'new'} id={id} />;
}

function IngredientFormEditor({ id }: { id?: string }) {
  const router = useRouter();
  const detail = useIngredientDetail(id);
  const lists = useSettingsLists();
  const save = useSaveIngredient();
  const recovery = useIngredientEditConflict(id, () => detail.refetch());
  const formScroll = useRef<ScrollView>(null);
  const hasConflict = Boolean(recovery.conflict);
  // A new conflict needs attention; draft edits and refresh completion must not move the user.
  useEffect(() => {
    if (!hasConflict) return;
    Keyboard.dismiss();
    formScroll.current?.scrollTo({ y: 0, animated: true });
  }, [hasConflict]);

  const [unit, setUnit] = useState('kg');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expected, setExpected] = useState<Record<string, unknown>>();

  const [name, setName] = useState('');
  const [catId, setCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [vol, setVol] = useState('');
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
    setPrice(d.purchasePrice == null ? '' : String(d.purchasePrice));
    // 안전재고는 기준단위로 저장된다(0073). 화면에는 용량과 같은 단위로 보여 준다.
    setSafe(String(isDisplayUnit(u) ? d.safetyStock / displayToBase(1, u) : d.safetyStock));
    setMinOrder(String(d.minOrderQty));
    setExpected(ingredientEditBaseline(d));
    setLoaded(true);
  }, [id, d, loaded]);

  // 카테고리 이름은 목록에서 되찾는다(추가 화면에서 고른 직후에는 state 값 사용).
  const catLabel = useMemo(() => {
    if (catName) return catName;
    return lists.data?.categories.find((c) => c.id === catId)?.name ?? '';
  }, [catName, catId, lists.data]);

  const isMeasure = unit !== '개';
  const base = baseUnitOf(unit);
  const dispBase = base === 'ea' ? '개' : base;

  // 개당 용량(기준단위). 환산은 @margincook/core displayToBase 한 곳에서만 한다.
  const perBase = isDisplayUnit(unit) ? displayToBase(num(vol), unit) : num(vol);

  // 산출 불가(용량 0·로스율 100% 이상)는 null 로 둔다. 0원으로 위장하면 원가가 0이 되어
  // 순이익이 과대 계상되고 그대로 저장된다(@margincook/core 경계 계약).
  const realPer = roundOrNull(previewBaseUnitPrice(num(price), perBase), 2);
  const formVariant = 'stacked' as const;
  // 초기 미입력의 0은 표시용이다. 가격 입력 후 용량이 0이면 계산 불가를 명시한다.
  const previewText = price.trim() === '' ? `0원/${dispBase}` : realPer === null ? '계산 불가' : `${realPer}원/${dispBase}`;

  const nameError = name.trim() === '' ? '식재료 이름을 입력해 주세요' : undefined;
  const volError = perBase <= 0 ? '용량은 0보다 커야 해요' : undefined;
  const safeError = safe.trim() === '' || !Number.isFinite(Number(safe)) || Number(safe) < 0 ? '안전재고는 0 이상으로 입력해 주세요' : undefined;
  const orderError = !Number.isInteger(Number(minOrder)) || Number(minOrder) < 1 ? '최소 발주는 1개 이상으로 입력해 주세요' : undefined;

  const canSave = !nameError && !volError && !safeError && !orderError && catId !== null && !save.isPending && !recovery.conflict && (!id || (loaded && Boolean(d)));

  const onSave = () => {
    if (!canSave || recovery.isBlocked()) return;
    save.mutate(
      {
        id,
        ...(id ? { expected } : {}),
        name: name.trim(),
        categoryId: catId,
        baseUnit: base,
        perVolume: perBase,
        purchasePrice: price.trim() === '' ? null : num(price),
        // ⚠ 저장은 기준단위다(절대원칙 1 · 0073). 화면 단위를 그대로 보내면
        //   2kg 이 2g 으로 들어간다.
        safetyStock: isDisplayUnit(unit) ? displayToBase(num(safe), unit) : num(safe),
        minOrderQty: Number(minOrder),
        // 기본 거래처 지정 UI는 폐기했다. 기존 수정값을 소리 없이 지우지는 않는다.
        defaultVendorId: id ? (expected?.default_vendor_id as string | null) ?? null : null,
        memo: id ? (expected?.memo as string | null) ?? null : null,
      },
      {
        onSuccess: (savedId) => {
          if (id) safeBack(`/ingredients/${id}`);
          else router.replace(`/ingredients/${savedId}`);
        },
        onError: (e) => { if (!recovery.handleError(e)) setSaveError(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'); },
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={id ? '식재료 수정' : '식재료 추가'} onBack={() => safeBack()} />

      <QueryState
        isLoading={Boolean(id) && detail.isLoading}
        error={d || recovery.conflict ? null : detail.error}
        isEmpty={Boolean(id) && detail.isFetched && !d && !recovery.conflict}
        onRetry={() => void detail.refetch()}
        emptyTitle="식재료를 찾을 수 없어요"
      >
        <ScrollView ref={formScroll} contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <EditConflictNotice recovery={recovery} onAccept={latest => {
            // Three-way rebase: untouched fields follow the server; edited fields keep the draft.
            if (name.trim() === expected?.name) setName(latest.name);
            if (catId === expected?.category_id) { setCatId(latest.categoryId); setCatName(latest.categoryName ?? ''); }
            if (perBase === expected?.per_volume) setVol(String(latest.perVolume / (isDisplayUnit(unit) ? displayToBase(1, unit) : 1)));
            if ((price.trim() === '' ? null : num(price)) === expected?.purchase_price) setPrice(latest.purchasePrice == null ? '' : String(latest.purchasePrice));
            if ((isDisplayUnit(unit) ? displayToBase(num(safe), unit) : num(safe)) === expected?.safety_stock)
              setSafe(String(latest.safetyStock / (isDisplayUnit(unit) ? displayToBase(1, unit) : 1)));
            if (Number(minOrder) === expected?.min_order_qty) setMinOrder(String(latest.minOrderQty));
            setExpected(ingredientEditBaseline(latest));
          }}>
            <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary }}>현재 저장된 내용 — 내가 바꾸지 않은 항목은 최신값으로 반영됩니다.</Text>
            {recovery.conflict?.latest ? <Text style={{ ...TYPE.caption, color: COLOR.text.primary }}>{[
              recovery.conflict.latest.name, recovery.conflict.latest.categoryName ?? '카테고리 없음',
              `용량 ${perLabelOf(recovery.conflict.latest.perVolume, recovery.conflict.latest.baseUnit)}`,
              `구매 가격 ${recovery.conflict.latest.purchasePrice ?? '없음'}`,
              `안전재고 ${perLabelOf(recovery.conflict.latest.safetyStock, recovery.conflict.latest.baseUnit)}`,
              `최소 발주 ${recovery.conflict.latest.minOrderQty}개`,
            ].join('\n')}</Text> : null}
            {recovery.conflict?.latest && recovery.conflict.latest.memo !== expected?.memo ? <>
              <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary }}>메모가 변경됐어요. 이 화면에서는 최신 메모를 유지합니다.</Text>
              <Text style={{ ...TYPE.caption, color: COLOR.text.primary }}>{recovery.conflict.latest.memo || '메모 없음'}</Text>
            </> : null}
          </EditConflictNotice>
          <Field variant={formVariant} label="식재료명" req error={name !== '' ? nameError : undefined}>
            <Input variant={formVariant} value={name} placeholder={id ? '예) 대파' : '식재료명을 입력하세요'} onChangeText={setName} error={name !== '' && Boolean(nameError)} accessibilityLabel="식재료명" />
          </Field>

          <Field variant={formVariant} label="카테고리" req>
            <Select variant={formVariant} value={catLabel} placeholder="카테고리 선택" onPress={() => setCatOpen(true)}
              accessibilityLabel={`카테고리 변경, ${catLabel || '선택 안 함'}`} expanded={catOpen} />
          </Field>

          <Field variant={formVariant} label="개당 용량" req error={vol !== '' ? volError : undefined}>
            <View style={{ flexDirection: 'row', gap: COMPONENT.stackedForm.columnGap }}>
              <View style={{ flex: 1 }}>
                <Input variant={formVariant} value={vol} placeholder="0" onChangeText={(t) => setVol(clampByUnit(t, unit))} mono keyboardType="decimal-pad" error={vol !== '' && Boolean(volError)} accessibilityLabel="개당 용량" />
              </View>
              <View style={{ flex: 1 }}>
                <Select variant={formVariant} textAlign="right" value={unit} onPress={() => setPickerOpen(true)}
                  accessibilityLabel={`단위 ${unit} 변경`} expanded={pickerOpen} />
              </View>
            </View>
          </Field>

          {/* 구매 가격/용량으로 계산한다. 저장 시 메뉴 단가 적용과 다음 입고 평균 전환은 서버가 처리한다. */}
          <StockResultField label="구매 단가" value={previewText} accessibilityLabel="구매 가격과 용량으로 계산한 구매 단가" />
          <Field variant={formVariant} label="구매 가격">
            <Input variant={formVariant} value={price} placeholder="0" onChangeText={(t) => setPrice(clampDecimals(t, 0))} suffix="원" mono keyboardType="number-pad" accessibilityLabel="구매 가격" />
          </Field>

          <View style={{ flexDirection: 'row', gap: COMPONENT.stackedForm.columnGap }}>
            <View style={{ flex: 1 }}>
              {/* 안전재고는 재고와 **같은 단위**다(0073). 팩 개수로 받으면
                  팩 용량을 고칠 때 기준이 소리 없이 따라 움직인다. */}
              <Field variant={formVariant} label="안전재고" req error={safe !== '' ? safeError : undefined}>
                <Input variant={formVariant} value={safe} placeholder="0" onChangeText={(t) => setSafe(clampSignedDecimals(t, 2))} suffix={isMeasure ? unit : dispBase} mono keyboardType="decimal-pad" accessibilityLabel="안전재고" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field variant={formVariant} label="최소 발주" req error={minOrder !== '' ? orderError : undefined}>
                <Input variant={formVariant} value={minOrder} placeholder="1" onChangeText={(t) => setMinOrder(clampSignedDecimals(t, 0))} suffix="개" mono keyboardType="number-pad" accessibilityLabel="최소 발주" />
              </Field>
            </View>
          </View>

          {!id ? (
            <Notice style={{ marginTop: space.xs }}>구매 링크는 저장한 뒤 상세 화면에서 추가할 수 있어요.</Notice>
          ) : null}
        </ScrollView>
      </QueryState>

      <View style={{ paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: space.md, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="md" full disabled={!canSave} loading={save.isPending} onPress={onSave}>
          {id ? '저장' : '추가'}
        </Button>
      </View>

      <UnitPickerSheet
        visible={pickerOpen}
        unit={unit}
        base={id && d ? d.baseUnit === 'ea' ? '개' : d.baseUnit : undefined}
        onSelect={(u) => {
          setVol((p) => convertUnitInput(p, unit, u));
          setSafe((p) => convertUnitInput(p, unit, u));
          setUnit(u);
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
