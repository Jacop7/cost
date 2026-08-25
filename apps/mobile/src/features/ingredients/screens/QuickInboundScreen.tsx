/**
 * ING-03b 재고 추가 — 프로토타입 `business-hours-negative-stock-flow.html` 의
 * `unifiedStockAddScreen` 규격. 발주 없이 산 것을 바로 넣는다.
 *
 * ⚠ **재고 수정(E5)과 다른 화면이어야 한다.** 결과가 완전히 다르기 때문이다.
 *     재고 수정 : 재고만 바뀐다. 단가·메뉴 원가는 그대로
 *     재고 추가 : 재고 + **기준 단가** + **연결된 전 메뉴의 원가·순이익**이 바뀐다
 *   같은 시트의 탭으로 두면 "숫자를 올린다"는 같은 손짓이 한쪽은 아무것도 안 건드리고
 *   한쪽은 전 메뉴 손익을 움직인다. 그래서 여기엔 `재고 추가` 흐름 하나만 둔다
 *   (기획안 §4.4 — `재고 채우기 → 입고 등록/재고 수정` 선택 메뉴는 없다).
 *
 * ⚠ 구매처는 **필수**다. 첫 화면은 회색 `미선택` 이고 그 상태로는 등록할 수 없다.
 *   예전엔 첫 옵션이 자동으로 골라져 있었다 — 사장님이 안 본 구매처가 기준단가에
 *   섞여 들어갔다. 기준단가는 `쓴 돈 ÷ 들어온 양`(0072)이라 어디서 샀는지가 곧 값이다.
 *
 * 반영 미리보기는 **서버가 낸다**(quick_inbound_preview). 앱이 따로 계산하면
 * 확정 후 숫자와 갈리고, 사장님은 그 화면을 두 번 다시 안 믿는다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Button, Card, ConfirmSheet, Field, Icon, Input, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatQuantity, formatUnitPrice, isNegativeStock } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';
import { todayBusiness } from '@/features/sales/period';
import { useEnsureVendor } from '@/features/my/hooks';
import { useIngredientDetail, useQuickInbound, useQuickInboundPreview } from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };
const dispUnit = (u: 'g' | 'ml' | 'ea') => (u === 'ea' ? '개' : u);

const num = (s: string) => {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

/**
 * 구매처 선택 상태. `none` 이 **초깃값**이고 그 상태로는 저장할 수 없다.
 * 예전엔 이 자리가 `0`(첫 옵션)이라 아무것도 고르지 않아도 저장이 됐다.
 */
type Choice = { mode: 'none' } | { mode: 'option'; idx: number } | { mode: 'direct' };

/** 프로토타입 `.stock-add-summary-row` — 라벨 좌, 값 우, 한 줄에 하나. */
function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: 'red' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 9 }}>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.ter }}>{label}</Text>
      <Text style={[{ fontSize: 16, fontWeight: '800', color: tone === 'red' ? T.red : T.ink }, NUM]}>{value}</Text>
    </View>
  );
}

/** 프로토타입 `.stock-add-preview-row` — `이전 → 이후`. */
function PreviewRow({ label, before, after, beforeTone, last }: {
  label: string; before: string; after: string; beforeTone?: 'red'; last?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 }}>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{label}</Text>
      <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ter }, NUM]}>
        <Text style={{ color: beforeTone === 'red' ? T.red : T.ter, fontWeight: beforeTone === 'red' ? '800' : '700' }}>{before}</Text>
        {' → '}
        <Text style={{ color: T.blue, fontWeight: '800' }}>{after}</Text>
      </Text>
    </View>
  );
}

export function QuickInboundScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;
  const router = useRouter();

  const detail = useIngredientDetail(id);
  const save = useQuickInbound();
  const ensureVendor = useEnsureVendor();
  const g = detail.data;
  const unit = g ? dispUnit(g.baseUnit) : 'g';

  const [choice, setChoice] = useState<Choice>({ mode: 'none' });
  const [optOpen, setOptOpen] = useState(false);
  const [vendor, setVendor] = useState('');
  const [volume, setVolume] = useState('');
  const [qty, setQty] = useState(1);
  const [paid, setPaid] = useState('');
  const [day, setDay] = useState(todayBusiness());
  const [err, setErr] = useState<string | null>(null);

  const options = g?.options ?? [];
  const opt = choice.mode === 'option' ? options[choice.idx] : undefined;

  // 옵션을 고르면 용량·금액이 따라온다. 사장님이 칠 건 "몇 개"뿐이다.
  useEffect(() => {
    if (!opt) return;
    setVolume(String(opt.volume));
    setPaid(String(opt.amount * qty));
    // qty 는 일부러 뺐다 — 개수를 바꿀 때마다 금액을 덮어쓰면 고친 금액이 날아간다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, g?.id]);

  const perVolume = num(volume);
  /** 팩 1개 금액. 서버는 팩 단위로 받는다 — 실제 결제금액을 개수로 나눈다. */
  const perAmount = qty > 0 ? num(paid) / qty : 0;

  const preview = useQuickInboundPreview(id, perVolume, perAmount, qty);
  const p = preview.data;

  /*
   * 검증(기획안 §4.4) — 셋 다 **0보다 커야** 한다.
   * ⚠ 결제금액은 예전에 `>= 0` 이었다. 0원으로 저장하면 그 입고가 기준단가를
   *   끌어내린다 — `쓴 돈 ÷ 들어온 양` 의 분자에 0 이 섞이기 때문이다.
   */
  const volError = perVolume <= 0 ? '용량을 입력해 주세요' : undefined;
  const paidError = num(paid) <= 0 ? '실제 결제금액을 입력해 주세요' : undefined;
  const vendorError = choice.mode === 'direct' && vendor.trim() === '' ? '구매처를 입력해 주세요' : undefined;
  const canSave =
    Boolean(id) && choice.mode !== 'none' && !volError && !paidError && !vendorError && qty > 0 && !save.isPending;

  /** 버튼을 두 번 눌러도 한 번만 들어가게 하는 키. 화면을 연 뒤 입력이 바뀌면 새로 만든다. */
  const idemKey = useMemo(
    () => `qi-${id}-${day}-${perVolume}-${perAmount}-${qty}`,
    [id, day, perVolume, perAmount, qty],
  );

  const onSave = () => {
    if (!canSave || !id) return;
    void (async () => {
      let vendorId: string | null = opt?.vendorId ?? null;
      if (choice.mode === 'direct') {
        try {
          vendorId = await ensureVendor(vendor);
        } catch (e) {
          setErr(e instanceof Error ? e.message : '구매처를 저장하지 못했어요');
          return;
        }
      }
      save.mutate(
        {
          ingredientId: id,
          volume: perVolume,
          amount: perAmount,
          qty,
          vendorId,
          occurredAt: day,
          idempotencyKey: idemKey,
        },
        {
          onSuccess: () => safeBack(`/ingredients/${id}`),
          onError: (e) => setErr(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
        },
      );
    })();
  };

  const added = perVolume * qty;
  const choiceLabel =
    choice.mode === 'none' ? '미선택'
      : choice.mode === 'direct' ? '직접 입력'
        : `${opt?.vendorName ? `${opt.vendorName} · ` : ''}${opt?.name ?? ''}`;

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
              {/*
                무엇을 넣는가 — 프로토타입은 `현재 재고`와 `기준단가`를 **각각 한 행**으로 둔다.
                ⚠ 음수 재고는 빨강 그대로다(0102). 여기서 0 으로 보이면 왜 채우는지가 사라진다.
              */}
              <Card pad={16}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: T.ink }}>{g.name}</Text>
                <SummaryRow
                  label="현재 재고"
                  value={formatQuantity(g.stockTotal, unit)}
                  tone={isNegativeStock(g.stockTotal) ? 'red' : undefined}
                />
                <SummaryRow
                  label="기준단가"
                  value={g.basePrice === null ? '산출 전' : formatUnitPrice(g.basePrice, unit)}
                />
              </Card>

              {/* 입고 정보 */}
              <Card pad={16}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>입고 정보</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: T.blue }}>재고와 단가에 반영</Text>
                </View>

                <Field label="구매한 곳 · 옵션" req>
                  <Pressable
                    onPress={() => setOptOpen(true)}
                    accessibilityRole="button" accessibilityLabel="구매한 곳 선택"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      {/* ⚠ 미선택은 **회색**이다. 검게 쓰면 고른 것처럼 보인다. */}
                      <Text
                        style={{ fontSize: 16, fontWeight: choice.mode === 'none' ? '600' : '700', color: choice.mode === 'none' ? T.ter : T.ink }}
                        numberOfLines={1}
                      >
                        {choiceLabel}
                      </Text>
                      {opt ? (
                        <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>
                          {won(opt.amount)}원 · {formatUnitPrice(opt.amount / opt.volume, unit)}
                        </Text>
                      ) : null}
                    </View>
                    <Icon name="chevron" size={16} color={T.ter} />
                  </Pressable>
                </Field>

                {/* 직접 입력일 때만 — 구매처명이 있어야 등록할 수 있다. */}
                {choice.mode === 'direct' ? (
                  <Field label="구매처" req error={vendor !== '' ? vendorError : undefined}>
                    <Input
                      value={vendor}
                      onChangeText={setVendor}
                      placeholder="구매처 입력"
                      accessibilityLabel="구매처"
                    />
                  </Field>
                ) : null}

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
                  req
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

              {/*
                반영 내용 — 서버가 낸 값이다. 프로토타입은 `재고`와 `기준단가` 두 줄이다.
                ⚠ `이번 입고 단가` 는 한 줄 더 둔다. 사장님이 이번에 얼마에 샀는지를
                  기준단가 변화와 나란히 봐야 "왜 단가가 내려갔지"에 답이 된다.
              */}
              {p ? (
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>반영 내용</Text>
                  </View>
                  <View style={{ paddingHorizontal: 15, paddingVertical: 4 }}>
                    <PreviewRow
                      label="재고"
                      before={formatQuantity(p.stockBefore, unit)}
                      after={formatQuantity(p.stockAfter, unit)}
                      beforeTone={isNegativeStock(p.stockBefore) ? 'red' : undefined}
                    />
                    <PreviewRow
                      label="기준단가"
                      before={p.basePriceBefore === null ? '산출 전' : formatUnitPrice(p.basePriceBefore, unit)}
                      after={p.basePriceAfter === null ? '—' : formatUnitPrice(p.basePriceAfter, unit)}
                    />
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>이번 입고 단가</Text>
                      <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>
                        {p.inboundUnitPrice === null ? '—' : formatUnitPrice(p.inboundUnitPrice, unit)}
                      </Text>
                    </View>
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
                {choice.mode === 'none' ? '구매한 곳을 골라 주세요' : added > 0 ? `재고 ${formatQuantity(added, unit)} 추가` : '재고 추가'}
              </Button>
            </View>

            {/* 구매한 곳 선택 — ⚠ 아무것도 안 고른 상태가 기본이다. */}
            <Sheet visible={optOpen} onClose={() => setOptOpen(false)} title="구매한 곳 · 옵션" height={480}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Pressable
                  onPress={() => { setChoice({ mode: 'direct' }); setOptOpen(false); }}
                  accessibilityRole="button" accessibilityLabel="직접 입력"
                  accessibilityState={{ selected: choice.mode === 'direct' }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: choice.mode === 'direct' ? T.blue : T.ink }}>직접 입력</Text>
                    <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>구매처·용량·결제금액을 직접 적어요</Text>
                  </View>
                  {choice.mode === 'direct' ? <Icon name="check" size={18} color={T.blue} sw={2.4} /> : null}
                </Pressable>
                {options.map((o, i) => {
                  const on = choice.mode === 'option' && choice.idx === i;
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => { setChoice({ mode: 'option', idx: i }); setOptOpen(false); }}
                      accessibilityRole="button" accessibilityLabel={o.name}
                      accessibilityState={{ selected: on }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: T.line2 }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: on ? T.blue : T.ink }} numberOfLines={1}>
                          {o.vendorName ? `${o.vendorName} · ` : ''}{o.name}
                        </Text>
                        <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>
                          {won(o.amount)}원 · {formatUnitPrice(o.amount / o.volume, unit)}
                        </Text>
                      </View>
                      {on ? <Icon name="check" size={18} color={T.blue} sw={2.4} /> : null}
                    </Pressable>
                  );
                })}
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

            {/* ⚠ `Alert.alert()` 은 웹에서 빈 함수라 아무 일도 안 일어난다. 시트로 알린다. */}
            <ConfirmSheet
              visible={err !== null}
              title="넣지 못했어요"
              message={err ?? ''}
              confirmText="확인"
              cancelText="닫기"
              onCancel={() => setErr(null)}
              onConfirm={() => setErr(null)}
            />
          </>
        ) : null}
      </QueryState>
    </View>
  );
}
