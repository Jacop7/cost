import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader, Badge, Button, Card, Field, Icon, Input, QueryState, Sheet } from '@/components/kit';
import { ResultField } from '@/components/kit/ResultField';
import { SaleStepper } from '../components/SaleStepper';
import { CHANNEL_LABEL, channelName } from '../channels';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { useSalesBusinessDate } from '@/features/business-day/businessDay';
import { dayLabel } from '@/lib/date';
import { safeBack } from '@/lib/nav';
import { COLOR, LAYOUT, T, space, won } from '@/theme/tokens';
import {
  createSalesRequestKey, useDiscardSalesDraft, useFinalizeSalesDraft, useOpenSalesDraft, useRecoverSalesFinalize, useSalesDraft, useSaveSalesDraft,
  type SalesDraft, type SalesDraftEtcLine, type SalesDraftExpenseLine, type SalesDraftMenuLine,
} from '../lifecycle';

const NUM = { fontVariant: ['tabular-nums' as const] };
type Qty = Pick<SalesDraftMenuLine, 'qtyHall' | 'qtyDelivery' | 'qtyTakeout' | 'qtyWaste'>;

export default function SalesDraftWriteScreen() {
  const source = useSalesBusinessDate();
  const params = useLocalSearchParams<{ date?: string }>();
  return (
    <BusinessDateGate source={source} title="매출 작성">
      {today => <SalesDraftWriteBody today={today} date={params.date ?? today} />}
    </BusinessDateGate>
  );
}

function SalesDraftWriteBody({ today, date }: { today: string; date: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const openDraft = useOpenSalesDraft();
  const recoverFinalize = useRecoverSalesFinalize();
  const [draftId, setDraftId] = useState<string | null>(null);
  const remote = useSalesDraft(draftId);
  const saveDraft = useSaveSalesDraft();
  const finalize = useFinalizeSalesDraft();
  const discard = useDiscardSalesDraft();
  const [draft, setDraft] = useState<SalesDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<SalesDraftMenuLine | null>(null);
  const [qty, setQty] = useState<Qty>({ qtyHall: 0, qtyDelivery: 0, qtyTakeout: 0, qtyWaste: 0 });
  const [etcOpen, setEtcOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [etcName, setEtcName] = useState('');
  const [etcPrice, setEtcPrice] = useState('');
  const [etcQty, setEtcQty] = useState('1');
  const [etcChannel, setEtcChannel] = useState<SalesDraftEtcLine['channel']>('hall');
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseMemo, setExpenseMemo] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const finalizeKey = useRef<string | null>(null);
  const completing = useRef(false);
  const openedDate = useRef<string | null>(null);
  const busy = recoverFinalize.isPending || saveDraft.isPending || finalize.isPending || discard.isPending;
  const inventoryLocked = draft?.status === 'pending_inventory_resolution';

  const recoverThenOpen = useCallback(() => {
    recoverFinalize.mutate(date, {
      onSuccess: recovered => {
        if (recovered.resolved === 'recorded') { router.replace(`/sales/day?date=${date}` as Href); return; }
        openDraft.mutate(date, { onSuccess: value => { setDraftId(value.id); setDraft(value); } });
      },
      onError: error => setToast(error instanceof Error ? error.message : '이전 작성 완료 결과를 확인하지 못했어요.'),
    });
  }, [date, openDraft.mutate, recoverFinalize.mutate, router]);

  useEffect(() => {
    if (openedDate.current === date) return;
    openedDate.current = date;
    recoverThenOpen();
  }, [date, recoverThenOpen]);

  useEffect(() => {
    if (remote.data && !dirty) setDraft(remote.data);
  }, [remote.data, dirty]);

  const orderedItems = useMemo(() => [...(draft?.items ?? [])].sort((a, b) => {
    const qa = a.qtyHall + a.qtyDelivery + a.qtyTakeout;
    const qb = b.qtyHall + b.qtyDelivery + b.qtyTakeout;
    return qb - qa || a.menuName.localeCompare(b.menuName, 'ko');
  }), [draft?.items]);

  const change = (fn: (current: SalesDraft) => SalesDraft) => {
    if (inventoryLocked || busy) return;
    setDraft(current => current ? fn(current) : current);
    finalizeKey.current = null;
    setDirty(true);
  };
  const openQty = (line: SalesDraftMenuLine) => {
    if (inventoryLocked || busy) return;
    setSelected(line);
    setQty({ qtyHall: line.qtyHall, qtyDelivery: line.qtyDelivery, qtyTakeout: line.qtyTakeout, qtyWaste: line.qtyWaste });
  };
  const applyQty = () => {
    if (!selected || busy) return;
    change(current => ({ ...current, items: current.items.map(x => x.id === selected.id ? { ...x, ...qty, deleted: false } : x) }));
    setSelected(null);
  };
  const save = async () => {
    if (!draft || !dirty || busy) return draft;
    try {
      const saved = await saveDraft.mutateAsync(draft);
      setDraft(saved); setDirty(false); setToast('임시저장했어요.');
      return saved;
    } catch (e) { setToast(e instanceof Error ? e.message : '임시저장하지 못했어요.'); return null; }
  };
  const complete = async () => {
    if (!draft || busy || completing.current) return;
    completing.current = true;
    try {
      const target = dirty ? await save() : draft;
      if (!target) return;
      const requestKey = finalizeKey.current ?? createSalesRequestKey();
      finalizeKey.current = requestKey;
      const result = await finalize.mutateAsync({ draft: target, requestKey });
      const status = (result as Record<string, unknown>).status;
      if (status === 'pending_inventory_resolution') {
        setDraft({ ...target, status: 'pending_inventory_resolution' });
        setDirty(false);
        setToast('과거 재고와 겹치는 수정이에요. 재고 실사 후 완료할 수 있어요.');
        return;
      }
      if (status === 'not_recorded') {
        setToast('이전 완료 요청은 서버에 기록되지 않았어요. 다시 눌러 완료해 주세요.');
        finalizeKey.current = null;
        return;
      }
      finalizeKey.current = null;
      router.replace(`/sales/day?date=${date}` as Href);
    } catch (e) { setToast(e instanceof Error ? e.message : '작성 완료하지 못했어요.'); }
    finally { completing.current = false; }
  };
  const removeDraft = async () => {
    if (!draft || busy) return;
    try { await discard.mutateAsync(draft); router.replace('/sales' as Href); }
    catch (e) { setToast(e instanceof Error ? e.message : '초안을 삭제하지 못했어요.'); }
  };

  const addEtc = () => {
    if (busy || inventoryLocked) return;
    const price = Number(etcPrice.replace(/[^0-9.]/g, ''));
    const count = Number(etcQty.replace(/[^0-9.]/g, '')) || 1;
    if (!etcName.trim() || !Number.isFinite(price) || price <= 0 || count <= 0) { setToast('항목명·판매가·수량을 확인해 주세요.'); return; }
    const line: SalesDraftEtcLine = { id: globalId(), name: etcName.trim(), price, qty: count, channel: etcChannel, deleted: false };
    change(current => ({ ...current, etcItems: [...current.etcItems, line] }));
    setEtcName(''); setEtcPrice(''); setEtcQty('1'); setEtcOpen(false);
  };
  const addExpense = () => {
    if (busy || inventoryLocked) return;
    const amount = Number(expenseAmount.replace(/[^0-9.]/g, ''));
    if (!expenseName.trim() || !Number.isFinite(amount) || amount <= 0) { setToast('항목명과 금액을 확인해 주세요.'); return; }
    const line: SalesDraftExpenseLine = { id: globalId(), name: expenseName.trim(), amount, memo: expenseMemo.trim() || undefined, deleted: false };
    change(current => ({ ...current, extraItems: [...current.extraItems, line] }));
    setExpenseName(''); setExpenseAmount(''); setExpenseMemo(''); setExpenseOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={`${dayLabel(date, today)} 매출 작성`} onBack={() => safeBack('/sales' as Href)}
        right={draft ? <Button kind="ghost" disabled={busy} onPress={() => void removeDraft()}>초안 삭제</Button> : undefined} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: LAYOUT.scroll.start, paddingBottom: 92 + insets.bottom, gap: space.md }}>
        <QueryState isLoading={recoverFinalize.isPending || openDraft.isPending || (Boolean(draftId) && remote.isLoading)} error={recoverFinalize.error ?? openDraft.error ?? remote.error} isEmpty={false}
          onRetry={recoverThenOpen} emptyTitle="">
          {draft ? (
            <>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: COLOR.text.tertiary }}>작성 상태</Text>
                    <Text style={{ marginTop: 4, fontSize: 16, fontWeight: '800', color: T.ink }}>{draft.kind === 'amendment' ? '작성 완료 내역 수정' : '새 매출 작성'}</Text>
                  </View>
                  <Badge tone={inventoryLocked ? 'neutral' : 'blue'}>{inventoryLocked ? '재고 확인 필요' : '작성 중'}</Badge>
                </View>
              </Card>
              {inventoryLocked ? (
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                    <Icon name="info" size={18} color={COLOR.status.caution} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: '800', color: T.ink }}>재고 실사 후 작성을 완료할 수 있어요.</Text>
                      <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, fontWeight: '600', color: COLOR.text.secondary }}>
                        실사와 겹친 판매 수량을 다시 차감하지 않도록 현재 입력을 잠갔어요.
                      </Text>
                    </View>
                  </View>
                </Card>
              ) : null}
              <Card pad={0} style={{ overflow: 'hidden' }}>
                {orderedItems.map((line, index) => {
                  const total = line.qtyHall + line.qtyDelivery + line.qtyTakeout;
                  return (
                    <Pressable key={line.id} disabled={inventoryLocked || busy} onPress={() => openQty(line)} accessibilityRole="button"
                      accessibilityLabel={`${line.menuName} 판매 수량 ${total}개`}
                      style={{ minHeight: 72, paddingHorizontal: space.md, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: index < orderedItems.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{line.menuName}</Text>
                        <Text style={[{ marginTop: space.xs, fontSize: 13, lineHeight: 19, fontWeight: '600', color: COLOR.text.tertiary }, NUM]}>
                          총 {total}개 · 매장 {line.qtyHall}개 · 배달 {line.qtyDelivery}개 · 포장 {line.qtyTakeout}개 · 폐기 {line.qtyWaste}개
                        </Text>
                      </View>
                      <View style={{ width: 32, height: 32, borderRadius: 16, flexShrink: 0,
                        alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.action.primaryTint }}>
                        <Icon name="plus" size={20} color={COLOR.action.onTint} sw={2.2} />
                      </View>
                    </Pressable>
                  );
                })}
              </Card>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button kind="ghost" style={{ flex: 1 }} disabled={inventoryLocked || busy} onPress={() => setEtcOpen(true)}>기타 매출 {draft.etcItems.filter(x => !x.deleted).length}</Button>
                <Button kind="ghost" style={{ flex: 1 }} disabled={inventoryLocked || busy} onPress={() => setExpenseOpen(true)}>지출 추가 {draft.extraItems.filter(x => !x.deleted).length}</Button>
              </View>
            </>
          ) : null}
        </QueryState>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: space.sm, paddingHorizontal: 16, paddingTop: space.sm, paddingBottom: 10 + insets.bottom, borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.bg }}>
        {inventoryLocked ? (
          <>
            <Button kind="gray" size="lg" style={{ flex: 1 }} disabled={!draft || busy}
              onPress={() => router.push(`/sales/inventory-count?date=${date}` as Href)}>재고 실사하기</Button>
            <Button kind="primary" size="lg" style={{ flex: 1 }} disabled={!draft || busy}
              loading={finalize.isPending} onPress={() => void complete()}>실사 후 작성 완료</Button>
          </>
        ) : (
          <>
            <Button kind="gray" size="lg" style={{ flex: 1 }} disabled={!draft || !dirty || busy} loading={saveDraft.isPending} onPress={() => void save()}>임시저장</Button>
            <Button kind="primary" size="lg" style={{ flex: 1 }} disabled={!draft || busy} loading={finalize.isPending} onPress={() => void complete()}>작성 완료</Button>
          </>
        )}
      </View>

      <Sheet visible={selected != null} title="판매 수량" sub={selected?.menuName} onClose={() => setSelected(null)}>
        {selected ? <View style={{ gap: space.md }}>
          <Card pad={0} style={{ overflow: 'hidden' }}>
            {CHANNEL_LABEL.map(([code, name], index) => {
              const key = code === 'hall' ? 'qtyHall' : code === 'delivery' ? 'qtyDelivery' : 'qtyTakeout';
              return <View key={code} style={{ flexDirection: 'row', alignItems: 'center', padding: space.md, borderBottomWidth: index < CHANNEL_LABEL.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>{name}</Text>
                <SaleStepper label={`${name} 판매량`} value={qty[key]} onChange={value => setQty(current => ({ ...current, [key]: value }))} />
              </View>;
            })}
          </Card>
          <Card><View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>조리 후 폐기</Text><Text style={{ marginTop: 3, color: COLOR.text.tertiary }}>재료는 나가고 매출은 0</Text></View><SaleStepper label="조리 후 폐기" value={qty.qtyWaste} onChange={value => setQty(current => ({ ...current, qtyWaste: value }))} /></View></Card>
          <Button kind="primary" size="lg" full onPress={applyQty}>확인</Button>
        </View> : null}
      </Sheet>

      <Sheet visible={etcOpen} title="기타 매출" sub="메뉴에 등록하지 않은 매출" onClose={() => setEtcOpen(false)}>
        {draft?.etcItems.filter(x => !x.deleted).map(line => <ExistingLine key={line.id} title={line.name} sub={`${channelName(line.channel)} · ${line.qty}개`} amount={line.price * line.qty} onDelete={() => change(current => ({ ...current, etcItems: current.etcItems.map(x => x.id === line.id ? { ...x, deleted: true } : x) }))} />)}
        <Field variant="stacked" label="항목명" req><Input variant="stacked" value={etcName} onChangeText={setEtcName} placeholder="예: 음료" /></Field>
        <Field variant="stacked" label="판매가" req><Input variant="stacked" value={etcPrice} onChangeText={setEtcPrice} keyboardType="number-pad" suffix="원" /></Field>
        <Field variant="stacked" label="수량"><Input variant="stacked" value={etcQty} onChangeText={setEtcQty} keyboardType="number-pad" suffix="개" /></Field>
        <Field variant="stacked" label="판매 채널" req><View style={{ flexDirection: 'row', gap: space.sm }}>{CHANNEL_LABEL.map(([code, name]) => <Button key={code} kind={etcChannel === code ? 'primary' : 'gray'} style={{ flex: 1 }} onPress={() => setEtcChannel(code)}>{name}</Button>)}</View></Field>
        <ResultField label="추가 매출" value={etcPrice ? `${won(Number(etcPrice) * (Number(etcQty) || 1))}원` : '—'} />
        <Button kind="primary" size="lg" full onPress={addEtc}>추가</Button>
      </Sheet>

      <Sheet visible={expenseOpen} title="지출 추가" onClose={() => setExpenseOpen(false)}>
        {draft?.extraItems.filter(x => !x.deleted).map(line => <ExistingLine key={line.id} title={line.name} sub={line.memo} amount={line.amount} onDelete={() => change(current => ({ ...current, extraItems: current.extraItems.map(x => x.id === line.id ? { ...x, deleted: true } : x) }))} />)}
        <Field variant="stacked" label="항목명" req><Input variant="stacked" value={expenseName} onChangeText={setExpenseName} placeholder="예: 얼음·소모품" /></Field>
        <Field variant="stacked" label="금액" req><Input variant="stacked" value={expenseAmount} onChangeText={setExpenseAmount} keyboardType="number-pad" suffix="원" /></Field>
        <Field variant="stacked" label="메모 (선택)"><Input variant="stacked" value={expenseMemo} onChangeText={setExpenseMemo} placeholder="간단 메모" /></Field>
        <Button kind="primary" size="lg" full onPress={addExpense}>추가</Button>
      </Sheet>

      {toast ? <Pressable onPress={() => setToast(null)} accessibilityRole="button" accessibilityLabel="알림 닫기" style={{ position: 'absolute', left: 16, right: 16, bottom: 86 + insets.bottom, padding: space.md, borderRadius: 12, backgroundColor: 'rgba(25,31,40,0.92)' }}><Text style={{ color: '#fff', fontWeight: '700' }}>{toast}</Text></Pressable> : null}
    </View>
  );
}

function ExistingLine({ title, sub, amount, onDelete }: { title: string; sub?: string; amount: number; onDelete: () => void }) {
  return <View style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: T.line2, marginBottom: space.sm }}><View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontWeight: '700', color: T.ink }}>{title}</Text>{sub ? <Text style={{ marginTop: 2, fontSize: 13, color: COLOR.text.tertiary }}>{sub}</Text> : null}</View><Text style={[{ marginRight: space.md, fontWeight: '800', color: T.ink }, NUM]}>{won(amount)}원</Text><Pressable onPress={onDelete} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${title} 삭제`}><Icon name="close" size={18} color={COLOR.text.tertiary} /></Pressable></View>;
}

function globalId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const v = Math.floor(Math.random() * 16); return (c === 'x' ? v : (v & 3) | 8).toString(16);
  });
}
