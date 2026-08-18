// IngredientEditScreen.tsx — ING-04 식재료 수정 (ScreenING03)
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { displayToBase, isDisplayUnit, previewBaseUnitPrice, rawUnitPrice, round, roundOrNull } from '@sikjae/core';
import { AppHeader, Field, Input, Select, Button, Icon } from '../../../components/kit';
import { T, tnum } from '../../../theme/tokens';
import { optionsFor } from '../demoData';
import { safeBack } from '@/lib/nav';
import { clampByUnit, clampDecimals, dash } from '@/lib/num';
import { useIngredients } from '../store';
import { UnitPickerSheet } from '../components/UnitPickerSheet';
import { CategoryPickerSheet } from '../components/CategoryPickerSheet';

type LossMode = 'pct' | 'qty';

const num = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};
const baseUnitOf = (u: string): 'g' | 'ml' | '개' => (u === 'kg' || u === 'g' ? 'g' : u === 'L' || u === 'ml' ? 'ml' : '개');
// 기준단위 → 편집 표기단위(큰 단위 우선).
const dispUnitOf = (base: 'g' | 'ml' | '개', per: number) => (base === '개' ? '개' : per >= 1000 ? (base === 'ml' ? 'L' : 'kg') : base);

export function IngredientEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = useIngredients((s) => s.items);
  const update = useIngredients((s) => s.update);
  const remove = useIngredients((s) => s.remove);
  const g = (items.find((x) => x.id === id) || items[0])!;

  const initUnit = dispUnitOf(g.unit, g.per);
  // 역방향 환산(저장 최소단위 → 편집 표기 단위). displayToBase 의 배수와 같은 값을 써야 왕복이 맞는다.
  const initFactor = isDisplayUnit(initUnit) ? displayToBase(1, initUnit) : 1;
  const initRaw = round(g.price * (1 - g.loss / 100), 2); // 로스 반영 전 단가
  const opts = optionsFor(g.name);

  const [lossMode, setLossMode] = useState<LossMode>('pct');
  const [unit, setUnit] = useState(initUnit);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  const [name, setName] = useState(g.name);
  const [cat, setCat] = useState(g.cat);
  const [vol, setVol] = useState(clampByUnit(String(round(g.per / initFactor, 3)), initUnit));
  const [boxQty, setBoxQty] = useState(String(g.per));
  const [price, setPrice] = useState(String(Math.round(initRaw * g.per)));
  const [lossVal, setLossVal] = useState(String(g.loss));
  const [safe, setSafe] = useState(String(g.safe));
  const [minOrder, setMinOrder] = useState('1');

  const isMeasure = !(unit === '박스' || unit === '개');
  const base = baseUnitOf(unit);
  // 환산은 @sikjae/core displayToBase 한 곳에서만 한다(절대원칙 1 — 저장 직전 1회 환산).
  const perBase = unit === '박스' ? num(boxQty) : isDisplayUnit(unit) ? displayToBase(num(vol), unit) : num(vol);
  const lossPct = lossMode === 'pct' ? num(lossVal) : isMeasure ? (num(lossVal) / 1000) * 100 : (num(lossVal) / 30) * 100;
  // 산출 불가는 null 유지(@sikjae/core 경계 계약). 저장 시 기존 값을 지키고 표시는 '-'.
  const rawPer = roundOrNull(rawUnitPrice(num(price), perBase), 2);
  const realPer = roundOrNull(previewBaseUnitPrice(num(price), perBase, lossPct / 100), 2);
  const boxEach = unit === '박스' && num(boxQty) > 0 ? round(num(price) / num(boxQty), 2) : 0;

  const onSave = () => {
    update(g.id, {
      name: name.trim() || g.name,
      cat,
      unit: base,
      per: perBase > 0 ? perBase : g.per,
      priceUnit: `원/${base}`,
      price: realPer ?? g.price,
      loss: Math.round(lossPct),
      lossReal: round(lossPct, 1),
      safe: num(safe),
      avg: rawPer ?? g.avg,
      low: rawPer ?? g.low,
      high: rawPer ?? g.high,
      recent: rawPer ?? g.recent,
    });
    safeBack();
  };
  const onDelete = () => {
    remove(g.id);
    router.replace('/ingredients'); // 삭제된 상세로 돌아가지 않도록 목록으로
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="식재료 수정" onBack={() => safeBack()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Field label="식재료명" req><Input value={name} onChangeText={setName} /></Field>
        <Field label="카테고리" req><Select value={cat} onPress={() => setCatOpen(true)} /></Field>

        <Field label="용량" req hint="kg·L 입력 시 자동 환산 · '개'는 포장당 개수">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 2 }}><Input value={vol} onChangeText={(t) => setVol(clampByUnit(t, unit))} mono keyboardType="decimal-pad" /></View>
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
          <Field label="박스당 수량" req><Input value={boxQty} onChangeText={(t) => setBoxQty(clampDecimals(t, 0))} suffix="개" mono keyboardType="number-pad" /></Field>
        ) : null}

        <Field label="구매 가격" req><Input value={price} onChangeText={(t) => setPrice(clampDecimals(t, 0))} suffix="원" mono keyboardType="number-pad" /></Field>

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
            <Input value={lossVal} onChangeText={(t) => setLossVal(clampDecimals(t, 1))} suffix="%" mono keyboardType="number-pad" />
          ) : (
            <View>
              <Input value={lossVal} onChangeText={(t) => setLossVal(clampByUnit(t, unit))} suffix={'/ ' + (isMeasure ? '1,000' + unit : '30개') + ' 중'} mono keyboardType="number-pad" />
              <View style={{ backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, marginTop: 9 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>로스율 <Text style={{ fontWeight: '800' }}>{round(lossPct, 1)}%</Text></Text>
              </View>
            </View>
          )}
        </Field>

        {/* 단가 미리보기 */}
        <View style={{ backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 11 }}>
            <Icon name="info" size={17} color={T.blue} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>단가 미리보기</Text>
          </View>
          {unit === '박스' ? (
            <>
              <PreviewRow label="박스 단가" value={String(num(price))} unit="원/박스" />
              <PreviewRow label="낱개 단가" hint={`(${num(price)} ÷ ${num(boxQty) || 0})`} value={String(boxEach)} unit="원/개" />
              <PreviewFinal lossPct={round(lossPct, 1)} value={dash(realPer)} unit="원/개" />
            </>
          ) : (
            <>
              <PreviewRow label="구매가 단가" value={dash(rawPer)} unit={`원/${base}`} />
              <PreviewFinal lossPct={round(lossPct, 1)} value={dash(realPer)} unit={`원/${base}`} />
            </>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="안전재고" req><Input value={safe} onChangeText={(t) => setSafe(clampByUnit(t, unit))} suffix={unit} mono keyboardType="decimal-pad" /></Field></View>
          <View style={{ flex: 1 }}><Field label="최소 발주" req><Input value={minOrder} onChangeText={(t) => setMinOrder(clampByUnit(t, unit))} suffix={unit} mono keyboardType="decimal-pad" /></Field></View>
        </View>

        {/* 구매 링크 · 옵션 */}
        <View style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 8 }}>
            구매 링크 · 옵션 <Text style={{ color: T.ter, fontWeight: '600' }}>(선택)</Text>
          </Text>
          <View style={{ gap: 8, marginBottom: 10 }}>
            {opts.map((o, i) => (
              <Pressable key={i} onPress={() => router.push(`/ingredients/option?mode=edit&oi=${i}&base=${g.unit}&recent=${g.recent}&rvendor=${encodeURIComponent(g.vendor)}&rname=${encodeURIComponent(g.name)}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 13, backgroundColor: T.surface2, borderRadius: 11 }}>
                <Icon name="link" size={17} color={T.blue} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{o.name}, {o.price}</Text>
                  <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{o.vendor} · {o.per}원/{g.unit}</Text>
                </View>
                <Icon name="chevron" size={18} color={T.line3} />
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => router.push(`/ingredients/option?mode=add&base=${g.unit}&recent=${g.recent}&rvendor=${encodeURIComponent(g.vendor)}&rname=${encodeURIComponent(g.name)}`)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.blue, backgroundColor: T.blueTint }}>
            <Icon name="plus" size={18} color={T.blue} sw={2.2} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>구매 링크 · 옵션 추가</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="danger" size="lg" style={{ flex: 1 }} onPress={onDelete}>삭제</Button>
        <Button kind="primary" size="lg" style={{ flex: 2 }} onPress={onSave}>저장</Button>
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
        base={g.unit}
      />
      <CategoryPickerSheet visible={catOpen} value={cat} onSelect={setCat} onClose={() => setCatOpen(false)} />
    </View>
  );
}

function PreviewRow({ label, hint, value, unit }: { label: string; hint?: string; value: string; unit: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub2 }}>
        {label} {hint ? <Text style={{ color: T.ter }}>{hint}</Text> : null}
      </Text>
      <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, tnum]}>
        {value}<Text style={{ fontSize: 16, color: T.sub2 }}>{unit}</Text>
      </Text>
    </View>
  );
}

function PreviewFinal({ lossPct, value, unit }: { lossPct: number; value: string; unit: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: T.blueLine }}>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.blue }}>
        실사용 단가 <Text style={{ fontWeight: '600' }}>(로스 {lossPct}% 반영)</Text>
      </Text>
      <Text style={[{ fontSize: 18, fontWeight: '800', color: T.blue }, tnum]}>
        {value}<Text style={{ fontSize: 16 }}>{unit}</Text>
      </Text>
    </View>
  );
}
