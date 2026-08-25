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
import { Badge, Button, Card, ConfirmSheet, Field, Icon, Input, QueryState, Sheet, SortChip, SortSheet, type SortOption } from '@/components/kit';
import { T, won } from '@/theme/tokens';
import { useRecipeList, type RecipeRow } from '@/features/recipes/hooks';


import { useCheckSaleShortages, useRecipeShortages, useSalesDay, useSaveSale,
  type ChannelCode, type EtcItem, type ExtraItem, type SaleItemInput, type Shortage, type ShortageRecipe } from '../hooks';
import { ShortageWarningSheet } from '../components/ShortageWarningSheet';
import { setPendingSale, clearPendingSale } from '../pendingSale';
import { CHANNEL_LABEL, channelName } from '../channels';
import { isClosedError, isNotOpenError, isRevisionConflict, useBusinessDay, useDayMenuBasis, useOpenBusinessDay, useSalesBusinessDate } from '../businessDay';
import { BusinessDayBar } from '../components/BusinessDayBar';
import { dayLabel } from '../period';

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
  /*
   * ⚠ **서버가 정한 장부 날짜**를 쓴다(0125). 앱이 계산하지 않는다.
   *   예전엔 `todayBusiness()` 가 `+09:00` 고정 오프셋으로 만들었고, 그래서 앱과 DB 가
   *   각자 오늘을 계산했다(기획서 §2.1). 새벽 영업이면 장부는 전날인데 앱은 자정에
   *   날짜를 넘겨 버려, 그 판매가 다음 날 장부로 샌다.
   *
   * ⚠ 못 받았으면 `null` 이고, 그동안 **저장을 막는다**. 날짜를 모르는 채로 저장하면
   *   그게 곧 남의 날짜에 적는 것이다. 조회도 그동안 멈춘다(빈 화면이 잘못된 날보다 낫다).
   */
  const serverDate = useSalesBusinessDate();
  /** 빈 문자열이면 조회가 꺼지고 저장 버튼도 잠긴다. 날짜를 지어내지 않는다. */
  const today = serverDate ?? '';

  const day = useSalesDay(today);
  const recipes = useRecipeList();
  const saveSale = useSaveSale();
  const bday = useBusinessDay();

  const shortage = useRecipeShortages();
  const openDay = useOpenBusinessDay();
  /**
   * 오늘 팔면 얼마로 잡히는지(0061). 카드가 현재 레시피를 보고 있으면
   * 판매가를 고친 순간 화면과 장부가 어긋난다 — 화면이 20,000 이라 해 놓고
   * 12,000 이 기록되는 식이다.
   */
  const basis = useDayMenuBasis(today);

  const [sel, setSel] = useState<RecipeRow | null>(null);
  const [draft, setDraft] = useState<Qty>(ZERO);
  const [sort, setSort] = useState<SortKey>('qty');
  const [sortOpen, setSortOpen] = useState(false);
  /** 판매를 저장하려다 45001 로 막혔을 때, 영업을 시작하면 이어서 다시 저장한다. */
  const [pendingRetry, setPendingRetry] = useState<null | (() => void)>(null);
  /** 짧은 알림 — 팝업 대신. 웹에서도 뜬다. */
  const [toast, setToast] = useState<string | null>(null);
  /**
   * 저장 직전에 잰 부족 결과. 있으면 시트를 띄우고, `그대로 판매` 를 누르면 저장한다.
   * ⚠ 판매는 **한 번만** 저장한다(기획안 §4.5). 경고 때문에 두 번 부르면 안 된다 —
   *   그래서 잴 때는 `sale_shortages`(읽기 전용)만 부르고, 저장은 여기서 한 번 한다.
   */
  const [ask, setAsk] = useState<null | { recipes: ShortageRecipe[]; save: () => void }>(null);
  const checkShortages = useCheckSaleShortages();

  const [etcOpen, setEtcOpen] = useState(false);
  const [etcName, setEtcName] = useState('');
  const [etcPrice, setEtcPrice] = useState('');
  const [etcQty, setEtcQty] = useState('1');
  /*
   * 기본값은 매장이다 — 주류·음료는 거의 매장에서 나간다.
   * ⚠ 기본값이 있다고 '모르면 매장'인 건 아니다. 옛 줄은 channel 이 아예 없고,
   *   그건 미지정으로 남는다(0093).
   */
  const [etcChannel, setEtcChannel] = useState<ChannelCode>('hall');

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

  const basisMap = basis.data;
  const list = useMemo(() => {
    const rows = [...(recipes.data ?? [])];
    switch (sort) {
      case 'name': return rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      // 순이익순도 오늘 기준으로 — 카드에 보이는 값과 정렬 기준이 달라지면 안 된다.
      case 'profit':
        return rows.sort((a, b) =>
          (basisMap?.get(b.id)?.profit ?? b.profit) - (basisMap?.get(a.id)?.profit ?? a.profit));
      default:
        return rows.sort((a, b) => {
          const qa = soldBy.get(a.id);
          const qb = soldBy.get(b.id);
          const ta = qa ? qa.hall + qa.delivery + qa.takeout : 0;
          const tb = qb ? qb.hall + qb.delivery + qb.takeout : 0;
          return tb - ta || a.name.localeCompare(b.name, 'ko');
        });
    }
  }, [recipes.data, sort, soldBy, basisMap]);

  const openMenu = (r: RecipeRow) => {
    setSel(r);
    setDraft(soldBy.get(r.id) ?? ZERO);
  };

  /*
   * 부족분은 오류가 아니다 — 이미 팔린 것이다.
   * ⚠ 0102 이후 부족분은 **음수 재고로 장부에 남는다.** 그래서 긴 목록 팝업 대신
   *   짧게만 알리고, 자세한 건 상단의 `식재료 부족 N개` 안내가 계속 들고 있는다
   *   (기획안 §4.5). 팝업으로 다 말하면 닫는 순간 사라진다.
   */
  const warnShortages = (shortages: Shortage[]) => {
    if (shortages.length === 0) return;
    setToast('판매를 기록했어요 · 부족분은 음수 재고로 반영돼요');
  };

  /*
   * 저장이 막힌 두 경우는 오류가 아니라 **다음에 할 일**이다.
   *  45001 아직 영업 전  → 영업을 시작하고 방금 누른 판매를 이어서 저장한다.
   *  45002 이미 종료됨   → 영업 기록을 다시 열어야 한다고 알린다.
   *
   * ⚠ `Alert.alert()` 은 웹에서 **빈 함수**라 아무 일도 안 일어난다
   *   (`react-native-web` 의 구현이 `static alert() {}`).
   *   여기가 특히 치명적이었다 — 45001 확인창이 안 뜨니 **판매 저장이 영영 막혔다.**
   */
  const onSaveError = (e: unknown, retry: () => void) => {
    if (isNotOpenError(e)) { setPendingRetry(() => retry); return; }
    if (isClosedError(e)) { setToast('이미 종료된 영업일이에요 · 위에서 영업 기록을 다시 열어 주세요'); return; }
    /*
     * ⚠ 낡은 화면(45009 · 0117). 예전엔 이런 저장이 **그냥 통과했고**, 다른 기기가 적은
     *   판매를 조용히 지웠다(실측: 제육 5개가 사라졌다). 이제 서버가 막는다.
     *   할 일은 하나다 — 다시 받아서 보여 준다. 사장님이 보고 다시 누르면 된다.
     */
    if (isRevisionConflict(e)) {
      /*
       * 낡은 화면이란 **다른 기기가 고치기 전 데이터를 보고 있는 지금 이 화면**이다.
       * 그러니 붙잡을 게 없다 — 들고 있던 데이터도, 입력하던 값도 **버리고** 다시 받는다.
       *
       * ⚠ 초안을 남겨 두면 안 된다. 그대로 다시 누르면 방금 남이 고친 값을
       *   내 낡은 값으로 덮어쓰게 된다. 지금 판본이라 이번엔 서버도 안 막는다.
       * ⚠ 모달로 세우지 않는다. 사장님이 할 일이 없는 알림이다 —
       *   최신 내역은 이미 다시 받고 있다. 짧게만 알린다.
       */
      setSel(null); setDraft(ZERO);
      setEtcOpen(false); setEtcName(''); setEtcPrice(''); setEtcQty('1');
      setExpOpen(false); setExpName(''); setExpAmount(''); setExpMemo('');
      setAsk(null); setPendingRetry(null); clearPendingSale();
      void day.refetch();
      setToast('다른 기기에서 판매 내역이 변경됐어요 · 최신 내역을 다시 불러왔어요');
      return;
    }
    setToast(e instanceof Error ? e.message : '저장하지 못했어요');
  };

  /*
   * 판매 저장 — **재는 것과 저장하는 것을 갈라 둔다.**
   *
   * ⚠ 재고가 모자라도 막지 않는다(기획안 §2.1·§4.4). 예전엔 서버가 막았고,
   *   한 번 음수가 되면 그 메뉴를 **영영 못 고쳤다** — 수량을 되돌리는 것조차
   *   같은 문으로 들어오기 때문이다. 지금은 알리기만 한다.
   *
   * ⚠ 판정은 서버가 한다. 전체 판매량이 아니라 **이번에 더 빠질 몫**이라
   *   10개를 7개로 줄이는 저장에는 경고가 뜨지 않는다.
   */
  /*
   * 재고를 재고 → (모자라면 묻고) → 저장. **재시도도 이 문으로 들어온다.**
   *
   * ⚠ 예전엔 `아직 영업 전`(45001)으로 막힌 뒤 영업을 시작하고 **저장만** 다시 불렀다.
   *   그런데 첫 검사는 스냅샷이 없을 때 이미 `부족 0건` 을 받아 놨다 — 필요량이
   *   그날 스냅샷에서 오기 때문이다(0119 `has_basis`). 그래서 영업 시작 직후
   *   재시도에서는 경고가 통째로 새어 나갔다. 이제 재시도가 검사부터 다시 한다.
   */
  const checkThenSave = (items: SaleItemInput[]) => {
    // ⚠ 그날 장부를 아직 못 받았으면 저장하지 않는다. 판본을 모르는 채로 보내면
    //   서버가 검사를 건너뛰고, 그 틈으로 낡은 덮어쓰기가 들어온다(0117).
    if (!s) return;
    const run = () =>
      saveSale.mutate(
        // ⚠ 판본을 반드시 실어 보낸다(0117). 빼먹으면 그 경로로 낡은 화면이 남을 덮어쓴다.
        { date: today, items, baseRevision: s.revision },
        {
          onSuccess: (shortages) => { setSel(null); clearPendingSale(); warnShortages(shortages); },
          onError: (e) => onSaveError(e, () => checkThenSave(items)),
        },
      );

    void (async () => {
      let short;
      try {
        short = await checkShortages(today, items);
      } catch {
        // 재는 데 실패했다고 판매를 막지 않는다. 저장은 저장대로 되어야 한다.
        run();
        return;
      }
      /*
       * ⚠ `hasBasis` 가 false 면 `0건` 은 "넉넉하다"가 아니라 **"못 쟀다"** 다(0119).
       *   그대로 저장하면 서버가 45001 로 막고, 영업을 시작한 뒤 이 함수가 다시 불려
       *   그때는 스냅샷이 있으니 제대로 잰다. 여기서 억지로 경고를 띄우지 않는다.
       */
      if (!short.hasBasis || short.ingredientCount === 0) { run(); return; }
      // `재고 확인` 으로 건너갔다가 돌아와도 같은 묶음을 다시 잴 수 있게 들려 보낸다.
      setPendingSale(today, items);
      setAsk({ recipes: short.recipes, save: run });
    })();
  };

  const saveQty = () => {
    if (!sel) return;
    const items: SaleItemInput[] = [...soldBy.entries()]
      .filter(([id]) => id !== sel.id)
      .map(([recipeId, q]) => ({ recipeId, qtyHall: q.hall, qtyDelivery: q.delivery, qtyTakeout: q.takeout, qtyWaste: q.waste }));
    items.push({ recipeId: sel.id, qtyHall: draft.hall, qtyDelivery: draft.delivery, qtyTakeout: draft.takeout, qtyWaste: draft.waste });
    checkThenSave(items);
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
    if (!s) return;   // 판본을 모르면 저장하지 않는다(0117)
    const next: EtcItem[] = [...s.etcItems, { name: etcName.trim(), price, qty, channel: etcChannel }];
    /*
     * ⚠ 기타 매출은 **배열 통째로** 교체된다. 그래서 낡은 화면이 저장하면 다른 기기가
     *   넣은 항목이 통째로 사라진다 — A 가 소주, B 가 맥주를 넣으면 하나만 남는다.
     *   항목 단위로 합치지 않는 이유는 같은 이름이 여럿일 수 있어 무엇이 같은
     *   항목인지 정할 수 없기 때문이다. 대신 **판본 검사**로 낡은 배열을 막는다.
     */
    const run = () =>
      saveSale.mutate(
        { date: today, items: allItems(), etcItems: next, baseRevision: s.revision },
        {
          onSuccess: () => {
            setEtcOpen(false); setEtcName(''); setEtcPrice(''); setEtcQty('1');
            // 채널은 되돌리지 않는다 — 배달 음료를 연달아 적는 게 흔하다.
          },
          onError: (e) => onSaveError(e, run),
        },
      );
    run();
  };

  const addExpense = () => {
    const amount = Number(expAmount.replace(/[^\d.-]/g, ''));
    if (expName.trim() === '' || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert('입력을 확인해 주세요', '항목명과 금액을 입력해 주세요.');
      return;
    }
    if (!s) return;   // 판본을 모르면 저장하지 않는다(0117)
    const next: ExtraItem[] = [...s.extraItems, { name: expName.trim(), amount, memo: expMemo.trim() || undefined }];
    const run = () =>
      saveSale.mutate(
        { date: today, items: allItems(), extraItems: next, baseRevision: s.revision },
        {
          onSuccess: () => { setExpOpen(false); setExpName(''); setExpAmount(''); setExpMemo(''); },
          onError: (e) => onSaveError(e, run),
        },
      );
    run();
  };

  const marginPct = summary && summary.revenue > 0 ? Math.round((summary.profit / summary.revenue) * 1000) / 10 : 0;
  /** 아직 오늘을 시작 안 했나 — 히어로가 0원 대신 `—` 를 보여 줘야 하는 상태. */
  const beforeOpen = bday.data?.status === 'none';
  /*
   * 재고 부족 안내 — 프로토타입 `.stock-notice`.
   * ⚠ 개수는 **서버가 센다**(`recipe_shortages`). 화면에서 다시 세면 재고 확인 화면과
   *   숫자가 갈라진다 — 판정 기준이 두 벌이 되기 때문이다.
   */
  const shortCount = shortage.data?.ingredientCount ?? 0;
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
        {/*
          재고 부족 안내 — 프로토타입 `.stock-notice`. **맨 위**다.
          부족한 게 없으면 아예 안 그린다(프로토타입도 count===0 이면 빈 문자열).
        */}
        {shortCount > 0 ? (
          <Pressable
            onPress={() => router.push('/sales/stock-check' as Href)}
            accessibilityRole="button"
            accessibilityLabel={`식재료 부족 ${shortCount}개 — 재고 확인`}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 52, marginBottom: 11,
              paddingVertical: 11, paddingHorizontal: 13,
              borderWidth: 1, borderColor: T.red, borderRadius: 13, backgroundColor: T.redTint,
            }}
          >
            <Icon name="warn" size={16} color={T.red} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: T.red }}>
                식재료 부족 {shortCount}개
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: T.sub, marginTop: 3 }}>
                부족한 식재료의 재고를 추가해 주세요
              </Text>
            </View>
            <Icon name="chevron" size={16} color={T.red} />
          </Pressable>
        ) : null}

        {/* 영업 상태 — 오늘 기준값이 언제 굳는지 여기서 정해진다 */}
        {bday.data ? <BusinessDayBar state={bday.data} /> : null}

        {/*
          오늘 순이익 — 프로토타입 `.hero`.
          ⚠ 세 칸(매출·지출·이익률)을 **한 줄**로 합쳤다. 프로토타입은
            `매출 529,500원 · 순이익률 17.9%` 한 줄이고, 지출은 아래 일 손익에서 본다.
          ⚠ 영업 전에는 값 자리에 `—` 를 둔다. 0원이라고 쓰면 "오늘 하나도 못 팔았다"로
            읽히는데, 사실은 아직 시작을 안 한 것이다.
          카드 전체를 누르면 일 손익으로 간다 — 프로토타입에 `일 상세` 링크는 없다.
        */}
        <Pressable
          onPress={() => router.push(`/sales/day?date=${today}` as Href)}
          accessibilityRole="button" accessibilityLabel="오늘 손익 자세히"
          style={{ backgroundColor: T.blue, borderRadius: 16, padding: 16, marginBottom: 11 }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.82)' }}>오늘 순이익</Text>
          <Text style={[{ fontSize: 25, fontWeight: '800', color: T.onColor, letterSpacing: -0.6, marginTop: 7 }, NUM]}>
            {beforeOpen ? '—' : `${won(summary?.profit ?? 0)}원`}
          </Text>
          <Text style={[{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.86)', marginTop: 4 }, NUM]}>
            {beforeOpen
              ? '영업을 시작하면 오늘 기록이 열려요'
              : `매출 ${won(summary?.revenue ?? 0)}원 · 순이익률 ${marginPct}%`}
          </Text>
        </Pressable>

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
              const b = basis.data?.get(m.id);
              // 팔 수 없는 이유. 사장님이 끈 것이 먼저다 — 그건 의도이고, 재료는 상태다.
              // ⚠ 오늘 기준에 없는 메뉴는 막지 않는다(0062). 오늘 기록이 없어 움직일 숫자가
              //   없으므로, 팔면 그 시점 값으로 오늘 기준에 더해진다.
              /*
               * ⚠ **판매를 막는 것은 `판매 중지` 하나뿐이다**(기획안 §2.1).
               *   그건 사장님이 끈 것이고 — 의도다.
               *
               *   재료 부족은 막지 않는다. 예전엔 `blockedBy` 도 같이 막았고,
               *   그래서 서버에서 음수 재고를 허용해도 **화면에서 닿을 수가 없었다.**
               *   더 나쁜 건 한 번 음수가 된 메뉴의 수량을 **되돌리지도 못한 것**이다 —
               *   수정도 같은 판매 버튼으로 들어오기 때문이다.
               *   부족은 빨간 뱃지로 알리고, 저장 직전에 한 번 더 묻는다.
               */
              const stopped = !m.active;
              const short = !stopped && m.blockedBy !== null;
              const blocked = stopped;
              return (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 82, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i < list.length - 1 ? 1 : 0, borderBottomColor: T.line2, opacity: blocked ? 0.45 : 1 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: T.ink }} numberOfLines={1}>{m.name}</Text>
                      {stopped ? <Badge tone="neutral" sm>판매 중지</Badge> : short ? <Badge tone="red" sm solid>재료 부족</Badge> : null}
                    </View>
                    <Text style={[{ fontSize: 12, color: T.ter, marginTop: 3 }, NUM]}>
                      {/* 왜 안 되는지 그 자리에서 밝힌다 — 배지만으로는 어느 재료인지 모른다. */}
                      {short
                        ? `${m.blockedBy}이(가) 모자라요 · 팔면 부족분이 음수 재고로 남아요`
                        // ⚠ 오늘 팔면 잡히는 값이다. 현재 레시피가 아니다(0061).
                        : `판매가 ${won(Math.round(b?.price ?? m.price))} · 재료비 ${won(Math.round(b?.materialCost ?? m.materialCost))}`}
                    </Text>
                    {/*
                      지금 값이 오늘 장부와 다르다고 그 자리에서 밝힌다.
                      ⚠ `수정한 값` 이라고 쓰면 안 된다. 이 표시는 **원인을 모른다** —
                        서버의 `changed` 는 `현재 원가 ≠ 스냅샷 원가` 일 뿐이라,
                        사장님이 레시피를 고쳤을 때도 켜지지만 **입고로 단가가 움직여도** 켜진다.
                        실제로 DB 를 새로 깐 직후, 아무것도 안 고쳤는데 네 메뉴에 이 문구가 떠 있었다
                        (그날 보충 입고가 영업 시작 뒤에 들어왔기 때문이다).
                        고치지도 않은 걸 고쳤다고 하면 사장님은 이 줄을 안 믿게 된다.
                      판매가는 사장님만 바꾸므로 그때만 `판매가` 라고 짚어 준다.
                    */}
                    {b?.changed ? (
                      <Text style={[{ fontSize: 13, color: T.amberText, marginTop: 3, fontWeight: '600' }, NUM]}>
                        {b.currentPrice !== b.price
                          ? `판매가 ${won(Math.round(b.currentPrice))}원은 다음 영업일부터 적용돼요`
                          : `지금 재료비 ${won(Math.round(b.currentMaterialCost))}원은 다음 영업일부터 적용돼요`}
                      </Text>
                    ) : null}
                  </View>

                  {/*
                    우측 수량·금액 — 프로토타입 `.menu-value`.
                    ⚠ 좌측에 있던 `총 N개` 줄을 여기로 올렸다. 같은 것을 두 자리에 두지 않는다.
                      누르면 수량 수정으로 가는 것도 그대로다.
                  */}
                  <Pressable
                    onPress={() => openMenu(m)}
                    disabled={blocked}
                    accessibilityRole="button" accessibilityLabel={`${m.name} 판매 수량 수정`}
                    style={{ alignItems: 'flex-end' }}
                    hitSlop={6}
                  >
                    <Text style={[{ fontSize: 15, fontWeight: '800', color: total > 0 ? T.ink : T.ter }, NUM]}>
                      {total}개{q && q.waste > 0 ? ` · 폐기 ${q.waste}` : ''}
                    </Text>
                    {total > 0 ? (
                      <Text style={[{ fontSize: 12, fontWeight: '700', color: T.ter, marginTop: 3 }, NUM]}>
                        {won(Math.round((b?.price ?? m.price) * total))}원
                      </Text>
                    ) : null}
                  </Pressable>

                  <Pressable
                    onPress={() => openMenu(m)}
                    disabled={blocked}
                    accessibilityRole="button"
                    accessibilityLabel={blocked ? `${m.name} 판매 중지` : `${m.name} 판매 입력`}
                    accessibilityState={{ disabled: blocked }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10, backgroundColor: blocked ? T.line : T.blue }}
                  >
                    <Icon name="plus" size={16} color={blocked ? T.ter : T.onColor} sw={2.4} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: blocked ? T.ter : T.onColor }}>판매</Text>
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
              {/* ⚠ 그날 장부를 못 받았으면 못 누른다. 판본 없이 저장하면 검사가 건너뛰어진다(0117). */}
              <Button kind="primary" size="lg" full disabled={!s} loading={saveSale.isPending} onPress={saveQty}>저장</Button>
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
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub }}>{e.name} <Text style={{ color: T.ter }}>×{e.qty}</Text></Text>
                  {/* 미지정은 회색으로 둔다 — 매장으로 보이면 안 된다(0093). */}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: e.channel ? T.blue : T.ter, marginTop: 2 }}>
                    {channelName(e.channel)}
                  </Text>
                </View>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink, marginRight: 10 }, NUM]}>{won(e.price * e.qty)}원</Text>
                <Pressable
                  onPress={() => saveSale.mutate(
                    { date: today, items: allItems(), etcItems: s!.etcItems.filter((_, j) => j !== i), baseRevision: s!.revision },
                    { onError: (e) => onSaveError(e, () => {}) })}
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
        {/*
          한 줄에 채널 하나다. 소주를 매장·배달 둘 다 팔았으면 두 줄로 적는다 —
          메뉴처럼 3칸으로 쪼개면 음료 하나 넣는 데 숫자를 셋 눌러야 한다.
        */}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: T.blueTint }}>
          <Icon name="info" size={15} color={T.blue} />
          <Text style={{ flex: 1, fontSize: 14, color: T.sub2, lineHeight: 20 }}>기타 매출은 재료 차감 없이 매출에만 더해져요.</Text>
        </View>
        <View style={{ marginTop: 18 }}>
          <Button kind="primary" size="lg" full disabled={!s} loading={saveSale.isPending} onPress={addEtc}>추가</Button>
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
                  onPress={() => saveSale.mutate(
                    { date: today, items: allItems(), extraItems: s!.extraItems.filter((_, j) => j !== i), baseRevision: s!.revision },
                    { onError: (e) => onSaveError(e, () => {}) })}
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
          <Button kind="primary" size="lg" full disabled={!s} loading={saveSale.isPending} onPress={addExpense}>추가</Button>
        </View>
      </Sheet>

      <SortSheet visible={sortOpen} options={SORTS} value={sort} onSelect={setSort} onClose={() => setSortOpen(false)} />


      {/*
        저장 직전 부족 확인 — 막는 게 아니라 알리는 것이다(기획안 §4.4).
        ⚠ `그대로 판매` 는 **한 번만** 저장한다. 경고 때문에 두 번 부르면 재고가 두 번 빠진다.
      */}
      <ShortageWarningSheet
        visible={ask !== null}
        mode="sale"
        recipes={ask?.recipes ?? []}
        loading={saveSale.isPending}
        onCheck={() => { setAsk(null); setSel(null); router.push('/sales/stock-check?mode=sale' as Href); }}
        onContinue={() => { const run = ask?.save; setAsk(null); run?.(); }}
        onClose={() => setAsk(null)}
      />

      {/*
        판매를 저장하려다 '아직 영업 전'으로 막혔을 때 — 시작하고 **이어서** 저장한다.
        두 번 누르게 하지 않는다.
      */}
      <ConfirmSheet
        visible={pendingRetry !== null}
        title="오늘 영업을 시작할까요?"
        message={'지금의 판매가·재료 구성·단가·부자재·고정지출·세금이 오늘 기준으로 정해져요. 영업 중에 메뉴를 고쳐도 오늘 매출에는 반영되지 않고, 다음 영업일부터 적용돼요.'}
        confirmText="영업 시작"
        loading={openDay.isPending}
        onCancel={() => setPendingRetry(null)}
        onConfirm={() => {
          const retry = pendingRetry;
          setPendingRetry(null);
          openDay.mutate(undefined, {
            onSuccess: () => retry?.(),
            onError: (err) => setToast(err.message),
          });
        }}
      />

      {/* 짧은 알림 — 팝업 대신. 닫으면 사라지고, 남아야 할 것은 상단 안내가 들고 있다. */}
      {toast ? (
        <Pressable
          onPress={() => setToast(null)}
          accessibilityRole="button" accessibilityLabel="알림 닫기"
          style={{ position: 'absolute', left: 16, right: 16, bottom: 24, paddingVertical: 13, paddingHorizontal: 15, borderRadius: 12, backgroundColor: 'rgba(25,31,40,0.92)' }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', lineHeight: 20 }}>{toast}</Text>
        </Pressable>
      ) : null}

    </View>
  );
}
