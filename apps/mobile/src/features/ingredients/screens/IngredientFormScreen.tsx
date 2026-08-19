/**
 * ING-02 식재료 추가 / ING-04 식재료 수정 — 같은 폼이다.
 *
 * 추가와 수정을 두 파일로 두면 필드 하나를 고칠 때 한쪽만 고쳐 어긋난다.
 * 실제로 이전 구현이 그랬다(수정 화면에만 메모가 있었다). 여기서는 `id` 유무로만 갈린다.
 *
 * ⚠ 절대원칙 1: 화면은 구매단위(kg·L)로 받고, **저장 직전 한 번** 기준단위(g/ml/개)로 환산한다.
 *   환산을 두 군데서 하면 값이 두 번 나뉘거나 곱해진다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { displayToBase, formatQuantity, isDisplayUnit, previewBaseUnitPrice, rawUnitPrice, roundOrNull } from '@sikjae/core';
import { AppHeader, Button, Field, Icon, Input, QueryState, Select } from '../../../components/kit';
import { T } from '../../../theme/tokens';
import { UnitPickerSheet } from '../components/UnitPickerSheet';
import { CategoryPickerSheet } from '../components/CategoryPickerSheet';
import { VendorPickerSheet } from '../components/VendorPickerSheet';
import { safeBack } from '@/lib/nav';
import { clampByUnit, clampDecimals } from '@/lib/num';
import { useSettingsLists } from '@/features/my/hooks';
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
  const [vendorOpen, setVendorOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [name, setName] = useState('');
  const [catId, setCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [vol, setVol] = useState('');
  const [boxQty, setBoxQty] = useState('');
  const [price, setPrice] = useState('');
  const [safe, setSafe] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [memo, setMemo] = useState('');

  // 수정 진입 — 서버 값이 도착하면 폼을 채운다. 사용자가 이미 고친 뒤에는 덮어쓰지 않는다.
  const d = detail.data;
  useEffect(() => {
    if (!id || !d || loaded) return;
    const u = displayUnitOf(d.baseUnit);
    setUnit(u);
    setName(d.name);
    setCatId(d.categoryId);
    setCatName(d.categoryName ?? '');
    setVendorName(d.vendorName);
    setVol(String(d.perVolume));
    setPrice('');
    setSafe(String(d.safetyStock));
    setMinOrder(String(d.minOrderQty));
    setMemo(d.memo ?? '');
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

  // 개당 용량(기준단위). 환산은 @sikjae/core displayToBase 한 곳에서만 한다.
  const perBase = unit === '박스' ? num(boxQty) : isDisplayUnit(unit) ? displayToBase(num(vol), unit) : num(vol);

  // 산출 불가(용량 0·로스율 100% 이상)는 null 로 둔다. 0원으로 위장하면 원가가 0이 되어
  // 순이익이 과대 계상되고 그대로 저장된다(@sikjae/core 경계 계약).
  const rawPer = roundOrNull(rawUnitPrice(num(price), perBase), 2);
  const realPer = roundOrNull(previewBaseUnitPrice(num(price), perBase), 2);

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
        safetyStock: num(safe),
        minOrderQty: num(minOrder) || 1,
        defaultVendorId: vendorId,
        memo: memo.trim() || null,
      },
      {
        onSuccess: (savedId) => {
          if (id) safeBack(`/ingredients/${id}`);
          else router.replace(`/ingredients/${savedId}`);
        },
        onError: (e) => Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
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
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <Field label="식재료명" req error={name !== '' ? nameError : undefined}>
            <Input value={name} placeholder="예) 대파" onChangeText={setName} error={name !== '' && Boolean(nameError)} accessibilityLabel="식재료명" />
          </Field>

          <Field label="카테고리" req>
            <Select value={catLabel} placeholder="카테고리 선택" onPress={() => setCatOpen(true)} />
          </Field>

          <Field label="기본 거래처" hint="발주할 때 기본으로 채워져요">
            <Select value={vendorName ?? ''} placeholder="지정 안 함" onPress={() => setVendorOpen(true)} />
          </Field>

          <Field label="개당 용량" req error={vol !== '' ? volError : undefined} hint="kg·L 입력 시 자동 환산 · '개'는 포장당 개수">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 2 }}>
                <Input value={vol} placeholder="0" onChangeText={(t) => setVol(clampByUnit(t, unit))} mono keyboardType="decimal-pad" error={vol !== '' && Boolean(volError)} accessibilityLabel="개당 용량" />
              </View>
              <Pressable
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button" accessibilityLabel={`단위 ${unit} 변경`}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 }}
              >
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink }}>{unit}</Text>
                <Icon name="chevronDown" size={18} color={T.ter} />
              </Pressable>
            </View>
          </Field>

          {unit === '박스' ? (
            <Field label="박스당 수량" req>
              <Input value={boxQty} placeholder="0" onChangeText={(t) => setBoxQty(clampDecimals(t, 0))} suffix="개" mono keyboardType="number-pad" accessibilityLabel="박스당 수량" />
            </Field>
          ) : null}

          {/*
            구매 가격은 **저장되지 않는다.** 기준단가는 입고(E1) 이력의 가중평균이라
            여기 값은 "이 조건이면 얼마쯤"을 미리 보여주는 계산기다(절대원칙 2).
          */}
          <Field label="구매 가격" hint={id ? '단가 미리보기용 — 실제 단가는 입고 시 기록돼요' : '단가 미리보기용 (저장되지 않아요)'}>
            <Input value={price} placeholder="0" onChangeText={(t) => setPrice(clampDecimals(t, 0))} suffix="원" mono keyboardType="number-pad" accessibilityLabel="구매 가격" />
          </Field>

          {/* 단가 미리보기 — 저장 전에 결과를 눈으로 확인하게 한다. */}
          {num(price) > 0 && perBase > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, backgroundColor: T.blueTint }}>
              <Icon name="info" size={15} color={T.blue} />
              <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: 20 }}>
                {realPer === null
                  ? '입력값으로는 단가를 계산할 수 없어요'
                  : `기준단가 ${realPer}원/${dispBase}`}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="안전재고" req hint="개수 기준">
                <Input value={safe} placeholder="0" onChangeText={(t) => setSafe(clampDecimals(t, 0))} suffix="개" mono keyboardType="number-pad" accessibilityLabel="안전재고" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="최소 발주" req hint="개수 기준">
                <Input value={minOrder} placeholder="1" onChangeText={(t) => setMinOrder(clampDecimals(t, 0))} suffix="개" mono keyboardType="number-pad" accessibilityLabel="최소 발주" />
              </Field>
            </View>
          </View>

          <Field label="메모 (선택)">
            <Input value={memo} placeholder="예) 6월 단가 인상 주의" onChangeText={setMemo} accessibilityLabel="메모" />
          </Field>

          {id ? (
            <View style={{ marginTop: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 8 }}>
                구매 링크 · 옵션 <Text style={{ color: T.ter, fontWeight: '600' }}>({d?.options.length ?? 0}개)</Text>
              </Text>
              <Pressable
                onPress={() => router.push(`/ingredients/option?ingredient=${id}`)}
                accessibilityRole="button" accessibilityLabel="구매 링크·옵션 관리"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.blue, backgroundColor: T.blueTint }}
              >
                <Icon name="plus" size={18} color={T.blue} sw={2.2} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>구매 링크 · 옵션 관리</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: T.surface2 }}>
              <Icon name="info" size={15} color={T.sub2} />
              <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: 20 }}>
                구매 링크·옵션은 저장한 뒤 상세 화면에서 추가할 수 있어요.
              </Text>
            </View>
          )}
        </ScrollView>
      </QueryState>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full disabled={!canSave} loading={save.isPending} onPress={onSave}>
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
      <VendorPickerSheet
        visible={vendorOpen}
        value={vendorId}
        onSelect={(vid, vname) => { setVendorId(vid); setVendorName(vname); }}
        onClose={() => setVendorOpen(false)}
      />
    </View>
  );
}

/** 표기용 — 저장값(기준단위)에서 라벨을 만든다. 입력 문자열을 그대로 쓰면 환산 전 값이 남는다. */
export const perLabelOf = (perBase: number, base: BaseUnit) =>
  formatQuantity(perBase, base === 'ea' ? '개' : base, { maxDigits: 3 });
