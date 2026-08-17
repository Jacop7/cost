/**
 * MY-04 단위 설정 — 단위 시스템(미터법·미국식·영국식) 선택 → 무게/부피 단위·환산·조리컵 기본값 반영.
 * 조리컵은 사용자 설정, 스푼(큰15·작은5ml)·개·박스는 공통. 내부 저장은 항상 g·ml·개.
 * ⚠ 디자인 프로토타입(로컬 상태·데모).
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Card, Icon, Input } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';

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
  const [sysIdx, setSysIdx] = useState(0);
  const sys = SYSTEMS[sysIdx]!;
  const [cup, setCup] = useState<string>(String(sys.cup)); // 1컵 ml (사용자 입력)
  const [bigSpoon, setBigSpoon] = useState('15'); // 큰스푼 ml
  const [smallSpoon, setSmallSpoon] = useState('5'); // 작은스푼 ml

  const selectSys = (i: number) => { setSysIdx(i); setCup(String(SYSTEMS[i]!.cup)); };

  // 개수 단위 — '개'가 기본(하위), 박스·판·망 등은 상위 포장단위(1 묶음 = N개). 무게 g→kg, 부피 ml→L 와 동일 상하위.
  const [pkg, setPkg] = useState<{ name: string; per: string }[]>([{ name: '박스', per: '30' }]);
  const setPkgName = (i: number, v: string) => setPkg((xs) => xs.map((u, k) => (k === i ? { ...u, name: v } : u)));
  const setPkgPer = (i: number, v: string) => setPkg((xs) => xs.map((u, k) => (k === i ? { ...u, per: v.replace(/[^0-9]/g, '') } : u)));
  const removePkg = (i: number) => setPkg((xs) => xs.filter((_, k) => k !== i));
  const addPkg = () => setPkg((xs) => [...xs, { name: '', per: '' }]);

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

        {/* 개수 단위 — 개(기본/하위) + 상위 포장단위(1 박스 = N개). g→kg·ml→L 와 같은 상하위 */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginHorizontal: 4, marginBottom: 8 }}>개수 단위</Text>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {/* 기본(하위) 단위 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>개</Text>
            <Text style={{ fontSize: 14, color: T.ter, marginRight: 8 }}>기본 단위 (하위)</Text>
            <Badge tone="neutral" sm>기본</Badge>
          </View>
          {/* 상위 포장단위 헤더 */}
          <View style={{ paddingVertical: 11, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>상위 포장단위 · 1 묶음당 개수</Text>
          </View>
          {/* 상위 단위 행 (1 [이름] = [N]개) */}
          {pkg.map((u, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingLeft: 15, paddingRight: 8, borderBottomWidth: i < pkg.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub2 }}>1</Text>
              <View style={{ flex: 1.4 }}><Input value={u.name} placeholder="예: 박스·판·망" onChangeText={(v) => setPkgName(i, v)} /></View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub2 }}>=</Text>
              <View style={{ width: 92 }}><Input value={u.per} suffix="개" mono keyboardType="number-pad" onChangeText={(v) => setPkgPer(i, v)} /></View>
              <Pressable onPress={() => removePkg(i)} hitSlop={4} style={{ width: 32, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={19} color={T.ter} />
              </Pressable>
            </View>
          ))}
        </Card>
        <Pressable onPress={addPkg} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 14, marginTop: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: T.blue, backgroundColor: T.blueTint }}>
          <Icon name="plus" size={17} color={T.blue} sw={2.2} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>포장단위 추가</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 7, marginHorizontal: 4, marginTop: 16, alignItems: 'flex-start' }}>
          <Icon name="info" size={15} color={T.ter} />
          <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>박스·판·망은 '개'의 상위 단위예요(1 박스 = N 개). 여기 값은 기본이고, 품목마다 다르면 등록 시 개별 지정할 수 있어요. 내부 저장은 항상 g·ml·개.</Text>
        </View>
      </ScrollView>
    </View>
  );
}
