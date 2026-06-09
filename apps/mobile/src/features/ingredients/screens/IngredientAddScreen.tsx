/**
 * ING-03 식재료 추가 — 프로토타입 ScreenING03 을 kit 컴포넌트로 RN 이식.
 * 등록 폼(이름·카테고리·개당용량·가격·로스율·안전재고/최소발주·구매옵션) + 단가 미리보기 + 저장.
 * ⚠ 현재는 디자인 프로토타입(정적 입력). 실제 입력/저장은 데이터 연결 단계에서 TextInput·RPC로.
 */
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, Badge, Button, Field, Icon, Input, Select } from '@/components/kit';
import { previewBaseUnitPrice, round } from '@sikjae/core';
import { T } from '@/theme/tokens';

const PREVIEW = round(previewBaseUnitPrice(4000, 1000, 0.15), 2); // 4.71

const DEMO_OPTIONS = [
  { name: '대파(흙대파) 1kg', vendor: '○○청과몰', per: '4.0원/g', best: true },
  { name: '깐대파 1kg', vendor: '쿠팡 · 곰곰', per: '5.2원/g', high: true },
];

export default function IngredientAddScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="식재료 추가" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }}>
        <Field label="식재료명" req>
          <Input value="대파" />
        </Field>
        <Field label="카테고리" req>
          <Select value="농산(신선)" />
        </Field>
        <Field label="개당 용량" req hint="kg·L 입력 시 자동 환산 · '개'는 포장당 개수">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 2 }}>
              <Input value="1,000" mono />
            </View>
            <View style={{ flex: 1 }}>
              <Select value="g" />
            </View>
          </View>
        </Field>
        <Field label="구매 가격 (선택)">
          <Input value="4,000" suffix="원 / 1개" mono />
        </Field>

        {/* 단가 미리보기 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 18 }}>
          <Icon name="info" size={18} color={T.blue} />
          <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: T.sub, marginLeft: 8 }}>단가 미리보기 (로스 15% 반영)</Text>
          <Text style={[{ fontSize: 19, fontWeight: '800', color: T.blue }, { fontVariant: ['tabular-nums' as const] }]}>
            {PREVIEW}
            <Text style={{ fontSize: 13 }}>원/g</Text>
          </Text>
        </View>

        <Field label="로스율 (선택)">
          <Input value="15" suffix="%" mono />
        </Field>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="안전재고">
              <Input value="2" suffix="개" mono />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="최소 발주">
              <Input value="1" suffix="개" mono />
            </Field>
          </View>
        </View>

        {/* 구매 링크 · 옵션 */}
        <View style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: T.sub, marginBottom: 8 }}>
            구매 링크 · 옵션 <Text style={{ color: T.ter, fontWeight: '600' }}>(선택)</Text>
          </Text>
          <View style={{ gap: 8, marginBottom: 10 }}>
            {DEMO_OPTIONS.map((o, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 13, backgroundColor: T.surface2, borderRadius: 11 }}>
                <Icon name="link" size={17} color={T.blue} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: T.ink }}>{o.name}</Text>
                    {o.best ? <Badge tone="green" sm>최저가</Badge> : null}
                    {o.high ? <Badge tone="red" sm>▲33%</Badge> : null}
                  </View>
                  <Text style={{ fontSize: 12, color: T.ter, marginTop: 2 }}>{o.vendor} · {o.per}</Text>
                </View>
                <Icon name="close" size={16} color={T.ter} />
              </View>
            ))}
          </View>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.blue, backgroundColor: T.blueTint }}>
            <Icon name="plus" size={18} color={T.blue} sw={2.2} />
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: T.blue }}>구매 옵션·링크 추가</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 9 }}>
            <Icon name="info" size={14} color={T.ter} />
            <Text style={{ flex: 1, fontSize: 12, color: T.ter, lineHeight: 17 }}>
              링크를 붙여넣으면 상품 정보를 자동으로 가져와요. 발주할 때 최저가를 비교할 수 있어요.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* 하단 저장 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full onPress={() => router.back()}>
          저장
        </Button>
      </View>
    </View>
  );
}
