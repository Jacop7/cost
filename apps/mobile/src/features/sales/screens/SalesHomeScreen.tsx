/**
 * SALES-01 매출관리 홈 — 오늘 판매 입력 + 실시간 손익.
 *
 * 여기서 저장하면 서버가 레시피를 재귀로 펼쳐 **식재료 재고까지 차감**한다(E10 → E8).
 * 그래서 저장 버튼은 "매출 기록"이 아니라 "판매 확정"이다. 재고가 모자란 채로 팔렸다면
 * 서버가 부족분을 돌려주고, 화면은 그걸 숨기지 않고 알린다.
 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Field, Icon, Input, QueryState, Sheet, SortChip, SortSheet, type SortOption } from '@/components/kit';
import { T, won } from '@/theme/tokens';
import { useRecipeList, type RecipeRow } from '@/features/recipes/hooks';
import { useSalesDay, useSaveSale, type EtcItem, type ExtraItem, type Shortage } from '../hooks';
import { dayLabel, todayBusiness } from '../period';

const NUM = { fontVariant: ['tabular-nums' as const] };

type SortKey = 'qty' | 'name' | 'profit';
const SORTS: readonly SortOption<SortKey>[] = [
  { key: 'qty', label: '판매량순', hint: '오늘 많이 팔린 메뉴부터' },
  { key: 'profit', label: '순이익순', hint: '개당 순이익이 큰 메뉴부터' },
  { key: 'name', label: '이름순', hint: '가나다순' },
];

/** − N + 스테퍼. 34×34 라 hitSlop 5 를 더해 최소 44×44 를 채운다(가이드 §9.6-1). */
function SaleStepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const Btn = ({ ic, delta, disabled }: { ic: 'minus' | 'plus'; delta: number; disabled?: boolean }) => (
    <Pressable
      onPress={() => onChange(Math.max(0, value + delta))}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${delta > 0 ? '늘리기' : '줄이기'}`}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={5}
      style={{
        width: 34, height: 34, borderRadius: 9,
        backgroundColor: disabled ? T.line2 : delta > 0 ? T.blue : T.line2,
        opacity: disabled ? 0.5 : 1,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Icon name={ic} size={18} color={delta > 0 && !disabled ? T.onColor : T.sub} sw={2.4} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <Btn ic="minus" delta={-1} disabled={value <= 0} />
      <Text style={[{ minWidth: 26, textAlign: 'center', fontSize: 18, fontWeight: '800', color: value ? T.ink : T.ter }, NUM]}>{value}</Text>
      <Btn ic="plus" delta={1} />
    </View>
  );
}

/** 화면 입력용 수량 묶음. 저장 전까지는 서버 값과 별개로 들고 있어야 취소가 가능하다. */
interface Qty { hall: number; delivery: number; takeout: number; waste: number }
const ZERO: Qty = { hall: 0, delivery: 0, takeout: 0, waste: 0 };

export default function SalesHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const today = todayBusiness();

  const day = useSalesDay(today);
  const recipes = useRecipeList();
  const saveSale = useSaveSale();

  const [sel, setSel] = useState<RecipeRow | null>(null);
  const [draft, setDraft] = useState<Qty>(ZERO);
  const [sort, setSort] = useState<SortKey>('qty');
  const [sortOpen, setSortOpen] = useState(false);

  const [etcOpen, setEtcOpen] = useState(false);
  const [etcName, setEtcName] = useState('');
  const [etcPrice, setEtcPrice] = useState('');
  const [etcQty, setEtcQty] = useState('1');

  const [expOpen, setExpOpen] = useState(false);
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expMemo, setExpMemo] = useState('');

  const s = day.data;
  const summary = s?.summary;

  /** 메뉴 id → 오늘 저장된 수량. 시트를 열 때 초깃값이 된다. */
  const soldBy = useMemo(() => {
    const m = new Map<string, Qty>();
    for (const it of s?.items ?? []) {
      if (it.recipeId) m.set(it.recipeId, { hall: it.qtyHall, delivery: it.qtyDelivery, takeout: it.qtyTakeout, waste: it.qtyWaste });
    }
    return m;
  }, [s]);

  const list = useMemo(() => {
    const rows = [...(recipes.data ?? [])];
    switch (sort) {
      case 'name': return rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      case 'profit': return rows.sort((a, b) => b.profit - a.profit);
      default:
        return rows.sort((a, b) => {
          const qa = soldBy.get(a.id);
          const qb = soldBy.get(b.id);
          const ta = qa ? qa.hall + qa.delivery + qa.takeout : 0;
          const tb = qb ? qb.hall + qb.delivery + qb.takeout : 0;
          return tb - ta || a.name.localeCompare(b.name, 'ko');
        });
    }
  }, [recipes.data, sort, soldBy]);

  const openMenu = (r: RecipeRow) => {
    setSel(r);
    setDraft(soldBy.get(r.id) ?? ZERO);
  };

  /** 부족분은 오류가 아니다 — 이미 팔린 것이다. 다만 재고 기록이 틀어졌다는 신호이므로 알린다. */
  const warnShortages = (shortages: Shortage[]) => {
    if (shortages.length === 0) return;
    const lines = shortages.slice(0, 5).map((x) => `· ${x.name} ${Math.round(x.shortage)} 부족`);
    Alert.alert(
      '재고 기록이 실제와 달라요',
      `판매는 그대로 기록했어요. 아래 재료는 기록상 재고보다 많이 나갔습니다.\n\n${lines.join('\n')}${shortages.length > 5 ? `\n외 ${shortages.length - 5}건` : ''}\n\n식재료 탭에서 실제 재고를 맞춰 주세요.`,
      [{ text: '확인' }],
    );
  };

  const saveQty = () => {
    if (!sel) return;
    const items = [...soldBy.entries()]
      .filter(([id]) => id !== sel.id)
      .map(([recipeId, q]) => ({ recipeId, qtyHall: q.hall, qtyDelivery: q.delivery, qtyTakeout: q.takeout, qtyWaste: q.waste }));
    items.push({ recipeId: sel.id, qtyHall: draft.hall, qtyDelivery: draft.delivery, qtyTakeout: draft.takeout, qtyWaste: draft.waste });

    saveSale.mutate(
      { date: today, items },
      {
        onSuccess: (shortages) => { setSel(null); warnShortages(shortages); },
        onError: (e) => Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  const allItems = () =>
    [...soldBy.entries()].map(([recipeId, q]) => ({
      recipeId, qtyHall: q.hall, qtyDelivery: q.delivery, qtyTakeout: q.takeout, qtyWaste: q.waste,
    }));

  const addEtc = () => {
    const price = Number(etcPrice.replace(/[^\d.-]/g, ''));
    const qty = Number(etcQty.replace(/[^\d.-]/g, '')) || 1;
    if (etcName.trim() === '' || !Number.isFinite(price) || price < 0) {
      Alert.alert('입력을 확인해 주세요', '항목명과 판매가를 입력해 주세요.');
      return;
    }
    const next: EtcItem[] = [...(s?.etcItems ?? []), { name: etcName.trim(), price, qty }];
    saveSale.mutate(
      { date: today, items: allItems(), etcItems: next },
      {
        onSuccess: () => { setEtcOpen(false); setEtcName(''); setEtcPrice(''); setEtcQty('1'); },
        onError: (e) => Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  const addExpense = () => {
    const amount = Number(expAmount.replace(/[^\d.-]/g, ''));
    if (expName.trim() === '' || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert('입력을 확인해 주세요', '항목명과 금액을 입력해 주세요.');
      return;
    }
    const next: ExtraItem[] = [...(s?.extraItems ?? []), { name: expName.trim(), amount, memo: expMemo.trim() || undefined }];
    saveSale.mutate(
      { date: today, items: allItems(), extraItems: next },
      {
        onSuccess: () => { setExpOpen(false); setExpName(''); setExpAmount(''); setExpMemo(''); },
        onError: (e) => Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  const marginPct = summary && summary.revenue > 0 ? Math.round((summary.profit / summary.revenue) * 1000) / 10 : 0;
  const draftTotal = draft.hall + draft.delivery + draft.takeout;
  const sortLabel = SORTS.find((x) => x.key === sort)?.label ?? '판매량순';

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ paddingTop: insets.top, backgroundColor: T.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingTop: 6, paddingBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }}>매출관리</Text>
            <Text style={{ fontSize: 14, color: T.sub2, marginTop: 2, fontWeight: '600' }}>{dayLabel(today)}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/sales/analytics' as Href)}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            accessibilityRole="button" accessibilityLabel="매출 분석"
          >
            <Icon name="calendar" size={23} color={T.ink2} />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {/* 오늘 손익 히어로 */}
        <View style={{ backgroundColor: T.blue, borderRadius: 16, padding: 17, marginBottom: 11 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 11 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.85)' }}>오늘 순이익 (실시간)</Text>
            <Pressable
              onPress={() => router.push(`/sales/day?date=${today}` as Href)}
              accessibilityRole="button" accessibilityLabel="일 손익 상세"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.onColor }}>일 상세</Text>
              <Icon name="chevron" size={14} color={T.onColor} />
            </Pressable>
          </View>
          <Text style={[{ fontSize: 22, fontWeight: '800', color: T.onColor, letterSpacing: -0.6 }, NUM]}>
            {won(summary?.profit ?? 0)}<Text style={{ fontSize: 16 }}>원</Text>
          </Text>
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 13 }}>
            {([
              ['매출', won(summary?.revenue ?? 0)],
              ['지출', won((summary?.revenue ?? 0) - (summary?.profit ?? 0))],
              ['이익률', `${marginPct}%`],
            ] as const).map(([l, v]) => (
              <View key={l}>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>{l}</Text>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: T.onColor, marginTop: 1 }, NUM]}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 기타 매출 · 지출 추가 */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {([
            ['기타 매출', s?.etcRevenue ?? 0, () => setEtcOpen(true)],
            ['지출 추가', s?.dailyExtra ?? 0, () => setExpOpen(true)],
          ] as const).map(([label, amt, onP]) => (
            <Pressable
              key={label}
              onPress={onP}
              accessibilityRole="button" accessibilityLabel={label}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface }}
            >
              <Icon name="plus" size={16} color={T.sub2} sw={2.2} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>{label}</Text>
              {amt > 0 ? <Text style={[{ fontSize: 14, fontWeight: '700', color: T.blue }, NUM]}>{won(amt)}</Text> : null}
            </Pressable>
          ))}
        </View>

        {/* 정렬 + 메뉴 관리 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 2, marginBottom: 9 }}>
          <SortChip label={sortLabel} onPress={() => setSortOpen(true)} />
          <Pressable
            onPress={() => router.push('/recipes' as Href)}
            accessibilityRole="button" accessibilityLabel="메뉴 관리"
            hitSlop={6}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Icon name="edit" size={15} color={T.blue} sw={2.2} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>메뉴 관리</Text>
          </Pressable>
        </View>

        <QueryState
          isLoading={recipes.isLoading || day.isLoading}
          error={recipes.error ?? day.error}
          isEmpty={list.length === 0}
          onRetry={() => { void recipes.refetch(); void day.refetch(); }}
          emptyTitle="등록된 메뉴가 없어요"
          emptyHint="레시피 탭에서 메뉴를 먼저 등록해 주세요"
        >
          <Card pad={0} style={{ overflow: 'hidden' }}>
            {list.map((m, i) => {
              const q = soldBy.get(m.id);
              const total = q ? q.hall + q.delivery + q.takeout : 0;
              return (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 14, paddingHorizontal: 15, borderBottomWidth: i < list.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>{m.name}</Text>
                    <Text style={[{ fontSize: 14, color: T.ter, marginTop: 3 }, NUM]}>
                      판매가 {won(m.price)} · 재료비 {won(Math.round(m.materialCost))}
                    </Text>
                    <Pressable onPress={() => openMenu(m)} accessibilityRole="button" accessibilityLabel={`${m.name} 판매 수량 수정`} style={{ marginTop: 6, alignSelf: 'flex-start' }} hitSlop={6}>
                      <Text style={[{ fontSize: 14, fontWeight: '700', color: total > 0 ? T.blue : T.ter }, NUM]}>
                        총 {total}개{q && q.waste > 0 ? ` · 폐기 ${q.waste}` : ''}
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => openMenu(m)}
                    accessibilityRole="button" accessibilityLabel={`${m.name} 판매 입력`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10, backgroundColor: T.blue }}
                  >
                    <Icon name="plus" size={16} color={T.onColor} sw={2.4} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: T.onColor }}>판매</Text>
                  </Pressable>
                </View>
              );
            })}
          </Card>
        </QueryState>
      </ScrollView>

      {/* SALES-05 개수 수정 */}
      <Sheet visible={sel != null} onClose={() => setSel(null)} title="오늘의 판매 수량" sub={sel?.name} height={560}>
        {sel ? (
          <View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub2, marginBottom: 8 }}>판매</Text>
            <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
              {([
                ['매장', 'hall'], ['배달', 'delivery'], ['포장', 'takeout'],
              ] as const).map(([n, key], i) => (
                <View key={n} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: T.line2 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>{n}</Text>
                  <SaleStepper label={`${n} 판매량`} value={draft[key]} onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))} />
                </View>
              ))}
            </Card>

            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub2, marginBottom: 8 }}>폐기</Text>
            <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>조리 폐기</Text>
                  <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>재료는 나가고 매출은 0</Text>
                </View>
                <SaleStepper label="조리 폐기 수량" value={draft.waste} onChange={(v) => setDraft((d) => ({ ...d, waste: v }))} />
              </View>
            </Card>

            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, borderRadius: 12, backgroundColor: T.surface2 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub }}>합계</Text>
              <View style={{ flex: 1 }} />
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>
                판매 {draftTotal}개{draft.waste > 0 ? ` · 폐기 ${draft.waste}개` : ''}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: T.sub2, marginTop: 10, lineHeight: 20 }}>
              저장하면 이 메뉴의 레시피대로 식재료 재고가 차감돼요.
            </Text>

            <View style={{ marginTop: 16 }}>
              <Button kind="primary" size="lg" full loading={saveSale.isPending} onPress={saveQty}>저장</Button>
            </View>
          </View>
        ) : null}
      </Sheet>

      {/* SALES-06 기타 매출 추가 */}
      <Sheet visible={etcOpen} onClose={() => setEtcOpen(false)} title="기타 매출 추가" sub="레시피에 없는 음료·기타 판매" height={560}>
        {(s?.etcItems.length ?? 0) > 0 ? (
          <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
            {s!.etcItems.map((e, i) => (
              <View key={`${e.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 15, borderBottomWidth: i < s!.etcItems.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{e.name} <Text style={{ color: T.ter }}>×{e.qty}</Text></Text>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink, marginRight: 10 }, NUM]}>{won(e.price * e.qty)}원</Text>
                <Pressable
                  onPress={() => saveSale.mutate({ date: today, items: allItems(), etcItems: s!.etcItems.filter((_, j) => j !== i) })}
                  hitSlop={8} accessibilityRole="button" accessibilityLabel={`${e.name} 삭제`}
                >
                  <Icon name="close" size={16} color={T.ter} />
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}
        <Field label="항목명" req><Input value={etcName} onChangeText={setEtcName} placeholder="예: 음료" /></Field>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1.5 }}><Field label="판매가" req><Input value={etcPrice} onChangeText={setEtcPrice} placeholder="2000" keyboardType="number-pad" suffix="원" mono /></Field></View>
          <View style={{ flex: 1 }}><Field label="수량"><Input value={etcQty} onChangeText={setEtcQty} keyboardType="number-pad" suffix="개" mono /></Field></View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: T.blueTint }}>
          <Icon name="info" size={15} color={T.blue} />
          <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: 20 }}>기타 매출은 재료 차감 없이 매출에만 더해져요.</Text>
        </View>
        <View style={{ marginTop: 18 }}>
          <Button kind="primary" size="lg" full loading={saveSale.isPending} onPress={addEtc}>추가</Button>
        </View>
      </Sheet>

      {/* SALES-07 지출 추가 */}
      <Sheet visible={expOpen} onClose={() => setExpOpen(false)} title="지출 추가" sub="재료비 외 당일 현금 지출" height={580}>
        {(s?.extraItems.length ?? 0) > 0 ? (
          <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
            {s!.extraItems.map((e, i) => (
              <View key={`${e.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 15, borderBottomWidth: i < s!.extraItems.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub }}>{e.name}</Text>
                  {e.memo ? <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{e.memo}</Text> : null}
                </View>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink, marginRight: 10 }, NUM]}>{won(e.amount)}원</Text>
                <Pressable
                  onPress={() => saveSale.mutate({ date: today, items: allItems(), extraItems: s!.extraItems.filter((_, j) => j !== i) })}
                  hitSlop={8} accessibilityRole="button" accessibilityLabel={`${e.name} 삭제`}
                >
                  <Icon name="close" size={16} color={T.ter} />
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}
        <Field label="항목명" req><Input value={expName} onChangeText={setExpName} placeholder="예: 얼음·소모품" /></Field>
        <Field label="금액" req><Input value={expAmount} onChangeText={setExpAmount} placeholder="15000" keyboardType="number-pad" suffix="원" mono /></Field>
        <Field label="메모 (선택)"><Input value={expMemo} onChangeText={setExpMemo} placeholder="간단 메모" /></Field>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: T.amberTint }}>
          <Icon name="info" size={15} color={T.amberText} />
          <Text style={{ flex: 1, fontSize: 14, color: T.amberText, lineHeight: 20 }}>그날 손익에서만 차감되고, 고정 지출엔 반영되지 않아요.</Text>
        </View>
        <View style={{ marginTop: 18 }}>
          <Button kind="primary" size="lg" full loading={saveSale.isPending} onPress={addExpense}>추가</Button>
        </View>
      </Sheet>

      <SortSheet visible={sortOpen} options={SORTS} value={sort} onSelect={setSort} onClose={() => setSortOpen(false)} />
    </View>
  );
}
