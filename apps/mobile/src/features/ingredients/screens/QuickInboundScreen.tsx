/**
 * ING-03b 재고 추가 (빠른 입고) — 발주 없이 산 것을 바로 넣는다.
 *
 * ⚠ **재고 수정(E5)과 다른 화면이어야 한다.** 결과가 완전히 다르기 때문이다.
 *     재고 수정 : 재고만 바뀐다. 단가·메뉴 원가는 그대로
 *     재고 추가 : 재고 + **기준 단가** + **연결된 전 메뉴의 원가·순이익**이 바뀐다
 *   같은 시트의 탭으로 두면 "숫자를 올린다"는 같은 손짓이 한쪽은 아무것도 안 건드리고
 *   한쪽은 전 메뉴 손익을 움직인다.
 *
 * 반영 미리보기는 **서버가 낸다**(quick_inbound_preview). 앱이 따로 계산하면
 * 확정 후 숫자와 갈리고, 사장님은 그 화면을 두 번 다시 안 믿는다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Button, Card, Field, Icon, Input, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatQuantity, formatUnitPrice } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';
import { todayBusiness } from '@/features/sales/period';
import { useIngredientDetail, useQuickInbound, useQuickInboundPreview } from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };
const dispUnit = (u: 'g' | 'ml' | 'ea') => (u === 'ea' ? '개' : u);

const num = (s: string) => {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

export function QuickInboundScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;
  const router = useRouter();

  const detail = useIngredientDetail(id);
  const save = useQuickInbound();
  const g = detail.data;
  const unit = g ? dispUnit(g.baseUnit) : 'g';

  /** 고른 구매 옵션. -1 이면 직접 입력. */
  const [optIdx, setOptIdx] = useState(0);
  const [optOpen, setOptOpen] = useState(false);
  const [volume, setVolume] = useState('');
  const [qty, setQty] = useState(1);
  const [paid, setPaid] = useState('');
  const [day, setDay] = useState(todayBusiness());

  const options = g?.options ?? [];
  const opt = optIdx >= 0 ? options[optIdx] : undefined;

  // 옵션을 고르면 용량·금액이 따라온다. 사장님이 칠 건 "몇 개"뿐이다.
  useEffect(() => {
    if (!opt) return;
    setVolume(String(opt.volume));
    setPaid(String(opt.amount * qty));
    // qty 는 일부러 뺐다 — 개수를 바꿀 때마다 금액을 덮어쓰면 고친 금액이 날아간다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optIdx, g?.id]);

  const perVolume = num(volume);
  /** 팩 1개 금액. 서버는 팩 단위로 받는다 — 실제 결제금액을 개수로 나눈다. */
  const perAmount = qty > 0 ? num(paid) / qty : 0;

  const preview = useQuickInboundPreview(id, perVolume, perAmount, qty);
  const p = preview.data;

  const volError = perVolume <= 0 ? '용량을 입력해 주세요' : undefined;
  const paidError = num(paid) < 0 ? '금액은 0 이상이어야 해요' : undefined;
  const canSave = Boolean(id) && !volError && !paidError && qty > 0 && !save.isPending;

  /** 버튼을 두 번 눌러도 한 번만 들어가게 하는 키. 화면을 연 뒤 입력이 바뀌면 새로 만든다. */
  const idemKey = useMemo(
    () => `qi-${id}-${day}-${perVolume}-${perAmount}-${qty}`,
    [id, day, perVolume, perAmount, qty],
  );

  const onSave = () => {
    if (!canSave || !id) return;
    save.mutate(
      {
        ingredientId: id,
        volume: perVolume,
        amount: perAmount,
        qty,
        vendorId: opt?.vendorId ?? null,
        occurredAt: day,
        idempotencyKey: idemKey,
      },
      {
        onSuccess: () => safeBack(`/ingredients/${id}`),
        onError: (e) =>
          Alert.alert('넣지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  const added = perVolume * qty;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="재고 추가" onBack={() => safeBack(`/ingredients/${id}`)} />

      <QueryState
        isLoading={detail.isLoading}
        error={detail.error}
        isEmpty={!g}
        onRetry={() => void detail.refetch()}
        emptyTitle="식재료를 찾을 수 없어요"
      >
        {g ? (
          <>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20, gap: 11 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* 무엇을 넣는가 */}
              <Card pad={16}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter }}>식재료</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: T.ink, marginTop: 3 }}>{g.name}</Text>
                <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 4 }, NUM]}>
                  현재 재고 {formatQuantity(g.stockTotal, unit)}
                  {g.basePrice !== null ? ` · 기준 단가 ${formatUnitPrice(g.basePrice, unit)}` : ''}
                </Text>
              </Card>

              {/* 입고 정보 */}
              <Card pad={16}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>입고 정보</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: T.blue }}>재고와 단가에 반영</Text>
                </View>

                <Field label="구매한 곳 · 구매 옵션">
                  <Pressable
                    onPress={() => setOptOpen(true)}
                    accessibilityRole="button" accessibilityLabel="구매 옵션 선택"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      {opt ? (
                        <>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>
                            {opt.vendorName ? `${opt.vendorName} · ` : ''}{opt.name}
                          </Text>
                          <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>
                            {won(opt.amount)}원 · {formatUnitPrice(opt.amount / opt.volume, unit)}
                          </Text>
                        </>
                      ) : (
                        <Text style={{ fontSize: 16, fontWeight: '600', color: T.ter }}>직접 입력</Text>
                      )}
                    </View>
                    <Icon name="chevron" size={16} color={T.ter} />
                  </Pressable>
                </Field>

                <Field
                  label="개당 용량"
                  req
                  error={volume !== '' ? volError : undefined}
                  hint="구매한 상품 1개의 실제 용량"
                >
                  <Input
                    value={volume}
                    onChangeText={(t) => setVolume(clampDecimals(t, 2))}
                    placeholder="0"
                    suffix={unit}
                    mono
                    keyboardType="decimal-pad"
                    accessibilityLabel="개당 용량"
                  />
                </Field>

                <Field label="입고 수량" req>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Pressable
                      onPress={() => setQty((v) => Math.max(1, v - 1))}
                      disabled={qty <= 1}
                      accessibilityRole="button" accessibilityLabel="수량 줄이기"
                      hitSlop={6}
                      style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: T.line2, opacity: qty <= 1 ? 0.45 : 1, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icon name="minus" size={18} color={T.sub} sw={2.4} />
                    </Pressable>
                    <Text style={[{ minWidth: 34, textAlign: 'center', fontSize: 20, fontWeight: '800', color: T.ink }, NUM]}>
                      {qty}
                    </Text>
                    <Pressable
                      onPress={() => setQty((v) => v + 1)}
                      accessibilityRole="button" accessibilityLabel="수량 늘리기"
                      hitSlop={6}
                      style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: T.blue, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icon name="plus" size={18} color={T.onColor} sw={2.4} />
                    </Pressable>
                    <Text style={[{ flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '700', color: T.blue }, NUM]}>
                      추가 재고 {formatQuantity(added, unit)}
                    </Text>
                  </View>
                </Field>

                <Field
                  label="실제 결제금액"
                  error={paid !== '' ? paidError : undefined}
                  hint="선택한 구매 옵션 금액이 자동 입력돼요. 실제 결제금액이 다르면 고쳐 주세요"
                >
                  <Input
                    value={paid}
                    onChangeText={(t) => setPaid(clampDecimals(t, 0))}
                    placeholder="0"
                    suffix="원"
                    mono
                    keyboardType="number-pad"
                    accessibilityLabel="실제 결제금액"
                  />
                </Field>

                <Field label="입고일" hint={day !== todayBusiness() ? '지난 날짜 입고는 오늘 기준부터 반영돼요' : undefined}>
                  <Input
                    value={day}
                    onChangeText={setDay}
                    placeholder="YYYY-MM-DD"
                    mono
                    accessibilityLabel="입고일"
                  />
                </Field>
              </Card>

              {/* 반영 미리보기 — 서버가 낸 값이다 */}
              {p ? (
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>반영 미리보기</Text>
                  </View>
                  <View style={{ paddingHorizontal: 15, paddingVertical: 4 }}>
                    {([
                      ['재고', `${formatQuantity(p.stockBefore, unit)} → ${formatQuantity(p.stockAfter, unit)}`],
                      ['이번 입고 단가', p.inboundUnitPrice === null ? '—' : formatUnitPrice(p.inboundUnitPrice, unit)],
                      ['기준 단가 예상',
                        p.basePriceAfter === null ? '—'
                          : `${p.basePriceBefore === null ? '—' : formatUnitPrice(p.basePriceBefore, unit)} → ${formatUnitPrice(p.basePriceAfter, unit)}`],
                    ] as const).map(([k, v], i) => (
                      <View key={k} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: T.line2 }}>
                        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{k}</Text>
                        <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{v}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 7, paddingVertical: 12, paddingHorizontal: 15, borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.blueTint }}>
                    <Icon name="info" size={16} color={T.blue} />
                    <Text style={{ flex: 1, fontSize: 14, color: T.sub, lineHeight: 20 }}>
                      입고를 확정하면 재고와 입고 이력이 추가되고, 기준 단가와
                      {p.affectedRecipes > 0 ? ` 연결된 메뉴 ${p.affectedRecipes}개의 원가가` : ' 연결된 메뉴 원가가'} 함께 갱신돼요.
                    </Text>
                  </View>
                </Card>
              ) : null}
            </ScrollView>

            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.surface }}>
              <Button kind="primary" size="lg" full disabled={!canSave} loading={save.isPending} onPress={onSave}>
                {added > 0 ? `재고 ${formatQuantity(added, unit)} 추가` : '재고 추가'}
              </Button>
            </View>

            {/* 구매 옵션 선택 */}
            <Sheet visible={optOpen} onClose={() => setOptOpen(false)} title="구매한 곳 선택" height={480}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {[{ id: '', name: '구매 옵션 선택 안 함', hint: '구매처·용량·결제금액 직접 입력' } as const]
                  .map((x) => (
                    <Pressable
                      key={x.id}
                      onPress={() => { setOptIdx(-1); setOptOpen(false); }}
                      accessibilityRole="button" accessibilityLabel={x.name}
                      accessibilityState={{ selected: optIdx === -1 }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4 }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: optIdx === -1 ? T.blue : T.ink }}>{x.name}</Text>
                        <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{x.hint}</Text>
                      </View>
                      {optIdx === -1 ? <Icon name="check" size={18} color={T.blue} sw={2.4} /> : null}
                    </Pressable>
                  ))}
                {options.map((o, i) => (
                  <Pressable
                    key={o.id}
                    onPress={() => { setOptIdx(i); setOptOpen(false); }}
                    accessibilityRole="button" accessibilityLabel={o.name}
                    accessibilityState={{ selected: optIdx === i }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: T.line2 }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: optIdx === i ? T.blue : T.ink }} numberOfLines={1}>
                        {o.vendorName ? `${o.vendorName} · ` : ''}{o.name}
                      </Text>
                      <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>
                        {won(o.amount)}원 · {formatUnitPrice(o.amount / o.volume, unit)}
                      </Text>
                    </View>
                    {optIdx === i ? <Icon name="check" size={18} color={T.blue} sw={2.4} /> : null}
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => { setOptOpen(false); router.push(`/ingredients/option?ingredient=${id}`); }}
                  accessibilityRole="button" accessibilityLabel="새 구매 링크·옵션 추가"
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 12, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: T.blue }}
                >
                  <Icon name="plus" size={17} color={T.blue} sw={2.2} />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>새 구매 링크 · 옵션 추가</Text>
                </Pressable>
              </ScrollView>
            </Sheet>
          </>
        ) : null}
      </QueryState>
    </View>
  );
}
