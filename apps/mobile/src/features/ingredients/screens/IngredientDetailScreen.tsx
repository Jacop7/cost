/**
 * ING-02 식재료 상세 — 프로토타입 ScreenING02 을 kit 컴포넌트로 RN 이식.
 * 이름·메모 / 잔여 / 기준단가 / 가격 추이·최근 주문 / 구매 옵션.
 * 디자인 공통 가이드(kit.jsx 토큰·폰트) 기준.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Badge, Card, Icon, PeriodChip, StatusBadge } from '@/components/kit';
import { T, won } from '@/theme/tokens';
import { DETAIL_EXTRAS, getIngredient, perLabel } from '../demoData';
import { StockAdjustSheet } from './StockAdjustSheet';
import { MemoEditSheet } from './MemoEditSheet';

const NUM = { fontVariant: ['tabular-nums' as const] };

export default function IngredientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const g = getIngredient(id);
  const extra = id ? DETAIL_EXTRAS[id] : undefined;
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [memo, setMemo] = useState(g?.memo ?? '');

  if (!g) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <AppHeader title="식재료" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: T.ter }}>식재료를 찾을 수 없습니다.</Text>
        </View>
      </View>
    );
  }

  const total = g.sealed + g.opened;
  // 행 우측 구매처: 구매이력(per 매칭)에서 찾고, 없으면 기본 거래처.
  const vendorFor = (price?: number) => {
    if (extra && price != null) {
      const m = extra.purchases.find((p) => p.per === price);
      if (m) return m.vendor;
    }
    return g.vendor ?? '';
  };
  const priceRows: [string, number | undefined, string][] = [
    ['최근', g.price, g.vendor ?? ''],
    ['최저', g.low, vendorFor(g.low)],
    ['최고', g.high, vendorFor(g.high)],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title="식재료"
        onBack={() => router.back()}
        right={
          <Pressable onPress={() => router.push(`/ingredients/edit?id=${g.id}` as Href)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 8 }}>
            <Icon name="edit" size={19} color={T.ink2} fill />
            <Text style={{ color: T.ink2, fontSize: 16, fontWeight: '700' }}>수정</Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 11 }}>
        {/* 이름 · 메모 */}
        <Card pad={16}>
          <Badge tone="neutral">{g.cat}</Badge>
          <Text style={{ fontSize: 23, fontWeight: '800', letterSpacing: -0.5, color: T.ink, marginTop: 10 }}>{g.name}</Text>
          {memo ? (
            <Pressable onPress={() => setMemoOpen(true)} style={{ marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: T.line2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="note" size={16} color={T.amberText} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: T.ter }}>메모</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="edit" size={16} color={T.sub} fill />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: T.sub }}>수정</Text>
                </View>
              </View>
              <Text style={{ fontSize: 14.5, fontWeight: '600', color: T.ink2, lineHeight: 21 }}>{memo}</Text>
            </Pressable>
          ) : null}
        </Card>

        {/* 잔여 */}
        <Card pad={16}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <StatusBadge status={g.soon ? 'out' : g.status} />
              <Text style={{ fontSize: 23, fontWeight: '800', letterSpacing: -0.6, color: T.ink, marginTop: 8 }}>
                미개봉 {g.sealed} · 개봉 {g.opened}
              </Text>
              <Text style={{ fontSize: 14, color: T.ink, marginTop: 4 }}>
                총 {total}개 · 개당 {perLabel(g.unit, g.per)}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
                {g.safe != null ? <Badge tone="neutral" sm>{`안전재고 ${g.safe}개`}</Badge> : null}
                {g.minOrder != null ? <Badge tone="neutral" sm>{`최소발주 ${g.minOrder}개`}</Badge> : null}
              </View>
            </View>
            <Pressable onPress={() => setAdjustOpen(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="edit" size={16} color={T.sub} fill />
              <Text style={{ color: T.sub, fontSize: 15, fontWeight: '700' }}>수정</Text>
            </Pressable>
          </View>
        </Card>

        {/* 기준 단가 */}
        <Card pad={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#5B6573' }}>
              기준 단가 <Text style={{ fontSize: 13, fontWeight: '600', color: T.sub2 }}>(로스 반영)</Text>
            </Text>
            <PeriodChip value="최근 3개월" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View>
              <Text style={[{ fontSize: 23, fontWeight: '800', color: T.blue }, NUM]}>
                {g.price}
                <Text style={{ fontSize: 15 }}>{g.priceUnit}</Text>
              </Text>
            </View>
            {g.avg != null ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 13.5, color: T.ter }}>가중평균</Text>
                <Text style={[{ fontSize: 17, fontWeight: '700', color: T.ink }, NUM]}>
                  {g.avg}
                  {g.priceUnit}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: T.line2, gap: 7 }}>
            {priceRows.map(([label, val, vendor]) =>
              val == null ? null : (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', width: 30, color: label === '최저' ? T.blue : label === '최고' ? T.red : T.sub }}>{label}</Text>
                  <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>
                    {val}
                    <Text style={{ fontSize: 13, fontWeight: '600', color: T.sub2 }}>{g.priceUnit}</Text>
                  </Text>
                  <View style={{ flex: 1 }} />
                  {vendor ? <Text style={{ fontSize: 13, color: T.ter, fontWeight: '600' }}>{vendor}</Text> : null}
                </View>
              ),
            )}
          </View>
        </Card>

        {/* 가격 추이 · 최근 주문 (데이터 있는 경우) */}
        {extra ? (
          <Card pad={16}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#5B6573', marginBottom: 8 }}>최근 주문내역</Text>
            <View>
              {(showAllOrders ? extra.purchases : extra.purchases.slice(0, 3)).map((p, i, arr) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                  <Text numberOfLines={1} style={[{ fontSize: 13, color: T.ter, width: 46 }, NUM]}>{p.date}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '700', color: T.ink }}>{p.vendor}</Text>
                    <Text style={{ fontSize: 12.5, color: T.ter, marginTop: 1 }}>
                      {p.each}, {p.qtyN}개 {won(p.unitWon)}원 <Text style={{ color: T.sub2, fontWeight: '600' }}>(총 {won(p.unitWon * p.qtyN)}원)</Text>
                    </Text>
                  </View>
                  <Text style={[{ fontSize: 14.5, fontWeight: '800', color: T.ink }, NUM]}>
                    {p.per}
                    <Text style={{ fontSize: 12, fontWeight: '600', color: T.sub2 }}>{g.priceUnit}</Text>
                  </Text>
                </View>
              ))}
            </View>
            {extra.purchases.length > 3 ? (
              <Pressable
                onPress={() => setShowAllOrders((v) => !v)}
                style={{ marginTop: 11, paddingVertical: 11, borderRadius: 10, backgroundColor: T.line2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: T.sub }}>
                  {showAllOrders ? '접기' : '더 보기'}
                </Text>
                <View style={showAllOrders ? { transform: [{ rotate: '180deg' }] } : undefined}>
                  <Icon name="chevronDown" size={16} color={T.ter} />
                </View>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {/* 구매 옵션 (데이터 있는 경우) */}
        {extra ? (
          <Card pad={16}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#5B6573', marginBottom: 8 }}>구매 링크 · 옵션</Text>
            {extra.options.map((o, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: i < extra.options.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '700', color: T.ink }}>{o.name}</Text>
                    {o.best ? <Badge tone="green" sm>최저가</Badge> : null}
                    {o.high ? <Badge tone="red" sm>▲33%</Badge> : null}
                  </View>
                  <Text style={[{ fontSize: 13, color: T.ter, marginTop: 2 }, NUM]}>
                    {o.vendor} · {o.per}{g.priceUnit}
                  </Text>
                </View>
                <Icon name="link" size={18} color={T.blue} />
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>

      {/* ING-04 재고 수정 — 바텀시트 */}
      <StockAdjustSheet visible={adjustOpen} ingredientId={g.id} onClose={() => setAdjustOpen(false)} />

      {/* 메모 편집 — 바텀시트 */}
      <MemoEditSheet
        visible={memoOpen}
        value={memo}
        onClose={() => setMemoOpen(false)}
        onSave={(next) => { setMemo(next); setMemoOpen(false); }}
      />
    </View>
  );
}
