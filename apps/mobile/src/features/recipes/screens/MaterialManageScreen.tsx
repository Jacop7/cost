/**
 * RCP-13 부자재 관리 (+ RCP-14 부자재 수정 시트) — 부자재 마스터 수정·삭제·추가.
 * 개당 단가는 구매 단위(박스)로 입력하면 낱개 단가로 자동 환산(미리보기).
 * ⚠ 디자인 프로토타입(정적·데모). 실제 저장(부자재 마스터)은 데이터 연결 단계에서.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Button, Card, Field, FAB, Icon, Input, Select, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { DEMO_MATERIALS, MaterialData } from '../demoData';

export default function MaterialManageScreen() {
  const [items, setItems] = useState<MaterialData[]>(DEMO_MATERIALS);
  const [edit, setEdit] = useState<MaterialData | null>(null); // 수정 시트 대상(null=닫힘)

  const remove = (idx: number) => setItems((xs) => xs.filter((_, i) => i !== idx));

  // 수정 시트 데모 값 — 박스 100개 · 20,000원 → 낱개 200원/개
  const perBox = 100;
  const boxPrice = 20000;
  const unitPrice = Math.round(boxPrice / perBox);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="부자재 관리" onBack={() => safeBack('/recipes')} />

      {/* 검색 바 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
          <Icon name="search" size={20} color={T.ter} />
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: T.ter }}>부자재 이름으로 검색</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: T.sub2, marginBottom: 11 }}>등록된 부자재 {items.length}</Text>

        <Card pad={0} style={{ overflow: 'hidden' }}>
          {items.map((m, i) => (
            <View
              key={m.name}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingLeft: 14, paddingRight: 10, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}
            >
              <Icon name="grip" size={20} color={T.line3} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>{m.name}</Text>
                  <Badge tone="neutral" sm>{m.cat}</Badge>
                </View>
                <Text style={{ fontSize: 14, color: T.sub2, marginTop: 4, fontWeight: '600' }}>
                  기준 단가 <Text style={{ color: T.ink, fontWeight: '700' }}>{won(m.price)}원/{m.unit}</Text>
                </Text>
              </View>
              <Pressable onPress={() => setEdit(m)} hitSlop={4} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="부자재 수정">
                <Icon name="edit" size={18} color={T.ter} sw={2} />
              </Pressable>
              <Pressable onPress={() => remove(i)} hitSlop={4} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="부자재 삭제">
                <Icon name="close" size={19} color={T.ter} />
              </Pressable>
            </View>
          ))}
        </Card>
      </ScrollView>

      <FAB label="부자재 추가" onPress={() => setEdit({ name: '', cat: '소스·양념', price: 0, unit: '개' })} />

      {/* RCP-14 부자재 수정 시트 */}
      <Sheet visible={edit != null} onClose={() => setEdit(null)} title="부자재 수정" sub="구매 단위로 입력하면 개당 단가가 자동 계산돼요" height={600}>
        {edit ? (
          <View>
            <Field label="부자재명" req><Input value={edit.name} placeholder="예) 제육볶음 전용 소스팩" /></Field>
            <Field label="개당 용량" req hint="박스로 사도 낱개(개) 단가로 자동 환산돼요">
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 2 }}><Input value="1" mono /></View>
                <View style={{ flex: 1 }}><Select value="박스" /></View>
              </View>
            </Field>
            <Field label="박스당 수량" req><Input value={String(perBox)} suffix="개" mono /></Field>
            <Field label="구매 가격" req><Input value={won(boxPrice)} suffix="원" mono /></Field>

            {/* 단가 미리보기 */}
            <View style={{ backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 11 }}>
                <Icon name="info" size={17} color={T.blue} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>단가 미리보기</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub2 }}>박스 단가</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>
                  {won(boxPrice)}<Text style={{ fontSize: 14, color: T.sub2 }}>원/박스</Text>
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 9, borderTopWidth: 1, borderTopColor: T.blue + '33' }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.blue }}>
                  낱개 단가 <Text style={{ fontWeight: '600', color: T.sub2 }}>({won(boxPrice)} ÷ {perBox})</Text>
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: T.blue }}>
                  {won(unitPrice)}<Text style={{ fontSize: 14 }}>원/개</Text>
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 9, marginTop: 18 }}>
              <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={() => setEdit(null)}>취소</Button></View>
              <View style={{ flex: 2 }}><Button kind="primary" size="lg" full onPress={() => setEdit(null)}>저장</Button></View>
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
