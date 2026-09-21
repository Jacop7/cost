import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader, Badge, Button, Card, ConfirmDialog, Field, Icon, Input, QueryState, Sheet } from '@/components/kit';
import { HeaderOverflowAction } from '@/components/kit/HeaderOverflowAction';
import { ResultField } from '@/components/kit/ResultField';
import { SaleStepper } from '../components/SaleStepper';
import { ProfitBreakdownCard } from '../components/ProfitBlocks';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { useSalesBusinessDate } from '@/features/business-day/businessDay';
import { useSettingsLists } from '@/features/master-data/hooks';
import { useRecipeList } from '@/features/recipes/hooks';
import { dayLabel } from '@/lib/date';
import { safeBack } from '@/lib/nav';
import { COLOR, COMPONENT, LAYOUT, TYPE, T, radius, space, won } from '@/theme/tokens';
import {
  createSalesRequestKey, useCloseSalesDraftAsHoliday, useDiscardSalesDraft, useFinalizeSalesDraft, useOpenSalesDraft, useRecoverSalesFinalize, useSalesDraft, useSalesFeed, useSaveSalesDraft, useSetSalesCalendarDay,
  type SalesDraft, type SalesDraftEtcLine, type SalesDraftExpenseLine, type SalesDraftMenuLine,
} from '../lifecycle';

const NUM = { fontVariant: ['tabular-nums' as const] };
type Qty = { channels: Record<string, number>; qtyWaste: number };
type EtcChannelQty = Record<string, number>;
type PendingDelete = { kind: 'etc' | 'expense'; id: string };
const soldQty = (line: SalesDraftMenuLine) => (line.channels?.length ?? 0) > 0
  ? (line.channels ?? []).reduce((sum, channel) => sum + channel.quantity, 0)
  : line.qtyHall + line.qtyDelivery + line.qtyTakeout;
const ALL_MENU_CATEGORIES = '전체';
const rateText = (rate: number) => `${Math.round(rate * 1000) / 10}%`;

export default function SalesDraftWriteScreen() {
  const source = useSalesBusinessDate();
  const params = useLocalSearchParams<{ date?: string; initialize?: string; start?: string }>();
  return (
    <BusinessDateGate source={source} title="매출 작성">
      {today => <SalesDraftWriteBody today={today} date={params.date ?? today}
        initialize={params.initialize === '1'} startRequested={params.start === '1'} />}
    </BusinessDateGate>
  );
}

function SalesDraftWriteBody({ today, date, initialize, startRequested }: {
  today: string; date: string; initialize: boolean; startRequested: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const openDraft = useOpenSalesDraft();
  const recoverFinalize = useRecoverSalesFinalize();
  const [draftId, setDraftId] = useState<string | null>(null);
  const remote = useSalesDraft(draftId);
  const recipes = useRecipeList();
  const settingsLists = useSettingsLists();
  const saveDraft = useSaveSalesDraft();
  const finalize = useFinalizeSalesDraft();
  const discard = useDiscardSalesDraft();
  const lifecycle = useSalesFeed(date, date);
  const calendarDay = useSetSalesCalendarDay();
  const closeDraftAsHoliday = useCloseSalesDraftAsHoliday();
  const [draft, setDraft] = useState<SalesDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<SalesDraftMenuLine | null>(null);
  const [qty, setQty] = useState<Qty>({ channels: {}, qtyWaste: 0 });
  const [etcOpen, setEtcOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [etcTab, setEtcTab] = useState(0);
  const [expenseTab, setExpenseTab] = useState(0);
  const [etcName, setEtcName] = useState('');
  const [etcPrice, setEtcPrice] = useState('');
  const [etcChannelQty, setEtcChannelQty] = useState<EtcChannelQty>({});
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseMemo, setExpenseMemo] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [menuCategory, setMenuCategory] = useState(ALL_MENU_CATEGORIES);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [holidayConfirm, setHolidayConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const finalizeKey = useRef<string | null>(null);
  const completing = useRef(false);
  const openedDate = useRef<string | null>(null);
  const initializationApplied = useRef(false);
  const busy = recoverFinalize.isPending || saveDraft.isPending || finalize.isPending
    || discard.isPending || calendarDay.isPending || closeDraftAsHoliday.isPending;
  const inventoryLocked = draft?.status === 'pending_inventory_resolution';
  const entry = lifecycle.data?.items.find(item => item.businessDate === date);
  const entryStatus = draft?.kind === 'amendment' ? 'completed' : entry
    ? (entry.draftId != null && entry.action === 'resume' ? 'editing' : entry.status)
    : draft ? 'editing' : 'missing';
  const canOpenDraft = Boolean(entry?.canEdit && entry.status !== 'closed'
    && (startRequested || entry.draftId != null || entry.status === 'completed'));

  const recoverThenOpen = useCallback(() => {
    if (!lifecycle.data) return;
    if (!canOpenDraft) {
      router.replace(`/sales/day?date=${date}` as Href);
      return;
    }
    recoverFinalize.mutate(date, {
      onSuccess: recovered => {
        if (recovered.resolved === 'recorded') { router.replace(`/sales/day?date=${date}` as Href); return; }
        openDraft.mutate(date, { onSuccess: value => { setDraftId(value.id); setDraft(value); } });
      },
      onError: error => setToast(error instanceof Error ? error.message : '이전 작성 완료 결과를 확인하지 못했어요.'),
    });
  }, [canOpenDraft, date, lifecycle.data, openDraft.mutate, recoverFinalize.mutate, router]);

  useEffect(() => {
    if (lifecycle.isLoading || !lifecycle.data) return;
    const openKey = `${date}:${startRequested ? 'start' : 'resume'}`;
    if (openedDate.current === openKey) return;
    openedDate.current = openKey;
    recoverThenOpen();
  }, [date, lifecycle.data, lifecycle.isLoading, recoverThenOpen, startRequested]);

  useEffect(() => {
    if (remote.data && !dirty) setDraft(remote.data);
  }, [remote.data, dirty]);

  const orderedItems = useMemo(() => [...(draft?.items ?? [])].sort((a, b) => {
    const qa = soldQty(a);
    const qb = soldQty(b);
    return qb - qa || a.menuName.localeCompare(b.menuName, 'ko');
  }), [draft?.items]);
  const recipeCategoryById = useMemo(() => new Map(
    (recipes.data ?? []).map(recipe => [recipe.id, recipe.categoryName]),
  ), [recipes.data]);
  const recipeById = useMemo(() => new Map(
    (recipes.data ?? []).map(recipe => [recipe.id, recipe]),
  ), [recipes.data]);
  const presentMenuCategories = useMemo(() => {
    if (!recipes.data) return [];
    const names = new Set(orderedItems.map(item => recipeCategoryById.get(item.recipeId)).filter((name): name is string => Boolean(name)));
    const configured = (settingsLists.data?.recipeCategories ?? []).map(category => category.name).filter(name => names.delete(name));
    return [...configured, ...names];
  }, [orderedItems, recipeCategoryById, recipes.data, settingsLists.data?.recipeCategories]);
  const menuCategories = useMemo(() => [ALL_MENU_CATEGORIES, ...presentMenuCategories], [presentMenuCategories]);
  const visibleItems = useMemo(() => menuCategory === ALL_MENU_CATEGORIES
    ? orderedItems
    : orderedItems.filter(item => recipeCategoryById.get(item.recipeId) === menuCategory),
  [menuCategory, orderedItems, recipeCategoryById]);

  useEffect(() => {
    if (!menuCategories.includes(menuCategory)) setMenuCategory(ALL_MENU_CATEGORIES);
  }, [menuCategories, menuCategory]);
  const etcSummary = useMemo(() => (draft?.etcItems ?? []).filter(x => !x.deleted).reduce(
    (summary, line) => ({ amount: summary.amount + line.price * line.qty, qty: summary.qty + line.qty }),
    { amount: 0, qty: 0 },
  ), [draft?.etcItems]);
  const expenseTotal = useMemo(() => (draft?.extraItems ?? []).filter(x => !x.deleted)
    .reduce((sum, line) => sum + line.amount, 0), [draft?.extraItems]);

  const change = (fn: (current: SalesDraft) => SalesDraft) => {
    if (inventoryLocked || busy) return;
    setDraft(current => current ? fn(current) : current);
    finalizeKey.current = null;
    setDirty(true);
  };
  const openQty = (line: SalesDraftMenuLine) => {
    if (inventoryLocked || busy) return;
    setSelected(line);
    setQty({
      channels: Object.fromEntries(((line.channels?.length ?? 0) > 0 ? line.channels ?? [] : (draft?.channels ?? []).map(channel => ({
        ...channel,
        quantity: channel.code === 'hall' ? line.qtyHall : channel.code === 'delivery' ? line.qtyDelivery : channel.code === 'takeout' ? line.qtyTakeout : 0,
      }))).map(channel => [channel.id, channel.quantity])),
      qtyWaste: line.qtyWaste,
    });
  };
  const applyQty = () => {
    if (!selected || busy) return;
    change(current => ({ ...current, items: current.items.map(line => {
      if (line.id !== selected.id) return line;
      const channels = (current.channels ?? []).map(channel => ({ ...channel, quantity: qty.channels[channel.id] ?? 0 }));
      return {
        ...line,
        channels,
        qtyHall: channels.find(channel => channel.code === 'hall')?.quantity ?? 0,
        qtyDelivery: channels.find(channel => channel.code === 'delivery')?.quantity ?? 0,
        qtyTakeout: channels.find(channel => channel.code === 'takeout')?.quantity ?? 0,
        qtyWaste: qty.qtyWaste,
        deleted: false,
      };
    }) }));
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
  const openPreview = async () => {
    if (!draft || busy) return;
    const authoritative = dirty ? await save() : draft;
    if (authoritative) setPreviewOpen(true);
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
  const resetDraft = async () => {
    if (!draft || busy) return;
    try {
      if (draft.kind === 'amendment') {
        const cleared = await saveDraft.mutateAsync({
          ...draft,
          items: draft.items.map(line => ({ ...line, qtyHall: 0, qtyDelivery: 0, qtyTakeout: 0, qtyWaste: 0,
            channels: (line.channels ?? []).map(channel => ({ ...channel, quantity: 0 })) })),
          etcItems: draft.etcItems.map(line => ({ ...line, deleted: true })),
          extraItems: draft.extraItems.map(line => ({ ...line, deleted: true })),
        });
        setDraft(cleared); setDirty(false); setSelected(null);
        setEtcName(''); setEtcPrice(''); setEtcChannelQty({});
        setExpenseName(''); setExpenseAmount(''); setExpenseMemo('');
        finalizeKey.current = null;
        return;
      }
      await discard.mutateAsync(draft);
      setDraftId(null); setDraft(null); setDirty(false); setSelected(null);
      setEtcName(''); setEtcPrice(''); setEtcChannelQty({});
      setExpenseName(''); setExpenseAmount(''); setExpenseMemo('');
      finalizeKey.current = null;
      setResetComplete(true);
    } catch (e) { setToast(e instanceof Error ? e.message : '매출 작성을 초기화하지 못했어요.'); }
  };

  useEffect(() => {
    if (!initialize || initializationApplied.current || !draft || busy) return;
    initializationApplied.current = true;
    void resetDraft();
  }, [busy, draft, initialize]);

  const markHoliday = async () => {
    if (!entry || !draft || busy || entryStatus === 'completed') return;
    try {
      await closeDraftAsHoliday.mutateAsync({ draft, item: entry });
      setHolidayConfirm(false);
      router.replace('/sales' as Href);
    } catch (e) { setToast(e instanceof Error ? e.message : '휴무 처리하지 못했어요.'); }
  };

  const overflowItems = [
    ...(entryStatus === 'completed' ? [{ label: '수정', disabled: false, onPress: () => setToast('현재 화면에서 매출 내역을 수정할 수 있어요.') }] : []),
    ...(entryStatus !== 'missing' ? [{ label: '초기화', disabled: !draft || busy, onPress: () => setResetConfirm(true) }] : []),
    { label: '휴무 처리', disabled: !entry || !draft || entryStatus === 'completed' || busy, onPress: () => setHolidayConfirm(true) },
  ];

  const addEtc = () => {
    if (busy || inventoryLocked) return;
    const price = Number(etcPrice.replace(/[^0-9.]/g, ''));
    const lines = (draft?.channels ?? []).flatMap(channel => {
      const count = etcChannelQty[channel.id] ?? 0;
      return count > 0 ? [{ id: globalId(), name: etcName.trim(), price, qty: count,
        salesChannelId: channel.id, channel: channel.code, channelName: channel.name, deleted: false }] : [];
    });
    if (!etcName.trim() || !Number.isFinite(price) || price <= 0 || lines.length === 0) {
      setToast('항목명·판매가·채널별 수량을 확인해 주세요.'); return;
    }
    change(current => ({ ...current, etcItems: [...current.etcItems, ...lines] }));
    setEtcName(''); setEtcPrice(''); setEtcChannelQty({});
    setEtcTab(1);
  };
  const addExpense = () => {
    if (busy || inventoryLocked) return;
    const amount = Number(expenseAmount.replace(/[^0-9.]/g, ''));
    if (!expenseName.trim() || !Number.isFinite(amount) || amount <= 0) { setToast('항목명과 금액을 확인해 주세요.'); return; }
    const line: SalesDraftExpenseLine = { id: globalId(), name: expenseName.trim(), amount, memo: expenseMemo.trim() || undefined, deleted: false };
    change(current => ({ ...current, extraItems: [...current.extraItems, line] }));
    setExpenseName(''); setExpenseAmount(''); setExpenseMemo(''); setExpenseTab(1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="매출 작성" onBack={() => safeBack('/sales' as Href)}
        right={<HeaderOverflowAction label="매출 작성 메뉴 열기" items={overflowItems} />} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: LAYOUT.scroll.start, paddingBottom: 92 + insets.bottom, gap: space.md }}>
        <QueryState isLoading={lifecycle.isLoading || recoverFinalize.isPending || openDraft.isPending || (Boolean(draftId) && remote.isLoading)} error={lifecycle.error ?? recoverFinalize.error ?? openDraft.error ?? remote.error} isEmpty={false}
          onRetry={recoverThenOpen} emptyTitle="">
          {draft ? (
            <>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Badge tone={inventoryLocked ? 'neutral' : 'blue'}>{inventoryLocked ? '재고 확인 필요' : '작성 중'}</Badge>
                    <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{dayLabel(date, today)}</Text>
                  </View>
                  <Button kind="primary" size="sm" presentation="status" accessibilityLabel="매출 미리보기"
                    onPress={() => void openPreview()}>미리보기</Button>
                </View>
                <View testID="sales-draft-summary" style={{ marginTop: space.md, paddingTop: space.md,
                  borderTopWidth: 1, borderTopColor: T.line2, flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, lineHeight: 19, fontWeight: '700', color: COLOR.text.tertiary }}>매출</Text>
                    <Text style={[{ marginTop: 2, ...TYPE.header, fontWeight: '800', color: T.ink }, NUM]}>
                      {won(draft.summary.revenue)}원
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-start' }}>
                    <Text style={{ fontSize: 13, lineHeight: 19, fontWeight: '700', color: COLOR.text.tertiary }}>순이익</Text>
                    <Text style={[{ marginTop: 2, ...TYPE.header, fontWeight: '800', color: draft.summary.profit === null ? COLOR.text.tertiary : COLOR.text.accent }, NUM]}>
                      {draft.summary.profit === null || draft.summary.profitRate === null
                        ? '미산출'
                        : `${won(draft.summary.profit)}원 · ${rateText(draft.summary.profitRate)}`}
                    </Text>
                  </View>
                </View>
              </Card>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                accessibilityRole="tablist" accessibilityLabel="메뉴 카테고리"
                style={{ minWidth: 44, minHeight: 44, marginHorizontal: -16 }}
                contentContainerStyle={{ gap: space.sm, paddingHorizontal: 16,
                  paddingVertical: COMPONENT.filterChip.hitSlop }}>
                {menuCategories.map(category => {
                  const active = category === menuCategory;
                  return (
                    <Pressable key={category} onPress={() => setMenuCategory(category)}
                      accessibilityRole="tab" accessibilityLabel={category}
                      accessibilityState={{ selected: active }} aria-selected={active}
                      hitSlop={{ top: COMPONENT.filterChip.hitSlop, bottom: COMPONENT.filterChip.hitSlop, left: 0, right: 0 }}
                      style={{ minWidth: 44, minHeight: COMPONENT.filterChip.minHeight, flexDirection: 'row', alignItems: 'center',
                        paddingVertical: COMPONENT.filterChip.paddingVertical, paddingHorizontal: space.md,
                        borderWidth: 1, borderColor: active ? T.ink : T.line,
                        borderRadius: COMPONENT.filterChip.borderRadius,
                        backgroundColor: active ? T.ink : T.surface }}>
                      <Text style={{ ...COMPONENT.filterChip.label, fontWeight: active ? '800' : '700',
                        color: active ? T.onColor : T.ink }}>
                        {category}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
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
                {visibleItems.map((line, index) => {
                  const total = soldQty(line);
                  const materialShortage = recipeById.get(line.recipeId)?.blockedBy != null;
                  return (
                    <Pressable key={line.id} disabled={inventoryLocked || busy} onPress={() => openQty(line)} accessibilityRole="button"
                      accessibilityLabel={`${materialShortage ? '재료 부족 ' : ''}${line.menuName} 판매 수량 ${total}개`}
                      style={{ minWidth: 44, minHeight: 72, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: index < visibleItems.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
                          {materialShortage ? <Badge tone="red" sm solid>재료 부족</Badge> : null}
                          <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{line.menuName}</Text>
                        </View>
                        <Text style={[{ marginTop: space.xs, fontSize: 13, lineHeight: 19, fontWeight: '600', color: COLOR.text.tertiary }, NUM]}>
                          {won(line.price * total)}원 · {total}개
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
              <Card pad={0} style={{ overflow: 'hidden' }}>
                <View style={{ minHeight: 52, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center',
                  borderBottomWidth: 1, borderBottomColor: T.line2, backgroundColor: T.surface2 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>기타 매출·지출</Text>
                </View>
                <Pressable disabled={inventoryLocked || busy} onPress={() => { setEtcTab(0); setEtcOpen(true); }} accessibilityRole="button"
                  accessibilityLabel="기타 매출 추가"
                   style={{ minWidth: 44, minHeight: 72, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>기타 매출</Text>
                    <Text style={{ marginTop: space.xs, fontSize: 13, lineHeight: 19, fontWeight: '600', color: COLOR.text.tertiary }}>
                      {won(etcSummary.amount)}원 · {etcSummary.qty}개
                    </Text>
                  </View>
                  <View style={{ width: 32, height: 32, borderRadius: 16, flexShrink: 0,
                    alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.action.primaryTint }}>
                    <Icon name="plus" size={20} color={COLOR.action.onTint} sw={2.2} />
                  </View>
                </Pressable>
                <Pressable disabled={inventoryLocked || busy} onPress={() => { setExpenseTab(0); setExpenseOpen(true); }} accessibilityRole="button"
                  accessibilityLabel="지출 추가"
                   style={{ minWidth: 44, minHeight: 72, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>추가 지출</Text>
                    <Text style={{ marginTop: space.xs, fontSize: 13, lineHeight: 19, fontWeight: '600', color: COLOR.text.tertiary }}>
                      {won(expenseTotal)}원
                    </Text>
                  </View>
                  <View style={{ width: 32, height: 32, borderRadius: 16, flexShrink: 0,
                    alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.action.primaryTint }}>
                    <Icon name="plus" size={20} color={COLOR.action.onTint} sw={2.2} />
                  </View>
                </Pressable>
              </Card>
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

      <Sheet visible={previewOpen} title="손익 계산" onClose={() => setPreviewOpen(false)}>
        {draft ? <View style={{ gap: space.md }}>
          <ProfitBreakdownCard
            summary={draft.summary}
            qtyLabel={`${draft.summary.qty}개`}
            from={date}
            to={date}
            profitFirst
            blackAmounts
          />
          <Button kind="primary" size="lg" full onPress={() => setPreviewOpen(false)}>확인</Button>
        </View> : null}
      </Sheet>

      <Sheet visible={selected != null} title="판매 수량" onClose={() => setSelected(null)}>
        {selected ? <View style={{ gap: space.md }}>
          <Card pad={0} style={{ overflow: 'hidden', borderWidth: 1, borderColor: T.line }}>
            <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: 'row',
              alignItems: 'center', gap: space.md, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line }}>
              <Text style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22, fontWeight: '800', color: T.ink }}>
                {selected.menuName}
              </Text>
              <Text style={[{ fontSize: 15, lineHeight: 22, fontWeight: '800', color: T.ink }, NUM]}>
                {won(selected.price)}원
              </Text>
            </View>
            {(draft?.channels ?? []).map(channel => {
              return <View key={channel.id} style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg,
                borderBottomWidth: 1, borderBottomColor: T.line }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>{channel.name}</Text>
                <SaleStepper label={`${channel.name} 판매량`} value={qty.channels[channel.id] ?? 0}
                  onChange={value => setQty(current => ({ ...current, channels: { ...current.channels, [channel.id]: value } }))} />
              </View>;
            })}
            <View style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg,
              borderBottomWidth: 1, borderBottomColor: T.line }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>조리 후 폐기</Text>
              <SaleStepper label="조리 후 폐기" value={qty.qtyWaste} onChange={value => setQty(current => ({ ...current, qtyWaste: value }))} />
            </View>
            <View style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, backgroundColor: T.surface2 }}>
              <Text style={[{ flex: 1, fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>
                총 {won(selected.price * Object.values(qty.channels).reduce((sum, value) => sum + value, 0))}원
              </Text>
              <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>
                판매 {Object.values(qty.channels).reduce((sum, value) => sum + value, 0)} · 폐기 {qty.qtyWaste}
              </Text>
            </View>
          </Card>
          <Button kind="primary" size="lg" full onPress={applyQty}>확인</Button>
        </View> : null}
      </Sheet>

      <Sheet visible={etcOpen} title="기타 매출" onClose={() => setEtcOpen(false)}>
        <View style={{ gap: space.md }}>
          <SalesEntryTabs labels={['작성하기', '매출내역']} active={etcTab} onChange={setEtcTab} />
          {etcTab === 0 ? <>
            <Field variant="stacked" label="항목명" req><Input variant="stacked" value={etcName} onChangeText={setEtcName} placeholder="예: 음료" /></Field>
            <Field variant="stacked" label="판매가" req><Input variant="stacked" value={etcPrice} onChangeText={setEtcPrice} keyboardType="number-pad" suffix="원" /></Field>
            <Field variant="stacked" label="판매 채널" req>
              <Card pad={0} style={{ overflow: 'hidden', borderWidth: 1, borderColor: T.line }}>
                {(draft?.channels ?? []).map((channel, index) => <View key={channel.id} style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg,
                  borderBottomWidth: index < (draft?.channels?.length ?? 0) - 1 ? 1 : 0, borderBottomColor: T.line }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>{channel.name}</Text>
                  <SaleStepper label={`${channel.name} 기타 매출 수량`} value={etcChannelQty[channel.id] ?? 0}
                    onChange={value => setEtcChannelQty(current => ({ ...current, [channel.id]: value }))} />
                </View>)}
              </Card>
            </Field>
            <ResultField label="추가 매출" value={etcPrice && Object.values(etcChannelQty).some(Boolean)
              ? `${won(Number(etcPrice) * Object.values(etcChannelQty).reduce((sum, value) => sum + value, 0))}원` : '—'} />
            <Button kind="primary" size="lg" full onPress={addEtc}>추가</Button>
          </> : <>
            <EtcHistoryList
              lines={(draft?.etcItems ?? []).filter(x => !x.deleted)}
              onChangeQty={(id, value) => change(current => ({
                ...current,
                etcItems: current.etcItems.map(line => line.id === id ? { ...line, qty: value } : line),
              }))}
              onDelete={id => setPendingDelete({ kind: 'etc', id })}
            />
          </>}
        </View>
      </Sheet>

      <Sheet visible={expenseOpen} title="추가 지출" onClose={() => setExpenseOpen(false)}>
        <View style={{ gap: space.md }}>
          <SalesEntryTabs labels={['작성하기', '지출내역']} active={expenseTab} onChange={setExpenseTab} />
          {expenseTab === 0 ? <>
            <Field variant="stacked" label="항목명" req><Input variant="stacked" value={expenseName} onChangeText={setExpenseName} placeholder="예: 얼음·소모품" /></Field>
            <Field variant="stacked" label="금액" req><Input variant="stacked" value={expenseAmount} onChangeText={setExpenseAmount} keyboardType="number-pad" suffix="원" /></Field>
            <Field variant="stacked" label="메모 (선택)"><Input variant="stacked" value={expenseMemo} onChangeText={setExpenseMemo} placeholder="간단 메모" /></Field>
            <Button kind="primary" size="lg" full onPress={addExpense}>추가</Button>
          </> : <ExpenseHistoryList
            lines={(draft?.extraItems ?? []).filter(x => !x.deleted)}
            onDelete={id => setPendingDelete({ kind: 'expense', id })}
          />}
        </View>
      </Sheet>

      <ConfirmDialog visible={pendingDelete !== null} title="선택한 메뉴를 삭제하시겠습니까?"
        onCancel={() => setPendingDelete(null)} onConfirm={() => {
          if (!pendingDelete) return;
          change(current => pendingDelete.kind === 'etc'
            ? { ...current, etcItems: current.etcItems.map(line => line.id === pendingDelete.id ? { ...line, deleted: true } : line) }
            : { ...current, extraItems: current.extraItems.map(line => line.id === pendingDelete.id ? { ...line, deleted: true } : line) });
          setPendingDelete(null);
        }} />

      <ConfirmDialog visible={resetConfirm} title="초기화를 진행하시겠습니까?"
        message="작성 중인 모든 매출 데이터가 초기화됩니다."
        kind="primary" confirmText="초기화" cancelText="닫기" loading={discard.isPending}
        closeLabel="매출 작성 초기화 확인 닫기" onCancel={() => setResetConfirm(false)}
        onConfirm={() => { setResetConfirm(false); void resetDraft(); }} />
      <ConfirmDialog visible={resetComplete} title="초기화가 완료되었습니다."
        message="계속해서 매출을 작성하시겠습니까?"
        kind="primary" confirmText="작성하기" cancelText="나중에"
        closeLabel="매출 작성 계속 여부 닫기"
        onCancel={() => { setResetComplete(false); router.replace('/sales' as Href); }}
        onConfirm={() => {
          setResetComplete(false);
          openDraft.mutate(date, { onSuccess: value => { setDraftId(value.id); setDraft(value); } });
        }} />
      <ConfirmDialog visible={holidayConfirm} title="휴무 처리하시겠습니까?"
        message="작성 중인 내용은 초기화되고 이 날짜는 미작성 건수에서 제외됩니다."
        kind="primary" confirmText="휴무 처리" cancelText="취소" loading={closeDraftAsHoliday.isPending}
        closeLabel="휴무 처리 확인 닫기" onCancel={() => setHolidayConfirm(false)}
        onConfirm={() => void markHoliday()} />

      {toast ? <Pressable onPress={() => setToast(null)} accessibilityRole="button" accessibilityLabel="알림 닫기" style={{ position: 'absolute', left: 16, right: 16, bottom: 86 + insets.bottom, minWidth: 44, minHeight: 44, padding: space.md, borderRadius: 12, backgroundColor: 'rgba(25,31,40,0.92)' }}><Text style={{ color: '#fff', fontWeight: '700' }}>{toast}</Text></Pressable> : null}
    </View>
  );
}

function SalesEntryTabs({ labels, active, onChange }: {
  labels: readonly string[];
  active: number;
  onChange: (index: number) => void;
}) {
  return <View style={{ flexDirection: 'row', gap: space.lg, marginHorizontal: -20, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: T.line }}>
    {labels.map((label, index) => {
      const selected = index === active;
      return <Pressable key={label} onPress={() => onChange(index)} accessibilityRole="tab"
        accessibilityLabel={label} accessibilityState={{ selected }} aria-selected={selected}
        style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', position: 'relative', paddingTop: space.xs, paddingBottom: space.sm }}>
        <Text style={{ fontSize: 15, fontWeight: selected ? '800' : '700', color: selected ? T.ink : COLOR.text.tertiary }}>
          {label}
        </Text>
        {selected ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2,
          borderRadius: radius.full, backgroundColor: T.ink }} /> : null}
      </Pressable>;
    })}
  </View>;
}

function EtcHistoryList({ lines, onChangeQty, onDelete }: {
  lines: SalesDraftEtcLine[];
  onChangeQty: (id: string, value: number) => void;
  onDelete: (id: string) => void;
}) {
  const totalQty = lines.reduce((sum, line) => sum + line.qty, 0);
  const totalAmount = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  return <Card pad={0} style={{ overflow: 'hidden', borderWidth: 1, borderColor: T.line }}>
    {lines.map(line => <View key={line.id} style={{ minHeight: 76, paddingHorizontal: space.lg, paddingVertical: space.md,
      flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{line.name}</Text>
        <Text style={[{ marginTop: 4, fontSize: 14, fontWeight: '700', color: COLOR.text.secondary }, NUM]}>{won(line.price * line.qty)}원</Text>
      </View>
      <SaleStepper label={`${line.name} ${line.channelName || '채널 미지정'} 기타 매출 수량`} value={line.qty}
        onChange={value => onChangeQty(line.id, value)} deleteAtOne onDelete={() => onDelete(line.id)} />
    </View>)}
    <HistoryTotalRow amount={totalAmount} label="판매" count={totalQty} />
  </Card>;
}

function ExpenseHistoryList({ lines, onDelete }: {
  lines: SalesDraftExpenseLine[];
  onDelete: (id: string) => void;
}) {
  const totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  return <Card pad={0} style={{ overflow: 'hidden', borderWidth: 1, borderColor: T.line }}>
    {lines.map(line => <View key={line.id} style={{ minHeight: 88, paddingHorizontal: space.lg, paddingVertical: space.md,
      flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{line.name}</Text>
        {line.memo ? <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 13, fontWeight: '600', color: COLOR.text.tertiary }}>
          {line.memo}
        </Text> : null}
        <Text numberOfLines={1} style={[{ marginTop: 4, fontSize: 14, fontWeight: '700', color: COLOR.text.secondary }, NUM]}>
          {won(line.amount)}원
        </Text>
      </View>
      <Pressable onPress={() => onDelete(line.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${line.name} 삭제`}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: T.line, borderRadius: radius.md, backgroundColor: T.surface }}>
        <Icon name="trash" size={18} color={COLOR.text.tertiary} />
      </Pressable>
    </View>)}
    <HistoryTotalRow amount={totalAmount} label="지출" count={lines.length} />
  </Card>;
}

function HistoryTotalRow({ amount, label, count }: { amount: number; label: string; count: number }) {
  return <View style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, backgroundColor: T.surface2 }}>
    <Text style={[{ flex: 1, fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>총 {won(amount)}원</Text>
    <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>{label} {count}</Text>
  </View>;
}

function globalId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const v = Math.floor(Math.random() * 16); return (c === 'x' ? v : (v & 3) | 8).toString(16);
  });
}
