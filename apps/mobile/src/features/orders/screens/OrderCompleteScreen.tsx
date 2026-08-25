/**
 * ORD-02 직접 발주 — 후보에 없는 식재료도 바로 발주한다.
 *
 * 발주 후보는 재고가 안전재고 아래로 내려가야 생긴다. 그런데 "다음 주 행사라 미리 사둔다"
 * 같은 경우는 후보에 안 뜬다. 그 경로가 없으면 사장님은 발주를 앱 밖에서 하게 되고,
 * 그 순간부터 입고·단가·원가가 전부 어긋난다.
 *
 * ⚠ 절대원칙 2: 여기서 등록해도 재고는 그대로다. 재고는 '입고 완료'(E1)에서만 늘어난다.
 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Badge, Button, Card, Field, Icon, Input, QueryState, SearchBar, Select, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatQuantity, formatUnitPrice, previewBaseUnitPrice, rawUnitPrice, roundOrNull } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { clampDecimals, dash } from '@/lib/num';
import { useIngredientDetail, useIngredientList } from '@/features/ingredients/hooks';
import { VendorPickerSheet } from '@/features/ingredients/components/VendorPickerSheet';
import { dispUnit } from '@/features/ingredients/ledger';
import { addDays } from '@/features/sales/period';
import { useStoreLocalDate } from '@/features/sales/businessDay';
import { BusinessDateGate } from '@/features/sales/components/BusinessDateGate';
import { usePlaceOrders } from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const num = (s: string) => {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const dayLabelOf = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEK[d.getUTCDay()]})`;
};

/**
 * ⚠ 여기 날짜는 **매장 현지 날짜**다(0125). 판매 영업일이 아니다 —
 *   발주·입고는 달력 날짜로 센다. 앱이 직접 계산하지 않고 서버에서 받는다.
 */
export default function OrderCompleteScreen() {
  return (
    <BusinessDateGate source={useStoreLocalDate()} title="직접 발주" onBack={() => safeBack('/orders')}>
      {(localDate) => <OrderCompleteScreenBody localDate={localDate} />}
    </BusinessDateGate>
  );
}

function OrderCompleteScreenBody({ localDate }: { localDate: string }) {
  const params = useLocalSearchParams<{ ingredient?: string }>();
  const today = localDate;

  const list = useIngredientList();
  const placeOrders = usePlaceOrders();

  const [ingredientId, setIngredientId] = useState<string | null>(params.ingredient ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [optionId, setOptionId] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [vendorOpen, setVendorOpen] = useState(false);

  const [volume, setVolume] = useState('');
  const [amount, setAmount] = useState('');
  const [qty, setQty] = useState('1');
  const [dayOffset, setDayOffset] = useState(1);

  const detail = useIngredientDetail(ingredientId ?? undefined);
  const g = detail.data;
  const unit = g ? dispUnit(g.baseUnit) : 'g';

  const candidates = useMemo(() => {
    const n = squash(query);
    return (list.data ?? []).filter((x) => n === '' || squash(x.name).includes(n) || squash(x.categoryName ?? '').includes(n));
  }, [list.data, query]);

  /** 구매 옵션을 고르면 용량·금액·거래처가 채워진다. 그대로 두거나 고쳐도 된다. */
  const applyOption = (id: string) => {
    const o = g?.options.find((x) => x.id === id);
    if (!o) return;
    setOptionId(id);
    setVolume(String(o.volume));
    setAmount(String(o.amount));
    setVendorId(o.vendorId);
    setVendorName(o.vendorName);
  };

  const vol = num(volume);
  const amt = num(amount);
  const qtyN = num(qty);
  const total = amt * qtyN;
  const arrival = addDays(today, dayOffset);

  // 가드 없이 계산하면 용량 0에서 Infinity 가 화면에 그대로 찍힌다. null 로 막고 '-' 로 표기한다.
  const raw = roundOrNull(rawUnitPrice(amt, vol), 2);
  const real = roundOrNull(previewBaseUnitPrice(amt, vol), 2);

  const canSave = Boolean(ingredientId) && vol > 0 && amt >= 0 && qtyN > 0 && !placeOrders.isPending;

  const submit = () => {
    if (!canSave || !ingredientId) return;
    placeOrders.mutate(
      [{ ingredientId, vendorId, volume: vol, amount: amt, qty: qtyN, expectedAt: arrival }],
      {
        onSuccess: () => safeBack('/orders'),
        onError: (e) => Alert.alert('발주하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="직접 발주" onBack={() => safeBack('/orders')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }}>
        <Field label="식재료" req>
          <Select value={g?.name ?? ''} placeholder="식재료 선택" onPress={() => setPickerOpen(true)} />
        </Field>

        {g ? (
          <>
            {/* 구매 옵션 */}
            {g.options.length > 0 ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 8 }}>구매 옵션에서 채우기</Text>
                <View style={{ gap: 8 }}>
                  {g.options.map((o) => {
                    const on = optionId === o.id;
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => applyOption(o.id)}
                        accessibilityRole="button" accessibilityLabel={o.name} accessibilityState={{ selected: on }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{o.name}, {won(o.amount)}원</Text>
                          <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 3 }, NUM]}>
                            {o.vendorName ?? '거래처 미지정'} · {formatQuantity(o.volume, unit)} · {formatUnitPrice(o.amount / (o.volume || 1), unit)}
                          </Text>
                        </View>
                        {on ? <Icon name="check" size={18} color={T.blue} sw={2.4} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <Field label="거래처">
              <Select value={vendorName ?? ''} placeholder="지정 안 함" onPress={() => setVendorOpen(true)} />
            </Field>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="개당 용량" req>
                  <Input value={volume} onChangeText={(t) => setVolume(clampDecimals(t, 2))} placeholder="0" suffix={unit} mono keyboardType="decimal-pad" accessibilityLabel="개당 용량" />
                </Field>
              </View>
              <View style={{ flex: 1.2 }}>
                <Field label="개당 금액" req>
                  <Input value={amount} onChangeText={(t) => setAmount(clampDecimals(t, 0))} placeholder="0" suffix="원" mono keyboardType="number-pad" accessibilityLabel="개당 금액" />
                </Field>
              </View>
              <View style={{ flex: 0.8 }}>
                <Field label="수량" req>
                  <Input value={qty} onChangeText={(t) => setQty(clampDecimals(t, 0))} placeholder="0" suffix="개" mono keyboardType="number-pad" accessibilityLabel="수량" />
                </Field>
              </View>
            </View>

            {/* 금액·단가 미리보기 */}
            <Card pad={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>총 발주 금액</Text>
                <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink }, NUM]}>{won(total)}원</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>구매가 단가</Text>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink2 }, NUM]}>{dash(raw)}원/{unit}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 15 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub }}>실사용 단가</Text>
                </View>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.blue }, NUM]}>{dash(real)}원/{unit}</Text>
              </View>
            </Card>

            {/* 도착 예정일 */}
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 8 }}>도착 예정일</Text>
            <View style={{ flexDirection: 'row', gap: 7, marginBottom: 10 }}>
              {([0, 1, 2, 3, 7] as const).map((n) => {
                const on = dayOffset === n;
                const label = n === 0 ? '오늘' : n === 1 ? '내일' : n === 2 ? '모레' : `${n}일 후`;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setDayOffset(n)}
                    accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: on ? T.blue : T.sub }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[{ fontSize: 14, color: T.sub2, fontWeight: '600', marginBottom: 16 }, NUM]}>{dayLabelOf(arrival)} 도착 예정</Text>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: T.blueTint }}>
              <Icon name="info" size={15} color={T.blue} />
              <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: 20 }}>
                발주는 기록만 돼요. 재고와 기준단가는 발주 현황에서 <Text style={{ fontWeight: '700' }}>입고 완료</Text>를 눌렀을 때 바뀌어요.
              </Text>
            </View>
          </>
        ) : (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: T.ter }}>먼저 식재료를 선택해 주세요</Text>
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full disabled={!canSave} loading={placeOrders.isPending} onPress={submit}>발주 등록</Button>
      </View>

      {/* 식재료 선택 */}
      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="식재료 선택" height={620}>
        <SearchBar value={query} onChange={setQuery} placeholder="식재료 이름으로 검색" autoFocus={false} />
        <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <QueryState
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={candidates.length === 0}
            onRetry={() => void list.refetch()}
            emptyTitle={query ? `'${query}' 검색 결과가 없어요` : '등록된 식재료가 없어요'}
          >
            {candidates.map((x) => {
              const on = ingredientId === x.id;
              const u = dispUnit(x.baseUnit);
              return (
                <Pressable
                  key={x.id}
                  onPress={() => {
                    setIngredientId(x.id);
                    setOptionId(null);
                    setVolume(String(x.perVolume));
                    setAmount('');
                    setPickerOpen(false);
                  }}
                  accessibilityRole="button" accessibilityLabel={x.name} accessibilityState={{ selected: on }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{x.name}</Text>
                      {x.categoryName ? <Badge tone="neutral" sm>{x.categoryName}</Badge> : null}
                    </View>
                    <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 3 }, NUM]}>
                      재고 {formatQuantity(x.stockTotal, u)} · 개당 {formatQuantity(x.perVolume, u)}
                    </Text>
                  </View>
                  {on ? <Icon name="check" size={18} color={T.blue} sw={2.4} /> : null}
                </Pressable>
              );
            })}
          </QueryState>
        </ScrollView>
      </Sheet>

      <VendorPickerSheet
        visible={vendorOpen}
        value={vendorId}
        onSelect={(vid, vname) => { setVendorId(vid); setVendorName(vname); }}
        onClose={() => setVendorOpen(false)}
      />
    </View>
  );
}
