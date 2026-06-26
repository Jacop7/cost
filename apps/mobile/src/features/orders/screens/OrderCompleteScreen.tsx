/**
 * ORD-02 발주완료 등록 — 발주 현황(ORD-01) 주문하기/발주 완료에서 진입.
 * 품목 정보(옵션 변경=발주 완료 팝업, 현재 옵션 체크) · 용량/금액/수량 → 총금액·구매가/실사용 단가
 * · 도착 예정일(달력) · 자동 입고 → 발주 완료.
 * ⚠ 디자인 프로토타입(정적·대파 예시). 실제 등록(E7)·자동 입고(E1)는 데이터 연결 단계에서.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Button, Card, Field, Icon, Sheet } from '@/components/kit';
import { previewBaseUnitPrice, rawUnitPrice, round } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { OPTIONS } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };
const INGREDIENT = '대파'; // 식재료(고정)
const QTY = 2;
const LOSS = 15;
const DATES = ['오늘', '내일', '모레', '날짜'];
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const DAYS = Array.from({ length: 30 }, (_, i) => i + 1); // 2026년 6월(데모)
const TODAY_DAY = 5;

export default function OrderCompleteScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isEdit = mode === 'edit'; // 발주 수정 모드
  const [optIdx, setOptIdx] = useState(0); // 선택된 구매 옵션
  const [optOpen, setOptOpen] = useState(false); // 발주 완료(옵션 변경) 팝업
  const [date, setDate] = useState(1); // 도착 예정일: 내일
  const [autoIn, setAutoIn] = useState(true);
  const [calOpen, setCalOpen] = useState(false);
  const [selDay, setSelDay] = useState(9);
  const [qty, setQty] = useState(String(QTY)); // 수량(직접 입력)

  const opt = OPTIONS[optIdx]!;
  const qtyN = Number(qty) || 0;
  const total = opt.amt * qtyN;
  const raw = round(rawUnitPrice(opt.amt, opt.vol), 2); // 구매가 단가
  const real = round(previewBaseUnitPrice(opt.amt, opt.vol, LOSS / 100), 2); // 실사용 단가
  const itemRows: [string, string][] = [
    ['식재료', INGREDIENT],
    ['구매처', opt.vendor],
    ['상품명', opt.name],
    ['용량', `${won(opt.vol)}g / 1개`],
    ['금액', `${won(opt.amt)}원`],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={isEdit ? '발주 수정' : '발주완료'} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* 품목 정보 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: T.sub }}>품목 정보</Text>
          <Pressable onPress={() => setOptOpen(true)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: T.blue }}>옵션 변경</Text>
            <Icon name="chevron" size={15} color={T.blue} />
          </Pressable>
        </View>
        <Card onLine pad={0} style={{ marginBottom: 18, overflow: 'hidden' }}>
          {itemRows.map(([l, v], i) => (
            <View key={i} style={{ paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: i < itemRows.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: T.sub2 }}>{l} <Text style={{ color: T.blue }}>*</Text></Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginTop: 3 }}>{v}</Text>
            </View>
          ))}
        </Card>

        {/* 수량 — 직접 입력 */}
        <Field label="수량" req>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14 }}>
            <TextInput
              value={qty}
              onChangeText={(t) => setQty(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={T.ter}
              style={[{ flex: 1, fontSize: 16.5, fontWeight: '600', color: T.ink, padding: 0 }, NUM]}
            />
            <Text style={{ fontSize: 15, fontWeight: '600', color: T.sub2 }}>개</Text>
          </View>
        </Field>

        {/* 총금액 · 구매가/실사용 단가 */}
        <View style={{ backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(49,130,246,0.2)' }}>
            <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: T.blue }}>총금액</Text>
            <Text style={[{ fontSize: 19, fontWeight: '800', color: T.blue }, NUM]}>{won(total)}<Text style={{ fontSize: 13 }}>원</Text></Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: T.sub2 }}>구매가 단가</Text>
            <Text style={[{ fontSize: 15, fontWeight: '700', color: T.ink }, NUM]}>{raw}원/g</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: T.blue }}>실사용 단가 <Text style={{ fontSize: 13.5, fontWeight: '600', color: T.blue }}>(로스 {LOSS}% 반영)</Text></Text>
            <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{real}원/g</Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: T.line2, marginBottom: 16 }} />

        {/* 도착 예정일 */}
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: T.sub, marginBottom: 8 }}>도착 예정일</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {DATES.map((c, i) => {
            const on = i === date;
            return (
              <Pressable key={i} onPress={() => { setDate(i); setCalOpen(i === 3); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 11, backgroundColor: on ? T.blue : T.surface, borderWidth: on ? 0 : 1, borderColor: T.line }}>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: on ? '#fff' : T.sub }}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 날짜 달력 */}
        {date === 3 && calOpen ? (
          <View style={{ marginBottom: 16, backgroundColor: T.surface, borderWidth: 1, borderColor: T.blue, borderRadius: 12, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Pressable hitSlop={8}><Icon name="back" size={18} color={T.sub} sw={2.2} /></Pressable>
              <Text style={{ fontSize: 15, fontWeight: '800', color: T.ink }}>2026년 6월</Text>
              <Pressable hitSlop={8}><Icon name="chevron" size={18} color={T.sub} sw={2.2} /></Pressable>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {WEEK.map((w, i) => (
                <Text key={w} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: i === 0 ? T.red : i === 6 ? T.blue : T.ter }}>{w}</Text>
              ))}
            </View>
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
            <Button kind="tint" size="md" full onPress={() => setCalOpen(false)} style={{ marginTop: 12 }}>{`6월 ${selDay}일 선택완료`}</Button>
          </View>
        ) : null}

        {/* 자동 입고 */}
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
          {isEdit ? '수정 완료' : '발주 완료'}
        </Button>
      </View>

      {/* 옵션 변경 — 발주 완료 옵션 선택 팝업 (현재 옵션 체크) */}
      <Sheet visible={optOpen} onClose={() => setOptOpen(false)} title="발주 완료" sub={`${INGREDIENT} · 어디서 샀는지 선택하세요`} height={460}>
        <View style={{ gap: 10 }}>
          {OPTIONS.map((o, i) => {
            const on = i === optIdx;
            return (
              <Pressable key={i} onPress={() => { setOptIdx(i); setOptOpen(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}>
                <Icon name="check" size={18} color={on ? T.blue : '#DDE2E7'} sw={2.4} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '700', color: T.ink }}>{o.name}, {won(o.amt)}원</Text>
                  <Text numberOfLines={1} style={[{ fontSize: 12.5, color: T.sub2, marginTop: 3 }, NUM]}>{o.vendor} · {o.per}원/g</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}
