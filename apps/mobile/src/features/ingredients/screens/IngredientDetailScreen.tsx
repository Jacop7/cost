// IngredientDetailScreen.tsx — ING-03 식재료 상세 (대파)
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card, Badge, StatusBadge, AppHeader, PeriodChip, Icon } from '../../../components/kit';
import { T, tnum } from '../../../theme/tokens';
import { optionsFor } from '../demoData';
import { safeBack } from '@/lib/nav';
import { useIngredients, fmtStock } from '../store';
import { LedgerRow } from '../components/LedgerRow';
import { StockEditSheet } from './StockEditSheet';
import { MemoEditSheet } from './MemoEditSheet';

// 재고 변동 내역(원장) — 대표 데모. 실데이터는 Supabase 재고 원장으로 교체 예정.
const LEDGER = [
  { date: '06/20 18:40', act: '수량 조정', memo: '상해서 폐기', delta: '−2.3kg', bal: '3.9kg', up: false },
  { date: '06/19 20:30', act: '판매 소진', memo: '제육볶음 외 3개 메뉴', delta: '−1.9kg', bal: '6.2kg', up: false },
  { date: '06/03 09:15', act: '○○청과 입고', memo: '1kg 2개 · 8,000원 · 4원/g', delta: '+2.0kg', bal: '8.1kg', up: true },
  { date: '05/28 10:05', act: '대림유통 입고', memo: '1kg 3개 · 10,800원 · 3.6원/g', delta: '+3.0kg', bal: '6.1kg', up: true },
];

function SectionHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>{children}</Text>
      {right}
    </View>
  );
}

export function IngredientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = useIngredients((s) => s.items);
  const setMemo = useIngredients((s) => s.setMemo);
  const setStock = useIngredients((s) => s.setStock);
  const g = (items.find((x) => x.id === id) || items[0])!;
  const opts = optionsFor(g.name);
  // 현재 재고 표기 — 숫자/단위 분리(단위는 700).
  const stockDisp = fmtStock(g.unit, g.stock);
  const sdm = stockDisp.match(/^([\d.]+)(.*)$/);
  const stockNum = sdm?.[1] ?? stockDisp;
  const stockUnit = sdm?.[2] ?? '';
  const priceRows: [string, number, string][] = [
    ['최근', g.recent, g.vendor],
    ['최저', g.low, ''],
    ['최고', g.high, ''],
  ];
  const [menuOpen, setMenuOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);

  const menuItems = [
    { label: '식재료 수정', onPress: () => router.push(`/ingredients/edit/${g.id}`) },
    { label: '재고 수정', onPress: () => setStockOpen(true) },
    { label: '메모 수정', onPress: () => setMemoOpen(true) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title="식재료"
        onBack={() => safeBack()}
        right={
          <Pressable onPress={() => setMenuOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 8 }}>
            <Icon name="edit" size={19} color={T.ink2} />
            <Text style={{ color: T.ink2, fontSize: 16, fontWeight: '700' }}>수정</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28, gap: 11 }} showsVerticalScrollIndicator={false}>
        {/* 이름 카드 */}
        <Card pad={16}>
          <View style={{ marginBottom: 11 }}>
            <Badge tone="neutral">{g.cat}</Badge>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.5, color: T.ink }}>{g.name}</Text>
          <View style={{ marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: T.line2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <Icon name="note" size={16} color={T.amberText} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>메모</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: g.memo ? T.ink2 : T.ter, lineHeight: 22 }}>
              {g.memo || '메모를 입력하세요'}
            </Text>
          </View>
        </Card>

        {/* 잔여 카드 */}
        <Card pad={16}>
          <StatusBadge status={g.status} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <Text style={[{ fontSize: 20, fontWeight: '800', letterSpacing: -0.6, color: T.ink }, tnum]}>총 {fmtStock(g.unit, g.stock)}</Text>
            <Text style={[{ flexShrink: 1, fontSize: 14, color: T.sub, fontWeight: '700' }, tnum]} numberOfLines={1}>
              {g.price}원/{g.unit}{g.loss > 0 ? <Text style={{ fontWeight: '600', color: T.sub2 }}> (로스 {g.loss}% 반영)</Text> : null}
            </Text>
          </View>
          <View style={{ marginTop: 10, flexDirection: 'row', gap: 6 }}>
            <Badge tone="neutral" sm>안전재고 {g.safe}개</Badge>
            <Badge tone="neutral" sm>최소발주 1개</Badge>
          </View>
        </Card>

        {/* 기준 단가 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <SectionHeader right={<PeriodChip value="최근 3개월" />}>기준 단가</SectionHeader>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}>로스 반영</Text>
                <Text style={[{ fontSize: 22, fontWeight: '800', color: T.blue, marginTop: 2 }, tnum]}>
                  {g.price}<Text style={{ fontSize: 14 }}>원/{g.unit}</Text>
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 14, color: T.ter }}>가중평균</Text>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, tnum]}>{g.avg}원/{g.unit}</Text>
              </View>
            </View>
            <View style={{ gap: 7, marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: T.line2 }}>
              {priceRows.map(([lbl, val, ven]) => (
                <View key={lbl} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', width: 36, color: lbl === '최저' ? T.blue : lbl === '최고' ? T.red : T.sub }}>{lbl}</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, tnum]}>
                    {val}<Text style={{ fontSize: 14, fontWeight: '600', color: T.sub2 }}>원/{g.unit}</Text>
                  </Text>
                  <View style={{ flex: 1 }} />
                  <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}>{ven}</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>

        {/* 현재 재고 변동 내역 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>현재 재고</Text>
            <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, tnum]}>{stockNum}<Text style={{ fontWeight: '700' }}>{stockUnit}</Text></Text>
          </View>
          {LEDGER.map((r, i) => (
            <LedgerRow key={i} date={r.date} act={r.act} memo={r.memo} delta={r.delta} bal={`잔량 ${r.bal}`} up={r.up} px={15} last={i === LEDGER.length - 1} />
          ))}
          <Pressable
            onPress={() => router.push(`/ingredients/history/${g.id}`)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 13, borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.surface2 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>자세히 보기</Text>
            <Icon name="chevron" size={16} color={T.ter} />
          </Pressable>
        </Card>

        {/* 구매 옵션 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <SectionHeader>구매 링크 · 옵션</SectionHeader>
          <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 }}>
            {opts.map((o, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: i < opts.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{o.name}, {o.price}</Text>
                  <Text style={[{ fontSize: 14, color: T.ink, marginTop: 2 }, tnum]}>{o.vendor} · {o.per}원/{g.unit}</Text>
                </View>
                <Icon name="chevron" size={16} color={T.line3} />
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>

      {/* 수정 액션 메뉴 (iOS 스타일 액션시트) */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)} statusBarTranslucent>
        <Pressable onPress={() => setMenuOpen(false)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: T.scrim }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: T.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 16 }}>
            <View style={{ alignItems: 'center', paddingBottom: 14 }}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: T.line }} />
            </View>
            <View style={{ backgroundColor: T.surface2, borderRadius: 14, overflow: 'hidden', marginBottom: 9 }}>
              {menuItems.map((m, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    setMenuOpen(false);
                    m.onPress();
                  }}
                  style={{ paddingVertical: 20, alignItems: 'center', borderTopWidth: i > 0 ? 1 : 0, borderTopColor: T.line }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: T.ink }}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setMenuOpen(false)} style={{ paddingVertical: 20, borderRadius: 14, backgroundColor: T.surface2, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: T.ink }}>닫기</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <StockEditSheet
        visible={stockOpen}
        onClose={() => setStockOpen(false)}
        name={g.name}
        unit={g.unit}
        stock={g.stock}
        onApply={(next) => {
          setStock(g.id, next);
          setStockOpen(false);
        }}
      />
      <MemoEditSheet
        visible={memoOpen}
        value={g.memo}
        onClose={() => setMemoOpen(false)}
        onSave={(next) => {
          setMemo(g.id, next);
          setMemoOpen(false);
        }}
      />
    </View>
  );
}
