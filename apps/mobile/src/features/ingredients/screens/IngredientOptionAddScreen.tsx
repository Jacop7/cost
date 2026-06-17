/**
 * ING-05 구매 링크 · 옵션 추가 — 프로토타입 ScreenING05 을 kit 컴포넌트로 RN 이식.
 * URL 붙여넣기 → 자동 추출(상품명·구매처·용량-금액) → 환산단가 비교 → 등록.
 * ⚠ 현재는 디자인 프로토타입(정적 입력). 자동 추출/등록은 데이터 연결 단계에서.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, Badge, Button, Field, Icon, Input, Select } from '@/components/kit';
import { previewBaseUnitPrice, rawUnitPrice, round } from '@sikjae/core';
import { T, won } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };
const LOSS = 15; // 공통 로스율(%)
const BUY = round(rawUnitPrice(5200, 1000), 2); // 환산 단가(구매가) 5.2원/g
const REAL = round(previewBaseUnitPrice(5200, 1000, LOSS / 100), 2); // 실사용 단가 6.12원/g

// 최근 주문 단가 비교(데모) — 직전 주문(최근)과 지금 입력 중인 옵션(현재)을 로스율 반영 실사용 단가로 비교.
//  buy=환산 단가(구매가), loss=로스율(%). 실사용 단가는 buy / (1 - loss/100) 로 산출.
//  실제 단계에서는 매칭된 식재료의 최근 입고/주문 이력에서 가져옵니다.
const ORDER_COMPARE = [
  { tag: '최근', name: '미령', vol: '1kg', amt: 4800, vendor: '쿠팡', buy: 4.8, current: false },
  { tag: '현재', name: '곰곰 깐대파', vol: '1kg', amt: 5200, vendor: '쿠팡', buy: BUY, current: true },
];

export default function IngredientOptionAddScreen() {
  const router = useRouter();
  const [url, setUrl] = useState('');

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="구매 링크 · 옵션 추가" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }}>
        {/* URL 붙여넣기 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: url ? 8 : 14 }}>
          <Icon name="link" size={18} color={T.ter} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '600', color: url ? T.ink : T.ter }}>
            {url || '상품 URL 붙여넣기'}
          </Text>
          {url ? (
            <Pressable onPress={() => setUrl('')} hitSlop={8}>
              <Icon name="close" size={18} color={T.ter} />
            </Pressable>
          ) : (
            <Pressable onPress={() => setUrl('coupang.com/vp/products/7712...')} hitSlop={8}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>붙여넣기</Text>
            </Pressable>
          )}
        </View>

        {/* 자동 추출 안내 (URL 입력 시) */}
        {url ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 2, marginBottom: 14 }}>
            <Icon name="check" size={15} color={T.green} sw={2.4} />
            <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: T.green }}>
              상품 정보를 자동으로 가져왔어요 — 확인·수정 후 등록하세요
            </Text>
          </View>
        ) : null}

        <Field label="구매 식재료명">
          <Input value="곰곰 깐대파" />
        </Field>

        <Field label="구매처">
          <Select value="쿠팡" />
        </Field>
        <Field label="용량">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1.4 }}>
              <Input value="1" mono />
            </View>
            <View style={{ flex: 1 }}>
              <Select value="kg" />
            </View>
          </View>
        </Field>
        <Field label="금액">
          <Input value="5,200" suffix="원" mono />
        </Field>

        {/* 로스율 (공통) */}
        <View style={{ marginTop: 2, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: T.ink }}>로스율</Text>
            <View style={{ flex: 1 }} />
            <Text style={[{ fontSize: 16, fontWeight: '800', color: T.blue }, NUM]}>
              {LOSS}<Text style={{ fontSize: 13, fontWeight: '700' }}>%</Text> <Text style={{ fontSize: 13, fontWeight: '700' }}>적용중</Text>
            </Text>
          </View>
        </View>

        {/* 환산 단가 (구매가 / 실사용) — 한 줄에 나란히 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: T.sub }}>
              환산 단가 <Text style={{ fontSize: 11.5, fontWeight: '600', color: T.sub2 }}>(구매가)</Text>
            </Text>
            <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink, marginTop: 3 }, NUM]}>{BUY}원/g</Text>
          </View>
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: T.blue, opacity: 0.18, marginHorizontal: 14 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: T.blue }}>
              실사용 단가 <Text style={{ fontSize: 11.5, fontWeight: '600', color: T.blue }}>(로스 반영)</Text>
            </Text>
            <Text style={[{ fontSize: 21, fontWeight: '800', color: T.blue, marginTop: 3 }, NUM]}>{REAL}원/g</Text>
          </View>
        </View>

        {/* 최근 주문 단가 비교 — 별도 박스 (최근 / 현재, 로스율 반영 실사용 단가) */}
        <View style={{ marginTop: 12, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 15 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: T.sub, marginBottom: 4 }}>최근 주문 단가 비교</Text>
          {ORDER_COMPARE.map((o, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: T.line2 }}>
              <Badge tone={o.current ? 'blue' : 'neutral'} sm>{o.tag}</Badge>
              <View style={{ flex: 1 }}>
                <Text style={[{ fontSize: 13.5, fontWeight: '700', color: o.current ? T.ink : T.sub }, NUM]}>
                  {o.name} · {o.vol} · {won(o.amt)}원
                </Text>
                <Text style={[{ fontSize: 12.5, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>
                  {o.vendor} · {o.buy}원/g
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 하단 등록 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full onPress={() => router.back()}>
          옵션 등록
        </Button>
      </View>
    </View>
  );
}
