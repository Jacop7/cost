/**
 * 기준 단가 + 그 값을 만든 입고 기록 — **한 카드**다.
 *
 * 프로토타입: docs/prototypes/ingredient-price-inbound-history.html
 *
 * 따로 있으면 "5.00원/g" 이 어디서 나왔는지 사장님이 두 카드를 오가며 맞춰 봐야 한다.
 * 숫자 바로 아래에 근거를 붙인다.
 *
 * ⚠ **단가 계산에 들어간 기록만** 보여 준다. 입고 대기·취소는 단가를 만들지 않았는데
 *   같은 카드에 섞이면 "이것도 5.00원에 반영됐나?" 를 만든다.
 *
 * ⚠ 금액은 **실제로 결제한 만큼**이다(팩 금액 × 받은 개수). 전에는 팩 1개 금액을
 *   총액처럼 보여 줬다 — "1kg × 3개 · 4,000원" 인데 실제로는 12,000원이었다.
 */
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/kit';
import { formatQuantity, formatUnitPrice } from '@margincook/core';
import { T, tnum } from '@/theme/tokens';
import { packSummary } from '@/lib/num';

export interface InboundRecord {
  id: string;
  orderedAt: string;
  status: 'ordered' | 'partial' | 'received' | 'canceled';
  volume: number;
  amount: number;
  qty: number;
  receivedQty: number;
  vendorName: string | null;
  unitPrice: number | null;
}

/** 단가를 만든 기록인가. 도착하지 않은 물량은 평균을 끌면 안 된다(0038). */
const countsForPrice = (o: InboundRecord) =>
  (o.status === 'received' || o.status === 'partial') && o.receivedQty > 0;

export function BasePriceCard({
  unit,
  basePrice,
  purchase,
  orders,
  onSeeAll,
}: {
  unit: 'g' | 'ml' | '개';
  basePrice: number | null;
  purchase: { count: number; avg: number | null; low: number | null; high: number | null };
  orders: InboundRecord[];
  onSeeAll: () => void;
}) {
  const priced = orders.filter(countsForPrice).slice(0, 5);

  return (
    <View style={{ backgroundColor: T.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: T.line }}>
      {/* 헤더 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>기준 단가</Text>
        <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}>입고 {purchase.count}건 기준</Text>
      </View>

      {/* 값 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}>실입고 기준</Text>
            <Text style={[{ fontSize: 22, fontWeight: '800', color: basePrice === null ? T.ter : T.blue, marginTop: 2 }, tnum]}>
              {basePrice === null ? '산출 전' : formatUnitPrice(basePrice, unit)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 14, color: T.ter }}>가중평균</Text>
            <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, tnum]}>
              {purchase.avg === null ? '—' : formatUnitPrice(purchase.avg, unit)}
            </Text>
          </View>
        </View>

        {purchase.count > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: T.line2 }}>
            {([
              ['최저', purchase.low, T.blue],
              ['최고', purchase.high, T.red],
            ] as const).map(([lbl, val, color]) => (
              <View key={lbl} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color }}>{lbl}</Text>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, tnum]}>
                  {val === null ? '—' : formatUnitPrice(val, unit)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ fontSize: 14, color: T.ter, lineHeight: 20, marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: T.line2 }}>
            입고 기록이 없어 단가를 낼 수 없어요. 재고 추가나 발주 → 입고를 등록하면 자동으로 계산돼요.
          </Text>
        )}
      </View>

      {/* 그 값을 만든 기록 */}
      {priced.length > 0 ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: T.surface2, borderTopWidth: 1, borderBottomWidth: 1, borderColor: T.line2 }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: T.sub }}>최근 입고</Text>
            <Text style={{ fontSize: 13, color: T.ter, fontWeight: '600' }}>단가 계산에 포함된 기록</Text>
          </View>

          <View style={{ paddingHorizontal: 16 }}>
            {priced.map((o, i) => {
              const partial = o.status === 'partial';
              const isLow = purchase.low !== null && o.unitPrice !== null && Math.abs(o.unitPrice - purchase.low) < 0.0001;
              const isHigh = purchase.high !== null && o.unitPrice !== null && Math.abs(o.unitPrice - purchase.high) < 0.0001;

              return (
                /*
                 * 한 줄에 하나씩, **왼쪽은 무엇 · 오른쪽은 값**으로 맞춘다.
                 *   08/18                          [최고]
                 *   식자재 쇼핑몰                19.60원/g
                 *   총 6kg (3kg × 2개) · 30,000원
                 *
                 * 날짜 옆에 뱃지, 거래처 옆에 단가 — 눈이 가로로 짝을 짓는다.
                 * '입고 완료'는 뺐다. 이 목록은 전부 입고된 기록이라 아무 말도 아니다.
                 */
                <View
                  key={o.id}
                  style={{ paddingVertical: 12, borderBottomWidth: i < priced.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}
                >
                  {/* 1줄 — 언제 · 그때가 최고였나 최저였나 */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600' }, tnum]}>
                      {o.orderedAt.slice(5).replace('-', '/')}
                    </Text>
                    {partial ? (
                      <Text style={{ fontSize: 13, fontWeight: '700', color: T.amberText }}>부분 입고</Text>
                    ) : null}
                    <View style={{ flex: 1 }} />
                    {isLow || isHigh ? (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: isHigh ? T.redTint : T.blueTint }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: isHigh ? T.red : T.blue }}>
                          {isHigh ? '최고' : '최저'}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* 2줄 — 어디서 · 얼마에. 붙어 있어야 비교가 된다. */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 }}>
                    <Text style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>
                      {o.vendorName ?? '거래처 미지정'}
                    </Text>
                    <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, tnum]}>
                      {o.unitPrice === null ? '—' : formatUnitPrice(o.unitPrice, unit)}
                    </Text>
                  </View>

                  {/* 3줄 — 무엇을 얼마어치. 부분 입고면 그 사실만 오른쪽에 덧붙인다. */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
                    <Text style={[{ flex: 1, minWidth: 0, fontSize: 14, color: T.sub2 }, tnum]}>
                      {packSummary({
                        volume: o.volume, qty: o.qty, receivedQty: o.receivedQty, amount: o.amount,
                        fmtQty: (v) => formatQuantity(v, unit),
                        fmtWon: (v) => v.toLocaleString('ko-KR'),
                      })}
                      {partial ? ' 반영' : ''}
                    </Text>
                    {partial ? (
                      <Text style={{ fontSize: 13, color: T.ter }}>도착분만 반영</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      <Pressable
        onPress={onSeeAll}
        accessibilityRole="button" accessibilityLabel="입고 이력 전체 보기"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 13, borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.surface2 }}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: T.sub }}>입고 이력 전체보기</Text>
        <Icon name="chevron" size={16} color={T.ter} />
      </Pressable>
    </View>
  );
}
