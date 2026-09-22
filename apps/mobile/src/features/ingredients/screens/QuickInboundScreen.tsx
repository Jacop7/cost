import { useUnitPriceFormat } from '@/lib/unitPriceFormat';
import { BundleUnitPicker } from '@/features/settings/BundleUnitPicker';
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
import { newOperationKey } from '../operationKey';
import { clearInboundIntent, inboundIntentBusy, keepInboundIntent, readInboundIntent,
  subscribeInboundIntent, withInboundIntentLock, type InboundIntent, type InboundScope } from '../inboundIntentStorage';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Button, Card, ConfirmSheet, Field, Icon, Input, QueryState, Sheet, Notice } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { showToast } from '@/lib/toast';
import { useSessionState } from '@/lib/SessionProvider';
import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { formatQuantity, isNegativeStock } from '@costkeep/core';
import { COLOR, COMPONENT, T, won, TYPE, controlVisualHeight, radius, space } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';

import { useEnsureVendor } from '@/features/master-data/hooks';
import { useIngredientDetail, useInventoryOccurrenceContext, useQuickInbound, useQuickInboundPreview, useResolveQuickInbound } from '../hooks';
import { StockChangeOverview } from '../components/StockChangeOverview';
import { InboundPurchasePicker } from '../components/InboundPurchasePicker';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { StockResultField } from '../components/StockResultField';
import { StockMutationConfirm } from '../components/StockMutationConfirm';
import { InventoryOccurrenceFields, emptyInventoryOccurrence, inventoryOccurrenceInput,
  inventoryOccurrenceReady } from '../components/InventoryOccurrenceFields';

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
export function QuickInboundScreen({ editLayout = false, initialEntry = false, standalone = false }: { editLayout?: boolean; initialEntry?: boolean; standalone?: boolean }) {
  // 게이트가 오류를 그릴 때도 나갈 길이 있어야 한다 — 본체 밖이라 여기서 한 번 더 읽는다.
  const gateId = useLocalSearchParams<{ id?: string }>().id;
  const { userId, storeId } = useSessionState();
  // A new scope owns a new editor instance, including A → B → A. This isolates
  // callbacks. Unresolved submissions are separately persisted by owner/ingredient.
  const editorKey = JSON.stringify([userId, storeId, gateId, editLayout, initialEntry, standalone]);
  const router = useRouter();
  const localDate = useStoreLocalDate();
  return (
    <BusinessDateGate source={localDate} title={initialEntry ? '재고 입력' : standalone ? '입고' : editLayout ? '재고 조정' : '입고'} onBack={() => initialEntry ? router.replace(`/ingredients/${gateId}`) : safeBack(`/ingredients/${gateId}`)}>
      {(localDate) => <QuickInboundScreenBody key={editorKey} localDate={localDate} editLayout={editLayout} initialEntry={initialEntry} standalone={standalone} />}
    </BusinessDateGate>
  );
}

function QuickInboundScreenBody({ localDate, editLayout, initialEntry, standalone }: { localDate: string; editLayout: boolean; initialEntry: boolean; standalone: boolean }) {
  const formatUnitPrice = useUnitPriceFormat();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;
  const router = useRouter();
  const leave = () => initialEntry ? router.replace(`/ingredients/${params.id}`) : safeBack(`/ingredients/${params.id}`);
  const { userId, storeId } = useSessionState();
  const scope: InboundScope = { actorId: userId ?? '', storeId: storeId ?? '', ingredientId: id ?? '' };

  const detail = useIngredientDetail(id);
  const occurrenceContext = useInventoryOccurrenceContext(id);
  const save = useQuickInbound();
  const resolvePrevious = useResolveQuickInbound();
  const ensureVendor = useEnsureVendor();
  const g = detail.data;
  const unit = g ? dispUnit(g.baseUnit) : 'g';

  const [choice, setChoice] = useState<Choice>({ mode: initialEntry ? 'direct' : 'none' });
  const [optOpen, setOptOpen] = useState(false);
  const [vendor, setVendor] = useState('');
  const [volume, setVolume] = useState('');
  const [qty, setQty] = useState(1);
  const [paid, setPaid] = useState('');
  const [occurrence, setOccurrence] = useState(emptyInventoryOccurrence);
  // 입고일은 편집하지 않는다. 서버가 제공한 매장 오늘 날짜로만 기록한다.
  const [err, setErr] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const active = useRef(true);
  const volumeEdited = useRef(false);
  const submitting = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const [intent, setIntent] = useState<InboundIntent | null>(null);
  const [intentLoaded, setIntentLoaded] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [intentBusy, setIntentBusy] = useState(false);
  const readSequence = useRef(0);
  const attemptedResolution = useRef<string | null>(null);
  const [resolvingPrevious, setResolvingPrevious] = useState(false);
  // Invalidate at the unmount commit before a queued vendor promise can resume.
  useLayoutEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const refreshIntent = async () => {
    const sequence = ++readSequence.current;
    setIntentBusy(inboundIntentBusy(scope));
    try {
      const saved = await readInboundIntent(scope);
      if (!active.current || sequence !== readSequence.current) return;
      setIntent(saved); setIntentLoaded(true); setIntentError(null);
      // Reconcile once per request on entry/after an uncertain response. Never
      // send the old purchase again, or silently replace its original payload.
      if (saved && !inboundIntentBusy(scope) && attemptedResolution.current !== saved.payload.idempotencyKey) {
        attemptedResolution.current = saved.payload.idempotencyKey;
        void resolveSavedIntent();
      }
    } catch (error) {
      if (!active.current || sequence !== readSequence.current) return;
      setIntentLoaded(false); setIntentError(error instanceof Error ? error.message : '입고 확인 정보를 읽지 못했어요.');
    }
  };
  const resolveSavedIntent = async () => {
    if (!active.current || inboundIntentBusy(scope)) return true;
    let serverResolved = false;
    setResolvingPrevious(true);
    try {
      await withInboundIntentLock(scope, async () => {
        const saved = await readInboundIntent(scope);
        if (!saved || !active.current) {
          serverResolved = true;
          if (active.current) { setRecoveryOpen(false); setErr(null); }
          return;
        }
        const status = await resolvePrevious.mutateAsync({ ingredientId: saved.payload.ingredientId,
          idempotencyKey: saved.payload.idempotencyKey });
        serverResolved = true;
        // Exact journal comparison protects a newer editor/request even when
        // this editor left while the server completed reconciliation.
        await clearInboundIntent(saved);
        if (active.current) {
          setIntent(null); setRecoveryOpen(false); setErr(null);
          if (status === 'recorded') showToast(`${saved.payload.occurredAt} 입고는 이미 반영됐어요.`);
        }
      });
    } catch (error) {
      // A result check never resubmits an old inbound, including server errors.
      if (active.current) setErr(current => current ?? (error instanceof Error ? error.message : '입고 결과를 확인하지 못했어요.'));
    } finally {
      if (active.current) { setResolvingPrevious(false); void refreshIntent(); }
    }
    return serverResolved;
  };
  useEffect(() => {
    void refreshIntent();
    return subscribeInboundIntent(scope, () => { if (active.current) void refreshIntent(); });
  }, [userId, storeId, id]);

  const options = g?.options ?? [];
  // 배열 순서가 바뀌어도 다른 옵션으로 바꾸지 않는다. 현재 목록에 없는 옵션은 저장 금지.
  const opt = choice.mode === 'option' ? options.find(o => o.id === choice.optionId) : undefined;
  // 재고 수정에서 미선택은 구매처 없는 간편 입고다. 포장 용량×개수 대신 용량을 바로 입력한다.
  const unassignedEntry = editLayout && !initialEntry && choice.mode === 'none';
  // 같은 옵션도 구매처가 바뀌면 새 선택이 필요하다. 입력 초안과 새 구매처를 섞어 저장하지 않는다.
  const hasChoice = unassignedEntry || choice.mode === 'direct' || (choice.mode === 'option' && opt !== undefined && choice.vendorId === opt.vendorId);

  // 옵션을 고르면 용량·금액을 초기값으로 채운다. 실제 입고 용량은 이후 수정할 수 있다.
  useEffect(() => {
    if (!opt) return;
    volumeEdited.current = false;
    setVolume(String(opt.volume));
    setPaid(String(opt.amount * qty));
    // qty 는 일부러 뺐다 — 개수를 바꿀 때마다 금액을 덮어쓰면 고친 금액이 날아간다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, g?.id]);

  // 저장 옵션의 총 결제금액은 개수와 함께 바뀐다. 용량은 사용자가 고친 뒤에는
  // 개수 변경이나 옵션 재조회로 덮어쓰지 않는다.
  useEffect(() => {
    if (editLayout && opt && hasChoice) {
      if (!volumeEdited.current) setVolume(String(opt.volume));
      setPaid(String(opt.amount * qty));
    }
  }, [editLayout, opt?.id, opt?.amount, opt?.volume, qty, hasChoice]);

  const effectiveQty = unassignedEntry ? 1 : qty;
  const perVolume = num(volume);
  /** 팩 1개 금액. 서버는 팩 단위로 받는다 — 실제 결제금액을 개수로 나눈다. */
  const perAmount = effectiveQty > 0 ? num(paid) / effectiveQty : 0;

  const preview = useQuickInboundPreview(id, perVolume, perAmount, effectiveQty);
  const p = preview.data;

  /*
   * 검증(기획안 §4.4) — 셋 다 **0보다 커야** 한다.
   * ⚠ 결제금액은 예전에 `>= 0` 이었다. 0원으로 저장하면 그 입고가 기준단가를
   *   끌어내린다 — `쓴 돈 ÷ 들어온 양` 의 분자에 0 이 섞이기 때문이다.
   */
  const volError = perVolume <= 0 ? '용량을 입력해 주세요' : undefined;
  const paidError = num(paid) <= 0 ? '결제금액을 입력해 주세요' : undefined;
  const vendorError = choice.mode === 'direct' && vendor.trim() === '' ? '구매처를 입력해 주세요' : undefined;
  const canRequestSave =
    Boolean(id && userId && storeId) && (intentLoaded || !!intentError) && !intentBusy
    && hasChoice && !volError && !paidError && !vendorError && effectiveQty > 0
    && !occurrenceContext.isLoading && !occurrenceContext.error
    && inventoryOccurrenceReady(occurrenceContext.data, occurrence)
    && !save.isPending && !preparing && !resolvingPrevious;
  const canSave = canRequestSave && !intent && !intentError;

  const onSave = () => {
    if (!active.current || !id || submitting.current || !canSave) return;
    submitting.current = true;
    setPreparing(true);
    void (async () => {
      try {
        let vendorId: string | null = opt?.vendorId ?? null;
        if (choice.mode === 'direct') vendorId = await ensureVendor(vendor);
        if (!active.current) return;
        await withInboundIntentLock(scope, async () => {
          const previous = await readInboundIntent(scope);
          if (!active.current) return;
          if (previous) throw new Error('이전 입고를 먼저 확인해 주세요.');
          const submitted: InboundIntent = { version: 1, scope, payload: {
            ingredientId: id, volume: perVolume, amount: perAmount, qty: effectiveQty, vendorId,
            occurredAt: localDate, idempotencyKey: newOperationKey('qi'),
            ...inventoryOccurrenceInput(occurrenceContext.data, occurrence),
          } };
          await keepInboundIntent(submitted);
          if (!active.current) return;
          // mutateAsync settles even if this observer unmounts. The lock is
          // released, but a late success never clears another editor's journal.
          await save.mutateAsync(submitted.payload);
          if (!active.current) return;
          await clearInboundIntent(submitted);
          if (!active.current) return;
          setIntent(null); setConfirmOpen(false); setRecoveryOpen(false); setErr(null);
          showToast('입고를 완료했어요.'); leave();
        });
      } catch (error) {
        if (active.current) {
          setConfirmOpen(false);
          setRecoveryOpen(true);
          setErr(error instanceof Error ? error.message : '입고 결과를 확인하지 못했어요.');
        }
      } finally {
        if (active.current) {
          submitting.current = false; setPreparing(false); void refreshIntent();
        }
      }
    })();
  };

  const added = perVolume * effectiveQty;
  const choiceLabel =
    choice.mode === 'none' ? '미선택'
      : choice.mode === 'direct' ? '직접 입력'
        : !hasChoice ? '다시 선택해 주세요'
        : `${opt?.vendorName ? `${opt.vendorName} · ` : ''}${opt?.name ?? ''}`;

  // 미확인 요청은 새 입고만 잠근다. 기존 입력 화면과 차감·폐기 이동은 유지한다.
  const recoveryNotice = intent || intentError ? (
    <Card pad={space.lg}>
      <View style={{ gap: space.md }}>
        <Text accessibilityRole="alert" style={{ ...TYPE.body, color: COLOR.text.primary }}>
          {intentError ?? '입고 결과를 아직 확인하지 못했어요. 새 입고 전에 이전 요청을 확인해 주세요.'}
        </Text>
        {intent ? <>
          <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>원 입고일: {intent.payload.occurredAt}</Text>
          <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>
            {formatQuantity(intent.payload.volume * intent.payload.qty, unit)} · {won(intent.payload.amount * intent.payload.qty)}원
          </Text>
          <Button disabled={intentBusy || preparing || resolvingPrevious || !!intentError} loading={preparing || resolvingPrevious}
            onPress={() => { setErr(null); void resolveSavedIntent(); }}>이 입고 다시 확인</Button>
        </> : null}
        {err ? <Text style={{ ...TYPE.caption, color: COLOR.status.negative }}>{err}</Text> : null}
        {intentError ? <Button kind="gray" onPress={() => void refreshIntent()}>입고 확인 정보 다시 불러오기</Button> : null}
      </View>
    </Card>
  ) : null;

  if (id && g?.stockTracking === false) return <Redirect href={`/ingredients/${id}`} />;
  const paymentField = <Field label="결제금액" variant={editLayout ? 'stacked' : undefined} req
    error={paid !== '' ? paidError : undefined}
    hint={editLayout ? undefined : '선택한 구매 옵션 금액이 자동 입력돼요. 결제금액이 다르면 고쳐 주세요'}>
    <Input variant={editLayout ? 'stacked' : undefined} value={paid}
      onChangeText={text => setPaid(clampDecimals(text, 0))} placeholder="0" suffix="원"
      mono={!editLayout} readOnly={editLayout && choice.mode === 'option'} keyboardType="number-pad" accessibilityLabel="결제금액" />
  </Field>;
  const volumeField = <Field label={editLayout ? '용량' : '개당 용량'} variant={editLayout ? 'stacked' : undefined} req
    error={volume !== '' ? volError : undefined}
    hint={editLayout ? undefined : '구매한 상품 1개의 실제 용량'}>
    <Input variant={editLayout ? 'stacked' : undefined} value={volume}
      onChangeText={text => { volumeEdited.current = true; setVolume(clampDecimals(text, 2)); }}
      placeholder="0" suffix={unit} mono={!editLayout} keyboardType="decimal-pad"
      accessibilityLabel={editLayout ? '용량' : '개당 용량'} />
  </Field>;
  const countField = <Field label={editLayout ? '수량' : '입고 수량'} req variant={editLayout ? 'stacked' : undefined}>
    {editLayout ? <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.line,
      borderRadius: radius.md, backgroundColor: T.surface, minHeight: COMPONENT.stackedForm.controlMinHeight }}>
      <Pressable accessibilityRole="button" accessibilityLabel="수량 줄이기" disabled={qty <= 1}
        onPress={() => setQty(value => Math.max(1, value - 1))}
        style={{ width: standalone ? 40 : 50, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="minus" size={16} color={T.sub} />
      </Pressable>
      <Text style={{ flex: 1, ...TYPE.body, textAlign: 'center', fontWeight: '800', color: T.ink }}>
        {qty}<Text style={{ ...TYPE.caption, color: T.sub }}> 개</Text>
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="수량 늘리기" onPress={() => setQty(value => value + 1)}
        style={{ width: standalone ? 40 : 50, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="plus" size={16} color={COLOR.action.primary} />
      </Pressable>
    </View> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable onPress={() => setQty(value => Math.max(1, value - 1))} disabled={qty <= 1}
        accessibilityRole="button" accessibilityLabel="수량 줄이기" hitSlop={6}
        style={{ width: controlVisualHeight.md, height: controlVisualHeight.md, borderRadius: radius.md,
          backgroundColor: T.line2, opacity: qty <= 1 ? 0.45 : 1, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="minus" size={18} color={T.sub} sw={2.4} />
      </Pressable>
      <Text style={[{ minWidth: 34, textAlign: 'center', fontSize: 20, fontWeight: '800', color: T.ink }, NUM]}>{qty}</Text>
      <Pressable onPress={() => setQty(value => value + 1)} accessibilityRole="button" accessibilityLabel="수량 늘리기" hitSlop={6}
        style={{ width: controlVisualHeight.md, height: controlVisualHeight.md, borderRadius: radius.md,
          backgroundColor: COLOR.action.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="plus" size={18} color={T.onColor} sw={2.4} />
      </Pressable>
      <Text style={[{ flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '700', color: COLOR.text.accent }, NUM]}>
        추가 재고 {formatQuantity(added, unit)}
      </Text>
    </View>}
  </Field>;
  const afterStock = p?.stockAfter ?? g?.stockTotal ?? 0;
  const afterStockValue = preview.isLoading ? '계산 중'
    : preview.error ? '계산 실패' : formatQuantity(afterStock, unit);
  const afterPriceValue = preview.isLoading ? '계산 중' : preview.error ? '계산 실패'
    : p?.basePriceAfter != null ? formatUnitPrice(p.basePriceAfter, unit)
      : initialEntry ? formatUnitPrice(0, unit) : g?.basePrice == null ? '산출 전' : formatUnitPrice(g.basePrice, unit);
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={initialEntry ? '재고 입력' : standalone ? '입고' : editLayout ? '재고 조정' : '입고'} onBack={leave} />
      <Sheet visible={recoveryOpen && !!recoveryNotice} title="이전 입고 확인"
        onClose={() => { if (!preparing && !save.isPending) { setRecoveryOpen(false); setErr(null); } }}>
        {recoveryNotice}
      </Sheet>

      <QueryState
        isLoading={detail.isLoading || occurrenceContext.isLoading}
        error={detail.error ?? occurrenceContext.error}
        isEmpty={!g}
        onRetry={() => { void detail.refetch(); void occurrenceContext.refetch(); }}
        emptyTitle="재료를 찾을 수 없어요"
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
              {initialEntry ? <StockResultField label="재료" value={g.name} align="left" /> : editLayout ? <StockChangeOverview id={g.id} name={g.name} stock={g.stockTotal} basePrice={g.basePrice} unit={unit} mode={standalone ? undefined : 'inbound'} compact inlineSummary={standalone} disabled={save.isPending || preparing} /> : <Card pad={16}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: T.ink }}>{g.name}</Text>
                <SummaryRow
                  label="현재 재고"
                  value={formatQuantity(g.stockTotal, unit)}
                  tone={isNegativeStock(g.stockTotal) ? 'red' : undefined}
                />
                <SummaryRow
                  label="단가"
                  value={g.basePrice === null ? '산출 전' : formatUnitPrice(g.basePrice, unit)}
                />
              </Card>}

              {resolvingPrevious ? <Notice>이전 입고 결과를 확인하고 있어요.</Notice>
                : intent || intentError ? <Notice>이전 입고 결과를 확인하지 못했어요. 서버 연결 후 다시 확인해 주세요.</Notice> : null}

              {/* 입고 정보 */}
              <View style={editLayout && !standalone ? undefined : { padding: space.lg, backgroundColor: T.surface, borderRadius: radius.lg }}>
                {!editLayout ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>입고 정보</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: COLOR.text.accent }}>재고와 단가에 반영</Text>
                </View> : null}

                <Field label={unassignedEntry || editLayout ? '구매처' : '구매처 · 옵션'} req={!unassignedEntry} variant={editLayout ? 'stacked' : undefined}>
                  <Pressable
                    onPress={() => setOptOpen(true)}
                    accessibilityRole="button" accessibilityLabel={`구매처 선택, ${choiceLabel}`}
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

                {standalone ? <>
                  {g?.baseUnit === 'ea' && choice.mode === 'direct' ? <BundleUnitPicker value={volume}
                    onSelect={n => { volumeEdited.current = true; setVolume(String(n)); }}
                    disabled={preparing || save.isPending} /> : null}
                  {unassignedEntry ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                    <View style={{ flex: 1, minWidth: 0 }}>{paymentField}</View>
                    <View style={{ flex: 1, minWidth: 0 }}>{volumeField}</View>
                  </View> : <>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                      <View style={{ flex: 1, minWidth: 0 }}>{volumeField}</View>
                      <View style={{ flex: 1, minWidth: 0 }}>{countField}</View>
                    </View>
                    {paymentField}
                    <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary }}>
                      총 입고량 {formatQuantity(added, unit)}
                    </Text>
                  </>}
                </> : <>
                  {paymentField}
                  {g?.baseUnit === 'ea' && choice.mode === 'direct' ? <BundleUnitPicker value={volume}
                    onSelect={n => { volumeEdited.current = true; setVolume(String(n)); }}
                    disabled={preparing || save.isPending} /> : null}
                  {volumeField}
                  {!unassignedEntry ? countField : null}
                </>}
                {editLayout && !unassignedEntry && !standalone ? <StockResultField label="총 입고량" value={formatQuantity(added, unit)} /> : null}

                {standalone ? <View style={{ gap: space.xs }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                    <Text style={{ ...TYPE.caption, fontWeight: '700', color: COLOR.text.secondary }}>입고 후 재고</Text>
                    <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary }}>단가 {afterPriceValue}</Text>
                  </View>
                  <View style={{ minHeight: COMPONENT.stackedForm.controlMinHeight, justifyContent: 'center',
                    paddingHorizontal: space.md, borderRadius: radius.md,
                    backgroundColor: p ? COLOR.action.primaryTint : T.surface2 }}>
                    <Text style={{ ...TYPE.body, textAlign: 'right', fontWeight: '800',
                      color: p ? afterStock < 0 ? COLOR.status.negative : COLOR.text.accent : COLOR.text.tertiary }}>
                      {afterStockValue}
                    </Text>
                  </View>
                </View> : editLayout ? <>
                  <StockResultField label="입고 후 재고" highlight negative={afterStock < 0} value={afterStockValue} />
                  <StockResultField label="입고 후 단가" value={afterPriceValue} />
                </> : null}

                <InventoryOccurrenceFields context={occurrenceContext.data} value={occurrence}
                  disabled={save.isPending || preparing} onChange={setOccurrence} />

                </> : null}
              </View>

              {/*
                반영 내용 — 서버가 낸 값이다. 프로토타입은 `재고`와 `기준단가` 두 줄이다.
                ⚠ `이번 입고 단가` 는 한 줄 더 둔다. 사장님이 이번에 얼마에 샀는지를
                  기준단가 변화와 나란히 봐야 "왜 단가가 내려갔지"에 답이 된다.
              */}
              {p && !editLayout ? (
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.lg, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>반영 내용</Text>
                  </View>
                  <View style={{ paddingHorizontal: space.lg, paddingVertical: 4 }}>
                    <PreviewRow
                      label="재고"
                      before={formatQuantity(p.stockBefore, unit)}
                      after={formatQuantity(p.stockAfter, unit)}
                      beforeTone={isNegativeStock(p.stockBefore) ? 'red' : undefined}
                      afterTone={isNegativeStock(p.stockAfter) ? 'red' : undefined}
                    />
                    <PreviewRow
                      label="단가"
                      before={p.basePriceBefore === null ? '산출 전' : formatUnitPrice(p.basePriceBefore, unit)}
                      after={p.basePriceAfter === null ? '—' : formatUnitPrice(p.basePriceAfter, unit)}
                    />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingVertical: space.md }}>
                      <Text style={{ flexGrow: 1, flexShrink: 0, maxWidth: '100%', fontSize: 16, fontWeight: '600', color: T.sub }}>입고 단가</Text>
                      <Text style={[{ maxWidth: '100%', marginLeft: 'auto', fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>
                        {p.inboundUnitPrice === null ? '—' : formatUnitPrice(p.inboundUnitPrice, unit)}
                      </Text>
                    </View>
                  </View>
                  <Notice style={{ margin: space.md }}>
                    입고를 완료하면 재고와 구매 내역이 추가되고, 단가와
                    {p.affectedRecipes > 0 ? ` 연결된 메뉴 ${p.affectedRecipes}개의 원가가` : ' 연결된 메뉴 원가가'} 함께 갱신돼요.
                  </Notice>
                </Card>
              ) : null}
            </ScrollView>

            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.surface }}>
              <Button kind="primary" size={editLayout ? 'md' : 'lg'} full disabled={!canRequestSave} loading={save.isPending}
                onPress={() => { if (intent || intentError) setRecoveryOpen(true); else { setRecoveryOpen(false); setConfirmOpen(true); } }}>
                 {initialEntry ? '저장' : editLayout ? `재고 ${formatQuantity(added, unit)} 입고` : !hasChoice ? '구매처를 골라 주세요' : added > 0 ? `재고 ${formatQuantity(added, unit)} 입고` : '입고'}
              </Button>
            </View>

            {/* 구매한 곳 선택 — ⚠ 아무것도 안 고른 상태가 기본이다. */}
            {editLayout ? <InboundPurchasePicker visible={optOpen} onClose={() => setOptOpen(false)} options={options} unit={unit}
              selected={choice.mode === 'option' ? choice.optionId : choice.mode}
              onSelect={key => {
                if (key === 'none') { volumeEdited.current = false; setChoice({ mode: 'none' }); setVolume(''); setPaid(''); setQty(1); }
                else if (key === 'direct') setChoice({ mode: 'direct' });
                else { const option = options.find(o => o.id === key); if (option) { volumeEdited.current = false; setChoice({ mode: 'option', optionId: option.id, vendorId: option.vendorId }); } }
                setOptOpen(false);
              }} onAdd={() => { setOptOpen(false); router.push(`/ingredients/option?ingredient=${id}`); }} /> :
            <Sheet visible={optOpen} onClose={() => setOptOpen(false)} title="구매처 · 옵션" height={480}>
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
                      onPress={() => { volumeEdited.current = false; setChoice({ mode: 'option', optionId: o.id, vendorId: o.vendorId }); setOptOpen(false); }}
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
              onCancel={() => { if (!save.isPending && !preparing) setConfirmOpen(false); }} onConfirm={() => onSave()} />
            {/* 루트 웹 보정의 브라우저 기본 알림 대신 공용 시트로 알린다. */}
            {editLayout ? <ConfirmDialog visible={err !== null && !recoveryNotice} title="입고 실패" kind="primary" closeLabel="입고 실패 안내 닫기"
              message="재고를 입고하지 못했어요. 잠시 후 다시 시도해 주세요."
              confirmText="확인" cancelText={null} onCancel={() => setErr(null)} onConfirm={() => setErr(null)}>
              {err && err !== '잠시 후 다시 시도해 주세요' ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, textAlign: 'center' }}>{err}</Text> : null}
            </ConfirmDialog> : <ConfirmSheet
              visible={err !== null && !recoveryNotice}
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
