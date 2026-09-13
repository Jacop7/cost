/** RCP-14 부자재 추가·수정. 저장 직전에 구매 수량을 낱개 단가로 환산한다. */
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Button, Field, Input, Notice, QueryState, Select, Sheet } from '@/components/kit';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { ResultField } from '@/components/kit/ResultField';
import { SelectionRow } from '@/components/kit/SelectionRow';
import { useSaveMaterial, useSettingsLists } from '@/features/master-data/hooks';
import { safeBack } from '@/lib/nav';
import { clampDecimals } from '@/lib/num';
import { T, space, won } from '@/theme/tokens';

const num = (value: string) => Number(value.replace(/,/g, ''));

export default function MaterialFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <MaterialFormEditor key={id ?? 'new'} id={id} />;
}

export function MaterialFormEditor({ id }: { id?: string }) {
  const lists = useSettingsLists();
  const save = useSaveMaterial();
  const editing = lists.data?.materials.find(item => item.id === id);
  const categories = lists.data?.materialCategories ?? [];
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [perBox, setPerBox] = useState('1');
  const [boxPrice, setBoxPrice] = useState('');
  const [unitLabel, setUnitLabel] = useState('개');
  const [catOpen, setCatOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const active = useRef(true);
  const busy = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (!id || !editing || loaded) return;
    setName(editing.name); setCategoryId(editing.categoryId);
    setPerBox('1'); setBoxPrice(String(editing.unitCost)); setUnitLabel(editing.unitLabel);
    setLoaded(true);
  }, [id, editing, loaded]);

  const categoryName = categories.find(item => item.id === categoryId)?.name ?? '';
  const count = num(perBox);
  const price = num(boxPrice);
  const quantityError = !Number.isFinite(count) || count < 1 ? '구매 수량은 1 이상으로 입력해 주세요' : undefined;
  const priceError = !Number.isFinite(price) || price < 0 ? '금액은 0 이상이어야 해요' : undefined;
  const unitPrice = !quantityError && !priceError ? Math.round(price / count) : 0;
  const canSave = name.trim() !== '' && !quantityError && !priceError && !save.isPending
    && !lists.isLoading && !lists.error && (!id || (loaded && Boolean(editing)));
  const back = () => safeBack('/recipes/materials');
  const submit = () => {
    if (!canSave || busy.current) return;
    busy.current = true; setSaveError(null);
    save.mutate({ id, name: name.trim(), categoryId, unitCost: unitPrice,
      unitLabel: unitLabel.trim() || '개', memo: editing?.memo ?? null }, {
      onSuccess: () => { busy.current = false; if (active.current) back(); },
      onError: error => {
        busy.current = false;
        if (active.current) setSaveError(error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요');
      },
    });
  };

  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title={id ? '부자재 수정' : '부자재 추가'} onBack={back} />
    <QueryState isLoading={lists.isLoading || (!!id && !!editing && !loaded)} error={lists.error}
      isEmpty={!!id && !!lists.data && !editing} emptyTitle="부자재를 찾을 수 없어요" onRetry={() => void lists.refetch()}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 24 }}>
        <Field label="부자재명" req variant="stacked">
          <Input variant="stacked" value={name} onChangeText={setName} placeholder="예) 제육볶음 전용 소스팩" accessibilityLabel="부자재명" />
        </Field>
        <Field label="카테고리" variant="stacked">
          <Select variant="stacked" value={categoryName} placeholder="지정 안 함" accessibilityLabel={`카테고리 선택: ${categoryName || '지정 안 함'}`}
            expanded={catOpen} onPress={() => setCatOpen(true)} />
        </Field>
        <Field label="구매 수량" req variant="stacked" error={perBox !== '' ? quantityError : undefined}>
          <Input variant="stacked" value={perBox} onChangeText={value => setPerBox(clampDecimals(value, 0))}
            placeholder="1" suffix={unitLabel} mono keyboardType="number-pad" accessibilityLabel="구매 수량" />
        </Field>
        <Field label="구매 가격" req variant="stacked" error={boxPrice !== '' ? priceError : undefined}>
          <Input variant="stacked" value={boxPrice} onChangeText={value => setBoxPrice(clampDecimals(value, 0))}
            placeholder="0" suffix="원" mono keyboardType="number-pad" accessibilityLabel="구매 가격" />
        </Field>
        <Field label="단위 이름" variant="stacked">
          <Input variant="stacked" value={unitLabel} onChangeText={setUnitLabel} placeholder="개" accessibilityLabel="단위 이름" maxLength={4} />
        </Field>
        <ResultField label="단가 미리보기" value={`${won(unitPrice)}원/${unitLabel || '개'}`} />
        {editing && editing.usedCount > 0 ? <Notice style={{ marginTop: space.md }}>
          단가를 바꾸면 이 부자재를 쓰는 메뉴 {editing.usedCount}개의 원가도 함께 바뀌어요.
        </Notice> : null}
      </ScrollView>
    </QueryState>
    <View style={{ paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: space.md,
      backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
      <Button kind="primary" size="md" full disabled={!canSave} loading={save.isPending} onPress={submit}>저장</Button>
    </View>
    <Sheet visible={catOpen} onClose={() => setCatOpen(false)} title="카테고리 선택">
      <ScrollView contentContainerStyle={{ paddingBottom: space.lg }} showsVerticalScrollIndicator={false}>
        <SelectionRow label="지정 안 함" selected={categoryId === null} last={!categories.length}
          onPress={() => { setCategoryId(null); setCatOpen(false); }} />
        {categories.map((category, index) => <SelectionRow key={category.id} label={category.name}
          selected={categoryId === category.id} last={index === categories.length - 1}
          onPress={() => { setCategoryId(category.id); setCatOpen(false); }} />)}
      </ScrollView>
    </Sheet>
    {saveError !== null ? <ConfirmDialog visible kind="primary" title="저장하지 못했어요" message={saveError}
      confirmText="확인" cancelText={null} closeLabel="저장 오류 닫기"
      onConfirm={() => setSaveError(null)} onCancel={() => setSaveError(null)} /> : null}
  </View>;
}
