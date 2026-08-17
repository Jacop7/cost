/**
 * SALES-01 매출관리 홈 — 오늘 판매 입력 + 실시간 손익. (+ 판매 입력/개수 수정/기타 매출/지출 시트)
 * 메뉴 판매 → 매출 + 재료원가 + 채널 수수료 + 고정지출 일배분 → 오늘 순이익.
 * ⚠ 디자인 프로토타입(정적·데모). 실제 기록/계산은 데이터 연결 단계에서.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Field, Icon, Input, Sheet } from '@/components/kit';
import { T, won } from '@/theme/tokens';
import { SALES, SaleMenu } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };

// − N + 스테퍼 (프로토타입 SaleStepper)
function SaleStepper({ value }: { value: number }) {
  const Btn = ({ ic, on }: { ic: 'minus' | 'plus'; on?: boolean }) => (
    <Pressable style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: on ? T.blue : T.line2, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={ic} size={18} color={on ? T.onColor : T.sub} sw={2.4} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <Btn ic="minus" />
      <Text style={[{ minWidth: 26, textAlign: 'center', fontSize: 18, fontWeight: '800', color: value ? T.ink : T.ter }, NUM]}>{value}</Text>
      <Btn ic="plus" on />
    </View>
  );
}

export default function SalesHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = SALES;
  const marginPct = Math.round((s.profit / s.revenue) * 1000) / 10;

  const [sel, setSel] = useState<SaleMenu | null>(null); // 개수 수정 시트 대상 메뉴(판매 버튼 → 오늘의 판매 수량)
  const [etcOpen, setEtcOpen] = useState(false); // 기타 매출 시트
  const [expOpen, setExpOpen] = useState(false); // 지출 추가 시트

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* 헤더 — 타이틀 + 캘린더(분석) */}
      <View style={{ paddingTop: insets.top, backgroundColor: T.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingTop: 6, paddingBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }}>매출관리</Text>
          <Pressable onPress={() => router.push('/sales/analytics' as Href)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="calendar" size={23} color={T.ink2} />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {/* 오늘 손익 히어로 */}
        <View style={{ backgroundColor: T.blue, borderRadius: 16, padding: 17, marginBottom: 11 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 11 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.85)' }}>오늘 순이익 (실시간)</Text>
            <Pressable onPress={() => router.push('/sales/day' as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.onColor }}>일 상세</Text>
              <Icon name="chevron" size={14} color={T.onColor} />
            </Pressable>
          </View>
          <Text style={[{ fontSize: 22, fontWeight: '800', color: T.onColor, letterSpacing: -0.6 }, NUM]}>{won(s.profit)}<Text style={{ fontSize: 16 }}>원</Text></Text>
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 13 }}>
            {([['매출', won(s.revenue)], ['지출', won(s.revenue - s.profit)], ['이익률', `${marginPct}%`]] as const).map(([l, v]) => (
              <View key={l}>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>{l}</Text>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: T.onColor, marginTop: 1 }, NUM]}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 기타 매출 · 지출 추가 */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {([['기타 매출', () => setEtcOpen(true)], ['지출 추가', () => setExpOpen(true)]] as const).map(([label, onP]) => (
            <Pressable key={label} onPress={onP} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface }}>
              <Icon name="plus" size={16} color={T.sub2} sw={2.2} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* 정렬 + 메뉴 관리 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 2, marginBottom: 9 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>판매량순</Text>
            <Icon name="chevronDown" size={14} color={T.sub2} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="edit" size={15} color={T.blue} sw={2.2} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>메뉴 관리</Text>
          </View>
        </View>

        {/* 메뉴 리스트 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {s.menu.map((m, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 14, paddingHorizontal: 15, borderBottomWidth: i < s.menu.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>{m.name}</Text>
                <Text style={[{ fontSize: 14, color: T.ter, marginTop: 3 }, NUM]}>판매가 {won(m.price)} · 원가 {won(m.cogs)}</Text>
                <Pressable onPress={() => setSel(m)} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                  <Text style={[{ fontSize: 14, fontWeight: '700', color: T.blue }, NUM]}>총 {m.qty}개</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setSel(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10, backgroundColor: T.blue }}>
                <Icon name="plus" size={16} color={T.onColor} sw={2.4} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: T.onColor }}>판매</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      </ScrollView>

      {/* SALES-05 개수 수정 — 판매 버튼/총 N개 → 오늘의 판매 수량 */}
      <Sheet visible={sel != null} onClose={() => setSel(null)} title="오늘의 판매 수량" sub={sel?.name} height={520}>
        {sel ? (
          <View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub2, marginBottom: 8 }}>판매</Text>
            <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
              {([['매장', sel.hall], ['배달', sel.delivery], ['포장', sel.takeout]] as const).map(([n, v], i) => (
                <View key={n} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>{n}</Text>
                  <SaleStepper value={v} />
                </View>
              ))}
            </Card>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub2, marginBottom: 8 }}>폐기</Text>
            <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>폐기</Text>
                  <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>재료 원가만 손실 · 매출 0</Text>
                </View>
                <SaleStepper value={2} />
              </View>
            </Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, borderRadius: 12, backgroundColor: T.surface2 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub }}>합계</Text>
              <View style={{ flex: 1 }} />
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>판매 {sel.qty}개 · 폐기 2개</Text>
            </View>
            <View style={{ marginTop: 18 }}><Button kind="primary" size="lg" full onPress={() => setSel(null)}>저장</Button></View>
          </View>
        ) : null}
      </Sheet>

      {/* SALES-06 기타 매출 추가 */}
      <Sheet visible={etcOpen} onClose={() => setEtcOpen(false)} title="기타 매출 추가" sub="레시피에 없는 음료·기타 판매" height={500}>
        <Field label="항목명" req><Input value="사이다" placeholder="예: 음료" /></Field>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1.5 }}><Field label="판매가"><Input value="2,000" suffix="원" mono /></Field></View>
          <View style={{ flex: 1 }}><Field label="수량"><Input value="5" suffix="개" mono /></Field></View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: T.blueTint }}>
          <Icon name="info" size={15} color={T.blue} />
          <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: 20 }}>기타 매출은 재료 차감 없이 매출에만 더해져요.</Text>
        </View>
        <View style={{ marginTop: 18 }}><Button kind="primary" size="lg" full onPress={() => setEtcOpen(false)}>추가</Button></View>
      </Sheet>

      {/* SALES-07 지출 추가 */}
      <Sheet visible={expOpen} onClose={() => setExpOpen(false)} title="지출 추가" sub="재료비 외 당일 현금 지출" height={500}>
        <Field label="항목명" req><Input value="얼음 구매" placeholder="예: 얼음·소모품" /></Field>
        <Field label="금액"><Input value="15,000" suffix="원" mono /></Field>
        <Field label="메모 (선택)"><Input value="" placeholder="간단 메모" /></Field>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: T.amberTint }}>
          <Icon name="info" size={15} color={T.amberText} />
          <Text style={{ flex: 1, fontSize: 14, color: T.amberText, lineHeight: 20 }}>그날 손익에서만 차감되고, 고정 지출엔 반영되지 않아요.</Text>
        </View>
        <View style={{ marginTop: 18 }}><Button kind="primary" size="lg" full onPress={() => setExpOpen(false)}>추가</Button></View>
      </Sheet>
    </View>
  );
}
