/**
 * ING-05 구매 링크 · 옵션 추가 — 프로토타입 ScreenING05 을 kit 컴포넌트로 RN 이식.
 * URL 붙여넣기 → 자동 추출(상품명·구매처·브랜드·용량-금액) → 환산단가 비교 → 등록.
 * ⚠ 현재는 디자인 프로토타입(정적 입력). 자동 추출/등록은 데이터 연결 단계에서.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, Badge, Button, Field, Icon, Input, Select } from '@/components/kit';
import { previewBaseUnitPrice, rawUnitPrice, round } from '@sikjae/core';
import { T } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };
const LOSS = 15; // 공통 로스율(%)
const BUY = round(rawUnitPrice(5200, 1000), 2); // 환산 단가(구매가) 5.2원/g
const REAL = round(previewBaseUnitPrice(5200, 1000, LOSS / 100), 2); // 실사용 단가 6.12원/g
const AVG_BUY = 3.9; // 평균 구매가
const AVG_REAL = round(AVG_BUY / (1 - LOSS / 100), 2); // 평균 실사용 4.59
const DIFF_BUY = round((BUY / AVG_BUY - 1) * 100); // ▲33%
const DIFF_REAL = round((REAL / AVG_REAL - 1) * 100); // ▲33%

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

        <Field label="구매 식재료명" right={<Badge tone="blue" sm>자동</Badge>}>
          <Input value="곰곰 깐대파 1kg" />
        </Field>

        <Field label="구매처" right={<Badge tone="blue" sm>자동</Badge>}>
          <Select value="쿠팡" />
        </Field>
        <Field label="브랜드" right={<Badge tone="blue" sm>자동</Badge>}>
          <Input value="곰곰" />
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
            <View style={{ marginLeft: 6 }}>
              <Badge tone="neutral" sm>{`자동·공통 ${LOSS}%`}</Badge>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>
              {LOSS} <Text style={{ fontSize: 13, fontWeight: '600', color: T.sub2 }}>%</Text>
            </Text>
          </View>
          <Text style={{ fontSize: 12.5, color: T.ter, marginTop: 6, lineHeight: 18 }}>
            식재료 공통 로스율을 따라가요. 공통 값을 바꾸면 자동으로 갱신됩니다.
          </Text>
        </View>

        {/* 환산 단가 비교 (구매가 / 실사용) */}
        <View style={{ backgroundColor: T.blueTint, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 15, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: T.sub }}>
              환산 단가 <Text style={{ fontSize: 12, fontWeight: '600', color: T.sub2 }}>(구매가)</Text>
            </Text>
            <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, marginRight: 8 }, NUM]}>{BUY}원/g</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: T.sub2, marginRight: 6 }}>평균 {AVG_BUY} 대비</Text>
            <Badge tone="red" sm>{`▲${DIFF_BUY}%`}</Badge>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: T.blue }}>
              실사용 단가 <Text style={{ fontSize: 12, fontWeight: '600', color: T.blue }}>(로스 반영)</Text>
            </Text>
            <Text style={[{ fontSize: 18, fontWeight: '800', color: T.blue, marginRight: 8 }, NUM]}>{REAL}원/g</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: T.sub2, marginRight: 6 }}>평균 {AVG_REAL} 대비</Text>
            <Badge tone="red" sm>{`▲${DIFF_REAL}%`}</Badge>
          </View>
        </View>
      </ScrollView>

      {/* 하단 등록 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full onPress={() => router.back()}>
          옵션 등록
        </Button>
        <Text style={{ textAlign: 'center', fontSize: 12, color: T.ter, marginTop: 11, lineHeight: 17 }}>
          자동 추출이 안 되면 같은 칸을 직접 입력. 등록된 옵션은 발주 완료 등록에서 고르면 자동으로 채워집니다.
        </Text>
      </View>
    </View>
  );
}
