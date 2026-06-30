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
import { safeBack } from '@/lib/nav';
import { previewBaseUnitPrice, rawUnitPrice, round } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { optionsFor } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };
const QTY = 2;
const LOSS = 15;
const DATES = ['오늘', '내일', '모레', '날짜'];
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
// 실제(글로벌) 날짜 기준 유틸
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmtArrival = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;

export default function OrderCompleteScreen() {
  const router = useRouter();
  const { mode, ingredient, opt } = useLocalSearchParams<{ mode?: string; ingredient?: string; opt?: string }>();
  const isReceive = mode === 'receive'; // 입고 완료에서 진입(도착일 수정)
  const isEdit = mode === 'edit' || isReceive; // 발주 수정 모드(헤더·버튼)
  const INGREDIENT = ingredient ?? '대파'; // 전달받은 식재료(없으면 대파)
  const options = optionsFor(INGREDIENT); // 식재료별 구매 옵션
  const [optIdx, setOptIdx] = useState(Number(opt) || 0); // 선택된 구매 옵션
  const [optOpen, setOptOpen] = useState(false); // 발주 완료(옵션 변경) 팝업
  const [dateIdx, setDateIdx] = useState(1); // 0 오늘 / 1 내일 / 2 모레 / 3 날짜
  const [autoIn, setAutoIn] = useState(true);
  const [calOpen, setCalOpen] = useState(false);
  const [selDate, setSelDate] = useState(() => addDays(new Date(), 1)); // 날짜 탭 선택일
  const [calYM, setCalYM] = useState(() => startOfMonth(new Date())); // 달력 표시 월
  const [qty, setQty] = useState(String(QTY)); // 수량(직접 입력)

  const today = new Date(); // 실제 오늘(글로벌 기준)
  const sel = options[optIdx] ?? options[0]!;
  const qtyN = Number(qty) || 0;
  const total = sel.amt * qtyN;
  // 도착일 — 오늘/내일/모레는 실제 날짜 환산, 날짜 탭은 선택일.
  const arrival = dateIdx === 0 ? today : dateIdx === 1 ? addDays(today, 1) : dateIdx === 2 ? addDays(today, 2) : selDate;
  const calYear = calYM.getFullYear();
  const calM = calYM.getMonth();
  const firstDow = new Date(calYear, calM, 1).getDay();
  const numDays = new Date(calYear, calM + 1, 0).getDate();
  const openCal = () => { setCalYM(startOfMonth(selDate)); setCalOpen(true); };
  const raw = round(rawUnitPrice(sel.amt, sel.vol), 2); // 구매가 단가
  const real = round(previewBaseUnitPrice(sel.amt, sel.vol, LOSS / 100), 2); // 실사용 단가
  const itemRows: [string, string][] = [
    ['식재료', INGREDIENT],
    ['구매처', sel.vendor],
    ['상품명', sel.name],
    ['용량', `${won(sel.vol)}${sel.unit} / 1개`],
    ['금액', `${won(sel.amt)}원`],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={isReceive ? '입고 수정' : isEdit ? '발주 수정' : '발주완료'} onBack={() => safeBack('/orders')} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* 품목 정보 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.sub }}>품목 정보</Text>
          <Pressable onPress={() => setOptOpen(true)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>옵션 변경</Text>
            <Icon name="chevron" size={15} color={T.blue} />
          </Pressable>
        </View>
        <Card onLine pad={0} style={{ marginBottom: 18, overflow: 'hidden' }}>
          {itemRows.map(([l, v], i) => (
            <View key={i} style={{ paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: i < itemRows.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: T.sub2 }}>{l} <Text style={{ color: T.blue }}>*</Text></Text>
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
              style={[{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink, padding: 0 }, NUM]}
            />
            <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub2 }}>개</Text>
          </View>
        </Field>

        {/* 총금액 · 구매가/실사용 단가 */}
        <View style={{ backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: T.blueLine }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.blue }}>총금액</Text>
            <Text style={[{ fontSize: 18, fontWeight: '800', color: T.blue }, NUM]}>{won(total)}<Text style={{ fontSize: 16 }}>원</Text></Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub2 }}>구매가 단가</Text>
            <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{raw}원/{sel.unit}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.blue }}>실사용 단가 <Text style={{ fontSize: 16, fontWeight: '600', color: T.blue }}>(로스 {LOSS}% 반영)</Text></Text>
            <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{real}원/{sel.unit}</Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: T.line2, marginBottom: 16 }} />

        {/* 도착(입고 수정) / 도착 예정일(그 외) */}
        {isReceive ? (
          <>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 8 }}>도착</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, marginBottom: calOpen ? 12 : 16 }}>
              <Icon name="calendar" size={18} color={T.ter} />
              <Text style={[{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{fmtArrival(selDate)}</Text>
              <Button kind="tint" size="sm" onPress={() => (calOpen ? setCalOpen(false) : openCal())}>수정</Button>
            </View>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 8 }}>도착 예정일</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {DATES.map((c, i) => {
                const on = i === dateIdx;
                return (
                  <Pressable key={i} onPress={() => { setDateIdx(i); if (i === 3) openCal(); else setCalOpen(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 11, backgroundColor: on ? T.blue : T.surface, borderWidth: on ? 0 : 1, borderColor: T.line }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: on ? T.onColor : T.sub }}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>
            {!calOpen ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, marginBottom: 16 }}>
                <Icon name="calendar" size={18} color={T.ter} />
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{fmtArrival(arrival)}</Text>
              </View>
            ) : null}
          </>
        )}

        {/* 날짜 달력 */}
        {calOpen ? (
          <View style={{ marginBottom: 16, backgroundColor: T.surface, borderWidth: 1, borderColor: T.blue, borderRadius: 12, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Pressable hitSlop={8} onPress={() => setCalYM(new Date(calYear, calM - 1, 1))}><Icon name="back" size={18} color={T.sub} sw={2.2} /></Pressable>
              <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>{calYear}년 {calM + 1}월</Text>
              <Pressable hitSlop={8} onPress={() => setCalYM(new Date(calYear, calM + 1, 1))}><Icon name="chevron" size={18} color={T.sub} sw={2.2} /></Pressable>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {WEEK.map((w, i) => (
                <Text key={w} style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '700', color: i === 0 ? T.red : i === 6 ? T.blue : T.ter }}>{w}</Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {Array.from({ length: firstDow }).map((_, i) => (
                <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 43 }} />
              ))}
              {Array.from({ length: numDays }, (_, i) => i + 1).map((d) => {
                const cur = new Date(calYear, calM, d);
                const sel = sameDay(cur, selDate);
                const isToday = sameDay(cur, today);
                return (
                  <Pressable key={d} onPress={() => setSelDate(cur)} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? T.blue : 'transparent' }}>
                      <Text style={[{ fontSize: 16, fontWeight: sel ? '800' : '600', color: sel ? T.onColor : T.ink }, NUM]}>{d}</Text>
                    </View>
                    {isToday ? <Text style={{ fontSize: 14, fontWeight: '600', color: sel ? T.blue : T.ter, marginTop: 1 }}>오늘</Text> : <View style={{ height: 11 }} />}
                  </Pressable>
                );
              })}
            </View>
            <Button kind="tint" size="md" full onPress={() => { setDateIdx(3); setCalOpen(false); }} style={{ marginTop: 12 }}>{`${fmtArrival(selDate)} 선택완료`}</Button>
          </View>
        ) : null}

        {/* 자동 입고 */}
        <Pressable onPress={() => setAutoIn((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: autoIn ? T.blue : T.surface, borderWidth: autoIn ? 0 : 1.5, borderColor: T.line, alignItems: 'center', justifyContent: 'center' }}>
            {autoIn ? <Icon name="check" size={15} color={T.onColor} sw={2.6} /> : null}
          </View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: T.ink2 }}>도착일 다음날 자동 입고 처리</Text>
        </Pressable>
      </ScrollView>

      {/* 하단 발주 완료 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full onPress={() => safeBack('/orders')}>
          {isEdit ? '수정 완료' : '발주 완료'}
        </Button>
      </View>

      {/* 옵션 변경 — 발주 완료 옵션 선택 팝업 (현재 옵션 체크) */}
      <Sheet visible={optOpen} onClose={() => setOptOpen(false)} title="발주 완료" sub={`${INGREDIENT} · 어디서 샀는지 선택하세요`} height={460}>
        <View style={{ gap: 10 }}>
          {options.map((o, i) => {
            const on = i === optIdx;
            return (
              <Pressable key={i} onPress={() => { setOptIdx(i); setOptOpen(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}>
                <Icon name="check" size={18} color={on ? T.blue : T.line} sw={2.4} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{o.name}, {won(o.amt)}원</Text>
                  <Text numberOfLines={1} style={[{ fontSize: 14, color: T.sub2, marginTop: 3 }, NUM]}>{o.vendor} · {o.per}원/{o.unit}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 2 }}>
          <Icon name="info" size={15} color={T.ter} />
          <Text style={{ fontSize: 14, color: T.ter }}>링크는 식재료 상세에서 추가·관리할 수 있어요</Text>
        </View>
      </Sheet>
    </View>
  );
}
