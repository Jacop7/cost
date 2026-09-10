/**
 * ING-03b 재고 추가 — 프로토타입 `business-hours-negative-stock-flow.html` 의
 * `unifiedStockAddScreen` 규격. 발주 없이 산 것을 바로 넣는다.
 *
 * 2026-09-09 사용자 요청: 수정 메뉴의 입고·차감·폐기 탭을 프로토타입과 연결한다.
 * 이 컴포넌트는 여전히 입고(E7+E1)만 처리한다. E5/E2는 StockChangeScreen의 별도
 * 본체가 처리하며, editLayout에서는 입고 확인을 거쳐야만 실제 저장을 호출한다.
 *
 * ⚠ 구매처는 **필수**다. 첫 화면은 회색 `미선택` 이고 그 상태로는 등록할 수 없다.
 *   예전엔 첫 옵션이 자동으로 골라져 있었다 — 사장님이 안 본 구매처가 기준단가에
 *   섞여 들어갔다. 기준단가는 `쓴 돈 ÷ 들어온 양`(0072)이라 어디서 샀는지가 곧 값이다.
 *
 * 반영 미리보기는 **서버가 낸다**(quick_inbound_preview). 앱이 따로 계산하면
 * 확정 후 숫자와 갈리고, 사장님은 그 화면을 두 번 다시 안 믿는다.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { operationKeyFor } from '../operationKey';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Button, Card, ConfirmSheet, Field, Icon, Input, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { showToast } from '@/lib/toast';
import { useSessionState } from '@/lib/SessionProvider';
import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { formatQuantity, formatUnitPrice, isNegativeStock } from '@margincook/core';
import { COLOR, COMPONENT, T, won, TYPE, controlVisualHeight, radius, space } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';

import { useEnsureVendor } from '@/features/master-data/hooks';
import { useIngredientDetail, useQuickInbound, useQuickInboundPreview } from '../hooks';
import { StockChangeOverview } from '../components/StockChangeOverview';
import { InboundPurchasePicker } from '../components/InboundPurchasePicker';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { StockResultField } from '../components/StockResultField';
import { StockMutationConfirm } from '../components/StockMutationConfirm';

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
type Choice = { mode: 'none' } | { mode: 'option'; optionId: string; vendorId: string | null } | { mode: 'direct' };

/** 프로토타입 `.stock-add-summary-row` — 라벨 좌, 값 우, 한 줄에 하나. */
function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: 'red' }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
      <Text style={{ flexGrow: 1, flexShrink: 0, maxWidth: '100%', fontSize: 14, fontWeight: '700', color: COLOR.text.tertiary }}>{label}</Text>
      <Text style={[{ maxWidth: '100%', marginLeft: 'auto', fontSize: 16, fontWeight: '800', color: tone === 'red' ? COLOR.status.negative : T.ink }, NUM]}>{value}</Text>
    </View>
  );
}

/** 프로토타입 `.stock-add-preview-row` — `이전 → 이후`. */
function PreviewRow({ label, before, after, beforeTone, afterTone, last }: {
  label: string; before: string; after: string; beforeTone?: 'red'; afterTone?: 'red'; last?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingVertical: space.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 }}>
      <Text style={{ flexGrow: 1, flexShrink: 0, maxWidth: '100%', fontSize: 16, fontWeight: '600', color: T.sub }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'flex-end', maxWidth: '100%', marginLeft: 'auto' }}>
        <Text style={[{ maxWidth: '100%', fontSize: 16, color: beforeTone === 'red' ? COLOR.status.negative : COLOR.text.tertiary, fontWeight: beforeTone === 'red' ? '800' : '700' }, NUM]}>{before}</Text>
        <Text style={[{ maxWidth: '100%', fontSize: 16, fontWeight: '700', color: COLOR.text.tertiary }, NUM]}>
          {' → '}
          <Text style={{ color: afterTone === 'red' ? COLOR.status.negative : COLOR.text.accent, fontWeight: '800' }}>{after}</Text>
        </Text>
      </View>
    </View>
  );
}

/**
 * ⚠ 여기 날짜는 **매장 현지 날짜**다(0125). 판매 영업일이 아니다 —
 *   발주·입고는 달력 날짜로 센다. 앱이 직접 계산하지 않고 서버에서 받는다.
 */
export function QuickInboundScreen({ editLayout = false }: { editLayout?: boolean }) {
  // 게이트가 오류를 그릴 때도 나갈 길이 있어야 한다 — 본체 밖이라 여기서 한 번 더 읽는다.
  const gateId = useLocalSearchParams<{ id?: string }>().id;
  const { userId, storeId } = useSessionState();
  // A new scope owns a new editor instance, including A → B → A. This isolates
  // callbacks; it does not persist drafts or unresolved operation keys.
  const editorKey = JSON.stringify([userId, storeId, gateId, editLayout]);
  return (
    <BusinessDateGate source={useStoreLocalDate()} title={editLayout ? '재고 수정' : '재고 추가'} onBack={() => safeBack(`/ingredients/${gateId}`)}>
      {(localDate) => <QuickInboundScreenBody key={editorKey} localDate={localDate} editLayout={editLayout} />}
    </BusinessDateGate>
  );
}

function QuickInboundScreenBody({ localDate, editLayout }: { localDate: string; editLayout: boolean }) {
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
  // 입고일은 편집하지 않는다. 서버가 제공한 매장 오늘 날짜로만 기록한다.
  const [err, setErr] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const active = useRef(true);
  const submitting = useRef(false);
  const [preparing, setPreparing] = useState(false);
  // Invalidate at the unmount commit before a queued vendor promise can resume.
  useLayoutEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const options = g?.options ?? [];
  // 배열 순서가 바뀌어도 다른 옵션으로 바꾸지 않는다. 현재 목록에 없는 옵션은 저장 금지.
  const opt = choice.mode === 'option' ? options.find(o => o.id === choice.optionId) : undefined;
  // 같은 옵션도 구매처가 바뀌면 새 선택이 필요하다. 입력 초안과 새 구매처를 섞어 저장하지 않는다.
  const hasChoice = choice.mode === 'direct' || (choice.mode === 'option' && opt !== undefined && choice.vendorId === opt.vendorId);

  // 옵션을 고르면 용량·금액이 따라온다. 사장님이 칠 건 "몇 개"뿐이다.
  useEffect(() => {
    if (!opt) return;
    setVolume(String(opt.volume));
    setPaid(String(opt.amount * qty));
    // qty 는 일부러 뺐다 — 개수를 바꿀 때마다 금액을 덮어쓰면 고친 금액이 날아간다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, g?.id]);

  // 저장 옵션은 읽기 전용 총 결제금액이므로 개수와 함께 바뀌어야 한다.
  // 기존 간편 입고/직접 입력의 사용자가 수정한 결제금액은 덮어쓰지 않는다.
  useEffect(() => {
    if (editLayout && opt && hasChoice) {
      setVolume(String(opt.volume));
      setPaid(String(opt.amount * qty));
    }
  }, [editLayout, opt?.id, opt?.amount, opt?.volume, qty, hasChoice]);

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
    Boolean(id) && hasChoice && !volError && !paidError && !vendorError && qty > 0 && !save.isPending && !preparing;

  const operation = useRef<{ payload: string; key: string } | null>(null);

  const onSave = () => {
    if (!active.current || !canSave || !id || submitting.current) return;
    submitting.current = true;
    setPreparing(true);
    void (async () => {
      let vendorId: string | null = opt?.vendorId ?? null;
      if (choice.mode === 'direct') {
        try {
          vendorId = await ensureVendor(vendor);
        } catch (e) {
          if (!active.current) return;
          submitting.current = false;
          setPreparing(false); setConfirmOpen(false); setErr(e instanceof Error ? e.message : '구매처를 저장하지 못했어요');
          return;
        }
      }
      if (!active.current) return;
      setPreparing(false);
      operation.current = operationKeyFor(operation.current, [id, localDate, perVolume, perAmount, qty, vendorId], 'qi');
      save.mutate(
        {
          ingredientId: id,
          volume: perVolume,
          amount: perAmount,
          qty,
          vendorId,
          occurredAt: localDate,
          idempotencyKey: operation.current.key,
        },
        {
          onSuccess: () => {
            if (!active.current) return;
            operation.current = null; submitting.current = false;
            setConfirmOpen(false); showToast('입고 처리했어요.'); safeBack(`/ingredients/${id}`);
          },
          onError: (e) => {
            if (!active.current) return;
            submitting.current = false; setConfirmOpen(false);
            setErr(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');
          },
        },
      );
    })();
  };

  const added = perVolume * qty;
  const choiceLabel =
    choice.mode === 'none' ? '미선택'
      : choice.mode === 'direct' ? '직접 입력'
        : !hasChoice ? '다시 선택해 주세요'
        : `${opt?.vendorName ? `${opt.vendorName} · ` : ''}${opt?.name ?? ''}`;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={editLayout ? '재고 수정' : '재고 추가'} onBack={() => safeBack(`/ingredients/${id}`)} />

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
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: editLayout ? space.sm : 4, paddingBottom: 20, gap: space.md }}
              keyboardShouldPersistTaps="handled"
            >
              {/*
                무엇을 넣는가 — 프로토타입은 `현재 재고`와 `기준단가`를 **각각 한 행**으로 둔다.
                ⚠ 음수 재고는 빨강 그대로다(0102). 여기서 0 으로 보이면 왜 채우는지가 사라진다.
              */}
              {editLayout ? <StockChangeOverview id={g.id} name={g.name} stock={g.stockTotal} basePrice={g.basePrice} unit={unit} mode="inbound" disabled={save.isPending || preparing} /> : <Card pad={16}>
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
              </Card>}

              {/* 입고 정보 */}
              <View style={editLayout ? undefined : { padding: space.lg, backgroundColor: T.surface, borderRadius: radius.lg }}>
                {!editLayout ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>입고 정보</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: COLOR.text.accent }}>재고와 단가에 반영</Text>
                </View> : null}

                <Field label={editLayout ? '구매처' : '구매한 곳 · 옵션'} req variant={editLayout ? 'stacked' : undefined}>
                  <Pressable
                    onPress={() => setOptOpen(true)}
                    accessibilityRole="button" accessibilityLabel={`구매한 곳 선택, ${choiceLabel}`}
                    accessibilityState={{ expanded: optOpen }}
                    aria-expanded={optOpen}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: editLayout ? COMPONENT.stackedForm.controlMinHeight : undefined, paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: 12, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      {/* ⚠ 미선택은 **회색**이다. 검게 쓰면 고른 것처럼 보인다. */}
                      <Text
                        style={{ fontSize: 16, fontWeight: !hasChoice ? '600' : '700', color: !hasChoice ? COLOR.text.tertiary : T.ink }}
                        numberOfLines={2}
                      >
                        {choiceLabel}
                      </Text>
                      {hasChoice && opt && !editLayout ? (
                        <Text style={[{ fontSize: 14, color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>
                          {won(opt.amount)}원 · {formatUnitPrice(opt.amount / opt.volume, unit)}
                        </Text>
                      ) : null}
                    </View>
                    <Icon name={editLayout ? 'chevronDown' : 'chevron'} size={16} color={COLOR.text.tertiary} />
                  </Pressable>
                </Field>

                {(!editLayout || hasChoice) ? <>
                {/* 직접 입력일 때만 — 구매처명이 있어야 등록할 수 있다. */}
                {choice.mode === 'direct' ? (
                  <Field label="구매처" req variant={editLayout ? 'stacked' : undefined} error={vendor !== '' ? vendorError : undefined}>
                    <Input
                      variant={editLayout ? 'stacked' : undefined}
                      value={vendor}
                      onChangeText={setVendor}
                      placeholder="구매처 입력"
                      accessibilityLabel="구매처"
                    />
                  </Field>
                ) : null}

                <Field
                  label={editLayout ? '용량' : '개당 용량'}
                  variant={editLayout ? 'stacked' : undefined}
                  req
                  error={volume !== '' ? volError : undefined}
                  hint={editLayout ? undefined : '구매한 상품 1개의 실제 용량'}
                >
                  <Input
                    variant={editLayout ? 'stacked' : undefined}
                    value={volume}
                    onChangeText={(t) => setVolume(clampDecimals(t, 2))}
                    placeholder="0"
                    suffix={unit}
                    mono={!editLayout}
                    readOnly={editLayout && choice.mode === 'option'}
                    keyboardType="decimal-pad"
                    accessibilityLabel="개당 용량"
                  />
                </Field>

                <Field label="입고 수량" req variant={editLayout ? 'stacked' : undefined}>
                  {editLayout ? <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.line, borderRadius: radius.md, backgroundColor: T.surface, minHeight: COMPONENT.stackedForm.controlMinHeight }}>
                    <Pressable accessibilityRole="button" accessibilityLabel="수량 줄이기" disabled={qty <= 1}
                      onPress={() => setQty(v => Math.max(1, v - 1))} style={{ width: 50, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="minus" size={16} color={T.sub} />
                    </Pressable>
                    <Text style={{ flex: 1, ...TYPE.body, textAlign: 'center', fontWeight: '800', color: T.ink }}>{qty}<Text style={{ ...TYPE.caption, color: T.sub }}> 개</Text></Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="수량 늘리기" onPress={() => setQty(v => v + 1)}
                      style={{ width: 50, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="plus" size={16} color={COLOR.action.primary} />
                    </Pressable>
                  </View> :
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Pressable
                      onPress={() => setQty((v) => Math.max(1, v - 1))}
                      disabled={qty <= 1}
                      accessibilityRole="button" accessibilityLabel="수량 줄이기"
                      hitSlop={6}
                      style={{ width: controlVisualHeight.md, height: controlVisualHeight.md, borderRadius: radius.md, backgroundColor: T.line2, opacity: qty <= 1 ? 0.45 : 1, alignItems: 'center', justifyContent: 'center' }}
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
                      style={{ width: controlVisualHeight.md, height: controlVisualHeight.md, borderRadius: radius.md, backgroundColor: COLOR.action.primary, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icon name="plus" size={18} color={T.onColor} sw={2.4} />
                    </Pressable>
                    <Text style={[{ flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '700', color: COLOR.text.accent }, NUM]}>
                      추가 재고 {formatQuantity(added, unit)}
                    </Text>
                  </View>}
                </Field>

                {editLayout ? <StockResultField label="총 입고량" value={formatQuantity(added, unit)} /> : null}

                <Field
                  label="실제 결제금액"
                  variant={editLayout ? 'stacked' : undefined}
                  req
                  error={paid !== '' ? paidError : undefined}
                  hint={editLayout ? undefined : '선택한 구매 옵션 금액이 자동 입력돼요. 실제 결제금액이 다르면 고쳐 주세요'}
                >
                  <Input
                    variant={editLayout ? 'stacked' : undefined}
                    value={paid}
                    onChangeText={(t) => setPaid(clampDecimals(t, 0))}
                    placeholder="0"
                    suffix="원"
                    mono={!editLayout}
                    readOnly={editLayout && choice.mode === 'option'}
                    keyboardType="number-pad"
                    accessibilityLabel="실제 결제금액"
                  />
                </Field>

                {editLayout ? <StockResultField label="입고 후 기준단가" value={preview.isLoading ? '계산 중' : preview.error ? '계산 실패' : p?.basePriceAfter == null ? '—' : formatUnitPrice(p.basePriceAfter, unit)} /> : null}

                </> : null}
              </View>

              {/*
                반영 내용 — 서버가 낸 값이다. 프로토타입은 `재고`와 `기준단가` 두 줄이다.
                ⚠ `이번 입고 단가` 는 한 줄 더 둔다. 사장님이 이번에 얼마에 샀는지를
                  기준단가 변화와 나란히 봐야 "왜 단가가 내려갔지"에 답이 된다.
              */}
              {p && !editLayout ? (
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.md, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>반영 내용</Text>
                  </View>
                  <View style={{ paddingHorizontal: space.md, paddingVertical: 4 }}>
                    <PreviewRow
                      label="재고"
                      before={formatQuantity(p.stockBefore, unit)}
                      after={formatQuantity(p.stockAfter, unit)}
                      beforeTone={isNegativeStock(p.stockBefore) ? 'red' : undefined}
                      afterTone={isNegativeStock(p.stockAfter) ? 'red' : undefined}
                    />
                    <PreviewRow
                      label="기준단가"
                      before={p.basePriceBefore === null ? '산출 전' : formatUnitPrice(p.basePriceBefore, unit)}
                      after={p.basePriceAfter === null ? '—' : formatUnitPrice(p.basePriceAfter, unit)}
                    />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingVertical: space.md }}>
                      <Text style={{ flexGrow: 1, flexShrink: 0, maxWidth: '100%', fontSize: 16, fontWeight: '600', color: T.sub }}>이번 입고 단가</Text>
                      <Text style={[{ maxWidth: '100%', marginLeft: 'auto', fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>
                        {p.inboundUnitPrice === null ? '—' : formatUnitPrice(p.inboundUnitPrice, unit)}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: space.sm, paddingVertical: 12, paddingHorizontal: space.md, borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: COLOR.action.primaryTint }}>
                    <Icon name="info" size={16} color={COLOR.action.primary} />
                    <Text style={{ flex: 1, fontSize: 14, color: T.sub, lineHeight: TYPE.caption.lineHeight }}>
                      입고를 확정하면 재고와 입고 이력이 추가되고, 기준 단가와
                      {p.affectedRecipes > 0 ? ` 연결된 메뉴 ${p.affectedRecipes}개의 원가가` : ' 연결된 메뉴 원가가'} 함께 갱신돼요.
                    </Text>
                  </View>
                </Card>
              ) : null}
            </ScrollView>

            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.surface }}>
              <Button kind="primary" size={editLayout ? 'md' : 'lg'} full disabled={!canSave} loading={save.isPending} onPress={() => setConfirmOpen(true)}>
                {editLayout ? `재고 ${formatQuantity(added, unit)} 입고` : !hasChoice ? '구매한 곳을 골라 주세요' : added > 0 ? `재고 ${formatQuantity(added, unit)} 추가` : '재고 추가'}
              </Button>
            </View>

            {/* 구매한 곳 선택 — ⚠ 아무것도 안 고른 상태가 기본이다. */}
            {editLayout ? <InboundPurchasePicker visible={optOpen} onClose={() => setOptOpen(false)} options={options} unit={unit}
              selected={choice.mode === 'option' ? choice.optionId : choice.mode}
              onSelect={key => {
                if (key === 'none') setChoice({ mode: 'none' });
                else if (key === 'direct') setChoice({ mode: 'direct' });
                else { const option = options.find(o => o.id === key); if (option) setChoice({ mode: 'option', optionId: option.id, vendorId: option.vendorId }); }
                setOptOpen(false);
              }} onAdd={() => { setOptOpen(false); router.push(`/ingredients/option?ingredient=${id}`); }} /> :
            <Sheet visible={optOpen} onClose={() => setOptOpen(false)} title="구매한 곳 · 옵션" height={480}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Pressable
                  onPress={() => { setChoice({ mode: 'direct' }); setOptOpen(false); }}
                  accessibilityRole="button" accessibilityLabel={`직접 입력${Platform.OS === 'web' && choice.mode === 'direct' ? ', 현재 선택됨' : ''}`}
                  accessibilityState={{ selected: choice.mode === 'direct' }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, paddingHorizontal: 4 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: choice.mode === 'direct' ? COLOR.state.selectedText : T.ink }}>직접 입력</Text>
                    <Text style={{ fontSize: 14, color: COLOR.text.tertiary, marginTop: space.xs }}>구매처·용량·결제금액을 직접 적어요</Text>
                  </View>
                  {choice.mode === 'direct' ? <Icon name="check" size={18} color={COLOR.action.primary} sw={2.4} /> : null}
                </Pressable>
                {options.map((o) => {
                  const on = hasChoice && choice.mode === 'option' && choice.optionId === o.id;
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => { setChoice({ mode: 'option', optionId: o.id, vendorId: o.vendorId }); setOptOpen(false); }}
                      accessibilityRole="button" accessibilityLabel={`${o.vendorName ? `${o.vendorName} · ` : ''}${o.name}, ${won(o.amount)}원, ${formatUnitPrice(o.amount / o.volume, unit)}${Platform.OS === 'web' && on ? ', 현재 선택됨' : ''}`}
                      accessibilityState={{ selected: on }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: T.line2 }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: on ? COLOR.state.selectedText : T.ink }} numberOfLines={2}>
                          {o.vendorName ? `${o.vendorName} · ` : ''}{o.name}
                        </Text>
                        <Text style={[{ fontSize: 14, color: COLOR.text.tertiary, marginTop: space.xs }, NUM]}>
                          {won(o.amount)}원 · {formatUnitPrice(o.amount / o.volume, unit)}
                        </Text>
                      </View>
                      {on ? <Icon name="check" size={18} color={COLOR.action.primary} sw={2.4} /> : null}
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => { setOptOpen(false); router.push(`/ingredients/option?ingredient=${id}`); }}
                  accessibilityRole="button" accessibilityLabel="새 구매 링크·옵션 추가"
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, marginTop: 12, paddingVertical: space.md, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: COLOR.action.primary }}
                >
                  <Icon name="plus" size={17} color={COLOR.action.primary} sw={2.2} />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: COLOR.text.link }}>새 구매 링크 · 옵션 추가</Text>
                </Pressable>
              </ScrollView>
            </Sheet>}

            <StockMutationConfirm visible={confirmOpen} action="입고" ingredientName={g.name}
              quantity={formatQuantity(added, unit)} remaining={preview.isLoading ? '계산 중' : preview.error ? '계산 실패' : p ? formatQuantity(p.stockAfter, unit) : '—'}
              negative={!!p && isNegativeStock(p.stockAfter)} loading={save.isPending || preparing}
              onCancel={() => { if (!save.isPending && !preparing) setConfirmOpen(false); }} onConfirm={onSave} />
            {/* 루트 웹 보정의 브라우저 기본 알림 대신 공용 시트로 알린다. */}
            {editLayout ? <ConfirmDialog visible={err !== null} title="입고 실패" kind="primary" closeLabel="입고 실패 안내 닫기"
              message="재고를 입고하지 못했어요. 잠시 후 다시 시도해 주세요."
              confirmText="확인" cancelText={null} onCancel={() => setErr(null)} onConfirm={() => setErr(null)}>
              {err && err !== '잠시 후 다시 시도해 주세요' ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, textAlign: 'center' }}>{err}</Text> : null}
            </ConfirmDialog> : <ConfirmSheet
              visible={err !== null}
              title="넣지 못했어요"
              message={err ?? ''}
              confirmText="확인"
              cancelText="닫기"
              onCancel={() => setErr(null)}
              onConfirm={() => setErr(null)}
            />}
          </>
        ) : null}
      </QueryState>
    </View>
  );
}
