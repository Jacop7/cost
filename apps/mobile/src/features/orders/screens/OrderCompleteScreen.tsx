/**
 * ORD-02 발주 완료 등록 — 발주 현황(ORD-01) '발주 완료' → 구매처 선택 후 진입.
 * 품목 정보(식재료·구매처·상품명) · 용량·금액·수량 → 총금액·환산 단가 · 도착 예정일 · 자동 입고 → 발주 완료.
 * ⚠ 디자인 프로토타입(정적 입력). 실제 등록(E7)·자동 입고(E1)는 데이터 연결 단계에서.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Button, Field, Icon, Input } from '@/components/kit';
import { cardShadow, T, won } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };
const ARRIVALS = ['오늘', '내일', '모레', '날짜'];
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const DAYS = Array.from({ length: 30 }, (_, i) => i + 1); // 2026년 6월(데모)
const TODAY_DAY = 5;

function ItemRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={{ paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line }}>
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: T.sub2 }}>
        {label} <Text style={{ color: T.blue }}>*</Text>
      </Text>
      <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink, marginTop: 3 }}>{value}</Text>
    </View>
  );
}

export default function OrderCompleteScreen() {
  const router = useRouter();
  const { name = '대파', vendor = '○○청과', product = '대파(흙대파)', amt = '4000', per = '4.0원/g', vol = '1,000', unit = 'g', qty = '2' } =
    useLocalSearchParams<{ name: string; vendor: string; product: string; amt: string; per: string; vol: string; unit: string; qty: string }>();

  const [arrival, setArrival] = useState(1); // 기본: 내일
  const [autoIn, setAutoIn] = useState(true);
  const [calOpen, setCalOpen] = useState(false); // 날짜 달력 펼침
  const [selDay, setSelDay] = useState(9); // 선택한 날짜(6월 N일)

  const amtN = Number(amt) || 0;
  const qtyN = Number(qty) || 1;
  const total = amtN * qtyN;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="발주 완료 등록" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }}>
        {/* 품목 정보 */}
        <View style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: T.sub }}>품목 정보</Text>
            <Pressable onPress={() => router.back()} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: T.blue }}>옵션 변경</Text>
              <Icon name="chevron" size={15} color={T.blue} />
            </Pressable>
          </View>
          <View style={{ backgroundColor: T.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 2, borderWidth: 1, borderColor: T.line, ...cardShadow }}>
            <ItemRow label="식재료" value={name} />
            <ItemRow label="구매처" value={vendor} />
            <ItemRow label="상품명" value={product} last />
          </View>
        </View>

        <Field label="용량" req>
          <Input value={vol} suffix={`${unit} / 1개`} mono />
        </Field>
        <Field label="금액" req>
          <Input value={won(amtN)} suffix="원" mono />
        </Field>
        <Field label="수량" req>
          <Input value={String(qtyN)} suffix="개" mono />
        </Field>

        {/* 환산 단가 · 총금액 — 단가 미리보기 스타일 */}
        <View style={{ backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: T.sub2 }}>환산 단가</Text>
            <Text style={[{ fontSize: 15, fontWeight: '700', color: T.ink }, NUM]}>{per}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: T.blue }}>총금액</Text>
            <Text style={[{ fontSize: 19, fontWeight: '800', color: T.blue }, NUM]}>
              {won(total)}
              <Text style={{ fontSize: 13 }}>원</Text>
            </Text>
          </View>
        </View>

        {/* 구분선 */}
        <View style={{ height: 1, backgroundColor: T.line2, marginBottom: 16 }} />

        {/* 도착 예정일 */}
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: T.sub, marginBottom: 8 }}>도착 예정일</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {ARRIVALS.map((a, i) => {
            const on = arrival === i;
            return (
              <Pressable key={i} onPress={() => { setArrival(i); setCalOpen(i === 3); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 11, backgroundColor: on ? T.blue : T.surface, borderWidth: on ? 0 : 1, borderColor: T.line }}>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: on ? '#fff' : T.sub }}>{i === 3 && calOpen ? `${a} ⌃` : a}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 날짜 달력 */}
        {arrival === 3 && calOpen ? (
          <View style={{ marginBottom: 16, backgroundColor: T.surface, borderWidth: 1, borderColor: T.blue, borderRadius: 12, padding: 14 }}>
            {/* 월 이동 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Pressable hitSlop={8}><Icon name="back" size={18} color={T.sub} sw={2.2} /></Pressable>
              <Text style={{ fontSize: 15, fontWeight: '800', color: T.ink }}>2026년 6월</Text>
              <Pressable hitSlop={8}><Icon name="chevron" size={18} color={T.sub} sw={2.2} /></Pressable>
            </View>
            {/* 요일 */}
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {WEEK.map((w, i) => (
                <Text key={w} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: i === 0 ? T.red : i === 6 ? T.blue : T.ter }}>{w}</Text>
              ))}
            </View>
            {/* 날짜 그리드 */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {DAYS.map((d) => {
                const sel = d === selDay;
                return (
                  <Pressable key={d} onPress={() => setSelDay(d)} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? T.blue : 'transparent' }}>
                      <Text style={[{ fontSize: 14, fontWeight: sel ? '800' : '600', color: sel ? '#fff' : T.ink }, NUM]}>{d}</Text>
                    </View>
                    {d === TODAY_DAY ? <Text style={{ fontSize: 9, fontWeight: '600', color: sel ? T.blue : T.ter, marginTop: 1 }}>오늘</Text> : <View style={{ height: 11 }} />}
                  </Pressable>
                );
              })}
            </View>
            {/* 취소 · 선택 */}
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 12 }}>
              <Button kind="gray" size="md" onPress={() => { setCalOpen(false); setArrival(1); }} style={{ flex: 1 }}>
                취소
              </Button>
              <Button kind="primary" size="md" onPress={() => setCalOpen(false)} style={{ flex: 1.4 }}>
                {`6월 ${selDay}일 선택`}
              </Button>
            </View>
          </View>
        ) : null}

        {/* 자동 입고 처리 */}
        <Pressable onPress={() => setAutoIn((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: autoIn ? T.blue : T.surface, borderWidth: autoIn ? 0 : 1.5, borderColor: T.line, alignItems: 'center', justifyContent: 'center' }}>
            {autoIn ? <Icon name="check" size={15} color="#fff" sw={2.6} /> : null}
          </View>
          <Text style={{ fontSize: 14.5, fontWeight: '600', color: T.ink2 }}>도착일 다음날 자동 입고 처리</Text>
        </Pressable>
      </ScrollView>

      {/* 하단 발주 완료 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full onPress={() => router.back()}>
          발주 완료
        </Button>
      </View>
    </View>
  );
}
