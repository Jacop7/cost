import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { formatMarketMoney, formatQuantity, marketMoneyInputFormat } from '@costkeep/core';
import type { LaunchCurrencyCode } from '@costkeep/types';

import { AppHeader, Button, Card, ConfirmDialog, Field, Icon, Input, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { clampByUnit, clampDecimals } from '@/lib/num';
import { useSessionState } from '@/lib/SessionProvider';
import { showToast } from '@/lib/toast';
import { useUnitPriceFormat } from '@/lib/unitPriceFormat';
import { useInternationalTaxState } from '@/features/international-tax';
import { COLOR, COMPONENT, LAYOUT, T, TYPE, radius, space } from '@/theme/tokens';
import {
  type BulkInboundItemInput,
  type BulkInboundPreviewItem,
  type IngredientDetail,
  type IngredientRow,
  useIngredientDetail,
  useIngredientList,
  useQuickInboundBatch,
  useQuickInboundBatchPreview,
  useResolveQuickInboundBatch,
} from '../hooks';
import {
  createBulkInboundKey,
  type BulkInboundPending,
  withBulkInboundJournal,
} from '../bulkInboundOperation';

type CardDraft = {
  id: string;
  ingredientId: string;
  optionId: string;
  vendorId: string | null;
  paid: string;
  quantity: string;
};

const emptyCard = (): CardDraft => ({
  id: createBulkInboundKey(), ingredientId: '', optionId: 'none', vendorId: null, paid: '', quantity: '',
});
const numberOf = (value: string) => Number(value.replace(/,/g, ''));
const displayUnit = (unit: IngredientRow['baseUnit']) => unit === 'ea' ? '개' : unit;

function ChoiceRow({ label, value, onPress, disabled = false }: { label: string; value: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Field label={label} variant="stacked">
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}`}
        accessibilityState={{ disabled }}
        style={{ minHeight: COMPONENT.stackedForm.controlMinHeight, flexDirection: 'row', alignItems: 'center', gap: space.sm,
          paddingHorizontal: COMPONENT.stackedForm.controlPaddingHorizontal, borderWidth: 1, borderColor: T.line,
          borderRadius: radius.md, backgroundColor: T.surface, opacity: disabled ? 0.5 : 1 }}
      >
        <Text numberOfLines={1} style={{ flex: 1, ...TYPE.body, color: value === '미선택' || value === '재료 선택' ? COLOR.text.tertiary : T.ink }}>{value}</Text>
        <Icon name="chevronDown" size={16} color={COLOR.text.tertiary} />
      </Pressable>
    </Field>
  );
}

function SelectSheet({ visible, title, rows, selected, onSelect, onClose, footer }: {
  visible: boolean; title: string; rows: { id: string; label: string; description?: string }[];
  selected: string; onSelect: (id: string) => void; onClose: () => void; footer?: ReactNode;
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose} footer={footer}>
      {rows.map((row, index) => {
        const active = row.id === selected;
        return <Pressable key={row.id} onPress={() => { onSelect(row.id); onClose(); }} accessibilityRole="button"
          accessibilityLabel={row.label} accessibilityState={{ selected: active }}
          style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md,
            borderTopWidth: index ? 1 : 0, borderTopColor: T.line2 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...TYPE.body, color: active ? COLOR.state.selectedText : T.ink }}>{row.label}</Text>
            {row.description ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, marginTop: space.xs }}>{row.description}</Text> : null}
          </View>
          {active ? <Icon name="check" size={18} color={COLOR.action.primary} /> : null}
        </Pressable>;
      })}
    </Sheet>
  );
}

function InboundCard({ index, draft, ingredients, preview, currency, editorScope, onChange, onDelete }: {
  index: number; draft: CardDraft; ingredients: IngredientRow[]; preview?: BulkInboundPreviewItem;
  currency: LaunchCurrencyCode;
  editorScope?: { userId: string; storeId: string; instance: string };
  onChange: (patch: Partial<CardDraft>) => void; onDelete: () => void;
}) {
  const router = useRouter();
  const detail = useIngredientDetail(draft.ingredientId || undefined, editorScope);
  const formatUnitPrice = useUnitPriceFormat();
  const ingredient = ingredients.find(item => item.id === draft.ingredientId);
  const unit = displayUnit(ingredient?.baseUnit ?? 'g');
  const [ingredientOpen, setIngredientOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const options = detail.data?.options ?? [];
  const option = options.find(item => item.id === draft.optionId);
  const purchaseName = option ? (option.vendorName ?? option.name) : '미선택';
  const afterPrice = preview?.basePriceAfter;
  const moneyInput = marketMoneyInputFormat(currency);

  const chooseIngredient = (ingredientId: string) => onChange({ ingredientId, optionId: 'none', vendorId: null, paid: '', quantity: '' });
  const chooseOption = (optionId: string) => {
    const next = options.find(item => item.id === optionId);
    if (!next) onChange({ optionId: 'none', vendorId: null });
    else onChange({ optionId, vendorId: next.vendorId, paid: String(next.amount), quantity: String(next.volume) });
  };

  return (
    <View>
      <Card style={{ gap: space.md }}>
        <ChoiceRow label="재료명" value={ingredient?.name ?? '재료 선택'} onPress={() => setIngredientOpen(true)} />
        <ChoiceRow label="구매처 (선택)" value={purchaseName} disabled={!ingredient} onPress={() => setPurchaseOpen(true)} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Field label="결제금액" req variant="stacked">
              <Input variant="stacked" value={draft.paid} onChangeText={text => onChange({ paid: clampDecimals(text, moneyInput.digits) })}
                keyboardType="decimal-pad" placeholder="0" prefix={moneyInput.prefix} suffix={moneyInput.suffix} mono
                numberFormat={{ fixedDigits: moneyInput.digits, group: moneyInput.group, decimal: moneyInput.decimal }}
                accessibilityLabel={`${index + 1}번째 결제금액`} />
            </Field>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Field label="입고 후 단가" variant="stacked">
              <Input variant="stacked" readOnly value={afterPrice == null ? '' : formatUnitPrice(afterPrice, unit)} placeholder={ingredient ? '계산 전' : '—'} accessibilityLabel={`${index + 1}번째 입고 후 단가`} />
            </Field>
          </View>
        </View>
        <Field label="입고량" req variant="stacked">
          <Input variant="stacked" value={draft.quantity} onChangeText={text => onChange({ quantity: clampByUnit(text, ingredient?.baseUnit ?? 'g') })}
            keyboardType="decimal-pad" placeholder="0" suffix={unit} mono accessibilityLabel={`${index + 1}번째 입고량`} />
        </Field>
        {preview ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary }}>
          입고 후 재고 {formatQuantity(preview.stockAfter, unit)} · 연결 메뉴 {preview.affectedRecipes}
        </Text> : null}
      </Card>
      <Button kind="ghost" size="sm" full onPress={onDelete} accessibilityLabel={`${index + 1}번째 입고 카드 삭제`}
        style={{ marginTop: space.sm, borderColor: COLOR.status.negative }}>
        <Text style={{ color: COLOR.status.negative }}>삭제</Text>
      </Button>

      <SelectSheet visible={ingredientOpen} title="재료 선택" rows={ingredients.map(item => ({
        id: item.id, label: item.name, description: `현재 재고 ${formatQuantity(item.stockTotal, displayUnit(item.baseUnit))}`,
      }))} selected={draft.ingredientId} onSelect={chooseIngredient} onClose={() => setIngredientOpen(false)} />
      <SelectSheet visible={purchaseOpen} title="구매처 선택" rows={[
        { id: 'none', label: '미선택' },
        ...options.map(item => ({ id: item.id, label: item.vendorName ?? item.name,
          description: `${item.name} · ${formatMarketMoney(item.amount, currency)} · ${formatQuantity(item.volume, unit)}` })),
      ]} selected={draft.optionId} onSelect={chooseOption} onClose={() => setPurchaseOpen(false)}
        footer={<Button kind="ghost" full onPress={() => { setPurchaseOpen(false); router.push('/my/vendors'); }}>새 구매처 추가</Button>} />
    </View>
  );
}

export function BulkInboundScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { userId, storeId } = useSessionState();
  const ingredientList = useIngredientList();
  const internationalTax = useInternationalTaxState();
  const currency = internationalTax.data?.marketProfile?.currencyCode ?? 'KRW';
  const [cards, setCards] = useState<CardDraft[]>([emptyCard()]);
  const [message, setMessage] = useState<string | null>(null);
  const [submissionActive, setSubmissionActive] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [checkedJournalScope, setCheckedJournalScope] = useState<string | null>(null);
  const [leaveAllowed, setLeaveAllowed] = useState(false);
  const resolving = useRef(false);
  const submitting = useRef(false);
  const pendingLeaveAction = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);
  const allowedLeaveAction = useRef<(() => void) | null>(null);
  const save = useQuickInboundBatch();
  const resolve = useResolveQuickInboundBatch();
  const resolvePending = resolve.mutateAsync;
  const scope = useMemo(() => ({ actorId: userId ?? '', storeId: storeId ?? '' }), [userId, storeId]);
  const journalScopeKey = JSON.stringify(scope);
  const recoveryActive = Boolean(scope.actorId && scope.storeId) && checkedJournalScope !== journalScopeKey;
  const inboundIngredients = useMemo(
    () => (ingredientList.data ?? []).filter(item => item.stockTracking !== false),
    [ingredientList.data],
  );
  const inputs = useMemo<BulkInboundItemInput[]>(() => cards.map(card => ({
    clientItemId: card.id,
    ingredientId: card.ingredientId,
    vendorId: card.vendorId,
    receivedQuantity: numberOf(card.quantity),
    paidAmount: numberOf(card.paid),
  })), [cards]);
  const complete = inputs.length > 0 && inputs.every(item => item.ingredientId && item.receivedQuantity > 0 && item.paidAmount > 0);
  const preview = useQuickInboundBatchPreview(complete ? inputs : []);
  const previewById = new Map((preview.data ?? []).map(item => [item.clientItemId, item]));
  const dirty = cards.length > 1 || cards.some(card => card.ingredientId || card.optionId !== 'none' || card.paid || card.quantity);
  const previewFailedId = (preview.error as { clientItemId?: string } | null)?.clientItemId;
  const previewFailedIndex = previewFailedId ? cards.findIndex(card => card.id === previewFailedId) : -1;
  const previewErrorMessage = preview.error
    ? `${previewFailedIndex >= 0 ? `${previewFailedIndex + 1}번째 카드: ` : ''}${preview.error instanceof Error ? preview.error.message : '입고 후 단가를 계산하지 못했어요.'}`
    : null;

  useEffect(() => {
    if (!scope.actorId || !scope.storeId || resolving.current) return;
    resolving.current = true;
    void withBulkInboundJournal(scope, async journal => {
      const pending = await journal.read();
      if (!pending) return;
      const result = await resolvePending(pending.requestKey);
      await journal.clear(pending);
      if (result.status === 'recorded') {
        showToast(`${pending.cardCount}건을 입고했어요`);
        allowedLeaveAction.current = () => router.replace('/ingredients');
        setLeaveAllowed(true);
      } else setMessage('이전 요청은 저장되지 않았어요. 내용을 확인한 뒤 다시 입고해 주세요.');
    }).catch(error => setMessage(error instanceof Error ? error.message : '이전 일괄 입고를 확인하지 못했어요.'))
      .finally(() => {
        resolving.current = false;
        setCheckedJournalScope(journalScopeKey);
      });
  }, [journalScopeKey, resolvePending, router, scope]);

  useEffect(() => {
    if (!leaveAllowed || !allowedLeaveAction.current) return;
    const action = allowedLeaveAction.current;
    allowedLeaveAction.current = null;
    action();
  }, [leaveAllowed]);

  usePreventRemove(!leaveAllowed && (dirty || submissionActive || recoveryActive), ({ data }) => {
    if (submitting.current || resolving.current || submissionActive || recoveryActive) return;
    pendingLeaveAction.current = data.action;
    setConfirmLeave(true);
  });

  const update = (id: string, patch: Partial<CardDraft>) => setCards(current => current.map(card => card.id === id ? { ...card, ...patch } : card));
  const submit = async () => {
    if (submitting.current || !complete || !userId || !storeId || preview.isFetching || preview.error) return;
    submitting.current = true;
    setSubmissionActive(true);
    setMessage(null);
    let pending: BulkInboundPending | null = null;
    try {
      await withBulkInboundJournal(scope, async journal => {
        pending = await journal.keep(inputs, createBulkInboundKey());
        try {
          const result = await save.mutateAsync({ items: inputs, requestKey: pending.requestKey });
          await journal.clear(pending);
          showToast(`${result.items.length}건을 입고했어요`);
          allowedLeaveAction.current = () => router.replace('/ingredients');
          setLeaveAllowed(true);
        } catch (error) {
          if (pending) {
            try {
              const recovered = await resolvePending(pending.requestKey);
              await journal.clear(pending);
              if (recovered.status === 'recorded') {
                showToast(`${pending.cardCount}건을 입고했어요`);
                allowedLeaveAction.current = () => router.replace('/ingredients');
                setLeaveAllowed(true);
                return;
              }
            } catch {
              setMessage('입고 결과를 확인하지 못했어요. 연결을 확인한 뒤 이 화면을 다시 열어 주세요.');
              return;
            }
          }
          throw error;
        }
      });
    } catch (error) {
      const failedId = (error as { clientItemId?: string } | null)?.clientItemId;
      const failedIndex = failedId ? cards.findIndex(card => card.id === failedId) : -1;
      const prefix = failedIndex >= 0 ? `${failedIndex + 1}번째 카드: ` : '';
      setMessage(prefix + (error instanceof Error ? error.message : '일괄 입고를 저장하지 못했어요.'));
    } finally {
      submitting.current = false;
      setSubmissionActive(false);
    }
  };

  const requestLeave = () => {
    if (submissionActive || recoveryActive) return;
    if (dirty) setConfirmLeave(true);
    else {
      allowedLeaveAction.current = () => safeBack('/ingredients');
      setLeaveAllowed(true);
    }
  };
  const leave = () => {
    const action = pendingLeaveAction.current;
    pendingLeaveAction.current = null;
    setConfirmLeave(false);
    allowedLeaveAction.current = action ? () => navigation.dispatch(action) : () => safeBack('/ingredients');
    setLeaveAllowed(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="재료 일괄 입고" onBack={requestLeave} />
      <QueryState isLoading={ingredientList.isLoading} error={ingredientList.error} isEmpty={inboundIngredients.length === 0}
        onRetry={() => void ingredientList.refetch()} emptyTitle="입고할 재료가 없어요" emptyHint="재료를 먼저 등록해 주세요">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.md,
          paddingBottom: LAYOUT.scroll.end + 88, gap: space.lg }}>
          {cards.map((card, index) => <InboundCard key={card.id} index={index} draft={card} ingredients={inboundIngredients} currency={currency}
            editorScope={{ userId: userId ?? 'session-pending', storeId: storeId ?? 'store-pending', instance: card.id }}
            preview={previewById.get(card.id)} onChange={patch => update(card.id, patch)}
            onDelete={() => setCards(current => current.length === 1 ? [emptyCard()] : current.filter(item => item.id !== card.id))} />)}
          <Button kind="tint" full disabled={cards.length >= 20} onPress={() => setCards(current => [...current, emptyCard()])}>＋ 입고 카드 추가</Button>
          {previewErrorMessage ? <View style={{ alignItems: 'center', gap: space.sm }}>
            <Text accessibilityRole="alert" style={{ ...TYPE.caption, color: COLOR.status.negative, textAlign: 'center' }}>{previewErrorMessage}</Text>
            <Button kind="ghost" size="sm" onPress={() => void preview.refetch()}>미리보기 다시 시도</Button>
          </View> : null}
          {message ? <Text accessibilityRole="alert" style={{ ...TYPE.caption, color: COLOR.status.negative, textAlign: 'center' }}>{message}</Text> : null}
        </ScrollView>
      </QueryState>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md,
        paddingBottom: space.lg, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.line }}>
        <Button kind="primary" full disabled={submissionActive || !complete || preview.isFetching || Boolean(preview.error)} loading={submissionActive || save.isPending || resolve.isPending} onPress={() => void submit()}>
          {cards.length}건 일괄 입고
        </Button>
      </View>
      <ConfirmDialog visible={confirmLeave} title="입고 작성을 나갈까요?" message="입력한 내용은 저장되지 않아요."
        confirmText="나가기" cancelText="계속 작성" kind="primary" closeLabel="이탈 확인 닫기"
        onCancel={() => { pendingLeaveAction.current = null; setConfirmLeave(false); }} onConfirm={leave} />
    </View>
  );
}
