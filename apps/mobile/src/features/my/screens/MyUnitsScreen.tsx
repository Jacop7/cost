/**
 * MY-04 단위 설정 — 단위 시스템(미터법·미국식·영국식) 선택 → 무게/부피 단위·환산·조리컵 기본값 반영.
 * 조리컵·스푼·묶음단위(박스·판 등)는 사용자 설정. '개'가 기본(최소) 단위. 내부 저장은 항상 g·ml·개.
 * ⚠ 디자인 프로토타입(로컬 상태·데모).
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { UNIT_PRICE_DIGIT_OPTIONS, formatUnitPrice, getLocale, unitPriceDigits } from '@sikjae/core';
import { AppHeader, Button, Card, Field, Icon, Input, Notice, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { useSettings, useUnitDigits } from '../store';

/** 자릿수 견본에 쓰는 실값 — 대파 4,000원/1,000g · 로스 15% → 4.7058…원/g (검산 기준값). */
const DEMO_UNIT_PRICE = 4000 / 1000 / (1 - 0.15);

interface UnitSystem {
  name: string;
  base?: boolean;
  weight: string;
  weightConv: string;
  volume: string;
  volumeConv: string;
  cup: number; // 조리컵 기본 용량(ml)
}
const SYSTEMS: UnitSystem[] = [
  { name: '미터법', base: true, weight: 'g · kg', weightConv: '1 kg = 1,000 g', volume: 'ml · L', volumeConv: '1 L = 1,000 ml', cup: 200 },
  { name: '미국식', weight: 'oz · lb', weightConv: '1 lb = 16 oz', volume: 'fl oz · pt · qt · gal', volumeConv: '1 pt = 16 fl oz · 1 qt = 2 pt · 1 gal = 4 qt', cup: 240 },
  { name: '영국식', weight: 'oz · lb', weightConv: '1 lb = 16 oz', volume: 'fl oz · pt · qt · gal', volumeConv: '1 pt = 20 fl oz · 1 qt = 2 pt · 1 gal = 4 qt', cup: 250 },
];
function DetailRow({ label, value, conv, last }: { label: string; value: string; conv?: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 }}>
      <Text style={{ width: 64, fontSize: 16, fontWeight: '600', color: T.sub }}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{value}</Text>
        {conv ? <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, { fontVariant: ['tabular-nums'] }]}>{conv}</Text> : null}
      </View>
    </View>
  );
}

export default function MyUnitsScreen() {
  // 단가 자릿수 — 로케일 기본값(금액+2)을 따르되 사용자가 덮어쓸 수 있다.
  // 기본값과 같은 값을 고르면 override 를 지워(null) 언어를 바꿔도 새 기본값을 따라가게 한다.
  const locale = useSettings((s) => s.locale);
  const setUnitDigits = useSettings((s) => s.setUnitDigits);
  const digits = useUnitDigits();
  const defaultDigits = unitPriceDigits(locale);
  const L = getLocale(locale);

  const [sysIdx, setSysIdx] = useState(0);
  const sys = SYSTEMS[sysIdx]!;
  const [cup, setCup] = useState<string>(String(sys.cup)); // 1컵 ml (사용자 입력)
  const [bigSpoon, setBigSpoon] = useState('15'); // 큰스푼 ml
  const [smallSpoon, setSmallSpoon] = useState('5'); // 작은스푼 ml

  const selectSys = (i: number) => { setSysIdx(i); setCup(String(SYSTEMS[i]!.cup)); };

  // 개수 단위 — 낱개(개·모·마리 등) 위에 박스·판 등 묶음(1 묶음 = per × base). 편집은 시트에서 폼으로.
  const [pkg, setPkg] = useState<{ name: string; per: string; base: string }[]>([{ name: '박스', per: '30', base: '개' }]);
  const [edit, setEdit] = useState<{ i: number; name: string; per: string; base: string } | null>(null); // 편집 시트(i<0=신규)
  const removePkg = (i: number) => setPkg((xs) => xs.filter((_, k) => k !== i));
  const openAdd = () => setEdit({ i: -1, name: '', per: '', base: '개' });
  const openEdit = (i: number) => { const u = pkg[i]!; setEdit({ i, name: u.name, per: u.per, base: u.base }); };
  const saveEdit = () => {
    if (!edit) return;
    const name = edit.name.trim();
    const per = edit.per.trim();
    const base = edit.base.trim() || '개';
    if (!name || !per) return;
    setPkg((xs) => (edit.i < 0 ? [...xs, { name, per, base }] : xs.map((u, k) => (k === edit.i ? { name, per, base } : u))));
    setEdit(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="단위 설정" onBack={() => safeBack('/my')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 }}>
        {/* 단위 시스템 선택 */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginHorizontal: 4, marginBottom: 8 }}>단위 시스템</Text>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
          {SYSTEMS.map((s, i) => {
            const on = i === sysIdx;
            return (
              <Pressable key={s.name} onPress={() => selectSys(i)} style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: i < SYSTEMS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{s.name}{s.base ? <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}> (기본)</Text> : null}</Text>
                  <Text style={{ fontSize: 14, color: T.ter, marginTop: 3 }}>{s.weight} · {s.volume}</Text>
                </View>
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: on ? 7 : 2, borderColor: on ? T.blue : T.line }} />
              </Pressable>
            );
          })}
        </Card>

        {/* 선택 시스템 무게·부피 단위 */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginHorizontal: 4, marginBottom: 8 }}>{sys.name} 무게·부피 단위</Text>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
          <DetailRow label="무게" value={sys.weight} conv={sys.weightConv} />
          <DetailRow label="부피" value={sys.volume} conv={sys.volumeConv} last />
        </Card>

        {/* 조리컵 · 스푼 (사용자 직접 입력) */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginHorizontal: 4, marginBottom: 8 }}>조리컵 · 스푼 (직접 입력)</Text>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
          {/* 1컵 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>1컵</Text>
              <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{sys.name} 기본 {sys.cup}ml</Text>
            </View>
            <View style={{ width: 120 }}>
              <Input value={cup} suffix="ml" mono keyboardType="number-pad" onChangeText={(t) => setCup(t.replace(/[^0-9]/g, ''))} />
            </View>
          </View>
          {/* 큰스푼 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>큰스푼</Text>
            <View style={{ width: 120 }}>
              <Input value={bigSpoon} suffix="ml" mono keyboardType="number-pad" onChangeText={(t) => setBigSpoon(t.replace(/[^0-9]/g, ''))} />
            </View>
          </View>
          {/* 작은스푼 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>작은스푼</Text>
            <View style={{ width: 120 }}>
              <Input value={smallSpoon} suffix="ml" mono keyboardType="number-pad" onChangeText={(t) => setSmallSpoon(t.replace(/[^0-9]/g, ''))} />
            </View>
          </View>
        </Card>

        {/* 단가 표기 자릿수 — 이 화면에서 유일하게 "취향"이 갈리는 값.
            구분자·통화·금액 자릿수는 사실이라 언어·통화(MY-08)가 정하고, 여기선 단가만 고른다. */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginHorizontal: 4, marginBottom: 6 }}>단가 표기 자릿수</Text>
        <Notice style={{ marginBottom: 10 }}>식재료 단가·원가가 이 자릿수로 보여요. 표기만 바뀌고 저장·계산은 원래 값 그대로예요.</Notice>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
          {UNIT_PRICE_DIGIT_OPTIONS.map((d, i) => {
            const on = d === digits;
            const isDefault = d === defaultDigits;
            // 서식 견본 라벨 — 소수점 문자는 로케일을 따른다(독일이면 0,00).
            const pattern = d === 0 ? '0' : '0' + L.decimal + '0'.repeat(d);
            return (
              <Pressable
                key={d}
                onPress={() => setUnitDigits(isDefault ? null : d)}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: i < UNIT_PRICE_DIGIT_OPTIONS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}
              >
                <Text style={[{ width: 74, fontSize: 16, fontWeight: '600', color: T.sub }, { fontVariant: ['tabular-nums'] }]}>{pattern}</Text>
                <Text style={[{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: '700', color: T.ink }, { fontVariant: ['tabular-nums'] }]}>{formatUnitPrice(DEMO_UNIT_PRICE, 'g', locale, d)}</Text>
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: on ? 7 : 2, borderColor: on ? T.blue : T.line, marginLeft: 12 }} />
              </Pressable>
            );
          })}
        </Card>

        {/* 개수 단위 — '개'가 기본(최소) 단위. 박스·판 등 자주 쓰는 묶음 단위 등록(리스트 + 편집 시트). */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginHorizontal: 4, marginBottom: 6 }}>개수 단위</Text>
        <Notice style={{ marginBottom: 10 }}>기본 단위는 개예요. 박스·판처럼 자주 쓰는 묶음 단위를 등록해두면 식재료 등록할 때 골라 쓸 수 있어요.</Notice>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {pkg.length === 0 ? (
            <View style={{ paddingVertical: 20, paddingHorizontal: 15, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: T.ter }}>등록된 묶음 단위가 없어요.</Text>
            </View>
          ) : (
            pkg.map((u, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingLeft: 15, paddingRight: 10, borderBottomWidth: i < pkg.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{u.name}</Text>
                  <Text style={{ fontSize: 14, color: T.sub2, marginTop: 3, fontWeight: '600' }}>{u.per}{u.base}들이</Text>
                </View>
                <Pressable onPress={() => openEdit(i)} hitSlop={4} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="묶음 단위 수정">
                  <Icon name="edit" size={18} color={T.ter} sw={2} />
                </Pressable>
                <Pressable onPress={() => removePkg(i)} hitSlop={4} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="묶음 단위 삭제">
                  <Icon name="close" size={19} color={T.ter} />
                </Pressable>
              </View>
            ))
          )}
        </Card>
        <Pressable onPress={openAdd} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 14, marginTop: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: T.blue, backgroundColor: T.blueTint }}>
          <Icon name="plus" size={17} color={T.blue} sw={2.2} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>묶음 단위 추가</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 7, marginHorizontal: 4, marginTop: 16, alignItems: 'flex-start' }}>
          <Icon name="info" size={15} color={T.ter} />
          <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>여기 값은 기본이에요. 품목마다 묶음 수량이 다르면 등록할 때 개별 지정할 수 있어요. 내부 저장은 항상 g·ml·개.</Text>
        </View>
      </ScrollView>

      {/* 묶음 단위 추가·수정 시트 */}
      <Sheet visible={edit != null} onClose={() => setEdit(null)} title={edit && edit.i < 0 ? '묶음 단위 추가' : '묶음 단위 수정'} sub="박스·판처럼 여러 개를 묶는 단위예요" height={380}>
        {edit ? (
          <View>
            <Field label="단위 이름" req>
              <Input value={edit.name} placeholder="예: 박스·판·망" onChangeText={(v) => setEdit({ ...edit, name: v })} />
            </Field>
            <Field label="1묶음 수량" req hint="한 묶음에 든 개수와 낱개 단위명(개·모·마리·장 등)">
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 2 }}><Input value={edit.per} placeholder="0" mono keyboardType="number-pad" onChangeText={(v) => setEdit({ ...edit, per: v.replace(/[^0-9]/g, '') })} /></View>
                <View style={{ flex: 1 }}><Input value={edit.base} placeholder="개" onChangeText={(v) => setEdit({ ...edit, base: v })} /></View>
              </View>
            </Field>
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 8 }}>
              <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={() => setEdit(null)}>취소</Button></View>
              <View style={{ flex: 2 }}><Button kind="primary" size="lg" full onPress={saveEdit}>저장</Button></View>
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
