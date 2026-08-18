// IngredientAddScreen.tsx — ING-02 식재료 추가 (ScreenINGAdd)
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { displayToBase, formatQuantity, isDisplayUnit, previewBaseUnitPrice, rawUnitPrice, round, roundOrNull } from '@sikjae/core';
import { AppHeader, Field, Input, Select, Button, Icon } from '../../../components/kit';
import { T } from '../../../theme/tokens';
import { UnitPickerSheet } from '../components/UnitPickerSheet';
import { CategoryPickerSheet } from '../components/CategoryPickerSheet';
import { safeBack } from '@/lib/nav';
import { clampByUnit, clampDecimals } from '@/lib/num';
import { useIngredients } from '../store';

type LossMode = 'pct' | 'qty';

const num = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};
const baseUnitOf = (u: string): 'g' | 'ml' | '개' => (u === 'kg' || u === 'g' ? 'g' : u === 'L' || u === 'ml' ? 'ml' : '개');

export function IngredientAddScreen() {
  const router = useRouter();
  const add = useIngredients((s) => s.add);
  const [unit, setUnit] = useState('kg');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [lossMode, setLossMode] = useState<LossMode>('pct');

  const [name, setName] = useState('');
  const [cat, setCat] = useState('');
  const [vol, setVol] = useState('');
  const [boxQty, setBoxQty] = useState('');
  const [price, setPrice] = useState('');
  const [lossVal, setLossVal] = useState('');
  const [safe, setSafe] = useState('');
  const [minOrder, setMinOrder] = useState('');

  const isMeasure = !(unit === '박스' || unit === '개');

  // 개당 용량(기준단위) · 로스율(%) · 단가.
  // 환산은 @sikjae/core displayToBase 한 곳에서만 한다(절대원칙 1 — 저장 직전 1회 환산).
  const perBase = unit === '박스' ? num(boxQty) : isDisplayUnit(unit) ? displayToBase(num(vol), unit) : num(vol);
  const lossPct = lossMode === 'pct' ? num(lossVal) : isMeasure ? (num(lossVal) / 1000) * 100 : (num(lossVal) / 30) * 100;
  const base = baseUnitOf(unit);
  // 산출 불가(용량 0·로스율 100% 이상)는 null 로 유지한다. 0원으로 위장하면 원가가 0이 되어
  // 순이익이 과대 계상되고 그대로 저장된다(@sikjae/core 경계 계약).
  const rawPer = roundOrNull(rawUnitPrice(num(price), perBase), 2);
  const realPer = roundOrNull(previewBaseUnitPrice(num(price), perBase, lossPct / 100), 2);

  // 단가를 산출하지 못하면 저장할 수 없다 — 오염된 단가가 DB로 들어가는 것을 막는다.
  const canSave =
    name.trim() !== '' && cat !== '' && perBase > 0 && num(price) > 0 && realPer !== null && rawPer !== null;

  const onAdd = () => {
    if (!canSave) return;
    add({
      name: name.trim(),
      cat,
      status: 'ok',
      unit: base,
      per: perBase,
      // 저장값(기준단위)에서 표기를 만든다. 입력 문자열을 그대로 붙이면 환산 전 값이 라벨로 남는다.
      perLabel: unit === '박스' ? `${num(boxQty)}개` : formatQuantity(perBase, base, { maxDigits: 3 }),
      sealed: 1,
      opened: 0,
      soon: false,
      safe: num(safe),
      price: realPer ?? 0,
      priceUnit: `원/${base}`,
      loss: Math.round(lossPct),
      lossReal: round(lossPct, 1),
      last: '—',
      vendor: '',
      avg: rawPer ?? 0,
      low: rawPer ?? 0,
      high: rawPer ?? 0,
      recent: rawPer ?? 0,
      memo: '',
      warn: false,
      stock: perBase,
    });
    safeBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="식재료 추가" onBack={() => safeBack()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Field label="식재료명" req><Input value={name} placeholder="예) 대파" onChangeText={setName} /></Field>
        <Field label="카테고리" req><Select value={cat} placeholder="카테고리 선택" onPress={() => setCatOpen(true)} /></Field>

        <Field label="용량" req hint="kg·L 입력 시 자동 환산 · '개'는 포장당 개수">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 2 }}><Input value={vol} placeholder="0" onChangeText={(t) => setVol(clampByUnit(t, unit))} mono keyboardType="decimal-pad" /></View>
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 }}
            >
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink }}>{unit}</Text>
              <Icon name="chevronDown" size={18} color={T.ter} />
            </Pressable>
          </View>
        </Field>

        {unit === '박스' ? (
          <Field label="박스당 수량" req><Input value={boxQty} placeholder="0" onChangeText={(t) => setBoxQty(clampDecimals(t, 0))} suffix="개" mono keyboardType="number-pad" /></Field>
        ) : null}

        <Field label="구매 가격" req><Input value={price} placeholder="0" onChangeText={(t) => setPrice(clampDecimals(t, 0))} suffix="원" mono keyboardType="number-pad" /></Field>

        <Field
          label="로스율"
          req
          right={
            <View style={{ flexDirection: 'row', gap: 3, padding: 3, backgroundColor: T.line, borderRadius: 9 }}>
              {(['pct', 'qty'] as LossMode[]).map((k) => {
                const on = lossMode === k;
                return (
                  <Pressable key={k} onPress={() => setLossMode(k)} style={{ paddingVertical: 5, paddingHorizontal: 13, borderRadius: 7, backgroundColor: on ? T.surface : 'transparent', shadowColor: '#000', shadowOpacity: on ? 0.1 : 0, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: on ? 1 : 0 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: on ? T.ink : T.sub2 }}>{k === 'pct' ? '%' : '수량'}</Text>
                  </Pressable>
                );
              })}
            </View>
          }
        >
          {lossMode === 'pct' ? (
            <Input value={lossVal} placeholder="0" onChangeText={(t) => setLossVal(clampDecimals(t, 1))} suffix="%" mono keyboardType="number-pad" />
          ) : (
            <Input value={lossVal} placeholder="0" onChangeText={(t) => setLossVal(clampByUnit(t, unit))} suffix={'/ ' + (isMeasure ? '1,000' + unit : '30개') + ' 중'} mono keyboardType="number-pad" />
          )}
        </Field>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="안전재고" req><Input value={safe} placeholder="0" onChangeText={(t) => setSafe(clampByUnit(t, unit))} suffix={unit} mono keyboardType="decimal-pad" /></Field></View>
          <View style={{ flex: 1 }}><Field label="최소 발주" req><Input value={minOrder} placeholder="0" onChangeText={(t) => setMinOrder(clampByUnit(t, unit))} suffix={unit} mono keyboardType="decimal-pad" /></Field></View>
        </View>

        <View style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 8 }}>
            구매 링크 · 옵션 <Text style={{ color: T.ter, fontWeight: '600' }}>(선택)</Text>
          </Text>
          <Pressable onPress={() => router.push(`/ingredients/option?mode=add&base=${base}`)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.blue, backgroundColor: T.blueTint }}>
            <Icon name="plus" size={18} color={T.blue} sw={2.2} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>구매 링크 · 옵션 추가</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        {/* 색만 바꾸던 자리 — 실제로 터치가 차단되고 접근성에도 비활성이 전달되도록 disabled 를 쓴다. */}
        <Button kind="primary" size="lg" full disabled={!canSave} onPress={onAdd}>추가</Button>
      </View>

      <UnitPickerSheet
        visible={pickerOpen}
        unit={unit}
        onSelect={(u) => {
          setUnit(u);
          setVol((p) => clampByUnit(p, u));
          setSafe((p) => clampByUnit(p, u));
          setMinOrder((p) => clampByUnit(p, u));
        }}
        onClose={() => setPickerOpen(false)}
      />
      <CategoryPickerSheet visible={catOpen} value={cat} onSelect={setCat} onClose={() => setCatOpen(false)} />
    </View>
  );
}
