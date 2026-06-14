/**
 * ING 식재료 수정 — ING-03 추가 폼을 기반으로, 상세(ING-02) 데이터를 프리필한 수정 화면.
 * 이름·카테고리·개당용량·구매가격·로스율·안전재고/최소발주·구매옵션 + 단가 미리보기 + 저장/삭제.
 * ⚠ 현재는 디자인 프로토타입(정적 입력). 실제 수정/저장·삭제는 데이터 연결 단계에서 TextInput·RPC로.
 */
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Badge, Button, Field, Icon, Input, Select } from '@/components/kit';
import { round } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { DETAIL_EXTRAS, getIngredient } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };

export default function IngredientEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const g = getIngredient(id);
  const extra = id ? DETAIL_EXTRAS[id] : undefined;

  if (!g) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <AppHeader title="식재료 수정" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: T.ter }}>식재료를 찾을 수 없습니다.</Text>
        </View>
      </View>
    );
  }

  const loss = g.loss ?? 0;
  const real = g.price; // 기준 단가(로스 반영) = 실사용 단가
  const raw = round(real * (1 - loss / 100), 2); // 구매가 단가(로스 0) 역산
  const recent = extra?.purchases[0]; // 최근 구매 한 건(구매가 프리필)

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="식재료 수정" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }}>
        <Field label="식재료명" req>
          <Input value={g.name} />
        </Field>
        <Field label="카테고리" req>
          <Select value={g.cat} />
        </Field>
        <Field label="개당 용량" req hint="kg·L 입력 시 자동 환산 · '개'는 포장당 개수">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 2 }}>
              <Input value={won(g.per)} mono />
            </View>
            <View style={{ flex: 1 }}>
              <Select value={g.unit} />
            </View>
          </View>
        </Field>
        <Field label="구매 가격" req>
          <Input value={recent ? won(recent.unitWon) : ''} placeholder="최근 구매가" suffix={recent ? `원 / ${recent.each}` : '원'} mono />
        </Field>

        {/* 단가 미리보기 */}
        <View style={{ backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Icon name="info" size={17} color={T.blue} />
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: T.blue }}>단가 미리보기</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: T.sub2 }}>구매가 단가</Text>
            <Text style={[{ fontSize: 15, fontWeight: '700', color: T.ink }, NUM]}>
              {raw}
              <Text style={{ fontSize: 12, color: T.sub2 }}>{g.priceUnit}</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: T.blue }}>
              실사용 단가 <Text style={{ fontSize: 12, fontWeight: '600', color: T.blue }}>(로스 {loss}% 반영)</Text>
            </Text>
            <Text style={[{ fontSize: 19, fontWeight: '800', color: T.blue }, NUM]}>
              {real}
              <Text style={{ fontSize: 13 }}>{g.priceUnit}</Text>
            </Text>
          </View>
        </View>

        <Field label="로스율" req>
          <Input value={String(loss)} suffix="%" mono />
        </Field>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="안전재고" req>
              <Input value={g.safe != null ? String(g.safe) : ''} placeholder="0" suffix="개" mono />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="최소 발주" req>
              <Input value={g.minOrder != null ? String(g.minOrder) : ''} placeholder="0" suffix="개" mono />
            </Field>
          </View>
        </View>

        {/* 구매 링크 · 옵션 */}
        <View style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: T.sub, marginBottom: 8 }}>
            구매 링크 · 옵션 <Text style={{ color: T.ter, fontWeight: '600' }}>(선택)</Text>
          </Text>
          {extra && extra.options.length > 0 ? (
            <View style={{ gap: 8, marginBottom: 10 }}>
              {extra.options.map((o, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 13, backgroundColor: T.surface2, borderRadius: 11 }}>
                  <Icon name="link" size={17} color={T.blue} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: T.ink }}>{o.name}</Text>
                      {o.best ? <Badge tone="green" sm>최저가</Badge> : null}
                      {o.high ? <Badge tone="red" sm>▲33%</Badge> : null}
                    </View>
                    <Text style={[{ fontSize: 12, color: T.ter, marginTop: 2 }, NUM]}>{o.vendor} · {o.per}{g.priceUnit}</Text>
                  </View>
                  <Icon name="close" size={16} color={T.ter} />
                </View>
              ))}
            </View>
          ) : null}
          <Pressable onPress={() => router.push('/ingredients/option' as Href)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.blue, backgroundColor: T.blueTint }}>
            <Icon name="plus" size={18} color={T.blue} sw={2.2} />
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: T.blue }}>구매 링크 · 옵션 추가</Text>
          </Pressable>
        </View>

      </ScrollView>

      {/* 하단 — 좌측 삭제 · 우측 저장 */}
      <View style={{ flexDirection: 'row', gap: 9, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="danger" size="lg" onPress={() => router.back()} style={{ flex: 1 }}>
          삭제
        </Button>
        <Button kind="primary" size="lg" onPress={() => router.back()} style={{ flex: 2 }}>
          저장
        </Button>
      </View>
    </View>
  );
}
