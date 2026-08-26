/**
 * SALES-21 과거 판매 내역 수정·추가 (기획서 §6.4).
 *
 * 종료된 영업일을 **다시 열지 않고** 고친다. 서버의 `amend_ended_business_day` 가
 * 그날 기준(스냅샷)으로 다시 계산하고 전후 값을 감사 기록에 남긴다.
 *
 * 이 화면이 지켜야 하는 것 —
 *   · 상단에는 `영업일`만 둔다. `판매 채널 · 매장` 처럼 채널을 고정하는 행은 두지 않는다.
 *   · 메뉴 행에는 메뉴명과 현재 판매 수량만. `판매가 · 재료비` 보조 문구는 안 붙인다.
 *     (그 값은 **그날 기준**이라 지금 레시피 값을 적으면 거짓말이 된다)
 *   · 기록이 없던 날에 저장할 때만 `당시 기록이 없어…` 확인을 띄운다.
 *
 * ⚠ 오늘·영업 중인 날은 이 문이 아니다. 서버가 45011 로 돌려보내고, 그건 오류가 아니라
 *   "판매 화면에서 저장하세요" 라는 뜻이다.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader, Button, Card, ConfirmSheet, Field, Icon, Input, Notice, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { useRecipeList } from '@/features/recipes/hooks';
import {
  useAmendPastSale, useSalesDay,
  type ChannelCode, type EtcItem, type ExtraItem, type SaleItemInput,
} from '../hooks';
import { CHANNEL_LABEL, channelName } from '../channels';
import { isDateOutOfRange, isDayLive, isRevisionConflict, useSalesBusinessDate } from '../businessDay';
import { BusinessDateGate } from '../components/BusinessDateGate';
import { SaleStepper } from '../components/SaleStepper';
import { dayLabel } from '../period';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 화면 입력용 수량 묶음. 저장 전까지는 서버 값과 별개로 들고 있어야 취소가 가능하다. */
interface Qty { hall: number; delivery: number; takeout: number; waste: number }
const ZERO: Qty = { hall: 0, delivery: 0, takeout: 0, waste: 0 };

export default function SalesPastEditScreen() {
  return (
    <BusinessDateGate source={useSalesBusinessDate()} title="판매 내역">
      {(serverToday) => <SalesPastEditBody serverToday={serverToday} />}
    </BusinessDateGate>
  );
}

function SalesPastEditBody({ serverToday }: { serverToday: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date ?? serverToday;

  const day = useSalesDay(date);
  const recipes = useRecipeList();
  const amend = useAmendPastSale();

  const s = day.data;

  /** 화면이 고친 수량. **보낸 것만** 서버가 바꾼다 — 안 건드린 메뉴는 넣지 않는다(0117). */
  const [edits, setEdits] = useState<Record<string, Qty>>({});
  const [sel, setSel] = useState<{ id: string; name: string } | null>(null);
  const [draft, setDraft] = useState<Qty>(ZERO);

  const [etcOpen, setEtcOpen] = useState(false);
  const [etcName, setEtcName] = useState('');
  const [etcPrice, setEtcPrice] = useState('');
  const [etcQty, setEtcQty] = useState('1');
  const [etcChannel, setEtcChannel] = useState<ChannelCode>('hall');
  const [etc, setEtc] = useState<EtcItem[] | null>(null);

  const [expOpen, setExpOpen] = useState(false);
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expMemo, setExpMemo] = useState('');
  const [extra, setExtra] = useState<ExtraItem[] | null>(null);

  const [confirmNoLedger, setConfirmNoLedger] = useState(false);
  /**
   * 짧은 알림. **뜻을 값으로 들고 있는다** — 예전엔 닫을 때 문구를 되읽어
   * `startsWith('아직 영업 중')` 으로 갈랐다. 문구 한 글자만 고쳐도 조용히 깨진다.
   */
  const [toast, setToast] = useState<{ text: string; goHome?: boolean } | null>(null);

  /** 서버 값 위에 화면 수정분을 덮은 현재 수량. */
  const qtyOf = (recipeId: string): Qty => {
    const e = edits[recipeId];
    if (e) return e;
    const it = s?.items.find((i) => i.recipeId === recipeId);
    return it ? { hall: it.qtyHall, delivery: it.qtyDelivery, takeout: it.qtyTakeout, waste: it.qtyWaste } : ZERO;
  };

  const etcItems = etc ?? s?.etcItems ?? [];
  const extraItems = extra ?? s?.extraItems ?? [];

  const dirty = Object.keys(edits).length > 0 || etc !== null || extra !== null;

  /*
   * 메뉴 목록 — **그날 판 것이 위로**, 그 아래에 나머지 메뉴.
   * 그날 판 메뉴가 지금 판매 중지됐어도 보여야 한다. 과거 정정은 지금 파는지가 아니라
   * 그날 무엇이 있었는지를 따른다(0149) — 목록에서 빼면 그 수량을 영영 못 고친다.
   */
  const rows = useMemo(() => {
    const sold = (s?.items ?? []).filter((i) => i.recipeId).map((i) => ({ id: i.recipeId!, name: i.menuName }));
    const soldIds = new Set(sold.map((r) => r.id));
    const rest = (recipes.data ?? [])
      .filter((r) => !soldIds.has(r.id))
      .map((r) => ({ id: r.id, name: r.name }));
    return [...sold, ...rest];
  }, [s?.items, recipes.data]);

  const openQty = (id: string, name: string) => { setDraft(qtyOf(id)); setSel({ id, name }); };

  const applyQty = () => {
    if (!sel) return;
    setEdits((m) => ({ ...m, [sel.id]: draft }));
    setSel(null);
  };

  const items = (): SaleItemInput[] =>
    Object.entries(edits).map(([recipeId, q]) => ({
      recipeId, qtyHall: q.hall, qtyDelivery: q.delivery, qtyTakeout: q.takeout, qtyWaste: q.waste,
    }));

  const onError = (e: unknown) => {
    if (isDayLive(e)) {
      setToast({ text: '아직 영업 중인 날이에요. 매출관리 화면에서 저장해 주세요.', goHome: true });
      return;
    }
    if (isDateOutOfRange(e)) { setToast({ text: '지난달 1일부터 오늘까지만 고칠 수 있어요.' }); return; }
    if (isRevisionConflict(e)) {
      setToast({ text: '다른 기기에서 이 날의 판매가 바뀌었어요. 다시 불러올게요.' });
      void day.refetch();
      setEdits({}); setEtc(null); setExtra(null);
      return;
    }
    setToast({ text: e instanceof Error ? e.message : '저장하지 못했어요.' });
  };

  /** `after` 는 요청이 끝난 뒤에 할 일 — 확인 시트를 그때 닫으려고 받는다. */
  const run = (after?: () => void) => {
    if (!s) return;
    amend.mutate(
      {
        date,
        baseRevision: s.revision,
        items: items(),
        etcItems: etc ?? undefined,
        extraItems: extra ?? undefined,
      },
      {
        onSuccess: (r) => {
          after?.();
          setEdits({}); setEtc(null); setExtra(null);
          // ⚠ `changed=false` 는 오류가 아니다. 같은 값을 다시 보냈을 뿐이다(0148).
          setToast({ text: r.changed ? '저장했어요.' : '바뀐 내용이 없어요.' });
        },
        onError: (e) => { after?.(); onError(e); },
      },
    );
  };

  const save = () => {
    if (!s) return;
    // 기록이 없던 날은 **무엇을 기준으로 저장하는지** 먼저 알린다(§6.4).
    if (!s.hasLedger) { setConfirmNoLedger(true); return; }
    run();
  };

  const addEtc = () => {
    const price = Number(etcPrice.replace(/[^0-9]/g, ''));
    const qty = Number(etcQty.replace(/[^0-9]/g, '')) || 1;
    if (!etcName.trim() || !price) { setToast({ text: '항목명과 판매가를 적어 주세요.' }); return; }
    setEtc([...etcItems, { name: etcName.trim(), price, qty, channel: etcChannel }]);
    setEtcName(''); setEtcPrice(''); setEtcQty('1'); setEtcOpen(false);
  };

  const addExpense = () => {
    const amount = Number(expAmount.replace(/[^0-9]/g, ''));
    if (!expName.trim() || !amount) { setToast({ text: '항목명과 금액을 적어 주세요.' }); return; }
    setExtra([...extraItems, { name: expName.trim(), amount, memo: expMemo.trim() || undefined }]);
    setExpName(''); setExpAmount(''); setExpMemo(''); setExpOpen(false);
  };

  const draftTotal = draft.hall + draft.delivery + draft.takeout;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title={`${dayLabel(date, serverToday)} 판매 내역`}
        onBack={() => safeBack(`/sales/day?date=${date}` as Href)}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24 + insets.bottom + 64, gap: 11 }}>
        <QueryState
          isLoading={day.isLoading || recipes.isLoading}
          error={day.error ?? recipes.error}
          isEmpty={false}
          onRetry={() => { void day.refetch(); void recipes.refetch(); }}
          emptyTitle=""
        >
          {s ? (
            <>
              {/* 상단은 영업일 한 줄뿐이다. 채널을 고정하는 행은 두지 않는다(§6.4). */}
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: T.sub }}>영업일</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>{dayLabel(date, serverToday)}</Text>
                </View>
              </Card>

              {!s.editable ? (
                <Notice>지난달 1일부터 오늘까지만 고칠 수 있어요.</Notice>
              ) : null}

              {!s.hasLedger ? (
                <Notice>이 날은 영업 기록이 없어요. 저장하면 현재 판매가와 원가를 기준으로 계산돼요.</Notice>
              ) : null}

              <Card pad={0} style={{ overflow: 'hidden' }}>
                {rows.map((r, i) => {
                  const q = qtyOf(r.id);
                  const total = q.hall + q.delivery + q.takeout;
                  const changed = Boolean(edits[r.id]);
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => openQty(r.id, r.name)}
                      disabled={!s.editable}
                      accessibilityRole="button"
                      accessibilityLabel={`${r.name} 판매 수량 ${total}개`}
                      style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingVertical: 13, paddingHorizontal: 15,
                        borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: T.line2,
                        opacity: s.editable ? 1 : 0.5,
                      }}
                    >
                      {/* 메뉴명과 수량만. 판매가·재료비는 그날 기준이라 여기 적으면 거짓말이 된다. */}
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>{r.name}</Text>
                      {q.waste > 0 ? (
                        <Text style={[{ fontSize: 13, fontWeight: '700', color: T.ter, marginRight: 10 }, NUM]}>폐기 {q.waste}</Text>
                      ) : null}
                      {total > 0 ? (
                        <Text style={[{ fontSize: 16, fontWeight: '800', color: changed ? T.blue : T.ink, marginRight: 6 }, NUM]}>{total}개</Text>
                      ) : (
                        <Text style={{ fontSize: 15, fontWeight: '700', color: T.blue, marginRight: 6 }}>+ 판매</Text>
                      )}
                      <Icon name="chevron" size={16} color={T.ter} />
                    </Pressable>
                  );
                })}
              </Card>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button kind="ghost" full disabled={!s.editable} onPress={() => setEtcOpen(true)}>
                    {`기타 매출${etcItems.length ? ` ${etcItems.length}` : ''}`}
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button kind="ghost" full disabled={!s.editable} onPress={() => setExpOpen(true)}>
                    {`지출 추가${extraItems.length ? ` ${extraItems.length}` : ''}`}
                  </Button>
                </View>
              </View>
            </>
          ) : null}
        </QueryState>
      </ScrollView>

      {/* 저장은 화면 아래 고정. 고친 것이 없으면 누를 수 없다. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 + insets.bottom, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button
          kind="primary" size="lg" full
          disabled={!s || !s.editable || !dirty}
          loading={amend.isPending}
          onPress={save}
        >
          저장
        </Button>
      </View>

      {/* 메뉴별·채널별 수량 — 늘리고 줄일 수 있어야 한다(§6.4). */}
      <Sheet visible={sel != null} onClose={() => setSel(null)} title="판매 수량" sub={sel?.name} height={560}>
        {sel ? (
          <View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub2, marginBottom: 8 }}>판매</Text>
            <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
              {CHANNEL_LABEL.map(([code, name], i) => {
                const key = code === 'hall' ? 'hall' : code === 'delivery' ? 'delivery' : 'takeout';
                return (
                  <View key={code} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: i < CHANNEL_LABEL.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>{name}</Text>
                    <SaleStepper label={`${name} 판매량`} value={draft[key]} onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))} />
                  </View>
                );
              })}
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

            <View style={{ marginTop: 16 }}>
              <Button kind="primary" size="lg" full onPress={applyQty}>확인</Button>
            </View>
          </View>
        ) : null}
      </Sheet>

      {/* 기타 매출 — 오늘 입력과 같은 UI 다(§6.4). */}
      <Sheet visible={etcOpen} onClose={() => setEtcOpen(false)} title="기타 매출" sub="레시피에 없는 음료·기타 판매" height={560}>
        {etcItems.length > 0 ? (
          <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
            {etcItems.map((e, i) => (
              <View key={`${e.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 15, borderBottomWidth: i < etcItems.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub }}>{e.name} <Text style={{ color: T.ter }}>×{e.qty}</Text></Text>
                  {/* 미지정은 회색으로 둔다 — 매장으로 보이면 안 된다(0093). */}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: e.channel ? T.blue : T.ter, marginTop: 2 }}>{channelName(e.channel)}</Text>
                </View>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink, marginRight: 10 }, NUM]}>{won(e.price * e.qty)}원</Text>
                <Pressable
                  onPress={() => setEtc(etcItems.filter((_, j) => j !== i))}
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
        <Field label="판매 채널" req>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            {CHANNEL_LABEL.map(([code, name]) => {
              const on = etcChannel === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => setEtcChannel(code)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={name}
                  style={{
                    flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: 'center',
                    borderWidth: on ? 1.5 : 1,
                    borderColor: on ? T.blue : T.line,
                    backgroundColor: on ? T.blueTint : T.surface,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: on ? '800' : '600', color: on ? T.blue : T.sub }}>{name}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
        <View style={{ marginTop: 18 }}>
          <Button kind="primary" size="lg" full onPress={addEtc}>추가</Button>
        </View>
      </Sheet>

      {/* 지출 추가 — 오늘 입력과 같은 UI 다(§6.4). */}
      <Sheet visible={expOpen} onClose={() => setExpOpen(false)} title="지출 추가" sub="재료비 외 그날 현금 지출" height={580}>
        {extraItems.length > 0 ? (
          <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
            {extraItems.map((e, i) => (
              <View key={`${e.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 15, borderBottomWidth: i < extraItems.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub }}>{e.name}</Text>
                  {e.memo ? <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{e.memo}</Text> : null}
                </View>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink, marginRight: 10 }, NUM]}>{won(e.amount)}원</Text>
                <Pressable
                  onPress={() => setExtra(extraItems.filter((_, j) => j !== i))}
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
        <View style={{ marginTop: 18 }}>
          <Button kind="primary" size="lg" full onPress={addExpense}>추가</Button>
        </View>
      </Sheet>

      {/*
        §6.4 — 기록 없는 과거 날짜는 **빈 화면에서 경고하지 않는다.** 저장할 때 한 번 알린다.
        ⚠ 문구를 정확히 쓴다. 매출과 판매 수량은 사장님이 적은 실제 기록이므로
          `전체가 추정` 처럼 말하면 안 된다 — 현재 기준인 것은 판매가와 원가다.
      */}
      <ConfirmSheet
        visible={confirmNoLedger}
        title="이 날의 기록이 없어요"
        message="당시 기록이 없어 현재 판매가와 원가를 기준으로 저장해요."
        confirmText="저장"
        loading={amend.isPending}
        onCancel={() => setConfirmNoLedger(false)}
        /* ⚠ **여기서 닫지 않는다.** 닫고 부르면 `loading` 이 죽은 값이 되고,
           저장이 도는 동안 화면에 아무 표시가 없다. 끝난 뒤에 닫는다. */
        onConfirm={() => run(() => setConfirmNoLedger(false))}
      />

      {toast ? (
        <Pressable
          onPress={() => {
            const goHome = toast.goHome;
            setToast(null);
            if (goHome) router.replace('/sales' as Href);
          }}
          accessibilityRole="button" accessibilityLabel="알림 닫기"
          style={{ position: 'absolute', left: 16, right: 16, bottom: 84 + insets.bottom, paddingVertical: 13, paddingHorizontal: 15, borderRadius: 12, backgroundColor: 'rgba(25,31,40,0.92)' }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', lineHeight: 20 }}>{toast.text}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
